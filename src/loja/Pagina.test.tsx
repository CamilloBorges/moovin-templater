// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ligacaoSimulada } from "../componentes/PreviaPagina";
import { config } from "../templater/config";
import { templatePadrao, type TemplateData } from "../templater/padrao";
import type { ProdutoTemplate } from "../templater/produto";
import { Pagina } from "./Pagina";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} unobserve() {} takeRecords() { return []; } root = null; rootMargin = ""; thresholds = []; } as unknown as typeof IntersectionObserver;

const badgeBase = { tipo: "imagem" as const, imagem: "", icone: "", cor: "#173a4d", corFundo: "transparent", tooltip: "", link: "" };

const produto: ProdutoTemplate = {
  moovin: { nome: "Cubos de Panela", url: "https://loja.exemplo/cubos/p", codigo: "13925", preco: 39.9, imagens: ["https://exemplo/1.jpg"], avaliacao: null },
  complemento: {
    resumo: "<p>Resumo dos cubos.</p>",
    descricao: "<p>Descrição longa dos cubos.</p>",
    conteudoComercial: { quantidade: 500, unidade: "g" },
    abas: [{ titulo: "Preparo", conteudo: "<p>Panela de pressão.</p>" }],
    badges: ["b1", "b2"],
  },
  badges: [
    { ...badgeBase, id: "b1", nome: "Sem glúten", imagem: "https://exemplo/sg.png", tooltip: "Produto sem glúten", link: "https://loja.exemplo/sem-gluten" },
    { ...badgeBase, id: "b2", nome: "Grass fed", imagem: "https://exemplo/gf.png" },
  ],
};

let raiz: ReturnType<typeof createRoot> | null = null;
function renderizar(template: TemplateData) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  raiz = createRoot(container);
  act(() => raiz!.render(<Pagina template={template} produto={produto} loja={ligacaoSimulada(produto.moovin.preco)} />));
  return container;
}
afterEach(() => {
  act(() => raiz?.unmount());
  document.body.innerHTML = "";
});

describe("Pagina (renderizador do script da loja)", () => {
  it("monta o layout padrão com os dados do Moovin e do Complemento", () => {
    const html = renderizar(templatePadrao).textContent ?? "";
    for (const texto of ["Cubos de Panela", "Unidade de 0,500 kg", "Resumo dos cubos.", "Descrição longa dos cubos.", "Preparo", "Panela de pressão."]) {
      expect(html).toContain(texto);
    }
  });

  // Todo bloco do editor precisa existir na loja; senão o bloco some da página publicada.
  it.each(Object.keys(config.components))("conhece o bloco %s do editor", (tipo) => {
    const padrao = (config.components as Record<string, { defaultProps?: Record<string, unknown> }>)[tipo].defaultProps ?? {};
    const template = { root: { props: {} }, content: [{ type: tipo, props: { ...padrao, id: "b1" } }] } as unknown as TemplateData;
    expect(renderizar(template).querySelector(".tpl")!.childElementCount).toBeGreaterThan(0);
  });
});

describe("ligacaoSimulada (quantidade e COMPRAR da prévia)", () => {
  it("altera a quantidade sem passar de 1 para baixo e avisa quem assina", () => {
    const loja = ligacaoSimulada(10);
    let avisos = 0;
    loja.assinar(() => avisos++);
    loja.alterarQuantidade(-1);
    expect(loja.estado().quantidade).toBe("1");
    loja.alterarQuantidade(1);
    loja.alterarQuantidade(1);
    expect(loja.estado().quantidade).toBe("3");
    expect(avisos).toBe(3);
  });
});

describe("botão compartilhar", () => {
  it("no computador copia o link do produto e avisa", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const container = renderizar(templatePadrao);
    const botao = container.querySelector<HTMLButtonElement>(".tpl-compartilhar")!;
    expect(botao.querySelector("svg")).not.toBeNull(); // ícone padrão, não uma seta de texto
    await act(async () => botao.click());
    expect(writeText).toHaveBeenCalledWith("https://loja.exemplo/cubos/p");
    expect(container.textContent).toContain("Link copiado!");
  });
});

describe("bloco Badges", () => {
  const comLimites = (porLinha: number, maxLinhas: number) =>
    ({ root: { props: {} }, content: [{ type: "Badges", props: { id: "b", tamanho: 64, porLinha, maxLinhas } }] }) as unknown as TemplateData;
  const template = comLimites(4, 2);

  it("badge com link abre em outra aba, com o balão do tooltip", () => {
    const link = renderizar(template).querySelector<HTMLAnchorElement>("a.tpl-badge")!;
    expect(link.href).toBe("https://loja.exemplo/sem-gluten");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(link.querySelector("[role=tooltip]")!.textContent).toBe("Produto sem glúten");
    expect(link.getAttribute("aria-label")).toContain("Sem glúten");
  });

  it("badge sem link não gera link nem balão vazio", () => {
    const container = renderizar(template);
    const badges = container.querySelectorAll(".tpl-badge");
    expect(badges).toHaveLength(2);
    expect(badges[1].tagName).toBe("SPAN");
    expect(badges[1].querySelector("[role=tooltip]")).toBeNull();
  });
});

describe("bloco Badges: limites e ícones", () => {
  const varios = (n: number) => Array.from({ length: n }, (_, i) => ({ ...badgeBase, id: `x${i}`, nome: `B${i}`, imagem: `https://exemplo/${i}.png` }));
  function montar(badges: ProdutoTemplate["badges"], porLinha: number, maxLinhas: number) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    raiz = createRoot(container);
    const template = { root: { props: {} }, content: [{ type: "Badges", props: { id: "b", tamanho: 64, porLinha, maxLinhas } }] } as unknown as TemplateData;
    act(() => raiz!.render(<Pagina template={template} produto={{ ...produto, badges }} loja={ligacaoSimulada(1)} />));
    return container;
  }

  it("mostra no máximo badges por linha × linhas", () => {
    const c = montar(varios(10), 3, 2);
    expect(c.querySelectorAll(".tpl-badge")).toHaveLength(6);
    expect(c.querySelector<HTMLElement>(".tpl-badges")!.style.gridTemplateColumns).toBe("repeat(3, 64px)");
  });

  it("tamanho menor que 64 px em template antigo sobe para 64", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    raiz = createRoot(container);
    const antigo = { root: { props: {} }, content: [{ type: "Badges", props: { id: "b", tamanho: 48 } }] } as unknown as TemplateData;
    act(() => raiz!.render(<Pagina template={antigo} produto={produto} loja={ligacaoSimulada(1)} />));
    expect(container.querySelector("img")!.getAttribute("width")).toBe("64");
  });

  it("ícone: SVG com a cor e o fundo do cadastro, sem código malicioso", () => {
    const icone = '<svg viewBox="0 0 24 24" onload="alert(1)"><path d="M1 1"/><script>alert(2)</script></svg>';
    const c = montar([{ ...badgeBase, id: "i", nome: "Ícone", tipo: "icone", icone, cor: "#ff0000", corFundo: "#eeeeee" }], 4, 1);
    const el = c.querySelector<HTMLElement>(".tpl-badge-icone")!;
    expect(el.style.color).toBe("rgb(255, 0, 0)");
    expect(el.style.padding).toBe("12px"); // 18% de 64 px, em px (padding em % esmagava o ícone fora da loja)
    expect(el.querySelector("svg path")).not.toBeNull();
    expect(el.innerHTML).not.toContain("script");
    expect(el.innerHTML).not.toContain("onload");
  });
});
