import { config } from "./config";

// Chamadas à API da Moovin com o login do usuário (o mesmo fluxo da tela id.moovin.app):
// 1. POST iam-manager/authentication (e-mail e senha, Basic) → token do usuário, ou pedido de 2FA
// 2. POST iam-manager/authentication/2fa (código de 6 dígitos), se a conta exigir
// 3. GET  iam-manager/me → lojas (accounts) do usuário
// 4. POST iam-manager/authorization (1eg-Account-Id) → token da loja, usado em X-Authorization

export class ErroMoovin extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

async function requisitar(caminho: string, opcoes: RequestInit) {
  const resposta = await fetch(`${config.moovinApi}/${caminho}`, opcoes);
  const texto = await resposta.text();
  let corpo: unknown = texto;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { /* resposta não-JSON */ }
  if (!resposta.ok) {
    const mensagem = typeof corpo === "object" && corpo && "message" in corpo ? String((corpo as { message: unknown }).message) : resposta.statusText;
    throw new ErroMoovin(resposta.status, mensagem);
  }
  return corpo as Record<string, unknown>;
}

const MANAGER = { "1eg-User-RoleType": "MANAGER" };

export async function autenticar(email: string, senha: string) {
  const basico = Buffer.from(`${email}:${senha}`).toString("base64");
  const r = await requisitar("iam-manager/authentication", {
    method: "POST",
    headers: { ...MANAGER, Authorization: `Basic ${basico}`, "Content-Type": "application/json" },
    body: "{}",
  });
  return { precisa2fa: r.type === "TWO_FACTOR_AUTH", token: String(r.token ?? "") };
}

export async function autenticar2fa(token: string, codigo: string) {
  const r = await requisitar("iam-manager/authentication/2fa", {
    method: "POST",
    headers: { ...MANAGER, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sixDigitsCode: codigo }),
  });
  return String(r.token ?? "");
}

export async function contasDoUsuario(token: string) {
  const r = await requisitar("iam-manager/me", { headers: { "X-Authorization": `Bearer ${token}` } });
  const contas = Array.isArray(r.accounts) ? (r.accounts as Array<Record<string, unknown>>) : [];
  return contas.map((c) => ({ id: String(c.id ?? c.accountId ?? ""), nome: String(c.name ?? "") })).filter((c) => c.id);
}

export async function autorizarConta(token: string, contaId: string) {
  const r = await requisitar("iam-manager/authorization", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "1eg-Account-Id": contaId, "Content-Type": "application/json" },
    body: "{}",
  });
  return String(r.token ?? "");
}

// Lê os dados (não secretos) do token da loja: conta e usuário. Não valida a assinatura;
// quem valida é a Moovin, a cada chamada.
export function lerToken(token: string) {
  const parte = token.split(".")[1] ?? "";
  const dados = JSON.parse(Buffer.from(parte, "base64url").toString("utf8")) as {
    account?: { id?: string; name?: string };
    user?: { id?: string; name?: string; email?: string };
  };
  return {
    conta: { id: String(dados.account?.id ?? ""), nome: String(dados.account?.name ?? "") },
    usuario: { id: String(dados.user?.id ?? ""), nome: String(dados.user?.name ?? ""), email: String(dados.user?.email ?? "") },
  };
}

// Repassa uma chamada do painel para a API, com o token da loja.
export function repassar(token: string, metodo: string, caminho: string, corpo?: Buffer, tipo?: string) {
  return fetch(`${config.moovinApi}/${caminho}`, {
    method: metodo,
    headers: { "X-Authorization": `Bearer ${token}`, Accept: "application/json", ...(tipo ? { "Content-Type": tipo } : {}) },
    body: corpo && corpo.length ? new Uint8Array(corpo) : undefined,
  });
}
