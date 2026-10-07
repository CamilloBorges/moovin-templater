import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { complementos, modelos, tiposAba, type DocModelo, type DocTipoAba } from "./banco";
import { exigirSessao } from "./sessao";

// Cadastro de abas e modelos de cadastro (tela "Abas e modelos" do painel).

type AbaProduto = { titulo?: unknown; conteudo?: unknown; tipo?: unknown };

// Título das abas do cadastro como está no cadastro (para a loja); as avulsas ficam como estão.
export async function resolverTitulosAbas(conta: string, dados: unknown) {
  const abas = (dados as { abas?: AbaProduto[] } | null)?.abas;
  if (!Array.isArray(abas) || !abas.some((a) => typeof a?.tipo === "string")) return dados;
  const ids = abas.map((a) => a.tipo).filter((t): t is string => typeof t === "string");
  const titulos = new Map((await tiposAba().find({ conta, _id: { $in: ids } }).toArray()).map((t) => [t._id, t.titulo]));
  return { ...(dados as object), abas: abas.map((a) => (typeof a.tipo === "string" && titulos.has(a.tipo) ? { ...a, titulo: titulos.get(a.tipo) } : a)) };
}

const publicoTipo = (t: DocTipoAba) => ({ id: t._id, titulo: t.titulo, conteudoModelo: t.conteudoModelo, obrigatoria: t.obrigatoria, instrucao: t.instrucao });
const publicoModelo = (m: DocModelo) => ({ id: m._id, nome: m.nome, padrao: m.padrao, abas: m.abas });

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type CamposTipo = Pick<DocTipoAba, "titulo" | "conteudoModelo" | "obrigatoria" | "instrucao">;

function validarTipo(corpo: Partial<CamposTipo> | undefined): CamposTipo | string {
  const dados: CamposTipo = {
    titulo: texto(corpo?.titulo),
    conteudoModelo: typeof corpo?.conteudoModelo === "string" ? corpo.conteudoModelo : "",
    obrigatoria: corpo?.obrigatoria === true,
    instrucao: texto(corpo?.instrucao),
  };
  if (!dados.titulo) return "Informe o título da aba.";
  if (dados.titulo.length > 60) return "O título pode ter até 60 caracteres.";
  if (dados.instrucao.length > 300) return "A instrução pode ter até 300 caracteres.";
  if (dados.conteudoModelo.length > 50_000) return "O conteúdo modelo está grande demais.";
  return dados;
}

