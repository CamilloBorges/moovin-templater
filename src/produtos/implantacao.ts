import { api } from "../api";

// Tela de Implantação: scripts da loja na Moovin (eco-store/script) e verificações do Templater.

export type ScriptMoovin = {
  id: string;
  name: string;
  loadPosition: "HEAD" | "FOOTER";
  page: string; // ALL, HOME, PRODUCT_LIST, … (o painel também oferece "Detalhe do produto")
  type: "URL" | "CONTENT";
  loadMethod: "DEFAULT" | "DEFER" | "ASYNC" | null;
  url: string | null;
  content: string | null;
  active: boolean;
};

export type Resumo = { produtos: number; badges: number; publicadoEm: string | null; produtoExemplo: string | null; lojaUrl: string; larguraMaxima: number | null };

export const NOME_SCRIPT = "Templater Bomgado (página de produto)";

export const urlDoScript = (origem: string, conta: string) => `${origem}/loja/${conta}/produto.js`;

// Script global (Configurações da loja): vale em todas as páginas do site.
export const NOME_SCRIPT_GLOBAL = "Templater Bomgado (configurações da loja)";
export const urlDoScriptGlobal = (origem: string, conta: string) => `${origem}/loja/${conta}/global.js`;

// Separa o script do Templater (tipo URL apontando para o nosso servidor) e os scripts antigos
// de página de produto (o Script_Produto V3, tipo roteiro, marcado com "bomgado-product").
export function analisarScripts(lista: ScriptMoovin[], url: string, urlGlobal = "") {
  const porUrl = (alvo: string) => (alvo ? lista.find((s) => s.type === "URL" && s.url?.split("?")[0] === alvo) ?? null : null);
  const templater = porUrl(url);
  const global = porUrl(urlGlobal);
  const antigos = lista.filter((s) => s.type === "CONTENT" && (s.content?.includes("bomgado-product") || /script_produto/i.test(s.name)));
  return { templater, global, antigos };
}

// Cadastro do script do Templater: sempre em todas as páginas. A Moovin é um app Next.js e troca
// de página sem recarregar; um script restrito à página de produto só entra quando o produto é
// aberto direto (vindo da home ou da listagem, a página precisava de um recarregamento). O script
// só age nas páginas de produto. No rodapé e com defer, para não atrasar a página.
export function novoScript(url: string) {
  return {
    name: NOME_SCRIPT,
    loadPosition: "FOOTER",
    page: "ALL",
    type: "URL",
    loadMethod: "DEFER",
    url,
    active: true,
  };
}

// Cadastro do script global: todas as páginas, no cabeçalho e sem defer, para o estilo entrar
// antes de a página aparecer (sem o site "pular" de largura).
export function novoScriptGlobal(url: string) {
  return { name: NOME_SCRIPT_GLOBAL, loadPosition: "HEAD", page: "ALL", type: "URL", loadMethod: "DEFAULT", url, active: true };
}

// Script cadastrado com página, posição ou carregamento diferentes do recomendado.
export function ajustesScriptGlobal(s: ScriptMoovin): string[] {
  const avisos: string[] = [];
  if (s.page !== "ALL") avisos.push("vale só em uma página (o certo é Todas)");
  if (s.loadPosition !== "HEAD") avisos.push("está no rodapé (o certo é Cabeçalho)");
  if (s.loadMethod === "DEFER" || s.loadMethod === "ASYNC") avisos.push(`carrega com ${s.loadMethod.toLowerCase()} (o certo é Padrão)`);
  return avisos;
}

// Script da página de produto cadastrado só em uma página: não carrega na navegação interna da loja.
export const restritoAUmaPagina = (s: ScriptMoovin) => s.page !== "ALL";

// Cache do navegador pedido para o script, em segundos (Cache-Control: max-age).
export function maxAge(cacheControl: string | null) {
  const m = /max-age=(\d+)/i.exec(cacheControl ?? "");
  return m ? Number(m[1]) : null;
}

export const carregarResumo = () => api<Resumo>("implantacao/resumo");
export const listarScripts = () => api<{ items: ScriptMoovin[] }>("moovin/eco-store/script").then((r) => r.items);
export const cadastrarScript = (corpo: ReturnType<typeof novoScript> | ReturnType<typeof novoScriptGlobal>) => api<ScriptMoovin>("moovin/eco-store/script", { corpo });
export const ativarScript = (id: string, active: boolean) => api<ScriptMoovin>(`moovin/eco-store/script/${id}`, { metodo: "PATCH", corpo: { active } });
export const usarEmTodasAsPaginas = (id: string) => api<ScriptMoovin>(`moovin/eco-store/script/${id}`, { metodo: "PATCH", corpo: { page: "ALL" } });
export const verificarPagina = (caminho: string) =>
  api<{ url: string; status: number; carregaTemplater: boolean; carregaGlobal: boolean; carregaV3: boolean }>(`implantacao/pagina?caminho=${encodeURIComponent(caminho)}`);
