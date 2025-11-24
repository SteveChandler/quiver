import type { ReactNode } from 'react'
import { MapResourceHints } from '@/components/resource-hints/map-hints'

/**
 * Beaches Route Layout
 * 
 * Adds map-specific resource hints for beach detail pages.
 * Beach pages typically include an interactive map showing the beach location.
 */
export default function BeachesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MapResourceHints />
      {children}
    </>
  )
}
