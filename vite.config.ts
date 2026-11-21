import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // AI assist calls Gemini straight from the client, which would ship the API key
    // inside the bundle. It is therefore only compiled in for `npm run dev`
    // (mode "development") with a key present. Production builds, including the
    // Android app, never contain the key or the Gemini client.
    // See docs/RELEASE_READINESS.md.
    const dev = mode === 'development';
    const aiAssist = dev && Boolean(env.GEMINI_API_KEY);
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        __AI_ASSIST__: JSON.stringify(aiAssist),
        __DEV_TOOLS__: JSON.stringify(dev),
        'process.env.API_KEY': JSON.stringify(aiAssist ? env.GEMINI_API_KEY : ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(aiAssist ? env.GEMINI_API_KEY : ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
