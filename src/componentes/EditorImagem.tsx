import { useEffect, useRef, useState, type PointerEvent as EventoPonteiro } from "react";
import { api } from "../api";
import { areaVisivel, corDoPixel, posicaoNoQuadro, removerFundoPorCor, type Cor, type Enquadramento } from "../imagem/processamento";

// Editor de imagem dos badges: remover o fundo (por cor ou com IA), enquadrar e redimensionar.
// Tudo acontece num canvas do navegador; só a remoção por IA passa pelo servidor (rembg).
// O resultado é sempre um PNG quadrado com fundo transparente.

const LADO_PREVIA = 320; // px na tela
const MAIOR_LADO = 1024; // imagens maiores são reduzidas ao abrir (badge não precisa de mais)
const TAMANHOS = [64, 128, 256, 512];

const paraHex = ([r, g, b]: Cor) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const deHex = (hex: string): Cor => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Cor;

async function abrirImagem(origem: File | string): Promise<HTMLImageElement> {
  // Imagem já salva na Moovin: baixada pelo nosso servidor, para o canvas poder ler os pixels.
  const blob = typeof origem === "string"
    ? await fetch(`/api/imagem/baixar?url=${encodeURIComponent(origem)}`, { credentials: "same-origin" }).then((r) => {
        if (!r.ok) throw new Error("não foi possível baixar a imagem salva");
        return r.blob();
      })
    : origem;
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Canvas com a imagem de trabalho (em tamanho natural, limitado a MAIOR_LADO).
function canvasDe(fonte: CanvasImageSource, largura: number, altura: number) {
  const escala = Math.min(1, MAIOR_LADO / Math.max(largura, altura));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(largura * escala));
  c.height = Math.max(1, Math.round(altura * escala));
  c.getContext("2d")!.drawImage(fonte, 0, 0, c.width, c.height);
  return c;
}

const copiar = (c: HTMLCanvasElement) => canvasDe(c, c.width, c.height);

