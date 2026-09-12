import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { z } from "zod";
import { ACCOUNT_SCENARIOS, QA_REGISTRY, accountEmail, assertLease, assertOwnedAccount, localUrl, resetAccountSql, scenarioName, type AccountScenario } from "./account-presets";

const repo = resolve(__dirname, "../..");
const root = resolve(homedir(), ".quiver/qa-accounts/local-quiver");
const owner = createHash("sha256").update(realpathSync(repo)).digest("hex").slice(0,16);
const recordSchema = z.object({ registry:z.literal(QA_REGISTRY), scenario:z.string(), user_id:z.uuid(), email:z.email(), password:z.string().min(16), lease:z.object({owner:z.string(),expires_at:z.iso.datetime()}).optional() });
type AccountRecord = z.infer<typeof recordSchema>;
type LocalStack = { url:string; anonKey:string; serviceKey:string; admin:SupabaseClient };

function docker(args: string[], input?: string): string {
  try { return execFileSync("docker", args, { input, encoding:"utf8", stdio:["pipe","pipe","pipe"], timeout:30_000 }); }
  catch { throw new Error("Local Docker operation failed; no hosted fallback is allowed"); }
}

function localStack(): LocalStack {
  let raw: unknown;
  try { raw=JSON.parse(execFileSync("supabase", ["status","--output","json"], {cwd:repo,encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:30_000})); }
  catch { throw new Error("Start the local Quiver Supabase stack before preparing an account"); }
  const config=z.object({ API_URL:z.string(), DB_URL:z.string(), ANON_KEY:z.string().min(1), SERVICE_ROLE_KEY:z.string().min(1) }).parse(raw);
  const api=localUrl(config.API_URL), db=localUrl(config.DB_URL);
  // Match both endpoints to the local containers, not merely a string containing localhost.
  for (const [name,port,endpoint] of [["supabase_kong_quiver","8000/tcp",api],["supabase_db_quiver","5432/tcp",db]] as const) {
    const inspected=JSON.parse(docker(["inspect",name]))[0];
    const bindings=inspected?.NetworkSettings?.Ports?.[port] as Array<{HostPort:string}> | undefined;
    if (inspected?.Name !== `/${name}` || inspected?.State?.Running !== true || !bindings?.some(binding=>binding.HostPort === endpoint.port)) {
      throw new Error("Local stack identity/port verification failed");
    }
  }
  return {url:api.origin,anonKey:config.ANON_KEY,serviceKey:config.SERVICE_ROLE_KEY,admin:createClient(api.origin,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})};
}

function sql(query: string): string {
  return docker(["exec","-i","supabase_db_quiver","psql","-X","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-At"],query);
}

function save(path: string, value: unknown): void {
  const temp=`${path}.${process.pid}.tmp`;
  writeFileSync(temp,JSON.stringify(value,null,2)+"\n",{mode:0o600});
  renameSync(temp,path);chmodSync(path,0o600);
}

async function registeredUser(admin: SupabaseClient, scenario: AccountScenario): Promise<User | undefined> {
  for (let page=1;page<=100;page++) {
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
    if(error) throw new Error("Cannot inspect local Auth users");
    const user=data.users.find(user=>user.email === accountEmail(scenario));
    if(user) {assertOwnedAccount(user,scenario);return user;}
    if(data.users.length<1000) return undefined;
  }
  throw new Error("Local account inventory exceeded its bound");
}

function readRecord(path: string, scenario: AccountScenario): AccountRecord | undefined {
  if(!existsSync(path)) return undefined;
  const record=recordSchema.parse(JSON.parse(readFileSync(path,"utf8")));
  if(record.scenario !== scenario || record.email !== accountEmail(scenario)) throw new Error("Registry identity mismatch");
  return record;
}

