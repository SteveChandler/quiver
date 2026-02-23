"use client";

import { useRef, useCallback, useEffect, useState, type RefObject } from "react";

export interface UseBottomSheetGestureOptions {
  snapPoints: number[];
  activeSnapIndex: number;
  onSnapChange: (index: number) => void;
  handleRef: RefObject<HTMLDivElement | null>;
}

export interface UseBottomSheetGestureReturn {
  sheetRef: RefObject<HTMLDivElement | null>;
  isDragging: boolean;
}

const FLICK_VELOCITY_THRESHOLD = 0.5; // px/ms
const SNAP_TRANSITION = "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)";

export function getSnapTranslateY(snapFraction: number): number {
  return (1 - snapFraction) * window.innerHeight;
}

export function findNearestSnapIndex(
  currentY: number,
  snapPoints: number[]
): number {
  let nearest = 0;
  let minDist = Infinity;
  for (let i = 0; i < snapPoints.length; i++) {
    const snapY = getSnapTranslateY(snapPoints[i]);
    const dist = Math.abs(currentY - snapY);
    if (dist < minDist) {
      minDist = dist;
      nearest = i;
    }
  }
  return nearest;
}

/**
 * Custom touch/mouse drag + snap-point gesture hook for bottom sheets.
 *
 * Uses raw touch events (not pointer events) for Android WebView compatibility.
 * Also supports mouse events for desktop browsers and Playwright E2E tests.
 * Updates transform via direct DOM manipulation during drag for 60fps performance.
 * On release, velocity-based snapping picks direction; otherwise snaps to nearest point.
 * Uses window.innerHeight instead of dvh units for cross-platform support.
 */
