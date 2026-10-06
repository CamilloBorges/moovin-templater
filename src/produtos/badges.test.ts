import { describe, expect, it } from "vitest";
import { caminhoDaImagem } from "./badges";

describe("caminhoDaImagem (arquivo do badge na Moovin)", () => {
  it("usa o nome sem acentos nem espaços, com carimbo e a extensão do arquivo", () => {
    expect(caminhoDaImagem("Sem Glúten!", "selo.PNG", 123)).toBe("templater/badges/sem-gluten-123.png");
  });
  it("sem extensão conhecida, usa png; sem nome, badge", () => {
    expect(caminhoDaImagem("", "arquivo", 1)).toBe("templater/badges/badge-1.png");
  });
});
