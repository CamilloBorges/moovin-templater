import * as B from "../templater/blocos";
import type { TemplateData } from "../templater/padrao";
import type { ProdutoTemplate } from "../templater/produto";

// Monta a página a partir do JSON do template (formato de dados do Puck), sem o Puck:
// cada item vira o bloco compartilhado correspondente.

type Item = { type: string; props: Record<string, any> };

function Bloco({ item }: { item: Item }) {
  const p = item.props ?? {};
  const slot = (chave: string) => (className: string) => (
    <div className={className}>
      {((p[chave] ?? []) as Item[]).map((filho, i) => <Bloco key={filho.props?.id ?? i} item={filho} />)}
    </div>
  );
  switch (item.type) {
    case "Colunas": return <B.Colunas proporcao={p.proporcao ?? "50/50"} esquerda={slot("esquerda")} direita={slot("direita")} />;
    case "Cartao": return <B.Cartao fundo={p.fundo ?? "branco"} conteudo={slot("conteudo")} />;
    case "Galeria": return <B.Galeria sombra={p.sombra} />;
    case "Titulo": return <B.Titulo mostrarCodigo={p.mostrarCodigo} mostrarAvaliacao={p.mostrarAvaliacao} mostrarCompartilhar={p.mostrarCompartilhar} />;
    case "LinhaCompra": return <B.LinhaCompra />;
    case "BarraCompraFixa": return <B.BarraCompraFixa />;
    case "Resumo": return <B.Resumo />;
    case "Descricao": return <B.Descricao sobretitulo={p.sobretitulo ?? ""} titulo={p.titulo ?? ""} />;
    case "PrecoPorUnidade": return <B.PrecoPorUnidade />;
    case "AbasDetalhes": return <B.AbasDetalhes sobretitulo={p.sobretitulo ?? ""} titulo={p.titulo ?? ""} estilo={p.estilo} numerar={p.numerar} />;
    case "Texto": return <B.Texto texto={p.texto ?? ""} />;
    default: return null; // bloco desconhecido (template mais novo que o script): ignora
  }
}

export function Pagina({ template, produto, loja }: { template: TemplateData; produto: ProdutoTemplate; loja: B.LigacaoLoja }) {
  const raiz = (template.root?.props ?? template.root ?? {}) as { corPrincipal?: string; corDestaque?: string };
  return (
    <B.AmbienteProvider value={{ produto, editando: false, loja }}>
      <B.Raiz corPrincipal={raiz.corPrincipal ?? "#173a4d"} corDestaque={raiz.corDestaque ?? "#b58a3c"} naLoja>
        {(template.content as Item[]).map((item, i) => <Bloco key={item.props?.id ?? i} item={item} />)}
      </B.Raiz>
    </B.AmbienteProvider>
  );
}
