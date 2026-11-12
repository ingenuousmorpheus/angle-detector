/** @type {import('tailwindcss').Config} */
// Build-time Tailwind (same v3 defaults as the former cdn.tailwindcss.com Play CDN),
// so the app works offline inside the Android APK.
export default {
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
