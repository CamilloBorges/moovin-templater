import { api } from "../api";
import type { MapaCortes } from "../templater/produto";
export { centroDaRegiao, pontosSvg } from "../templater/mapa";

// Cadastro de mapas de cortes (nosso servidor). A imagem do animal fica na Moovin, como as dos badges.

export type DadosMapa = Omit<MapaCortes, "id">;

export const listarMapas = () => api<MapaCortes[]>("mapas");
export const salvarMapa = (dados: DadosMapa, id?: string) =>
  id ? api<MapaCortes>(`mapas/${id}`, { metodo: "PUT", corpo: dados }) : api<MapaCortes>("mapas", { corpo: dados });
export const excluirMapa = (id: string) => api(`mapas/${id}`, { metodo: "DELETE" });

// Próximo número livre para um corte novo.
export const proximoNumero = (mapa: Pick<MapaCortes, "cortes">) => mapa.cortes.reduce((m, c) => Math.max(m, c.numero), 0) + 1;

// Largura e altura reais da imagem (a região é guardada em fração delas).
export const tamanhoDaImagem = (url: string) =>
  new Promise<{ largura: number; altura: number }>((ok, falha) => {
    const img = new Image();
    img.onload = () => ok({ largura: img.naturalWidth, altura: img.naturalHeight });
    img.onerror = () => falha(new Error("Não foi possível abrir a imagem."));
    img.src = url;
  });
