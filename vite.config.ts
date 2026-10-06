import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Em desenvolvimento, /api e /loja vão para o servidor (server/index.ts).
  server: { proxy: { "/api": "http://127.0.0.1:3001", "/loja": "http://127.0.0.1:3001" } },
});
