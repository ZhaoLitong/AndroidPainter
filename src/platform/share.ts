import { t } from '../i18n';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { exportCanvas } from '../drawing/renderer';
import type { Drawing } from '../drawing/model';
export async function shareDrawing(d: Drawing, source?: HTMLCanvasElement) {
  const canvas = source ?? exportCanvas(d);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed.'))), 'image/png'),
  );
  if (!source) {
    canvas.width = 0;
    canvas.height = 0;
  }
  const name =
    (d.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').slice(0, 60) || t('Drawing')) + '.png';
  if (Capacitor.isNativePlatform()) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const file = await Filesystem.writeFile({
      path: `exports/${Date.now()}-${name}`,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    try {
      await Share.share({ title: d.name, files: [file.uri], dialogTitle: t('Share drawing') });
    } catch (e) {
      if (!/cancel|dismiss/i.test((e as Error).message)) throw e;
    }
  } else {
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
export async function cleanExports() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const files = await Filesystem.readdir({ path: 'exports', directory: Directory.Cache });
    for (const f of files.files)
      if (Date.now() - Number(f.name.split('-')[0]) > 86400000)
        await Filesystem.deleteFile({ path: 'exports/' + f.name, directory: Directory.Cache });
  } catch {
    /* Cache cleanup must not block drawing. */
  }
}
