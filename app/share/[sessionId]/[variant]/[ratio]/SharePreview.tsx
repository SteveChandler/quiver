/**
 * SharePreview Client Component
 * Displays session card preview with download button
 */

"use client";

import { useState } from "react";
import type { SessionWithDetails } from "@/types/database";
import type { ShareVariant, AspectRatio } from "@/types/session-share";
import { VARIANT_NAMES, ASPECT_RATIO_DIMENSIONS } from "@/types/session-share";
import SurfSessionCard from "@/components/session/SurfSessionCard";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ArrowLeft } from "lucide-react";
import { buildImageFilename, downloadImage } from "@/lib/share/share-url-builder";
import { toast } from "@/components/ui/use-toast";
import Link from "next/link";

interface SharePreviewProps {
  session: SessionWithDetails;
  sessionId: string;
  variant: ShareVariant;
  aspectRatio: AspectRatio;
}

export default function SharePreview({
  session,
  sessionId,
  variant,
  aspectRatio,
}: SharePreviewProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];
  const variantName = VARIANT_NAMES[variant];

  /**
   * Handle download
   */
  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      const imageUrl = `/api/sessions/${sessionId}/share-image?variant=${variant}&ratio=${encodeURIComponent(aspectRatio)}`;
      const filename = buildImageFilename(session, variant, aspectRatio);

      const success = await downloadImage(imageUrl, filename);

      if (success) {
        toast({
          title: "Image downloaded!",
          description: `Saved as ${filename}`,
        });
      } else {
        throw new Error("Download failed");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/s/${sessionId}`}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to session
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Card Preview - {variantName}
          </h1>
          <p className="text-gray-600">
            Aspect Ratio: {aspectRatio} ({dimensions.width}×{dimensions.height}px)
          </p>
        </div>

        {/* Preview Card */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Card Display */}
          <div className="flex-1 flex justify-center">
            <div
              className="shadow-2xl rounded-lg overflow-hidden"
              style={{
                maxWidth: "100%",
                width: "auto",
              }}
            >
              <div
                style={{
                  transform: "scale(0.5)",
                  transformOrigin: "top left",
                  width: dimensions.width,
                  height: dimensions.height,
                }}
              >
                <SurfSessionCard
                  session={session}
                  variant={variant}
                  aspectRatio={aspectRatio}
                />
              </div>
            </div>
          </div>

          {/* Info & Actions */}
          <div className="w-full lg:w-80 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Download Options</h2>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Variant</p>
                <p className="text-lg">{variantName}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Size</p>
                <p className="text-lg">
                  {dimensions.width} × {dimensions.height}px
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Format</p>
                <p className="text-lg">PNG</p>
              </div>
            </div>

            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full"
              size="lg"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Download Image
                </>
              )}
            </Button>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Sharing Tips
              </h3>
              <ul className="text-sm text-gray-600 space-y-2">
                {aspectRatio === "9:16" && (
                  <li>• Perfect for Instagram and Facebook Stories</li>
                )}
                {aspectRatio === "1:1" && (
                  <li>• Ideal for Instagram feed and Twitter posts</li>
                )}
                {aspectRatio === "4:5" && (
                  <li>• Optimized for Instagram feed posts</li>
                )}
                <li>• Add a link sticker to drive traffic back to QuiverSurf</li>
                <li>• Tag @quiversurf for a chance to be featured</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Additional Variants */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Try Other Variants
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {([1, 2, 3, 4, 5, 6] as ShareVariant[]).map((v) => (
              <Link
                key={v}
                href={`/share/${sessionId}/${v}/${encodeURIComponent(aspectRatio)}`}
                className={`p-4 rounded-lg border-2 transition-all ${
                  v === variant
                    ? "border-cyan-500 bg-cyan-50"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <p className="font-semibold text-center">Variant {v}</p>
                <p className="text-xs text-gray-500 text-center mt-1">
                  {VARIANT_NAMES[v]}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
