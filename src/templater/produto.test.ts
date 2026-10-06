// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { precoPorUnidade, textoUnidade } from "./produto";

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
