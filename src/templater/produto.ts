import type { ProdutoCadastro } from "../produtos/modelo";

// Dados que os blocos do template consomem.
// `moovin` é o recorte do cadastro que a página usa; `complemento` são os campos adicionais
// do Complemento do cadastro, guardados no nosso servidor (MongoDB).

export type UnidadeConteudo = "g" | "kg" | "ml" | "l" | "un";

export type ProdutoMoovin = {
  nome: string;
  codigo: string;
  preco: number;
  imagens: string[];
  avaliacao: { nota: number; total: number } | null;
};

// Guardado no nosso servidor (MongoDB), não na Moovin: só o que a Moovin não tem.
export type ComplementoProduto = {
  conteudoComercial: { quantidade: number; unidade: UnidadeConteudo } | null;
  resumo: string; // HTML
  descricao: string; // HTML: a descrição exibida na página (a da Moovin é o texto para a IA)
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

// Texto da quantidade comercial, abaixo do preço: "Unidade de 0,700 kg" (peso e volume sempre
// em kg/L com 3 casas, como na balança); unidades: "Embalagem com 6 un".
export function textoUnidade(conteudo: ComplementoProduto["conteudoComercial"]) {
  if (!conteudo || conteudo.quantidade <= 0) return null;
  const { quantidade, unidade } = conteudo;
  if (unidade === "un") return `Embalagem com ${quantidade.toLocaleString("pt-BR")} un`;
  const valor = unidade === "g" || unidade === "ml" ? quantidade / 1000 : quantidade;
  const rotulo = unidade === "g" || unidade === "kg" ? "kg" : "L";
  return `Unidade de ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${rotulo}`;
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
