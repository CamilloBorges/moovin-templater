import React, { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import DOMPurify from "dompurify";
import {
  formatarMoeda, precoPorUnidade, quantidadeComercial, textoUnidade, unidadesDe, type Aba, type Badge, type MapaCorteResolvido, type ProdutoTemplate,
} from "./produto";
import { pontosSvg } from "./mapa";
import { estilo, useFontes, varsTexto, type EstiloTexto } from "./estilo";

// Blocos da página de produto. São os mesmos componentes no editor (prévia, dentro do Puck) e na
// loja (script servido por URL), para a prévia ficar igual à página publicada.
// Na loja, a compra é da Moovin: os botões daqui acionam os botões nativos, que ficam escondidos.

export type EstadoCompra = { preco: number; quantidade: string; textoComprar: string };

// Ligação com a página nativa da Moovin (só na loja). Ver src/loja/nativo.ts.
export type LigacaoLoja = {
  estado(): EstadoCompra; // devolve o mesmo objeto enquanto nada muda (useSyncExternalStore)
  assinar(aoMudar: () => void): () => void;
  alterarQuantidade(delta: 1 | -1): void;
  comprar(): void;
};

type Ambiente = { produto: ProdutoTemplate; editando: boolean; loja?: LigacaoLoja };
const AmbienteContexto = createContext<Ambiente | null>(null);
export const AmbienteProvider = AmbienteContexto.Provider;

function useAmbiente() {
  const ambiente = useContext(AmbienteContexto);
  if (!ambiente) throw new Error("Bloco fora do AmbienteProvider");
  return ambiente;
}

// No editor não há loja: o hook é chamado do mesmo jeito, com uma fonte parada e constante.
const semAssinatura = () => () => {};
const SEM_ESTADO: EstadoCompra | null = null;
const semEstado = () => SEM_ESTADO;

function useCompra() {
  const { produto, loja } = useAmbiente();
  const estado = useSyncExternalStore<EstadoCompra | null>(loja ? loja.assinar : semAssinatura, loja ? loja.estado : semEstado);
  return {
    ...(estado ?? { preco: produto.moovin.preco, quantidade: "1", textoComprar: "COMPRAR" }),
    mais: () => loja?.alterarQuantidade(1),
    menos: () => loja?.alterarQuantidade(-1),
    comprar: () => loja?.comprar(),
  };
}

const html = (conteudo: string) => ({ __html: DOMPurify.sanitize(conteudo) });
type Slot = (className: string, style?: CSSProperties) => ReactNode;
type SimNao = "sim" | "nao";

function Vazio({ texto }: { texto: string }) {
  return useAmbiente().editando ? <div className="tpl-vazio">{texto}</div> : null;
}

export function Raiz({ corPrincipal, corDestaque, naLoja = false, children }: { corPrincipal: string; corDestaque: string; naLoja?: boolean; children: ReactNode }) {
  return (
    <div className={naLoja ? "tpl tpl-loja" : "tpl"} style={{ "--tpl-principal": corPrincipal, "--tpl-destaque": corDestaque } as CSSProperties}>
      {children}
    </div>
  );
}

export function Colunas({ proporcao, esquerda, direita }: { proporcao: string; esquerda: Slot; direita: Slot }) {
  const [a, b] = proporcao.split("/");
  return (
    <div className="tpl-colunas" style={{ gridTemplateColumns: `${a}fr ${b}fr` }}>
      {esquerda("tpl-coluna")}
      {direita("tpl-coluna")}
    </div>
  );
}

export type PropsCartao = {
  cantos?: "arredondados" | "retos";
  fundo?: "cor" | "imagem" | "nenhum" | "branco" | "transparente"; // branco/transparente: templates antigos
  corFundo?: string;
  imagemFundo?: string;
  ajusteImagem?: "cobrir" | "ajustar";
  sombra?: SimNao;
};

// Fundo e cantos do cartão. Templates antigos: "branco" = cor branca; "transparente" = sem fundo.
export function estiloCartao(p: PropsCartao): { classe: string; style: CSSProperties } {
  const fundo = p.fundo === "branco" ? "cor" : p.fundo === "transparente" ? "nenhum" : p.fundo ?? "cor";
  const style: CSSProperties = {};
  if (fundo === "cor") style.background = /^#[0-9a-f]{6}$/i.test(p.corFundo ?? "") ? p.corFundo : "#ffffff";
  if (fundo === "imagem" && p.imagemFundo) {
    style.backgroundImage = `url("${encodeURI(p.imagemFundo)}")`;
    style.backgroundSize = p.ajusteImagem === "ajustar" ? "contain" : "cover";
    style.backgroundPosition = "center";
    style.backgroundRepeat = "no-repeat";
  }
  const classes = ["tpl-cartao", `tpl-cartao-${fundo}`];
  if (p.cantos === "retos") classes.push("tpl-cantos-retos");
  if (fundo !== "nenhum" && p.sombra !== "nao") classes.push("tpl-cartao-sombra");
  return { classe: classes.join(" "), style };
}

export function Cartao({ conteudo, ...props }: PropsCartao & { conteudo: Slot }) {
  const { classe, style } = estiloCartao(props);
  return <>{conteudo(classe, style)}</>;
}

// Tamanho padrão da galeria, definido no template: todas as fotos saem no mesmo formato,
// mesmo que no cadastro tenham tamanhos diferentes. Sem os campos (templates antigos), fica
// como antes: a foto no formato original, na largura da coluna.
export type FormatoGaleria = "original" | "1/1" | "4/5" | "3/4" | "4/3" | "3/2" | "16/9";
export type PropsGaleria = {
  sombra?: SimNao;
  formato?: FormatoGaleria;
  encaixe?: "preencher" | "inteira"; // preencher recorta as bordas; inteira mostra a foto toda, com fundo
  fundo?: string; // cor atrás da foto inteira
  largura?: number; // largura máxima em px (0 = a coluna toda)
  cantos?: number; // raio em px
  miniaturas?: number; // lado da miniatura em px (0 = sem miniaturas)
};

const FORMATOS: FormatoGaleria[] = ["original", "1/1", "4/5", "3/4", "4/3", "3/2", "16/9"];
const pxValido = (v: unknown, padrao: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : padrao;
};

export function estiloGaleria(p: PropsGaleria): CSSProperties {
  const formato = FORMATOS.includes(p.formato as FormatoGaleria) ? p.formato! : "original";
  const vars: Record<string, string> = {
    "--tpl-galeria-proporcao": formato === "original" ? "auto" : formato,
    // A imagem do Mapa de Corte segue o formato da galeria; no original, 4:5 (como um post).
    "--tpl-galeria-proporcao-mapa": formato === "original" ? "4/5" : formato,
    // No formato original a foto já tem a proporção dela: nada a recortar.
    "--tpl-galeria-ajuste": formato !== "original" && p.encaixe === "inteira" ? "contain" : "cover",
    "--tpl-galeria-cantos": `${pxValido(p.cantos, 18, 60)}px`,
    // Miniatura no mesmo formato da foto principal (no original, quadrada).
    "--tpl-miniatura-proporcao": formato === "original" ? "1/1" : formato,
    "--tpl-miniatura-tamanho": `${pxValido(p.miniaturas, 64, 160) || 64}px`,
  };
  const largura = pxValido(p.largura, 0, 2000);
  if (largura) vars["--tpl-galeria-largura"] = `${largura}px`;
  if (formato !== "original" && p.encaixe === "inteira" && /^#[0-9a-f]{6}$/i.test(p.fundo ?? "")) vars["--tpl-galeria-fundo"] = p.fundo!;
  return vars as CSSProperties;
}

// Visual da imagem do Mapa de Corte (último item da galeria), definido no template.
export type PropsMapaCorte = {
  mostrar?: SimNao;
  fundo?: string;
  logo?: string; // imagem no topo (ex.: o logotipo do Armazém)
  titulo?: EstiloTexto; // nome do produto
  texto?: EstiloTexto; // descrição do corte
  corRegiao?: string; // cor que destaca a região do corte
};

const corOu = (cor: string | undefined, padrao: string) => (/^#[0-9a-f]{6}$/i.test(cor ?? "") ? cor! : padrao);

// O animal com a região do corte destacada (sem textos): na imagem do mapa e na miniatura.
function DesenhoMapa({ mapa, corRegiao }: { mapa: MapaCorteResolvido; corRegiao: string }) {
  const { largura: w, altura: h } = mapa;
  return (
    <svg className="tpl-mapa-desenho" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Origem do corte: ${mapa.corte}`}>
      <image href={mapa.imagem} width={w} height={h} />
      <polygon points={pontosSvg(mapa.regiao, w, h)} fill={corRegiao} fillOpacity={0.9} stroke={corRegiao} strokeWidth={Math.max(w, h) / 400} strokeLinejoin="round" />
    </svg>
  );
}

// Imagem do Mapa de Corte, como o card do Ossobuco: logotipo, nome do produto, o animal com a
// região do corte destacada e a descrição. Desenhada na página (vetor), no formato da galeria.
export function MapaCorteImagem({ mapa, titulo, p }: { mapa: MapaCorteResolvido; titulo: string; p: PropsMapaCorte }) {
  useFontes(p.titulo?.fonte, p.texto?.fonte);
  const corRegiao = corOu(p.corRegiao, "#c08a4e");
  return (
    <div className="tpl-mapa" style={estilo({ "--tpl-mapa-fundo": corOu(p.fundo, "#0b0b0d") }, varsTexto("tpl-mapa-titulo", p.titulo), varsTexto("tpl-mapa-texto", p.texto))}>
      {p.logo && <img className="tpl-mapa-logo" src={p.logo} alt="" />}
      <div className="tpl-mapa-titulo">{titulo}</div>
      <DesenhoMapa mapa={mapa} corRegiao={corRegiao} />
      {mapa.descricao && <p className="tpl-mapa-texto">{mapa.descricao}</p>}
    </div>
  );
}

export function Galeria(props: PropsGaleria & { mapa?: PropsMapaCorte }) {
  const { sombra } = props;
  const { moovin, mapaCorte } = useAmbiente().produto;
  const [atual, setAtual] = useState(0);
  const imagens = moovin.imagens;
  // O Mapa de Corte entra como o último item da galeria (se o produto tem e o template mostra).
  const mapa = mapaCorte && props.mapa?.mostrar !== "nao" ? mapaCorte : null;
  const total = imagens.length + (mapa ? 1 : 0);
  if (!total) return <Vazio texto="Produto sem imagens" />;
  const indice = Math.min(atual, total - 1);
  const comMiniaturas = total > 1 && props.miniaturas !== 0;
  const corRegiao = corOu(props.mapa?.corRegiao, "#c08a4e");
  return (
    <div className="tpl-galeria" style={estiloGaleria(props)}>
      {mapa && indice === imagens.length ? (
        <MapaCorteImagem mapa={mapa} titulo={moovin.nome} p={props.mapa ?? {}} />
      ) : (
        <img className={sombra === "sim" ? "tpl-sombra" : ""} src={imagens[indice]} alt={moovin.nome} />
      )}
      {comMiniaturas && (
        <div className="tpl-miniaturas">
          {imagens.map((src, i) => (
            <button key={src + i} type="button" aria-pressed={i === indice} aria-label={`Imagem ${i + 1}`} onClick={() => setAtual(i)}>
              <img src={src} alt="" />
            </button>
          ))}
          {mapa && (
            <button type="button" className="tpl-miniatura-mapa" aria-pressed={indice === imagens.length} aria-label="Mapa de Corte" onClick={() => setAtual(imagens.length)}
              style={{ "--tpl-mapa-fundo": corOu(props.mapa?.fundo, "#0b0b0d") } as CSSProperties}>
              <DesenhoMapa mapa={mapa} corRegiao={corRegiao} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Copia o link pela área de transferência; sem ela (página fora de HTTPS, permissão negada),
// pelo método antigo de seleção.
async function copiar(texto: string, doc: Document) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const campo = doc.createElement("textarea");
    campo.value = texto;
    campo.style.cssText = "position:fixed;opacity:0";
    doc.body.appendChild(campo);
    campo.select();
    const ok = doc.execCommand("copy");
    campo.remove();
    return ok;
  }
}

// Ícone padrão de compartilhamento (três pontos ligados).
function IconeCompartilhar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11A2.99 2.99 0 0 0 21 5a3 3 0 1 0-5.91.7L8.04 9.81A3 3 0 1 0 6 15a2.99 2.99 0 0 0 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65A2.92 2.92 0 1 0 18 16.08Z" />
    </svg>
  );
}

// No celular abre o compartilhamento do aparelho; no computador copia o link, com aviso (como o Script_Produto V3).
function BotaoCompartilhar({ nome, url }: { nome: string; url: string }) {
  const [aviso, setAviso] = useState("");
  async function compartilhar(e: MouseEvent<HTMLButtonElement>) {
    const toque = window.matchMedia?.("(pointer: coarse)").matches;
    if (toque && navigator.share) {
      try {
        await navigator.share({ title: nome, url });
        return;
      } catch (erro) {
        if ((erro as Error).name === "AbortError") return; // a pessoa fechou o compartilhamento
      }
    }
    const ok = await copiar(url, e.currentTarget.ownerDocument);
    setAviso(ok ? "Link copiado!" : `Copie o link: ${url}`);
    setTimeout(() => setAviso(""), 2200);
  }
  return (
    <span className="tpl-compartilhar-area">
      <button type="button" className="tpl-compartilhar" aria-label={aviso || "Compartilhar produto"} title="Compartilhar" onClick={compartilhar}>
        <IconeCompartilhar />
      </button>
      {aviso && <span className="tpl-compartilhar-aviso" role="status">{aviso}</span>}
    </span>
  );
}

export function Titulo({ mostrarCodigo, mostrarAvaliacao, mostrarCompartilhar }: { mostrarCodigo: SimNao; mostrarAvaliacao: SimNao; mostrarCompartilhar: SimNao }) {
  const { produto } = useAmbiente();
  const { moovin } = produto;
  return (
    <div className="tpl-titulo">
      <h1>{moovin.nome}</h1>
      <div className="tpl-titulo-linha">
        {mostrarCodigo === "sim" && moovin.codigo && <span>Cod.: {moovin.codigo}</span>}
        {mostrarAvaliacao === "sim" && moovin.avaliacao && <span className="tpl-estrelas">★★★★★ ({moovin.avaliacao.total})</span>}
        {mostrarCompartilhar === "sim" && (
          <BotaoCompartilhar nome={moovin.nome} url={moovin.url} />
        )}
      </div>
    </div>
  );
}

// Quantidade na unidade comercial (0,500 kg, 1,000 kg…); os botões somam ou tiram uma embalagem.
function Quantidade() {
  const compra = useCompra();
  const { conteudoComercial } = useAmbiente().produto.complemento;
  return (
    <span className="tpl-quantidade">
      <button type="button" aria-label="Diminuir" onClick={compra.menos}>−</button>
      <b aria-live="polite">{quantidadeComercial(unidadesDe(compra.quantidade), conteudoComercial)}</b>
      <button type="button" aria-label="Aumentar" onClick={compra.mais}>+</button>
    </span>
  );
}

// Total da compra (preço da embalagem × quantidade de embalagens) e preço por kg / L / un.
function useValores() {
  const compra = useCompra();
  const { conteudoComercial } = useAmbiente().produto.complemento;
  return {
    compra,
    total: formatarMoeda(compra.preco * unidadesDe(compra.quantidade)),
    porUnidade: precoPorUnidade(compra.preco, conteudoComercial),
  };
}

export type EstiloBotao = EstiloTexto & {
  estilo?: "solido" | "contorno";
  corTexto?: string;
  cantos?: "retos" | "arredondados" | "pilula";
};

export type PropsCompra = {
  preco?: EstiloTexto; // o total da compra
  quantidade?: EstiloTexto;
  botao?: EstiloBotao;
  precoKg?: EstiloTexto; // preço por kg / L / un, ao lado do botão
  disposicao?: "auto" | "linha" | "empilhado";
};

// Variáveis CSS e classes do preço, da quantidade e do botão (Linha de compra e Barra fixa).
function aparenciaCompra(p: PropsCompra) {
  const b = p.botao ?? {};
  const style = estilo(
    varsTexto("tpl-preco", p.preco),
    varsTexto("tpl-qtd", p.quantidade),
    varsTexto("tpl-botao", b),
    varsTexto("tpl-cprkg", p.precoKg),
    /^#[0-9a-f]{6}$/i.test(b.corTexto ?? "") ? { "--tpl-botao-texto": b.corTexto! } : {},
  );
  const classes = [`tpl-botao-${b.estilo ?? "solido"}`, `tpl-botao-cantos-${b.cantos ?? "arredondados"}`];
  return { style, classes: classes.join(" ") };
}

// Duas linhas: quantidade e o total da compra; embaixo, COMPRAR e o preço por kg / L / un.
// A caixa externa mede a largura disponível (container query): em cartão estreito, o preço por kg
// desce para baixo do botão. "Tudo numa linha" junta as duas linhas; "Empilhado" sempre desce.
export function LinhaCompra(props: PropsCompra) {
  const { compra, total, porUnidade } = useValores();
  const ref = useFontes(props.preco?.fonte, props.quantidade?.fonte, props.botao?.fonte, props.precoKg?.fonte);
  const { style, classes } = aparenciaCompra(props);
  return (
    <div className="tpl-compra-caixa" ref={ref as React.Ref<HTMLDivElement>}>
      <div className={`tpl-compra tpl-disposicao-${props.disposicao ?? "auto"} ${classes}`} style={style} data-tpl-compra="">
        <div className="tpl-compra-linha tpl-compra-quantidade">
          <Quantidade />
          <strong className="tpl-preco" aria-live="polite">{total}</strong>
        </div>
        <div className="tpl-compra-linha tpl-compra-botao">
          <button type="button" className="tpl-comprar" onClick={compra.comprar}>{compra.textoComprar}</button>
          {porUnidade && <span className="tpl-compra-unidade">{porUnidade}</span>}
        </div>
      </div>
    </div>
  );
}

// Na loja aparece fixa no rodapé quando a linha de compra sai da tela; no editor, mostra onde fica.
export function BarraCompraFixa(props: PropsCompra & { corFundo?: string }) {
  const { editando, loja } = useAmbiente();
  const fontes = useFontes(props.preco?.fonte, props.quantidade?.fonte, props.botao?.fonte, props.precoKg?.fonte);
  const { style, classes } = aparenciaCompra(props);
  if (/^#[0-9a-f]{6}$/i.test(props.corFundo ?? "")) (style as Record<string, string>)["--tpl-barra-fundo"] = props.corFundo!;
  const { compra, total, porUnidade } = useValores();
  const [visivel, setVisivel] = useState(false);
  const barra = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!loja) return;
    const linha = (barra.current?.ownerDocument ?? document).querySelector("[data-tpl-compra]");
    if (!linha) return;
    const observador = new IntersectionObserver(([e]) => setVisivel(!e.isIntersecting && e.boundingClientRect.top < 0));
    observador.observe(linha);
    return () => observador.disconnect();
  }, [loja]);
  return (
    <div
      ref={(el) => { barra.current = el; fontes.current = el; }}
      className={`tpl-barra-fixa ${classes}${loja ? " tpl-fixa" : ""}${visivel ? " visivel" : ""}`}
      style={style}
      aria-hidden={loja ? !visivel : undefined}
    >
      {editando && <small>Aparece ao rolar, quando a área de compra sai da tela</small>}
      <Quantidade />
      <strong className="tpl-preco">{total}</strong>
      <button type="button" className="tpl-comprar" onClick={compra.comprar}>{compra.textoComprar}</button>
      {porUnidade && <span className="tpl-compra-unidade">{porUnidade}</span>}
    </div>
  );
}

export function Resumo() {
  const { resumo } = useAmbiente().produto.complemento;
  return resumo ? <div className="tpl-resumo" dangerouslySetInnerHTML={html(resumo)} /> : <Vazio texto="Produto sem resumo no Complemento" />;
}

export function Descricao({ sobretitulo, titulo }: { sobretitulo: string; titulo: string }) {
  const { descricao } = useAmbiente().produto.complemento;
  if (!descricao) return <Vazio texto="Produto sem descrição no Complemento" />;
  return (
    <section className="tpl-detalhes">
      {sobretitulo && <span className="tpl-sobretitulo">{sobretitulo}</span>}
      {titulo && <h2>{titulo}</h2>}
      <div className="tpl-descricao tpl-aba-conteudo" dangerouslySetInnerHTML={html(descricao)} />
    </section>
  );
}

// Imagem ou ícone do badge, no tamanho pedido. O SVG do ícone passa pelo DOMPurify (perfil SVG).
// O respiro do ícone é em px, proporcional ao tamanho: em %, o padding seria calculado sobre a
// largura do elemento pai e esmagaria o ícone fora da grade da loja (ex.: na tela do produto).
// fluido: na grade da loja o badge encolhe com a célula (até `tamanho`), para caber em tela
// estreita; aí a célula tem a largura do ícone, e o padding em % fica proporcional a ele.
export function ConteudoBadge({ badge, tamanho, fluido = false }: { badge: Badge; tamanho: number; fluido?: boolean }) {
  const medida = fluido ? { width: "100%", maxWidth: tamanho, aspectRatio: "1 / 1" } : { width: tamanho, height: tamanho };
  if (badge.tipo === "icone") {
    return (
      <span
        className={badge.corFundo === "transparent" ? "tpl-badge-icone" : "tpl-badge-icone com-fundo"}
        style={{ ...medida, padding: fluido ? "18%" : Math.round(tamanho * 0.18), color: badge.cor, background: badge.corFundo }}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(badge.icone, { USE_PROFILES: { svg: true } }) }}
      />
    );
  }
  return <img src={badge.imagem} alt="" width={tamanho} height={tamanho} loading="lazy" style={fluido ? { ...medida, height: "auto" } : undefined} />;
}

// Badges (selos) do produto: em grade, com limite de badges por linha e de linhas (o que passar
// não aparece). Balão ao passar o mouse (ou focar pelo teclado); com link, abre em outra aba.
export function Badges({ tamanho, porLinha, maxLinhas }: { tamanho: number; porLinha: number; maxLinhas: number }) {
  const { produto, editando } = useAmbiente();
  const { badges } = produto;
  if (!badges.length) return <Vazio texto="Produto sem badges" />;
  const visiveis = badges.slice(0, porLinha * maxLinhas);
  return (
    <>
      {/* Colunas de até `tamanho` px que encolhem juntas quando falta largura (celular). */}
      <div className="tpl-badges" style={{ gridTemplateColumns: `repeat(${Math.min(porLinha, visiveis.length)}, minmax(0, ${tamanho}px))` }}>
        {visiveis.map((b) => {
          const conteudo = <ConteudoBadge badge={b} tamanho={tamanho} fluido />;
          const balao = b.tooltip && <span className="tpl-badge-balao" role="tooltip">{b.tooltip}</span>;
          return b.link ? (
            <a key={b.id} className="tpl-badge" href={b.link} target="_blank" rel="noopener noreferrer" aria-label={`${b.nome} (abre em outra aba)`}>
              {conteudo}{balao}
            </a>
          ) : (
            <span key={b.id} className="tpl-badge" tabIndex={0} role="img" aria-label={b.nome}>
              {conteudo}{balao}
            </span>
          );
        })}
      </div>
      {editando && badges.length > visiveis.length && (
        <div className="tpl-vazio">{badges.length - visiveis.length} badge(s) deste produto passam do limite e não aparecem</div>
      )}
    </>
  );
}

export type PropsPrecoUnidade = { unidade?: EstiloTexto; precoKg?: EstiloTexto; alinhamento?: "esquerda" | "centro" | "direita" };

export function PrecoPorUnidade({ unidade: eUnidade, precoKg, alinhamento }: PropsPrecoUnidade) {
  const { complemento } = useAmbiente().produto;
  const { preco } = useCompra();
  const ref = useFontes(eUnidade?.fonte, precoKg?.fonte);
  const texto = precoPorUnidade(preco, complemento.conteudoComercial);
  const unidade = textoUnidade(complemento.conteudoComercial);
  if (!unidade) return <Vazio texto="Produto sem conteúdo da embalagem no Complemento" />;
  const alinhar = { esquerda: "left", centro: "center", direita: "right" }[alinhamento ?? "direita"];
  return (
    <div ref={ref as React.Ref<HTMLDivElement>} className="tpl-preco-unidade"
      style={estilo(varsTexto("tpl-unidade", eUnidade), varsTexto("tpl-precokg", precoKg), { "--tpl-alinhar": alinhar })}>
      <p className="tpl-unidade">{unidade}</p>
      {texto && <p className="tpl-precokg">{texto}</p>}
    </div>
  );
}

type EstiloAbas = "abas" | "sanfona" | "lista";

// As abas vêm da descrição do produto, quantas forem; o template só decide onde e como aparecem.
// Abas, no espírito das abas do Material 3: variante (clássica, primária, secundária, pílula),
// largura (rolável, fixa, centralizada), cores, fontes e o painel. Teclado: ← → Home End.
export type PropsAbas = {
  sobretitulo: string;
  titulo: string;
  estilo?: EstiloAbas;
  numerar: SimNao;
  variante?: "classica" | "primaria" | "secundaria" | "pilula";
  largura?: "rolavel" | "fixa" | "centralizada";
  corAtiva?: string;
  corInativa?: string;
  corIndicador?: string;
  fundoBarra?: string;
  divisor?: SimNao;
  maiusculas?: SimNao;
  rotulo?: EstiloTexto;
  conteudo?: EstiloTexto;
  tituloSecao?: EstiloTexto;
  painelFundo?: string;
  painelCantos?: "arredondados" | "retos";
  painelSombra?: SimNao;
};

const corValida = (c?: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : undefined);

function Abas({ abas, estilo, numerar }: { abas: Aba[]; estilo: EstiloAbas; numerar: boolean }) {
  const [ativa, setAtiva] = useState(0);
  const nav = useRef<HTMLDivElement | null>(null);
  const indice = Math.min(ativa, abas.length - 1);
  const numero = (i: number) => numerar && <span className="tpl-aba-numero">{String(i + 1).padStart(2, "0")}</span>;
  if (estilo === "lista") {
    return (
      <div className="tpl-abas tpl-abas-lista">
        {abas.map((aba, i) => (
          <section key={aba.titulo + i}>
            <h3 className="tpl-aba-titulo">{numero(i)}{aba.titulo}</h3>
            <div className="tpl-aba-conteudo" dangerouslySetInnerHTML={html(aba.conteudo)} />
          </section>
        ))}
      </div>
    );
  }
  if (estilo === "sanfona") {
    return (
      <div className="tpl-abas tpl-abas-sanfona">
        {abas.map((aba, i) => (
          <details key={aba.titulo + i} open={i === 0}>
            <summary className="tpl-aba-titulo">{numero(i)}{aba.titulo}</summary>
            <div className="tpl-aba-conteudo" dangerouslySetInnerHTML={html(aba.conteudo)} />
          </details>
        ))}
      </div>
    );
  }
  // Seleciona a aba, leva o foco a ela e a rola para dentro da barra (celular).
  const selecionar = (i: number, focar: boolean) => {
    setAtiva(i);
    const botao = nav.current?.children[i] as HTMLElement | undefined;
    if (focar) botao?.focus();
    botao?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };
  const teclado = (e: React.KeyboardEvent, i: number) => {
    const destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    selecionar((destino + abas.length) % abas.length, true);
  };
  return (
    <div className="tpl-abas">
      <div className="tpl-abas-nav" role="tablist" ref={nav}>
        {abas.map((aba, i) => (
          <button key={aba.titulo + i} type="button" role="tab" aria-selected={i === indice} tabIndex={i === indice ? 0 : -1}
            onClick={() => selecionar(i, false)} onKeyDown={(e) => teclado(e, i)}>
            <span className="tpl-aba-rotulo">
              {numero(i)}
              {aba.titulo}
            </span>
          </button>
        ))}
      </div>
      <div className="tpl-abas-painel tpl-aba-conteudo" role="tabpanel" dangerouslySetInnerHTML={html(abas[indice].conteudo)} />
    </div>
  );
}

export function AbasDetalhes(p: PropsAbas) {
  const abas = useAmbiente().produto.complemento.abas.filter((aba) => aba.titulo || aba.conteudo);
  const ref = useFontes(p.rotulo?.fonte, p.conteudo?.fonte, p.tituloSecao?.fonte);
  if (!abas.length) return <Vazio texto="Produto sem abas no Complemento" />;
  const cores: Record<string, string> = {};
  const cor = (nome: string, valor?: string) => { if (corValida(valor)) cores[nome] = valor!; };
  cor("--tpl-abas-ativa", p.corAtiva);
  cor("--tpl-abas-inativa", p.corInativa);
  cor("--tpl-abas-indicador", p.corIndicador);
  cor("--tpl-abas-fundo-barra", p.fundoBarra);
  cor("--tpl-abas-painel", p.painelFundo);
  const classes = [
    "tpl-detalhes",
    `tpl-abas-${p.variante ?? "classica"}`,
    `tpl-largura-${p.largura ?? "rolavel"}`,
    p.divisor === "nao" ? "tpl-sem-divisor" : "",
    p.maiusculas === "sim" ? "tpl-rotulo-maiusculo" : "",
    p.painelCantos === "retos" ? "tpl-painel-reto" : "",
    p.painelSombra === "nao" ? "tpl-painel-sem-sombra" : "",
  ].filter(Boolean);
  return (
    <section ref={ref as React.Ref<HTMLElement>} className={classes.join(" ")}
      style={estilo(cores, varsTexto("tpl-abas-rotulo", p.rotulo), varsTexto("tpl-aba-conteudo", p.conteudo), varsTexto("tpl-detalhes-titulo", p.tituloSecao))}>
      {p.sobretitulo && <span className="tpl-sobretitulo">{p.sobretitulo}</span>}
      {p.titulo && <h2>{p.titulo}</h2>}
      <Abas abas={abas} estilo={p.estilo ?? "abas"} numerar={p.numerar === "sim"} />
    </section>
  );
}

export function Texto({ texto }: { texto: string }) {
  return <p className="tpl-texto">{texto}</p>;
}
