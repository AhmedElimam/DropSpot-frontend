import { Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Share a text document as a real FILE (e.g. مدام روز's «.md» report) through the system
 * share sheet — WhatsApp, Drive, Files, email. Written to the app cache first, the same
 * in-process path openRemotePdf uses (no download-manager hand-off, no Samsung restart).
 *
 * Falls back to sharing the text itself as a message when file sharing is unavailable,
 * so the content always leaves the phone one way or the other.
 */
export async function shareTextFile(filename: string, content: string, mimeType = 'text/markdown'): Promise<void> {
  const safe = (filename || 'report.md').replace(/[\/\\:*?"<>|\s]+/g, '_') || 'report.md';
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable');
    const file = new File(Paths.cache, safe);
    try {
      if (file.exists) file.delete();
    } catch {
      // best-effort — the write below surfaces any real problem
    }
    file.create();
    file.write(content);
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: safe, UTI: 'net.daringfireball.markdown' });
  } catch {
    await Share.share({ title: safe, message: content });
  }
}
