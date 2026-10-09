import { useEffect, useState } from "react";
import { blocosDoTexto, carregarConfigLoja, salvarConfigLoja, type LarguraLoja } from "../produtos/configLoja";
import { Campo, Secao } from "./produtos/campos";

// Configurações que valem no site inteiro (todas as páginas da loja), pelo script global do
// Templater. A Implantação cadastra esse script na Moovin.

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Desenho em escala de uma tela de 1920 px com o site limitado.
function Esquema({ largura }: { largura: LarguraLoja }) {
  const tela = 1920;
  const site = largura.ativo ? Math.min(largura.maxima, tela) : tela;
  return (
    <div className="esquema-largura" style={{ background: largura.ativo ? largura.corLaterais : "#fff" }} aria-label="Esquema da tela de 1920 px">
      <div className={`esquema-site${largura.ativo && largura.sombra ? " com-sombra" : ""}`} style={{ width: `${(site / tela) * 100}%` }}>
        <span>site: {site} px</span>
      </div>
      <small>tela de {tela} px</small>
    </div>
  );
}

export function ConfiguracoesLoja() {
  const [largura, setLargura] = useState<LarguraLoja | null>(null);
  const [blocos, setBlocos] = useState("");
  const [info, setInfo] = useState<{ em: string | null; por: string | null }>({ em: null, por: null });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    carregarConfigLoja().then(
      (c) => { setLargura(c.largura); setBlocos(c.largura.blocosLarguraTotal.join("\n")); setInfo({ em: c.atualizadoEm, por: c.atualizadoPor }); },
      (e) => setErro(mensagem(e)),
    );
  }, []);

  const alterar = (parcial: Partial<LarguraLoja>) => { setSalvo(false); setLargura((l) => (l ? { ...l, ...parcial } : l)); };

  async function salvar() {
    if (!largura) return;
    setErro("");
    setSalvando(true);
    try {
      const r = await salvarConfigLoja({ ...largura, blocosLarguraTotal: blocosDoTexto(blocos) });
      setLargura(r.largura);
      setBlocos(r.largura.blocosLarguraTotal.join("\n"));
      setInfo({ em: r.atualizadoEm, por: null });
      setSalvo(true);
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="breadcrumbs">
          <strong>Configurações da loja</strong>
          {info.em && <span>Salvo em {new Date(info.em).toLocaleString("pt-BR")}{info.por ? ` por ${info.por}` : ""}</span>}
        </div>
        <div className="heading-actions">
          <button className="button button-primary" disabled={!largura || salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </header>
      <div className="pagina-produto">
        <p className="campo-dica">
          Estas configurações valem em <strong>todas as páginas do site</strong> (home, categorias, produtos e páginas de texto). Elas chegam à loja pelo
          script global do Templater, que é cadastrado na Moovin pela tela de <a href="#/implantacao">Implantação</a>. Depois de salvar, a loja recebe a
          mudança em cerca de 1 minuto.
        </p>
        {erro && <p className="caixa-erros">{erro}</p>}
        {salvo && <p className="aviso">Salvo. A loja recebe a mudança em cerca de 1 minuto.</p>}
        {!largura && !erro && <p className="vazio">Carregando…</p>}

        {largura && (
          <Secao titulo="Largura do site no desktop" descricao="Limita o site a uma largura máxima em telas grandes; acima dela, o site fica centralizado. Notebooks menores e celulares não mudam.">
            <div className="campo">
              <span className="campo-rotulo">Limite</span>
              <label className="campo-check">
                <input type="checkbox" checked={largura.ativo} onChange={(e) => alterar({ ativo: e.target.checked })} /> Limitar a largura do site
              </label>
            </div>
            <div className="linha-campos">
              <Campo rotulo="Largura máxima (px)" dica="De 960 a 2560. O padrão é 1280.">
                <input className="entrada" type="number" min={960} max={2560} step={10} value={largura.maxima} disabled={!largura.ativo}
                  onChange={(e) => alterar({ maxima: Number(e.target.value) })} />
              </Campo>
              <Campo rotulo="Cor das laterais" dica="O fundo que aparece dos dois lados do site.">
                <span className="entrada-com-botao">
                  <input type="color" value={largura.corLaterais} disabled={!largura.ativo} onChange={(e) => alterar({ corLaterais: e.target.value })} />
                  <input className="entrada" value={largura.corLaterais} disabled={!largura.ativo} maxLength={7} onChange={(e) => alterar({ corLaterais: e.target.value })} />
                </span>
              </Campo>
              <div className="campo">
                <span className="campo-rotulo">Acabamento</span>
                <label className="campo-check">
                  <input type="checkbox" checked={largura.sombra} disabled={!largura.ativo} onChange={(e) => alterar({ sombra: e.target.checked })} /> Sombra leve nas bordas do site
                </label>
              </div>
            </div>
            <Campo rotulo="Blocos de largura total" dica="Blocos de HTML próprios (feitos no editor da Moovin) que usam a largura da tela inteira (100vw). Eles passam a acompanhar o limite. Um por linha, no formato #id ou .classe.">
              <textarea className="entrada" rows={4} value={blocos} disabled={!largura.ativo} onChange={(e) => { setSalvo(false); setBlocos(e.target.value); }} />
            </Campo>
            <Esquema largura={largura} />
          </Secao>
        )}
      </div>
    </>
  );
}
