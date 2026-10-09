import type { Corte, LinhaCorte, MapaCortes, Ponto } from "../templater/produto";

// Regiões dos cortes pelo modelo de linhas: o contorno do animal é preenchido numa grade, as linhas de
// corte viram barreira e cada pedaço separado por elas é uma região. Um corte é a região (ou a união
// das regiões) onde ficam os pontos-âncora dele. O contorno da região sai da borda do pedaço na grade,
// simplificado (até 200 pontos) e guardado em fração da imagem, como as regiões desenhadas à mão.

export type Grade = {
  w: number;
  h: number;
  rot: Int32Array; // rótulo da região em cada célula (0 = fora do animal ou em cima de uma linha)
  areas: number[]; // área (células) de cada rótulo
};

const RESOLUCAO = 900; // células no lado maior da imagem
const MAX_PONTOS = 200;

export function montarGrade(largura: number, altura: number, contorno: Ponto[], linhas: LinhaCorte[], resolucao = RESOLUCAO): Grade | null {
  if (contorno.length < 3 || largura <= 0 || altura <= 0) return null;
  const esc = resolucao / Math.max(largura, altura);
  const w = Math.max(2, Math.round(largura * esc));
  const h = Math.max(2, Math.round(altura * esc));
  const dentro = new Uint8Array(w * h);
  preencherPoligono(dentro, w, h, contorno.map(([x, y]) => [x * w, y * h]));
  for (const linha of linhas) {
    const pts = linha.pontos.map(([x, y]) => [x * w, y * h] as const);
    for (let i = 1; i < pts.length; i++) riscar(dentro, w, h, pts[i - 1], pts[i]);
  }
  // rótulos (vizinhança de 4, para a linha separar mesmo na diagonal)
  const rot = new Int32Array(w * h);
  const areas = [0];
  const fila = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!dentro[i] || rot[i]) continue;
    const r = areas.length;
    let ini = 0;
    let fim = 0;
    fila[fim++] = i;
    rot[i] = r;
    let area = 0;
    while (ini < fim) {
      const c = fila[ini++];
      area++;
      const x = c % w;
      const viz = [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c - w, c + w];
      for (const v of viz) {
        if (v >= 0 && v < w * h && dentro[v] && !rot[v]) {
          rot[v] = r;
          fila[fim++] = v;
        }
      }
    }
    areas.push(area);
  }
  return { w, h, rot, areas };
}

// Preenchimento par-ímpar por linhas de varredura (centro de cada célula).
function preencherPoligono(m: Uint8Array, w: number, h: number, pts: number[][]) {
  for (let y = 0; y < h; y++) {
    const cy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= cy && y2 > cy) || (y2 <= cy && y1 > cy)) xs.push(x1 + ((cy - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const ini = Math.max(0, Math.ceil(xs[k] - 0.5));
      const fim = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = ini; x <= fim; x++) m[y * w + x] = 1;
    }
  }
}

// Linha de corte: zera as células num traço de 3 células de largura.
function riscar(m: Uint8Array, w: number, h: number, a: readonly number[], b: readonly number[]) {
  const passos = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
  for (let s = 0; s <= passos; s++) {
    const x = Math.floor(a[0] + ((b[0] - a[0]) * s) / passos);
    const y = Math.floor(a[1] + ((b[1] - a[1]) * s) / passos);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) m[yy * w + xx] = 0;
      }
  }
}

// Rótulo da região num ponto (em fração da imagem). Em cima de uma linha, procura ao lado.
export function rotuloEm(g: Grade, [px, py]: Ponto): number {
  const cx = Math.floor(px * g.w);
  const cy = Math.floor(py * g.h);
  for (let raio = 0; raio <= 3; raio++)
    for (let dy = -raio; dy <= raio; dy++)
      for (let dx = -raio; dx <= raio; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < g.w && y < g.h && g.rot[y * g.w + x]) return g.rot[y * g.w + x];
      }
  return 0;
}

function dilatar(m: Uint8Array, w: number, h: number): Uint8Array {
  const r = new Uint8Array(m.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) r[yy * w + xx] = 1;
        }
    }
  return r;
}

function erodir(m: Uint8Array, w: number, h: number): Uint8Array {
  const r = new Uint8Array(m.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let ok = m[y * w + x] === 1;
      for (let dy = -1; ok && dy <= 1; dy++)
        for (let dx = -1; ok && dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          ok = xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx] === 1;
        }
      if (ok) r[y * w + x] = 1;
    }
  return r;
}

