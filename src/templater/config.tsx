import { useState, type CSSProperties } from "react";
import type { Config, Slot } from "@puckeditor/core";
import { formatarMoeda, precoPorUnidade, type ProdutoTemplate } from "./produto";

// Blocos do template da página de produto. Os blocos de "Produto (Moovin)" representam
// componentes nativos da loja: o template decide onde e como aparecem, a Moovin executa.

type SimNao = "sim" | "nao";
const simNao = {
  type: "radio" as const,
  options: [
    { label: "Sim", value: "sim" },
    { label: "Não", value: "nao" },
  ],
};

type Blocos = {
  Colunas: { proporcao: "50/50" | "60/40" | "40/60"; esquerda: Slot; direita: Slot };
  Cartao: { fundo: "branco" | "transparente"; conteudo: Slot };
  Galeria: { sombra: SimNao };
  Titulo: { mostrarCodigo: SimNao; mostrarAvaliacao: SimNao; mostrarCompartilhar: SimNao };
  LinhaCompra: {};
  BarraCompraFixa: {};
  Resumo: {};
  PrecoPorUnidade: {};
  AbasDetalhes: { sobretitulo: string; titulo: string };
  Texto: { texto: string };
};

// Todo bloco tem um nome próprio, usado só no editor (estrutura e etiqueta na prévia).
type ComNome<T> = { [K in keyof T]: T[K] & { nome?: string } };

export type RaizTemplate = { title: string; corPrincipal: string; corDestaque: string };

const produtoDe = (metadata: Record<string, unknown>) => metadata.produto as ProdutoTemplate;

function Vazio({ texto }: { texto: string }) {
  return <div className="tpl-vazio">{texto}</div>;
}

function Abas({ abas }: { abas: ProdutoTemplate["complemento"]["abas"] }) {
  const [ativa, setAtiva] = useState(0);
  const atual = abas[Math.min(ativa, abas.length - 1)];
  return (
    <div className="tpl-abas">
      <div className="tpl-abas-nav" role="tablist">
        {abas.map((aba, i) => (
          <button key={aba.titulo + i} type="button" role="tab" aria-selected={i === ativa} onClick={() => setAtiva(i)}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            {aba.titulo}
          </button>
        ))}
      </div>
      <div className="tpl-abas-painel" role="tabpanel">
        {atual.conteudo.split("\n\n").map((paragrafo, i) => <p key={i}>{paragrafo}</p>)}
      </div>
    </div>
  );
}

