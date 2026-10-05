import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { conectar, sessoes, templates } from "./banco";
import { config } from "./config";
import { repassar } from "./moovin";
import { exigirSessao, rotasSessao } from "./sessao";

// Servidor do painel: login com a Moovin, repasse das chamadas à API com o token do usuário
// e os templates no MongoDB. O Complemento do cadastro fica na descrição do produto, na Moovin.

const app = Fastify({ logger: { level: "info", redact: ["req.headers.cookie", "req.headers.authorization"] } });
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

await conectar();
await app.listen({ port: config.porta, host: "127.0.0.1" });
