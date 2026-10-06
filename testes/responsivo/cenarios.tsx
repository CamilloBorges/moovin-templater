import { createRoot } from "react-dom/client";
import "../../src/templater/pagina.css";
import { ligacaoSimulada } from "../../src/componentes/PreviaPagina";
import { Pagina } from "../../src/loja/Pagina";
import { templatePadrao, type TemplateData } from "../../src/templater/padrao";
import type { Badge, ProdutoTemplate } from "../../src/templater/produto";

// Cenários da página de produto para os testes de responsividade. Imagens são SVG embutidas
// (sem rede), e as fontes são do sistema, para o teste não depender da internet.

const imagem = (largura: number, altura: number, texto: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}"><rect width="100%" height="100%" fill="#d9d2c5"/><text x="50%" y="50%" font-size="48" text-anchor="middle" fill="#6b5b45">${texto}</text></svg>`)}`;

const icone = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>';
const badges = (n: number): Badge[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `b${i}`, nome: `Selo ${i + 1}`, tipo: i % 2 ? "icone" : "imagem", imagem: imagem(128, 128, `S${i + 1}`), icone,
    cor: "#173a4d", corFundo: "#f5efe4", tooltip: `Explicação do selo ${i + 1}, com um texto mais comprido para o balão`, link: i % 3 ? "" : "https://exemplo.com",
  }));

const produtoNormal: ProdutoTemplate = {
  moovin: { nome: "Cubos de Panela Bomgado 500 g", url: "https://loja/cubos/p", codigo: "13925", preco: 39.9, imagens: [imagem(800, 800, "Produto"), imagem(800, 800, "Foto 2")], avaliacao: { nota: 0, total: 12 } },
  complemento: {
    resumo: "<p>Cubos de acém selecionados, ideais para panela de pressão e cozidos.</p>",
    descricao: "<p>Carne de animais criados a pasto na Fazenda Bomgado.</p>",
    conteudoComercial: { quantidade: 500, unidade: "g" },
    abas: [
      { titulo: "Preparo", conteudo: "<p>Cozinhe por 40 minutos na pressão.</p>" },
      { titulo: "Origem", conteudo: "<p>Fazenda Bomgado, Eldorado do Sul.</p>" },
      { titulo: "Conservação", conteudo: "<p>Mantenha congelado a -18 °C.</p>" },
    ],
    badges: ["b0", "b1", "b2"],
  },
  badges: badges(3),
};

const textoLongo = "<p>Um texto comprido com uma palavra sem espaços: https://www.armazembomgado.com.br/produtos/carnes/bovinos/cubos-de-panela-bomgado-selecao-500g?utm_source=teste</p>"
  + "<table><tr><th>Nutriente</th><th>Por 100 g</th><th>% VD</th><th>Observação longa da coluna</th></tr><tr><td>Proteína</td><td>26 g</td><td>52%</td><td>valor de referência</td></tr></table>"
  + `<p><img src="${imagem(1600, 600, "Imagem larga")}" alt=""/></p>`;

const produtoExtremo: ProdutoTemplate = {
  moovin: {
    nome: "Picanha Maturatta Premium Angus Bomgado Seleção Especial Peça Inteira Resfriada Aproximadamente 1,3 kg",
    url: "https://loja/picanha/p", codigo: "9876543210", preco: 12345.67, imagens: [imagem(800, 1000, "Produto")], avaliacao: { nota: 0, total: 1234 },
  },
  complemento: {
    resumo: "<p>Picanha de novilho precoce, maturada por 21 dias, com capa de gordura uniforme.</p>",
    descricao: textoLongo,
    conteudoComercial: { quantidade: 1300, unidade: "g" },
    abas: Array.from({ length: 8 }, (_, i) => ({ titulo: `Informação número ${i + 1} com título longo`, conteudo: i === 7 ? textoLongo : `<p>Conteúdo da aba ${i + 1}.</p>` })),
    badges: Array.from({ length: 10 }, (_, i) => `b${i}`),
  },
  badges: badges(10),
};

function copia(t: TemplateData): TemplateData {
  return JSON.parse(JSON.stringify(t));
}

// Template com estilos grandes: preço e botão em fonte grande, botão pílula, abas primárias fixas.
function estilizado(variante: string, largura: string, estiloAbas = "abas"): TemplateData {
  const t = copia(templatePadrao);
  const direita = (t.content[0].props as Record<string, any>).direita;
  direita[0].props = { ...direita[0].props, fundo: "cor", corFundo: "#f5efe4", cantos: "retos" };
  const compra = direita[1].props.conteudo[0];
  compra.props = { ...compra.props, preco: { fonte: "georgia", tamanho: 40 }, quantidade: { tamanho: 20 }, botao: { estilo: "solido", fonte: "verdana", tamanho: 20, cantos: "pilula" } };
  const unidade = direita[1].props.conteudo[1];
  unidade.props = { ...unidade.props, unidade: { tamanho: 18 }, precoKg: { tamanho: 22 } };
  const badgesBloco = direita[0].props.conteudo.find((b: { type: string }) => b.type === "Badges");
  badgesBloco.props = { ...badgesBloco.props, tamanho: 80, porLinha: 6, maxLinhas: 2 };
  const abas = t.content.find((b) => b.type === "AbasDetalhes")!;
  abas.props = { ...abas.props, estilo: estiloAbas, variante, largura, rotulo: { tamanho: 18 }, conteudo: { tamanho: 18 }, tituloSecao: { tamanho: 40 } };
  return t;
}

const CENARIOS: Record<string, { template: TemplateData; produto: ProdutoTemplate }> = {
  padrao: { template: templatePadrao, produto: produtoNormal },
  extremo: { template: estilizado("primaria", "fixa"), produto: produtoExtremo },
  "pilula-centralizada": { template: estilizado("pilula", "centralizada"), produto: produtoExtremo },
  sanfona: { template: estilizado("secundaria", "rolavel", "sanfona"), produto: produtoExtremo },
};

const nome = new URLSearchParams(location.search).get("cenario") ?? "padrao";
const cenario = CENARIOS[nome] ?? CENARIOS.padrao;
document.title = `Responsividade — ${nome}`;
createRoot(document.getElementById("raiz")!).render(
  <Pagina template={cenario.template} produto={cenario.produto} loja={ligacaoSimulada(cenario.produto.moovin.preco)} />,
);
(window as { __cenarioPronto?: boolean }).__cenarioPronto = true;
