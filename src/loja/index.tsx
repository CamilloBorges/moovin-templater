import { createRoot, type Root } from "react-dom/client";
import css from "../templater/pagina.css?inline";
import type { TemplateData } from "../templater/padrao";
import type { ComplementoProduto } from "../templater/produto";
import { criarLigacao, encontrar, extrairProduto, lerCodigo, temEscolhaDeVariacao } from "./nativo";
import { Pagina } from "./Pagina";

// Script da página de produto, servido pelo nosso servidor (/loja/<conta>/produto.js) e
// carregado pela Moovin como script do tipo URL. O servidor coloca o template publicado em
// window.__TEMPLATER_BOMGADO__ antes deste código. O Complemento do produto (descrição, resumo,
// conteúdo e abas) vem do mesmo servidor, pelo SKU: /loja/<conta>/complemento/<sku>.
// Regra de segurança: na dúvida, não mexe. Sem template, sem Complemento, sem a estrutura
// esperada ou com variação a escolher, a página fica como a Moovin a monta.

declare global {
  interface Window {
    __TEMPLATER_BOMGADO__?: { template?: TemplateData };
    __templaterBomgadoAtivo?: boolean;
  }
}

const OCULTO = "data-templater-oculto";
// Endereço da loja no nosso servidor, tirado do próprio script (…/loja/<conta>/produto.js).
const BASE = ((document.currentScript as HTMLScriptElement | null)?.src ?? "").replace(/\/produto\.js(\?.*)?$/, "");

// Complemento do produto aberto: undefined = buscando; null = não tem (layout da Moovin).
let busca: { chave: string; complemento: ComplementoProduto | null | undefined } | null = null;
function complementoDe(sku: string, aoChegar: () => void): ComplementoProduto | null | undefined {
  const chave = `${location.pathname}|${sku}`;
  if (busca?.chave === chave) return busca.complemento;
  const atual: NonNullable<typeof busca> = { chave, complemento: undefined };
  busca = atual;
  fetch(`${BASE}/complemento/${encodeURIComponent(sku)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { complemento?: ComplementoProduto } | null) => { atual.complemento = d?.complemento ?? null; })
    .catch(() => { atual.complemento = null; })
    .finally(aoChegar);
  return undefined;
}
type Montagem = { caminho: string; raiz: Root; container: HTMLElement; ocultos: HTMLElement[] };
let montagem: Montagem | null = null;

function desmontar() {
  if (!montagem) return;
  montagem.raiz.unmount();
  montagem.container.remove();
  montagem.ocultos.forEach((el) => el.removeAttribute(OCULTO));
  montagem = null;
}

function sincronizar(template: TemplateData, agendar: () => void) {
  const naPaginaDeProduto = /\/p\/?$/.test(location.pathname);
  if (montagem && (!naPaginaDeProduto || montagem.caminho !== location.pathname || !document.contains(montagem.container))) desmontar();
  if (montagem || !naPaginaDeProduto) return;

  const nativo = encontrar();
  if (!nativo || temEscolhaDeVariacao(nativo)) return;
  const sku = lerCodigo(nativo);
  if (!sku || !BASE) return;
  const complemento = complementoDe(sku, agendar);
  if (!complemento) return;
  const produto = extrairProduto(nativo, complemento);
  if (!produto.moovin.nome) return;

  const container = document.createElement("div");
  container.id = "templater-bomgado";
  nativo.linha.parentElement!.insertBefore(container, nativo.linha);
  const ocultos = [nativo.linha, nativo.descricao].filter((el): el is HTMLElement => !!el);
  ocultos.forEach((el) => el.setAttribute(OCULTO, ""));
  const raiz = createRoot(container);
  raiz.render(<Pagina template={template} produto={produto} loja={criarLigacao()} />);
  montagem = { caminho: location.pathname, raiz, container, ocultos };
}

function iniciar() {
  const template = window.__TEMPLATER_BOMGADO__?.template;
  if (!template || !Array.isArray(template.content) || window.__templaterBomgadoAtivo) return;
  window.__templaterBomgadoAtivo = true;

  const estilo = document.createElement("style");
  estilo.id = "templater-bomgado-estilo";
  estilo.textContent = `${css}\n[${OCULTO}]{display:none!important}`;
  document.head.appendChild(estilo);

  // A Moovin é um app Next.js: a página muda sem recarregar. Reage a mudanças no DOM e no endereço.
  let agendado = false;
  const agendar = () => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => {
      agendado = false;
      try {
        sincronizar(template, agendar);
      } catch (erro) {
        console.error("[templater] erro ao montar a página; mantendo o layout da Moovin", erro);
        desmontar();
      }
    });
  };
  new MutationObserver(agendar).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", agendar);
  for (const metodo of ["pushState", "replaceState"] as const) {
    const original = history[metodo];
    history[metodo] = function (this: History, ...args: Parameters<History["pushState"]>) {
      original.apply(this, args);
      agendar();
    };
  }
  agendar();
}

// Espera o app da Moovin terminar de carregar, para não interferir na hidratação do Next.js.
if (document.readyState === "complete") iniciar();
else window.addEventListener("load", iniciar, { once: true });
