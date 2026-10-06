import { api } from "../api";
import type { Badge } from "../templater/produto";

// Cadastro de badges (nosso servidor) e envio da imagem para a Moovin (dam-storage, pasta pública).

export type DadosBadge = Omit<Badge, "id">;

export const listarBadges = () => api<Badge[]>("badges");

export function salvarBadge(dados: DadosBadge, id?: string) {
  return id ? api<Badge>(`badges/${id}`, { metodo: "PUT", corpo: dados }) : api<Badge>("badges", { corpo: dados });
}

export const excluirBadge = (id: string) => api(`badges/${id}`, { metodo: "DELETE" });

const lerComoDataUrl = (arquivo: File) =>
  new Promise<string>((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => falha(leitor.error);
    leitor.readAsDataURL(arquivo);
  });

// Nome de arquivo seguro: só letras, números e hífen, mais um carimbo para não sobrescrever outro.
export function caminhoDaImagem(nome: string, arquivo: string, agora = Date.now(), pasta = "templater/badges") {
  const extensao = /\.(png|jpe?g|webp|gif|svg)$/i.exec(arquivo)?.[1].toLowerCase() ?? "png";
  const base = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "badge";
  return `${pasta}/${base}-${agora}.${extensao}`;
}

// Envia a imagem para a Moovin e devolve o endereço público dela.
export async function enviarImagem(nome: string, arquivo: File, pasta = "templater/badges") {
  if (!arquivo.type.startsWith("image/")) throw new Error("O arquivo precisa ser uma imagem.");
  if (arquivo.size > 5 * 1024 * 1024) throw new Error("A imagem pode ter até 5 MB.");
  const r = await api<{ url: string }>(`moovin/dam-storage/file/public/${caminhoDaImagem(nome, arquivo.name, Date.now(), pasta)}`, {
    metodo: "PUT",
    corpo: { content: await lerComoDataUrl(arquivo) },
  });
  return r.url;
}
