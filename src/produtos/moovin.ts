import { api, ErroApi } from "../api";
import { lerDescricao, montarDescricao } from "./descricao";
import type { Imagem, ProdutoCadastro, Referencia, Variacao } from "./modelo";

// Leitura e gravação do cadastro na Moovin (pelo repasse /api/moovin, com a sessão do usuário).
// O Complemento vive na descrição do produto (ver ./descricao.ts). Formatos conferidos em 05/10/2026.

type RefApi = { id: string; label?: string } | null;
type VariacaoApi = {
  sku: string;
  gtin: string | null;
  mpn: string | null;
  shipping: { width: number; height: number; length: number; weight: number; crossDocking: number };
  attributes: Array<{ attribute: { id: string; label?: string }; value: string }>;
  specifications: Array<{ specification: { id: string }; value: string }>;
};
export type ProdutoApi = {
  id: string;
  title: string;
  description: string;
  video: string | null;
  active: boolean;
  visibleOnlyByLink: boolean;
  category: RefApi;
  additionalCategories: Array<{ id: string; label?: string }>;
  brand: RefApi;
  specifications: Array<{ specification: { id: string }; value: string }>;
  variationTemplate: { attributes: Array<{ id: string; label?: string }> } | null;
  images: Array<{ id?: string; link: string; position: number; attribute: { id: string; value: string } | null }>;
  groups: Array<{ urn: string; attribute: unknown }>;
  variations: VariacaoApi[];
};
type PrecoApi = { sku: string; price: { cost: number | null; sale: number | null; list: number | null } };
type EstoqueApi = { sku: string; total: number; warehouses: Array<{ id: string; total: number }> };
type SeoApi = { urn: string; title: string; content: { main: string; additional: string }; metadata: Array<{ name: string; content: string }> };
type Lista<T> = { items: T[]; total: number };

async function ouNulo<T>(promessa: Promise<T>): Promise<T | null> {
  try {
    return await promessa;
  } catch (e) {
    if (e instanceof ErroApi && e.status === 404) return null;
    throw e;
  }
}

const ref = (r: RefApi): Referencia | null => (r?.id ? { id: r.id, nome: r.label ?? "" } : null);

// O que veio da Moovin, guardado para gravar só o que mudou.
export type Original = {
  api: ProdutoApi;
  seo: SeoApi | null;
  estoques: Record<string, EstoqueApi | null>;
  cadastro: ProdutoCadastro;
  formatoAntigo: boolean; // descrição ainda no formato MODO NOVO / @ do Script_Produto V3
};

export async function carregarProduto(id: string): Promise<Original> {
  const produto = await api<ProdutoApi>(`moovin/oms-product/product/${id}`);
  const skus = produto.variations.map((v) => v.sku);
  const urn = produto.groups[0]?.urn ?? "";
  const [precos, estoques, seo] = await Promise.all([
    Promise.all(skus.map((sku) => ouNulo(api<PrecoApi>(`moovin/oms-pricing/price/${encodeURIComponent(sku)}`)))),
    Promise.all(skus.map((sku) => ouNulo(api<EstoqueApi>(`moovin/oms-inventory/stock/${encodeURIComponent(sku)}`)))),
    urn ? ouNulo(api<SeoApi>(`moovin/eco-seo/endpoint/${encodeURIComponent(urn)}`)) : Promise.resolve(null),
  ]);
  const leitura = lerDescricao(produto.description ?? "");
  const atributos = produto.variationTemplate?.attributes ?? [];
  const cadastro: ProdutoCadastro = {
    id: produto.id,
    urn,
    ativo: produto.active,
    nome: produto.title,
    descricao: produto.description ?? "",
    categoriaPrincipal: ref(produto.category),
    categoriasAdicionais: produto.additionalCategories.map((c) => ({ id: c.id, nome: c.label ?? "" })),
    marca: ref(produto.brand),
    possuiVariacoes: atributos.length > 0,
    atributosVariacao: atributos.map((a) => ({ id: a.id, nome: a.label ?? "" })),
    variacoes: produto.variations.map((v, i): Variacao => ({
      sku: v.sku,
      codigoBarras: v.gtin ?? "",
      mpn: v.mpn ?? "",
      estoque: estoques[i]?.total ?? 0,
      preco: { venda: precos[i]?.price.list ?? 0, promocional: precos[i]?.price.sale ?? 0, custo: precos[i]?.price.cost ?? 0 },
      dimensoes: { pesoG: v.shipping.weight, alturaCm: v.shipping.height, larguraCm: v.shipping.width, profundidadeCm: v.shipping.length },
      prazoExtraDias: v.shipping.crossDocking,
      atributos: Object.fromEntries(v.attributes.map((a) => [a.attribute.id, a.value])),
    })),
    imagens: [...produto.images].sort((a, b) => a.position - b.position).map((i): Imagem => ({ url: i.link, atributo: i.attribute ? { id: i.attribute.id, valor: i.attribute.value } : null })),
    video: produto.video ?? "",
    caracteristicas: Object.fromEntries(produto.specifications.map((s) => [s.specification.id, s.value])),
    seo: { titulo: seo?.title ?? "", url: urn, descricao: seo?.metadata.find((m) => m.name === "description")?.content ?? "" },
    visivelApenasPorLink: produto.visibleOnlyByLink,
    complemento: leitura.complemento,
  };
  return { api: produto, seo, estoques: Object.fromEntries(skus.map((s, i) => [s, estoques[i]])), cadastro, formatoAntigo: leitura.formatoAntigo };
}

