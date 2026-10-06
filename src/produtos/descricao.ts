import type { ProdutoCadastro } from "./modelo";
import type { Aba, ComplementoProduto, UnidadeConteudo } from "../templater/produto";

// Desde 06/10/2026 o Complemento fica no nosso servidor (MongoDB), e a descrição da Moovin guarda
// um texto para a IA de atendimento (Moovin Desk), gerado aqui e ajustável na tela.
// A leitura da descrição continua só para migrar produtos que ainda têm o Complemento nela:
//   - formato do Script_Produto V3 (MODO NOVO / @ Aba);
//   - convenção de 05/10: resumo antes do primeiro Título (h2), linha "Conteúdo da embalagem: 500 g"
//     e cada Título como uma aba.

const UNIDADES: Record<string, UnidadeConteudo> = { g: "g", kg: "kg", ml: "ml", l: "l", un: "un" };
const LINHA_CONTEUDO = /^\s*conte[uú]do (?:da embalagem|comercial)\s*:\s*([\d.,]+)\s*(kg|g|ml|l|un)\b/i;

const escapar = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const texto = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

function lerConteudo(linha: string): ComplementoProduto["conteudoComercial"] {
  const m = LINHA_CONTEUDO.exec(linha);
  if (!m) return null;
  return { quantidade: Number(m[1].replace(/\./g, "").replace(",", ".")), unidade: UNIDADES[m[2].toLowerCase()] };
}

function formatarQuantidade(q: number) {
  return q.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

// Campos → HTML corrido (resumo, descrição, conteúdo e abas).
function montarTexto(c: ComplementoProduto): string {
  const partes = [c.resumo.trim(), c.descricao.trim()];
  if (c.conteudoComercial) {
    const unidade = c.conteudoComercial.unidade === "l" ? "L" : c.conteudoComercial.unidade;
    partes.push(`<p><strong>Conteúdo da embalagem:</strong> ${formatarQuantidade(c.conteudoComercial.quantidade)} ${unidade}</p>`);
  }
  for (const aba of c.abas) {
    if (!aba.titulo.trim() && !aba.conteudo.trim()) continue;
    // Um h2 dentro do conteúdo abriria outra aba: vira h3.
    const conteudo = aba.conteudo.replace(/<(\/?)h2(\s|>)/gi, "<$1h3$2");
    partes.push(`<h2>${escapar(aba.titulo.trim() || "Sem título")}</h2>${conteudo}`);
  }
  return partes.filter(Boolean).join("");
}

// Formato antigo do Script_Produto V3: MODO NOVO / RESUMO DO PRODUTO / DETALHES DO PRODUTO / @ Aba.
function lerFormatoAntigo(blocos: Element[]): ComplementoProduto {
  const c: ComplementoProduto = { conteudoComercial: null, resumo: "", descricao: "", abas: [] };
  let parte: "inicio" | "resumo" | "detalhes" = "inicio";
  let atual: Aba | null = null;
  const soltos: string[] = []; // conteúdo de DETALHES antes da primeira aba
  for (const el of blocos) {
    const t = texto(el);
    const T = t.toUpperCase();
    if (T === "MODO NOVO") continue;
    if (T === "RESUMO DO PRODUTO") { parte = "resumo"; continue; }
    if (T === "DETALHES DO PRODUTO") { parte = "detalhes"; continue; }
    const conteudo = lerConteudo(t);
    if (conteudo && !atual) { c.conteudoComercial = conteudo; continue; }
    const aba = /^@\s*\d*\s*(.+)$/.exec(t);
    if (aba && parte === "detalhes") {
      atual = { titulo: aba[1].trim(), conteudo: "" };
      c.abas.push(atual);
      continue;
    }
    if (parte === "resumo") c.resumo += el.outerHTML;
    else if (atual) atual.conteudo += el.outerHTML;
    else if (parte === "detalhes") soltos.push(el.outerHTML);
  }
  // Nada é descartado: o que estava entre DETALHES e a primeira aba vira uma aba para revisar.
  if (soltos.length) c.abas.unshift({ titulo: "Detalhes", conteudo: soltos.join("") });
  return c;
}

export const complementoVazio = (): ComplementoProduto => ({ conteudoComercial: null, resumo: "", descricao: "", abas: [] });

// Migração: Complemento a partir da descrição da Moovin. Descrição comum (sem a convenção)
// vira a descrição da página, sem resumo nem abas.
export function complementoDaDescricao(html: string): ComplementoProduto {
  const { complemento, formatoAntigo } = lerDescricao(html);
  if (formatoAntigo || complemento.abas.length || complemento.conteudoComercial) return complemento;
  return { ...complementoVazio(), descricao: html.trim() };
}

// HTML da descrição → campos.
function lerDescricao(html: string): { complemento: ComplementoProduto; formatoAntigo: boolean } {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const blocos = Array.from(doc.body.children);
  if (blocos.some((el) => texto(el).toUpperCase() === "MODO NOVO")) return { complemento: lerFormatoAntigo(blocos), formatoAntigo: true };

  const c: ComplementoProduto = { conteudoComercial: null, resumo: "", descricao: "", abas: [] };
  let atual: Aba | null = null;
  for (const el of blocos) {
    if (el.tagName === "H2") {
      atual = { titulo: texto(el), conteudo: "" };
      c.abas.push(atual);
    } else if (atual) {
      atual.conteudo += el.outerHTML;
    } else {
      const conteudo = lerConteudo(texto(el));
      if (conteudo && !c.conteudoComercial) c.conteudoComercial = conteudo;
      else c.resumo += el.outerHTML;
    }
  }
  return { complemento: c, formatoAntigo: false };
}

// Texto para a IA de atendimento (descrição da Moovin): só o que a Moovin não tem nos outros
// campos (preço, categoria e estoque ela já conhece), sem imagens nem enfeites.
export function descricaoParaIa(p: ProdutoCadastro): string {
  const corpo = montarTexto(p.complemento).replace(/<img\b[^>]*>/gi, "").replace(/<(\/?)(?:span|mark|u|sub|sup)\b[^>]*>/gi, "");
  return `<p><strong>${escapar(p.nome)}</strong></p>${corpo}`;
}
