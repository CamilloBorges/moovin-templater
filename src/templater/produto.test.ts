// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { precoPorUnidade, quantidadeComercial, textoUnidade, unidadesDe } from "./produto";

// Mesma regra do Script_Produto V3: preço da embalagem ÷ conteúdo comercial.
describe("precoPorUnidade", () => {
  const sem = (s: string | null) => s?.replace(/\s/g, " ");
  it("converte gramas para preço por kg", () => {
    expect(sem(precoPorUnidade(30, { quantidade: 500, unidade: "g" }))).toBe("R$ 60,00 / kg");
  });
  it("converte ml para preço por litro", () => {
    expect(sem(precoPorUnidade(15, { quantidade: 750, unidade: "ml" }))).toBe("R$ 20,00 / L");
  });
  it("sem conteúdo, com conteúdo zerado ou preço zerado, não mostra nada", () => {
    expect(precoPorUnidade(30, null)).toBeNull();
    expect(precoPorUnidade(30, { quantidade: 0, unidade: "kg" })).toBeNull();
    expect(precoPorUnidade(0, { quantidade: 1, unidade: "kg" })).toBeNull();
  });
});

describe("textoUnidade (quantidade comercial abaixo do preço)", () => {
  it("peso em kg com 3 casas", () => {
    expect(textoUnidade({ quantidade: 700, unidade: "g" })).toBe("Unidade de 0,700 kg");
    expect(textoUnidade({ quantidade: 1.25, unidade: "kg" })).toBe("Unidade de 1,250 kg");
  });
  it("volume em L com 3 casas", () => {
    expect(textoUnidade({ quantidade: 750, unidade: "ml" })).toBe("Unidade de 0,750 L");
  });
  it("unidades", () => {
    expect(textoUnidade({ quantidade: 6, unidade: "un" })).toBe("Embalagem com 6 un");
  });
  it("sem quantidade comercial, nada", () => {
    expect(textoUnidade(null)).toBeNull();
    expect(textoUnidade({ quantidade: 0, unidade: "g" })).toBeNull();
  });
});

describe("quantidadeComercial", () => {
  it("multiplica o conteúdo comercial pelas embalagens, em kg/L com 3 casas", () => {
    const g500 = { quantidade: 500, unidade: "g" as const };
    expect([1, 2, 3].map((n) => quantidadeComercial(n, g500))).toEqual(["0,500 kg", "1,000 kg", "1,500 kg"]);
    expect(quantidadeComercial(3, { quantidade: 700, unidade: "g" })).toBe("2,100 kg");
    expect(quantidadeComercial(2, { quantidade: 1.5, unidade: "l" })).toBe("3,000 L");
    expect(quantidadeComercial(2, { quantidade: 6, unidade: "un" })).toBe("12 un");
  });
  it("sem conteúdo comercial, o número de embalagens", () => {
    expect(quantidadeComercial(3, null)).toBe("3");
  });
  it("lê a quantidade da Moovin, com 1 como mínimo", () => {
    expect([unidadesDe("3"), unidadesDe(""), unidadesDe("0"), unidadesDe("abc")]).toEqual([3, 1, 1, 1]);
  });
});
