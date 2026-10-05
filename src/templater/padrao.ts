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
        proporcao: "50/50",
        esquerda: [{ type: "Galeria", props: { id: "galeria", sombra: "sim" } }],
        direita: [
          {
            type: "Cartao",
            props: {
              id: "cartao-informacoes",
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
      props: { id: "abas", sobretitulo: "CONHEÇA O PRODUTO", titulo: "Informações e detalhes" },
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
