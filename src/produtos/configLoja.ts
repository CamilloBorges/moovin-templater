import { api } from "../api";

// Configurações globais da loja (tela "Configurações da loja"): valem em todas as páginas do site,
// pelo script global.js. Por enquanto, a largura máxima do site no desktop.

export type LarguraLoja = { ativo: boolean; maxima: number; corLaterais: string; sombra: boolean; blocosLarguraTotal: string[] };
export type ConfigLoja = { largura: LarguraLoja; atualizadoEm: string | null; atualizadoPor: string | null };

export const carregarConfigLoja = () => api<ConfigLoja>("loja/configuracoes");
export const salvarConfigLoja = (largura: LarguraLoja) =>
  api<{ largura: LarguraLoja; atualizadoEm: string; css: string }>("loja/configuracoes", { metodo: "PUT", corpo: { largura } });

// Lista de blocos editada como texto, um seletor por linha.
export const blocosDoTexto = (texto: string) => texto.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
