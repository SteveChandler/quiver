/** @jest-environment node */
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { jpegResponse } from '@/lib/seo/og-image';

test('bounds a noisy portrait card without changing its dimensions or caching', async () => {
  const png = await sharp(randomBytes(1080 * 1920 * 3), {
    raw: { width: 1080, height: 1920, channels: 3 },
  }).png().toBuffer();
  const response = await jpegResponse(new Response(new Uint8Array(png), {
    headers: { 'content-type': 'image/png', 'content-length': String(png.length), 'cache-control': 'no-store' },
  }));
  const jpeg = Buffer.from(await response.arrayBuffer());

  expect(response.headers.get('content-type')).toBe('image/jpeg');
  expect(response.headers.get('content-length')).toBeNull();
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(jpeg.length).toBeLessThan(300000);
  expect(await sharp(jpeg).metadata()).toMatchObject({ format: 'jpeg', width: 1080, height: 1920 });
});
