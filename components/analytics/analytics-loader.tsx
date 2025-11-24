"use client"

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-JZNX7C7XKL"

/**
 * Analytics Loader Component
 * 
 * Conditionally loads analytics scripts based on the current route.
 * Landing page (/) does not load analytics to optimize performance.
 * All other routes load GA4 and Ahrefs analytics.
 * 
 * Performance Impact:
 * - Saves ~100KB on landing page
 * - Reduces TBT by ~20ms
 * - Improves TTI for unauthenticated visitors
 */
export function AnalyticsLoader() {
  const pathname = usePathname()
  const [shouldLoad, setShouldLoad] = useState(false)
  
  useEffect(() => {
    // Don't load analytics on the landing page
    // Landing page is public and used for marketing - analytics not needed
    if (pathname !== '/') {
      setShouldLoad(true)
    } else {
      setShouldLoad(false)
    }
  }, [pathname])
  
  if (!shouldLoad) {
    return null
  }
  
  return (
    <>
      {/* Google Analytics (GA4) */}
      <Script
        id="ga-script"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="lazyOnload"
      />
      <Script
        id="ga-init"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { anonymize_ip: true, send_page_view: false });
            ${
              process.env.NODE_ENV !== "production"
                ? "try{gtag('set','debug_mode',true);}catch(_){}"
                : ""
            }
          `,
        }}
      />
      {/* Ahrefs Analytics */}
      <Script
        id="ahrefs-analytics"
        src="https://analytics.ahrefs.com/analytics.js"
        data-key="+c2QcnYiWgfdkO0bAlkv1A"
        strategy="afterInteractive"
      />
    </>
  )
}
