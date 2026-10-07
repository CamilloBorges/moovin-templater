import type { Config, Fields, Slot } from "@puckeditor/core";
import { campoCor, campoFonte, campoImagem, campoTamanho, campoTexto } from "./campos";
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
  Cartao: B.PropsCartao & { conteudo: Slot };
  Galeria: B.PropsGaleria & { mapa?: B.PropsMapaCorte };
  Titulo: { mostrarCodigo: SimNao; mostrarAvaliacao: SimNao; mostrarCompartilhar: SimNao };
  LinhaCompra: B.PropsCompra;
  BarraCompraFixa: B.PropsCompra & { corFundo?: string };
  Resumo: {};
  Descricao: { sobretitulo: string; titulo: string };
  Badges: { tamanho: number; porLinha: number; maxLinhas: number };
  PrecoPorUnidade: B.PropsPrecoUnidade;
  AbasDetalhes: B.PropsAbas;
  Texto: { texto: string };
};

// Preço, quantidade e botão: os mesmos campos na Linha de compra e na Barra fixa.
const camposCompra: Fields<B.PropsCompra> = {
  disposicao: {
    type: "select",
    label: "Disposição",
    options: [
      { label: "Automática (o botão desce quando falta espaço)", value: "auto" },
      { label: "Tudo numa linha", value: "linha" },
      { label: "Empilhado (botão embaixo)", value: "empilhado" },
    ],
  },
  preco: campoTexto("Preço"),
  quantidade: campoTexto("Quantidade"),
  botao: {
    type: "object",
    label: "Botão comprar",
    objectFields: {
      estilo: { type: "radio", label: "Estilo", options: [{ label: "Sólido", value: "solido" }, { label: "Contorno", value: "contorno" }] },
      cor: campoCor("Cor do botão"),
      corTexto: campoCor("Cor do texto"),
      fonte: campoFonte(),
      tamanho: campoTamanho("Tamanho do texto"),
      cantos: { type: "radio", label: "Cantos", options: [{ label: "Retos", value: "retos" }, { label: "Arredondados", value: "arredondados" }, { label: "Pílula", value: "pilula" }] },
    },
  },
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
    complemento: { title: "Complemento do cadastro", components: ["Resumo", "Descricao", "Badges", "PrecoPorUnidade", "AbasDetalhes"] },
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
        cantos: { type: "radio", label: "Cantos", options: [{ label: "Arredondados", value: "arredondados" }, { label: "Retos", value: "retos" }] },
        fundo: { type: "radio", label: "Fundo", options: [{ label: "Cor", value: "cor" }, { label: "Imagem", value: "imagem" }, { label: "Sem fundo", value: "nenhum" }] },
        corFundo: campoCor("Cor do fundo"),
        imagemFundo: campoImagem("Imagem do fundo"),
        ajusteImagem: { type: "radio", label: "Imagem", options: [{ label: "Cobrir o cartão", value: "cobrir" }, { label: "Ajustar inteira", value: "ajustar" }] },
        sombra: { ...simNao, label: "Borda e sombra" },
        conteudo: { type: "slot", label: "Conteúdo" },
      },
      defaultProps: { cantos: "arredondados", fundo: "cor", corFundo: "#ffffff", imagemFundo: "", ajusteImagem: "cobrir", sombra: "sim", conteudo: [] },
      // Só os campos do tipo de fundo escolhido (templates antigos: branco = cor; transparente = sem fundo).
      resolveFields: (data, { fields }) => {
        const fundo = data.props.fundo === "branco" ? "cor" : data.props.fundo === "transparente" ? "nenhum" : data.props.fundo;
        const { corFundo, imagemFundo, ajusteImagem, sombra, ...resto } = fields;
        return {
          ...resto,
          ...(fundo === "cor" ? { corFundo } : {}),
          ...(fundo === "imagem" ? { imagemFundo, ajusteImagem } : {}),
          ...(fundo !== "nenhum" ? { sombra } : {}),
        } as typeof fields;
      },
      render: ({ conteudo: Conteudo, ...props }) => <B.Cartao {...props} conteudo={(c, s) => <Conteudo className={c} style={s} />} />,
    },
    Galeria: {
      label: "Galeria de imagens",
      fields: {
        formato: {
          type: "select",
          label: "Formato das fotos",
          options: [
            { label: "Original de cada foto", value: "original" },
            { label: "Quadrado (1:1)", value: "1/1" },
            { label: "Retrato (4:5)", value: "4/5" },
            { label: "Retrato (3:4)", value: "3/4" },
            { label: "Paisagem (4:3)", value: "4/3" },
            { label: "Paisagem (3:2)", value: "3/2" },
            { label: "Panorâmico (16:9)", value: "16/9" },
          ],
        },
        encaixe: {
          type: "radio",
          label: "Encaixe da foto no formato",
          options: [{ label: "Preencher (recorta as bordas)", value: "preencher" }, { label: "Foto inteira (com fundo)", value: "inteira" }],
        },
        fundo: campoCor("Cor atrás da foto inteira"),
        largura: {
          type: "select",
          label: "Largura máxima",
          options: [{ label: "A coluna toda", value: 0 }, ...[320, 400, 480, 560, 640].map((px) => ({ label: `${px} px`, value: px }))],
        },
        cantos: {
          type: "select",
          label: "Cantos",
          options: [{ label: "Retos", value: 0 }, ...[8, 12, 18, 24, 32].map((px) => ({ label: `Arredondados ${px} px`, value: px }))],
        },
        miniaturas: {
          type: "select",
          label: "Miniaturas",
          options: [{ label: "Sem miniaturas", value: 0 }, ...[48, 64, 80, 96].map((px) => ({ label: `${px} px`, value: px }))],
        },
        sombra: { ...simNao, label: "Sombra na imagem" },
        mapa: {
          type: "object",
          label: "Mapa de Corte (último item, nos produtos com corte cadastrado)",
          objectFields: {
            mostrar: { ...simNao, label: "Mostrar o Mapa de Corte" },
            fundo: campoCor("Cor de fundo"),
            logo: campoImagem("Logotipo no topo"),
            titulo: { type: "object", label: "Nome do produto", objectFields: { fonte: campoFonte(), cor: campoCor("Cor") } },
            corRegiao: campoCor("Cor da região do corte"),
            texto: { type: "object", label: "Descrição do corte", objectFields: { fonte: campoFonte(), cor: campoCor("Cor") } },
          },
        },
      },
      defaultProps: {
        formato: "original", encaixe: "preencher", fundo: "", largura: 0, cantos: 18, miniaturas: 64, sombra: "sim",
        mapa: { mostrar: "sim", fundo: "#0b0b0d", logo: "", titulo: { fonte: "playfair", cor: "#c08a4e" }, corRegiao: "#c08a4e", texto: { fonte: "playfair", cor: "#ffffff" } },
      },
      // Encaixe e fundo só fazem sentido com um formato fixo; o fundo, só com a foto inteira.
      resolveFields: (data, { fields }) => {
        const { encaixe, fundo, ...resto } = fields;
        const fixo = (data.props.formato ?? "original") !== "original";
        return { ...resto, ...(fixo ? { encaixe } : {}), ...(fixo && data.props.encaixe === "inteira" ? { fundo } : {}) } as typeof fields;
      },
      render: (props) => <B.Galeria {...props} />,
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
      fields: camposCompra,
      defaultProps: { disposicao: "auto", preco: {}, quantidade: {}, botao: { estilo: "solido", cantos: "arredondados" } },
      render: (props) => <B.LinhaCompra {...props} />,
    },
    BarraCompraFixa: {
      label: "Barra de compra fixa",
      fields: { ...camposCompra, corFundo: campoCor("Cor do fundo da barra") },
      defaultProps: { disposicao: "auto", preco: {}, quantidade: {}, botao: { estilo: "solido", cantos: "arredondados" }, corFundo: "" },
      render: (props) => <B.BarraCompraFixa {...props} />,
    },
    Resumo: {
      label: "Resumo do produto",
      render: () => <B.Resumo />,
    },
    Descricao: {
      label: "Descrição do produto",
      fields: {
        sobretitulo: { type: "text", label: "Sobretítulo" },
        titulo: { type: "text", label: "Título" },
      },
      defaultProps: { sobretitulo: "", titulo: "Descrição" },
      render: ({ sobretitulo, titulo }) => <B.Descricao sobretitulo={sobretitulo} titulo={titulo} />,
    },
    Badges: {
      label: "Badges",
      fields: {
        tamanho: {
          type: "select",
          label: "Tamanho",
          options: [64, 80, 96, 128].map((px) => ({ label: `${px} px`, value: px })),
        },
        porLinha: {
          type: "select",
          label: "Badges por linha",
          options: [1, 2, 3, 4, 5, 6, 8].map((n) => ({ label: String(n), value: n })),
        },
        maxLinhas: {
          type: "select",
          label: "Máximo de linhas",
          options: [1, 2, 3, 4].map((n) => ({ label: String(n), value: n })),
        },
      },
      defaultProps: { tamanho: 64, porLinha: 4, maxLinhas: 2 },
      render: ({ tamanho, porLinha, maxLinhas }) => <B.Badges tamanho={tamanho} porLinha={porLinha} maxLinhas={maxLinhas} />,
    },
    PrecoPorUnidade: {
      label: "Quantidade e preço por kg / L / un",
      fields: {
        unidade: campoTexto("“Unidade de 0,700 kg”"),
        precoKg: campoTexto("Preço por kg / L / un"),
        alinhamento: { type: "radio", label: "Alinhamento", options: [{ label: "Esquerda", value: "esquerda" }, { label: "Centro", value: "centro" }, { label: "Direita", value: "direita" }] },
      },
      defaultProps: { unidade: {}, precoKg: {}, alinhamento: "direita" },
      render: (props) => <B.PrecoPorUnidade {...props} />,
    },
    AbasDetalhes: {
      label: "Abas de detalhes",
      fields: {
        sobretitulo: { type: "text", label: "Sobretítulo" },
        titulo: { type: "text", label: "Título" },
        tituloSecao: campoTexto("Estilo do título"),
        estilo: {
          type: "select",
          label: "Formato",
          options: [
            { label: "Abas", value: "abas" },
            { label: "Sanfona (abre e fecha)", value: "sanfona" },
            { label: "Lista (tudo aberto)", value: "lista" },
          ],
        },
        variante: {
          type: "select",
          label: "Variante das abas",
          options: [
            { label: "Clássica (padrão Bomgado)", value: "classica" },
            { label: "Primária (indicador sob o texto)", value: "primaria" },
            { label: "Secundária (linha sob a aba)", value: "secundaria" },
            { label: "Pílula (aba ativa preenchida)", value: "pilula" },
          ],
        },
        largura: {
          type: "radio",
          label: "Largura das abas",
          options: [{ label: "Rolável", value: "rolavel" }, { label: "Fixa", value: "fixa" }, { label: "Centralizada", value: "centralizada" }],
        },
        numerar: { ...simNao, label: "Numerar as abas" },
        maiusculas: { ...simNao, label: "Rótulo em MAIÚSCULAS" },
        rotulo: campoTexto("Rótulo das abas"),
        corAtiva: campoCor("Cor do texto ativo"),
        corInativa: campoCor("Cor do texto inativo"),
        corIndicador: campoCor("Cor do indicador"),
        fundoBarra: campoCor("Fundo da barra de abas"),
        divisor: { ...simNao, label: "Linha divisória sob as abas" },
        conteudo: campoTexto("Texto do conteúdo"),
        painelFundo: campoCor("Fundo do painel"),
        painelCantos: { type: "radio", label: "Cantos do painel", options: [{ label: "Arredondados", value: "arredondados" }, { label: "Retos", value: "retos" }] },
        painelSombra: { ...simNao, label: "Borda e sombra do painel" },
      },
      defaultProps: {
        sobretitulo: "CONHEÇA O PRODUTO", titulo: "Informações e detalhes", estilo: "abas", numerar: "sim",
        variante: "classica", largura: "rolavel", maiusculas: "nao", divisor: "sim", painelCantos: "arredondados", painelSombra: "sim",
        rotulo: {}, conteudo: {}, tituloSecao: {}, corAtiva: "", corInativa: "", corIndicador: "", fundoBarra: "", painelFundo: "",
      },
      // Campos só das abas ficam escondidos na sanfona e na lista.
      resolveFields: (data, { fields }) => {
        if ((data.props.estilo ?? "abas") === "abas") return fields;
        const { variante, largura, corIndicador, fundoBarra, divisor, ...resto } = fields;
        return resto as typeof fields;
      },
      render: (props) => <B.AbasDetalhes {...props} />,
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
