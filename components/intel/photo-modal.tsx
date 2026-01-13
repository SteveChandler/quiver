"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import Image from "next/image";

interface PhotoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string;
  caption?: string;
  authorName?: string;
}

/**
 * PhotoModal - Full-screen photo viewer with swipe-to-dismiss
 */
export function PhotoModal({
  open,
  onOpenChange,
  photoUrl,
  caption,
  authorName,
}: PhotoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-black/95 border-none">
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Image */}
        <div className="relative w-full h-full flex items-center justify-center">
          <Image
            src={photoUrl}
            alt={caption || "Intel photo"}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 80vw"
          />
        </div>

        {/* Caption & Author */}
        {(caption || authorName) && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            {authorName && (
              <p className="text-sm text-gray-300 mb-1">@{authorName}</p>
            )}
            {caption && (
              <p className="text-white">{caption}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PhotoModal;
