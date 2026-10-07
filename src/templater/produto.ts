import type { ProdutoCadastro } from "../produtos/modelo";

// Dados que os blocos do template consomem.
// `moovin` é o recorte do cadastro que a página usa; `complemento` são os campos adicionais
// do Complemento do cadastro, guardados no nosso servidor (MongoDB).

export type UnidadeConteudo = "g" | "kg" | "ml" | "l" | "un";

// Endereço da loja (os produtos ficam em <loja>/<urn>/p).
export const URL_LOJA = "https://shoptest.bomgado.com";

export type ProdutoMoovin = {
  nome: string;
  url: string; // endereço da página do produto (o que o botão compartilhar copia)
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
  badges: string[]; // ids dos badges do produto, na ordem de exibição (cadastro em Badges)
  // Abas do produto, quantas forem necessárias. O template decide onde e como aparecem.
  abas: Aba[];
  // Mapa de Corte: de que mapa e de que corte é o produto (cadastro em Mapas de cortes).
  // Sem o campo (produtos antigos) ou null: o produto não mostra o mapa.
  mapaCorte?: MapaCorteProduto | null;
};

export type MapaCorteProduto = {
  mapa: string; // id do mapa (animal)
  corte: string; // id do corte dentro do mapa
  descricao: string; // texto na imagem; vazio = a descrição cadastrada no corte
};

// Ponto da região do corte, em fração da imagem (0 a 1): independe do tamanho da imagem.
export type Ponto = [number, number];

export type Corte = {
  id: string;
  numero: number; // numeração no mapa (como no pôster de cortes)
  nome: string;
  descricao: string; // texto curto, que vai na imagem do produto
  detalhes: string; // HTML: informações detalhadas do corte
  regiao: Ponto[]; // contorno da região (polígono); vazio = ainda não desenhado
};

// Mapa de cortes de um animal: a imagem (salva na Moovin) e os cortes marcados nela.
export type MapaCortes = { id: string; nome: string; imagem: string; largura: number; altura: number; cortes: Corte[] };

// O que a página precisa para desenhar a imagem do Mapa de Corte do produto.
export type MapaCorteResolvido = {
  imagem: string;
  largura: number;
  altura: number;
  regiao: Ponto[];
  numero: number;
  corte: string; // nome do corte
  descricao: string;
};

// Mapa de Corte do produto a partir do cadastro: null se o produto não usa, ou se o mapa, o corte
// ou a região não existem mais (a imagem não aparece em vez de aparecer quebrada).
export function resolverMapaCorte(ref: MapaCorteProduto | null | undefined, mapas: MapaCortes[]): MapaCorteResolvido | null {
  if (!ref) return null;
  const mapa = mapas.find((m) => m.id === ref.mapa);
  const corte = mapa?.cortes.find((c) => c.id === ref.corte);
  if (!mapa || !corte || corte.regiao.length < 3 || !mapa.imagem) return null;
  return {
    imagem: mapa.imagem,
    largura: mapa.largura,
    altura: mapa.altura,
    regiao: corte.regiao,
    numero: corte.numero,
    corte: corte.nome,
    descricao: ref.descricao.trim() || corte.descricao,
  };
}

// Aba do produto. Com `tipo`, ela é uma aba do cadastro (Abas e modelos): o título vem de lá
// (renomear no cadastro renomeia em todos os produtos) e o conteúdo é do produto. Sem `tipo`,
// é uma aba avulsa, só daquele produto.
export type Aba = { titulo: string; conteudo: string; tipo?: string }; // conteúdo em HTML

// Aba do cadastro: o que vem preenchido no produto novo e as regras de preenchimento.
export type TipoAba = {
  id: string;
  titulo: string;
  conteudoModelo: string; // HTML que já vem no produto quando a aba entra por um modelo
  obrigatoria: boolean; // o produto não salva com o conteúdo vazio
  instrucao: string; // dica para quem cadastra (não vai para a loja)
};

// Modelo de cadastro: a sequência de abas de um tipo de produto. Um deles é o padrão.
export type ModeloCadastro = { id: string; nome: string; padrao: boolean; abas: string[] }; // abas: ids de TipoAba, na ordem

// Badge (selo) cadastrado no painel: uma imagem (salva na Moovin) ou um ícone (SVG guardado no
// cadastro, com cor e fundo). O link, se houver, abre em outra aba.
export type Badge = {
  id: string;
  nome: string;
  tipo: "imagem" | "icone";
  imagem: string; // tipo imagem: endereço na Moovin
  icone: string; // tipo ícone: SVG (Lucide), com traço em currentColor
  cor: string; // cor do ícone (#rrggbb)
  corFundo: string; // fundo do ícone (#rrggbb ou "transparent")
  tooltip: string;
  link: string;
};

export type ProdutoTemplate = {
  moovin: ProdutoMoovin;
  complemento: ComplementoProduto;
  badges: Badge[]; // os badges do produto, já com os dados do cadastro
  mapaCorte?: MapaCorteResolvido | null; // imagem do Mapa de Corte, no fim da galeria
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

// Badges do produto, na ordem escolhida, a partir do cadastro completo.
export function resolverBadges(ids: string[], todos: Badge[]): Badge[] {
  return ids.map((id) => todos.find((b) => b.id === id)).filter((b): b is Badge => !!b);
}

export function paraTemplate(produto: ProdutoCadastro, todosBadges: Badge[] = [], mapas: MapaCortes[] = []): ProdutoTemplate {
  const variacao = produto.variacoes[0];
  return {
    moovin: {
      nome: produto.nome,
      url: `${URL_LOJA}/${produto.urn}/p`,
      codigo: variacao?.sku ?? "",
      // Com preço promocional, a loja vende por ele.
      preco: variacao ? variacao.preco.promocional || variacao.preco.venda : 0,
      imagens: produto.imagens.map((imagem) => imagem.url),
      avaliacao: { nota: 0, total: 0 }, // avaliações vêm da loja, não do cadastro
    },
    complemento: produto.complemento,
    badges: resolverBadges(produto.complemento.badges, todosBadges),
    mapaCorte: resolverMapaCorte(produto.complemento.mapaCorte, mapas),
  };
}
