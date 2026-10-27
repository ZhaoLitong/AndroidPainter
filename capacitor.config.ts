import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.androidpainter.app',
  appName: 'Painter',
  webDir: 'dist',
  // 55 matches Capacitor 8's own floor and the oldest WebView the web code supports.
  android: { minWebViewVersion: 55 },
};
export default config;
