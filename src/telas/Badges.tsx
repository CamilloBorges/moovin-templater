import { useEffect, useState } from "react";
import { enviarImagem, excluirBadge, listarBadges, salvarBadge, type DadosBadge } from "../produtos/badges";
import type { Badge } from "../templater/produto";
import { Campo, Secao, Texto } from "./produtos/campos";
import { EditorImagem } from "../componentes/EditorImagem";

// Cadastro de badges (selos) da loja. A imagem é enviada para a Moovin; o resto fica no nosso servidor.
// Os badges são associados aos produtos nos Campos Complementares da tela do produto.

const VAZIO: DadosBadge = { nome: "", imagem: "", tooltip: "", link: "" };

// O badge como aparece na página: imagem, balão ao passar o mouse e link (se houver).
function Amostra({ badge }: { badge: DadosBadge }) {
  if (!badge.imagem) return <span className="sem-imagem amostra-badge" />;
  const conteudo = (
    <>
      <img src={badge.imagem} alt={badge.nome} width={48} height={48} />
      {badge.tooltip && <span className="tpl-badge-balao" role="tooltip">{badge.tooltip}</span>}
    </>
  );
  return (
    <span className="tpl amostra-badge">
      {badge.link ? (
        <a className="tpl-badge" href={badge.link} target="_blank" rel="noopener noreferrer">{conteudo}</a>
      ) : (
        <span className="tpl-badge" tabIndex={0}>{conteudo}</span>
      )}
    </span>
  );
}

function Formulario({ badge, fechar, salvo }: { badge: Badge | null; fechar: () => void; salvo: () => void }) {
  const [dados, setDados] = useState<DadosBadge>(badge ?? VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [editor, setEditor] = useState<File | string | null>(null); // imagem aberta no editor
  const alterar = (parcial: Partial<DadosBadge>) => setDados((d) => ({ ...d, ...parcial }));

  // A imagem escolhida passa pelo editor; o resultado (PNG) é enviado para a Moovin.
  async function enviarEditada(arquivo: File) {
    setErro("");
    setEnviando(true);
    try {
      alterar({ imagem: await enviarImagem(dados.nome || "badge", arquivo) });
      setEditor(null);
    } catch (e) {
      setErro(`Não foi possível enviar a imagem para a Moovin: ${e instanceof Error ? e.message : e}`);
      setEditor(null);
    } finally {
      setEnviando(false);
    }
  }

  async function salvar() {
    setErro("");
    setSalvando(true);
    try {
      await salvarBadge(dados, badge?.id);
      salvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  return (
    <Secao titulo={badge ? `Editar badge: ${badge.nome}` : "Novo badge"}>
      {erro && <p className="caixa-erros">{erro}</p>}
      <div className="badge-formulario">
        <div className="badge-campos">
          <Campo rotulo="Nome" obrigatorio>
            <Texto valor={dados.nome} aoMudar={(nome) => alterar({ nome })} placeholder="Ex.: Sem glúten" maxLength={80} />
          </Campo>
          <Campo rotulo="Imagem" obrigatorio dica="Abre no editor (tirar o fundo, enquadrar e redimensionar) e fica salva na Moovin como PNG.">
            <input type="file" accept="image/*" disabled={enviando} onChange={(e) => { const f = e.target.files?.[0]; if (f) setEditor(f); e.target.value = ""; }} />
          </Campo>
          {dados.imagem && (
            <button type="button" className="button button-plain" disabled={enviando} onClick={() => setEditor(dados.imagem)}>Editar a imagem atual</button>
          )}
          {enviando && <small className="campo-dica">Enviando a imagem para a Moovin…</small>}
          <Campo rotulo="Texto do balão (tooltip)" dica={`${dados.tooltip.length}/300 caracteres. Aparece ao passar o mouse sobre o badge.`}>
            <textarea className="entrada" rows={3} maxLength={300} value={dados.tooltip} onChange={(e) => alterar({ tooltip: e.target.value })} />
          </Campo>
          <Campo rotulo="Link da descrição completa" dica="Opcional. Em branco, o badge não tem link; preenchido, abre em outra aba.">
            <Texto valor={dados.link} aoMudar={(link) => alterar({ link })} placeholder="https://" />
          </Campo>
        </div>
        <div className="badge-previa">
          <span className="campo-rotulo">Como aparece (passe o mouse)</span>
          <Amostra badge={dados} />
        </div>
      </div>
      {editor && <EditorImagem origem={editor} nome={dados.nome} concluir={enviarEditada} fechar={() => setEditor(null)} />}
      <div className="linha-acoes">
        <span />
        <span className="heading-actions">
          <button type="button" className="button button-secondary" onClick={fechar}>Cancelar</button>
          <button type="button" className="button button-primary" disabled={salvando || enviando || !dados.nome || !dados.imagem} onClick={salvar}>
            {salvando ? "Salvando…" : "Salvar badge"}
          </button>
        </span>
      </div>
    </Secao>
  );
}

export function Badges() {
  const [lista, setLista] = useState<Badge[] | null>(null);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<Badge | "novo" | null>(null);
  const carregar = () => listarBadges().then(setLista, (e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  async function excluir(b: Badge) {
    if (!window.confirm(`Excluir o badge "${b.nome}"? Ele sai de todos os produtos que o usam.`)) return;
    try {
      await excluirBadge(b.id);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="breadcrumbs"><strong>Badges</strong>{lista && <span>{lista.length} cadastrados</span>}</div>
        <div className="heading-actions">
          <button className="button button-primary" disabled={!!editando} onClick={() => setEditando("novo")}>Novo badge</button>
        </div>
      </header>
      <div className="pagina-produto">
        {erro && <p className="caixa-erros">{erro}</p>}
        {editando && (
          <Formulario
            key={editando === "novo" ? "novo" : editando.id}
            badge={editando === "novo" ? null : editando}
            fechar={() => setEditando(null)}
            salvo={() => { setEditando(null); carregar(); }}
          />
        )}
        <table className="tabela-produtos tabela-badges">
          <thead>
            <tr><th /><th>Nome</th><th>Balão</th><th>Link</th><th /></tr>
          </thead>
          <tbody>
            {!lista && !erro && <tr><td colSpan={5} className="vazio">Carregando…</td></tr>}
            {lista?.map((b) => (
              <tr key={b.id}>
                <td><img src={b.imagem} alt="" /></td>
                <td><strong>{b.nome}</strong></td>
                <td>{b.tooltip || <span className="vazio">—</span>}</td>
                <td>{b.link ? <a href={b.link} target="_blank" rel="noopener noreferrer">{b.link}</a> : <span className="vazio">sem link</span>}</td>
                <td className="acoes-linha">
                  <button type="button" className="button button-plain" onClick={() => setEditando(b)}>Editar</button>
                  <button type="button" className="button button-plain perigo" onClick={() => excluir(b)}>Excluir</button>
                </td>
              </tr>
            ))}
            {lista?.length === 0 && <tr><td colSpan={5} className="vazio">Nenhum badge cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
