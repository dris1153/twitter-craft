import type { GifResult } from './messages';
import { waitFor } from './wait-for';
import { SEL } from './x-dom-selectors';

export const composerDialog = () =>
  [...document.querySelectorAll(SEL.dialog)].find((d) => d.querySelector(SEL.composer)) ?? null;

// Decoded by hand: fetch() of a data: URL can be blocked by the page's CSP.
export function dataUrlToFile(dataUrl: string, name = 'card.png'): File {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: 'image/png' });
}

// X attaches pasted image files like a normal Ctrl+V; success = a new media preview inside this dialog.
export async function pasteImage(dialog: Element, composer: HTMLElement, dataUrl: string): Promise<boolean> {
  const before = dialog.querySelectorAll(SEL.attachedMedia).length;
  let file: File;
  try {
    file = dataUrlToFile(dataUrl);
  } catch {
    return false; // malformed base64: text is already in, report the image as not attached
  }
  composer.focus();
  const data = new DataTransfer();
  data.items.add(file);
  composer.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  return !!(await waitFor(() => dialog.querySelectorAll(SEL.attachedMedia).length > before || null, 4000));
}

// React-controlled input: set through the native setter so React sees the change.
function typeIntoInput(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// Opens X's own GIF picker in the open reply/quote dialog and types the query. The user picks the GIF.
export async function openGifPicker(query: string): Promise<GifResult> {
  const dialog = composerDialog();
  if (!dialog) return 'no_dialog';
  const button = dialog.querySelector<HTMLButtonElement>(SEL.gifButton);
  if (!button) return 'no_gif_button';
  // X allows one image or one GIF per post; with the card attached the GIF button is disabled.
  if (button.disabled || button.getAttribute('aria-disabled') === 'true') return 'gif_disabled';
  const inputsBefore = new Set(document.querySelectorAll(SEL.gifSearchInput));
  button.click();
  const input = await waitFor(
    () => [...document.querySelectorAll<HTMLInputElement>(SEL.gifSearchInput)].find((i) => !inputsBefore.has(i)),
    3000,
  );
  if (!input) return 'no_gif_button';
  input.focus();
  typeIntoInput(input, query);
  return 'gif_opened';
}
