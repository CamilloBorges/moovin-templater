import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Testes: `npm test`. Os do navegador (src/) declaram `@vitest-environment jsdom`; os do servidor rodam em Node com um
// MongoDB em memória (mongodb-memory-server).
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
