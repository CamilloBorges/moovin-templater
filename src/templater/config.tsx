import type { Config, Slot } from "@puckeditor/core";
import * as B from "./blocos";
import type { ProdutoTemplate } from "./produto";

// Configuração do editor (Puck): campos e rótulos de cada bloco. O desenho dos blocos está em
// ./blocos.tsx, compartilhado com o script da loja. Os blocos de "Produto (Moovin)" representam
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

export const config: Config<ComNome<Blocos>, RaizTemplate> = {
  root: {
    fields: {
      title: { type: "text", label: "Nome do template" },
      corPrincipal: { type: "text", label: "Cor principal" },
      corDestaque: { type: "text", label: "Cor de destaque" },
    },
    render: ({ children, corPrincipal, corDestaque, puck }) => (
      <B.AmbienteProvider value={{ produto: puck.metadata.produto as ProdutoTemplate, editando: puck.isEditing }}>
        <B.Raiz corPrincipal={corPrincipal} corDestaque={corDestaque}>{children}</B.Raiz>
      </B.AmbienteProvider>
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
      render: ({ proporcao, esquerda: Esquerda, direita: Direita }) => (
        <B.Colunas proporcao={proporcao} esquerda={(c) => <Esquerda className={c} />} direita={(c) => <Direita className={c} />} />
      ),
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
      render: ({ fundo, conteudo: Conteudo }) => <B.Cartao fundo={fundo} conteudo={(c) => <Conteudo className={c} />} />,
    },
    Galeria: {
      label: "Galeria de imagens",
      fields: { sombra: { ...simNao, label: "Sombra na imagem" } },
      defaultProps: { sombra: "sim" },
      render: ({ sombra }) => <B.Galeria sombra={sombra} />,
    },
    Titulo: {
      label: "Nome do produto",
      fields: {
        mostrarCodigo: { ...simNao, label: "Mostrar código" },
        mostrarAvaliacao: { ...simNao, label: "Mostrar avaliação" },
        mostrarCompartilhar: { ...simNao, label: "Botão compartilhar" },
      },
      defaultProps: { mostrarCodigo: "sim", mostrarAvaliacao: "sim", mostrarCompartilhar: "sim" },
      render: ({ mostrarCodigo, mostrarAvaliacao, mostrarCompartilhar }) => (
        <B.Titulo mostrarCodigo={mostrarCodigo} mostrarAvaliacao={mostrarAvaliacao} mostrarCompartilhar={mostrarCompartilhar} />
      ),
    },
    LinhaCompra: {
      label: "Preço, quantidade e comprar",
      render: () => <B.LinhaCompra />,
    },
    BarraCompraFixa: {
      label: "Barra de compra fixa",
      render: () => <B.BarraCompraFixa />,
    },
    Resumo: {
      label: "Resumo do produto",
      render: () => <B.Resumo />,
    },
    PrecoPorUnidade: {
      label: "Preço por kg / L / un",
      render: () => <B.PrecoPorUnidade />,
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
      render: ({ sobretitulo, titulo, estilo, numerar }) => <B.AbasDetalhes sobretitulo={sobretitulo} titulo={titulo} estilo={estilo} numerar={numerar} />,
    },
    Texto: {
      label: "Texto livre",
      fields: { texto: { type: "textarea", label: "Texto" } },
      defaultProps: { texto: "Escreva aqui" },
      render: ({ texto }) => <B.Texto texto={texto} />,
    },
  },
};

for (const bloco of Object.values(config.components)) {
  bloco.fields = { nome: { type: "text", label: "Nome do bloco" }, ...bloco.fields };
}

export function nomeDoBloco(tipo: string, nome?: string) {
  return nome?.trim() || config.components[tipo as keyof Blocos]?.label || tipo;
}
