// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { extrairProduto, imagemOriginal, type Nativo } from "./nativo";

const BASE = "https://storage.moovin.store/main/loja";

describe("imagemOriginal", () => {
  it("tira o redimensionamento da miniatura e mantém a versão da foto", () => {
    expect(imagemOriginal(`${BASE}/foto-2.jpg?v=1790369291&ims=fit-in/80x80/filters:fill(FFF)`)).toBe(`${BASE}/foto-2.jpg?v=1790369291`);
  });
  it("não mexe em foto já original nem em endereço inválido", () => {
    expect(imagemOriginal(`${BASE}/foto-1.jpg?v=1`)).toBe(`${BASE}/foto-1.jpg?v=1`);
    expect(imagemOriginal("foto.jpg")).toBe("foto.jpg");
  });
});

describe("extrairProduto", () => {
  it("usa a foto original de cada imagem, mesmo quando a galeria nativa só tem a miniatura (ossobuco)", () => {
    const galeria = document.createElement("div");
    galeria.innerHTML = `
      <img alt="product image" src="${BASE}/foto-1.jpg?v=1">
      <img alt="product thumbnail 1" src="${BASE}/foto-1.jpg?v=1&amp;ims=fit-in/80x80/filters:fill(FFF)">
      <img alt="product thumbnail 2" src="${BASE}/foto-2.jpg?v=2&amp;ims=fit-in/80x80/filters:fill(FFF)">`;
    const info = document.createElement("div");
    info.innerHTML = "<div><h1>Ossobuco 500 g</h1><span>Cod.: 123</span></div><div><b>R$ 39,90</b></div>";
    const nativo = { linha: document.createElement("div"), galeria, info, descricao: null } as Nativo;
    const complemento = { conteudoComercial: null, resumo: "", descricao: "", abas: [], badges: [] };
    expect(extrairProduto(nativo, complemento, []).moovin.imagens).toEqual([`${BASE}/foto-1.jpg?v=1`, `${BASE}/foto-2.jpg?v=2`]);
  });
});