export async function rotasAbas(app: FastifyInstance) {
  const autor = (pedido: { sessao?: { usuario?: { email: string } } }) => pedido.sessao?.usuario?.email ?? "";

  // Título repetido confunde o cadastro do produto (e o "Aplicar modelo" casa abas avulsas pelo título).
  async function tituloEmUso(conta: string, titulo: string, exceto?: string) {
    const lista = await tiposAba().find({ conta }, { projection: { titulo: 1 } }).toArray();
    return lista.some((t) => t._id !== exceto && semAcento(t.titulo) === semAcento(titulo));
  }

  app.get("/api/tipos-aba", { preHandler: exigirSessao }, async (pedido) => {
    const lista = await tiposAba().find({ conta: pedido.sessao!.conta!.id }).sort({ titulo: 1 }).toArray();
    return lista.map(publicoTipo);
  });

  app.post<{ Body: Partial<CamposTipo> }>("/api/tipos-aba", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const dados = validarTipo(pedido.body);
    if (typeof dados === "string") return resposta.code(400).send({ erro: dados });
    const conta = pedido.sessao!.conta!.id;
    if (await tituloEmUso(conta, dados.titulo)) return resposta.code(409).send({ erro: `Já existe uma aba "${dados.titulo}".` });
    const doc: DocTipoAba = { _id: randomUUID(), conta, ...dados, atualizadoEm: new Date(), atualizadoPor: autor(pedido) };
    await tiposAba().insertOne(doc);
    return publicoTipo(doc);
  });

  app.put<{ Params: { id: string }; Body: Partial<CamposTipo> }>("/api/tipos-aba/:id", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const dados = validarTipo(pedido.body);
    if (typeof dados === "string") return resposta.code(400).send({ erro: dados });
    const conta = pedido.sessao!.conta!.id;
    if (await tituloEmUso(conta, dados.titulo, pedido.params.id)) return resposta.code(409).send({ erro: `Já existe uma aba "${dados.titulo}".` });
    const r = await tiposAba().findOneAndUpdate(
      { _id: pedido.params.id, conta },
      { $set: { ...dados, atualizadoEm: new Date(), atualizadoPor: autor(pedido) } },
      { returnDocument: "after" },
    );
    return r ? publicoTipo(r) : resposta.code(404).send({ erro: "Aba não encontrada." });
  });

  // Excluir tira a aba dos modelos; nos produtos, ela vira avulsa (com o título e o conteúdo que tinha).
  app.delete<{ Params: { id: string } }>("/api/tipos-aba/:id", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const conta = pedido.sessao!.conta!.id;
    const id = pedido.params.id;
    const tipo = await tiposAba().findOneAndDelete({ _id: id, conta });
    if (!tipo) return resposta.code(404).send({ erro: "Aba não encontrada." });
    await modelos().updateMany({ conta, abas: id }, { $pull: { abas: id } });
    await complementos().updateMany(
      { conta, "dados.abas.tipo": id },
      { $set: { "dados.abas.$[a].titulo": tipo.titulo }, $unset: { "dados.abas.$[a].tipo": "" } } as never,
      { arrayFilters: [{ "a.tipo": id }] },
    );
    return { ok: true };
  });

  app.get("/api/modelos", { preHandler: exigirSessao }, async (pedido) => {
    const lista = await modelos().find({ conta: pedido.sessao!.conta!.id }).sort({ nome: 1 }).toArray();
    return lista.map(publicoModelo);
  });

  async function validarModelo(conta: string, corpo: Partial<Pick<DocModelo, "nome" | "padrao" | "abas">> | undefined) {
    const nome = texto(corpo?.nome);
    if (!nome) return "Informe o nome do modelo.";
    if (nome.length > 60) return "O nome pode ter até 60 caracteres.";
    const pedidas = Array.isArray(corpo?.abas) ? corpo.abas.filter((a): a is string => typeof a === "string") : [];
    const existentes = new Set((await tiposAba().find({ conta, _id: { $in: pedidas } }, { projection: { _id: 1 } }).toArray()).map((t) => t._id));
    const abas = [...new Set(pedidas)].filter((a) => existentes.has(a));
    return { nome, padrao: corpo?.padrao === true, abas };
  }

  // Só um modelo é o padrão: marcar um desmarca os outros. O primeiro modelo da loja já nasce padrão.
  async function garantirPadrao(conta: string, escolhido?: string) {
    if (escolhido) {
      await modelos().updateMany({ conta, _id: { $ne: escolhido } }, { $set: { padrao: false } });
      return;
    }
    if (await modelos().countDocuments({ conta, padrao: true })) return;
    const primeiro = await modelos().findOne({ conta }, { sort: { criadoEm: 1 } });
    if (primeiro) await modelos().updateOne({ _id: primeiro._id }, { $set: { padrao: true } });
  }

  app.post<{ Body: Partial<DocModelo> }>("/api/modelos", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const conta = pedido.sessao!.conta!.id;
    const dados = await validarModelo(conta, pedido.body);
    if (typeof dados === "string") return resposta.code(400).send({ erro: dados });
    const agora = new Date();
    const doc: DocModelo = { _id: randomUUID(), conta, ...dados, criadoEm: agora, atualizadoEm: agora, atualizadoPor: autor(pedido) };
    await modelos().insertOne(doc);
    await garantirPadrao(conta, doc.padrao ? doc._id : undefined);
    return publicoModelo((await modelos().findOne({ _id: doc._id }))!);
  });

  app.put<{ Params: { id: string }; Body: Partial<DocModelo> }>("/api/modelos/:id", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const conta = pedido.sessao!.conta!.id;
    const dados = await validarModelo(conta, pedido.body);
    if (typeof dados === "string") return resposta.code(400).send({ erro: dados });
    const r = await modelos().findOneAndUpdate(
      { _id: pedido.params.id, conta },
      { $set: { ...dados, atualizadoEm: new Date(), atualizadoPor: autor(pedido) } },
      { returnDocument: "after" },
    );
    if (!r) return resposta.code(404).send({ erro: "Modelo não encontrado." });
    await garantirPadrao(conta, r.padrao ? r._id : undefined);
    return publicoModelo((await modelos().findOne({ _id: r._id }))!);
  });

  // Excluir o padrão passa o padrão para o modelo mais antigo que sobrar.
  app.delete<{ Params: { id: string } }>("/api/modelos/:id", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const conta = pedido.sessao!.conta!.id;
    const r = await modelos().deleteOne({ _id: pedido.params.id, conta });
    if (!r.deletedCount) return resposta.code(404).send({ erro: "Modelo não encontrado." });
    await garantirPadrao(conta);
    return { ok: true };
  });
}
