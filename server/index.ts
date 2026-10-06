import { criarApp } from "./app";
import { conectar } from "./banco";
import { config } from "./config";

// Sobe o servidor: MongoDB, rotas (app.ts) e porta.
await conectar();
const app = await criarApp();
await app.listen({ port: config.porta, host: config.host });
