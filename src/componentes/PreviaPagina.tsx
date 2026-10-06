import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import css from "../templater/pagina.css?inline";
import type { EstadoCompra, LigacaoLoja } from "../templater/blocos";
import type { TemplateData } from "../templater/padrao";
import type { ProdutoTemplate } from "../templater/produto";
import { Pagina } from "../loja/Pagina";

// Prévia em tela cheia de como a página vai ficar na loja. Usa o mesmo renderizador do script
// da loja (src/loja/Pagina.tsx), dentro de um iframe com a largura do aparelho, para o CSS
// responsivo valer como no navegador do cliente. Quantidade e COMPRAR são simulados.

const APARELHOS = [
  { nome: "Desktop", largura: 1280 },
  { nome: "Tablet", largura: 768 },
  { nome: "Celular", largura: 390 },
] as const;

export function ligacaoSimulada(preco: number): LigacaoLoja {
  let estado: EstadoCompra = { preco, quantidade: "1", textoComprar: "COMPRAR" };
  const ouvintes = new Set<() => void>();
  const mudar = (parcial: Partial<EstadoCompra>) => {
    estado = { ...estado, ...parcial };
    ouvintes.forEach((o) => o());
  };
  return {
    estado: () => estado,
    assinar(aoMudar) {
      ouvintes.add(aoMudar);
      return () => ouvintes.delete(aoMudar);
    },
    alterarQuantidade(delta) {
      mudar({ quantidade: String(Math.max(1, Number(estado.quantidade) + delta)) });
    },
    comprar() {
      mudar({ textoComprar: "ADICIONADO (prévia)" });
      setTimeout(() => mudar({ textoComprar: "COMPRAR" }), 1500);
    },
    compartilhar() {},
  };
}

// Conteúdo renderizado dentro do iframe (portal no body dele, com o CSS da página).
function Moldura({ largura, children }: { largura: number; children: ReactNode }) {
  const [corpo, setCorpo] = useState<HTMLElement | null>(null);
  return (
    <>
      <iframe
        title="Prévia da página"
        className="previa-iframe"
        style={{ width: largura }}
        ref={(iframe) => {
          const doc = iframe?.contentDocument;
          if (!doc || corpo === doc.body) return;
          doc.open();
          doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#f4f1ec}${css}</style></head><body></body></html>`);
          doc.close();
          setCorpo(doc.body);
        }}
      />
      {corpo && createPortal(children, corpo)}
    </>
  );
}

export function PreviaPagina({ titulo, template, produto, fechar }: {
  titulo: string;
  template: TemplateData | null;
  produto: ProdutoTemplate | null;
  fechar: () => void;
}) {
  const [aparelho, setAparelho] = useState<(typeof APARELHOS)[number]>(APARELHOS[0]);
  const loja = useMemo(() => ligacaoSimulada(produto?.moovin.preco ?? 0), [produto]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);
  return (
    <div className="previa-tela" role="dialog" aria-label={titulo}>
      <header className="previa-barra">
        <strong>{titulo}</strong>
        <div className="previa-aparelhos">
          {APARELHOS.map((a) => (
            <button key={a.nome} type="button" className={a === aparelho ? "ativo" : ""} onClick={() => setAparelho(a)}>
              {a.nome} <small>{a.largura}px</small>
            </button>
          ))}
        </div>
        <button type="button" className="button button-secondary" onClick={fechar}>Fechar prévia</button>
      </header>
      <div className="previa-area">
        {template && produto ? (
          <Moldura key={aparelho.nome} largura={aparelho.largura}>
            <Pagina template={template} produto={produto} loja={loja} />
          </Moldura>
        ) : (
          <p className="vazio">Carregando…</p>
        )}
      </div>
    </div>
  );
}
