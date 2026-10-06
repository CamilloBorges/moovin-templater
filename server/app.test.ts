import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

// Servidor de verdade (rotas + MongoDB em memória), sem abrir porta: app.inject.
const CONTA = "11111111-2222-3333-4444-555555555555";
let mongo: MongoMemoryServer;
let app: FastifyInstance;
let banco: typeof import("./banco");
let cookie: string;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongo.getUri();
  process.env.MONGO_BANCO = "teste";
  banco = await import("./banco");
  await banco.conectar();
  app = await (await import("./app")).criarApp({ log: false });
  // Sessão ativa e recém-validada: as rotas não precisam falar com a Moovin.
  await banco.sessoes().insertOne({
    _id: "sessao-teste",
    etapa: "ativa",
    tokenUsuario: "t",
    tokenConta: "t",
    conta: { id: CONTA, nome: "Loja teste" },
    usuario: { id: "u", nome: "Teste", email: "teste@bomgado.com" },
    validadaEm: new Date(),
    expiraEm: new Date(Date.now() + 3600_000),
  });
  const { COOKIE } = await import("./sessao");
  cookie = `${COOKIE}=sessao-teste`;
});

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe("rotas sem sessão", () => {
  it("recusam o painel com 401", async () => {
    expect((await app.inject({ url: "/api/complementos/p1" })).statusCode).toBe(401);
    expect((await app.inject({ method: "PUT", url: "/api/templates/publicado", payload: {} })).statusCode).toBe(401);
  });

  it("script da loja sem template publicado não mexe na página", async () => {
    const r = await app.inject({ url: `/loja/${CONTA}/produto.js` });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain("nenhum template publicado");
    expect(r.headers["access-control-allow-origin"]).toBe("*");
  });

  it("script da loja recusa id de loja inválido", async () => {
    expect((await app.inject({ url: "/loja/nao-e-uuid/produto.js" })).statusCode).toBe(404);
  });
});

describe("Complemento do produto", () => {
  const complemento = { resumo: "<p>R</p>", descricao: "<p>D</p>", conteudoComercial: null, abas: [] };

  it("valida o corpo ao gravar", async () => {
    const r = await app.inject({ method: "PUT", url: "/api/complementos/p1", headers: { cookie }, payload: { dados: complemento } });
    expect(r.statusCode).toBe(400);
  });

  it("grava pelo painel e a loja acha pelo SKU", async () => {
    expect((await app.inject({ url: `/loja/${CONTA}/complemento/13925` })).statusCode).toBe(404);

    const gravar = await app.inject({ method: "PUT", url: "/api/complementos/p1", headers: { cookie }, payload: { dados: complemento, skus: ["13925", "13926"] } });
    expect(gravar.statusCode).toBe(200);

    const painel = await app.inject({ url: "/api/complementos/p1", headers: { cookie } });
    expect(painel.json()).toMatchObject({ dados: complemento, atualizadoPor: "teste@bomgado.com" });

    const loja = await app.inject({ url: `/loja/${CONTA}/complemento/13926` });
    expect(loja.statusCode).toBe(200);
    expect(loja.json()).toEqual({ complemento, badges: [] });
  });

  it("não vaza o Complemento de outra loja", async () => {
    expect((await app.inject({ url: "/loja/99999999-2222-3333-4444-555555555555/complemento/13925" })).statusCode).toBe(404);
  });
});

describe("Templates", () => {
  it("recusa template sem content", async () => {
    const r = await app.inject({ method: "PUT", url: "/api/templates/rascunho", headers: { cookie }, payload: { dados: {} } });
    expect(r.statusCode).toBe(400);
  });

  it("publicado entra no script da loja", async () => {
    const dados = { root: { props: {} }, content: [] };
    expect((await app.inject({ method: "PUT", url: "/api/templates/publicado", headers: { cookie }, payload: { dados } })).statusCode).toBe(200);
    const r = await app.inject({ url: `/loja/${CONTA}/produto.js` });
    expect(r.body.startsWith("window.__TEMPLATER_BOMGADO__=")).toBe(true);
  });
});

describe("Badges", () => {
  const badge = { nome: "Sem glúten", imagem: "https://storage.moovin.store/x/sg.png", tooltip: "Produto sem glúten", link: "" };
  let id = "";

  it("valida nome, imagem, tamanho do balão e link", async () => {
    const enviar = (payload: object) => app.inject({ method: "POST", url: "/api/badges", headers: { cookie }, payload });
    expect((await enviar({ ...badge, nome: " " })).json().erro).toMatch(/nome/);
    expect((await enviar({ ...badge, imagem: "" })).json().erro).toMatch(/imagem/);
    expect((await enviar({ ...badge, tooltip: "x".repeat(301) })).statusCode).toBe(400);
    expect((await enviar({ ...badge, link: "javascript:alert(1)" })).json().erro).toMatch(/link/);
  });

  it("cadastra, lista e edita", async () => {
    const criado = await app.inject({ method: "POST", url: "/api/badges", headers: { cookie }, payload: badge });
    expect(criado.statusCode).toBe(200);
    id = criado.json().id;
    const lista = (await app.inject({ url: "/api/badges", headers: { cookie } })).json();
    expect(lista).toEqual([{ id, ...badge }]);
    const editado = await app.inject({ method: "PUT", url: `/api/badges/${id}`, headers: { cookie }, payload: { ...badge, link: "https://loja/sg" } });
    expect(editado.json().link).toBe("https://loja/sg");
  });

  it("a loja recebe os badges do produto já resolvidos, na ordem escolhida", async () => {
    const outro = (await app.inject({ method: "POST", url: "/api/badges", headers: { cookie }, payload: { ...badge, nome: "Grass fed" } })).json();
    const dados = { resumo: "", descricao: "", conteudoComercial: null, abas: [], badges: [outro.id, id, "apagado"] };
    await app.inject({ method: "PUT", url: "/api/complementos/p2", headers: { cookie }, payload: { dados, skus: ["777"] } });
    const loja = (await app.inject({ url: `/loja/${CONTA}/complemento/777` })).json();
    expect(loja.badges.map((b: { nome: string }) => b.nome)).toEqual(["Grass fed", "Sem glúten"]);
  });

  it("excluir tira o badge dos produtos", async () => {
    expect((await app.inject({ method: "DELETE", url: `/api/badges/${id}`, headers: { cookie } })).statusCode).toBe(200);
    const painel = (await app.inject({ url: "/api/complementos/p2", headers: { cookie } })).json();
    expect(painel.dados.badges).not.toContain(id);
    expect((await app.inject({ method: "DELETE", url: `/api/badges/${id}`, headers: { cookie } })).statusCode).toBe(404);
  });
});
