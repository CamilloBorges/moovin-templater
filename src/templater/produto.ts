// Dados que os blocos do template consomem.
// `moovin` espelha o que o cadastro atual já fornece; `complemento` são os campos adicionais
// do futuro "Complemento do cadastro" (hoje vêm dos marcadores na descrição, ver docs/HISTORICO.md).

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
  resumo: string;
  // Conteúdo das abas definidas no template, pela chave do campo (ex.: "preparo").
  campos: Record<string, ItemAba[]>;
  // Abas que só este produto tem, exibidas depois das abas do template.
  abasExtras: Array<{ titulo: string; itens: ItemAba[] }>;
};

// Um item de aba: título e texto formatado (HTML com negrito, listas e links).
export type ItemAba = { titulo: string; texto: string };

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

const imagem = (arquivo: string) =>
  `https://storage.moovin.store/main/69a35dd9-ea11-4f6f-b32a-7e36159af8cb/${arquivo}`;

// Cubos de Panela, com o conteúdo publicado em shoptest.bomgado.com em 05/10/2026.
export const produtoDemonstracao: ProdutoTemplate = {
  moovin: {
    nome: "CUBOS DE PANELA 1KG",
    codigo: "13925",
    preco: 69.38,
    imagens: [imagem("390dbb2a-94b3-4c55-b8e9-389a49e47344.jpg")],
    avaliacao: { nota: 0, total: 0 },
  },
  complemento: {
    conteudoComercial: { quantidade: 1, unidade: "kg" },
    resumo:
      "Cubos bovinos porcionados para ensopados e cozidos, com tamanho prático para dourar e cozinhar de maneira uniforme. Absorvem bem temperos, ervas e molhos. Na Linha Bomgado Origens, os cubos já porcionados combinam conveniência, procedência conhecida e o cuidado Bomgado em toda a cadeia.",
    campos: {
      preparo: [
        {
          titulo: "Como preparar",
          texto:
            "<p>Doure em pequenas levas antes de acrescentar líquido. Cozinhe em fogo baixo ou pressão até os cubos ficarem macios.</p>",
        },
        { titulo: "Ponto recomendado", texto: "<p>Cozimento completo, até ceder ao garfo.</p>" },
      ],
      sugestoes: [
        { titulo: "Sugestão de harmonização", texto: "<p>Carménère, Tempranillo ou cerveja red ale.</p>" },
        { titulo: "Acompanhamentos que combinam", texto: "<p>Purê, arroz, polenta e legumes de raiz.</p>" },
      ],
      porcoes: [{ titulo: "Quantidade de porções", texto: "<p>5 a 6 pessoas.</p>" }],
      origem: [
        {
          titulo: "Qualidade Bomgado",
          texto:
            "<p>Qualidade que começa na origem: controle de procedência, rastreabilidade e cuidado em cada etapa para levar à mesa uma carne com identidade, confiança e padrão Bomgado.</p>",
        },
        {
          titulo: "Marca e linha",
          texto:
            "<p><strong>Marca:</strong> Bomgado. <strong>Linha:</strong> ORIGENS - carne de origem controlada, com rastreabilidade e cuidado acompanhado do campo à mesa. A linha traduz o compromisso Bomgado com manejo regenerativo, qualidade sensorial e confiança na procedência.</p>",
        },
      ],
      importante: [
        {
          titulo: "Importante",
          texto:
            "<p>Quando você escolhe produtos vendidos por peso, o valor final da sua compra pode variar de acordo com o peso exato dos itens selecionados.</p>",
        },
      ],
    },
    abasExtras: [],
  },
};
