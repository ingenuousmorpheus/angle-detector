import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Save a PNG data URL for the user.
 *
 * Browser: a normal download. Android app: the WebView ignores `<a download>`,
 * so the image is written to the app's private cache and handed to the Android
 * share sheet, where the user picks Photos, Files, Drive, etc. Nothing is
 * uploaded by the app itself.
 */
export async function savePngDataUrl(dataUrl: string, fileName: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.click();
    return;
  }
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const { uri } = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
  await Share.share({ title: 'Angle Lens measurement', files: [uri], dialogTitle: 'Save or share measurement' });
}
