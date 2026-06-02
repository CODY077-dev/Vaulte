import { Browser } from '@capacitor/browser';

/**
 * Opens a URL in the native in-app browser (Safari View Controller / Chrome Custom Tab).
 * Falls back to window.open on web.
 */
export async function openExternal(url: string) {
  try {
    await Browser.open({ url });
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
