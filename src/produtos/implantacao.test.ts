import { describe, expect, it } from "vitest";
import { analisarScripts, maxAge, novoScript, urlDoScript, type ScriptMoovin } from "./implantacao";

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
  it("usa a página do script antigo; sem ele, todas", () => {
    expect(novoScript(URL, [script({ page: "PRODUCT" })])).toMatchObject({ type: "URL", url: URL, page: "PRODUCT", loadPosition: "FOOTER", loadMethod: "DEFER", active: true });
    expect(novoScript(URL, []).page).toBe("ALL");
  });
});

describe("maxAge", () => {
  it("lê o max-age do Cache-Control", () => {
    expect(maxAge("public, max-age=14400")).toBe(14400);
    expect(maxAge(null)).toBeNull();
  });
});
