import { useEffect, useMemo, useState } from "react";
import { Puck } from "@puckeditor/core";
import { buscarCatalogo, carregarProduto, type ItemCatalogo } from "../produtos/moovin";
import { config } from "../templater/config";
import { dicionario } from "../templater/dicionario";
import { BarraDeAcoes, BotaoModoPrevia, Estrutura } from "../templater/estrutura";
import { carregarTemplate, salvarTemplate, templatePadrao, type TemplateData } from "../templater/padrao";
import { formatarMoeda, paraTemplate, type ProdutoTemplate } from "../templater/produto";
import { PreviaPagina } from "../componentes/PreviaPagina";
import { listarBadges } from "../produtos/badges";

const viewports = [
  { width: 1280, label: "Desktop", icon: "Monitor" as const },
  { width: 390, label: "Celular", icon: "Smartphone" as const },
];

// Produto de exemplo escolhido por último (conveniência deste navegador).
const CHAVE_EXEMPLO = "templater:produto-exemplo";
function lerExemplo() {
  try { return localStorage.getItem(CHAVE_EXEMPLO); } catch { return null; }
}
function gravarExemplo(id: string) {
  try { localStorage.setItem(CHAVE_EXEMPLO, id); } catch { /* sem armazenamento: só não lembra */ }
}

// Gaveta "Selecione um produto", como no editor de temas da Moovin (busca no catálogo publicado).
function SeletorProduto({ fechar, escolher }: { fechar?: () => void; escolher: (id: string) => void }) {
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<ItemCatalogo[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    setItens(null);
    const espera = setTimeout(() => buscarCatalogo(busca).then(setItens, (e) => setErro(e.message)), 300);
    return () => clearTimeout(espera);
  }, [busca]);
  return (
    <div className="gaveta-fundo" onClick={fechar}>
      <aside className="gaveta" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Selecione um produto</h2>
          {fechar && <button type="button" className="botao-icone" title="Fechar" onClick={fechar}>×</button>}
        </header>
        <input className="entrada" placeholder="Pesquisar produto" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
        {erro && <p className="campo-erro">{erro}</p>}
        <div className="gaveta-lista">
          {!itens && !erro && <p className="vazio">Carregando produtos…</p>}
          {itens?.map((i) => (
            <button key={i.produtoId} type="button" onClick={() => escolher(i.produtoId)}>
              {i.imagem ? <img src={i.imagem} alt="" loading="lazy" /> : <span className="sem-imagem" />}
              <span>{i.nome}</span>
              <b>{formatarMoeda(i.preco)}</b>
            </button>
          ))}
          {itens?.length === 0 && <p className="vazio">Nenhum produto encontrado.</p>}
        </div>
      </aside>
    </div>
  );
}

export function Templater({ fechar }: { fechar: () => void }) {
  const [inicial, setInicial] = useState<TemplateData | null>(null);
  const [versao, setVersao] = useState(0);
  const [dados, setDados] = useState<TemplateData>(templatePadrao);
  const [status, setStatus] = useState("");
  const [produto, setProduto] = useState<{ id: string; nome: string; template: ProdutoTemplate } | null>(null);
  const [seletor, setSeletor] = useState(false);
  const [erro, setErro] = useState("");
  const [previa, setPrevia] = useState(false);
  // Objetos estáveis: o Puck recalcula o editor quando estas referências mudam.
  const metadata = useMemo(() => ({ produto: produto?.template }), [produto]);
  const overrides = useMemo(() => ({ headerActions: BotaoModoPrevia, outline: Estrutura, actionBar: BarraDeAcoes }), []);

  // Template: o rascunho salvo, senão o publicado, senão o layout padrão.
  useEffect(() => {
    (async () => {
      const rascunho = await carregarTemplate("rascunho");
      const base = rascunho ?? (await carregarTemplate("publicado")) ?? templatePadrao;
      setInicial(base);
      setDados(base);
      setStatus(rascunho ? "Rascunho carregado" : "Layout padrão");
    })().catch((e) => setErro(e.message));
  }, []);

  function escolherProduto(id: string) {
    setSeletor(false);
    Promise.all([carregarProduto(id), listarBadges().catch(() => [])]).then(
      ([o, badges]) => { setProduto({ id, nome: o.cadastro.nome, template: paraTemplate(o.cadastro, badges) }); gravarExemplo(id); },
      (e) => setErro(`Não foi possível carregar o produto: ${e.message}`),
    );
  }

  // Produto de exemplo: o último escolhido; sem ele, abre o seletor (como na Moovin).
  useEffect(() => {
    const ultimo = lerExemplo();
    if (ultimo) escolherProduto(ultimo);
    else setSeletor(true);
  }, []);

  async function salvar(publicar: boolean) {
    setStatus("Salvando…");
    try {
      await salvarTemplate("rascunho", dados);
      if (publicar) await salvarTemplate("publicado", dados);
      setStatus(publicar ? "Template publicado" : "Rascunho salvo");
    } catch (e) {
      setStatus("Erro ao salvar");
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  function restaurarPadrao() {
    setInicial(templatePadrao);
    setDados(templatePadrao);
    setVersao((v) => v + 1); // remonta o Puck com o layout padrão
    setStatus("Alterações não salvas");
  }

  function exportar() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "template-pagina-produto.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function sair() {
    if (status === "Alterações não salvas" && !window.confirm("Há alterações não salvas no template. Sair mesmo assim?")) return;
    fechar();
  }

  return (
    <div className="templater-tela">
      <header className="topbar">
        <div className="breadcrumbs">
          <button type="button" className="botao-fechar-editor" title="Fechar o editor e voltar ao menu" onClick={sair}>× Fechar</button>
          <span>Aparência</span>
          <b>/</b>
          <strong>Templater: página de produto</strong>
        </div>
        <div className="heading-actions">
          <span className="save-indicator">
            <span className={status === "Alterações não salvas" ? "status-dot amber" : "status-dot"} />
            {status}
          </span>
          <button className="button button-plain seletor-produto" title="Trocar o produto de exemplo" onClick={() => setSeletor(true)}>
            {produto ? produto.nome : "Selecionar produto"} ⌄
          </button>
          <button className="button button-plain" onClick={restaurarPadrao}>Restaurar padrão</button>
          <button className="button button-plain" onClick={exportar}>Exportar JSON</button>
          <button className="button button-plain" disabled={!produto} onClick={() => setPrevia(true)}>Visualizar</button>
          <button className="button button-secondary" onClick={() => salvar(false)}>Salvar rascunho</button>
          <button className="button button-primary" onClick={() => salvar(true)}>Publicar</button>
        </div>
      </header>

      {erro && <p className="caixa-erros">{erro}</p>}
      <div className="editor-puck">
        {inicial && produto ? (
          <Puck
            key={versao}
            config={config}
            data={inicial}
            onChange={(novo) => {
              setDados(novo);
              setStatus("Alterações não salvas");
            }}
            metadata={metadata}
            viewports={viewports}
            dictionary={dicionario}
            headerTitle={dados.root.props?.title ?? ""}
            overrides={overrides}
            height="100%"
          />
        ) : (
          <p className="vazio carregando">{inicial ? "Selecione um produto de exemplo para editar o layout." : "Carregando o template…"}</p>
        )}
      </div>
      {seletor && <SeletorProduto fechar={produto ? () => setSeletor(false) : undefined} escolher={escolherProduto} />}
      {previa && (
        <PreviaPagina titulo="Prévia do rascunho (como vai ficar na loja)" template={dados} produto={produto?.template ?? null} fechar={() => setPrevia(false)} />
      )}
    </div>
  );
}
