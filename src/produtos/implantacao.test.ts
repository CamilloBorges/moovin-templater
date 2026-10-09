import { describe, expect, it } from "vitest";
import { ajustesScriptGlobal, analisarScripts, maxAge, novoScript, novoScriptGlobal, restritoAUmaPagina, urlDoScript, urlDoScriptGlobal, type ScriptMoovin } from "./implantacao";

const URL = urlDoScript("https://templater.bomgado.net", "conta-1");
const script = (s: Partial<ScriptMoovin>): ScriptMoovin => ({
  id: "x", name: "x", loadPosition: "HEAD", page: "ALL", type: "CONTENT", loadMethod: null, url: null, content: null, active: true, ...s,
});

describe("analisarScripts", () => {
  it("acha o script do Templater pela URL (ignorando parâmetros) e o Script_Produto V3", () => {
    const lista = [
      script({ id: "t", type: "URL", url: `${URL}?v=2` }),
      script({ id: "v3", name: "Script_Produto", content: "<script>/* bomgado-product-share-v3 */</script>", page: "PRODUCT" }),
      script({ id: "zap", name: "WhatsApp", content: "<script>chat()</script>" }),
    ];
    const r = analisarScripts(lista, URL);
    expect(r.templater?.id).toBe("t");
    expect(r.antigos.map((s) => s.id)).toEqual(["v3"]);
  });

  it("script de URL de outra loja não conta", () => {
    expect(analisarScripts([script({ type: "URL", url: urlDoScript("https://templater.bomgado.net", "outra") })], URL).templater).toBeNull();
  });
});

describe("novoScript", () => {
  it("cadastra sempre em todas as páginas (a loja troca de página sem recarregar)", () => {
    expect(novoScript(URL)).toMatchObject({ type: "URL", url: URL, page: "ALL", loadPosition: "FOOTER", loadMethod: "DEFER", active: true });
  });
  it("aponta o script restrito a uma página", () => {
    expect(restritoAUmaPagina(script({ page: "PRODUCT" }))).toBe(true);
    expect(restritoAUmaPagina(script({ page: "ALL" }))).toBe(false);
  });
});

describe("maxAge", () => {
  it("lê o max-age do Cache-Control", () => {
    expect(maxAge("public, max-age=14400")).toBe(14400);
    expect(maxAge(null)).toBeNull();
  });
});

describe("script global", () => {
  const URL_GLOBAL = urlDoScriptGlobal("https://templater.bomgado.net", "conta-1");
  it("acha o script global pela URL, separado do script da página de produto", () => {
    const r = analisarScripts([script({ id: "t", type: "URL", url: URL }), script({ id: "g", type: "URL", url: `${URL_GLOBAL}?v=1` })], URL, URL_GLOBAL);
    expect(r.templater?.id).toBe("t");
    expect(r.global?.id).toBe("g");
    expect(analisarScripts([script({ id: "t", type: "URL", url: URL })], URL).global).toBeNull();
  });
  it("cadastra em todas as páginas, no cabeçalho e sem defer", () => {
    expect(novoScriptGlobal(URL_GLOBAL)).toMatchObject({ type: "URL", url: URL_GLOBAL, page: "ALL", loadPosition: "HEAD", loadMethod: "DEFAULT", active: true });
  });
  it("aponta cadastro fora do recomendado", () => {
    expect(ajustesScriptGlobal(script({ type: "URL", page: "ALL", loadPosition: "HEAD", loadMethod: "DEFAULT" }))).toEqual([]);
    expect(ajustesScriptGlobal(script({ type: "URL", page: "PRODUCT", loadPosition: "FOOTER", loadMethod: "DEFER" }))).toHaveLength(3);
  });
});
