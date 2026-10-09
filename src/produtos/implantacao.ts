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

export type Resumo = { produtos: number; badges: number; publicadoEm: string | null; produtoExemplo: string | null; lojaUrl: string };

export const NOME_SCRIPT = "Templater Bomgado (página de produto)";

export const urlDoScript = (origem: string, conta: string) => `${origem}/loja/${conta}/produto.js`;

// Separa o script do Templater (tipo URL apontando para o nosso servidor) e os scripts antigos
// de página de produto (o Script_Produto V3, tipo roteiro, marcado com "bomgado-product").
export function analisarScripts(lista: ScriptMoovin[], url: string) {
  const templater = lista.find((s) => s.type === "URL" && s.url?.split("?")[0] === url) ?? null;
  const antigos = lista.filter((s) => s.type === "CONTENT" && (s.content?.includes("bomgado-product") || /script_produto/i.test(s.name)));
  return { templater, antigos };
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

// Script da página de produto cadastrado só em uma página: não carrega na navegação interna da loja.
export const restritoAUmaPagina = (s: ScriptMoovin) => s.page !== "ALL";

// Cache do navegador pedido para o script, em segundos (Cache-Control: max-age).
export function maxAge(cacheControl: string | null) {
  const m = /max-age=(\d+)/i.exec(cacheControl ?? "");
  return m ? Number(m[1]) : null;
}

export const carregarResumo = () => api<Resumo>("implantacao/resumo");
export const listarScripts = () => api<{ items: ScriptMoovin[] }>("moovin/eco-store/script").then((r) => r.items);
export const cadastrarScript = (corpo: ReturnType<typeof novoScript>) => api<ScriptMoovin>("moovin/eco-store/script", { corpo });
export const ativarScript = (id: string, active: boolean) => api<ScriptMoovin>(`moovin/eco-store/script/${id}`, { metodo: "PATCH", corpo: { active } });
export const usarEmTodasAsPaginas = (id: string) => api<ScriptMoovin>(`moovin/eco-store/script/${id}`, { metodo: "PATCH", corpo: { page: "ALL" } });
export const verificarPagina = (caminho: string) =>
  api<{ url: string; status: number; carregaTemplater: boolean; carregaV3: boolean }>(`implantacao/pagina?caminho=${encodeURIComponent(caminho)}`);
