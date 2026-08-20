"use client"

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { hasUTMParams, getAttributionForAnalytics } from '@/lib/attribution'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

/**
 * Analytics Loader Component
 * 
 * Loads GA4 analytics on all pages, including the landing page.
 * 
 * IMPORTANT: Analytics MUST load on landing page to capture UTM attribution.
 * Without this, first-touch attribution will show as "(not set)" in GA4.
 * 
 * Features:
 * - Loads GA4 with attribution data from URL and cookies
 * - Sends page_view with UTM parameters for proper attribution
 * - Includes referrer tracking for organic traffic
 * - Ahrefs analytics on non-landing pages only (SEO tool, not needed on landing)
 * 
 * Performance Note:
 * While loading GA4 on landing adds ~50KB, the attribution data is critical
 * for understanding user acquisition and campaign effectiveness.
 */
export function AnalyticsLoader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [gaLoaded, setGaLoaded] = useState(false)
  
  // Check if current URL has UTM params (force immediate load)
  const urlHasUtm = searchParams ? hasUTMParams(searchParams) : false
  
  // Determine if we should load Ahrefs (not needed on landing page)
  const shouldLoadAhrefs = pathname !== '/'
  
  // Send page view with attribution data after GA loads
  const sendPageViewWithAttribution = useCallback(() => {
    if (typeof window === 'undefined' || !window.gtag) return
    
    try {
      // Get attribution data from cookies
      const attribution = getAttributionForAnalytics({ includeTimestamp: false })
      
      // Build page view parameters
      const pageViewParams: Record<string, string> = {
        page_path: pathname + (searchParams?.toString() ? `?${searchParams}` : ''),
        page_title: document.title,
        ...attribution,
      }
      
      // Also include UTM from URL directly (in case cookies haven't been set yet)
      if (searchParams) {
        const utmSource = searchParams.get('utm_source')
        const utmMedium = searchParams.get('utm_medium')
        const utmCampaign = searchParams.get('utm_campaign')
        const utmContent = searchParams.get('utm_content')
        const utmTerm = searchParams.get('utm_term')
        
        if (utmSource) pageViewParams.utm_source = utmSource
        if (utmMedium) pageViewParams.utm_medium = utmMedium
        if (utmCampaign) pageViewParams.utm_campaign = utmCampaign
        if (utmContent) pageViewParams.utm_content = utmContent
        if (utmTerm) pageViewParams.utm_term = utmTerm
      }
      
      // Send the page view
      window.gtag('event', 'page_view', pageViewParams)
    } catch (e) {
      // Swallow errors to not break UX
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Analytics] Failed to send page view with attribution:', e)
      }
    }
  }, [pathname, searchParams])
  
  // Send page view when GA loads or route changes
  useEffect(() => {
    if (gaLoaded) {
      sendPageViewWithAttribution()
    }
  }, [gaLoaded, pathname, searchParams, sendPageViewWithAttribution])
  
  return (
    <>
      {/* Vercel Web Analytics (page views + basic metrics) */}
      <Analytics />

      {/* Vercel Speed Insights (Core Web Vitals monitoring) */}
      <SpeedInsights sampleRate={0.1} />

      {/* Google Analytics (GA4) - Load on ALL pages for attribution */}
      {GA_ID && (
        <>
          <Script
            id="ga-script"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy={urlHasUtm ? "afterInteractive" : "lazyOnload"}
            onLoad={() => setGaLoaded(true)}
          />
          <Script
            id="ga-init"
            strategy={urlHasUtm ? "afterInteractive" : "lazyOnload"}
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  anonymize_ip: true,
                  send_page_view: false,
                  // Allow manual page view with attribution
                  page_path: window.location.pathname + window.location.search
                });
                ${
                  process.env.NODE_ENV !== "production"
                    ? "try{gtag('set','debug_mode',true);}catch(e){console.warn('GA debug mode error:',e);}"
                    : ""
                }
              `,
            }}
          />
        </>
      )}
      {/* Ahrefs Analytics - Only on non-landing pages (SEO tool) */}
      {shouldLoadAhrefs && (
        <Script
          id="ahrefs-analytics"
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="+c2QcnYiWgfdkO0bAlkv1A"
          strategy="afterInteractive"
        />
      )}
    </>
  )
}
