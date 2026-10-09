import { describe, expect, it } from "vitest";
import { cssGlobal, PADRAO_LARGURA, scriptGlobal, validarLargura } from "./configLoja";

describe("cssGlobal", () => {
  it("só age acima da largura máxima e acompanha os blocos de largura total", () => {
    const css = cssGlobal({ ...PADRAO_LARGURA, ativo: true });
    expect(css).toContain("@media (min-width: 1281px)");
    expect(css).toContain("body { max-width: 1280px; margin: 0 auto !important;");
    expect(css).toContain("html { background: #f2f2f2; }");
    expect(css).toContain("box-shadow");
    expect(css).toContain("#fazenda-bomgado-mapa, #fazenda-bomgado-hectare, #barra-final { width: 100% !important;");
  });

  it("sem sombra e sem blocos, só o essencial; desligado, nada", () => {
    const css = cssGlobal({ ativo: true, maxima: 1440, corLaterais: "#000000", sombra: false, blocosLarguraTotal: [] });
    expect(css).toContain("@media (min-width: 1441px)");
    expect(css).not.toContain("box-shadow");
    expect(css).not.toContain("width: 100% !important");
    expect(cssGlobal(PADRAO_LARGURA)).toBe("");
  });
});

describe("validarLargura", () => {
  it("normaliza a cor e tira repetidos e vazios da lista", () => {
    expect(validarLargura({ ativo: true, maxima: "1280", corLaterais: " #ABCDEF ", blocosLarguraTotal: [".a", ".a", " ", "#b"] }))
      .toEqual({ ativo: true, maxima: 1280, corLaterais: "#abcdef", sombra: true, blocosLarguraTotal: [".a", "#b"] });
  });
  it("devolve a mensagem de erro em valores fora do esperado", () => {
    expect(typeof validarLargura({ maxima: 3000, corLaterais: "#ffffff" })).toBe("string");
    expect(typeof validarLargura({ maxima: 1280, corLaterais: "#fff" })).toBe("string");
    expect(typeof validarLargura({ maxima: 1280, corLaterais: "#ffffff", blocosLarguraTotal: ["body"] })).toBe("string");
  });
});

describe("scriptGlobal", () => {
  it("acrescenta o estilo uma vez só, mesmo se o script rodar duas vezes", () => {
    const elementos: Record<string, { id: string; textContent: string }> = {};
    const filhos: unknown[] = [];
    const documento = {
      getElementById: (id: string) => elementos[id] ?? null,
      createElement: () => ({ id: "", textContent: "" }),
      head: { appendChild: (el: { id: string; textContent: string }) => { elementos[el.id] = el; filhos.push(el); } },
    };
    const codigo = scriptGlobal(cssGlobal({ ...PADRAO_LARGURA, ativo: true }));
    new Function("document", codigo)(documento);
    new Function("document", codigo)(documento);
    expect(filhos).toHaveLength(1);
    expect(elementos["templater-bomgado-global"].textContent).toContain("max-width: 1280px");
  });
});
