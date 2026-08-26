import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';

/**
 * Open a remote (signed) PDF without cold-restarting the app on Android/Samsung.
 *
 * `WebBrowser.openBrowserAsync` spawns a Chrome Custom Tab, which cannot render a
 * PDF and instead hands the `application/pdf` response to the OS download manager.
 * That hand-off backgrounds our activity, and Samsung's aggressive memory manager
 * then kills and cold-restarts the JS bundle — the user sees "the whole app
 * reloads". Downloading the file into the app cache and presenting the system
 * share sheet (an in-process overlay) avoids the download-manager hand-off and
 * lets the user open the PDF in their viewer of choice.
 *
 * Falls back to opening the URL in the browser when sharing is unavailable
 * (no handler app) or the download/share path throws, so the user can always
 * still reach the document.
 */
export async function openRemotePdf(url: string, filename: string): Promise<void> {
  // Strip only filesystem-unsafe characters (path separators, wildcards,
  // whitespace) so Arabic names survive; collapse to a generic name if nothing
  // usable is left.
  const cleaned = (filename || '').replace(/[\/\\:*?"<>|\s]+/g, '_').replace(/^[._-]+|[._-]+$/g, '');
  const base = cleaned || 'document';
  const name = base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;

  try {
    if (!(await Sharing.isAvailableAsync())) {
      await WebBrowser.openBrowserAsync(url);
      return;
    }
    const dest = new File(Paths.cache, name);
    // Clear any stale copy from a previous open so the download doesn't conflict.
    try {
      if (dest.exists) dest.delete();
    } catch {
      // best-effort — download will surface any real problem below
    }
    const file = await File.downloadFileAsync(url, dest);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle: name,
      UTI: 'com.adobe.pdf',
    });
  } catch {
    // Download or share failed — fall back to the browser so the PDF is still reachable.
    await WebBrowser.openBrowserAsync(url);
  }
}
