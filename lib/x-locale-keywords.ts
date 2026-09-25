// Text X renders per UI language. User runs X in Vietnamese; English kept as fallback. Verify strings live.
export const KEYWORDS = {
  adLabel: ['Quảng cáo', 'Ad', 'Promoted'],
  protectedLabel: ['Tài khoản được bảo vệ', 'Protected account'],
  replyingTo: ['Đang trả lời', 'Replying to'],
  genericImageAlt: ['Hình ảnh', 'Image'],
  // X auto-translate label, e.g. "Được dịch từ Tiếng Nhật"; the tweetText then carries lang="vi".
  translatedFrom: ['Được dịch từ ', 'Translated from '],
  quoteMenu: ['Trích dẫn', 'Quote'],
} as const;

const LANGUAGE_CODES: Record<string, string> = {
  'tiếng anh': 'en', english: 'en', 'tiếng việt': 'vi', vietnamese: 'vi', 'tiếng nhật': 'ja', japanese: 'ja',
  'tiếng trung': 'zh', chinese: 'zh', 'tiếng hàn': 'ko', korean: 'ko', 'tiếng tây ban nha': 'es', spanish: 'es',
  'tiếng pháp': 'fr', french: 'fr', 'tiếng đức': 'de', german: 'de', 'tiếng bồ đào nha': 'pt', portuguese: 'pt',
};

// Returns the source language code of an auto-translated post, 'und' if unknown, null if not a translation label.
export function translatedFromLang(label: string | null | undefined): string | null {
  const text = (label ?? '').trim();
  const prefix = KEYWORDS.translatedFrom.find((k) => text.startsWith(k));
  if (!prefix) return null;
  return LANGUAGE_CODES[text.slice(prefix.length).trim().toLowerCase()] ?? 'und';
}

const SUFFIX: Record<string, number> = { k: 1e3, n: 1e3, m: 1e6, tr: 1e6, b: 1e9, t: 1e9 };

// "1,2 N" / "3,4 Tr" (vi) and "1.2K" / "3.4M" (en); unsuffixed "1.234" / "1,234" are thousands separators.
export function parseCount(raw: string | null | undefined): number {
  const s = (raw ?? '').trim().replace(/\s+/g, '');
  if (!s) return 0;
  const [, num = '', suffix] = s.match(/^([\d.,]+)([a-zA-Z]+)?$/) ?? [];
  if (!num) return 0;
  if (suffix) {
    const mult = SUFFIX[suffix.toLowerCase()];
    const value = Number.parseFloat(num.replace(',', '.'));
    return mult && Number.isFinite(value) ? Math.round(value * mult) : 0;
  }
  return Number.parseInt(num.replace(/[.,]/g, ''), 10) || 0;
}
