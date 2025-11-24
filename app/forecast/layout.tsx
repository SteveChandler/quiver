import type { ReactNode } from 'react'
import { MapResourceHints } from '@/components/resource-hints/map-hints'

/**
 * Forecast Route Layout
 * 
 * Adds map-specific resource hints for forecast pages.
 * Forecast pages may include maps showing wave conditions.
 */
export default function ForecastLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MapResourceHints />
      {children}
    </>
  )
}
