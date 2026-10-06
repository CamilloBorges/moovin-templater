// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { ligacaoSimulada } from "../componentes/PreviaPagina";
import { Pagina } from "../loja/Pagina";
import { estiloCartao } from "./blocos";
import { urlFontes, varsTexto } from "./estilo";
import type { TemplateData } from "./padrao";
import type { ProdutoTemplate } from "./produto";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} unobserve() {} takeRecords() { return []; } root = null; rootMargin = ""; thresholds = []; } as unknown as typeof IntersectionObserver;

describe("estiloCartao", () => {
  it("templates antigos: branco = cor branca com sombra; transparente = sem fundo e sem sombra", () => {
    expect(estiloCartao({ fundo: "branco" })).toEqual({ classe: "tpl-cartao tpl-cartao-cor tpl-cartao-sombra", style: { background: "#ffffff" } });
    expect(estiloCartao({ fundo: "transparente" })).toEqual({ classe: "tpl-cartao tpl-cartao-nenhum", style: {} });
  });
  it("cor escolhida, cantos retos e sem sombra", () => {
    const r = estiloCartao({ fundo: "cor", corFundo: "#f5efe4", cantos: "retos", sombra: "nao" });
    expect(r.classe).toBe("tpl-cartao tpl-cartao-cor tpl-cantos-retos");
    expect(r.style.background).toBe("#f5efe4");
  });
  it("cor inválida vira branco", () => {
    expect(estiloCartao({ fundo: "cor", corFundo: "red;x" }).style.background).toBe("#ffffff");
  });
  it("imagem de fundo cobrindo ou ajustada", () => {
    const r = estiloCartao({ fundo: "imagem", imagemFundo: "https://x/fundo.jpg", ajusteImagem: "ajustar" });
    expect(r.style.backgroundImage).toBe('url("https://x/fundo.jpg")');
    expect(r.style.backgroundSize).toBe("contain");
  });
});

describe("varsTexto e fontes", () => {
  it("só gera as variáveis definidas e válidas", () => {
    expect(varsTexto("tpl-preco", { fonte: "georgia", cor: "#123456", tamanho: 28 })).toEqual({
      "--tpl-preco-fonte": 'Georgia, "Times New Roman", serif', "--tpl-preco-cor": "#123456", "--tpl-preco-tamanho": "28px",
    });
    expect(varsTexto("tpl-preco", { fonte: "", cor: "azul", tamanho: 0 })).toEqual({});
    expect(varsTexto("tpl-preco", undefined)).toEqual({});
  });
  it("monta a URL do Google Fonts só com as fontes do Google, sem repetir", () => {
    expect(urlFontes(["arial", "montserrat", "montserrat", "lato"])).toBe(
      "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Lato:wght@400;700;900&display=swap",
    );
    expect(urlFontes(["arial", undefined])).toBeNull();
  });
});

describe("blocos de compra com estilo", () => {
  const produto: ProdutoTemplate = {
    moovin: { nome: "Cubos", url: "", codigo: "1", preco: 39.9, imagens: [], avaliacao: null },
    complemento: { resumo: "", descricao: "", conteudoComercial: { quantidade: 700, unidade: "g" }, abas: [], badges: [] },
    badges: [],
  };
  function render(content: unknown[]) {
    const c = document.createElement("div");
    document.body.appendChild(c);
    const raiz = createRoot(c);
    act(() => raiz.render(<Pagina template={{ root: { props: {} }, content } as unknown as TemplateData} produto={produto} loja={ligacaoSimulada(39.9)} />));
    return c;
  }

  it("Linha de compra aplica preço, quantidade e botão por variáveis e classes", () => {
    const c = render([{ type: "LinhaCompra", props: { id: "l", disposicao: "empilhado", preco: { cor: "#aa0000", tamanho: 32, fonte: "montserrat" }, botao: { estilo: "contorno", cantos: "pilula", cor: "#00aa00" } } }]);
    const linha = c.querySelector<HTMLElement>(".tpl-compra")!;
    expect(linha.className).toContain("tpl-disposicao-empilhado");
    expect(linha.className).toContain("tpl-botao-contorno");
    expect(linha.className).toContain("tpl-botao-cantos-pilula");
    expect(linha.style.getPropertyValue("--tpl-preco-cor")).toBe("#aa0000");
    expect(linha.style.getPropertyValue("--tpl-preco-tamanho")).toBe("32px");
    expect(linha.style.getPropertyValue("--tpl-botao-cor")).toBe("#00aa00");
    // fonte do Google carregada no documento da página
    expect(document.querySelector('link[data-tpl-fonte="montserrat"]')).not.toBeNull();
  });

  it("template antigo sem propriedades de estilo continua no padrão", () => {
    const linha = render([{ type: "LinhaCompra", props: { id: "l" } }]).querySelector<HTMLElement>(".tpl-compra")!;
    expect(linha.className).toContain("tpl-disposicao-auto");
    expect(linha.getAttribute("style") ?? "").toBe("");
  });

  it("Preço por kg com alinhamento e estilo próprios", () => {
    const el = render([{ type: "PrecoPorUnidade", props: { id: "p", alinhamento: "esquerda", unidade: { cor: "#111111" } } }]).querySelector<HTMLElement>(".tpl-preco-unidade")!;
    expect(el.style.getPropertyValue("--tpl-alinhar")).toBe("left");
    expect(el.style.getPropertyValue("--tpl-unidade-cor")).toBe("#111111");
    expect(el.textContent).toContain("Unidade de 0,700 kg");
  });
});
