import { useEffect, useState } from "react";
import { EditorTexto } from "../componentes/EditorTexto";
import {
  excluirModelo, excluirTipoAba, listarModelos, listarTiposAba, salvarModelo, salvarTipoAba, type DadosModelo, type DadosTipoAba,
} from "../produtos/modelos";
import type { ModeloCadastro, TipoAba } from "../templater/produto";
import { Campo, Secao, Texto } from "./produtos/campos";

// Cadastro de abas (título, conteúdo modelo, obrigatória e instrução) e modelos de cadastro
// (a sequência de abas de um tipo de produto). O modelo padrão entra nos produtos que ainda
// não têm Complemento; nos outros, pelo botão "Aplicar modelo" da tela do produto.

const ABA_VAZIA: DadosTipoAba = { titulo: "", conteudoModelo: "", obrigatoria: false, instrucao: "" };
const MODELO_VAZIO: DadosModelo = { nome: "", padrao: false, abas: [] };

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

function FormularioAba({ tipo, fechar, salvo }: { tipo: TipoAba | null; fechar: () => void; salvo: () => void }) {
  const [dados, setDados] = useState<DadosTipoAba>(tipo ?? ABA_VAZIA);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const alterar = (parcial: Partial<DadosTipoAba>) => setDados((d) => ({ ...d, ...parcial }));

  async function salvar() {
    setErro("");
    setSalvando(true);
    try {
      await salvarTipoAba(dados, tipo?.id);
      salvo();
    } catch (e) {
      setErro(mensagem(e));
      setSalvando(false);
    }
  }

  return (
    <Secao titulo={tipo ? `Editar aba: ${tipo.titulo}` : "Nova aba"} descricao={tipo ? "Mudar o título muda o nome da aba em todos os produtos que a usam." : undefined}>
      {erro && <p className="caixa-erros">{erro}</p>}
      <div className="linha-campos">
        <Campo rotulo="Título" obrigatorio dica="Como aparece na página da loja.">
          <Texto valor={dados.titulo} aoMudar={(titulo) => alterar({ titulo })} placeholder="Ex.: Conservação" maxLength={60} />
        </Campo>
        <div className="campo">
          <span className="campo-rotulo">Preenchimento</span>
          <label className="campo-check">
            <input type="checkbox" checked={dados.obrigatoria} onChange={(e) => alterar({ obrigatoria: e.target.checked })} /> Obrigatória (o produto não salva com ela vazia)
          </label>
        </div>
      </div>
      <Campo rotulo="Instrução de preenchimento" dica={`${dados.instrucao.length}/300. Aparece para quem cadastra o produto; não vai para a loja.`}>
        <textarea className="entrada" rows={2} maxLength={300} value={dados.instrucao} onChange={(e) => alterar({ instrucao: e.target.value })}
          placeholder="Ex.: Informe a temperatura e o prazo depois de aberto." />
      </Campo>
      <Campo rotulo="Conteúdo modelo" dica="Já vem preenchido quando a aba entra no produto por um modelo; dá para ajustar em cada produto.">
        <EditorTexto valor={dados.conteudoModelo} aoMudar={(conteudoModelo) => alterar({ conteudoModelo })} />
      </Campo>
      <div className="linha-acoes">
        <span />
        <span className="heading-actions">
          <button type="button" className="button button-secondary" onClick={fechar}>Cancelar</button>
          <button type="button" className="button button-primary" disabled={salvando || !dados.titulo.trim()} onClick={salvar}>{salvando ? "Salvando…" : "Salvar aba"}</button>
        </span>
      </div>
    </Secao>
  );
}