// Borda externa (Moore), a partir da primeira célula na ordem de leitura.
const DX = [-1, -1, 0, 1, 1, 1, 0, -1];
const DY = [0, -1, -1, -1, 0, 1, 1, 1];
function tracarBorda(m: Uint8Array, w: number, h: number): Array<[number, number]> {
  const ini = m.indexOf(1);
  if (ini < 0) return [];
  const sx = ini % w;
  const sy = Math.floor(ini / w);
  const val = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1;
  const pts: Array<[number, number]> = [[sx, sy]];
  let x = sx;
  let y = sy;
  let volta = 0; // direção de onde veio (oeste: a primeira célula não tem vizinho à esquerda)
  for (let it = 0; it < w * h * 4; it++) {
    let achou = -1;
    for (let k = 1; k <= 8; k++) {
      const d = (volta + k) % 8;
      if (val(x + DX[d], y + DY[d])) {
        achou = d;
        break;
      }
    }
    if (achou < 0) break;
    const nx = x + DX[achou];
    const ny = y + DY[achou];
    const anterior = (achou + 7) % 8;
    const bx = x + DX[anterior] - nx;
    const by = y + DY[anterior] - ny;
    volta = DX.findIndex((dx, k) => dx === bx && DY[k] === by);
    x = nx;
    y = ny;
    if (x === sx && y === sy) break;
    pts.push([x, y]);
  }
  return pts;
}

function simplificar(pts: Array<[number, number]>, eps: number): Array<[number, number]> {
  if (pts.length < 4) return pts;
  const manter = new Uint8Array(pts.length);
  manter[0] = manter[pts.length - 1] = 1;
  const pilha: Array<[number, number]> = [[0, pts.length - 1]];
  while (pilha.length) {
    const [a, b] = pilha.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let maior = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
      if (d > maior) {
        maior = d;
        idx = i;
      }
    }
    if (maior > eps && idx > 0) {
      manter[idx] = 1;
      pilha.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => manter[i]);
}

// Contorno da união das regiões (os rótulos), em fração da imagem; fica só o maior pedaço, se houver mais de um.
export function regiaoDe(g: Grade, rotulos: number[]): Ponto[] {
  const alvo = new Set(rotulos.filter((r) => r > 0));
  if (!alvo.size) return [];
  // trabalha só no retângulo das regiões (com folga), não na grade inteira
  let x0 = g.w, y0 = g.h, x1 = -1, y1 = -1;
  for (let i = 0; i < g.rot.length; i++) {
    if (!alvo.has(g.rot[i])) continue;
    const x = i % g.w;
    const y = (i - x) / g.w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return [];
  const f = 4;
  x0 = Math.max(0, x0 - f); y0 = Math.max(0, y0 - f);
  x1 = Math.min(g.w - 1, x1 + f); y1 = Math.min(g.h - 1, y1 + f);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  let m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (alvo.has(g.rot[(y + y0) * g.w + x + x0])) m[y * w + x] = 1;
  // fecha o vão das linhas entre regiões vizinhas e cobre metade da linha na borda
  m = erodir(dilatar(dilatar(m, w, h), w, h), w, h);
  m = maiorPedaco(m, w);
  const borda = tracarBorda(m, w, h);
  let eps = 0.6;
  let s = simplificar(borda, eps);
  while (s.length > MAX_PONTOS) {
    eps *= 1.4;
    s = simplificar(borda, eps);
  }
  if (s.length < 3) return [];
  return s.map(([x, y]) => [Math.round(((x + x0 + 0.5) / g.w) * 10000) / 10000, Math.round(((y + y0 + 0.5) / g.h) * 10000) / 10000]);
}

function maiorPedaco(m: Uint8Array, w: number): Uint8Array {
  const rot = new Int32Array(m.length);
  const fila = new Int32Array(m.length);
  let melhor = 0;
  let melhorArea = 0;
  let r = 0;
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || rot[i]) continue;
    r++;
    let ini = 0;
    let fim = 0;
    fila[fim++] = i;
    rot[i] = r;
    while (ini < fim) {
      const c = fila[ini++];
      const x = c % w;
      for (const v of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c - w, c + w])
        if (v >= 0 && v < m.length && m[v] && !rot[v]) {
          rot[v] = r;
          fila[fim++] = v;
        }
    }
    if (fim > melhorArea) {
      melhorArea = fim;
      melhor = r;
    }
  }
  const saida = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) if (rot[i] === melhor) saida[i] = 1;
  return saida;
}

// Todas as regiões calculadas (para o editor mostrar e o usuário clicar), sem migalhas.
export function todasAsRegioes(g: Grade, areaMinima = 40): Array<{ rotulo: number; regiao: Ponto[] }> {
  const lista: Array<{ rotulo: number; regiao: Ponto[] }> = [];
  for (let r = 1; r < g.areas.length; r++) {
    if (g.areas[r] < areaMinima) continue;
    const regiao = regiaoDe(g, [r]);
    if (regiao.length >= 3) lista.push({ rotulo: r, regiao });
  }
  return lista;
}

// Recalcula a região dos cortes que seguem as linhas (com âncora e não ajustados à mão).
export function recalcularCortes(mapa: Pick<MapaCortes, "largura" | "altura" | "cortes" | "contorno" | "linhas">, grade?: Grade | null): Corte[] {
  const g = grade ?? montarGrade(mapa.largura, mapa.altura, mapa.contorno ?? [], mapa.linhas ?? []);
  if (!g) return mapa.cortes;
  return mapa.cortes.map((c) => {
    if (c.manual || !c.sementes?.length) return c;
    const regiao = regiaoDe(g, c.sementes.map((s) => rotuloEm(g, s)));
    return JSON.stringify(regiao) === JSON.stringify(c.regiao) ? c : { ...c, regiao };
  });
}
