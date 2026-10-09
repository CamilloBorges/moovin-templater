import type { FastifyInstance } from "fastify";
import { configLoja, type LarguraLoja } from "./banco";
import { exigirSessao } from "./sessao";

// Configurações globais da loja (tela "Configurações da loja" do painel) e o script global.js,
// que a Moovin carrega em todas as páginas do site. Por enquanto, a largura máxima no desktop:
// acima dela, o site fica centralizado, com as laterais na cor escolhida.

// Blocos de HTML próprios da home que usam a largura da tela (100vw) e precisam acompanhar o limite.
export const PADRAO_LARGURA: LarguraLoja = {
  ativo: false,
  maxima: 1280,
  corLaterais: "#f2f2f2",
  sombra: true,
  blocosLarguraTotal: ["#fazenda-bomgado-mapa", "#fazenda-bomgado-hectare", "#barra-final"],
};

const COR = /^#[0-9a-f]{6}$/i;
// Só seletores simples (#id ou .classe): o valor vai para dentro do CSS publicado na loja.
const SELETOR = /^[#.][A-Za-z_][\w-]{0,79}$/;

export function validarLargura(valor: unknown): LarguraLoja | string {
  const v = (valor ?? {}) as Partial<LarguraLoja>;
  const maxima = Number(v.maxima);
  if (!Number.isInteger(maxima) || maxima < 960 || maxima > 2560) return "Largura máxima: informe um número inteiro de 960 a 2560 px.";
  const corLaterais = typeof v.corLaterais === "string" ? v.corLaterais.trim() : "";
  if (!COR.test(corLaterais)) return "Cor das laterais: use o formato #rrggbb.";
  const blocos = Array.isArray(v.blocosLarguraTotal) ? v.blocosLarguraTotal : [];
  if (blocos.length > 50) return "Blocos de largura total: no máximo 50.";
  const blocosLarguraTotal: string[] = [];
  for (const b of blocos) {
    const seletor = typeof b === "string" ? b.trim() : "";
    if (!seletor) continue;
    if (!SELETOR.test(seletor)) return `Bloco "${String(b).slice(0, 40)}": use só #id ou .classe (letras, números, - e _).`;
    if (!blocosLarguraTotal.includes(seletor)) blocosLarguraTotal.push(seletor);
  }
  return { ativo: v.ativo === true, maxima, corLaterais: corLaterais.toLowerCase(), sombra: v.sombra !== false, blocosLarguraTotal };
}

// CSS publicado na loja. Só age em telas maiores que a largura máxima: notebooks e celulares não mudam.
export function cssGlobal(largura: LarguraLoja): string {
  if (!largura.ativo) return "";
  const { maxima, corLaterais, sombra, blocosLarguraTotal } = largura;
  const linhas = [
    `@media (min-width: ${maxima + 1}px) {`,
    `  html { background: ${corLaterais}; }`,
    `  body { max-width: ${maxima}px; margin: 0 auto !important; background: #fff; overflow-x: clip;${sombra ? " box-shadow: 0 0 24px rgba(0, 0, 0, .06);" : ""} }`,
  ];
  if (blocosLarguraTotal.length)
    linhas.push(
      `  ${blocosLarguraTotal.join(", ")} { width: 100% !important; max-width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; left: auto !important; right: auto !important; transform: none !important; }`,
    );
  linhas.push("}");
  return linhas.join("\n");
}

// O script só acrescenta o <style>; como a Moovin o carrega no cabeçalho, sem defer, o estilo
// entra antes de a página aparecer e o site não "pula" de largura.
export function scriptGlobal(css: string): string {
  if (!css) return "/* templater: nenhuma configuração global ativa */";
  return `(function(){var id="templater-bomgado-global";if(document.getElementById(id))return;var s=document.createElement("style");s.id=id;s.textContent=${JSON.stringify(css)};(document.head||document.documentElement).appendChild(s);})();`;
}

export async function larguraDaConta(conta: string): Promise<LarguraLoja> {
  const doc = await configLoja().findOne({ _id: conta });
  return { ...PADRAO_LARGURA, ...(doc?.largura ?? {}) };
}

export async function rotasConfigLoja(app: FastifyInstance) {
  app.get("/api/loja/configuracoes", { preHandler: exigirSessao }, async (pedido) => {
    const conta = pedido.sessao!.conta!.id;
    const doc = await configLoja().findOne({ _id: conta });
    return { largura: { ...PADRAO_LARGURA, ...(doc?.largura ?? {}) }, atualizadoEm: doc?.atualizadoEm ?? null, atualizadoPor: doc?.atualizadoPor ?? null };
  });

  app.put<{ Body: { largura?: unknown } }>("/api/loja/configuracoes", { preHandler: exigirSessao }, async (pedido, resposta) => {
    const largura = validarLargura(pedido.body?.largura);
    if (typeof largura === "string") return resposta.code(400).send({ erro: largura });
    const conta = pedido.sessao!.conta!.id;
    const atualizadoEm = new Date();
    await configLoja().updateOne(
      { _id: conta },
      { $set: { conta, largura, atualizadoEm, atualizadoPor: pedido.sessao!.usuario?.email ?? "" } },
      { upsert: true },
    );
    return { largura, atualizadoEm, css: cssGlobal(largura) };
  });

  // Script global, público: a Moovin o carrega em todas as páginas (tipo URL, cabeçalho).
  // Cache curto, como o produto.js: salvar no painel vale em cerca de 1 minuto.
  app.get<{ Params: { conta: string } }>("/loja/:conta/global.js", async (pedido, resposta) => {
    resposta
      .header("content-type", "application/javascript; charset=utf-8")
      .header("cache-control", "public, max-age=60")
      .header("access-control-allow-origin", "*");
    if (!/^[0-9a-f-]{36}$/i.test(pedido.params.conta)) return resposta.code(404).send("/* loja inválida */");
    return scriptGlobal(cssGlobal(await larguraDaConta(pedido.params.conta)));
  });
}
