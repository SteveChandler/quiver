import { redirect } from "next/navigation";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<never> {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      query.append(key, item);
    }
  }

  redirect(query.size ? `/auth/sign-in?${query.toString()}` : "/auth/sign-in");
}