async function main(): Promise<void> {
  const [command="list",name,...flags]=process.argv.slice(2);
  if(command === "list") {console.log(JSON.stringify(ACCOUNT_SCENARIOS,null,2));return;}
  if(command === "verify-email") {
    if(name || flags.length) throw new Error("verify-email takes no arguments");
    for(const script of ["scripts/test-email-lifecycle.sh","scripts/test-email-system-http.sh"]) {
      const result=spawnSync("bash",[script],{cwd:repo,stdio:"inherit",env:{...process.env}});
      if(result.status !== 0) throw new Error(`Email verification failed: ${script}`);
    }
    return;
  }
  if(!["prepare","status","release"].includes(command) || flags.some(flag=>flag !== "--apply")) throw new Error("Use list | prepare <scenario> [--apply] | status <scenario> | release <scenario> --apply | verify-email");
  const scenario=scenarioName(name);
  const apply=flags.includes("--apply");
  if(command !== "status" && !apply) {
    console.log(JSON.stringify({mode:"preview",action:command,scenario,email:accountEmail(scenario),preset:ACCOUNT_SCENARIOS[scenario],environment:"local Docker Supabase only",provider:"no RevenueCat/store changes",next:`yarn qa:accounts ${command} ${scenario} --apply`},null,2));return;
  }
  mkdirSync(root,{recursive:true,mode:0o700});chmodSync(root,0o700);
  const path=resolve(root,`${scenario}.json`), lock=resolve(root,`${scenario}.lock`);
  let handle: number;
  try {handle=openSync(lock,"wx",0o600);}
  catch {throw new Error("Another QA command is using this account; do not reset it concurrently");}
  try {
    let record=readRecord(path,scenario);
    if(command === "release") {
      if(!record) throw new Error("Account has not been prepared");
      assertLease(record.lease,owner,Date.now());
      delete record.lease;save(path,record);console.log("Released the local QA account lease");return;
    }
    const stack=localStack();
    let user=await registeredUser(stack.admin,scenario);
    if(command === "status") {
      if(!user) {console.log(JSON.stringify({scenario,status:"not_prepared"}));return;}
      const userId=z.uuid().parse(user.id);
      console.log(sql(`SELECT jsonb_build_object('user_id',p.id,'email',p.email,'is_mock',p.is_mock,'email_enabled',p.notif_email_enabled,'sessions',(SELECT count(*) FROM sessions WHERE user_id=p.id AND status='completed' AND deleted_at IS NULL),'access',e.product_id,'is_pro',e.is_pro,'is_trialing',e.is_trialing,'evidence',e.rc_raw->>'evidence') FROM profiles p LEFT JOIN user_entitlements e ON e.user_id=p.id WHERE p.id='${userId}';`));return;
    }
    assertLease(record?.lease,owner,Date.now());
    if(user && record && user.id !== record.user_id) throw new Error("Auth identity changed; refusing to reuse this registry");
    if(!user && record) throw new Error("Registered Auth identity is missing; inspect before recreating");
    const password=record?.password ?? randomBytes(24).toString("base64url");
    if(!user) {
      const result=await stack.admin.auth.admin.createUser({email:accountEmail(scenario),password,email_confirm:true,app_metadata:{qa_registry:QA_REGISTRY,qa_scenario:scenario}});
      if(result.error || !result.data.user) throw new Error("Could not create the local QA login");
      user=result.data.user;
    } else if(!record) {
      const result=await stack.admin.auth.admin.updateUserById(user.id,{password});
      if(result.error) throw new Error("Could not recover the owned QA login");
    }
    assertOwnedAccount(user,scenario);
    record={registry:QA_REGISTRY,scenario,user_id:user.id,email:accountEmail(scenario),password,lease:{owner,expires_at:new Date(Date.now()+2*3600_000).toISOString()}};
    save(path,record);
    const {data:beaches,error}=await stack.admin.from("beaches").select("id").limit(1);
    if(error || !beaches?.length) throw new Error("Local reference beaches are required");
    sql(resetAccountSql(scenario,user.id,z.uuid().parse(beaches[0].id)));
    const login=createClient(stack.url,stack.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:session,error:authError}=await login.auth.signInWithPassword({email:record.email,password});
    if(authError || session.user?.id !== user.id) throw new Error("Fixture reset, but real password login verification failed");
    const {data:sessions,error:sessionError}=await login.from("sessions").select("id").eq("user_id",user.id).eq("status","completed").is("deleted_at",null);
    if(sessionError || sessions?.length !== ACCOUNT_SCENARIOS[scenario].sessions) throw new Error("Authenticated session-count verification failed");
    const {data:access,error:accessError}=await stack.admin.from("user_entitlements").select("expires_at").eq("user_id",user.id).single();
    if(accessError) throw new Error("Cannot verify the local access fixture");
    const nativeState=({trial:"trialing",paid:"pro",gift:"gift",expired:"lapsed"} as Record<string,string>)[ACCOUNT_SCENARIOS[scenario].access] ?? "free";
    const envPath=resolve(root,`${scenario}.env`);
    const env={EXPO_PUBLIC_DEV_ENTITLEMENT:nativeState,EXPO_PUBLIC_DEV_ENTITLEMENT_EXPIRES_AT:access.expires_at ?? "",MAESTRO_TEST_EMAIL:record.email,MAESTRO_TEST_PASSWORD:password,NEXT_PUBLIC_SITE_URL:"http://127.0.0.1:3000",EXPO_PUBLIC_API_BASE_URL:"http://127.0.0.1:3000",SUPABASE_SERVICE_ROLE_KEY:stack.serviceKey,EXPO_PUBLIC_REVENUECAT_IOS_KEY:"",EXPO_PUBLIC_REVENUECAT_ANDROID_KEY:"",EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN:"",EXPO_PUBLIC_SENTRY_DSN:"",NEXT_PUBLIC_POSTHOG_KEY:"",NEXT_PUBLIC_SENTRY_DSN:"",REVENUECAT_SECRET_API_KEY:"",REVENUECAT_V2_SECRET_API_KEY:"",RESEND_API_KEY:"",EARN_PRO_ENABLED:"false",EMAIL_REPLY_INGESTION_VERIFIED:"false",ALERTS_DELIVERY_ENABLED:"false",TEST_USER_EMAIL:record.email,TEST_USER_PASSWORD:password,NEXT_PUBLIC_SUPABASE_URL:stack.url,NEXT_PUBLIC_SUPABASE_ANON_KEY:stack.anonKey,EXPO_PUBLIC_SUPABASE_URL:stack.url,EXPO_PUBLIC_SUPABASE_ANON_KEY:stack.anonKey,EMAIL_LIFECYCLE_ENABLED:"false",PRO_OFFERS_ENABLED:"false",EMAIL_GMAIL_REPLY_SYNC_ENABLED:"false"};
    const envTemp=`${envPath}.${process.pid}.tmp`;
    writeFileSync(envTemp,Object.entries(env).map(([key,value])=>`${key}=${value}`).join("\n")+"\n",{mode:0o600,flag:"wx"});
    renameSync(envTemp,envPath);chmodSync(envPath,0o600);
    console.log(JSON.stringify({status:"ready",scenario,email:record.email,user_id:user.id,completed_sessions:sessions.length,login_verified:true,entitlement_evidence:"simulated_local_only",credentials:envPath,lease_until:record.lease?.expires_at,mail_inbox:"http://127.0.0.1:54324",note:"Use a local web/native build. This does not reset store history or grant production Pro."},null,2));
  } finally {closeSync(handle);unlinkSync(lock);}
}
main().catch(error=>{console.error(error instanceof Error ? error.message : "QA account operation failed");process.exitCode=1;});
