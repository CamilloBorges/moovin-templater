import { useState } from "react";
import { Puck } from "@puckeditor/core";
import type { ProdutoCadastro } from "../produtos/modelo";
import { config } from "../templater/config";
import { dicionario } from "../templater/dicionario";
import { BarraDeAcoes, BotaoModoPrevia, Estrutura } from "../templater/estrutura";
import { CHAVE_PUBLICADO, CHAVE_RASCUNHO, lerTemplate, templatePadrao, type TemplateData } from "../templater/padrao";
import { paraTemplate } from "../templater/produto";

const viewports = [
  { width: 1280, label: "Desktop", icon: "Monitor" as const },
  { width: 390, label: "Celular", icon: "Smartphone" as const },
];

export function Templater({ produtos }: { produtos: ProdutoCadastro[] }) {
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

  const [produtoId, setProdutoId] = useState(produtos[0]?.id ?? "");
  const produto = produtos.find((p) => p.id === produtoId) ?? produtos[0];

  return (
    <>
      <header className="topbar">
        <div className="breadcrumbs">
          <span>Aparência</span>
          <b>/</b>
          <strong>Templater: página de produto</strong>
        </div>
        <div className="heading-actions">
          <span className="save-indicator">
            <span className={status === "Alterações não salvas" ? "status-dot amber" : "status-dot"} />
            {status}
          </span>
          <select
            className="entrada seletor-produto"
            title="Produto da prévia"
            value={produto?.id ?? ""}
            onChange={(e) => setProdutoId(e.target.value)}
          >
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome || "Sem nome"}
              </option>
            ))}
          </select>
          <button className="button button-plain" onClick={restaurarPadrao}>
            Restaurar padrão
          </button>
          <button className="button button-plain" onClick={exportar}>
            Exportar JSON
          </button>
          <button className="button button-secondary" onClick={() => salvar(false)}>
            Salvar rascunho
          </button>
          <button className="button button-primary" onClick={() => salvar(true)}>
            Publicar
          </button>
        </div>
      </header>

      <div className="editor-puck">
        <Puck
          key={versao}
          config={config}
          data={inicial}
          onChange={(novo) => {
            setDados(novo);
            setStatus("Alterações não salvas");
          }}
          metadata={{ produto: produto ? paraTemplate(produto) : null }}
          viewports={viewports}
          dictionary={dicionario}
          headerTitle={dados.root.props?.title ?? ""}
          overrides={{ headerActions: BotaoModoPrevia, outline: Estrutura, actionBar: BarraDeAcoes }}
          height="100%"
        />
      </div>
    </>
  );
}
