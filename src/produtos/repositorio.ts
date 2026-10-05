import { cubosDePanela } from "./demonstracao";
import type { ProdutoCadastro } from "./modelo";

// Onde os produtos são lidos e gravados. Nesta etapa, no navegador (localStorage), começando
// pelos Cubos de Panela. Na integração, a mesma interface passa a falar com o backend, que
// grava o cadastro na Moovin e o complemento na nossa base.
export type RepositorioProdutos = {
  listar(): ProdutoCadastro[];
  obter(id: string): ProdutoCadastro | null;
  salvar(produto: ProdutoCadastro): void;
  excluir(id: string): void;
};

const CHAVE = "produtos:cadastro";

function ler(): ProdutoCadastro[] {
  try {
    const salvo: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
    return Array.isArray(salvo) ? (salvo as ProdutoCadastro[]) : [cubosDePanela];
  } catch {
    return [cubosDePanela];
  }
}

function gravar(produtos: ProdutoCadastro[]) {
  localStorage.setItem(CHAVE, JSON.stringify(produtos));
}

export const repositorioLocal: RepositorioProdutos = {
  listar: ler,
  obter: (id) => ler().find((p) => p.id === id) ?? null,
  salvar(produto) {
    const produtos = ler();
    const i = produtos.findIndex((p) => p.id === produto.id);
    if (i >= 0) produtos[i] = produto;
    else produtos.push(produto);
    gravar(produtos);
  },
  excluir: (id) => gravar(ler().filter((p) => p.id !== id)),
};
