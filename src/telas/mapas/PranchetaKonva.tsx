import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Circle, Group, Image as KImage, Layer, Line, Stage, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Corte, LinhaCorte, Ponto } from "../../templater/produto";
import type { DadosMapa } from "../../produtos/mapas";
import { centroDaRegiao } from "../../produtos/mapas";

// Prancheta do editor de mapas (Konva): zoom com a roda e por botões, arraste da imagem, pontos
// arrastáveis, inserir ponto clicando na linha, apagar ponto com Delete, encaixe em pontos e linhas
// vizinhos e setas do teclado para ajuste fino. Os modos:
//   contorno: o contorno do animal; linhas: as linhas de corte; cortes: clicar nas regiões que formam
//   o corte selecionado; ajuste: mexer direto nos pontos do corte selecionado (vira "manual").

export type Modo = "contorno" | "linhas" | "cortes" | "ajuste";
type Alvo = { tipo: "contorno" } | { tipo: "linha"; id: string } | { tipo: "corte"; id: string };
type Vertice = { alvo: Alvo; i: number };

Konva.dragDistance = 4; // arrastar a imagem não conta como clique

const CORES = ["#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe", "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000", "#aaffc3"];
const ACENTO = "#c08a4e";

function useImagem(url: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return;
    const i = new window.Image();
    i.onload = () => setImg(i);
    i.src = url;
    return () => { i.onload = null; };
  }, [url]);
  return img;
}

// Ponto mais próximo de P num segmento AB (em pixels da imagem) e a distância.
function noSegmento(p: number[], a: number[], b: number[]) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  const q = [a[0] + t * dx, a[1] + t * dy];
  return { q, d: Math.hypot(p[0] - q[0], p[1] - q[1]), t };
}

