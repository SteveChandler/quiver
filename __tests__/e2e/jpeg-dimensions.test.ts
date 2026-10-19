/** @jest-environment node */
import sharp from 'sharp';
import { readJpegDimensions } from '@/e2e/utils/jpeg-dimensions';

test.each([false, true])('reads JPEG dimensions with progressive=%s', async progressive => {
  const body = await sharp({
    create: { width: 1200, height: 630, channels: 3, background: '#123456' },
  }).jpeg({ progressive }).toBuffer();

  expect(readJpegDimensions(body)).toEqual({ width: 1200, height: 630 });
});

test('skips SOF-like bytes inside metadata and reads height and width in the correct order', async () => {
  const jpeg = await sharp({
    create: { width: 320, height: 640, channels: 3, background: '#123456' },
  }).jpeg().toBuffer();
  const fakeFrame = Buffer.from([0xff, 0xc0, 0x00, 0x08, 0x08, 0x00, 0x01, 0x00, 0x02, 0x01]);
  const appHeader = Buffer.from([0xff, 0xe1, 0x00, fakeFrame.length + 2]);
  const body = Buffer.concat([jpeg.subarray(0, 2), appHeader, fakeFrame, jpeg.subarray(2)]);

  expect(readJpegDimensions(body)).toEqual({ width: 320, height: 640 });
});

test.each([
  ['empty data', Buffer.alloc(0)],
  ['PNG signature', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ['no frame', Buffer.from([0xff, 0xd8, 0xff, 0xd9])],
  ['truncated segment', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])],
  ['short frame', Buffer.from([0xff, 0xd8, 0xff, 0xc2, 0x00, 0x02])],
])('rejects %s rather than reporting dimensions', (_label, body) => {
  expect(() => readJpegDimensions(body)).toThrow(/JPEG/);
});
