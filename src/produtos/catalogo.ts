import { api } from "../api";
import type { Referencia } from "./modelo";

// Catálogo de apoio do cadastro, lido da Moovin (oms-product) e guardado durante a sessão.

export type Categoria = Referencia & { paiId: string | null; caminho: string };
export type Caracteristica = Referencia & { tipo: "texto" | "lista"; valores: string[]; categorias: string[] };
export type Catalogo = { categorias: Categoria[]; marcas: Referencia[]; atributos: Referencia[]; caracteristicas: Caracteristica[] };

type Lista<T> = { items: T[]; total: number };
type NoCategoria = { id: string; label: string; children?: NoCategoria[] };

// A API devolve no máximo 100 por página.
async function todos<T>(caminho: string): Promise<T[]> {
  const itens: T[] = [];
  for (let pagina = 1; ; pagina++) {
    const r = await api<Lista<T>>(`moovin/oms-product/${caminho}${caminho.includes("?") ? "&" : "?"}page=${pagina}&size=100`);
    itens.push(...r.items);
    if (!r.items.length || itens.length >= r.total) return itens;
  }
}

let cache: Promise<Catalogo> | null = null;

export function carregarCatalogo(): Promise<Catalogo> {
  cache ??= (async () => {
    const [arvore, marcas, atributos, especificacoes] = await Promise.all([
      api<Lista<NoCategoria>>("moovin/oms-product/category/tree"),
      todos<{ id: string; label: string }>("brand"),
      todos<{ id: string; label: string }>("attribute"),
      todos<{ id: string; label: string; type?: string; values?: Array<{ value?: string; label?: string } | string>; categories?: Array<{ id: string }> }>("specification"),
    ]);
    // A árvore vem aninhada (cada categoria traz as filhas em children).
    const categorias: Categoria[] = [];
    const visitar = (nos: NoCategoria[], pai: Categoria | null) => {
      for (const no of nos) {
        const c = { id: no.id, nome: no.label, paiId: pai?.id ?? null, caminho: pai ? `${pai.caminho} › ${no.label}` : no.label };
        categorias.push(c);
        visitar(no.children ?? [], c);
      }
    };
    visitar(arvore.items, null);
    return {
      categorias: categorias.sort((a, b) => a.caminho.localeCompare(b.caminho)),
      marcas: marcas.map((m) => ({ id: m.id, nome: m.label })).sort((a, b) => a.nome.localeCompare(b.nome)),
      atributos: atributos.map((a) => ({ id: a.id, nome: a.label })),
      caracteristicas: especificacoes.map((s) => ({
        id: s.id,
        nome: s.label,
        tipo: s.values?.length ? "lista" : "texto",
        valores: (s.values ?? []).map((v) => (typeof v === "string" ? v : v.value ?? v.label ?? "")),
        categorias: (s.categories ?? []).map((c) => c.id),
      })),
    };
  })();
  cache.catch(() => { cache = null; });
  return cache;
}
