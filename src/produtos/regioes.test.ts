import { describe, expect, it } from "vitest";
import type { Corte, Ponto } from "../templater/produto";
import { montarGrade, recalcularCortes, regiaoDe, rotuloEm, todasAsRegioes } from "./regioes";

// Um "animal" retangular de 0,1 a 0,9 (x) e 0,2 a 0,8 (y), numa imagem de 1000 × 600.
const CONTORNO: Ponto[] = [[0.1, 0.2], [0.9, 0.2], [0.9, 0.8], [0.1, 0.8]];
// Uma linha vertical no meio (x = 0,5) e uma horizontal só na metade direita (y = 0,5).
const LINHAS = [
  { id: "v", pontos: [[0.5, 0.1], [0.5, 0.9]] as Ponto[] },
  { id: "h", pontos: [[0.5, 0.5], [0.95, 0.5]] as Ponto[] },
];
const caixa = (r: Ponto[]) => {
  const xs = r.map((p) => p[0]);
  const ys = r.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v * 100) / 100);
};

describe("regiões pelas linhas de corte", () => {
  const g = montarGrade(1000, 600, CONTORNO, LINHAS)!;

  it("as linhas dividem o animal em três regiões", () => {
    expect(todasAsRegioes(g)).toHaveLength(3);
    const esquerda = rotuloEm(g, [0.3, 0.5]);
    expect(new Set([esquerda, rotuloEm(g, [0.7, 0.3]), rotuloEm(g, [0.7, 0.7])]).size).toBe(3);
    expect(rotuloEm(g, [0.05, 0.5])).toBe(0); // fora do animal
  });

  it("o contorno da região segue o animal e as linhas (cobrindo metade da linha)", () => {
    expect(caixa(regiaoDe(g, [rotuloEm(g, [0.3, 0.5])]))).toEqual([0.1, 0.2, 0.5, 0.8]);
    expect(caixa(regiaoDe(g, [rotuloEm(g, [0.7, 0.3])]))).toEqual([0.5, 0.2, 0.9, 0.5]);
  });

  it("um corte com âncoras em duas regiões vizinhas vira a união das duas", () => {
    const uniao = regiaoDe(g, [rotuloEm(g, [0.7, 0.3]), rotuloEm(g, [0.7, 0.7])]);
    expect(caixa(uniao)).toEqual([0.5, 0.2, 0.9, 0.8]);
    expect(uniao.length).toBeLessThanOrEqual(200);
  });

  it("recalcula só os cortes que seguem as linhas; os ajustados à mão ficam", () => {
    const base = { descricao: "", detalhes: "" };
    const cortes: Corte[] = [
      { ...base, id: "a", numero: 1, nome: "Garupa", regiao: [], sementes: [[0.3, 0.5]] },
      { ...base, id: "b", numero: 2, nome: "Ajustado", regiao: [[0, 0], [0.1, 0], [0, 0.1]], sementes: [[0.7, 0.3]], manual: true },
      { ...base, id: "c", numero: 3, nome: "Sem âncora", regiao: [[0.2, 0.2], [0.3, 0.2], [0.2, 0.3]] },
    ];
    const r = recalcularCortes({ largura: 1000, altura: 600, contorno: CONTORNO, linhas: LINHAS, cortes });
    expect(caixa(r[0].regiao)).toEqual([0.1, 0.2, 0.5, 0.8]);
    expect(r[1]).toBe(cortes[1]);
    expect(r[2]).toBe(cortes[2]);
  });

  it("sem contorno do animal não calcula nada (mapas antigos)", () => {
    expect(montarGrade(1000, 600, [], LINHAS)).toBeNull();
  });
});