export function PranchetaKonva({ mapa, modo, selecionado, regioes, rotulosDoSelecionado, alterar, marcar, clicarRegiao, selecionarCorte, desfazer, refazer }: {
  mapa: DadosMapa;
  modo: Modo;
  selecionado: Corte | null;
  regioes: Array<{ rotulo: number; regiao: Ponto[] }>; // regiões calculadas pelas linhas
  rotulosDoSelecionado: Set<number>;
  alterar: (f: (d: DadosMapa) => DadosMapa) => void; // muda sem registrar no histórico (arraste)
  marcar: () => void; // registra o estado atual no histórico (antes de uma mudança)
  clicarRegiao: (p: Ponto) => void;
  selecionarCorte: (id: string) => void;
  desfazer: () => void;
  refazer: () => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const img = useImagem(mapa.imagem);
  const { largura: W, altura: H } = mapa;
  const [tam, setTam] = useState({ w: 800, h: 520 });
  const [vista, setVista] = useState({ escala: 1, x: 0, y: 0 });
  const [rascunho, setRascunho] = useState<Ponto[]>([]); // contorno ou linha sendo desenhado
  const [ponteiro, setPonteiro] = useState<Ponto | null>(null);
  const [vertice, setVertice] = useState<Vertice | null>(null);
  const [linhaSel, setLinhaSel] = useState<string | null>(null);
  const contorno = useMemo(() => mapa.contorno ?? [], [mapa.contorno]);
  const linhas = useMemo(() => mapa.linhas ?? [], [mapa.linhas]);
  const px = (p: Ponto) => [p[0] * W, p[1] * H];
  const norm = (x: number, y: number): Ponto => [Math.round(Math.min(1, Math.max(0, x / W)) * 10000) / 10000, Math.round(Math.min(1, Math.max(0, y / H)) * 10000) / 10000];
  const tela = (v: number) => v / vista.escala; // tamanho constante na tela

  // tamanho da prancheta: a largura da coluna e a altura na proporção da imagem (até 72% da tela)
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => {
      const w = el.clientWidth;
      const h = Math.round(Math.max(360, Math.min(window.innerHeight * 0.72, (w * H) / Math.max(1, W) * 1.06)));
      setTam((t) => (t.w === w && t.h === h ? t : { w, h }));
    };
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [W, H]);

  const ajustar = useCallback(() => {
    if (!W || !H) return;
    const escala = Math.min(tam.w / W, tam.h / H) * 0.96;
    setVista({ escala, x: (tam.w - W * escala) / 2, y: (tam.h - H * escala) / 2 });
  }, [W, H, tam.w, tam.h]);
  useEffect(() => { ajustar(); }, [ajustar]);

  function zoom(fator: number, centro?: { x: number; y: number }) {
    const c = centro ?? { x: tam.w / 2, y: tam.h / 2 };
    setVista((v) => {
      const escala = Math.min(40, Math.max(0.05, v.escala * fator));
      const ix = (c.x - v.x) / v.escala;
      const iy = (c.y - v.y) / v.escala;
      return { escala, x: c.x - ix * escala, y: c.y - iy * escala };
    });
  }

  // Encaixe: ponto ou linha vizinha mais próxima (até 10 px na tela), sem contar o próprio ponto.
  function encaixar(p: number[], ignorar?: Vertice): number[] {
    const tol = tela(10);
    let melhor = p;
    let dist = tol;
    const proprio = (alvo: Alvo, i: number) => ignorar && JSON.stringify(ignorar.alvo) === JSON.stringify(alvo) && ignorar.i === i;
    const grupos: Array<{ alvo: Alvo; pts: number[][]; fechado: boolean }> = [
      ...(contorno.length ? [{ alvo: { tipo: "contorno" } as Alvo, pts: contorno.map(px), fechado: true }] : []),
      ...linhas.map((l) => ({ alvo: { tipo: "linha", id: l.id } as Alvo, pts: l.pontos.map(px), fechado: false })),
    ];
    for (const g of grupos)
      g.pts.forEach((q, i) => {
        if (proprio(g.alvo, i)) return;
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (d < dist) { dist = d; melhor = q; }
      });
    if (melhor !== p) return melhor; // ponto tem prioridade sobre a linha
    for (const g of grupos) {
      const n = g.pts.length;
      for (let i = 0; i < (g.fechado ? n : n - 1); i++) {
        if (proprio(g.alvo, i) || proprio(g.alvo, (i + 1) % n)) continue;
        const { q, d } = noSegmento(p, g.pts[i], g.pts[(i + 1) % n]);
        if (d < dist) { dist = d; melhor = q; }
      }
    }
    return melhor;
  }

  const posicao = () => {
    const p = stage.current?.getRelativePointerPosition();
    return p ? [p.x, p.y] : null;
  };

  function pontosDe(alvo: Alvo): Ponto[] {
    if (alvo.tipo === "contorno") return contorno;
    if (alvo.tipo === "linha") return linhas.find((l) => l.id === alvo.id)?.pontos ?? [];
    return mapa.cortes.find((c) => c.id === alvo.id)?.regiao ?? [];
  }

  function trocarPontos(d: DadosMapa, alvo: Alvo, pts: Ponto[]): DadosMapa {
    if (alvo.tipo === "contorno") return { ...d, contorno: pts };
    if (alvo.tipo === "linha") return { ...d, linhas: (d.linhas ?? []).map((l) => (l.id === alvo.id ? { ...l, pontos: pts } : l)) };
    return { ...d, cortes: d.cortes.map((c) => (c.id === alvo.id ? { ...c, regiao: pts, manual: true } : c)) };
  }

  // clique na imagem (sem arrastar)
  function aoClicar(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (e.target !== e.target.getStage() && e.target.name() !== "fundo" && e.target.name() !== "regiao") return;
    const p = posicao();
    if (!p) return;
    setVertice(null);
    setLinhaSel(null);
    if (modo === "cortes") return clicarRegiao(norm(p[0], p[1]));
    const desenhandoCorte = modo === "ajuste" && !!selecionado && selecionado.regiao.length < 3;
    if ((modo === "contorno" && (contorno.length === 0 || rascunho.length)) || desenhandoCorte) {
      const q = encaixar(p);
      if (rascunho.length >= 3) {
        const [ix, iy] = px(rascunho[0]);
        if (Math.hypot(q[0] - ix, q[1] - iy) < tela(12)) return fecharContorno();
      }
      setRascunho((r) => [...r, norm(q[0], q[1])]);
    }
    if (modo === "linhas") {
      // clicar de novo no último ponto (ou duplo clique) conclui a linha
      const u = rascunho[rascunho.length - 1];
      if (u && Math.hypot(p[0] - u[0] * W, p[1] - u[1] * H) < tela(8)) return concluirLinha();
      const q = encaixar(p);
      setRascunho((r) => [...r, norm(q[0], q[1])]);
    }
  }

  function fecharContorno() {
    if (rascunho.length < 3) return;
    marcar();
    if (modo === "ajuste" && selecionado) {
      const id = selecionado.id;
      alterar((d) => ({ ...d, cortes: d.cortes.map((c) => (c.id === id ? { ...c, regiao: rascunho, manual: true } : c)) }));
    } else alterar((d) => ({ ...d, contorno: rascunho }));
    setRascunho([]);
  }

  function concluirLinha() {
    if (rascunho.length >= 2) {
      marcar();
      const nova: LinhaCorte = { id: crypto.randomUUID ? crypto.randomUUID() : `l${Date.now()}`, pontos: rascunho };
      alterar((d) => ({ ...d, linhas: [...(d.linhas ?? []), nova] }));
    }
    setRascunho([]);
  }

  // clique numa linha existente: insere um ponto nela (contorno, linha de corte ou corte em ajuste)
  function inserirNaLinha(alvo: Alvo) {
    const p = posicao();
    if (!p) return;
    const pts = pontosDe(alvo);
    const fechado = alvo.tipo !== "linha";
    let melhor = { i: -1, d: Infinity, q: p };
    for (let i = 0; i < (fechado ? pts.length : pts.length - 1); i++) {
      const r = noSegmento(p, px(pts[i]), px(pts[(i + 1) % pts.length]));
      if (r.d < melhor.d) melhor = { i, d: r.d, q: r.q };
    }
    if (melhor.i < 0) return;
    marcar();
    const novo = [...pts];
    novo.splice(melhor.i + 1, 0, norm(melhor.q[0], melhor.q[1]));
    alterar((d) => trocarPontos(d, alvo, novo));
    setVertice({ alvo, i: melhor.i + 1 });
  }

  function apagarVertice(v: Vertice) {
    const pts = pontosDe(v.alvo);
    marcar();
    if (v.alvo.tipo === "linha" && pts.length <= 2) {
      const id = v.alvo.id;
      alterar((d) => ({ ...d, linhas: (d.linhas ?? []).filter((l) => l.id !== id) }));
    } else if (pts.length > 3 || v.alvo.tipo === "linha") {
      alterar((d) => trocarPontos(d, v.alvo, pts.filter((_, i) => i !== v.i)));
    }
    setVertice(null);
  }

  // teclado: Enter conclui, Esc cancela, Backspace tira o último ponto do rascunho, Delete apaga,
  // setas movem o ponto selecionado (Shift = 10×), Ctrl+Z / Ctrl+Y desfazem e refazem
  function teclado(e: React.KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); return e.shiftKey ? refazer() : desfazer(); }
    if (ctrl && e.key.toLowerCase() === "y") { e.preventDefault(); return refazer(); }
    if (e.key === "Enter") { e.preventDefault(); return modo === "linhas" ? concluirLinha() : fecharContorno(); }
    if (e.key === "Escape") { setRascunho([]); setVertice(null); setLinhaSel(null); return; }
    if (e.key === "Backspace" && rascunho.length) { e.preventDefault(); return setRascunho((r) => r.slice(0, -1)); }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (vertice) { e.preventDefault(); return apagarVertice(vertice); }
      if (linhaSel) {
        e.preventDefault();
        marcar();
        const id = linhaSel;
        alterar((d) => ({ ...d, linhas: (d.linhas ?? []).filter((l) => l.id !== id) }));
        return setLinhaSel(null);
      }
    }
    const setas: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (vertice && setas[e.key]) {
      e.preventDefault();
      const passo = tela(e.shiftKey ? 10 : 1);
      const pts = pontosDe(vertice.alvo);
      const [x, y] = px(pts[vertice.i]);
      marcar();
      alterar((d) => trocarPontos(d, vertice.alvo, pts.map((p, i) => (i === vertice.i ? norm(x + setas[e.key][0] * passo, y + setas[e.key][1] * passo) : p))));
    }
  }

  // pontos arrastáveis de um contorno, linha ou corte
  function vertices(alvo: Alvo, cor: string) {
    const pts = pontosDe(alvo);
    const chave = alvo.tipo === "contorno" ? "contorno" : `${alvo.tipo}-${alvo.id}`;
    return (
      <Group key={chave}>
        {pts.map((p, i) => {
          const [x, y] = px(p);
          const sel = vertice && JSON.stringify(vertice.alvo) === JSON.stringify(alvo) && vertice.i === i;
          return (
            <Circle key={i} x={x} y={y} radius={tela(sel ? 7 : 5)} fill={sel ? ACENTO : "#ffffff"} stroke={cor} strokeWidth={tela(2)} draggable
              onMouseDown={(e) => { e.cancelBubble = true; }}
              onClick={(e) => { e.cancelBubble = true; setVertice({ alvo, i }); setLinhaSel(null); }}
              onDragStart={(e) => { e.cancelBubble = true; marcar(); setVertice({ alvo, i }); }}
              onDragMove={(e) => {
                e.cancelBubble = true;
                const q = alvo.tipo === "corte" ? [e.target.x(), e.target.y()] : encaixar([e.target.x(), e.target.y()], { alvo, i });
                e.target.position({ x: q[0], y: q[1] });
                alterar((d) => trocarPontos(d, alvo, pontosDe(alvo).map((pp, k) => (k === i ? norm(q[0], q[1]) : pp))));
              }}
              onDragEnd={(e) => { e.cancelBubble = true; }}
            />
          );
        })}
      </Group>
    );
  }

  const plano = (pts: Ponto[]) => pts.flatMap(px);
  const corDoCorte = (c: Corte) => CORES[(c.numero || 0) % CORES.length];

  return (
    <>
      <div className="prancheta-konva" ref={caixa} tabIndex={0} onKeyDown={teclado} style={{ height: tam.h }}>
        <div className="prancheta-zoom">
          <button type="button" title="Aproximar" onClick={() => zoom(1.25)}>+</button>
          <button type="button" title="Afastar" onClick={() => zoom(0.8)}>−</button>
          <button type="button" title="Ver o animal inteiro" onClick={ajustar}>⤢</button>
          <span>{Math.round(vista.escala * 100)}%</span>
        </div>
        <Stage ref={stage} width={tam.w} height={tam.h} draggable scaleX={vista.escala} scaleY={vista.escala} x={vista.x} y={vista.y}
          onDragEnd={(e) => { if (e.target === e.target.getStage()) setVista((v) => ({ ...v, x: e.target.x(), y: e.target.y() })); }}
          onWheel={(e) => {
            e.evt.preventDefault();
            const p = stage.current?.getPointerPosition();
            zoom(e.evt.deltaY < 0 ? 1.12 : 1 / 1.12, p ?? undefined);
          }}
          onMouseDown={() => caixa.current?.focus({ preventScroll: true })}
          onClick={aoClicar} onTap={aoClicar}
          onMouseMove={() => { const p = posicao(); setPonteiro(p ? norm(p[0], p[1]) : null); }}
          onMouseLeave={() => setPonteiro(null)}
        >
          <Layer>
            {img ? <KImage image={img} width={W} height={H} name="fundo" /> : null}

            {/* regiões calculadas pelas linhas (modo cortes): as do corte selecionado em destaque */}
            {modo === "cortes" && regioes.map((r) => (
              <Line key={r.rotulo} points={plano(r.regiao)} closed name="regiao"
                fill={rotulosDoSelecionado.has(r.rotulo) ? "rgba(192,138,78,.55)" : "rgba(255,255,255,.12)"}
                stroke={rotulosDoSelecionado.has(r.rotulo) ? ACENTO : "rgba(255,255,255,.5)"} strokeWidth={tela(1)} />
            ))}

            {/* cortes: contorno e número */}
            {mapa.cortes.filter((c) => c.regiao.length >= 3).map((c) => {
              const ativo = c.id === selecionado?.id;
              const centro = centroDaRegiao(c.regiao);
              if (modo === "cortes" && !ativo) return null;
              return (
                <Group key={c.id} onClick={(e) => { if (modo === "ajuste") { e.cancelBubble = true; selecionarCorte(c.id); } }}>
                  <Line points={plano(c.regiao)} closed stroke={ativo ? ACENTO : corDoCorte(c)} strokeWidth={tela(ativo ? 3 : 1.5)}
                    fill={ativo && modo === "ajuste" ? "rgba(192,138,78,.25)" : undefined} hitStrokeWidth={tela(12)}
                    onClick={(e) => { if (modo === "ajuste" && ativo) { e.cancelBubble = true; inserirNaLinha({ tipo: "corte", id: c.id }); } }} />
                  {centro && (
                    <>
                      <Circle x={centro[0] * W} y={centro[1] * H} radius={tela(11)} fill={ativo ? ACENTO : "rgba(23,58,77,.85)"} listening={false} />
                      <Text x={centro[0] * W - tela(11)} y={centro[1] * H - tela(7)} width={tela(22)} align="center" text={String(c.numero)} fontSize={tela(12)} fill="#fff" fontStyle="bold" listening={false} />
                    </>
                  )}
                </Group>
              );
            })}

            {/* contorno do animal */}
            {contorno.length >= 3 && (
              <Line points={plano(contorno)} closed stroke="#ffffff" strokeWidth={tela(modo === "contorno" ? 2.5 : 1.5)} dash={modo === "contorno" ? undefined : [tela(6), tela(4)]}
                hitStrokeWidth={tela(12)} listening={modo === "contorno"} onClick={(e) => { e.cancelBubble = true; inserirNaLinha({ tipo: "contorno" }); }} />
            )}

            {/* linhas de corte */}
            {linhas.map((l) => (
              <Line key={l.id} points={plano(l.pontos)} stroke={linhaSel === l.id ? ACENTO : "#ffe9c4"} strokeWidth={tela(modo === "linhas" ? 2.5 : 1.8)}
                dash={[tela(8), tela(5)]} hitStrokeWidth={tela(12)} listening={modo === "linhas"}
                onClick={(e) => { e.cancelBubble = true; if (e.evt.shiftKey) { setLinhaSel(l.id); setVertice(null); } else inserirNaLinha({ tipo: "linha", id: l.id }); }} />
            ))}

            {/* pontos editáveis do modo atual */}
            {modo === "contorno" && contorno.length >= 3 && vertices({ tipo: "contorno" }, "#173a4d")}
            {modo === "linhas" && linhas.map((l) => vertices({ tipo: "linha", id: l.id }, "#7a5a2a"))}
            {modo === "ajuste" && selecionado && selecionado.regiao.length >= 3 && vertices({ tipo: "corte", id: selecionado.id }, ACENTO)}

            {/* desenho em andamento, com o elástico até o ponteiro */}
            {rascunho.length > 0 && (
              <>
                <Line points={[...plano(rascunho), ...(ponteiro ? px(ponteiro) : [])]} stroke={ACENTO} strokeWidth={tela(2)} dash={[tela(6), tela(4)]} listening={false} />
                {rascunho.map((p, i) => <Circle key={i} x={p[0] * W} y={p[1] * H} radius={tela(i === 0 ? 7 : 4)} fill={i === 0 ? ACENTO : "#fff"} listening={false} />)}
              </>
            )}
          </Layer>
        </Stage>
      </div>
      <div className="prancheta-ajuda">
        {modo === "contorno" && (contorno.length === 0 || rascunho.length
          ? "Clique em volta do animal, ponto a ponto. Feche clicando no primeiro ponto (ou Enter). Backspace tira o último ponto."
          : "Arraste os pontos para ajustar. Clique na linha para inserir um ponto; selecione um ponto e tecle Delete para apagar; setas movem o ponto selecionado.")}
        {modo === "linhas" && "Clique para desenhar uma linha de corte; clique de novo no último ponto (ou Enter) para concluir. As pontas encaixam no contorno e nas outras linhas. Clique numa linha para inserir ponto; Shift+clique seleciona a linha (Delete apaga)."}
        {modo === "cortes" && (selecionado ? `Clique nas regiões que formam "${selecionado.nome || selecionado.numero}". Clique de novo para tirar.` : "Selecione um corte na lista e clique nas regiões dele.")}
        {modo === "ajuste" && (!selecionado ? "Selecione um corte na lista." : selecionado.regiao.length < 3
          ? "Corte sem região: clique em volta dele, ponto a ponto, e feche no primeiro ponto (ou Enter)."
          : "Arraste os pontos do corte; clique na borda para inserir ponto. Ao ajustar à mão, o corte deixa de seguir as linhas (dá para voltar no formulário).")}
        {" "}Roda do mouse: zoom. Arraste a imagem para mover. Ctrl+Z desfaz.
      </div>
    </>
  );
}
