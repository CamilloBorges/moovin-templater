import { describe, expect, it } from "vitest";
import { mover } from "./BadgesDoProduto";

describe("mover (reordenar badges)", () => {
  const l = ["a", "b", "c", "d"];
  it("move para frente e para trás", () => {
    expect(mover(l, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(mover(l, 3, 0)).toEqual(["d", "a", "b", "c"]);
  });
  it("posição fora da lista vai para a ponta; origem inválida não muda nada", () => {
    expect(mover(l, 1, 99)).toEqual(["a", "c", "d", "b"]);
    expect(mover(l, 9, 0)).toBe(l);
    expect(mover(l, 2, 2)).toBe(l);
  });
});
