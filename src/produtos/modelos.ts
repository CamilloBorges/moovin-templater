import { api } from "../api";
import type { Aba, ModeloCadastro, TipoAba } from "../templater/produto";

// Cadastro de abas e modelos de cadastro (nosso servidor), e as regras que os aplicam às abas do produto.

export type DadosTipoAba = Omit<TipoAba, "id">;
export type DadosModelo = Omit<ModeloCadastro, "id">;

export const listarTiposAba = () => api<TipoAba[]>("tipos-aba");
export const salvarTipoAba = (dados: DadosTipoAba, id?: string) =>
  id ? api<TipoAba>(`tipos-aba/${id}`, { metodo: "PUT", corpo: dados }) : api<TipoAba>("tipos-aba", { corpo: dados });
export const excluirTipoAba = (id: string) => api(`tipos-aba/${id}`, { metodo: "DELETE" });

export const listarModelos = () => api<ModeloCadastro[]>("modelos");
export const salvarModelo = (dados: DadosModelo, id?: string) =>
  id ? api<ModeloCadastro>(`modelos/${id}`, { metodo: "PUT", corpo: dados }) : api<ModeloCadastro>("modelos", { corpo: dados });
export const excluirModelo = (id: string) => api(`modelos/${id}`, { metodo: "DELETE" });

const chave = (titulo: string) => titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// Conteúdo sem texto (só tags vazias, espaços ou &nbsp;) conta como vazio.
export const conteudoVazio = (html: string) => !html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

export const novaAba = (tipo: TipoAba): Aba => ({ tipo: tipo.id, titulo: tipo.titulo, conteudo: tipo.conteudoModelo });

// Título das abas do cadastro como está no cadastro. Aba cujo tipo foi excluído vira avulsa (fica com o último título).
export function sincronizarTitulos(abas: Aba[], tipos: TipoAba[]): Aba[] {
  return abas.map((aba) => {
    if (!aba.tipo) return aba;
    const tipo = tipos.find((t) => t.id === aba.tipo);
    if (!tipo) return { titulo: aba.titulo, conteudo: aba.conteudo };
    return tipo.titulo === aba.titulo ? aba : { ...aba, titulo: tipo.titulo };
  });
}

// Aplica um modelo às abas que o produto já tem, sem apagar nada que foi escrito:
// - as abas do modelo vêm primeiro, na ordem do modelo. Se o produto já tem a aba (do mesmo
//   cadastro, ou avulsa com o mesmo título), ela é aproveitada com o conteúdo dela e passa a ser
//   do cadastro; se não tem, entra com o conteúdo modelo;
// - as outras abas do produto vêm depois, na ordem em que estavam.
export function aplicarModelo(abas: Aba[], modelo: ModeloCadastro, tipos: TipoAba[]): Aba[] {
  const restantes = [...abas];
  const doModelo: Aba[] = [];
  for (const id of modelo.abas) {
    const tipo = tipos.find((t) => t.id === id);
    if (!tipo) continue;
    let i = restantes.findIndex((a) => a.tipo === id);
    if (i < 0) i = restantes.findIndex((a) => !a.tipo && chave(a.titulo) === chave(tipo.titulo));
    if (i < 0) {
      doModelo.push(novaAba(tipo));
      continue;
    }
    const [existente] = restantes.splice(i, 1);
    doModelo.push({ ...existente, tipo: id, titulo: tipo.titulo, conteudo: conteudoVazio(existente.conteudo) ? tipo.conteudoModelo : existente.conteudo });
  }
  return [...doModelo, ...restantes];
}

// Abas obrigatórias do cadastro que estão sem conteúdo: índice da aba no produto → título.
export function obrigatoriasVazias(abas: Aba[], tipos: TipoAba[]): Map<number, string> {
  const vazias = new Map<number, string>();
  abas.forEach((aba, i) => {
    const tipo = aba.tipo ? tipos.find((t) => t.id === aba.tipo) : undefined;
    if (tipo?.obrigatoria && conteudoVazio(aba.conteudo)) vazias.set(i, tipo.titulo);
  });
  return vazias;
}

export const modeloPadrao = (modelos: ModeloCadastro[]) => modelos.find((m) => m.padrao) ?? null;

export type CategoriaArvore = { id: string; paiId: string | null; caminho: string };
export type ModeloEscolhido = { modelo: ModeloCadastro; motivo: string };

// Modelo de um produto pela categoria principal: o da própria categoria; se ela não tem, o da
// categoria acima (subcategoria → categoria), até a raiz; por último, o padrão geral.
export function modeloDaCategoria(modelos: ModeloCadastro[], categoriaId: string | null | undefined, categorias: CategoriaArvore[]): ModeloEscolhido | null {
  const vistos = new Set<string>();
  for (let id = categoriaId ?? null; id && !vistos.has(id); id = categorias.find((c) => c.id === id)?.paiId ?? null) {
    vistos.add(id);
    const modelo = modelos.find((m) => (m.categorias ?? []).includes(id!));
    if (modelo) {
      const caminho = categorias.find((c) => c.id === id)?.caminho ?? "";
      return { modelo, motivo: id === categoriaId ? `padrão da categoria ${caminho}` : `padrão de ${caminho}, acima da categoria do produto` };
    }
  }
  const geral = modeloPadrao(modelos);
  return geral ? { modelo: geral, motivo: "padrão geral" } : null;
}
