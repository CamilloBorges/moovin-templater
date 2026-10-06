// Funções puras do editor de imagem (sem canvas), para poderem ser testadas.
// Os pixels vêm no formato do ImageData: RGBA, 4 bytes por pixel, linha a linha.

export type Cor = [number, number, number];

export function corDoPixel(dados: Uint8ClampedArray, largura: number, x: number, y: number): Cor {
  const i = (y * largura + x) * 4;
  return [dados[i], dados[i + 1], dados[i + 2]];
}

// Distância entre cores, de 0 (iguais) a 100 (preto × branco).
function distancia(dados: Uint8ClampedArray, i: number, [r, g, b]: Cor) {
  const dr = dados[i] - r, dg = dados[i + 1] - g, db = dados[i + 2] - b;
  return (Math.sqrt(dr * dr + dg * dg + db * db) / 441.673) * 100;
}

// Torna transparentes os pixels parecidos com `cor` (tolerância de 0 a 100).
// - "bordas": só o fundo ligado às bordas da imagem (preenchimento a partir delas), para não
//   apagar partes do desenho da mesma cor que ficam no meio;
// - "tudo": qualquer pixel parecido, em qualquer lugar.
// Perto do limite a transparência é parcial, para a borda não ficar serrilhada.
export function removerFundoPorCor(dados: Uint8ClampedArray, largura: number, altura: number, cor: Cor, tolerancia: number, modo: "bordas" | "tudo") {
  const limite = Math.max(0, tolerancia);
  const suave = Math.max(2, limite * 0.25); // faixa de transição acima do limite
  const aplicar = (i: number, d: number) => {
    const alfa = d <= limite ? 0 : Math.min(1, (d - limite) / suave);
    dados[i + 3] = Math.min(dados[i + 3], Math.round(alfa * 255));
  };

  if (modo === "tudo") {
    for (let i = 0; i < dados.length; i += 4) {
      const d = distancia(dados, i, cor);
      if (d < limite + suave) aplicar(i, d);
    }
    return;
  }

  const visitado = new Uint8Array(largura * altura);
  const fila: number[] = [];
  const entrar = (x: number, y: number) => {
    const p = y * largura + x;
    if (visitado[p]) return;
    visitado[p] = 1;
    const d = distancia(dados, p * 4, cor);
    if (d < limite + suave) {
      aplicar(p * 4, d);
      if (d <= limite) fila.push(p); // só o fundo de verdade espalha; a borda suave para aqui
    }
  };
  for (let x = 0; x < largura; x++) { entrar(x, 0); entrar(x, altura - 1); }
  for (let y = 0; y < altura; y++) { entrar(0, y); entrar(largura - 1, y); }
  while (fila.length) {
    const p = fila.pop()!;
    const x = p % largura, y = (p - x) / largura;
    if (x > 0) entrar(x - 1, y);
    if (x < largura - 1) entrar(x + 1, y);
    if (y > 0) entrar(x, y - 1);
    if (y < altura - 1) entrar(x, y + 1);
  }
}

// Menor retângulo com pixels visíveis (alfa > 8). Null se a imagem ficou toda transparente.
export function areaVisivel(dados: Uint8ClampedArray, largura: number, altura: number) {
  let x0 = largura, y0 = altura, x1 = -1, y1 = -1;
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (dados[(y * largura + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, largura: x1 - x0 + 1, altura: y1 - y0 + 1 };
}

export type Enquadramento = { zoom: number; deslocX: number; deslocY: number; margem: number };

// Onde desenhar a imagem (ou o recorte `area`) num quadro quadrado de `lado` px:
// com zoom 1 ela cabe inteira dentro da margem (em % do lado), centralizada; deslocX/Y movem
// em px do quadro.
export function posicaoNoQuadro(area: { largura: number; altura: number }, lado: number, e: Enquadramento) {
  const util = lado * (1 - (2 * e.margem) / 100);
  const escala = (util / Math.max(area.largura, area.altura)) * e.zoom;
  const largura = area.largura * escala, altura = area.altura * escala;
  return { x: (lado - largura) / 2 + e.deslocX, y: (lado - altura) / 2 + e.deslocY, largura, altura };
}
