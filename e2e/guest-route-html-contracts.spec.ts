/**
 * Route HTML Contract Tests
 *
 * Request-only coverage for route status, redirects, metadata, headings, and
 * structured data that does not require browser hydration.
 */

import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { buildBeachUrl } from '@/lib/utils/beach-url-utils';

const WAVE_HEIGHT_PATTERN = /\d+(\.\d+)?(-\d+(\.\d+)?)?\s*ft/i;

test.use({ storageState: { cookies: [], origins: [] } });

type MetaSelector = {
  name?: string;
  property?: string;
};

async function getResponse(
  request: APIRequestContext,
  path: string,
  options?: Parameters<APIRequestContext['get']>[1],
): Promise<APIResponse> {
  return request.get(path, options);
}

async function getHtml(
  request: APIRequestContext,
  path: string,
  expectedStatus = 200,
): Promise<string> {
  const response = await getResponse(request, path);

  expect(response.status()).toBe(expectedStatus);

  return response.text();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function getTagAttribute(tag: string, attribute: string): string | null {
  const match = tag.match(
    new RegExp(`${attribute}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );

  if (!match) return null;

  return decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '');
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function getTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  return match ? stripTags(match[1]) : null;
}

function getMetaContent(html: string, selector: MetaSelector): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const selectorAttribute = selector.property ? 'property' : 'name';
    const selectorValue = selector.property ?? selector.name;
    const actualSelectorValue = getTagAttribute(tag, selectorAttribute);

    if (actualSelectorValue !== selectorValue) continue;

    return getTagAttribute(tag, 'content');
  }

  return null;
}

function getCanonicalHref(html: string): string | null {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];

  for (const link of links) {
    if (getTagAttribute(link, 'rel') !== 'canonical') continue;
    return getTagAttribute(link, 'href');
  }

  return null;
}

function getAnchorHrefs(html: string): string[] {
  const anchors = html.match(/<a\b[^>]*>/gi) ?? [];

  return anchors.flatMap((anchor) => {
    const href = getTagAttribute(anchor, 'href');
    return href ? [href] : [];
  });
}

function getHeadingTexts(html: string, level: 1 | 2): string[] {
  const pattern = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi');

  return Array.from(html.matchAll(pattern), (match) => stripTags(match[1])).filter(Boolean);
}

function getJsonLdScripts(html: string): string[] {
  return Array.from(
    html.matchAll(
      /<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi,
    ),
    (match) => stripTags(match[1]),
  );
}

function expectBeachMetaDescription(
  description: string | null,
  beachName: string,
): void {
  const normalizedDescription = (description ?? '').replace(/&#x27;/g, "'");

  if (WAVE_HEIGHT_PATTERN.test(normalizedDescription)) {
    expect(normalizedDescription).toContain('Current');
    expect(normalizedDescription).toContain(`wave height at ${beachName}`);
    return;
  }

  expect(normalizedDescription).toContain(`Today's surf report & forecast for ${beachName}`);
  expect(normalizedDescription).toContain('wave height, wind, tide, crowd intel, and 7-day forecast');
}

test.describe('Route HTML Contracts', () => {
  test('/profile/[id] exposes concise current-brand social metadata to guests', async ({
    request,
  }) => {
    const html = await getHtml(
      request,
      '/profile/00000000-0000-4000-8000-000000000000',
    );

    expect(getMetaContent(html, { property: 'og:title' })).toBe(
      'Surfer profile on Quiver',
    );
    expect(getMetaContent(html, { property: 'og:description' })).toBe(
      "See this surfer's sessions and profile on Quiver.",
    );
    expect(getMetaContent(html, { property: 'og:image' })).toContain(
      '/quiver-app-icon.png',
    );
    expect(getMetaContent(html, { property: 'og:image:width' })).toBe('1024');
    expect(getMetaContent(html, { property: 'og:image:height' })).toBe('1024');
  });

  test.describe('Beach SEO metadata', () => {
    test('/app/spot ignores query-only forecast copy in social metadata', async ({
      request,
    }) => {
      const html = await getHtml(
        request,
        '/app/spot/204s?window=2026-06-04T22%3A30%3A00.000Z&label=3%3A30-6%3A00+PM&conditions=2-3+ft+%C2%B7+18s+SSW+%C2%B7+7+mph+SW+%C2%B7+3+ft%2C+rising',
      );
      const ogImage = getMetaContent(html, { property: 'og:image' });
      const ogTitle = getMetaContent(html, { property: 'og:title' });
      const ogDescription = getMetaContent(html, { property: 'og:description' });

      expect(ogTitle).toBe('Open Quiver Surf Window');
      expect(ogDescription).toBe('Open this surf window in Quiver.');
      expect(ogImage).toContain('/api/og/forecast-window');
      expect(ogImage).toContain('slug=204s');
      expect(ogImage).toContain('window=2026-06-04T22%3A30%3A00.000Z');
      expect(ogImage).not.toMatch(/label=|conditions=|utm_/);
    });

    test('/beach/[slug] exposes social metadata without browser hydration', async ({ request }) => {
      const beach = TEST_BEACHES.blacks;
      const html = await getHtml(request, `/beach/${beach.slug}`);
      const ogImage = getMetaContent(html, { property: 'og:image' });
      const ogTitle = getMetaContent(html, { property: 'og:title' });
      const ogDescription = getMetaContent(html, { property: 'og:description' });
      const twitterCard = getMetaContent(html, { name: 'twitter:card' });
      const twitterImage = getMetaContent(html, { name: 'twitter:image' });

      expect(getTitle(html)).toContain(beach.name);
      expect(getTitle(html)).toContain('Quiver');
      expect(getTitle(html)).toMatch(/surf report|forecast/i);

      expect(ogImage).toMatch(/^https?:\/\//);
      expect(ogImage).toContain('/api/og/beach');
      expect(ogImage).toContain(`slug=${beach.slug}`);

      expect(ogTitle).toContain(beach.name);

      expectBeachMetaDescription(ogDescription, beach.name);

      expect(getMetaContent(html, { property: 'og:image:width' })).toBe('1200');
      expect(getMetaContent(html, { property: 'og:image:height' })).toBe('630');
      expect(twitterCard).not.toBeNull();
      expect(twitterImage).toContain('/api/og/beach');
    });

    test('/[state]/[city]/[beachSlug] exposes social metadata without browser hydration', async ({
      request,
    }) => {
      const beach = TEST_BEACHES.blacks;
      const state = beach.state.toLowerCase();
      const city = beach.city.toLowerCase().replace(/\s+/g, '-');
      const html = await getHtml(request, `/${state}/${city}/${beach.slug}`);
      const ogImage = getMetaContent(html, { property: 'og:image' });
      const description = getMetaContent(html, { name: 'description' });

      expect(getTitle(html)).toContain(beach.name);
      expect(getTitle(html)).toContain('Quiver');
      expect(getTitle(html)).toMatch(/surf report|forecast/i);

      expect(ogImage).toMatch(/^https?:\/\//);
      expect(ogImage).toContain('/api/og/beach');
      expect(ogImage).toContain(`slug=${beach.slug}`);

      expectBeachMetaDescription(description, beach.name);
    });

    test('/[state]/[city]/[beachSlug] keeps one exact-query H1 in initial HTML', async ({
      request,
    }) => {
      const beach = TEST_BEACHES.blacks;
      const html = await getHtml(request, buildBeachUrl(beach));
      const h1Headings = getHeadingTexts(html, 1);

      expect(h1Headings).toHaveLength(1);
      expect(h1Headings[0]).toMatch(new RegExp(`^${beach.name} Surf Forecast(?: for .+)?$`));
      expect(getHeadingTexts(html, 2)).toContain(beach.name);
      expect(html).not.toContain('Loading beach details');
    });

    test('/[state]/[city]/[beachSlug] exposes hourly rows in initial HTML @requires-data', async ({
      request,
    }) => {
      const beach = TEST_BEACHES.blacks;
      const html = await getHtml(request, buildBeachUrl(beach));

      expect(getHeadingTexts(html, 2)).toContain(`${beach.name} Hourly Surf Forecast`);
      expect(html).toContain('data-testid="public-forecast-hourly"');
      expect((html.match(/data-testid="public-forecast-hour"/g) ?? []).length).toBeGreaterThan(1);
      expect(html).toMatch(/Surf height/);
      expect(html).toMatch(/Quiver recommendation/);
      expect(html).toMatch(/Confidence/);
    });
  });

  test.describe('SEO infrastructure', () => {
    test('nested static assets bypass international route validation', async ({ request }) => {
      const assets = [
        {
          path: '/images/landing/swell-view-preview-v2.png',
          contentType: 'image/png',
        },
        {
          path: '/images/quiver-stickers/orange-tape.png',
          contentType: 'image/png',
        },
        {
          path: '/fonts/SpaceGrotesk/SpaceGrotesk-Bold.ttf',
          contentType: 'font/ttf',
        },
      ];

      for (const asset of assets) {
        const response = await getResponse(request, asset.path);

        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain(asset.contentType);
        expect((await response.body()).length).toBeGreaterThan(1000);
      }
    });

    test('sitemap returns XML when available', async ({ request }) => {
      const response = await getResponse(request, '/sitemap.xml');
      const xml = await response.text();

      expect(response.status()).toBe(200);
      expect(xml).toMatch(/<urlset|<sitemapindex/);
      expect(xml).toContain('<url>');
      expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/download<\/loc>/);
      expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/android-beta<\/loc>/);
      expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/guides<\/loc>/);
      expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/support<\/loc>/);
      expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/data-deletion<\/loc>/);
      expect(xml).not.toMatch(/<loc>https?:\/\/[^<]+\/pbsc<\/loc>/);
    });

    test('robots.txt returns a readable response when configured', async ({ request }) => {
      const response = await getResponse(request, '/robots.txt');

      expect([200, 404]).toContain(response.status());
      expect((await response.text()).length).toBeGreaterThan(0);
    });

    test('thin-content intent routes expose noindex or valid content', async ({ request }) => {
      const html = await getHtml(request, '/longboard/san-diego');
      const robots = getMetaContent(html, { name: 'robots' });
      const hasNoindex = robots?.includes('noindex') ?? false;
      const hasH1 = getHeadingTexts(html, 1).length > 0;

      expect(hasNoindex || hasH1).toBe(true);
    });

    test('GSC-protected and gated routes expose opposite robots contracts', async ({
      request,
    }) => {
      const protectedHtml = await getHtml(
        request,
        '/ca/san-diego/blacks/water-temp',
      );
      const protectedRobots = getMetaContent(protectedHtml, {
        name: 'robots',
      });
      expect(protectedRobots ?? '').not.toContain('noindex');
      expect(getCanonicalHref(protectedHtml)).toContain(
        '/ca/san-diego/blacks/water-temp',
      );

      const gatedHtml = await getHtml(request, '/longboard/ca');
      expect(getMetaContent(gatedHtml, { name: 'robots' })).toContain(
        'noindex',
      );
    });
  });

  test.describe('Redirect and status contracts', () => {
    test('outreach embed aliases preserve query strings and reach live pages', async ({
      request,
    }) => {
      const cases = [
        {
          source: '/embed-for-surf-schools',
          sourceWithQuery: '/embed-for-surf-schools?source=school-outreach',
          malformedSource: '/embed-for-surf-schools&source=school-outreach',
          sourceWithTrailingSlash: '/embed-for-surf-schools/?source=school-outreach',
          destination: '/for-surf-schools',
          query: 'source=school-outreach',
        },
        {
          source: '/embed-for-businesses',
          sourceWithQuery: '/embed-for-businesses?source=business-outreach',
          malformedSource: '/embed-for-businesses&source=business-outreach',
          sourceWithTrailingSlash: '/embed-for-businesses/?source=business-outreach',
          destination: '/for-businesses',
          query: 'source=business-outreach',
        },
      ] as const;

      for (const redirect of cases) {
        const response = await getResponse(request, redirect.source, {
          maxRedirects: 0,
        });
        const queryResponse = await getResponse(request, redirect.sourceWithQuery, {
          maxRedirects: 0,
        });
        const malformedSourceResponse = await getResponse(
          request,
          redirect.malformedSource,
          { maxRedirects: 0 },
        );
        const trailingSlashResponse = await getResponse(
          request,
          redirect.sourceWithTrailingSlash,
        );

        expect(response.status()).toBe(308);
        expect(response.headers().location).toBe(redirect.destination);
        expect(queryResponse.status()).toBe(308);
        expect(queryResponse.headers().location).toBe(
          `${redirect.destination}?${redirect.query}`,
        );
        expect(malformedSourceResponse.status()).toBe(308);
        expect(malformedSourceResponse.headers().location).toBe(
          `${redirect.destination}?${redirect.query}`,
        );
        expect(trailingSlashResponse.status()).toBe(200);
        expect(trailingSlashResponse.url()).toContain(
          `${redirect.destination}?${redirect.query}`,
        );
      }
    });

    test('keyword alias redirects land on the canonical SEO pages', async ({
      request,
    }) => {
      const cases = [
        ['/surfline-alternative', '/vs/surfline'],
        ['/free-surfline-alternative', '/vs/surfline/free'],
        ['/seo-pages/vs-surfline-free', '/vs/surfline/free'],
        ['/magicseaweed-alternative', '/vs/surfline/free'],
        ['/free-surf-forecast', '/free-surf-reports'],
        ['/learn/ml-surf-forecast', '/learn/how-quiver-calibrates-your-beach'],
      ] as const;

      for (const [source, destination] of cases) {
        const response = await getResponse(request, source, { maxRedirects: 0 });

        expect([301, 308]).toContain(response.status());
        expect(response.headers().location).toBe(destination);
      }
    });

    test('supported state root renders surf-beach content', async ({ request }) => {
      const html = await getHtml(request, '/ca');

      expect(getHeadingTexts(html, 1).join(' ')).toMatch(/best surf beaches in ca/i);
    });

    test('uppercase state root canonicalizes to lowercase', async ({ request }) => {
      const response = await getResponse(request, '/CA', { maxRedirects: 0 });

      expect([301, 308]).toContain(response.status());
      expect(response.headers().location).toMatch(/\/ca$/);
    });

    test('unsupported state root returns 404', async ({ request }) => {
      const response = await getResponse(request, '/zz');

      expect(response.status()).toBe(404);
    });

    test('reserved one-segment routes are not treated as state roots', async ({ request }) => {
      const response = await getResponse(request, '/map', { maxRedirects: 0 });
      const html = await response.text();

      expect(response.status()).toBe(200);
      expect(response.headers().location).toBeUndefined();
      expect(html.length).toBeGreaterThan(0);
    });

    test('legacy beach-compatible route loads without browser navigation', async ({ request }) => {
      const beach = TEST_BEACHES.blacks;
      const state = beach.state.toLowerCase();
      const city = beach.city.toLowerCase().replace(/\s+/g, '-');
      const html = await getHtml(request, `/${state}/${city}/${beach.slug}`);

      expect(html.toLowerCase()).toContain('blacks');
    });

    test('Mexico beach route serves existing international beach content', async ({ request }) => {
      const html = await getHtml(request, '/mexico/baja-california/rosarito/alfonsos');

      expect(getHeadingTexts(html, 1).join(' ')).toMatch(/alfonsos/i);
    });

    test('indexed Baja hub exposes canonical Rosarito crawl links in HTML', async ({ request }) => {
      const html = await getHtml(request, '/beaches/mexico/baja-california');
      const anchorHrefs = getAnchorHrefs(html);

      expect(anchorHrefs).toEqual(
        expect.arrayContaining([
          '/mexico/baja-california/rosarito',
          '/mexico/baja-california/rosarito/alfonsos',
          '/mexico/baja-california/rosarito/el-morro-point-k375',
        ]),
      );
    });

    test('Doheny loads without the removed snapshot or supporting guide links', async ({ request }) => {
      const response = await getResponse(request, '/ca/dana-point/doheny-state-beach', {
        maxRedirects: 0,
      });
      const html = await response.text();

      expect(response.status()).toBe(200);
      expect(response.headers().location).toBeUndefined();
      expect(html.toLowerCase()).toContain('doheny');
      expect(html).not.toContain('Surf report snapshot');
      expect(html).not.toContain('aria-label="Doheny Beach related surf guides"');
      expect(html).not.toContain('href="/ca/dana-point/doheny-state-beach/tides"');
      expect(html).not.toContain('href="/ca/dana-point/doheny-state-beach/water-temp"');
    });

    test('Ala Moana Bowls loads without the removed snapshot or supporting guide links', async ({ request }) => {
      const response = await getResponse(request, '/hi/honolulu/ala-moana-bowls', {
        maxRedirects: 0,
      });
      const html = await response.text();

      expect(response.status()).toBe(200);
      expect(response.headers().location).toBeUndefined();
      expect(html).toContain('Ala Moana Bowls');
      expect(html).not.toContain('Surf report snapshot');
      expect(html).not.toContain('aria-label="Ala Moana Bowls related surf guides"');
      expect(html).not.toContain('href="/hi/honolulu/ala-moana-bowls/tides"');
      expect(html).not.toContain('href="/hi/honolulu/ala-moana-bowls/water-temp"');
    });

    const seoCanonicalRedirects = [
      {
        source: '/fl/cocoa-beach/cocoa-beach-pier',
        destination: '/fl/cocoa-beach/cocoa-beach-pier-cocoa-beach-fl',
      },
      {
        source: '/fl/cocoa-beach/cocoa-beach-pier/tides',
        destination: '/fl/cocoa-beach/cocoa-beach-pier-cocoa-beach-fl/tides',
      },
      {
        source: '/fl/cocoa-beach/cocoa-beach-pier/water-temp',
        destination: '/fl/cocoa-beach/cocoa-beach-pier-cocoa-beach-fl/water-temp',
      },
      {
        source: '/mexico/baja-california/rosarito/el-morro',
        destination: '/mexico/baja-california/rosarito/el-morro-point-k375',
      },
    ] as const;

    for (const redirect of seoCanonicalRedirects) {
      test(`308 redirects ${redirect.source} to a live canonical beach URL`, async ({
        request,
      }) => {
        const response = await getResponse(request, redirect.source, { maxRedirects: 0 });
        const destinationResponse = await getResponse(request, redirect.destination, {
          maxRedirects: 0,
        });

        expect(response.status()).toBe(308);
        expect(response.headers().location).toBe(redirect.destination);
        expect(destinationResponse.status()).toBe(200);
        expect(destinationResponse.headers().location).toBeUndefined();
      });
    }

    const northHbRedirects = [
      {
        source: '/ca/huntington-beach/north-hb-streets',
        destination: '/ca/huntington-beach/goldenwest',
      },
      {
        source: '/ca/huntington-beach/north-hb-streets/tides',
        destination: '/ca/huntington-beach/goldenwest/tides',
      },
      {
        source: '/ca/huntington-beach/north-hb-streets/water-temp',
        destination: '/ca/huntington-beach/goldenwest/water-temp',
      },
    ] as const;

    for (const redirect of northHbRedirects) {
      test(`301 redirects ${redirect.source} to Goldenwest`, async ({ request }) => {
        const response = await getResponse(request, redirect.source, { maxRedirects: 0 });

        expect(response.status()).toBe(301);
        expect(response.headers().location).toBe(redirect.destination);
      });
    }

    const legacyCanonicalRedirects = [
      {
        source: '/spots/ocean-beach',
        destination: '/ca/san-diego/ocean-beach',
      },
      {
        source: '/spots/lowers-trestles',
        destination: '/ca/san-onofre/lower-trestles',
      },
      {
        source: '/ca/orange-county/bolsa-chica',
        destination: '/ca/huntington-beach/bolsa-chica',
      },
      {
        source: '/hi/koloa-hi/waikoloa-village-lagoon/extra',
        destination: '/hi/koloa-hi/waikoloa-village-lagoon',
      },
    ] as const;

    for (const redirect of legacyCanonicalRedirects) {
      test(`301 redirects ${redirect.source} directly to canonical URL`, async ({
        request,
      }) => {
        const response = await getResponse(request, redirect.source, { maxRedirects: 0 });

        expect(response.status()).toBe(301);
        expect(response.headers().location).toBe(redirect.destination);
        expect(response.headers().location).not.toContain('/spots/');
      });
    }
  });

  test.describe('Intent route contracts', () => {
    const stateRoutes = [
      {
        path: '/beginner/ca',
        heading: /california/i,
        body: /beginner/i,
      },
      {
        path: '/tide/hi',
        heading: /hawaii/i,
        body: /tide|hawaii/i,
      },
      {
        path: '/longboard/or',
        heading: /oregon/i,
        body: /longboard|oregon/i,
      },
      {
        path: '/beginner/nd',
        heading: /north dakota|beginner/i,
        body: /north dakota|beginner/i,
      },
      {
        path: '/dawn-patrol/or',
        heading: /oregon/i,
        body: /dawn patrol|oregon/i,
      },
    ] as const;

    for (const route of stateRoutes) {
      test(`${route.path} returns intent state content`, async ({ request }) => {
        const html = await getHtml(request, route.path);

        expect(getHeadingTexts(html, 1).join(' ')).toMatch(route.heading);
        expect(stripTags(html).toLowerCase()).toMatch(route.body);
      });
    }

    test('state intent pages expose spot count and FAQ content', async ({ request }) => {
      const html = await getHtml(request, '/beginner/ca');

      expect(stripTags(html)).toMatch(/\d+\s+spot/i);
      expect(stripTags(html)).toMatch(/frequently asked questions/i);
    });

    test('invalid state-level intent routes return 404', async ({ request }) => {
      expect((await getResponse(request, '/invalid-intent/ca')).status()).toBe(404);
      expect((await getResponse(request, '/beginner/zz')).status()).toBe(404);
    });

    test('city intent route returns city heading and breadcrumb JSON-LD', async ({
      request,
    }) => {
      const html = await getHtml(request, '/beginner/ca/san-diego');
      const jsonLdScripts = getJsonLdScripts(html);

      expect(getHeadingTexts(html, 1).join(' ')).toMatch(/beginner surf spots in san diego/i);
      expect(jsonLdScripts.some((script) => script.includes('"@type":"BreadcrumbList"'))).toBe(
        true,
      );
    });

    test('invalid city intent routes render not-found content', async ({ request }) => {
      const invalidRoutes = [
        '/invalid-intent/ca/san-diego',
        '/beginner/zz/san-diego',
        '/beginner/ca/nonexistent-city-xyz',
      ] as const;

      for (const path of invalidRoutes) {
        const response = await getResponse(request, path);
        const html = await response.text();
        const pageText = stripTags(html).toLowerCase();

        expect([200, 404]).toContain(response.status());
        expect(pageText.includes('not found') || pageText.includes('404')).toBe(true);
      }
    });

    test('state intent titles and meta descriptions are available in HTML', async ({
      request,
    }) => {
      const html = await getHtml(request, '/beginner/ca');

      expect(getTitle(html)).toContain('California');
      expect(getTitle(html)?.toLowerCase()).toContain('beginner');
      expect(getMetaContent(html, { name: 'description' })?.toLowerCase()).toContain(
        'california',
      );
      expect(getHeadingTexts(html, 1)).toHaveLength(1);
      expect(getHeadingTexts(html, 2).length).toBeGreaterThan(0);
      expect(getJsonLdScripts(html).length).toBeGreaterThan(0);
    });

    test('supported intents render distinct California headings', async ({ request }) => {
      const intents = [
        'beginner',
        'least-crowded',
        'tide',
        'water-temp',
        'longboard',
        'dawn-patrol',
        'sunset',
      ] as const;
      const headings: string[] = [];

      for (const intent of intents) {
        const html = await getHtml(request, `/${intent}/ca`);
        const h1 = getHeadingTexts(html, 1).join(' ');

        expect(h1).toMatch(/california/i);
        headings.push(h1);
      }

      expect(new Set(headings).size).toBe(headings.length);
    });
  });

  test.describe('Database-driven intent route contracts', () => {
    const cityRoutes = [
      {
        path: '/beginner/santa-cruz',
        heading: /santa cruz/i,
        body: /beginner/i,
      },
      {
        path: '/tide/honolulu',
        heading: /honolulu/i,
        body: /tide/i,
      },
      {
        path: '/water-temp/newport-beach',
        heading: /newport/i,
        body: /newport|water/i,
      },
    ] as const;

    for (const route of cityRoutes) {
      test(`${route.path} returns database-driven city content`, async ({ request }) => {
        const html = await getHtml(request, route.path);

        expect(getHeadingTexts(html, 1).join(' ')).toMatch(route.heading);
        expect(stripTags(html).toLowerCase()).toMatch(route.body);
      });
    }

    test('database-driven 404 contracts stay stable', async ({ request }) => {
      const routes = [
        '/beginner/nonexistent-city-xyz',
        '/beginner/random-inland-city-99',
        '/invalid-intent/santa-cruz',
        '/least-crowded/encinitas',
      ] as const;

      for (const path of routes) {
        const response = await getResponse(request, path);

        expect(response.status()).toBe(404);
      }
    });

    test('database-driven city SEO metadata is present in HTML', async ({ request }) => {
      const html = await getHtml(request, '/beginner/santa-cruz');

      expect(getTitle(html)).toContain('Santa Cruz');
      expect(getTitle(html)?.toLowerCase()).toContain('beginner');
      expect(getMetaContent(html, { name: 'description' })?.toLowerCase()).toContain(
        'santa cruz',
      );
    });

    test('database-driven city structured data is present in HTML', async ({ request }) => {
      const html = await getHtml(request, '/beginner/san-diego');
      const jsonLdScripts = getJsonLdScripts(html);

      expect(jsonLdScripts.some((script) => script.includes('BreadcrumbList'))).toBe(true);
      expect(jsonLdScripts.some((script) => script.includes('FAQPage'))).toBe(false);
      expect(getHeadingTexts(html, 1)).toHaveLength(1);
      expect(getHeadingTexts(html, 2).length).toBeGreaterThan(0);
    });
  });
});