export const config: Config<ComNome<Blocos>, RaizTemplate> = {
  root: {
    fields: {
      title: { type: "text", label: "Nome do template" },
      corPrincipal: { type: "text", label: "Cor principal" },
      corDestaque: { type: "text", label: "Cor de destaque" },
    },
    render: ({ children, corPrincipal, corDestaque }) => (
      <div className="tpl" style={{ "--tpl-principal": corPrincipal, "--tpl-destaque": corDestaque } as CSSProperties}>
        {children}
      </div>
    ),
  },
  categories: {
    estrutura: { title: "Estrutura", components: ["Colunas", "Cartao"] },
    moovin: { title: "Produto (Moovin)", components: ["Galeria", "Titulo", "LinhaCompra", "BarraCompraFixa"] },
    complemento: { title: "Complemento do cadastro", components: ["Resumo", "PrecoPorUnidade", "AbasDetalhes"] },
    conteudo: { title: "Conteúdo", components: ["Texto"] },
  },
  components: {
    Colunas: {
      label: "Colunas",
      fields: {
        proporcao: {
          type: "select",
          label: "Proporção",
          options: [
            { label: "50% / 50%", value: "50/50" },
            { label: "60% / 40%", value: "60/40" },
            { label: "40% / 60%", value: "40/60" },
          ],
        },
        esquerda: { type: "slot", label: "Coluna esquerda" },
        direita: { type: "slot", label: "Coluna direita" },
      },
      defaultProps: { proporcao: "50/50", esquerda: [], direita: [] },
      render: ({ proporcao, esquerda: Esquerda, direita: Direita }) => {
        const [a, b] = proporcao.split("/");
        return (
          <div className="tpl-colunas" style={{ gridTemplateColumns: `${a}fr ${b}fr` }}>
            <Esquerda className="tpl-coluna" />
            <Direita className="tpl-coluna" />
          </div>
        );
      },
    },
    Cartao: {
      label: "Cartão",
      fields: {
        fundo: {
          type: "radio",
          label: "Fundo",
          options: [
            { label: "Branco", value: "branco" },
            { label: "Transparente", value: "transparente" },
          ],
        },
        conteudo: { type: "slot", label: "Conteúdo" },
      },
      defaultProps: { fundo: "branco", conteudo: [] },
      render: ({ fundo, conteudo: Conteudo }) => <Conteudo className={`tpl-cartao tpl-cartao-${fundo}`} />,
    },
    Galeria: {
      label: "Galeria de imagens",
      fields: { sombra: { ...simNao, label: "Sombra na imagem" } },
      defaultProps: { sombra: "sim" },
      render: ({ sombra, puck }) => {
        const { moovin } = produtoDe(puck.metadata);
        return (
          <div className="tpl-galeria">
            <img className={sombra === "sim" ? "tpl-sombra" : ""} src={moovin.imagens[0]} alt={moovin.nome} />
          </div>
        );
      },
    },
    Titulo: {
      label: "Nome do produto",
      fields: {
        mostrarCodigo: { ...simNao, label: "Mostrar código" },
        mostrarAvaliacao: { ...simNao, label: "Mostrar avaliação" },
        mostrarCompartilhar: { ...simNao, label: "Botão compartilhar" },
      },
      defaultProps: { mostrarCodigo: "sim", mostrarAvaliacao: "sim", mostrarCompartilhar: "sim" },
      render: ({ mostrarCodigo, mostrarAvaliacao, mostrarCompartilhar, puck }) => {
        const { moovin } = produtoDe(puck.metadata);
        return (
          <div className="tpl-titulo">
            <h1>{moovin.nome}</h1>
            <div className="tpl-titulo-linha">
              {mostrarCodigo === "sim" && <span>Cod.: {moovin.codigo}</span>}
              {mostrarAvaliacao === "sim" && moovin.avaliacao && (
                <span className="tpl-estrelas">★★★★★ ({moovin.avaliacao.total})</span>
              )}
              {mostrarCompartilhar === "sim" && <span className="tpl-compartilhar" aria-label="Compartilhar">↗</span>}
            </div>
          </div>
        );
      },
    },
    LinhaCompra: {
      label: "Preço, quantidade e comprar",
      render: ({ puck }) => {
        const { moovin } = produtoDe(puck.metadata);
        return (
          <div className="tpl-compra">
            <strong>{formatarMoeda(moovin.preco)}</strong>
            <span className="tpl-quantidade">− 1 +</span>
            <span className="tpl-comprar">COMPRAR</span>
          </div>
        );
      },
    },
    BarraCompraFixa: {
      label: "Barra de compra fixa",
      render: ({ puck }) => {
        const { moovin } = produtoDe(puck.metadata);
        return (
          <div className="tpl-barra-fixa">
            {puck.isEditing && <small>Aparece ao rolar, quando a área de compra sai da tela</small>}
            <strong>{formatarMoeda(moovin.preco)}</strong>
            <span className="tpl-quantidade">− 1 +</span>
            <span className="tpl-comprar">COMPRAR</span>
          </div>
        );
      },
    },
    Resumo: {
      label: "Resumo do produto",
      render: ({ puck }) => {
        const { resumo } = produtoDe(puck.metadata).complemento;
        if (resumo) return <p className="tpl-resumo">{resumo}</p>;
        return puck.isEditing ? <Vazio texto="Produto sem resumo no complemento" /> : <></>;
      },
    },
    PrecoPorUnidade: {
      label: "Preço por kg / L / un",
      render: ({ puck }) => {
        const { moovin, complemento } = produtoDe(puck.metadata);
        const texto = precoPorUnidade(moovin.preco, complemento.conteudoComercial);
        if (texto) return <p className="tpl-preco-unidade">{texto}</p>;
        return puck.isEditing ? <Vazio texto="Produto sem conteúdo comercial no complemento" /> : <></>;
      },
    },
    AbasDetalhes: {
      label: "Abas de detalhes",
      fields: {
        sobretitulo: { type: "text", label: "Sobretítulo" },
        titulo: { type: "text", label: "Título" },
      },
      defaultProps: { sobretitulo: "CONHEÇA O PRODUTO", titulo: "Informações e detalhes" },
      render: ({ sobretitulo, titulo, puck }) => {
        const { abas } = produtoDe(puck.metadata).complemento;
        return (
          <section className="tpl-detalhes">
            <span className="tpl-sobretitulo">{sobretitulo}</span>
            <h2>{titulo}</h2>
            {abas.length > 0 ? <Abas abas={abas} /> : puck.isEditing && <Vazio texto="Produto sem abas no complemento" />}
          </section>
        );
      },
    },
    Texto: {
      label: "Texto livre",
      fields: { texto: { type: "textarea", label: "Texto" } },
      defaultProps: { texto: "Escreva aqui" },
      render: ({ texto }) => <p className="tpl-texto">{texto}</p>,
    },
  },
};

for (const bloco of Object.values(config.components)) {
  bloco.fields = { nome: { type: "text", label: "Nome do bloco" }, ...bloco.fields };
}

export function nomeDoBloco(tipo: string, nome?: string) {
  return nome?.trim() || config.components[tipo as keyof Blocos]?.label || tipo;
}
