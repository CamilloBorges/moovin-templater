import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { randomUUID } from "node:crypto";
import { badges, complementos, sessoes, templates, type DocBadge } from "./banco";
import { repassar } from "./moovin";
import { resolverTitulosAbas, rotasAbas } from "./abas";
import { resolverMapaCorteLoja, rotasMapas } from "./mapas";
import { exigirSessao, rotasSessao } from "./sessao";
import { config } from "./config";

// Rotas do servidor do painel: login com a Moovin, repasse das chamadas à API com o token do usuário
// e, no MongoDB, os templates e o Complemento de cada produto (o que a Moovin não tem).

// Separado de index.ts para os testes montarem o servidor sem abrir porta (app.inject).
export async function criarApp({ log = true } = {}) {
  const app = Fastify({ logger: log ? { level: "info", redact: ["req.headers.cookie", "req.headers.authorization"] } : false });
  await app.register(cookie);
  // Corpo cru para o repasse (JSON ou arquivo); as rotas próprias leem JSON.
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_pedido, corpo, pronto) => pronto(null, corpo));

  await rotasSessao(app);
  await rotasAbas(app);
  await rotasMapas(app);

  // Serviços da Moovin que o painel pode chamar (cadastro, preço, estoque, catálogo, SEO, arquivos e scripts da loja).
  const SERVICOS = new Set(["oms-product", "oms-pricing", "oms-inventory", "oms-catalog", "eco-seo", "dam-storage", "eco-store"]);

  app.all<{ Params: { servico: string; "*": string } }>("/api/moovin/:servico/*", { preHandler: exigirSessao, bodyLimit: 15 * 1024 * 1024 }, async (pedido, resposta) => {
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
    if (!doc) return resposta.code(404).send({ erro: "Sem complemento." });
    // Badges do produto já resolvidos (na ordem escolhida), para a página não precisar de outra chamada.
    const ids = ((doc.dados as { badges?: unknown }).badges ?? []) as string[];
    const lista = ids.length ? await badges().find({ conta: pedido.params.conta, _id: { $in: ids } }).toArray() : [];
    const porId = new Map(lista.map((b) => [b._id, publico(b)]));
    // Abas do cadastro com o título atual do cadastro.
    const complemento = await resolverTitulosAbas(pedido.params.conta, doc.dados);
    // Mapa de Corte já resolvido (imagem do animal, contorno do corte e descrição).
    const mapaCorte = await resolverMapaCorteLoja(pedido.params.conta, doc.dados);
    return { complemento, badges: ids.map((id) => porId.get(id)).filter(Boolean), mapaCorte };
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

  // Editor de imagem (badges): o que o servidor oferece, remoção de fundo por IA e download das
  // imagens já salvas na Moovin (o canvas do navegador só edita imagem do próprio domínio).
  app.get("/api/imagem/recursos", { preHandler: exigirSessao }, async () => ({
    removerFundoIa: !!config.rembgUrl,
    modelos: Object.entries(MODELOS_IA).map(([id, nome]) => ({ id, nome })),
    modeloPadrao: MODELOS_IA[config.rembgModelo] ? config.rembgModelo : "u2net",
  }));

  app.post<{ Body: { imagem?: string; modelo?: string } }>("/api/imagem/remover-fundo", { preHandler: exigirSessao, bodyLimit: 15 * 1024 * 1024 }, async (pedido, resposta) => {
    if (!config.rembgUrl) return resposta.code(501).send({ erro: "Remoção de fundo por IA não configurada no servidor." });
    const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(pedido.body?.imagem ?? "");
    if (!m) return resposta.code(400).send({ erro: "Envie a imagem como data URL." });
    const formulario = new FormData();
    formulario.append("file", new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), "imagem");
    const modelo = pedido.body?.modelo && MODELOS_IA[pedido.body.modelo] ? pedido.body.modelo : config.rembgModelo;
    formulario.append("model", modelo);
    let r: Response;
    try {
      r = await fetch(`${config.rembgUrl}/api/remove`, { method: "POST", body: formulario, signal: AbortSignal.timeout(120_000) });
    } catch (erro) {
      pedido.log.error({ erro }, "rembg indisponível");
      return resposta.code(502).send({ erro: "O serviço de IA não respondeu. Tente de novo em instantes." });
    }
    if (!r.ok) return resposta.code(502).send({ erro: `O serviço de IA recusou a imagem (${r.status}).` });
    return { imagem: `data:image/png;base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}` };
  });

  app.get<{ Querystring: { url?: string } }>("/api/imagem/baixar", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const url = pedido.query.url ?? "";
    // Só o armazenamento da Moovin: o servidor não busca endereços arbitrários.
    if (!/^https:\/\/storage\.moovin\.store\//.test(url)) return resposta.code(400).send({ erro: "Endereço não permitido." });
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const tipo = r.headers.get("content-type") ?? "";
    if (!r.ok || !tipo.startsWith("image/")) return resposta.code(502).send({ erro: "Não foi possível baixar a imagem." });
    return resposta.header("content-type", tipo).send(Buffer.from(await r.arrayBuffer()));
  });

  // Implantação: o que já está pronto no Templater e se a página da loja carrega o script.
  app.get("/api/implantacao/resumo", { preHandler: exigirSessao }, async (pedido) => {
    const conta = pedido.sessao!.conta!.id;
    const [produtos, totalBadges, publicado, exemplo] = await Promise.all([
      complementos().countDocuments({ conta }),
      badges().countDocuments({ conta }),
      templates().findOne({ conta, tipo: "publicado" }, { projection: { atualizadoEm: 1 } }),
      complementos().findOne({ conta }, { sort: { atualizadoEm: -1 }, projection: { produtoId: 1 } }),
    ]);
    return { produtos, badges: totalBadges, publicadoEm: publicado?.atualizadoEm ?? null, produtoExemplo: exemplo?.produtoId ?? null, lojaUrl: config.lojaUrl };
  });

  app.get<{ Querystring: { caminho?: string } }>("/api/implantacao/pagina", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const caminho = pedido.query.caminho ?? "";
    // Só caminhos da própria loja (ex.: /cubos-de-panela/p): o servidor não abre endereços de fora.
    if (!/^\/[\w\-./%]*$/.test(caminho) || caminho.includes("//") || caminho.includes("..")) return resposta.code(400).send({ erro: "Caminho inválido." });
    const url = `${config.lojaUrl}${caminho}`;
    const scriptTemplater = `/loja/${pedido.sessao!.conta!.id}/produto.js`;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "TemplaterBomgado/1.0 (verificacao de implantacao)" } });
      const html = await r.text();
      return { url, status: r.status, carregaTemplater: html.includes(scriptTemplater), carregaV3: html.includes("bomgado-product") };
    } catch {
      return resposta.code(502).send({ erro: `Não foi possível abrir ${url}.` });
    }
  });

  // Badges da loja (cadastro no painel).
  app.get("/api/badges", { preHandler: exigirSessao }, async (pedido) => {
    const lista = await badges().find({ conta: pedido.sessao!.conta!.id }).sort({ nome: 1 }).toArray();
    return lista.map(publico);
  });

  app.post<{ Body: Partial<DocBadge> }>("/api/badges", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const dados = validarBadge(pedido.body);
    if (typeof dados === "string") return resposta.code(400).send({ erro: dados });
    const badge: DocBadge = { _id: randomUUID(), conta: pedido.sessao!.conta!.id, ...dados, atualizadoEm: new Date(), atualizadoPor: pedido.sessao!.usuario?.email ?? "" };
    await badges().insertOne(badge);
    return publico(badge);
  });

  app.put<{ Params: { id: string }; Body: Partial<DocBadge> }>("/api/badges/:id", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const dados = validarBadge(pedido.body);
    if (typeof dados === "string") return resposta.code(400).send({ erro: dados });
    const r = await badges().findOneAndUpdate(
      { _id: pedido.params.id, conta: pedido.sessao!.conta!.id },
      { $set: { ...dados, atualizadoEm: new Date(), atualizadoPor: pedido.sessao!.usuario?.email ?? "" } },
      { returnDocument: "after" },
    );
    return r ? publico(r) : resposta.code(404).send({ erro: "Badge não encontrado." });
  });

  // Excluir tira o badge dos produtos que o usam.
  app.delete<{ Params: { id: string } }>("/api/badges/:id", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const conta = pedido.sessao!.conta!.id;
    const r = await badges().deleteOne({ _id: pedido.params.id, conta });
    if (!r.deletedCount) return resposta.code(404).send({ erro: "Badge não encontrado." });
    await complementos().updateMany({ conta, "dados.badges": pedido.params.id }, { $pull: { "dados.badges": pedido.params.id } as never });
    return { ok: true };
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

// Modelos do rembg oferecidos no editor (todos de uso comercial livre; o bria-rmbg, que vem na
// imagem, é não comercial e fica de fora). Testados com o logotipo da Linha Origens em 06/10/2026:
// o u2net manteve o logotipo inteiro; o isnet-general-use, feito para fotos, ficou só com o
// "objeto principal" (a cabeça do boi) e apagou o oval.
const MODELOS_IA: Record<string, string> = {
  u2net: "Logotipos, selos e ilustrações",
  "isnet-general-use": "Fotos de produto (separa o objeto principal)",
};

// O que sai do badge para o painel e para a loja.
function publico(b: DocBadge) {
  return {
    id: b._id,
    nome: b.nome,
    tipo: b.tipo ?? "imagem",
    imagem: b.imagem,
    icone: b.icone ?? "",
    cor: b.cor ?? "#173a4d",
    corFundo: b.corFundo ?? "transparent",
    tooltip: b.tooltip,
    link: b.link,
  };
}

const URL_VALIDA = /^https?:\/\/\S+$/i;
const COR = /^(#[0-9a-f]{6}|transparent)$/i;
type CamposBadge = Pick<DocBadge, "nome" | "imagem" | "tooltip" | "link"> & Required<Pick<DocBadge, "tipo" | "icone" | "cor" | "corFundo">>;

function validarBadge(corpo: Partial<DocBadge> | undefined): CamposBadge | string {
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const tipo = corpo?.tipo === "icone" ? "icone" : "imagem";
  const dados: CamposBadge = {
    nome: texto(corpo?.nome),
    tipo,
    imagem: tipo === "imagem" ? texto(corpo?.imagem) : "",
    icone: tipo === "icone" ? texto(corpo?.icone) : "",
    cor: texto(corpo?.cor) || "#173a4d",
    corFundo: texto(corpo?.corFundo) || "transparent",
    tooltip: texto(corpo?.tooltip),
    link: texto(corpo?.link),
  };
  if (!dados.nome) return "Informe o nome do badge.";
  if (tipo === "imagem" && !URL_VALIDA.test(dados.imagem)) return "Envie a imagem do badge.";
  if (tipo === "icone") {
    // SVG gerado pelo painel a partir da Lucide; recusa qualquer coisa que possa executar código.
    const svg = dados.icone;
    if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>$/i.test(svg) || svg.length > 20_000 || /<script|\son\w+\s*=|javascript:|<foreignObject/i.test(svg))
      return "Escolha o ícone do badge.";
    if (!COR.test(dados.cor) || !COR.test(dados.corFundo)) return "Cor inválida.";
  }
  if (dados.tooltip.length > 300) return "O texto do balão pode ter até 300 caracteres.";
  if (dados.link && !URL_VALIDA.test(dados.link)) return "O link precisa começar com http:// ou https://.";
  return dados;
}
