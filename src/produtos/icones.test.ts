import { describe, expect, it } from "vitest";
import { nomeLegivel, svgDoIcone } from "./icones";

describe("svgDoIcone", () => {
  it("monta o SVG com traço em currentColor", () => {
    const svg = svgDoIcone([["path", { d: "M1 1" }], ["circle", { cx: 12, cy: 12, r: 3 }]]);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('<path d="M1 1"/><circle cx="12" cy="12" r="3"/>');
  });
  it("escapa aspas nos atributos", () => {
    expect(svgDoIcone([["path", { d: 'M1"onload="x' }]])).toContain("M1&quot;onload=&quot;x");
  });
});

describe("nomeLegivel", () => {
  it("separa as palavras para a busca", () => expect(nomeLegivel("WheatOff")).toBe("wheat off"));
});