export function EditorImagem({ origem, nome, concluir, fechar }: {
  origem: File | string;
  nome: string;
  concluir: (arquivo: File) => void | Promise<void>;
  fechar: () => void;
}) {
  const previa = useRef<HTMLCanvasElement>(null);
  const [trabalho, setTrabalho] = useState<HTMLCanvasElement | null>(null);
  const [historico, setHistorico] = useState<HTMLCanvasElement[]>([]);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [iaDisponivel, setIaDisponivel] = useState(false);
  const [lado, setLado] = useState(256);
  const [enq, setEnq] = useState<Enquadramento>({ zoom: 1, deslocX: 0, deslocY: 0, margem: 6 });
  const [aparar, setAparar] = useState(true);
  const [cor, setCor] = useState<Cor>([255, 255, 255]);
  const [tolerancia, setTolerancia] = useState(12);
  const [modo, setModo] = useState<"bordas" | "tudo">("bordas");
  const [contaGotas, setContaGotas] = useState(false);
  const arraste = useRef<{ x: number; y: number; deslocX: number; deslocY: number } | null>(null);

  useEffect(() => {
    abrirImagem(origem).then(
      (img) => {
        const c = canvasDe(img, img.naturalWidth || 512, img.naturalHeight || 512);
        setTrabalho(c);
        setCor(corDoPixel(c.getContext("2d")!.getImageData(0, 0, 1, 1).data, 1, 0, 0)); // cor do canto: provável fundo
      },
      (e) => setErro(`Não foi possível abrir a imagem: ${e.message}`),
    );
    api<{ removerFundoIa: boolean }>("imagem/recursos").then((r) => setIaDisponivel(r.removerFundoIa), () => setIaDisponivel(false));
  }, [origem]);

  // Área usada: a imagem inteira ou só a parte visível (aparar as sobras transparentes).
  function area(c: HTMLCanvasElement) {
    const inteira = { x: 0, y: 0, largura: c.width, altura: c.height };
    if (!aparar) return inteira;
    return areaVisivel(c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data, c.width, c.height) ?? inteira;
  }

  function desenhar(destino: HTMLCanvasElement, tamanho: number) {
    if (!trabalho) return;
    destino.width = tamanho;
    destino.height = tamanho;
    const ctx = destino.getContext("2d")!;
    ctx.clearRect(0, 0, tamanho, tamanho);
    ctx.imageSmoothingQuality = "high";
    const a = area(trabalho);
    const escala = tamanho / lado; // o deslocamento é guardado em px do tamanho final
    const p = posicaoNoQuadro(a, tamanho, { ...enq, deslocX: enq.deslocX * escala, deslocY: enq.deslocY * escala });
    ctx.drawImage(trabalho, a.x, a.y, a.largura, a.altura, p.x, p.y, p.largura, p.altura);
  }

  useEffect(() => {
    if (previa.current) desenhar(previa.current, LADO_PREVIA);
  });

  function novaVersao(c: HTMLCanvasElement) {
    if (trabalho) setHistorico((h) => [...h, trabalho].slice(-20));
    setTrabalho(c);
  }

  function removerPorCor() {
    if (!trabalho) return;
    const c = copiar(trabalho);
    const ctx = c.getContext("2d")!;
    const dados = ctx.getImageData(0, 0, c.width, c.height);
    removerFundoPorCor(dados.data, c.width, c.height, cor, tolerancia, modo);
    ctx.putImageData(dados, 0, 0);
    novaVersao(c);
  }

  async function removerComIa() {
    if (!trabalho) return;
    setErro("");
    setOcupado("Removendo o fundo com IA… (pode levar alguns segundos)");
    try {
      const r = await api<{ imagem: string }>("imagem/remover-fundo", { corpo: { imagem: trabalho.toDataURL("image/png") } });
      const img = new Image();
      img.src = r.imagem;
      await img.decode();
      novaVersao(canvasDe(img, img.naturalWidth, img.naturalHeight));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado("");
    }
  }

  function desfazer() {
    if (!historico.length) return;
    setTrabalho(historico[historico.length - 1]);
    setHistorico(historico.slice(0, -1));
  }

  // Ponto da prévia → pixel da imagem de trabalho (para o conta-gotas).
  function pixelSob(e: EventoPonteiro<HTMLCanvasElement>) {
    if (!trabalho) return null;
    const caixa = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - caixa.left) / caixa.width) * LADO_PREVIA;
    const py = ((e.clientY - caixa.top) / caixa.height) * LADO_PREVIA;
    const a = area(trabalho);
    const escala = LADO_PREVIA / lado;
    const p = posicaoNoQuadro(a, LADO_PREVIA, { ...enq, deslocX: enq.deslocX * escala, deslocY: enq.deslocY * escala });
    const x = Math.floor(a.x + ((px - p.x) / p.largura) * a.largura);
    const y = Math.floor(a.y + ((py - p.y) / p.altura) * a.altura);
    return x >= 0 && y >= 0 && x < trabalho.width && y < trabalho.height ? { x, y } : null;
  }

  function aoPressionar(e: EventoPonteiro<HTMLCanvasElement>) {
    if (contaGotas) {
      const ponto = pixelSob(e);
      if (ponto && trabalho) setCor(corDoPixel(trabalho.getContext("2d")!.getImageData(ponto.x, ponto.y, 1, 1).data, 1, 0, 0));
      setContaGotas(false);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    arraste.current = { x: e.clientX, y: e.clientY, deslocX: enq.deslocX, deslocY: enq.deslocY };
  }

  function aoMover(e: EventoPonteiro<HTMLCanvasElement>) {
    const a = arraste.current;
    if (!a) return;
    const escala = lado / e.currentTarget.getBoundingClientRect().width; // px da tela → px do tamanho final
    setEnq((v) => ({ ...v, deslocX: a.deslocX + (e.clientX - a.x) * escala, deslocY: a.deslocY + (e.clientY - a.y) * escala }));
  }

  async function aplicar() {
    if (!trabalho) return;
    setOcupado("Salvando a imagem…");
    try {
      const saida = document.createElement("canvas");
      desenhar(saida, lado);
      const blob = await new Promise<Blob | null>((ok) => saida.toBlob(ok, "image/png"));
      if (!blob) throw new Error("não foi possível gerar o PNG");
      await concluir(new File([blob], `${nome || "badge"}.png`, { type: "image/png" }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setOcupado("");
    }
  }

  return (
    <div className="previa-tela" role="dialog" aria-label="Editor de imagem">
      <header className="previa-barra">
        <strong>Editar imagem do badge</strong>
        <div className="heading-actions">
          <button type="button" className="button button-secondary" onClick={fechar}>Cancelar</button>
          <button type="button" className="button button-primary" disabled={!trabalho || !!ocupado} onClick={aplicar}>Usar esta imagem</button>
        </div>
      </header>
      <div className="editor-imagem">
        <div className="editor-imagem-area">
          {erro && <p className="caixa-erros">{erro}</p>}
          {ocupado && <p className="aviso">{ocupado}</p>}
          <canvas
            ref={previa}
            className={contaGotas ? "editor-imagem-canvas conta-gotas" : "editor-imagem-canvas"}
            style={{ width: LADO_PREVIA, height: LADO_PREVIA }}
            onPointerDown={aoPressionar}
            onPointerMove={aoMover}
            onPointerUp={() => { arraste.current = null; }}
            onWheel={(e) => setEnq((v) => ({ ...v, zoom: Math.min(6, Math.max(0.2, v.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))) }))}
          />
          {!trabalho && !erro && <p className="vazio">Abrindo a imagem…</p>}
          <small className="campo-dica">Arraste para mover; role a roda do mouse para o zoom. O xadrez é a parte transparente.</small>
        </div>

        <div className="editor-imagem-controles">
          <fieldset>
            <legend>Remover o fundo</legend>
            {iaDisponivel ? (
              <button type="button" className="button button-secondary" disabled={!trabalho || !!ocupado} onClick={removerComIa}>
                ✦ Remover fundo com IA
              </button>
            ) : (
              <small className="campo-dica">Remoção por IA não configurada no servidor.</small>
            )}
            <div className="linha-campos">
              <label className="campo">
                <span className="campo-rotulo">Cor do fundo</span>
                <span className="entrada-com-botao">
                  <input type="color" value={paraHex(cor)} onChange={(e) => setCor(deHex(e.target.value))} />
                  <button type="button" className={contaGotas ? "button button-primary" : "button button-plain"} onClick={() => setContaGotas((v) => !v)}>
                    {contaGotas ? "Clique na imagem" : "Conta-gotas"}
                  </button>
                </span>
              </label>
              <label className="campo">
                <span className="campo-rotulo">Tolerância: {tolerancia}</span>
                <input type="range" min={0} max={60} value={tolerancia} onChange={(e) => setTolerancia(Number(e.target.value))} />
              </label>
            </div>
            <label className="campo-check">
              <input type="checkbox" checked={modo === "bordas"} onChange={(e) => setModo(e.target.checked ? "bordas" : "tudo")} />
              Só o fundo ligado às bordas (preserva partes internas da mesma cor)
            </label>
            <button type="button" className="button button-secondary" disabled={!trabalho || !!ocupado} onClick={removerPorCor}>Remover esta cor</button>
          </fieldset>

          <fieldset>
            <legend>Enquadrar e redimensionar</legend>
            <label className="campo">
              <span className="campo-rotulo">Tamanho final (quadrado)</span>
              <select className="entrada" value={lado} onChange={(e) => setLado(Number(e.target.value))}>
                {TAMANHOS.map((t) => <option key={t} value={t}>{t} × {t} px</option>)}
              </select>
            </label>
            <label className="campo">
              <span className="campo-rotulo">Zoom: {Math.round(enq.zoom * 100)}%</span>
              <input type="range" min={20} max={600} value={Math.round(enq.zoom * 100)} onChange={(e) => setEnq((v) => ({ ...v, zoom: Number(e.target.value) / 100 }))} />
            </label>
            <label className="campo">
              <span className="campo-rotulo">Margem: {enq.margem}%</span>
              <input type="range" min={0} max={30} value={enq.margem} onChange={(e) => setEnq((v) => ({ ...v, margem: Number(e.target.value) }))} />
            </label>
            <label className="campo-check">
              <input type="checkbox" checked={aparar} onChange={(e) => setAparar(e.target.checked)} />
              Aparar as sobras transparentes
            </label>
            <button type="button" className="button button-plain" onClick={() => setEnq((v) => ({ ...v, zoom: 1, deslocX: 0, deslocY: 0 }))}>Centralizar</button>
          </fieldset>

          <button type="button" className="button button-plain" disabled={!historico.length} onClick={desfazer}>↶ Desfazer</button>
        </div>
      </div>
    </div>
  );
}
