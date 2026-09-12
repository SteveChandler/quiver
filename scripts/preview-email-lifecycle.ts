import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderLifecycleEmail, LIFECYCLE_CONTENT_HASH } from "../lib/mailer/lifecycle-email";
import { lifecycleJobSchema, type LifecycleDecision } from "../lib/email/lifecycle";

async function main(): Promise<void> {
  const output = resolve(process.argv[2] ?? "docs/implementation/email-lifecycle-previews");
  await mkdir(output, { recursive: true });
  const links: string[] = [];
  for (const variant of [...lifecycleJobSchema.options, "offer_ready_three"] as const) {
    const job = variant === "offer_ready_three" ? "offer_ready" : variant;
    const d: LifecycleDecision = { user_id: "11111111-1111-4111-8111-111111111111", campaign_id: "startup-lifecycle-v1", job, status: "due", reason: "synthetic_preview",
      source: { email: "surfer@example.com", name: "Surfer", home_beach_id: null, offer_id: "33333333-3333-4333-8333-333333333333", offer_months: variant === "offer_ready_three" ? 3 : 1, sessions: job === "offer_ready" ? 5 : job === "progress" ? 2 : 0, last_completion: null, trial_end: "2026-10-01T00:00:00Z" } };
    const email = await renderLifecycleEmail(d, "22222222-2222-4222-8222-222222222222", "https://www.quiversurf.app", "founder@example.com", "https://www.quiversurf.app/api/email/lifecycle/unsubscribe?preview=1");
    await writeFile(resolve(output, `${variant}.html`), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${email.subject}</title></head><body style="margin:0">${email.html}</body></html>`);
    await writeFile(resolve(output, `${variant}.txt`), email.text);
    links.push(`<li><a href="${variant}.html">${variant}</a></li>`);
  }
  await writeFile(resolve(output, "index.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Synthetic lifecycle previews</title><h1>Local previews — no emails sent</h1><ul>${links.join("")}</ul></html>`);
  await writeFile(resolve(output, "manifest.json"), JSON.stringify({ campaign: "startup-lifecycle-v1", version: 1, content_hash: LIFECYCLE_CONTENT_HASH, synthetic: true, provider_called: false }, null, 2));
  console.log(`Rendered ${links.length} synthetic templates at ${output}`);
}
main().catch(() => { console.error("Preview failed"); process.exitCode = 1; });
