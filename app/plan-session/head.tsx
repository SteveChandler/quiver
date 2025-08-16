import { buildPageMetadata } from "@/lib/seo/meta";

export default function Head() {
  const meta = buildPageMetadata({
    title: "Plan Your Surf Session | Quiver",
    description:
      "Plan the perfect surf session with forecast insights, gear picks, and group invites.",
    path: "/plan-session",
  });
  return (
    <>
      <title>{meta.title?.absolute || meta.title?.default || "Plan Your Surf Session | Quiver"}</title>
      {meta.description ? <meta name="description" content={meta.description} /> : null}
      {Array.isArray(meta.alternates?.canonical) ? null : meta.alternates?.canonical ? (
        <link rel="canonical" href={String(meta.alternates.canonical)} />
      ) : null}
    </>
  );
}


