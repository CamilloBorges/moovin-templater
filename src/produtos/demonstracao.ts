import type { ProdutoCadastro } from "./modelo";

// Cubos de Panela como estavam no painel e em shoptest.bomgado.com em 05/10/2026.
// O complemento reproduz o conteúdo publicado na descrição (marcadores MODO NOVO / @).
export const cubosDePanela: ProdutoCadastro = {
  id: "2170b12c-3c6b-4954-ab5c-03379b78d8c5",
  ativo: true,
  nome: "CUBOS DE PANELA 1KG",
  descricao:
    "<p>Cubos bovinos porcionados para ensopados e cozidos, com tamanho prático para dourar e cozinhar de maneira uniforme. Absorvem bem temperos, ervas e molhos.</p>",
  categoriaPrincipal: { id: "c2e0963d-c50b-4ca1-9829-c6c872fd75dd", nome: "Carnes Bovinas" },
  categoriasAdicionais: [],
  marca: { id: "bomgado-selecao", nome: "Bomgado Seleção" },
  possuiVariacoes: false,
  atributosVariacao: [],
  variacoes: [
    {
      sku: "13925",
      codigoBarras: "13925",
      mpn: "",
      estoque: 10,
      preco: { venda: 69.38, promocional: 0, custo: 65 },
      dimensoes: { pesoG: 0, alturaCm: 0, larguraCm: 0, profundidadeCm: 0 },
      prazoExtraDias: 0,
      atributos: {},
    },
  ],
  imagens: [
    {
      url: "https://storage.moovin.store/main/69a35dd9-ea11-4f6f-b32a-7e36159af8cb/390dbb2a-94b3-4c55-b8e9-389a49e47344.jpg",
      atributo: null,
    },
  ],
  video: "",
  caracteristicas: {},
  seo: { titulo: "", url: "cubos-de-panela-1-kg", descricao: "" },
  visivelApenasPorLink: false,
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
