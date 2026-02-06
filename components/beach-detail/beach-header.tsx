import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface BeachHeaderProps {
  beachName: string;
}

export function BeachHeader({ beachName }: BeachHeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-background border-b">
      <div className="container flex items-center h-16 px-4">
        <Link href="/map" className="mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">{beachName} Surf Report</h1>
      </div>
    </header>
  );
}
