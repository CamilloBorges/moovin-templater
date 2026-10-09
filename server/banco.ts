import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { MongoClient, type Collection, type Db } from "mongodb";
import { config } from "./config";

// Coleções do MongoDB. Tudo que é da loja fica separado pelo id da conta Moovin.
export type Sessao = {
  _id: string; // id aleatório que vai no cookie
  etapa: "2fa" | "conta" | "ativa";
  tokenUsuario: string; // token do login (antes de escolher a loja)
  tokenConta?: string; // token da loja escolhida, usado nas chamadas à API
  usuario?: { id: string; nome: string; email: string };
  conta?: { id: string; nome: string };
  contas?: Array<{ id: string; nome: string }>;
  validadaEm?: Date;
  expiraEm: Date; // índice TTL: o MongoDB apaga a sessão vencida
};

export type DocTemplate = { _id: string; conta: string; tipo: "rascunho" | "publicado"; dados: unknown; atualizadoEm: Date; atualizadoPor: string };

// Badges (selos) da loja, associados aos produtos pelo Complemento (campo badges, com os ids).
// A imagem fica na Moovin (dam-storage); aqui só o endereço dela. Ou, no lugar da imagem, um ícone (SVG).
export type DocBadge = {
  _id: string;
  conta: string;
  nome: string;
  tipo?: "imagem" | "icone"; // badges antigos não têm: são imagem
  imagem: string;
  icone?: string; // SVG do ícone (tipo ícone)
  cor?: string;
  corFundo?: string;
  tooltip: string;
  link: string;
  atualizadoEm: Date;
  atualizadoPor: string;
};

// Abas do cadastro (título, conteúdo modelo, obrigatória e instrução). As abas do produto apontam
// para cá pelo campo tipo; a loja recebe o título daqui, então renomear vale para todos os produtos.
export type DocTipoAba = {
  _id: string;
  conta: string;
  titulo: string;
  conteudoModelo: string;
  obrigatoria: boolean;
  instrucao: string;
  atualizadoEm: Date;
  atualizadoPor: string;
};

// Modelos de cadastro: a sequência de abas (ids de DocTipoAba) de um tipo de produto.
// categorias: ids das categorias da Moovin de que o modelo é o padrão (cada categoria em um só modelo).
// padrao: padrão geral, para as categorias sem modelo (no máximo um). Documentos antigos não têm categorias.
export type DocModelo = { _id: string; conta: string; nome: string; padrao: boolean; categorias?: string[]; abas: string[]; criadoEm: Date; atualizadoEm: Date; atualizadoPor: string };

// Mapas de cortes: a imagem de um animal (na Moovin) e os cortes marcados nela (número, nome,
// descrição, detalhes e o contorno da região em fração da imagem). O produto aponta para um corte.
// Modelo de linhas (editor do mapa): o contorno do animal e as linhas de corte; cada corte guarda os
// pontos-âncora das regiões que o formam e se o contorno foi ajustado à mão (manual). Tudo opcional.
export type DocCorte = {
  id: string; numero: number; nome: string; descricao: string; detalhes: string; regiao: [number, number][];
  sementes?: [number, number][]; manual?: boolean;
};
export type DocLinha = { id: string; pontos: [number, number][] };
export type DocMapa = {
  _id: string; conta: string; nome: string; imagem: string; largura: number; altura: number; cortes: DocCorte[];
  contorno?: [number, number][]; linhas?: DocLinha[]; atualizadoEm: Date; atualizadoPor: string;
};

// O que a Moovin não tem, por produto: a descrição da página e os dados adicionais (resumo,
// conteúdo comercial, abas e badges). Os campos padrão (preço, categoria, estoque…) ficam só na Moovin,
// e a descrição da Moovin guarda o texto para a IA de atendimento. A loja acha o produto pelo SKU.
export type DocComplemento = { _id: string; conta: string; produtoId: string; skus: string[]; dados: unknown; atualizadoEm: Date; atualizadoPor: string };

// Configurações globais da loja (valem em todas as páginas do site, pelo script global.js).
// largura: limita o site a uma largura máxima no desktop, centralizado.
export type LarguraLoja = { ativo: boolean; maxima: number; corLaterais: string; sombra: boolean; blocosLarguraTotal: string[] };
export type DocConfigLoja = { _id: string; conta: string; largura: LarguraLoja; atualizadoEm: Date; atualizadoPor: string };

let db: Db;

export async function conectar() {
  let url = config.mongoUrl;
  if (!url) {
    // Desenvolvimento: MongoDB local. Os dados ficam fora da pasta do projeto, que está no
    // OneDrive (sincronizar arquivos de um banco em uso trava e corrompe).
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const pasta = resolve(process.env.LOCALAPPDATA ?? homedir(), "moovin-templater", "mongo");
    mkdirSync(pasta, { recursive: true });
    const servidor = await MongoMemoryServer.create({ instance: { dbPath: pasta, storageEngine: "wiredTiger" } });
    url = servidor.getUri();
    console.log(`MongoDB de desenvolvimento em ${pasta}`);
  }
  const cliente = await new MongoClient(url).connect();
  db = cliente.db(config.mongoBanco);
  await sessoes().createIndex({ expiraEm: 1 }, { expireAfterSeconds: 0 });
  await templates().createIndex({ conta: 1, tipo: 1 }, { unique: true });
  await complementos().createIndex({ conta: 1, skus: 1 });
  await badges().createIndex({ conta: 1 });
  await tiposAba().createIndex({ conta: 1 });
  await modelos().createIndex({ conta: 1 });
  await mapas().createIndex({ conta: 1 });
}

export const sessoes = (): Collection<Sessao> => db.collection<Sessao>("sessoes");
export const templates = (): Collection<DocTemplate> => db.collection<DocTemplate>("templates");
export const complementos = (): Collection<DocComplemento> => db.collection<DocComplemento>("complementos");
export const badges = (): Collection<DocBadge> => db.collection<DocBadge>("badges");
export const tiposAba = (): Collection<DocTipoAba> => db.collection<DocTipoAba>("tiposAba");
export const modelos = (): Collection<DocModelo> => db.collection<DocModelo>("modelos");
export const mapas = (): Collection<DocMapa> => db.collection<DocMapa>("mapas");
export const configLoja = (): Collection<DocConfigLoja> => db.collection<DocConfigLoja>("configLoja");