const mesmo = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Grava o que mudou, cada parte no seu serviço da Moovin. Devolve o que foi gravado.
export async function salvarProduto(original: Original, p: ProdutoCadastro): Promise<string[]> {
  const o = original.cadastro;
  const feito: string[] = [];
  const caminho = `moovin/oms-product/product/${p.id}`;

  // 1. Dados gerais do produto
  const geral: Record<string, unknown> = {};
  if (p.nome !== o.nome) geral.title = p.nome;
  // A descrição é montada a partir do Complemento; só é reescrita quando ele muda.
  if (!mesmo(p.complemento, o.complemento)) geral.description = montarDescricao(p.complemento);
  if (p.ativo !== o.ativo) geral.active = p.ativo;
  if (p.visivelApenasPorLink !== o.visivelApenasPorLink) geral.visibleOnlyByLink = p.visivelApenasPorLink;
  if (p.video !== o.video) geral.video = p.video || null;
  if (!mesmo(p.categoriaPrincipal, o.categoriaPrincipal)) geral.category = p.categoriaPrincipal ? { id: p.categoriaPrincipal.id } : null;
  if (!mesmo(p.categoriasAdicionais, o.categoriasAdicionais)) geral.additionalCategories = p.categoriasAdicionais.map((c) => ({ id: c.id }));
  if (!mesmo(p.marca, o.marca)) geral.brand = p.marca ? { id: p.marca.id } : null;
  if (!mesmo(p.caracteristicas, o.caracteristicas))
    geral.specifications = Object.entries(p.caracteristicas).filter(([, v]) => v).map(([id, value]) => ({ specification: { id }, value }));
  if (!mesmo(p.atributosVariacao, o.atributosVariacao)) geral.variationTemplate = { attributes: p.atributosVariacao.map((a) => ({ id: a.id })) };
  if (!mesmo(p.imagens, o.imagens))
    geral.images = p.imagens.map((img, position) => ({ link: img.url, position, ...(img.atributo ? { attribute: { id: img.atributo.id, value: img.atributo.valor } } : {}) }));
  if (Object.keys(geral).length) {
    await api(caminho, { metodo: "PATCH", corpo: geral });
    feito.push("dados do produto");
  }

  // 2. Variações: cadastro, preço e estoque (cada SKU no seu serviço)
  for (const v of p.variacoes) {
    const antes = o.variacoes.find((x) => x.sku === v.sku);
    const sku = encodeURIComponent(v.sku);
    const cadastroMudou = !antes || v.codigoBarras !== antes.codigoBarras || v.mpn !== antes.mpn || !mesmo(v.dimensoes, antes.dimensoes)
      || v.prazoExtraDias !== antes.prazoExtraDias || !mesmo(v.atributos, antes.atributos);
    if (cadastroMudou) {
      await api(`${caminho}/variation/${sku}`, {
        metodo: "PUT",
        corpo: {
          gtin: v.codigoBarras || null,
          mpn: v.mpn || null,
          shipping: { width: v.dimensoes.larguraCm, height: v.dimensoes.alturaCm, length: v.dimensoes.profundidadeCm, weight: v.dimensoes.pesoG, crossDocking: v.prazoExtraDias },
          attributes: Object.entries(v.atributos).map(([id, value]) => ({ attribute: { id }, value })),
          specifications: [],
        },
      });
      feito.push(`variação ${v.sku}`);
    }
    if (!antes || !mesmo(v.preco, antes.preco)) {
      await api(`moovin/oms-pricing/price/${sku}`, { metodo: "PUT", corpo: { price: { list: v.preco.venda, sale: v.preco.promocional, cost: v.preco.custo } } });
      feito.push(`preço ${v.sku}`);
    }
    if (!antes || v.estoque !== antes.estoque) {
      const depositos = original.estoques[v.sku]?.warehouses ?? [];
      await api(`moovin/oms-inventory/stock/${sku}`, { metodo: "PUT", corpo: { total: v.estoque, warehouses: depositos } });
      feito.push(`estoque ${v.sku}`);
    }
  }
  for (const antes of o.variacoes) {
    if (!p.variacoes.some((v) => v.sku === antes.sku)) {
      await api(`moovin/oms-product/variation/${encodeURIComponent(antes.sku)}`, { metodo: "DELETE" });
      feito.push(`variação ${antes.sku} removida`);
    }
  }

  // 3. SEO (endpoint da URL do produto)
  if (p.urn && (p.seo.titulo !== o.seo.titulo || p.seo.descricao !== o.seo.descricao)) {
    const atual = original.seo;
    await api(`moovin/eco-seo/endpoint/${encodeURIComponent(p.urn)}`, {
      metodo: "PUT",
      corpo: {
        title: p.seo.titulo,
        content: { main: atual?.content.main ?? "", additional: atual?.content.additional ?? "" },
        metadata: [...(atual?.metadata ?? []).filter((m) => m.name !== "description"), { name: "description", content: p.seo.descricao }],
      },
    });
    feito.push("SEO");
  }

  return feito;
}

