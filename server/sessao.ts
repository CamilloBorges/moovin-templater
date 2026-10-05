import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sessoes, type Sessao } from "./banco";
import { config } from "./config";
import { autenticar, autenticar2fa, autorizarConta, contasDoUsuario, ErroMoovin, lerToken, repassar } from "./moovin";

// Sessão do painel: o login é o da Moovin (e-mail e senha do usuário). Os tokens da Moovin
// ficam só no servidor; o navegador recebe um cookie HttpOnly com o id da sessão.

export const COOKIE = "templater_sessao";
const REVALIDAR_MS = 5 * 60 * 1000;

const expiracao = () => new Date(Date.now() + config.sessaoHoras * 3600 * 1000);

function gravarCookie(resposta: FastifyReply, id: string) {
  resposta.setCookie(COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSeguro,
    maxAge: config.sessaoHoras * 3600,
  });
}

async function sessaoDe(pedido: FastifyRequest) {
  const id = pedido.cookies[COOKIE];
  return id ? sessoes().findOne({ _id: id, expiraEm: { $gt: new Date() } }) : null;
}

// O que o navegador pode ver da sessão (nunca os tokens).
function publica(s: Sessao | null) {
  if (!s) return { etapa: "login" as const };
  return { etapa: s.etapa, usuario: s.usuario ?? null, conta: s.conta ?? null, contas: s.etapa === "conta" ? s.contas ?? [] : undefined };
}

// Depois do login (ou do 2FA): lista as lojas; com uma só, já entra nela.
async function aposAutenticar(id: string, tokenUsuario: string) {
  const contas = await contasDoUsuario(tokenUsuario);
  if (contas.length === 1) return entrarNaConta(id, tokenUsuario, contas[0].id, contas);
  await sessoes().updateOne({ _id: id }, { $set: { etapa: "conta", tokenUsuario, contas, expiraEm: expiracao() } }, { upsert: true });
  return sessoes().findOne({ _id: id });
}

async function entrarNaConta(id: string, tokenUsuario: string, contaId: string, contas?: Sessao["contas"]) {
  const tokenConta = await autorizarConta(tokenUsuario, contaId);
  const { conta, usuario } = lerToken(tokenConta);
  await sessoes().updateOne(
    { _id: id },
    { $set: { etapa: "ativa", tokenUsuario, tokenConta, conta, usuario, contas, validadaEm: new Date(), expiraEm: expiracao() } },
    { upsert: true },
  );
  return sessoes().findOne({ _id: id });
}

function erroDeLogin(resposta: FastifyReply, erro: unknown) {
  // A Moovin responde 404 para e-mail inexistente e 400/401/403 para senha ou código errados.
  if (erro instanceof ErroMoovin && erro.status < 500) {
    return resposta.code(401).send({ erro: "Não foi possível entrar. Confira o e-mail, a senha ou o código." });
  }
  resposta.log.error(erro);
  return resposta.code(502).send({ erro: "A Moovin não respondeu. Tente de novo em instantes." });
}

// Exige sessão ativa. Revalida o token na Moovin de tempos em tempos (ele não tem validade
// própria; quem decide se ainda vale é a Moovin).
export async function exigirSessao(pedido: FastifyRequest, resposta: FastifyReply) {
  const s = await sessaoDe(pedido);
  if (!s || s.etapa !== "ativa" || !s.tokenConta || !s.conta) return resposta.code(401).send({ erro: "Sessão inválida. Entre de novo." });
  if (!s.validadaEm || Date.now() - s.validadaEm.getTime() > REVALIDAR_MS) {
    const teste = await repassar(s.tokenConta, "GET", "oms-product/product?limit=1");
    if (teste.status === 401 || teste.status === 403) {
      await sessoes().deleteOne({ _id: s._id });
      return resposta.code(401).send({ erro: "A sessão na Moovin expirou. Entre de novo." });
    }
    s.validadaEm = new Date();
  }
  s.expiraEm = expiracao(); // sessão deslizante
  await sessoes().updateOne({ _id: s._id }, { $set: { validadaEm: s.validadaEm, expiraEm: s.expiraEm } });
  pedido.sessao = s;
}

declare module "fastify" {
  interface FastifyRequest {
    sessao?: Sessao;
  }
}

export async function rotasSessao(app: FastifyInstance) {
  app.get("/api/sessao", async (pedido) => publica(await sessaoDe(pedido)));

  app.post<{ Body: { email?: string; senha?: string } }>("/api/sessao/login", async (pedido, resposta) => {
    const { email = "", senha = "" } = pedido.body ?? {};
    if (!email.trim() || !senha) return resposta.code(400).send({ erro: "Informe o e-mail e a senha." });
    try {
      const { precisa2fa, token } = await autenticar(email.trim(), senha);
      const id = randomBytes(32).toString("hex");
      gravarCookie(resposta, id);
      if (precisa2fa) {
        await sessoes().insertOne({ _id: id, etapa: "2fa", tokenUsuario: token, expiraEm: new Date(Date.now() + 10 * 60 * 1000) });
        return publica(await sessoes().findOne({ _id: id }));
      }
      return publica(await aposAutenticar(id, token));
    } catch (erro) {
      return erroDeLogin(resposta, erro);
    }
  });

  app.post<{ Body: { codigo?: string } }>("/api/sessao/2fa", async (pedido, resposta) => {
    const s = await sessaoDe(pedido);
    const codigo = String(pedido.body?.codigo ?? "").replace(/\D/g, "");
    if (!s || s.etapa !== "2fa") return resposta.code(401).send({ erro: "Comece pelo login." });
    if (codigo.length !== 6) return resposta.code(400).send({ erro: "O código tem 6 dígitos." });
    try {
      return publica(await aposAutenticar(s._id, await autenticar2fa(s.tokenUsuario, codigo)));
    } catch (erro) {
      return erroDeLogin(resposta, erro);
    }
  });

  app.post<{ Body: { contaId?: string } }>("/api/sessao/conta", async (pedido, resposta) => {
    const s = await sessaoDe(pedido);
    const contaId = String(pedido.body?.contaId ?? "");
    if (!s || (s.etapa !== "conta" && s.etapa !== "ativa")) return resposta.code(401).send({ erro: "Comece pelo login." });
    if (!s.contas?.some((c) => c.id === contaId)) return resposta.code(400).send({ erro: "Loja não encontrada para este usuário." });
    try {
      return publica(await entrarNaConta(s._id, s.tokenUsuario, contaId, s.contas));
    } catch (erro) {
      return erroDeLogin(resposta, erro);
    }
  });

  app.post("/api/sessao/sair", async (pedido, resposta) => {
    const id = pedido.cookies[COOKIE];
    if (id) await sessoes().deleteOne({ _id: id });
    resposta.clearCookie(COOKIE, { path: "/" });
    return { etapa: "login" };
  });
}
