import { defineConfig, devices } from "@playwright/test";

// Testes de responsividade da página de produto (testes/responsivo): `npm run test:responsivo`.
// iPhones no WebKit (motor do Safari), Samsung no Chromium, computadores nos dois.
// Primeira vez: `npx playwright install chromium webkit`.

const iPhones = ["iPhone 11", "iPhone 11 Pro", "iPhone 12 Mini", "iPhone 13", "iPhone 14 Pro Max", "iPhone 15", "iPhone 16 Pro Max", "iPhone 17"];
// Galaxy S9+ (320 px) é o mais estreito; S8 e S24 têm 360 px; A55 480 px; Tab S9 é tablet.
const samsungs = ["Galaxy S8", "Galaxy S9+", "Galaxy S24", "Galaxy Z Flip 7", "Galaxy A55", "Galaxy Tab S9"];
const computadores = [
  { nome: "Notebook 1024", width: 1024, height: 768 },
  { nome: "Notebook 1366", width: 1366, height: 768 },
  { nome: "Desktop 1440", width: 1440, height: 900 },
  { nome: "Desktop 1920", width: 1920, height: 1080 },
];

export default defineConfig({
  testDir: "testes/responsivo",
  outputDir: "testes/resultados",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { outputFolder: "testes/relatorio", open: "never" }]] : [["list"], ["html", { outputFolder: "testes/relatorio", open: "never" }]],
  use: { baseURL: "http://127.0.0.1:5198" },
  webServer: { command: "npx vite --port 5198 --strictPort --host 127.0.0.1", url: "http://127.0.0.1:5198/testes/responsivo/index.html", reuseExistingServer: !process.env.CI },
  projects: [
    ...iPhones.map((nome) => ({ name: nome, use: { ...devices[nome] } })),
    ...samsungs.map((nome) => ({ name: nome, use: { ...devices[nome] } })),
    { name: "Desktop Chrome 1280", use: { ...devices["Desktop Chrome"] } },
    { name: "Desktop Safari 1280", use: { ...devices["Desktop Safari"] } },
    ...computadores.map((c) => ({ name: c.nome, use: { ...devices["Desktop Chrome"], viewport: { width: c.width, height: c.height } } })),
  ],
});
