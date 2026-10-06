import { describe, expect, it } from "vitest";
import { areaVisivel, corDoPixel, posicaoNoQuadro, removerFundoPorCor } from "./processamento";

// Imagem de teste: fundo branco 5×5, com um quadrado vermelho 3×3 no meio que tem um pixel
// branco no centro (o "miolo" da mesma cor do fundo, que o modo bordas deve preservar).
function imagem() {
  const l = 5, a = 5, d = new Uint8ClampedArray(l * a * 4);
  for (let y = 0; y < a; y++) for (let x = 0; x < l; x++) {
    const i = (y * l + x) * 4;
    const vermelho = x >= 1 && x <= 3 && y >= 1 && y <= 3 && !(x === 2 && y === 2);
    d.set(vermelho ? [200, 0, 0, 255] : [255, 255, 255, 255], i);
  }
  return { l, a, d };
}
const alfa = (d: Uint8ClampedArray, l: number, x: number, y: number) => d[(y * l + x) * 4 + 3];

describe("removerFundoPorCor", () => {
  it("modo bordas apaga o fundo ligado às bordas e preserva o miolo da mesma cor", () => {
    const { l, a, d } = imagem();
    removerFundoPorCor(d, l, a, corDoPixel(d, l, 0, 0), 10, "bordas");
    expect(alfa(d, l, 0, 0)).toBe(0);
    expect(alfa(d, l, 4, 4)).toBe(0);
    expect(alfa(d, l, 1, 1)).toBe(255); // vermelho fica
    expect(alfa(d, l, 2, 2)).toBe(255); // miolo branco fica
  });

  it("modo tudo apaga qualquer pixel da cor, inclusive o miolo", () => {
    const { l, a, d } = imagem();
    removerFundoPorCor(d, l, a, [255, 255, 255], 10, "tudo");
    expect(alfa(d, l, 2, 2)).toBe(0);
    expect(alfa(d, l, 1, 1)).toBe(255);
  });

  it("tolerância baixa não apaga cores diferentes", () => {
    const { l, a, d } = imagem();
    removerFundoPorCor(d, l, a, [250, 250, 250], 0, "tudo");
    expect(alfa(d, l, 0, 0)).toBeGreaterThan(0); // 250 × 255 está acima da tolerância zero (com a transição suave)
  });
});

describe("areaVisivel", () => {
  it("acha o retângulo com pixels visíveis depois de tirar o fundo", () => {
    const { l, a, d } = imagem();
    removerFundoPorCor(d, l, a, [255, 255, 255], 10, "bordas");
    expect(areaVisivel(d, l, a)).toEqual({ x: 1, y: 1, largura: 3, altura: 3 });
  });
  it("imagem toda transparente: null", () => {
    expect(areaVisivel(new Uint8ClampedArray(16), 2, 2)).toBeNull();
  });
});

describe("posicaoNoQuadro", () => {
  it("zoom 1 sem margem: o lado maior ocupa o quadro, centralizado", () => {
    expect(posicaoNoQuadro({ largura: 200, altura: 100 }, 100, { zoom: 1, deslocX: 0, deslocY: 0, margem: 0 })).toEqual({ x: 0, y: 25, largura: 100, altura: 50 });
  });
  it("margem de 10% e deslocamento", () => {
    expect(posicaoNoQuadro({ largura: 100, altura: 100 }, 100, { zoom: 1, deslocX: 5, deslocY: -5, margem: 10 })).toEqual({ x: 15, y: 5, largura: 80, altura: 80 });
  });
});
