import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// es2017 = Chrome 55, the oldest Android System WebView the app supports.
export default defineConfig({ plugins: [react()], build: { target: 'es2017' } });
