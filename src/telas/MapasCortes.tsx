import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { EditorTexto } from "../componentes/EditorTexto";
import { enviarImagem } from "../produtos/badges";
import { excluirMapa, listarMapas, proximoNumero, salvarMapa, tamanhoDaImagem, type DadosMapa } from "../produtos/mapas";
import { montarGrade, recalcularCortes, regiaoDe, rotuloEm, todasAsRegioes } from "../produtos/regioes";
import type { Corte, MapaCortes, Ponto } from "../templater/produto";
import { PranchetaKonva, type Modo } from "./mapas/PranchetaKonva";
import { Campo, Secao, Texto } from "./produtos/campos";

// Cadastro de mapas de cortes: a imagem de um animal (enviada para a Moovin) e os cortes marcados nela,
// com número, nome, descrição (vai na imagem do produto), informações detalhadas e a região.
// Modelo híbrido: desenha-se o contorno do animal e as linhas de corte; as regiões saem das linhas e
// cada corte é formado clicando nas regiões dele (recalcula sozinho quando as linhas mudam). Para
// corrigir um corte, dá para ajustar os pontos dele à mão (aí ele deixa de seguir as linhas).

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(16).slice(2)}`);

const MODOS: Array<{ id: Modo; rotulo: string }> = [
  { id: "contorno", rotulo: "1. Contorno do animal" },
  { id: "linhas", rotulo: "2. Linhas de corte" },
  { id: "cortes", rotulo: "3. Regiões dos cortes" },
  { id: "ajuste", rotulo: "Ajuste fino do corte" },
];

function situacao(c: Corte): { texto: string; classe: string } {
  if (c.regiao.length < 3) return { texto: "sem região", classe: "selo-obrigatoria" };
  if (c.manual) return { texto: "ajustado à mão", classe: "selo-manual" };
  if (c.sementes?.length) return { texto: "pelas linhas", classe: "selo-linhas" };
  return { texto: "desenhado", classe: "selo-manual" };
}

function FormularioCorte({ corte, temLinhas, aoMudar, voltarAsLinhas, aoExcluir }: {
  corte: Corte;
  temLinhas: boolean;
  aoMudar: (parcial: Partial<Corte>) => void;
  voltarAsLinhas: () => void;
  aoExcluir: () => void;
}) {
  const s = situacao(corte);
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
        <span className="campo-rotulo">Região no animal <span className={s.classe}>{s.texto}</span></span>
        <small className="campo-dica">
          {corte.manual
            ? "O contorno foi ajustado à mão e não muda quando as linhas mudam."
            : corte.sementes?.length
              ? `Formado por ${corte.sementes.length} região(ões) das linhas de corte; acompanha as linhas.`
              : temLinhas
                ? 'No modo "3. Regiões dos cortes", clique nas regiões que formam este corte.'
                : 'Desenhe o contorno do animal e as linhas de corte, ou desenhe a região à mão no "Ajuste fino do corte".'}
        </small>
        <div className="linha-botoes">
          {corte.manual && temLinhas && <button type="button" className="button button-secondary" onClick={voltarAsLinhas}>Voltar a seguir as linhas</button>}
          {!!corte.sementes?.length && <button type="button" className="button button-plain" onClick={() => aoMudar({ sementes: [], regiao: corte.manual ? corte.regiao : [] })}>Limpar regiões</button>}
          {corte.manual && <button type="button" className="button button-plain" onClick={() => aoMudar({ regiao: [], manual: false })}>Apagar e desenhar de novo</button>}
        </div>
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

const semId = (m: MapaCortes | null): DadosMapa =>
  m ? { nome: m.nome, imagem: m.imagem, largura: m.largura, altura: m.altura, cortes: m.cortes, contorno: m.contorno ?? [], linhas: m.linhas ?? [] }
    : { nome: "", imagem: "", largura: 0, altura: 0, cortes: [], contorno: [], linhas: [] };

function EditorMapa({ mapa, fechar, salvo }: { mapa: MapaCortes | null; fechar: () => void; salvo: () => void }) {
  const inicial = useMemo(() => semId(mapa), [mapa]);
  const [dados, setDados] = useState<DadosMapa>(inicial);
  const [modo, setModo] = useState<Modo>(inicial.contorno?.length ? "cortes" : inicial.cortes.some((c) => c.regiao.length) ? "ajuste" : "contorno");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(mapa?.cortes[0]?.id ?? null);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  // histórico (Ctrl+Z / Ctrl+Y)
  const passado = useRef<DadosMapa[]>([]);
  const futuro = useRef<DadosMapa[]>([]);
  const atual = useRef(dados);
  atual.current = dados;
  const [, setVersao] = useState(0);
  const marcar = useCallback(() => {
    passado.current = [...passado.current.slice(-99), atual.current];
    futuro.current = [];
    setVersao((v) => v + 1);
  }, []);
  const desfazer = useCallback(() => {
    const anterior = passado.current.pop();
    if (!anterior) return;
    futuro.current.push(atual.current);
    setDados(anterior);
    setVersao((v) => v + 1);
  }, []);
  const refazer = useCallback(() => {
    const proximo = futuro.current.pop();
    if (!proximo) return;
    passado.current.push(atual.current);
    setDados(proximo);
    setVersao((v) => v + 1);
  }, []);
  const alterar = useCallback((f: (d: DadosMapa) => DadosMapa) => setDados(f), []);
  // Ctrl+Z / Ctrl+Y fora da prancheta (ela trata os dela) e fora dos campos de texto
  useEffect(() => {
    const teclado = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (!(e.ctrlKey || e.metaKey) || alvo?.closest("input, textarea, select, [contenteditable], .prancheta-konva")) return;
      const k = e.key.toLowerCase();
      if (k === "z") { e.preventDefault(); return e.shiftKey ? refazer() : desfazer(); }
      if (k === "y") { e.preventDefault(); refazer(); }
    };
    window.addEventListener("keydown", teclado);
    return () => window.removeEventListener("keydown", teclado);
  }, [desfazer, refazer]);

  // regiões pelas linhas (calculadas quando o contorno ou as linhas param de mudar)
  const contorno = useDeferredValue(dados.contorno ?? []);
  const linhas = useDeferredValue(dados.linhas ?? []);
  const grade = useMemo(() => montarGrade(dados.largura, dados.altura, contorno, linhas), [dados.largura, dados.altura, contorno, linhas]);
  const regioes = useMemo(() => (grade ? todasAsRegioes(grade) : []), [grade]);
  useEffect(() => {
    if (!grade) return;
    setDados((d) => {
      const cortes = recalcularCortes(d, grade);
      return cortes.every((c, i) => c === d.cortes[i]) ? d : { ...d, cortes };
    });
  }, [grade]);

  const alterado = JSON.stringify(dados) !== JSON.stringify(inicial);
  const selecionado = dados.cortes.find((c) => c.id === selecionadoId) ?? null;
  const ordenados = [...dados.cortes].sort((a, b) => a.numero - b.numero);
  const rotulosDoSelecionado = useMemo(
    () => new Set(grade && selecionado?.sementes ? selecionado.sementes.map((s) => rotuloEm(grade, s)).filter((r) => r > 0) : []),
    [grade, selecionado],
  );

  const alterarCorte = (id: string, parcial: Partial<Corte>) => setDados((d) => ({ ...d, cortes: d.cortes.map((c) => (c.id === id ? { ...c, ...parcial } : c)) }));

  // clique numa região (modo 3): põe ou tira a região do corte selecionado
  function clicarRegiao(p: Ponto) {
    if (!selecionado) return setErro("Selecione um corte na lista (ou crie um) antes de clicar nas regiões.");
    if (!grade) return;
    const r = rotuloEm(grade, p);
    if (!r) return;
    setErro("");
    marcar();
    const atuais = selecionado.sementes ?? [];
    const sementes = atuais.some((s) => rotuloEm(grade, s) === r) ? atuais.filter((s) => rotuloEm(grade, s) !== r) : [...atuais, p];
    alterarCorte(selecionado.id, { sementes, manual: false, regiao: regiaoDe(grade, sementes.map((s) => rotuloEm(grade, s))) });
  }

  function voltarAsLinhas(c: Corte) {
    marcar();
    alterarCorte(c.id, { manual: false, regiao: grade && c.sementes?.length ? regiaoDe(grade, c.sementes.map((s) => rotuloEm(grade, s))) : [] });
  }

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro("");
    setEnviando(true);
    try {
      const imagem = await enviarImagem(dados.nome || "mapa", arquivo, "templater/mapas");
      const { largura, altura } = await tamanhoDaImagem(imagem);
      if ((dados.contorno?.length || dados.cortes.some((c) => c.regiao.length)) && !window.confirm("Trocar a imagem? O contorno, as linhas e as regiões continuam nas mesmas posições relativas; confira depois.")) return;
      marcar();
      setDados((d) => ({ ...d, imagem, largura, altura }));
    } catch (e) {
      setErro(`Não foi possível enviar a imagem para a Moovin: ${mensagem(e)}`);
    } finally {
      setEnviando(false);
    }
  }

  function novoCorte() {
    marcar();
    const corte: Corte = { id: novoId(), numero: proximoNumero(dados), nome: "", descricao: "", detalhes: "", regiao: [] };
    setDados((d) => ({ ...d, cortes: [...d.cortes, corte] }));
    setSelecionadoId(corte.id);
    setModo(dados.contorno?.length ? "cortes" : "ajuste");
  }

  function excluirCorte(c: Corte) {
    if (!window.confirm(`Excluir o corte "${c.nome || c.numero}"? Os produtos deste corte deixam de mostrar o Mapa de Corte.`)) return;
    marcar();
    setDados((d) => ({ ...d, cortes: d.cortes.filter((x) => x.id !== c.id) }));
    setSelecionadoId(null);
  }

  function redesenharContorno() {
    if (!window.confirm("Apagar o contorno do animal e desenhar de novo? As linhas de corte e os cortes ficam; as regiões são recalculadas quando o contorno novo for fechado.")) return;
    marcar();
    setDados((d) => ({ ...d, contorno: [] }));
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

  const semRegiao = dados.cortes.filter((c) => c.regiao.length < 3).length;

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
            <Campo rotulo="Imagem do animal" obrigatorio dica="A foto ou o desenho do animal, de lado e sem textos (de preferência PNG com fundo transparente). Fica salva na Moovin.">
              <input type="file" accept="image/*" disabled={enviando} onChange={(e) => { enviar(e.target.files?.[0]); e.target.value = ""; }} />
            </Campo>
          </div>
          {enviando && <small className="campo-dica">Enviando a imagem para a Moovin…</small>}
        </Secao>

        {dados.imagem && (
          <div className="mapa-editor">
            <div className="mapa-prancheta">
              <div className="mapa-modos">
                {MODOS.map((m) => (
                  <button key={m.id} type="button" className={modo === m.id ? "ativo" : ""} onClick={() => setModo(m.id)}
                    disabled={m.id === "cortes" && !(dados.contorno?.length)}
                    title={m.id === "cortes" && !dados.contorno?.length ? "Desenhe primeiro o contorno do animal" : undefined}>
                    {m.rotulo}
                  </button>
                ))}
                <span className="mapa-modos-acoes">
                  <button type="button" title="Desfazer (Ctrl+Z)" disabled={!passado.current.length} onClick={desfazer}>↶</button>
                  <button type="button" title="Refazer (Ctrl+Y)" disabled={!futuro.current.length} onClick={refazer}>↷</button>
                  {modo === "contorno" && !!dados.contorno?.length && <button type="button" onClick={redesenharContorno}>Redesenhar contorno</button>}
                </span>
              </div>
              <PranchetaKonva
                mapa={dados}
                modo={modo}
                selecionado={selecionado}
                regioes={regioes}
                rotulosDoSelecionado={rotulosDoSelecionado}
                alterar={alterar}
                marcar={marcar}
                clicarRegiao={clicarRegiao}
                selecionarCorte={setSelecionadoId}
                desfazer={desfazer}
                refazer={refazer}
              />
              <small className="campo-dica">
                {(dados.contorno?.length ?? 0) >= 3 ? `Contorno com ${dados.contorno!.length} pontos` : "Sem contorno do animal"} · {dados.linhas?.length ?? 0} linha(s) de corte ·{" "}
                {regioes.length} região(ões) · {dados.cortes.length} corte(s){semRegiao ? `, ${semRegiao} sem região` : ""}
              </small>
            </div>
            <div className="mapa-cortes">
              <div className="mapa-cortes-topo">
                <strong>Cortes ({dados.cortes.length})</strong>
                <button type="button" className="button button-secondary" onClick={novoCorte}>+ Novo corte</button>
              </div>
              <div className="lista-cortes">
                {ordenados.map((c) => {
                  const s = situacao(c);
                  return (
                    <button type="button" key={c.id} className={c.id === selecionadoId ? "item-corte ativo" : "item-corte"} onClick={() => setSelecionadoId(c.id)}>
                      <span className="numero">{c.numero}</span>
                      <span>{c.nome || <em>sem nome</em>}</span>
                      <span className={s.classe}>{s.texto}</span>
                    </button>
                  );
                })}
                {dados.cortes.length === 0 && <p className="vazio">Nenhum corte. Clique em "+ Novo corte" e marque as regiões dele no animal.</p>}
              </div>
              {selecionado && (
                <FormularioCorte
                  key={selecionado.id}
                  corte={selecionado}
                  temLinhas={!!grade}
                  aoMudar={(parcial) => { marcar(); alterarCorte(selecionado.id, parcial); }}
                  voltarAsLinhas={() => voltarAsLinhas(selecionado)}
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