export function useBottomSheetGesture({
  snapPoints,
  activeSnapIndex,
  onSnapChange,
  handleRef,
}: UseBottomSheetGestureOptions): UseBottomSheetGestureReturn {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Ref to avoid re-attaching event listeners on every snap change
  const activeSnapIndexRef = useRef(activeSnapIndex);
  activeSnapIndexRef.current = activeSnapIndex;

  // Mutable refs for drag state (avoids re-renders during gesture)
  const dragState = useRef({
    startY: 0,
    startTranslateY: 0,
    currentTranslateY: 0,
    lastMoveY: 0,
    lastMoveTime: 0,
    velocity: 0,
    active: false,
  });

  // Animate to a snap point with CSS transition
  const animateToSnap = useCallback(
    (index: number) => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const targetY = getSnapTranslateY(snapPoints[index]);
      sheet.style.transition = SNAP_TRANSITION;
      sheet.style.transform = `translateY(${targetY}px)`;
      setIsDragging(false);
      onSnapChange(index);
    },
    [snapPoints, onSnapChange]
  );

  // Animate to snap position for programmatic changes (beach select/deselect, resize)
  const animateToSnapPosition = useCallback(
    (index: number) => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const targetY = getSnapTranslateY(snapPoints[index]);
      sheet.style.transition = SNAP_TRANSITION;
      sheet.style.transform = `translateY(${targetY}px)`;
    },
    [snapPoints]
  );

  // Sync when activeSnapIndex changes externally (beach select/deselect)
  useEffect(() => {
    if (!dragState.current.active) {
      animateToSnapPosition(activeSnapIndex);
    }
  }, [activeSnapIndex, animateToSnapPosition]);

  // Recalculate snap position on resize (keyboard, orientation)
  useEffect(() => {
    const handleResize = () => {
      if (!dragState.current.active) {
        animateToSnapPosition(activeSnapIndexRef.current);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [animateToSnapPosition]);

  // Touch and mouse event handlers
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    // Parse current translateY from DOM (source of truth during transitions)
    const getCurrentTranslateY = (): number => {
      const sheet = sheetRef.current;
      if (!sheet) return getSnapTranslateY(snapPoints[activeSnapIndexRef.current]);
      const match = sheet.style.transform.match(/translateY\(([^)]+)px\)/);
      return match ? parseFloat(match[1]) : getSnapTranslateY(snapPoints[activeSnapIndexRef.current]);
    };

    const startDrag = (clientY: number) => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      // Remove transition for direct manipulation
      sheet.style.transition = "none";
      const currentY = getCurrentTranslateY();
      dragState.current = {
        startY: clientY,
        startTranslateY: currentY,
        currentTranslateY: currentY,
        lastMoveY: clientY,
        lastMoveTime: Date.now(),
        velocity: 0,
        active: true,
      };
      setIsDragging(true);
    };

    const moveDrag = (clientY: number, e?: Event) => {
      if (!dragState.current.active) return;
      const sheet = sheetRef.current;
      if (!sheet) return;

      const deltaY = clientY - dragState.current.startY;
      const now = Date.now();
      const dt = now - dragState.current.lastMoveTime;

      // Calculate velocity (px/ms)
      if (dt > 0) {
        dragState.current.velocity =
          (clientY - dragState.current.lastMoveY) / dt;
      }
      dragState.current.lastMoveY = clientY;
      dragState.current.lastMoveTime = now;

      // Clamp: don't allow dragging above the top snap or below screen bottom
      const topBound = getSnapTranslateY(snapPoints[snapPoints.length - 1]);
      const bottomBound = window.innerHeight;
      let newY = dragState.current.startTranslateY + deltaY;
      // Rubber-band resistance when dragging beyond bounds
      if (newY < topBound) {
        const overscroll = topBound - newY;
        newY = topBound - overscroll * 0.2;
      } else if (newY > bottomBound) {
        const overscroll = newY - bottomBound;
        newY = bottomBound + overscroll * 0.2;
      }

      dragState.current.currentTranslateY = newY;
      // Direct DOM manipulation for 60fps
      sheet.style.transform = `translateY(${newY}px)`;

      e?.preventDefault();
    };

    const endDrag = () => {
      if (!dragState.current.active) return;
      dragState.current.active = false;

      const { currentTranslateY, velocity } = dragState.current;

      let targetIndex: number;

      if (Math.abs(velocity) > FLICK_VELOCITY_THRESHOLD) {
        // Flick: velocity > 0 means dragging down (smaller snap), < 0 means up (larger snap)
        const currentNearest = findNearestSnapIndex(
          currentTranslateY,
          snapPoints
        );
        if (velocity > 0) {
          // Dragging down -> go to lower snap point (lower index)
          targetIndex = Math.max(0, currentNearest - 1);
        } else {
          // Dragging up -> go to higher snap point (higher index)
          targetIndex = Math.min(snapPoints.length - 1, currentNearest + 1);
        }
      } else {
        // No flick: snap to nearest
        targetIndex = findNearestSnapIndex(currentTranslateY, snapPoints);
      }

      animateToSnap(targetIndex);
    };

    const cancelDrag = () => {
      if (!dragState.current.active) return;
      dragState.current.active = false;
      // Snap back to current active snap
      animateToSnap(activeSnapIndexRef.current);
    };

    // Touch events
    const onTouchStart = (e: TouchEvent) => startDrag(e.touches[0].clientY);
    const onTouchMove = (e: TouchEvent) => moveDrag(e.touches[0].clientY, e);
    const onTouchEnd = () => endDrag();
    const onTouchCancel = () => cancelDrag();

    // Mouse events (desktop browsers + Playwright E2E)
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault(); // Prevent text selection during drag
      startDrag(e.clientY);
    };
    const onMouseMove = (e: MouseEvent) => moveDrag(e.clientY, e);
    const onMouseUp = () => endDrag();

    handle.addEventListener("touchstart", onTouchStart, { passive: true });
    handle.addEventListener("touchmove", onTouchMove, { passive: false });
    handle.addEventListener("touchend", onTouchEnd, { passive: true });
    handle.addEventListener("touchcancel", onTouchCancel, { passive: true });
    handle.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      handle.removeEventListener("touchstart", onTouchStart);
      handle.removeEventListener("touchmove", onTouchMove);
      handle.removeEventListener("touchend", onTouchEnd);
      handle.removeEventListener("touchcancel", onTouchCancel);
      handle.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [handleRef, snapPoints, animateToSnap]);

  return { sheetRef, isDragging };
}
