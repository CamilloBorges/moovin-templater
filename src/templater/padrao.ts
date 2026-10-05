import type { Data } from "@puckeditor/core";
import type { RaizTemplate } from "./config";

export type TemplateData = Data<Record<string, any>, RaizTemplate>;

// Layout padrão da loja: reproduz o Script_Produto V3 (loja/script-produto-v3.js).
export const templatePadrao: TemplateData = {
  root: {
    props: { title: "Página de produto — padrão", corPrincipal: "#173a4d", corDestaque: "#b58a3c" },
  },
  content: [
    {
      type: "Colunas",
      props: {
        id: "colunas-produto",
        nome: "Área do produto",
        proporcao: "50/50",
        esquerda: [{ type: "Galeria", props: { id: "galeria", sombra: "sim" } }],
        direita: [
          {
            type: "Cartao",
            props: {
              id: "cartao-informacoes",
              nome: "Cartão de informações",
              fundo: "branco",
              conteudo: [
                {
                  type: "Titulo",
                  props: { id: "titulo", mostrarCodigo: "sim", mostrarAvaliacao: "sim", mostrarCompartilhar: "sim" },
                },
                { type: "Resumo", props: { id: "resumo" } },
              ],
            },
          },
          {
            type: "Cartao",
            props: {
              id: "cartao-compra",
              nome: "Cartão de compra",
              fundo: "branco",
              conteudo: [
                { type: "LinhaCompra", props: { id: "linha-compra" } },
                { type: "PrecoPorUnidade", props: { id: "preco-unidade" } },
              ],
            },
          },
        ],
      },
    },
    {
      type: "AbasDetalhes",
      props: {
        id: "abas",
        sobretitulo: "CONHEÇA O PRODUTO",
        titulo: "Informações e detalhes",
        abas: [
          { titulo: "Preparo", campo: "preparo" },
          { titulo: "Sugestões", campo: "sugestoes" },
          { titulo: "Porções", campo: "porcoes" },
          { titulo: "Origem e qualidade", campo: "origem" },
          { titulo: "Informações importantes", campo: "importante" },
        ],
        abasExtras: "sim",
        numerar: "sim",
      },
    },
    { type: "BarraCompraFixa", props: { id: "barra-fixa" } },
  ],
};

export function lerTemplate(chave: string): TemplateData | null {
  try {
    const salvo: unknown = JSON.parse(localStorage.getItem(chave) ?? "null");
    if (typeof salvo !== "object" || salvo === null || !("content" in salvo) || !Array.isArray(salvo.content)) {
      return null;
    }
    return salvo as TemplateData;
  } catch {
    return null;
  }
}

export const CHAVE_RASCUNHO = "templater:rascunho";
export const CHAVE_PUBLICADO = "templater:publicado";

export function templatePublicado(): TemplateData {
  return lerTemplate(CHAVE_PUBLICADO) ?? templatePadrao;
}

// Abas definidas nos blocos "Abas de detalhes" do template (inclusive dentro de colunas e cartões).
// São os campos que o Complemento do cadastro precisa oferecer.
export function abasDoTemplate(template: TemplateData): Array<{ titulo: string; campo: string }> {
  const abas: Array<{ titulo: string; campo: string }> = [];
  const visitar = (itens: unknown) => {
    if (!Array.isArray(itens)) return;
    for (const item of itens as Array<{ type?: string; props?: Record<string, unknown> }>) {
      if (typeof item?.type !== "string" || !item.props) continue; // não é um bloco (ex.: a lista de abas)
      if (item.type === "AbasDetalhes" && Array.isArray(item.props.abas)) {
        for (const aba of item.props.abas as Array<{ titulo: string; campo: string }>) {
          if (aba.campo && !abas.some((a) => a.campo === aba.campo)) abas.push(aba);
        }
      }
      Object.values(item.props).forEach(visitar);
    }
  };
  visitar(template.content);
  return abas;
}
