import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { complementos, mapas, type DocCorte, type DocMapa } from "./banco";
import { exigirSessao } from "./sessao";

// Cadastro de mapas de cortes (tela "Mapas de cortes" do painel) e o Mapa de Corte que a loja
// desenha no fim da galeria de cada produto.

const publico = (m: DocMapa) => ({ id: m._id, nome: m.nome, imagem: m.imagem, largura: m.largura, altura: m.altura, cortes: m.cortes });

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// HTTPS; em desenvolvimento, também a imagem do próprio Templater local (o Mapa Bovino padrão).
const URL_IMAGEM = /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/)\S+$/i;

type CamposMapa = Pick<DocMapa, "nome" | "imagem" | "largura" | "altura" | "cortes">;

function validarCorte(c: unknown, i: number): DocCorte | string {
  const corte = (c ?? {}) as Partial<DocCorte>;
  const nome = texto(corte.nome, 80);
  if (!nome) return `Corte ${i + 1}: informe o nome.`;
  const numero = Number(corte.numero);
  if (!Number.isInteger(numero) || numero < 0 || numero > 999) return `Corte "${nome}": número inválido.`;
  const descricao = texto(corte.descricao, 400);
  const detalhes = typeof corte.detalhes === "string" ? corte.detalhes : "";
  if (detalhes.length > 50_000) return `Corte "${nome}": as informações detalhadas estão grandes demais.`;
  const pontos = Array.isArray(corte.regiao) ? corte.regiao : [];
  if (pontos.length > 200) return `Corte "${nome}": contorno com pontos demais.`;
  const regiao: [number, number][] = [];
  for (const p of pontos) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every((v) => typeof v === "number" && v >= 0 && v <= 1)) return `Corte "${nome}": contorno inválido.`;
    regiao.push([Math.round(p[0] * 10000) / 10000, Math.round(p[1] * 10000) / 10000]);
  }
  if (regiao.length > 0 && regiao.length < 3) return `Corte "${nome}": o contorno precisa de pelo menos 3 pontos.`;
  return { id: typeof corte.id === "string" && corte.id ? corte.id : randomUUID(), numero, nome, descricao, detalhes, regiao };
}

function validarMapa(corpo: Partial<CamposMapa> | undefined): CamposMapa | string {
  const nome = texto(corpo?.nome, 60);
  if (!nome) return "Informe o nome do mapa (ex.: Bovino).";
  const imagem = texto(corpo?.imagem, 1000);
  if (!URL_IMAGEM.test(imagem)) return "Envie a imagem do animal.";
  const largura = Number(corpo?.largura);
  const altura = Number(corpo?.altura);
  if (!(largura > 0 && altura > 0)) return "Tamanho da imagem inválido; envie a imagem de novo.";
  const lista = Array.isArray(corpo?.cortes) ? corpo.cortes : [];
  if (lista.length > 300) return "Cortes demais neste mapa.";
  const cortes: DocCorte[] = [];
  for (const [i, c] of lista.entries()) {
    const corte = validarCorte(c, i);
    if (typeof corte === "string") return corte;
    if (cortes.some((x) => x.id === corte.id)) corte.id = randomUUID();
    cortes.push(corte);
  }
  return { nome, imagem, largura, altura, cortes };
}

// Mapa de Corte do produto para a loja: só o necessário para desenhar a imagem.
// Null se o produto não usa, ou se o mapa, o corte ou o contorno não existem mais.
export async function resolverMapaCorteLoja(conta: string, dados: unknown) {
  const ref = (dados as { mapaCorte?: { mapa?: unknown; corte?: unknown; descricao?: unknown } | null } | null)?.mapaCorte;
  if (!ref || typeof ref.mapa !== "string" || typeof ref.corte !== "string") return null;
  const mapa = await mapas().findOne({ _id: ref.mapa, conta });
  const corte = mapa?.cortes.find((c) => c.id === ref.corte);
  if (!mapa || !corte || corte.regiao.length < 3) return null;
  const descricao = typeof ref.descricao === "string" && ref.descricao.trim() ? ref.descricao.trim() : corte.descricao;
  return { imagem: mapa.imagem, largura: mapa.largura, altura: mapa.altura, regiao: corte.regiao, numero: corte.numero, corte: corte.nome, descricao };
}

export async function rotasMapas(app: FastifyInstance) {
  const autor = (pedido: { sessao?: { usuario?: { email: string } } }) => pedido.sessao?.usuario?.email ?? "";

  app.get("/api/mapas", { preHandler: exigirSessao }, async (pedido) => {
    const lista = await mapas().find({ conta: pedido.sessao!.conta!.id }).sort({ nome: 1 }).toArray();
    return lista.map(publico);
  });

  app.post<{ Body: Partial<CamposMapa> }>("/api/mapas", { preHandler: exigirSessao, bodyLimit: 5 * 1024 * 1024 }, async (pedido, resposta) => {
    const dados = validarMapa(pedido.body);
    if (typeof dados === "string") return resposta.code(400).send({ erro: dados });
    const doc: DocMapa = { _id: randomUUID(), conta: pedido.sessao!.conta!.id, ...dados, atualizadoEm: new Date(), atualizadoPor: autor(pedido) };
    await mapas().insertOne(doc);
    return publico(doc);
  });

  app.put<{ Params: { id: string }; Body: Partial<CamposMapa> }>("/api/mapas/:id", { preHandler: exigirSessao, bodyLimit: 5 * 1024 * 1024 }, async (pedido, resposta) => {
    const dados = validarMapa(pedido.body);
    if (typeof dados === "string") return resposta.code(400).send({ erro: dados });
    const r = await mapas().findOneAndUpdate(
      { _id: pedido.params.id, conta: pedido.sessao!.conta!.id },
      { $set: { ...dados, atualizadoEm: new Date(), atualizadoPor: autor(pedido) } },
      { returnDocument: "after" },
    );
    return r ? publico(r) : resposta.code(404).send({ erro: "Mapa não encontrado." });
  });

  // Excluir o mapa desliga o Mapa de Corte dos produtos que o usavam.
  app.delete<{ Params: { id: string } }>("/api/mapas/:id", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const conta = pedido.sessao!.conta!.id;
    const r = await mapas().deleteOne({ _id: pedido.params.id, conta });
    if (!r.deletedCount) return resposta.code(404).send({ erro: "Mapa não encontrado." });
    await complementos().updateMany({ conta, "dados.mapaCorte.mapa": pedido.params.id }, { $set: { "dados.mapaCorte": null } } as never);
    return { ok: true };
  });
}
