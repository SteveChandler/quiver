import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import with SSR disabled to prevent hydration mismatches
const ClientOnlyApp = dynamic(() => import("./client-app"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-ocean-blue" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Quiver</h1>
        <p className="text-gray-600">Loading your surf community...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <ClientOnlyApp />;
}
