import { useEffect, useRef, useState, type PointerEvent as EventoPonteiro } from "react";
import { EditorTexto } from "../componentes/EditorTexto";
import { enviarImagem } from "../produtos/badges";
import { centroDaRegiao, excluirMapa, listarMapas, pontosSvg, proximoNumero, salvarMapa, tamanhoDaImagem, type DadosMapa } from "../produtos/mapas";
import type { Corte, MapaCortes, Ponto } from "../templater/produto";
import { Campo, Secao, Texto } from "./produtos/campos";

// Cadastro de mapas de cortes: a imagem de um animal (enviada para a Moovin) e os cortes marcados
// nela, com número, nome, descrição (vai na imagem do produto), informações detalhadas e o contorno
// da região. No produto, o Mapa de Corte aponta para um corte; a loja desenha a imagem no fim da galeria.

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(16).slice(2)}`);
const limitar = (v: number) => Math.min(1, Math.max(0, v));

// A imagem com os contornos de todos os cortes. Desenhando: cada clique acrescenta um ponto.
// Com um corte selecionado, os pontos dele podem ser arrastados.
function Prancheta({ mapa, selecionado, desenhando, aoMudarRegiao, aoSelecionar }: {
  mapa: DadosMapa;
  selecionado: Corte | null;
  desenhando: boolean;
  aoMudarRegiao: (regiao: Ponto[]) => void;
  aoSelecionar: (id: string) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const { largura: w, altura: h } = mapa;
  const raio = Math.max(w, h) / 120;

  // Posição do ponteiro em fração da imagem.
  function ponto(e: EventoPonteiro<SVGElement>): Ponto | null {
    const ctm = svg.current?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [Math.round(limitar(p.x / w) * 10000) / 10000, Math.round(limitar(p.y / h) * 10000) / 10000];
  }

  return (
    <svg ref={svg} className={`prancheta${desenhando ? " desenhando" : ""}`} viewBox={`0 0 ${w} ${h}`}
      onPointerDown={(e) => {
        if (!desenhando || !selecionado) return;
        const p = ponto(e);
        if (p) aoMudarRegiao([...selecionado.regiao, p]);
      }}
      onPointerMove={(e) => {
        if (arrastando === null || !selecionado) return;
        const p = ponto(e);
        if (p) aoMudarRegiao(selecionado.regiao.map((q, i) => (i === arrastando ? p : q)));
      }}
      onPointerUp={() => setArrastando(null)}
      onPointerLeave={() => setArrastando(null)}
    >
      <image href={mapa.imagem} width={w} height={h} />
      {mapa.cortes.map((c) => {
        const ativo = c.id === selecionado?.id;
        const centro = centroDaRegiao(c.regiao);
        return (
          <g key={c.id} className={ativo ? "regiao ativa" : "regiao"} onPointerDown={(e) => { if (!desenhando) { e.stopPropagation(); aoSelecionar(c.id); } }}>
            {c.regiao.length >= 3 && <polygon points={pontosSvg(c.regiao, w, h)} strokeWidth={raio / 3} />}
            {ativo && c.regiao.length > 0 && c.regiao.length < 3 && <polyline points={pontosSvg(c.regiao, w, h)} strokeWidth={raio / 3} fill="none" />}
            {centro && c.regiao.length >= 3 && (
              <g className="numero-corte">
                <circle cx={centro[0] * w} cy={centro[1] * h} r={raio * 1.6} />
                <text x={centro[0] * w} y={centro[1] * h} fontSize={raio * 1.7} textAnchor="middle" dominantBaseline="central">{c.numero}</text>
              </g>
            )}
          </g>
        );
      })}
      {selecionado?.regiao.map(([x, y], i) => (
        <circle key={i} className="vertice" cx={x * w} cy={y * h} r={raio * 0.7}
          onPointerDown={(e) => {
            if (desenhando) return;
            e.stopPropagation();
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setArrastando(i);
          }}
        />
      ))}
    </svg>
  );
}

function FormularioCorte({ corte, desenhando, aoMudar, aoDesenhar, aoExcluir }: {
  corte: Corte;
  desenhando: boolean;
  aoMudar: (parcial: Partial<Corte>) => void;
  aoDesenhar: (ligar: boolean) => void;
  aoExcluir: () => void;
}) {
  return (
    <div className="formulario-corte">
      <div className="linha-campos">
        <Campo rotulo="Número">
          <input className="entrada" type="number" min={0} max={999} value={corte.numero} onChange={(e) => aoMudar({ numero: Number(e.target.value) || 0 })} />
        </Campo>
        <Campo rotulo="Nome do corte" obrigatorio>
          <Texto valor={corte.nome} aoMudar={(nome) => aoMudar({ nome })} placeholder="Ex.: Ossobuco" maxLength={80} />
        </Campo>
      </div>
      <div className="campo">
        <span className="campo-rotulo">Origem no animal</span>
        <div className="linha-botoes">
          {desenhando ? (
            <>
              <button type="button" className="button button-primary" onClick={() => aoDesenhar(false)} disabled={corte.regiao.length > 0 && corte.regiao.length < 3}>Concluir contorno</button>
              <button type="button" className="button button-secondary" disabled={!corte.regiao.length} onClick={() => aoMudar({ regiao: corte.regiao.slice(0, -1) })}>Desfazer ponto</button>
            </>
          ) : (
            <button type="button" className="button button-secondary" onClick={() => { if (corte.regiao.length) aoMudar({ regiao: [] }); aoDesenhar(true); }}>
              {corte.regiao.length ? "Desenhar de novo" : "Desenhar contorno"}
            </button>
          )}
        </div>
        <small className="campo-dica">
          {desenhando
            ? `Clique na imagem em volta da região do corte (${corte.regiao.length} ponto(s); mínimo 3). O contorno fecha sozinho.`
            : corte.regiao.length >= 3
              ? "Para ajustar, arraste os pontos do contorno na imagem."
              : "Sem contorno: o produto deste corte não mostra o Mapa de Corte."}
        </small>
      </div>
      <Campo rotulo="Descrição" dica={`${corte.descricao.length}/400. Vai na imagem do Mapa de Corte, abaixo do animal. No produto dá para trocar por outra.`}>
        <textarea className="entrada" rows={4} maxLength={400} value={corte.descricao} onChange={(e) => aoMudar({ descricao: e.target.value })}
          placeholder='Ex.: O ossobuco (do italiano "osso furado") é um corte da perna do animal, em rodelas grossas com o osso no centro.' />
      </Campo>
      <Campo rotulo="Informações detalhadas" dica="Origem, características, preparo e harmonização. Ficam guardadas no cadastro do corte.">
        <EditorTexto key={corte.id} valor={corte.detalhes} aoMudar={(detalhes) => aoMudar({ detalhes })} />
      </Campo>
      <div className="linha-acoes">
        <span />
        <button type="button" className="button button-plain perigo" onClick={aoExcluir}>Excluir corte</button>
      </div>
    </div>
  );
}

function EditorMapa({ mapa, fechar, salvo }: { mapa: MapaCortes | null; fechar: () => void; salvo: () => void }) {
  const [dados, setDados] = useState<DadosMapa>(mapa ?? { nome: "", imagem: "", largura: 0, altura: 0, cortes: [] });
  const [selecionadoId, setSelecionadoId] = useState<string | null>(mapa?.cortes[0]?.id ?? null);
  const [desenhando, setDesenhando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const alterado = JSON.stringify(dados) !== JSON.stringify(mapa ? { nome: mapa.nome, imagem: mapa.imagem, largura: mapa.largura, altura: mapa.altura, cortes: mapa.cortes } : null);
  const selecionado = dados.cortes.find((c) => c.id === selecionadoId) ?? null;
  const ordenados = [...dados.cortes].sort((a, b) => a.numero - b.numero);

  const alterarCorte = (id: string, parcial: Partial<Corte>) => setDados((d) => ({ ...d, cortes: d.cortes.map((c) => (c.id === id ? { ...c, ...parcial } : c)) }));
  const selecionar = (id: string) => { setDesenhando(false); setSelecionadoId(id); };

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro("");
    setEnviando(true);
    try {
      const imagem = await enviarImagem(dados.nome || "mapa", arquivo, "templater/mapas");
      const { largura, altura } = await tamanhoDaImagem(imagem);
      if (dados.cortes.some((c) => c.regiao.length) && !window.confirm("Trocar a imagem? Os contornos já desenhados continuam nas mesmas posições relativas; confira depois.")) return;
      setDados((d) => ({ ...d, imagem, largura, altura }));
    } catch (e) {
      setErro(`Não foi possível enviar a imagem para a Moovin: ${mensagem(e)}`);
    } finally {
      setEnviando(false);
    }
  }

  function novoCorte() {
    const corte: Corte = { id: novoId(), numero: proximoNumero(dados), nome: "", descricao: "", detalhes: "", regiao: [] };
    setDados((d) => ({ ...d, cortes: [...d.cortes, corte] }));
    setSelecionadoId(corte.id);
    setDesenhando(true);
  }

  function excluirCorte(c: Corte) {
    if (!window.confirm(`Excluir o corte "${c.nome || c.numero}"? Os produtos deste corte deixam de mostrar o Mapa de Corte.`)) return;
    setDados((d) => ({ ...d, cortes: d.cortes.filter((x) => x.id !== c.id) }));
    setSelecionadoId(null);
    setDesenhando(false);
  }

  async function salvar() {
    setErro("");
    setSalvando(true);
    try {
      await salvarMapa(dados, mapa?.id);
      salvo();
    } catch (e) {
      setErro(mensagem(e));
      setSalvando(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="breadcrumbs">
          <a href="#/mapas" onClick={(e) => { e.preventDefault(); if (!alterado || window.confirm("Sair sem salvar as alterações?")) fechar(); }}>Mapas de cortes</a><b>/</b><strong>{dados.nome || "Novo mapa"}</strong>
        </div>
        <div className="heading-actions">
          {alterado && <span className="save-indicator"><span className="status-dot amber" />Alterações não salvas</span>}
          <button className="button button-primary" disabled={!alterado || salvando || enviando || !dados.nome.trim() || !dados.imagem} onClick={salvar}>{salvando ? "Salvando…" : "Salvar mapa"}</button>
        </div>
      </header>
      <div className="pagina-produto">
        {erro && <p className="caixa-erros">{erro}</p>}
        <Secao titulo="Animal">
          <div className="linha-campos">
            <Campo rotulo="Nome do mapa" obrigatorio>
              <Texto valor={dados.nome} aoMudar={(nome) => setDados((d) => ({ ...d, nome }))} placeholder="Ex.: Bovino" maxLength={60} />
            </Campo>
            <Campo rotulo="Imagem do animal" obrigatorio dica="O desenho do animal, sem textos (ex.: a silhueta com as divisões). Fica salva na Moovin.">
              <input type="file" accept="image/*" disabled={enviando} onChange={(e) => { enviar(e.target.files?.[0]); e.target.value = ""; }} />
            </Campo>
          </div>
          {enviando && <small className="campo-dica">Enviando a imagem para a Moovin…</small>}
        </Secao>

        {dados.imagem && (
          <div className="mapa-editor">
            <div className="mapa-prancheta">
              <Prancheta
                mapa={dados}
                selecionado={selecionado}
                desenhando={desenhando}
                aoMudarRegiao={(regiao) => selecionado && alterarCorte(selecionado.id, { regiao })}
                aoSelecionar={selecionar}
              />
            </div>
            <div className="mapa-cortes">
              <div className="mapa-cortes-topo">
                <strong>Cortes ({dados.cortes.length})</strong>
                <button type="button" className="button button-secondary" onClick={novoCorte}>+ Novo corte</button>
              </div>
              <div className="lista-cortes">
                {ordenados.map((c) => (
                  <button type="button" key={c.id} className={c.id === selecionadoId ? "item-corte ativo" : "item-corte"} onClick={() => selecionar(c.id)}>
                    <span className="numero">{c.numero}</span>
                    <span>{c.nome || <em>sem nome</em>}</span>
                    {c.regiao.length < 3 && <span className="selo-obrigatoria" title="Sem contorno">sem contorno</span>}
                  </button>
                ))}
                {dados.cortes.length === 0 && <p className="vazio">Nenhum corte. Clique em "+ Novo corte" e contorne a região na imagem.</p>}
              </div>
              {selecionado && (
                <FormularioCorte
                  key={selecionado.id}
                  corte={selecionado}
                  desenhando={desenhando}
                  aoMudar={(parcial) => alterarCorte(selecionado.id, parcial)}
                  aoDesenhar={setDesenhando}
                  aoExcluir={() => excluirCorte(selecionado)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function MapasCortes() {
  const [lista, setLista] = useState<MapaCortes[] | null>(null);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<MapaCortes | "novo" | null>(null);
  const carregar = () => listarMapas().then(setLista, (e) => setErro(mensagem(e)));
  useEffect(() => { carregar(); }, []);

  if (editando)
    return <EditorMapa key={editando === "novo" ? "novo" : editando.id} mapa={editando === "novo" ? null : editando} fechar={() => setEditando(null)} salvo={() => { setEditando(null); carregar(); }} />;

  async function excluir(m: MapaCortes) {
    if (!window.confirm(`Excluir o mapa "${m.nome}" e os ${m.cortes.length} cortes dele? Os produtos que o usam deixam de mostrar o Mapa de Corte.`)) return;
    try {
      await excluirMapa(m.id);
      carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="breadcrumbs"><strong>Mapas de cortes</strong>{lista && <span>{lista.length} cadastrados</span>}</div>
        <div className="heading-actions">
          <button className="button button-primary" onClick={() => setEditando("novo")}>Novo mapa</button>
        </div>
      </header>
      <div className="pagina-produto">
        {erro && <p className="caixa-erros">{erro}</p>}
        <p className="campo-dica">
          Um mapa por animal (bovino, suíno, cordeiro…): a imagem e os cortes marcados nela. No produto, ative o Mapa de Corte e escolha o corte;
          a página monta a imagem com a região destacada no fim da galeria.
        </p>
        <table className="tabela-produtos">
          <thead><tr><th /><th>Animal</th><th>Cortes</th><th /></tr></thead>
          <tbody>
            {!lista && !erro && <tr><td colSpan={4} className="vazio">Carregando…</td></tr>}
            {lista?.map((m) => (
              <tr key={m.id}>
                <td><img className="miniatura-mapa" src={m.imagem} alt="" /></td>
                <td><strong>{m.nome}</strong></td>
                <td>{m.cortes.length} ({m.cortes.filter((c) => c.regiao.length >= 3).length} com contorno)</td>
                <td className="acoes-linha">
                  <button type="button" className="button button-plain" onClick={() => setEditando(m)}>Editar</button>
                  <button type="button" className="button button-plain perigo" onClick={() => excluir(m)}>Excluir</button>
                </td>
              </tr>
            ))}
            {lista?.length === 0 && <tr><td colSpan={4} className="vazio">Nenhum mapa cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
