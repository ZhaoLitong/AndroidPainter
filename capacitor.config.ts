import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.androidpainter.app',
  appName: 'Painter',
  webDir: 'dist',
  android: { minWebViewVersion: 94 },
};
export default config;
