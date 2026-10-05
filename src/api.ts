// Chamadas do navegador ao nosso servidor (/api). O cookie de sessão vai sozinho (HttpOnly).
// Resposta 401 = sessão inválida: o painel volta para a tela de login.

export type Sessao = {
  etapa: "login" | "2fa" | "conta" | "ativa";
  usuario?: { id: string; nome: string; email: string } | null;
  conta?: { id: string; nome: string } | null;
  contas?: Array<{ id: string; nome: string }>;
};

export class ErroApi extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

export const EVENTO_SESSAO_EXPIRADA = "sessao-expirada";

export async function api<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
  const resposta = await fetch(`/api/${caminho}`, {
    method: opcoes.metodo ?? (opcoes.corpo === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers: opcoes.corpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });
  const texto = await resposta.text();
  let dados: unknown = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { dados = texto; }
  if (!resposta.ok) {
    if (resposta.status === 401 && !caminho.startsWith("sessao")) window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
    const mensagem = typeof dados === "object" && dados && "erro" in dados ? String((dados as { erro: unknown }).erro) : `Erro ${resposta.status}`;
    throw new ErroApi(resposta.status, mensagem);
  }
  return dados as T;
}
