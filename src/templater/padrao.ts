import type { Data } from "@puckeditor/core";
import { api, ErroApi } from "../api";
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
                { type: "Badges", props: { id: "badges", tamanho: 48 } },
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
    { type: "Descricao", props: { id: "descricao", sobretitulo: "", titulo: "Descrição" } },
    {
      type: "AbasDetalhes",
      props: {
        id: "abas",
        sobretitulo: "CONHEÇA O PRODUTO",
        titulo: "Informações e detalhes",
        estilo: "abas",
        numerar: "sim",
      },
    },
    { type: "BarraCompraFixa", props: { id: "barra-fixa" } },
  ],
};

// Templates da loja, guardados no nosso servidor (MongoDB), por loja.
export async function carregarTemplate(tipo: "rascunho" | "publicado"): Promise<TemplateData | null> {
  try {
    return (await api<{ dados: TemplateData }>(`templates/${tipo}`)).dados;
  } catch (e) {
    if (e instanceof ErroApi && e.status === 404) return null;
    throw e;
  }
}

export async function salvarTemplate(tipo: "rascunho" | "publicado", dados: TemplateData) {
  await api(`templates/${tipo}`, { metodo: "PUT", corpo: { dados } });
}

export async function templatePublicado(): Promise<TemplateData> {
  return (await carregarTemplate("publicado")) ?? templatePadrao;
}
