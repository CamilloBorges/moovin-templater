import { describe, expect, it } from "vitest";
import { resolverMapaCorte, type MapaCortes } from "../templater/produto";
import { centroDaRegiao, pontosSvg, proximoNumero } from "./mapas";

const quadrado: [number, number][] = [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]];
const mapa: MapaCortes = {
  id: "m", nome: "Bovino", imagem: "https://x/bovino.png", largura: 1000, altura: 500,
  cortes: [
    { id: "c1", numero: 29, nome: "Ossobuco", descricao: "Da perna.", detalhes: "", regiao: quadrado },
    { id: "c2", numero: 12, nome: "Acém", descricao: "Dianteiro.", detalhes: "", regiao: [] },
  ],
};

describe("mapas de cortes", () => {
  it("converte o contorno para o SVG nas coordenadas da imagem", () => {
    expect(pontosSvg(quadrado, 1000, 500)).toBe("200.0,100.0 400.0,100.0 400.0,200.0 200.0,200.0");
  });

  it("acha o centro do contorno (e a média quando a área é zero)", () => {
    const [x, y] = centroDaRegiao(quadrado)!;
    expect(x).toBeCloseTo(0.3);
    expect(y).toBeCloseTo(0.3);
    expect(centroDaRegiao([[0, 0], [1, 1], [0.5, 0.5]])).toEqual([0.5, 0.5]);
    expect(centroDaRegiao([])).toBeNull();
  });

  it("próximo número livre", () => {
    expect(proximoNumero(mapa)).toBe(30);
    expect(proximoNumero({ cortes: [] })).toBe(1);
  });

  it("resolve o Mapa de Corte do produto: descrição do produto ou do corte; sem contorno, sem imagem", () => {
    expect(resolverMapaCorte({ mapa: "m", corte: "c1", descricao: " " }, [mapa])).toMatchObject({ corte: "Ossobuco", numero: 29, descricao: "Da perna.", largura: 1000 });
    expect(resolverMapaCorte({ mapa: "m", corte: "c1", descricao: "Do Armazém." }, [mapa])?.descricao).toBe("Do Armazém.");
    expect(resolverMapaCorte({ mapa: "m", corte: "c2", descricao: "" }, [mapa])).toBeNull();
    expect(resolverMapaCorte({ mapa: "outro", corte: "c1", descricao: "" }, [mapa])).toBeNull();
    expect(resolverMapaCorte(null, [mapa])).toBeNull();
  });
});
