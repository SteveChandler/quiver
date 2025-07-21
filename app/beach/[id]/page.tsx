import { BeachDetail } from "@/components/beach-detail";
import { BottomNavigation } from "@/components/bottom-navigation";

export default function BeachDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <BeachDetail id={params.id} />
      <BottomNavigation />
    </div>
  );
}
