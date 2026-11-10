import { requireOptionalNativeModule } from 'expo';

/** A teacher the family owes by transfer, as a contact in the phone's share sheet. */
export interface ShareTarget {
  id: string;
  name: string;
  /** Local file with the teacher's logo; the first letter on `color` without one. */
  iconPath?: string | null;
  color?: string | null;
}

/** What another app (InstaPay, Vodafone Cash…) shared into Dros Spot. */
export interface IncomingShare {
  /** Set when the parent picked a teacher contact in the share sheet. */
  teacherId: string | null;
  text: string | null;
  /** The shared image, copied into the app's cache. */
  file: { uri: string; mimeType: string; size: number } | null;
}

type NativeModule = {
  getPendingShare(): Promise<IncomingShare | null>;
  setTargets(targets: ShareTarget[]): Promise<boolean>;
  addListener(event: 'onShare', listener: () => void): { remove(): void };
};

// Optional: a JS bundle running on a store build from before 1.3.0 has no such module (OTA).
const Native = requireOptionalNativeModule<NativeModule>('DrosspotShare');

export const shareSupported = Native != null;

export async function getPendingShare(): Promise<IncomingShare | null> {
  if (!Native) return null;
  try {
    return await Native.getPendingShare();
  } catch {
    return null;
  }
}

export async function setShareTargets(targets: ShareTarget[]): Promise<void> {
  if (!Native) return;
  try {
    await Native.setTargets(targets);
  } catch {
    // A share-sheet contact is a convenience; never break the app over it.
  }
}

export function addShareListener(listener: () => void): { remove(): void } {
  if (!Native) return { remove() {} };
  return Native.addListener('onShare', listener);
}
