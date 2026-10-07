import { createServer, type Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

// Servidor de verdade (rotas + MongoDB em memória), sem abrir porta: app.inject.
const CONTA = "11111111-2222-3333-4444-555555555555";
let mongo: MongoMemoryServer;
let app: FastifyInstance;
let banco: typeof import("./banco");
let cookie: string;
// Loja falsa: a página /cubos/p carrega o script do Templater.
let loja: Server;
// rembg falso: devolve um PNG fixo e guarda o que recebeu.
let rembg: Server;
let rembgRecebeu = "";

beforeAll(async () => {
  rembg = createServer((req, res) => {
    let corpo = "";
    req.on("data", (c) => (corpo += c));
    req.on("end", () => {
      rembgRecebeu = `${req.method} ${req.url} ${corpo}`;
      res.writeHead(200, { "content-type": "image/png" }).end(Buffer.from("PNG-SEM-FUNDO"));
    });
  });
  await new Promise<void>((ok) => rembg.listen(0, "127.0.0.1", ok));
  process.env.REMBG_URL = `http://127.0.0.1:${(rembg.address() as { port: number }).port}`;
  loja = createServer((req, res) => {
    if (req.url === "/cubos/p") res.writeHead(200).end(`<html><script src="https://templater.bomgado.net/loja/${CONTA}/produto.js"></script></html>`);
    else res.writeHead(404).end("não achou");
  });
  await new Promise<void>((ok) => loja.listen(0, "127.0.0.1", ok));
  process.env.LOJA_URL = `http://127.0.0.1:${(loja.address() as { port: number }).port}`;
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
  rembg?.close();
  loja?.close();
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
    expect(lista).toEqual([{ id, ...badge, tipo: "imagem", icone: "", cor: "#173a4d", corFundo: "transparent" }]);
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

describe("Editor de imagem", () => {
  it("informa que a remoção de fundo por IA está disponível", async () => {
    const r = (await app.inject({ url: "/api/imagem/recursos", headers: { cookie } })).json();
    expect(r).toMatchObject({ removerFundoIa: true, modeloPadrao: "u2net" });
    expect(r.modelos.map((m: { id: string }) => m.id)).toEqual(["u2net", "isnet-general-use"]);
  });

  it("repassa a imagem ao rembg e devolve o PNG sem fundo", async () => {
    const imagem = `data:image/png;base64,${Buffer.from("ORIGINAL").toString("base64")}`;
    const r = await app.inject({ method: "POST", url: "/api/imagem/remover-fundo", headers: { cookie }, payload: { imagem } });
    expect(r.statusCode).toBe(200);
    expect(r.json().imagem).toBe(`data:image/png;base64,${Buffer.from("PNG-SEM-FUNDO").toString("base64")}`);
    expect(rembgRecebeu).toContain("POST /api/remove");
    expect(rembgRecebeu).toContain("ORIGINAL");
    expect(rembgRecebeu).toContain("u2net"); // padrão
  });

  it("usa o modelo escolhido, se for um dos oferecidos", async () => {
    const imagem = `data:image/png;base64,${Buffer.from("X").toString("base64")}`;
    await app.inject({ method: "POST", url: "/api/imagem/remover-fundo", headers: { cookie }, payload: { imagem, modelo: "isnet-general-use" } });
    expect(rembgRecebeu).toContain("isnet-general-use");
    await app.inject({ method: "POST", url: "/api/imagem/remover-fundo", headers: { cookie }, payload: { imagem, modelo: "bria-rmbg" } });
    expect(rembgRecebeu).not.toContain("bria-rmbg"); // fora da lista: volta ao padrão
    expect(rembgRecebeu).toContain("u2net");
  });

  it("recusa o que não é imagem em data URL", async () => {
    const r = await app.inject({ method: "POST", url: "/api/imagem/remover-fundo", headers: { cookie }, payload: { imagem: "https://x/y.png" } });
    expect(r.statusCode).toBe(400);
  });

  it("só baixa imagens do armazenamento da Moovin", async () => {
    const r = await app.inject({ url: "/api/imagem/baixar?url=http://169.254.169.254/latest", headers: { cookie } });
    expect(r.statusCode).toBe(400);
  });
});

describe("Badges com ícone", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1"/></svg>';
  const enviar = (payload: object) => app.inject({ method: "POST", url: "/api/badges", headers: { cookie }, payload });

  it("cadastra ícone sem imagem, com cor e fundo", async () => {
    const r = await enviar({ nome: "Fresco", tipo: "icone", icone: svg, cor: "#117950", corFundo: "transparent", tooltip: "", link: "" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ tipo: "icone", icone: svg, imagem: "", cor: "#117950", corFundo: "transparent" });
  });

  it("recusa SVG com script, evento ou javascript:", async () => {
    for (const icone of ['<svg><script>x</script></svg>', '<svg onload="x()"></svg>', '<svg><a href="javascript:x"/></svg>', "<div></div>"]) {
      expect((await enviar({ nome: "X", tipo: "icone", icone })).statusCode).toBe(400);
    }
  });

  it("recusa cor fora do formato", async () => {
    expect((await enviar({ nome: "X", tipo: "icone", icone: svg, cor: "red;background:url(x)" })).statusCode).toBe(400);
  });
});

describe("Implantação", () => {
  it("resume o que já está pronto no Templater", async () => {
    const r = (await app.inject({ url: "/api/implantacao/resumo", headers: { cookie } })).json();
    expect(r.produtos).toBeGreaterThan(0);
    expect(r.publicadoEm).not.toBeNull();
    expect(r.produtoExemplo).toBeTruthy();
    expect(r.lojaUrl).toBe(process.env.LOJA_URL);
  });

  it("verifica se a página da loja carrega o script desta loja", async () => {
    const r = (await app.inject({ url: "/api/implantacao/pagina?caminho=/cubos/p", headers: { cookie } })).json();
    expect(r).toMatchObject({ status: 200, carregaTemplater: true, carregaV3: false });
    const ausente = (await app.inject({ url: "/api/implantacao/pagina?caminho=/outro/p", headers: { cookie } })).json();
    expect(ausente).toMatchObject({ status: 404, carregaTemplater: false });
  });

  it("só abre caminhos da própria loja", async () => {
    for (const caminho of ["https://outro.site/x", "//outro.site/x", "/../etc", "x/p"]) {
      expect((await app.inject({ url: `/api/implantacao/pagina?caminho=${encodeURIComponent(caminho)}`, headers: { cookie } })).statusCode).toBe(400);
    }
  });
});

describe("Abas e modelos de cadastro", () => {
  const enviar = (metodo: "POST" | "PUT" | "DELETE", url: string, payload?: object) =>
    app.inject({ method: metodo, url: `/api/${url}`, headers: { cookie }, ...(payload ? { payload } : {}) });
  const listar = async (url: string) => (await app.inject({ url: `/api/${url}`, headers: { cookie } })).json();

  it("cadastra abas, recusa título vazio ou repetido", async () => {
    expect((await enviar("POST", "tipos-aba", { titulo: " " })).statusCode).toBe(400);
    const preparo = (await enviar("POST", "tipos-aba", { titulo: "Preparo", conteudoModelo: "<p>Modo:</p>", obrigatoria: true, instrucao: "Tempo e método" })).json();
    expect(preparo).toMatchObject({ titulo: "Preparo", obrigatoria: true, instrucao: "Tempo e método" });
    expect((await enviar("POST", "tipos-aba", { titulo: "prepáro" })).statusCode).toBe(409);
  });

  it("o primeiro modelo nasce padrão, marcar outro desmarca, e ids desconhecidos ou repetidos saem da sequência", async () => {
    const [preparo] = await listar("tipos-aba");
    const conservacao = (await enviar("POST", "tipos-aba", { titulo: "Conservação" })).json();
    const carnes = (await enviar("POST", "modelos", { nome: "Carnes", abas: [conservacao.id, "nao-existe", preparo.id, conservacao.id] })).json();
    expect(carnes).toMatchObject({ padrao: true, abas: [conservacao.id, preparo.id] });

    const bebidas = (await enviar("POST", "modelos", { nome: "Bebidas", padrao: true, abas: [preparo.id] })).json();
    expect(bebidas.padrao).toBe(true);
    const lista = await listar("modelos");
    expect(lista.filter((m: { padrao: boolean }) => m.padrao).map((m: { nome: string }) => m.nome)).toEqual(["Bebidas"]);

    // Excluir o padrão passa o padrão para o mais antigo.
    expect((await enviar("DELETE", `modelos/${bebidas.id}`)).statusCode).toBe(200);
    expect((await listar("modelos")).map((m: { nome: string; padrao: boolean }) => [m.nome, m.padrao])).toEqual([["Carnes", true]]);
  });

  it("a loja recebe o título atual do cadastro; excluir a aba a solta dos produtos e dos modelos", async () => {
    const [conservacao] = (await listar("tipos-aba")).filter((t: { titulo: string }) => t.titulo === "Conservação");
    const dados = { resumo: "", descricao: "", conteudoComercial: null, badges: [], abas: [{ tipo: conservacao.id, titulo: "Conservação", conteudo: "<p>0 a 4 °C</p>" }, { titulo: "Avulsa", conteudo: "<p>x</p>" }] };
    await enviar("PUT", "complementos/p-abas", { dados, skus: ["ABA1"] });

    await enviar("PUT", `tipos-aba/${conservacao.id}`, { ...conservacao, titulo: "Como conservar" });
    const loja = (await app.inject({ url: `/loja/${CONTA}/complemento/ABA1` })).json();
    expect(loja.complemento.abas.map((a: { titulo: string }) => a.titulo)).toEqual(["Como conservar", "Avulsa"]);

    expect((await enviar("DELETE", `tipos-aba/${conservacao.id}`)).statusCode).toBe(200);
    const painel = (await app.inject({ url: "/api/complementos/p-abas", headers: { cookie } })).json();
    expect(painel.dados.abas[0]).toEqual({ titulo: "Como conservar", conteudo: "<p>0 a 4 °C</p>" });
    const [carnes] = await listar("modelos");
    expect(carnes.abas).not.toContain(conservacao.id);
  });
});
