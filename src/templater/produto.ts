import type { ProdutoCadastro } from "../produtos/modelo";

// Dados que os blocos do template consomem.
// `moovin` é o recorte do cadastro que a página usa; `complemento` são os campos adicionais
// do Complemento do cadastro (na loja de hoje vêm dos marcadores na descrição, ver docs/HISTORICO.md).

export type UnidadeConteudo = "g" | "kg" | "ml" | "l" | "un";

export type ProdutoMoovin = {
  nome: string;
  codigo: string;
  preco: number;
  imagens: string[];
  avaliacao: { nota: number; total: number } | null;
};

export type ComplementoProduto = {
  conteudoComercial: { quantidade: number; unidade: UnidadeConteudo } | null;
  resumo: string; // HTML
  // Abas do produto, quantas forem necessárias. O template decide onde e como aparecem.
  abas: Aba[];
};

export type Aba = { titulo: string; conteudo: string }; // conteúdo em HTML

export type ProdutoTemplate = {
  moovin: ProdutoMoovin;
  complemento: ComplementoProduto;
};

export function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Mesma regra do Script_Produto V3: preço da embalagem ÷ conteúdo comercial.
export function precoPorUnidade(preco: number, conteudo: ComplementoProduto["conteudoComercial"]) {
  if (!conteudo || conteudo.quantidade <= 0 || preco <= 0) return null;
  const regra = { g: [1000, "kg"], kg: [1, "kg"], ml: [1000, "L"], l: [1, "L"], un: [1, "un"] } as const;
  const [base, rotulo] = regra[conteudo.unidade];
  return `${formatarMoeda((preco * base) / conteudo.quantidade)} / ${rotulo}`;
}

export function paraTemplate(produto: ProdutoCadastro): ProdutoTemplate {
  const variacao = produto.variacoes[0];
  return {
    moovin: {
      nome: produto.nome,
      codigo: variacao?.sku ?? "",
      // Com preço promocional, a loja vende por ele.
      preco: variacao ? variacao.preco.promocional || variacao.preco.venda : 0,
      imagens: produto.imagens.map((imagem) => imagem.url),
      avaliacao: { nota: 0, total: 0 }, // avaliações vêm da loja, não do cadastro
    },
    complemento: produto.complemento,
  };
}
