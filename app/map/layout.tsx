import type { ReactNode } from 'react'
import { MapResourceHints } from '@/components/resource-hints/map-hints'

/**
 * Map Route Layout
 * 
 * Adds map-specific resource hints for the interactive map page.
 * These hints are NOT loaded on the landing page to improve performance.
 */
export default function MapLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MapResourceHints />
      {children}
    </>
  )
}
