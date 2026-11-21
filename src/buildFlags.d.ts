/** Compile-time flags set in vite.config.ts (and vitest.config.ts). */
/** Gemini AI assist: true only in `npm run dev` with GEMINI_API_KEY set. Never in release builds. */
declare const __AI_ASSIST__: boolean;
/** Developer-only hooks such as `?photo=<url>&ar=1`. Never in release builds. */
declare const __DEV_TOOLS__: boolean;
