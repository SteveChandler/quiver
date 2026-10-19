import sharp from 'sharp';

export async function jpegResponse(response: Response): Promise<Response> {
  const png = Buffer.from(await response.arrayBuffer());
  // Bound photo-heavy cards for messaging clients while preserving their dimensions.
  for (const quality of [80, 65, 50, 35, 20, 10]) {
    const jpeg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpeg.length >= 300000) continue;
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'image/jpeg');
    headers.delete('Content-Length');
    return new Response(new Uint8Array(jpeg), { headers });
  }
  throw new Error('OG image exceeds the share preview size budget');
}
