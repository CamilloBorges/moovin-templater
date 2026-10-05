import { useState } from "react";
import { Puck } from "@puckeditor/core";
import { config } from "./templater/config";
import { dicionario } from "./templater/dicionario";
import { BarraDeAcoes, BotaoModoPrevia, Estrutura } from "./templater/estrutura";
import { lerTemplate, templatePadrao, type TemplateData } from "./templater/padrao";
import { produtoDemonstracao } from "./templater/produto";

const CHAVE_RASCUNHO = "templater:rascunho";
const CHAVE_PUBLICADO = "templater:publicado";

const viewports = [
  { width: 1280, label: "Desktop", icon: "Monitor" as const },
  { width: 390, label: "Celular", icon: "Smartphone" as const },
];

function App() {
  const [inicial, setInicial] = useState(() => lerTemplate(CHAVE_RASCUNHO) ?? templatePadrao);
  const [versao, setVersao] = useState(0);
  const [dados, setDados] = useState<TemplateData>(inicial);
  const [status, setStatus] = useState(lerTemplate(CHAVE_RASCUNHO) ? "Rascunho carregado" : "Layout padrão");

  function salvar(publicar: boolean) {
    const json = JSON.stringify(dados);
    localStorage.setItem(CHAVE_RASCUNHO, json);
    if (publicar) localStorage.setItem(CHAVE_PUBLICADO, json);
    setStatus(publicar ? "Template publicado" : "Rascunho salvo");
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">m</div>
          <div><strong>moovin</strong><span>PAINEL DA LOJA</span></div>
        </div>
        <div className="nav-caption">MENU PRINCIPAL</div>
        <nav className="side-nav">
          <a href="#produtos"><span>▧</span> Produtos</a>
          <a className="nav-active" href="#aparencia"><span>◩</span> Aparência</a>
        </nav>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Aparência</span><b>/</b><strong>Templater: página de produto</strong></div>
          <div className="heading-actions">
            <span className="save-indicator">
              <span className={status === "Alterações não salvas" ? "status-dot amber" : "status-dot"} />{status}
            </span>
            <button className="button button-plain" onClick={restaurarPadrao}>Restaurar padrão</button>
            <button className="button button-plain" onClick={exportar}>Exportar JSON</button>
            <button className="button button-secondary" onClick={() => salvar(false)}>Salvar rascunho</button>
            <button className="button button-primary" onClick={() => salvar(true)}>Publicar</button>
          </div>
        </header>

        <div className="editor-puck">
          <Puck
            key={versao}
            config={config}
            data={inicial}
            onChange={(novo) => { setDados(novo); setStatus("Alterações não salvas"); }}
            metadata={{ produto: produtoDemonstracao }}
            viewports={viewports}
            dictionary={dicionario}
            headerTitle={dados.root.props?.title ?? ""}
            overrides={{ headerActions: BotaoModoPrevia, outline: Estrutura, actionBar: BarraDeAcoes }}
            height="100%"
          />
        </div>
      </main>
    </div>
  );
}

export default App;
