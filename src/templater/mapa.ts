import type { Ponto } from "./produto";

// Geometria do Mapa de Corte, usada no painel e no script da loja.

// Contorno no formato do atributo points do SVG, nas coordenadas da imagem.
export const pontosSvg = (regiao: Ponto[], largura: number, altura: number) =>
  regiao.map(([x, y]) => `${(x * largura).toFixed(1)},${(y * altura).toFixed(1)}`).join(" ");

// Centro (centroide) do contorno, onde vai o número do corte. Contorno degenerado: média dos pontos.
export function centroDaRegiao(regiao: Ponto[]): Ponto | null {
  if (!regiao.length) return null;
  let area = 0, cx = 0, cy = 0;
  regiao.forEach(([x0, y0], i) => {
    const [x1, y1] = regiao[(i + 1) % regiao.length];
    const f = x0 * y1 - x1 * y0;
    area += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  });
  if (Math.abs(area) < 1e-9) return [regiao.reduce((s, p) => s + p[0], 0) / regiao.length, regiao.reduce((s, p) => s + p[1], 0) / regiao.length];
  return [cx / (3 * area), cy / (3 * area)];
}
