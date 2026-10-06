import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import DOMPurify from "dompurify";
import { formatarMoeda, precoPorUnidade, type Aba, type ProdutoTemplate, textoUnidade } from "./produto";

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
type Slot = (className: string) => ReactNode;
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

export function Cartao({ fundo, conteudo }: { fundo: string; conteudo: Slot }) {
  return <>{conteudo(`tpl-cartao tpl-cartao-${fundo}`)}</>;
}

export function Galeria({ sombra }: { sombra: SimNao }) {
  const { moovin } = useAmbiente().produto;
  const [atual, setAtual] = useState(0);
  const imagens = moovin.imagens;
  if (!imagens.length) return <Vazio texto="Produto sem imagens" />;
  return (
    <div className="tpl-galeria">
      <img className={sombra === "sim" ? "tpl-sombra" : ""} src={imagens[Math.min(atual, imagens.length - 1)]} alt={moovin.nome} />
      {imagens.length > 1 && (
        <div className="tpl-miniaturas">
          {imagens.map((src, i) => (
            <button key={src + i} type="button" aria-pressed={i === atual} aria-label={`Imagem ${i + 1}`} onClick={() => setAtual(i)}>
              <img src={src} alt="" />
            </button>
          ))}
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

function Quantidade() {
  const compra = useCompra();
  return (
    <span className="tpl-quantidade">
      <button type="button" aria-label="Diminuir" onClick={compra.menos}>−</button>
      <b>{compra.quantidade}</b>
      <button type="button" aria-label="Aumentar" onClick={compra.mais}>+</button>
    </span>
  );
}

export function LinhaCompra() {
  const compra = useCompra();
  return (
    <div className="tpl-compra" data-tpl-compra="">
      <strong>{formatarMoeda(compra.preco)}</strong>
      <Quantidade />
      <button type="button" className="tpl-comprar" onClick={compra.comprar}>{compra.textoComprar}</button>
    </div>
  );
}

// Na loja aparece fixa no rodapé quando a linha de compra sai da tela; no editor, mostra onde fica.
export function BarraCompraFixa() {
  const { editando, loja } = useAmbiente();
  const compra = useCompra();
  const [visivel, setVisivel] = useState(false);
  const barra = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loja) return;
    const linha = (barra.current?.ownerDocument ?? document).querySelector("[data-tpl-compra]");
    if (!linha) return;
    const observador = new IntersectionObserver(([e]) => setVisivel(!e.isIntersecting && e.boundingClientRect.top < 0));
    observador.observe(linha);
    return () => observador.disconnect();
  }, [loja]);
  return (
    <div ref={barra} className={`tpl-barra-fixa${loja ? " tpl-fixa" : ""}${visivel ? " visivel" : ""}`} aria-hidden={loja ? !visivel : undefined}>
      {editando && <small>Aparece ao rolar, quando a área de compra sai da tela</small>}
      <strong>{formatarMoeda(compra.preco)}</strong>
      <Quantidade />
      <button type="button" className="tpl-comprar" onClick={compra.comprar}>{compra.textoComprar}</button>
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

// Badges (selos) do produto: imagem com balão ao passar o mouse (ou ao focar pelo teclado) e,
// se o badge tiver link, abre a página de descrição completa em outra aba.
export function Badges({ tamanho }: { tamanho: number }) {
  const { badges } = useAmbiente().produto;
  if (!badges.length) return <Vazio texto="Produto sem badges" />;
  return (
    <div className="tpl-badges">
      {badges.map((b) => {
        const imagem = <img src={b.imagem} alt={b.nome} width={tamanho} height={tamanho} loading="lazy" />;
        const balao = b.tooltip && <span className="tpl-badge-balao" role="tooltip">{b.tooltip}</span>;
        return b.link ? (
          <a key={b.id} className="tpl-badge" href={b.link} target="_blank" rel="noopener noreferrer" aria-label={`${b.nome} (abre em outra aba)`}>
            {imagem}{balao}
          </a>
        ) : (
          <span key={b.id} className="tpl-badge" tabIndex={0} aria-label={b.nome}>
            {imagem}{balao}
          </span>
        );
      })}
    </div>
  );
}

export function PrecoPorUnidade() {
  const { complemento } = useAmbiente().produto;
  const { preco } = useCompra();
  const texto = precoPorUnidade(preco, complemento.conteudoComercial);
  const unidade = textoUnidade(complemento.conteudoComercial);
  if (!unidade) return <Vazio texto="Produto sem conteúdo da embalagem no Complemento" />;
  return (
    <div className="tpl-preco-unidade">
      <p className="tpl-unidade">{unidade}</p>
      {texto && <p>{texto}</p>}
    </div>
  );
}

type EstiloAbas = "abas" | "sanfona" | "lista";

// As abas vêm da descrição do produto, quantas forem; o template só decide onde e como aparecem.
function Abas({ abas, estilo, numerar }: { abas: Aba[]; estilo: EstiloAbas; numerar: boolean }) {
  const [ativa, setAtiva] = useState(0);
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
  return (
    <div className="tpl-abas">
      <div className="tpl-abas-nav" role="tablist">
        {abas.map((aba, i) => (
          <button key={aba.titulo + i} type="button" role="tab" aria-selected={i === indice} onClick={() => setAtiva(i)}>
            {numero(i)}
            {aba.titulo}
          </button>
        ))}
      </div>
      <div className="tpl-abas-painel tpl-aba-conteudo" role="tabpanel" dangerouslySetInnerHTML={html(abas[indice].conteudo)} />
    </div>
  );
}

export function AbasDetalhes({ sobretitulo, titulo, estilo, numerar }: { sobretitulo: string; titulo: string; estilo?: EstiloAbas; numerar: SimNao }) {
  const abas = useAmbiente().produto.complemento.abas.filter((aba) => aba.titulo || aba.conteudo);
  if (!abas.length) return <Vazio texto="Produto sem abas no Complemento" />;
  return (
    <section className="tpl-detalhes">
      {sobretitulo && <span className="tpl-sobretitulo">{sobretitulo}</span>}
      {titulo && <h2>{titulo}</h2>}
      <Abas abas={abas} estilo={estilo ?? "abas"} numerar={numerar === "sim"} />
    </section>
  );
}

export function Texto({ texto }: { texto: string }) {
  return <p className="tpl-texto">{texto}</p>;
}
