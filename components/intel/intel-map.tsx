"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import { debounce } from "@/lib/utils/debounce";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { IntelPostModal } from "./intel-post-modal";
import { INTEL_MAP_CONFIG, getIntelTagConfig } from "@/lib/constants/intel";
import type { IntelPostWithUser, IntelPostTag } from "@/types/database";
import {
  confirmIntelPost,
  removeIntelPostConfirmation,
} from "@/actions/intel-actions";
import { toast } from "sonner";

interface IntelMapProps {
  initialCenter?: [number, number]; // [lat, lng]
  initialZoom?: number;
  posts: IntelPostWithUser[];
  onPostClick?: (post: IntelPostWithUser) => void;
  onMapClick?: (latlng: mapboxgl.LngLat) => void;
  onMapMove?: (center: mapboxgl.LngLat, zoom: number) => void;
  selectedTag?: IntelPostTag | "all";
  className?: string;
}

const SAN_DIEGO: [number, number] = [32.7157, -117.1611];

export function IntelMap({
  initialCenter = SAN_DIEGO,
  initialZoom = INTEL_MAP_CONFIG.DEFAULT_ZOOM,
  posts,
  onPostClick,
  onMapClick,
  onMapMove,
  selectedTag = "all",
  className = "h-full w-full",
}: IntelMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [selectedPost, setSelectedPost] = useState<IntelPostWithUser | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);

  const { user } = useAuth();
  const router = useRouter();

  // Ensure access token
  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  }, []);

  // Helper: remove all markers
  const cleanupMarkers = useCallback(() => {
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};
  }, []);

  // Helper: full cleanup
  const cleanupMap = useCallback(() => {
    console.log("[IntelMap] Cleaning up map");
    cleanupMarkers();
    if (popupRef.current) popupRef.current.remove();
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    setIsMapReady(false);
  }, [cleanupMarkers]);

  // Create intel post pin element
  const createIntelPin = useCallback(
    (post: IntelPostWithUser): HTMLElement => {
      const tagConfig = getIntelTagConfig(post.tag);
      const isSelected = selectedPost?.id === post.id;
      const pinSize = isSelected
        ? INTEL_MAP_CONFIG.PIN_SIZE.SELECTED
        : INTEL_MAP_CONFIG.PIN_SIZE.DEFAULT;

      // Create wrapper element
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

      // Create the pin element
      const pin = document.createElement("div");
      pin.style.cssText = `
      width: ${pinSize}px;
      height: ${pinSize}px;
      background: ${INTEL_MAP_CONFIG.PIN_COLORS[post.tag]};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${pinSize * 0.5}px;
      color: white;
      font-weight: bold;
      user-select: none;
      transform-origin: center;
      transition: all 0.2s ease;
      position: relative;
    `;

      // Add emoji icon
      pin.innerHTML = tagConfig.emoji;

      // Add confirmation count badge if > 0
      if (post.confirmations_count > 0) {
        const badge = document.createElement("div");
        badge.style.cssText = `
        position: absolute;
        top: -8px;
        right: -8px;
        background: #10b981;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        border: 2px solid white;
      `;
        badge.textContent = post.confirmations_count.toString();
        pin.appendChild(badge);
      }

      // Add hover effects
      pin.addEventListener("mouseenter", () => {
        pin.style.transform = "scale(1.1)";
        pin.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.4)";
      });

      pin.addEventListener("mouseleave", () => {
        pin.style.transform = "scale(1)";
        pin.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
      });

      // Click handler
      pin.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        setSelectedPost(post);
        setModalOpen(true);
        onPostClick?.(post);
      });

      wrapper.appendChild(pin);
      return wrapper;
    },
    [selectedPost, onPostClick]
  );

  // Update markers when posts change
  const updateMarkers = useCallback(() => {
    if (!mapRef.current || !isMapReady) {
      console.log("[IntelMap] Skipping marker update:", {
        hasMap: !!mapRef.current,
        isMapReady,
      });
      return;
    }

    // Remove existing markers
    cleanupMarkers();

    // Filter posts by selected tag
    const filteredPosts =
      selectedTag === "all"
        ? posts
        : posts.filter((post) => post.tag === selectedTag);

    console.log("[IntelMap] Updating markers:", {
      totalPosts: posts.length,
      filteredPosts: filteredPosts.length,
      selectedTag,
    });

    // Create markers for each post
    filteredPosts.forEach((post) => {
      const markerId = `intel-${post.id}`;

      // Create custom pin element
      const pinElement = createIntelPin(post);

      // Create marker
      const marker = new mapboxgl.Marker({
        element: pinElement,
        draggable: false,
      })
        .setLngLat([post.longitude, post.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div class="p-2">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">${
                  getIntelTagConfig(post.tag).emoji
                }</span>
                <span class="font-medium">${post.title}</span>
              </div>
              <p class="text-sm text-gray-600 mb-2">${post.description}</p>
              <div class="text-xs text-gray-500">
                by ${post.user?.full_name || "Anonymous"} • ${
            post.confirmations_count
          } confirmations
              </div>
            </div>
          `)
        )
        .addTo(mapRef.current!);

      markersRef.current[markerId] = marker;
    });
  }, [isMapReady, posts, selectedTag, createIntelPin, cleanupMarkers]);

  // Handle map move events (debounced)
  const handleMoveEnd = useMemo(
    () =>
      debounce(() => {
        if (!mapRef.current) return;
        const center = mapRef.current.getCenter();
        const zoom = mapRef.current.getZoom();
        onMapMove?.(center, zoom);
      }, 1000),
    [onMapMove]
  );

  // Handle intel post confirmation
  const handleConfirmPost = useCallback(
    async (postId: string, confirmed: boolean) => {
      if (!user) {
        toast.error("Please sign in to confirm intel posts");
        return;
      }

      try {
        const result = confirmed
          ? await removeIntelPostConfirmation(postId)
          : await confirmIntelPost(postId);

        if (result.success) {
          toast.success(
            result.data?.confirmed ? "Intel confirmed!" : "Confirmation removed"
          );
          // The posts will be updated by the parent component's refetch
        } else {
          toast.error(result.error || "Failed to update confirmation");
        }
      } catch (error) {
        console.error("Error updating confirmation:", error);
        toast.error("Failed to update confirmation");
      }
    },
    [user]
  );

  // Handle log session navigation
  const handleLogSession = useCallback(
    (post: IntelPostWithUser) => {
      const searchParams = new URLSearchParams({
        lat: post.latitude.toString(),
        lng: post.longitude.toString(),
        location: `${post.title} (Intel)`,
      });
      router.push(`/sessions/new?${searchParams.toString()}`);
    },
    [router]
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    console.log("[IntelMap] Initializing map with config:", {
      hasContainer: !!mapContainerRef.current,
      hasAccessToken: !!mapboxgl.accessToken,
      initialCenter,
      initialZoom,
    });

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [initialCenter[1], initialCenter[0]], // lng, lat
      zoom: initialZoom,
    });

    mapRef.current = map;

    map.on("load", () => {
      console.log("[IntelMap] Map loaded successfully");
      setIsMapReady(true);
    });

    map.on("error", (e) => {
      console.error("[IntelMap] Map error:", e);
    });

    map.on("moveend", handleMoveEnd);

    // Map click handler
    map.on("click", (e) => {
      onMapClick?.(e.lngLat);
    });

    return () => {
      map.off("moveend", handleMoveEnd);
      (handleMoveEnd as any)?.cancel?.();
      cleanupMap();
    };
  }, [initialCenter, initialZoom, handleMoveEnd, onMapClick, cleanupMap]);

  // Update markers when posts or selected tag changes
  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  // Update map center when initialCenter changes
  useEffect(() => {
    if (isMapReady && mapRef.current && initialCenter) {
      const currentCenter = mapRef.current.getCenter();
      const [newLat, newLng] = initialCenter;

      // Only update if the center has changed significantly
      const threshold = 0.001; // ~100 meters
      const latDiff = Math.abs(currentCenter.lat - newLat);
      const lngDiff = Math.abs(currentCenter.lng - newLng);

      if (latDiff > threshold || lngDiff > threshold) {
        mapRef.current.setCenter([newLng, newLat]);
      }
    }
  }, [isMapReady, initialCenter]);

  return (
    <>
      <div
        ref={mapContainerRef}
        className={className}
        style={{ width: "100%", height: "100%", minHeight: "400px" }}
      />

      {/* Intel Post Modal */}
      {selectedPost && (
        <IntelPostModal
          post={selectedPost}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedPost(null);
          }}
          onConfirm={handleConfirmPost}
          onLogSession={handleLogSession}
          canConfirm={!!user && user.id !== selectedPost.user_id}
        />
      )}
    </>
  );
}