export type ItemLista = { id: string; nome: string; ativo: boolean; imagem: string | null; skus: string[]; variacoes: number };

export async function listarProdutos(pagina: number, tamanho: number, busca: string) {
  const filtro = busca.trim() ? `&title=${encodeURIComponent(busca.trim())}` : "";
  const r = await api<Lista<ProdutoApi>>(`moovin/oms-product/product?page=${pagina}&size=${tamanho}${filtro}`);
  return {
    total: r.total,
    itens: r.items.map((p): ItemLista => ({
      id: p.id,
      nome: p.title,
      ativo: p.active,
      imagem: [...p.images].sort((a, b) => a.position - b.position)[0]?.link ?? null,
      skus: p.variations.map((v) => v.sku),
      variacoes: p.variations.length,
    })),
  };
}

export async function precoEEstoque(sku: string) {
  const [preco, estoque] = await Promise.all([
    ouNulo(api<PrecoApi>(`moovin/oms-pricing/price/${encodeURIComponent(sku)}`)),
    ouNulo(api<EstoqueApi>(`moovin/oms-inventory/stock/${encodeURIComponent(sku)}`)),
  ]);
  return { preco: preco?.price.list ?? 0, estoque: estoque?.total ?? 0 };
}

// Catálogo publicado (o mesmo do seletor de produto do editor de temas da Moovin).
export type ItemCatalogo = { produtoId: string; nome: string; preco: number; imagem: string | null };
export async function buscarCatalogo(busca: string, tamanho = 20) {
  const filtro = busca.trim() ? `&search=${encodeURIComponent(busca.trim())}` : "";
  const r = await api<Lista<{ productId: string; title: string; price: number; images: Array<{ url?: string; link?: string }> }>>(
    `moovin/oms-catalog/search/list?size=${tamanho}${filtro}`,
  );
  return r.items.map((i): ItemCatalogo => ({ produtoId: i.productId, nome: i.title, preco: i.price, imagem: i.images[0]?.url ?? i.images[0]?.link ?? null }));
}
