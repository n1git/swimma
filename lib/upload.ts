export const PROMO_MAX_BYTES = 2 * 1024 * 1024;

const SIGNATURES: { type: string; ext: string; match: (b: Uint8Array) => boolean }[] = [
  { type: "image/png", ext: "png", match: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v) },
  { type: "image/jpeg", ext: "jpg", match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/webp",
    ext: "webp",
    match: (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
];

export async function detectImage(file: File): Promise<{ type: string; ext: string } | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const found = SIGNATURES.find((s) => s.match(head));
  return found ? { type: found.type, ext: found.ext } : null;
}

export function promoObjectPath(publicUrl: string | null): string | null {
  if (!publicUrl) return null;
  const marker = "/storage/v1/object/public/promo/";
  const i = publicUrl.indexOf(marker);
  return i >= 0 ? decodeURIComponent(publicUrl.slice(i + marker.length)) : null;
}
