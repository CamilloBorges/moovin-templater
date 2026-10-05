import type { ComplementoProduto } from "../templater/produto";

// Cadastro do produto: espelha a tela de produto da Moovin e a API (oms-product, oms-pricing,
// oms-inventory, eco-seo). O nome do campo na API vai no comentário, para a etapa de integração.

export type Referencia = { id: string; nome: string };

export type Variacao = {
  sku: string; // variations[].sku (a loja exibe como "Cod.")
  codigoBarras: string; // variations[].gtin
  mpn: string; // variations[].mpn
  estoque: number; // oms-inventory /stock/:sku → total
  preco: { venda: number; promocional: number; custo: number }; // oms-pricing /price/:sku → list, sale, cost
  dimensoes: { pesoG: number; alturaCm: number; larguraCm: number; profundidadeCm: number }; // variations[].shipping
  prazoExtraDias: number; // variations[].shipping.crossDocking (0 = disponibilidade imediata)
  atributos: Record<string, string>; // variations[].attributes: id do atributo → valor
};

export type Imagem = {
  url: string; // images[].link
  atributo: { id: string; valor: string } | null; // images[].attribute (imagem vinculada a uma variação)
};

export type ProdutoCadastro = {
  id: string; // uuid da URL do painel
  ativo: boolean; // active
  nome: string; // title
  descricao: string; // description (HTML)
  categoriaPrincipal: Referencia | null; // category
  categoriasAdicionais: Referencia[];
  marca: Referencia | null; // brand
  possuiVariacoes: boolean;
  atributosVariacao: Referencia[]; // variationTemplate.attributes
  variacoes: Variacao[]; // sem variações: uma única variação, sem atributos
  imagens: Imagem[];
  video: string; // video
  caracteristicas: Record<string, string>; // specifications: id da característica → valor
  seo: { titulo: string; url: string; descricao: string }; // eco-seo /endpoint/:urn
  visivelApenasPorLink: boolean;
  complemento: ComplementoProduto; // guardado fora da Moovin
};

export function novaVariacao(atributos: Record<string, string> = {}): Variacao {
  return {
    sku: "",
    codigoBarras: "",
    mpn: "",
    estoque: 0,
    preco: { venda: 0, promocional: 0, custo: 0 },
    dimensoes: { pesoG: 0, alturaCm: 0, larguraCm: 0, profundidadeCm: 0 },
    prazoExtraDias: 0,
    atributos,
  };
}

export function novoProduto(): ProdutoCadastro {
  return {
    id: crypto.randomUUID(),
    ativo: true,
    nome: "",
    descricao: "",
    categoriaPrincipal: null,
    categoriasAdicionais: [],
    marca: null,
    possuiVariacoes: false,
    atributosVariacao: [],
    variacoes: [novaVariacao()],
    imagens: [],
    video: "",
    caracteristicas: {},
    seo: { titulo: "", url: "", descricao: "" },
    visivelApenasPorLink: false,
    complemento: { conteudoComercial: null, resumo: "", abas: [] },
  };
}

// "cubos de panela 1kg" → "cubos-de-panela-1kg"
export function gerarUrl(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
