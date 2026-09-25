import { getFontEmbedCSS, toBlob } from 'html-to-image';

// Embedding fonts means reading every @font-face file; do it once per card kind (kinds use different fonts).
const fontCss = new Map<string, Promise<string>>();

const TIMEOUT_MS = 5000;
const MAX_BYTES = 3_000_000; // stays under the content script's data-URL limit after base64

function withTimeout<T>(p: Promise<T>): Promise<T> {
  // html-to-image can hang forever when an image fails to decode.
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Card render timed out')), TIMEOUT_MS))]);
}

export async function renderCardPng(node: HTMLElement, kind: string): Promise<{ blob: Blob; dataUrl: string }> {
  if (!fontCss.has(kind)) fontCss.set(kind, getFontEmbedCSS(node, { preferredFontFormat: 'woff2' }));
  const blob = await withTimeout(toBlob(node, { pixelRatio: 2, fontEmbedCSS: await fontCss.get(kind) }));
  if (!blob) throw new Error('Card render failed');
  if (blob.size > MAX_BYTES) throw new Error('Card image too large');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { blob, dataUrl };
}
