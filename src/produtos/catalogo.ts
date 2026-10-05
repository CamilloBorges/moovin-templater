import { gerarUrl, type Referencia } from "./modelo";
import nomesDeMarcas from "./marcas.json";

// Catálogo de apoio do cadastro (categorias, marcas, atributos de variação e características).
// Na integração vem da API (oms-product /category, /brand, /attribute, /specification).
// Por ora: categorias do menu de shoptest.bomgado.com e marcas da planilha de marcas do Logus
// (cofre: moovin_imagens/marcas_moovin.csv), em 05/10/2026. Os ids são locais, não os da Moovin.

export type Categoria = Referencia & { paiId: string | null };

const PROTEINAS = "4310e090-7bbd-4031-bcab-605b7e2644f6";

export const categorias: Categoria[] = [
  { id: PROTEINAS, nome: "Proteinas/Carnes", paiId: null },
  { id: "c2e0963d-c50b-4ca1-9829-c6c872fd75dd", nome: "Carnes Bovinas", paiId: PROTEINAS },
  ...[
    "Carnes Suínas",
    "Carnes Ovinas",
    "Carnes de Aves",
    "Acompanhamentos para Churrasco",
    "Mercearia",
    "Congelados",
    "Hortifruti",
    "Padaria e Confeitaria",
    "Fiambreria",
    "Tábuas",
    "Frios e Laticínios",
    "Sorvetes",
    "Chocolates",
    "Vinhos e Espumantes",
    "Cervejas",
    "Suco, Refrigerante e Água",
    "Geleias e Doces Gourmet",
    "Estação do Sabor",
    "Encomendas",
  ].map((nome) => ({ id: gerarUrl(nome), nome, paiId: null })),
];

export const marcas: Referencia[] = (nomesDeMarcas as string[]).map((nome) => ({ id: gerarUrl(nome), nome }));

// Atributos de variação e características: a loja não tem nenhum cadastrado para os produtos
// conhecidos. A tela permite criar novos, como a Moovin.
export const atributosVariacao: Referencia[] = [];

export type Caracteristica = Referencia & { tipo: "texto" | "lista"; valores: string[]; categorias: string[] };
export const caracteristicas: Caracteristica[] = [];

export function caminhoDaCategoria(id: string): string {
  const categoria = categorias.find((c) => c.id === id);
  if (!categoria) return "";
  return categoria.paiId ? `${caminhoDaCategoria(categoria.paiId)} › ${categoria.nome}` : categoria.nome;
}
