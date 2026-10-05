import { useState, type CSSProperties } from "react";
import type { Config, Slot } from "@puckeditor/core";
import DOMPurify from "dompurify";
import { formatarMoeda, precoPorUnidade, type Aba, type ProdutoTemplate } from "./produto";

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
  AbasDetalhes: { sobretitulo: string; titulo: string; estilo: "abas" | "sanfona" | "lista"; numerar: SimNao };
  Texto: { texto: string };
};

// Todo bloco tem um nome próprio, usado só no editor (estrutura e etiqueta na prévia).
type ComNome<T> = { [K in keyof T]: T[K] & { nome?: string } };

export type RaizTemplate = { title: string; corPrincipal: string; corDestaque: string };

const produtoDe = (metadata: Record<string, unknown>) => metadata.produto as ProdutoTemplate;

function Vazio({ texto }: { texto: string }) {
  return <div className="tpl-vazio">{texto}</div>;
}

const html = (conteudo: string) => ({ __html: DOMPurify.sanitize(conteudo) });

// O template só decide onde e como as abas aparecem; elas vêm do Complemento do produto,
// quantas forem. Estilos: abas (navegação horizontal), sanfona (abre e fecha) e lista (tudo aberto).
function Abas({ abas, estilo, numerar }: { abas: Aba[]; estilo: "abas" | "sanfona" | "lista"; numerar: boolean }) {
  const [ativa, setAtiva] = useState(0);
  const indice = Math.min(ativa, abas.length - 1);
  const numero = (i: number) => numerar && <span className="tpl-aba-numero">{String(i + 1).padStart(2, "0")}</span>;
  if (estilo === "lista") {
    return (
      <div className="tpl-abas tpl-abas-lista">
        {abas.map((aba, i) => (
          <section key={aba.titulo + i}>
            <h3 className="tpl-aba-titulo">{numero(i)}{aba.titulo}</h3>
            <div className="tpl-aba-conteudo" dangerouslySetInnerHTML={html(aba.conteudo)} />
          </section>
        ))}
      </div>
    );
  }
  if (estilo === "sanfona") {
    return (
      <div className="tpl-abas tpl-abas-sanfona">
        {abas.map((aba, i) => (
          <details key={aba.titulo + i} open={i === 0}>
            <summary className="tpl-aba-titulo">{numero(i)}{aba.titulo}</summary>
            <div className="tpl-aba-conteudo" dangerouslySetInnerHTML={html(aba.conteudo)} />
          </details>
        ))}
      </div>
    );
  }
  return (
    <div className="tpl-abas">
      <div className="tpl-abas-nav" role="tablist">
        {abas.map((aba, i) => (
          <button key={aba.titulo + i} type="button" role="tab" aria-selected={i === indice} onClick={() => setAtiva(i)}>
            {numero(i)}
            {aba.titulo}
          </button>
        ))}
      </div>
      <div className="tpl-abas-painel tpl-aba-conteudo" role="tabpanel" dangerouslySetInnerHTML={html(abas[indice].conteudo)} />
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
        if (resumo) return <div className="tpl-resumo" dangerouslySetInnerHTML={html(resumo)} />;
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
        estilo: {
          type: "select",
          label: "Estilo",
          options: [
            { label: "Abas", value: "abas" },
            { label: "Sanfona (abre e fecha)", value: "sanfona" },
            { label: "Lista (tudo aberto)", value: "lista" },
          ],
        },
        numerar: { ...simNao, label: "Numerar as abas" },
      },
      defaultProps: { sobretitulo: "CONHEÇA O PRODUTO", titulo: "Informações e detalhes", estilo: "abas", numerar: "sim" },
      render: ({ sobretitulo, titulo, estilo, numerar, puck }) => {
        const abas = produtoDe(puck.metadata).complemento.abas.filter((aba) => aba.titulo || aba.conteudo);
        return (
          <section className="tpl-detalhes">
            {sobretitulo && <span className="tpl-sobretitulo">{sobretitulo}</span>}
            {titulo && <h2>{titulo}</h2>}
            {abas.length > 0 ? (
              <Abas abas={abas} estilo={estilo ?? "abas"} numerar={numerar === "sim"} />
            ) : (
              puck.isEditing && <Vazio texto="Produto sem abas no complemento" />
            )}
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
