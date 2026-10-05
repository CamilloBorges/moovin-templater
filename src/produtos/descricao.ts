import type { Aba, ComplementoProduto, UnidadeConteudo } from "../templater/produto";

// O Complemento do cadastro vive dentro da descrição do produto na Moovin, para que a IA de
// atendimento (Moovin Desk), os feeds e qualquer pessoa leiam tudo num lugar só. Convenção:
//   - tudo antes do primeiro Título (h2) é o resumo;
//   - uma linha "Conteúdo da embalagem: 500 g" antes do primeiro Título alimenta o preço por kg/L/un;
//   - cada Título (h2) abre uma aba; o texto do título é o nome dela e o que vem depois, até o
//     próximo h2, é o conteúdo (subtítulos h3/h4, listas, imagens…).
// A convenção usa só o que o editor da Moovin preserva, então sobrevive a edições feitas lá.

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

// Campos → HTML da descrição.
export function montarDescricao(c: ComplementoProduto): string {
  const partes = [c.resumo.trim()];
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
  const c: ComplementoProduto = { conteudoComercial: null, resumo: "", abas: [] };
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

export type Leitura = { complemento: ComplementoProduto; formatoAntigo: boolean };

// HTML da descrição → campos.
export function lerDescricao(html: string): Leitura {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const blocos = Array.from(doc.body.children);
  if (blocos.some((el) => texto(el).toUpperCase() === "MODO NOVO")) return { complemento: lerFormatoAntigo(blocos), formatoAntigo: true };

  const c: ComplementoProduto = { conteudoComercial: null, resumo: "", abas: [] };
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
