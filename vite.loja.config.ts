import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Script da loja (página de produto): um único arquivo IIFE, com React e o CSS embutidos.
// O servidor o entrega em /loja/<conta>/produto.js, junto com o template publicado.
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist-loja",
    emptyOutDir: true,
    lib: { entry: "src/loja/index.tsx", formats: ["iife"], name: "TemplaterBomgado", fileName: () => "produto.js" },
  },
});
