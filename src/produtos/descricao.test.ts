// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { complementoDaDescricao, complementoVazio, descricaoParaIa } from "./descricao";
import type { ProdutoCadastro } from "./modelo";

describe("complementoDaDescricao (migração da descrição da Moovin)", () => {
  it("descrição comum vira a descrição da página, sem resumo nem abas", () => {
    const html = "<p>Carne macia, ideal para panela.</p>";
    expect(complementoDaDescricao(html)).toEqual({ ...complementoVazio(), descricao: html });
  });

  it("lê a convenção de 05/10: resumo, conteúdo da embalagem e abas por Título", () => {
    const c = complementoDaDescricao(
      "<p>Cubos selecionados.</p><p><strong>Conteúdo da embalagem:</strong> 500 g</p><h2>Preparo</h2><p>Cozinhe por 2 h.</p><h2>Origem</h2><p>Fazenda Bomgado.</p>",
    );
    expect(c.resumo).toBe("<p>Cubos selecionados.</p>");
    expect(c.conteudoComercial).toEqual({ quantidade: 500, unidade: "g" });
    expect(c.abas).toEqual([
      { titulo: "Preparo", conteudo: "<p>Cozinhe por 2 h.</p>" },
      { titulo: "Origem", conteudo: "<p>Fazenda Bomgado.</p>" },
    ]);
    expect(c.descricao).toBe("");
  });

  it("lê o formato do Script_Produto V3 (MODO NOVO / @ Aba)", () => {
    const c = complementoDaDescricao(
      "<p>MODO NOVO</p><p>RESUMO DO PRODUTO</p><p>Cubos de panela.</p><p>CONTEÚDO COMERCIAL: 1 kg</p><p>DETALHES DO PRODUTO</p><p>@1 Preparo</p><p>Panela de pressão.</p>",
    );
    expect(c.resumo).toBe("<p>Cubos de panela.</p>");
    expect(c.conteudoComercial).toEqual({ quantidade: 1, unidade: "kg" });
    expect(c.abas).toEqual([{ titulo: "Preparo", conteudo: "<p>Panela de pressão.</p>" }]);
  });
});

describe("descricaoParaIa (texto para a IA do Moovin Desk)", () => {
  const produto = {
    nome: "Cubos de Panela <500 g>",
    complemento: {
      resumo: "<p>Cubos selecionados.</p>",
      descricao: '<p>Texto da página.<img src="x.jpg"></p>',
      conteudoComercial: { quantidade: 500, unidade: "g" },
      abas: [{ titulo: "Preparo", conteudo: "<p>Cozinhe por <span style=\"color:red\">2 h</span>.</p>" }],
    },
  } as unknown as ProdutoCadastro;
  const texto = descricaoParaIa(produto);

  it("começa pelo nome do produto, escapado", () => {
    expect(texto.startsWith("<p><strong>Cubos de Panela &lt;500 g&gt;</strong></p>")).toBe(true);
  });

  it("leva resumo, descrição, conteúdo e abas, sem imagens nem enfeites", () => {
    expect(texto).toContain("Cubos selecionados.");
    expect(texto).toContain("Texto da página.");
    expect(texto).toContain("Conteúdo da embalagem:</strong> 500 g");
    expect(texto).toContain("<h2>Preparo</h2>");
    expect(texto).toContain("Cozinhe por 2 h.");
    expect(texto).not.toContain("<img");
    expect(texto).not.toContain("<span");
  });
});
