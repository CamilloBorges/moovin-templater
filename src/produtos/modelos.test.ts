import { describe, expect, it } from "vitest";
import type { ModeloCadastro, TipoAba } from "../templater/produto";
import { aplicarModelo, conteudoVazio, modeloDaCategoria, obrigatoriasVazias, sincronizarTitulos } from "./modelos";

const tipo = (id: string, titulo: string, extra: Partial<TipoAba> = {}): TipoAba => ({ id, titulo, conteudoModelo: "", obrigatoria: false, instrucao: "", ...extra });
const tipos = [
  tipo("preparo", "Preparo", { conteudoModelo: "<p>Modo de preparo:</p>" }),
  tipo("conservacao", "Conservação", { conteudoModelo: "<p>Manter refrigerado de 0 a 4 °C.</p>", obrigatoria: true }),
  tipo("origem", "Origem"),
];
const modelo: ModeloCadastro = { id: "m", nome: "Carnes", padrao: true, categorias: [], abas: ["conservacao", "preparo", "origem"] };

describe("aplicarModelo", () => {
  it("produto sem abas recebe as do modelo, na ordem, com o conteúdo modelo", () => {
    expect(aplicarModelo([], modelo, tipos)).toEqual([
      { tipo: "conservacao", titulo: "Conservação", conteudo: "<p>Manter refrigerado de 0 a 4 °C.</p>" },
      { tipo: "preparo", titulo: "Preparo", conteudo: "<p>Modo de preparo:</p>" },
      { tipo: "origem", titulo: "Origem", conteudo: "" },
    ]);
  });

  it("aproveita as abas que o produto já tem, sem perder o conteúdo, e deixa as avulsas no fim", () => {
    const abas = [
      { titulo: "Dicas do chef", conteudo: "<p>Sal grosso.</p>" },
      { titulo: "preparo", conteudo: "<p>Panela de pressão por 40 min.</p>" }, // avulsa com o mesmo título (sem acento/maiúscula)
      { tipo: "origem", titulo: "Origem antiga", conteudo: "<p>Fazenda Bomgado.</p>" },
    ];
    expect(aplicarModelo(abas, modelo, tipos)).toEqual([
      { tipo: "conservacao", titulo: "Conservação", conteudo: "<p>Manter refrigerado de 0 a 4 °C.</p>" },
      { tipo: "preparo", titulo: "Preparo", conteudo: "<p>Panela de pressão por 40 min.</p>" },
      { tipo: "origem", titulo: "Origem", conteudo: "<p>Fazenda Bomgado.</p>" },
      { titulo: "Dicas do chef", conteudo: "<p>Sal grosso.</p>" },
    ]);
  });

  it("aba existente vazia recebe o conteúdo modelo; aba do modelo excluída do cadastro é ignorada", () => {
    const comExcluida = { ...modelo, abas: ["apagada", "preparo"] };
    expect(aplicarModelo([{ tipo: "preparo", titulo: "Preparo", conteudo: "<p><br></p>" }], comExcluida, tipos)).toEqual([
      { tipo: "preparo", titulo: "Preparo", conteudo: "<p>Modo de preparo:</p>" },
    ]);
  });

  it("aplicar duas vezes não duplica abas", () => {
    const uma = aplicarModelo([], modelo, tipos);
    expect(aplicarModelo(uma, modelo, tipos)).toEqual(uma);
  });
});

describe("sincronizarTitulos", () => {
  it("traz o título do cadastro e solta a aba cujo tipo foi excluído", () => {
    expect(sincronizarTitulos([
      { tipo: "preparo", titulo: "Modo de preparo", conteudo: "a" },
      { tipo: "apagada", titulo: "Velha", conteudo: "b" },
      { titulo: "Avulsa", conteudo: "c" },
    ], tipos)).toEqual([
      { tipo: "preparo", titulo: "Preparo", conteudo: "a" },
      { titulo: "Velha", conteudo: "b" },
      { titulo: "Avulsa", conteudo: "c" },
    ]);
  });
});

describe("obrigatoriasVazias", () => {
  it("aponta as obrigatórias sem texto (tags vazias e &nbsp; contam como vazio)", () => {
    const abas = [
      { tipo: "conservacao", titulo: "Conservação", conteudo: "<p>&nbsp;</p>" },
      { tipo: "preparo", titulo: "Preparo", conteudo: "" },
      { titulo: "Conservação", conteudo: "" },
    ];
    expect([...obrigatoriasVazias(abas, tipos)]).toEqual([[0, "Conservação"]]);
    expect(conteudoVazio("<p>ok</p>")).toBe(false);
  });
});

describe("modeloDaCategoria", () => {
  const categorias = [
    { id: "carnes", paiId: null, caminho: "Carnes" },
    { id: "bovinos", paiId: "carnes", caminho: "Carnes › Bovinos" },
    { id: "nobres", paiId: "bovinos", caminho: "Carnes › Bovinos › Nobres" },
    { id: "bebidas", paiId: null, caminho: "Bebidas" },
  ];
  const m = (id: string, cats: string[], padrao = false): ModeloCadastro => ({ id, nome: id, padrao, categorias: cats, abas: [] });

  it("usa o modelo da própria categoria; senão sobe para a categoria acima; por último, o padrão geral", () => {
    const modelos = [m("geral", [], true), m("carnes", ["carnes"]), m("nobres", ["nobres"])];
    expect(modeloDaCategoria(modelos, "nobres", categorias)).toEqual({ modelo: modelos[2], motivo: "padrão da categoria Carnes › Bovinos › Nobres" });
    expect(modeloDaCategoria(modelos, "bovinos", categorias)).toEqual({ modelo: modelos[1], motivo: "padrão de Carnes, acima da categoria do produto" });
    expect(modeloDaCategoria(modelos, "bebidas", categorias)?.modelo.id).toBe("geral");
    expect(modeloDaCategoria(modelos, null, categorias)?.modelo.id).toBe("geral");
  });

  it("sem padrão geral e sem modelo na categoria: nenhum; ciclo na árvore não trava", () => {
    expect(modeloDaCategoria([m("carnes", ["carnes"])], "bebidas", categorias)).toBeNull();
    const ciclo = [{ id: "a", paiId: "b", caminho: "A" }, { id: "b", paiId: "a", caminho: "B" }];
    expect(modeloDaCategoria([m("x", ["z"])], "a", ciclo)).toBeNull();
  });
});
