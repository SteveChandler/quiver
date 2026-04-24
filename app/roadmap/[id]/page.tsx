import { redirect } from "next/navigation";

export default async function RoadmapItemRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/roadmap#item-${id}`);
}
