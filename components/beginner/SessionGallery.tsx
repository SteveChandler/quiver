import { Camera } from "lucide-react";

interface SessionGalleryProps {
  cityName: string;
}

export function SessionGallery({ cityName }: SessionGalleryProps) {
  return (
    <section data-testid="session-gallery">
      <h2 className="text-2xl font-semibold text-slate-900 mb-4">
        <Camera className="inline h-5 w-5 text-sky-600 mr-2" aria-hidden="true" />
        Recent Beginner Sessions
      </h2>
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-500">
          Be the first to share your beginner session in {cityName}! Log a
          session with a photo and it could be featured here.
        </p>
      </div>
    </section>
  );
}
