import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { complementos, sessoes, templates } from "./banco";
import { repassar } from "./moovin";
import { exigirSessao, rotasSessao } from "./sessao";

// Rotas do servidor do painel: login com a Moovin, repasse das chamadas à API com o token do usuário
// e, no MongoDB, os templates e o Complemento de cada produto (o que a Moovin não tem).

// Separado de index.ts para os testes montarem o servidor sem abrir porta (app.inject).
export async function criarApp({ log = true } = {}) {
  const app = Fastify({ logger: log ? { level: "info", redact: ["req.headers.cookie", "req.headers.authorization"] } : false });
  await app.register(cookie);
  // Corpo cru para o repasse (JSON ou arquivo); as rotas próprias leem JSON.
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_pedido, corpo, pronto) => pronto(null, corpo));

  await rotasSessao(app);

  // Serviços da Moovin que o painel pode chamar (cadastro, preço, estoque, catálogo, SEO e arquivos).
  const SERVICOS = new Set(["oms-product", "oms-pricing", "oms-inventory", "oms-catalog", "eco-seo", "dam-storage"]);

  app.all<{ Params: { servico: string; "*": string } }>("/api/moovin/:servico/*", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const { servico } = pedido.params;
    if (!SERVICOS.has(servico)) return resposta.code(404).send({ erro: "Serviço não liberado." });
    const consulta = pedido.url.includes("?") ? pedido.url.slice(pedido.url.indexOf("?")) : "";
    const corpo = Buffer.isBuffer(pedido.body) ? pedido.body : pedido.body ? Buffer.from(JSON.stringify(pedido.body)) : undefined;
    const r = await repassar(pedido.sessao!.tokenConta!, pedido.method, `${servico}/${pedido.params["*"]}${consulta}`, corpo, pedido.headers["content-type"]);
    if (r.status === 401) {
      await sessoes().deleteOne({ _id: pedido.sessao!._id });
      return resposta.code(401).send({ erro: "A sessão na Moovin expirou. Entre de novo." });
    }
    resposta.code(r.status).header("content-type", r.headers.get("content-type") ?? "application/json");
    return resposta.send(Buffer.from(await r.arrayBuffer()));
  });

  // Script da página de produto, público: a Moovin o carrega como script do tipo URL.
  // Leva o template publicado da loja; sem template publicado, entrega um script vazio
  // (a página fica no layout da Moovin). Cache curto: publicar vale em cerca de 1 minuto.
  const ARQUIVO_LOJA = resolve("dist-loja/produto.js");
  let scriptLoja: { codigo: string; versao: number } | null = null;
  async function codigoDaLoja() {
    const versao = (await stat(ARQUIVO_LOJA)).mtimeMs;
    if (scriptLoja?.versao !== versao) scriptLoja = { codigo: await readFile(ARQUIVO_LOJA, "utf8"), versao };
    return scriptLoja.codigo;
  }

  app.get<{ Params: { conta: string } }>("/loja/:conta/produto.js", async (pedido, resposta) => {
    resposta
      .header("content-type", "application/javascript; charset=utf-8")
      .header("cache-control", "public, max-age=60")
      .header("access-control-allow-origin", "*");
    if (!/^[0-9a-f-]{36}$/i.test(pedido.params.conta)) return resposta.code(404).send("/* loja inválida */");
    const doc = await templates().findOne({ conta: pedido.params.conta, tipo: "publicado" });
    if (!doc) return "/* templater: nenhum template publicado */";
    return `window.__TEMPLATER_BOMGADO__=${JSON.stringify({ template: doc.dados, publicadoEm: doc.atualizadoEm })};\n${await codigoDaLoja()}`;
  });

  // Complemento do produto para a página da loja, público, achado pelo SKU que a página mostra.
  app.get<{ Params: { conta: string; sku: string } }>("/loja/:conta/complemento/:sku", async (pedido, resposta) => {
    resposta.header("cache-control", "public, max-age=60").header("access-control-allow-origin", "*");
    const doc = await complementos().findOne({ conta: pedido.params.conta, skus: pedido.params.sku });
    return doc ? { complemento: doc.dados } : resposta.code(404).send({ erro: "Sem complemento." });
  });

  // Complemento do produto no painel (por id do produto na Moovin).
  app.get<{ Params: { produto: string } }>("/api/complementos/:produto", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const doc = await complementos().findOne({ _id: `${pedido.sessao!.conta!.id}:${pedido.params.produto}` });
    return doc ? { dados: doc.dados, atualizadoEm: doc.atualizadoEm, atualizadoPor: doc.atualizadoPor } : resposta.code(404).send({ erro: "Sem complemento." });
  });

  app.put<{ Params: { produto: string }; Body: { dados?: unknown; skus?: unknown } }>("/api/complementos/:produto", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const { dados, skus } = pedido.body ?? {};
    if (!dados || typeof dados !== "object" || !Array.isArray(skus) || !skus.every((s) => typeof s === "string"))
      return resposta.code(400).send({ erro: "Complemento inválido." });
    const conta = pedido.sessao!.conta!.id;
    const produtoId = pedido.params.produto;
    const atualizadoEm = new Date();
    await complementos().updateOne(
      { _id: `${conta}:${produtoId}` },
      { $set: { conta, produtoId, skus, dados, atualizadoEm, atualizadoPor: pedido.sessao!.usuario?.email ?? "" } },
      { upsert: true },
    );
    return { ok: true, atualizadoEm };
  });

  // Templates da loja: rascunho e publicado.
  app.get<{ Params: { tipo: string } }>("/api/templates/:tipo", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const tipo = pedido.params.tipo;
    if (tipo !== "rascunho" && tipo !== "publicado") return resposta.code(404).send({ erro: "Tipo inválido." });
    const doc = await templates().findOne({ conta: pedido.sessao!.conta!.id, tipo });
    return doc ? { dados: doc.dados, atualizadoEm: doc.atualizadoEm, atualizadoPor: doc.atualizadoPor } : resposta.code(404).send({ erro: "Sem template." });
  });

  app.put<{ Params: { tipo: string }; Body: { dados?: unknown } }>("/api/templates/:tipo", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const tipo = pedido.params.tipo;
    const dados = pedido.body?.dados as { content?: unknown } | undefined;
    if (tipo !== "rascunho" && tipo !== "publicado") return resposta.code(404).send({ erro: "Tipo inválido." });
    if (!dados || !Array.isArray(dados.content)) return resposta.code(400).send({ erro: "Template inválido." });
    const conta = pedido.sessao!.conta!.id;
    const atualizadoEm = new Date();
    await templates().updateOne(
      { conta, tipo },
      { $set: { dados, atualizadoEm, atualizadoPor: pedido.sessao!.usuario?.email ?? "" }, $setOnInsert: { _id: `${conta}:${tipo}` } },
      { upsert: true },
    );
    return { ok: true, atualizadoEm };
  });

  // Em produção, o mesmo servidor entrega o painel (build do Vite em dist/). Em desenvolvimento, quem entrega é o Vite.
  const PAINEL = resolve("dist");
  if (existsSync(resolve(PAINEL, "index.html"))) await app.register(fastifyStatic, { root: PAINEL });
  return app;
}