function FormularioModelo({ modelo, tipos, fechar, salvo }: { modelo: ModeloCadastro | null; tipos: TipoAba[]; fechar: () => void; salvo: () => void }) {
  const [dados, setDados] = useState<DadosModelo>(modelo ?? MODELO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const alterar = (parcial: Partial<DadosModelo>) => setDados((d) => ({ ...d, ...parcial }));
  const tituloDe = (id: string) => tipos.find((t) => t.id === id)?.titulo ?? "(aba excluída)";
  const disponiveis = tipos.filter((t) => !dados.abas.includes(t.id));
  const mover = (i: number, d: number) => {
    const abas = [...dados.abas];
    [abas[i], abas[i + d]] = [abas[i + d], abas[i]];
    alterar({ abas });
  };

  async function salvar() {
    setErro("");
    setSalvando(true);
    try {
      await salvarModelo(dados, modelo?.id);
      salvo();
    } catch (e) {
      setErro(mensagem(e));
      setSalvando(false);
    }
  }

  return (
    <Secao titulo={modelo ? `Editar modelo: ${modelo.nome}` : "Novo modelo"} descricao="A sequência de abas que um produto deste tipo recebe.">
      {erro && <p className="caixa-erros">{erro}</p>}
      <div className="linha-campos">
        <Campo rotulo="Nome" obrigatorio>
          <Texto valor={dados.nome} aoMudar={(nome) => alterar({ nome })} placeholder="Ex.: Carnes" maxLength={60} />
        </Campo>
        <div className="campo">
          <span className="campo-rotulo">Uso</span>
          <label className="campo-check">
            <input type="checkbox" checked={dados.padrao} onChange={(e) => alterar({ padrao: e.target.checked })} /> Modelo padrão (vem selecionado nos produtos)
          </label>
        </div>
      </div>
      <div className="campo">
        <span className="campo-rotulo">Abas, na ordem da página</span>
        <div className="itens-aba">
          {dados.abas.map((id, i) => (
            <div className="item-aba-topo item-modelo" key={id}>
              <span className="item-aba-numero">{String(i + 1).padStart(2, "0")}</span>
              <span className="item-modelo-titulo">
                {tituloDe(id)}
                {tipos.find((t) => t.id === id)?.obrigatoria && <span className="selo-obrigatoria">obrigatória</span>}
              </span>
              <button type="button" className="botao-icone" title="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>↑</button>
              <button type="button" className="botao-icone" title="Descer" disabled={i === dados.abas.length - 1} onClick={() => mover(i, 1)}>↓</button>
              <button type="button" className="botao-icone perigo" title="Tirar do modelo" onClick={() => alterar({ abas: dados.abas.filter((a) => a !== id) })}>×</button>
            </div>
          ))}
          {dados.abas.length === 0 && <p className="vazio">Nenhuma aba no modelo.</p>}
          {disponiveis.length > 0 ? (
            <select className="entrada seletor-adicionar" value="" onChange={(e) => e.target.value && alterar({ abas: [...dados.abas, e.target.value] })}>
              <option value="">+ Adicionar aba ao modelo…</option>
              {disponiveis.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
            </select>
          ) : (
            tipos.length === 0 && <small className="campo-dica">Cadastre as abas primeiro (acima).</small>
          )}
        </div>
      </div>
      <div className="linha-acoes">
        <span />
        <span className="heading-actions">
          <button type="button" className="button button-secondary" onClick={fechar}>Cancelar</button>
          <button type="button" className="button button-primary" disabled={salvando || !dados.nome.trim()} onClick={salvar}>{salvando ? "Salvando…" : "Salvar modelo"}</button>
        </span>
      </div>
    </Secao>
  );
}

export function AbasModelos() {
  const [tipos, setTipos] = useState<TipoAba[] | null>(null);
  const [modelos, setModelos] = useState<ModeloCadastro[] | null>(null);
  const [erro, setErro] = useState("");
  const [abaEditando, setAbaEditando] = useState<TipoAba | "nova" | null>(null);
  const [modeloEditando, setModeloEditando] = useState<ModeloCadastro | "novo" | null>(null);

  const carregar = () =>
    Promise.all([listarTiposAba(), listarModelos()]).then(([t, m]) => { setTipos(t); setModelos(m); }, (e) => setErro(mensagem(e)));
  useEffect(() => { carregar(); }, []);

  const usoEmModelos = (id: string) => modelos?.filter((m) => m.abas.includes(id)).map((m) => m.nome) ?? [];

  async function executar(acao: () => Promise<unknown>) {
    setErro("");
    try {
      await acao();
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    }
  }

  const excluirAba = (t: TipoAba) =>
    window.confirm(`Excluir a aba "${t.titulo}"? Ela sai dos modelos; nos produtos que a usam, fica como aba avulsa, com o conteúdo de cada um.`) &&
    executar(() => excluirTipoAba(t.id));
  const excluirModeloConfirmado = (m: ModeloCadastro) =>
    window.confirm(`Excluir o modelo "${m.nome}"? Os produtos não mudam.${m.padrao ? " Outro modelo passa a ser o padrão." : ""}`) &&
    executar(() => excluirModelo(m.id));

  return (
    <>
      <header className="topbar">
        <div className="breadcrumbs"><strong>Abas e modelos</strong>{tipos && modelos && <span>{tipos.length} abas · {modelos.length} modelos</span>}</div>
        <div className="heading-actions">
          <button className="button button-secondary" disabled={!!abaEditando} onClick={() => setAbaEditando("nova")}>Nova aba</button>
          <button className="button button-primary" disabled={!!modeloEditando || !tipos?.length} onClick={() => setModeloEditando("novo")}>Novo modelo</button>
        </div>
      </header>
      <div className="pagina-produto">
        {erro && <p className="caixa-erros">{erro}</p>}

        {abaEditando && (
          <FormularioAba
            key={abaEditando === "nova" ? "nova" : abaEditando.id}
            tipo={abaEditando === "nova" ? null : abaEditando}
            fechar={() => setAbaEditando(null)}
            salvo={() => { setAbaEditando(null); carregar(); }}
          />
        )}

        <Secao titulo="Abas cadastradas" descricao="As abas que os produtos podem ter. O título vem daqui; o conteúdo é de cada produto.">
          <table className="tabela-produtos">
            <thead><tr><th>Título</th><th>Instrução</th><th>Nos modelos</th><th /></tr></thead>
            <tbody>
              {!tipos && !erro && <tr><td colSpan={4} className="vazio">Carregando…</td></tr>}
              {tipos?.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.titulo}</strong>{t.obrigatoria && <span className="selo-obrigatoria">obrigatória</span>}</td>
                  <td>{t.instrucao || <span className="vazio">—</span>}</td>
                  <td>{usoEmModelos(t.id).join(", ") || <span className="vazio">nenhum</span>}</td>
                  <td className="acoes-linha">
                    <button type="button" className="button button-plain" onClick={() => setAbaEditando(t)}>Editar</button>
                    <button type="button" className="button button-plain perigo" onClick={() => excluirAba(t)}>Excluir</button>
                  </td>
                </tr>
              ))}
              {tipos?.length === 0 && <tr><td colSpan={4} className="vazio">Nenhuma aba cadastrada. Comece por "Nova aba".</td></tr>}
            </tbody>
          </table>
        </Secao>

        {modeloEditando && tipos && (
          <FormularioModelo
            key={modeloEditando === "novo" ? "novo" : modeloEditando.id}
            modelo={modeloEditando === "novo" ? null : modeloEditando}
            tipos={tipos}
            fechar={() => setModeloEditando(null)}
            salvo={() => { setModeloEditando(null); carregar(); }}
          />
        )}

        <Secao titulo="Modelos de cadastro" descricao="O modelo padrão entra sozinho nos produtos que ainda não têm Complemento. Nos outros, use “Aplicar modelo” na tela do produto.">
          <table className="tabela-produtos">
            <thead><tr><th>Modelo</th><th>Abas, na ordem</th><th /></tr></thead>
            <tbody>
              {!modelos && !erro && <tr><td colSpan={3} className="vazio">Carregando…</td></tr>}
              {modelos?.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.nome}</strong>{m.padrao && <span className="selo-padrao">padrão</span>}</td>
                  <td>
                    <div className="fichas">
                      {m.abas.map((id, i) => <span className="ficha ficha-fixa" key={id}>{i + 1}. {tipos?.find((t) => t.id === id)?.titulo}</span>)}
                      {m.abas.length === 0 && <span className="vazio">sem abas</span>}
                    </div>
                  </td>
                  <td className="acoes-linha">
                    {!m.padrao && <button type="button" className="button button-plain" onClick={() => executar(() => salvarModelo({ nome: m.nome, abas: m.abas, padrao: true }, m.id))}>Tornar padrão</button>}
                    <button type="button" className="button button-plain" onClick={() => setModeloEditando(m)}>Editar</button>
                    <button type="button" className="button button-plain perigo" onClick={() => excluirModeloConfirmado(m)}>Excluir</button>
                  </td>
                </tr>
              ))}
              {modelos?.length === 0 && <tr><td colSpan={3} className="vazio">Nenhum modelo. O primeiro que você criar vira o padrão.</td></tr>}
            </tbody>
          </table>
        </Secao>
      </div>
    </>
  );
}
