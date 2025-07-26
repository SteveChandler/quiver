import { BeachDetail } from "@/components/beach-detail";
import { BottomNavigation } from "@/components/bottom-navigation";

export default function BeachDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <>
      <BeachDetail id={params.id} />
      <BottomNavigation />
    </>
  );
}
