import type { IconNode } from "lucide";

// Ícones dos badges: biblioteca Lucide (licença ISC), carregada só no painel e sob demanda.
// O badge guarda o SVG pronto, então a loja não precisa da biblioteca.

export type Icones = Record<string, IconNode>;

export const carregarIcones = async (): Promise<Icones> => (await import("lucide")).icons as Icones;

// Sugestões para a loja (carnes, fazenda, qualidade, conservação), mostradas antes da busca.
export const SUGERIDOS = [
  "Beef", "Drumstick", "Ham", "Fish", "Egg", "Milk", "WheatOff", "Wheat", "Leaf", "Sprout", "Trees", "Tractor",
  "Award", "Medal", "BadgeCheck", "ShieldCheck", "Star", "Heart", "ThumbsUp", "Gem", "Crown", "Sparkles",
  "Flame", "Snowflake", "Thermometer", "Clock", "Timer", "Scale", "Package", "Truck", "Recycle", "HandHeart",
];

const escapar = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Desenho do ícone → SVG com traço na cor do texto (currentColor), para a cor vir do badge.
export function svgDoIcone(no: IconNode): string {
  const filhos = no
    .map(([tag, atributos]) => `<${tag} ${Object.entries(atributos).map(([k, v]) => `${k}="${escapar(v as string | number)}"`).join(" ")}/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${filhos}</svg>`;
}

// "WheatOff" → "wheat off", para a busca casar com o que a pessoa digita.
export const nomeLegivel = (nome: string) => nome.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
