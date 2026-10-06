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

// O que a Moovin não tem, por produto: a descrição da página e os dados adicionais (resumo,
// conteúdo comercial, abas e badges). Os campos padrão (preço, categoria, estoque…) ficam só na Moovin,
// e a descrição da Moovin guarda o texto para a IA de atendimento. A loja acha o produto pelo SKU.
export type DocComplemento = { _id: string; conta: string; produtoId: string; skus: string[]; dados: unknown; atualizadoEm: Date; atualizadoPor: string };

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
}

export const sessoes = (): Collection<Sessao> => db.collection<Sessao>("sessoes");
export const templates = (): Collection<DocTemplate> => db.collection<DocTemplate>("templates");
export const complementos = (): Collection<DocComplemento> => db.collection<DocComplemento>("complementos");
export const badges = (): Collection<DocBadge> => db.collection<DocBadge>("badges");
