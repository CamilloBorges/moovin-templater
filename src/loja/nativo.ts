import type { EstadoCompra, LigacaoLoja } from "../templater/blocos";
import type { ProdutoTemplate } from "../templater/produto";

// Leitura da página de produto nativa da Moovin (Next.js) e ligação com os controles dela.
// Seletores herdados do Script_Produto V3 (loja/script-produto-v3.js), conferidos em 05/10/2026.
// Os elementos nativos nunca são movidos (o React da Moovin quebraria): ficam escondidos, e os
// botões do template acionam os originais.

const texto = (el: Element | null | undefined) => ((el as HTMLElement | null)?.innerText ?? el?.textContent ?? "").replace(/\s+/g, " ").trim();

export type Nativo = {
  linha: HTMLElement; // galeria + coluna de informações
  galeria: HTMLElement;
  info: HTMLElement;
  descricao: HTMLElement | null; // seção "Descrição:"
};

export function encontrar(): Nativo | null {
  const main = document.querySelector("main");
  if (!main) return null;
  const linha = Array.from(main.querySelectorAll<HTMLElement>("div")).find(
    (n) => n.classList.contains("flex") && n.classList.contains("flex-1") && n.classList.contains("gap-[30px]") && n.querySelector('img[alt="product image"]'),
  );
  const galeria = linha?.children[0] as HTMLElement | undefined;
  const info = linha?.children[1] as HTMLElement | undefined;
  if (!linha || !galeria || !info || !info.children[0] || !info.children[1]) return null;
  const titulo = Array.from(main.querySelectorAll("h1")).find((h) => texto(h).toUpperCase() === "DESCRIÇÃO:");
  return { linha, galeria, info, descricao: (titulo?.parentElement as HTMLElement | null) ?? null };
}

// Área de compra (quantidade + COMPRAR). No celular a Moovin usa outra, fixa no rodapé.
function areaCompra(): HTMLElement | null {
  const n = encontrar();
  const area = n?.info.children[2] as HTMLElement | undefined;
  return area && !area.className.includes("fixed bottom-0 left-0") ? area : null;
}

export function lerPreco(el: Element | null | undefined): number {
  const m = /([\d.]+,\d{2})/.exec(texto(el));
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : 0;
}

// Produto com variação a escolher (cor, tamanho…): o template ainda não monta o seletor,
// então a página fica no layout nativo. Sinal: botões na coluna de informações além de
// compartilhar, quantidade e comprar.
export function temEscolhaDeVariacao(n: Nativo): boolean {
  const preco = n.info.children[1];
  return preco.querySelectorAll("button, select, [role=radio]").length > 0;
}

// SKU que a página mostra ("Cod.: 13925"): é a chave do Complemento no nosso servidor.
export function lerCodigo(n: Nativo): string {
  return /Cod\.?\s*:\s*(\S+)/i.exec(texto(n.info.children[0]))?.[1] ?? "";
}

export function extrairProduto(n: Nativo, complemento: ProdutoTemplate["complemento"], badges: ProdutoTemplate["badges"]): ProdutoTemplate {
  const cabecalho = n.info.children[0];
  const vistos = new Set<string>();
  const imagens = Array.from(n.galeria.querySelectorAll("img"))
    .map((img) => img.currentSrc || img.src)
    .filter((src) => {
      const chave = src.split("?")[0];
      if (!src || vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
  const avaliacoes = /\((\d+)\)/.exec(texto(cabecalho));
  return {
    moovin: {
      nome: texto(cabecalho.querySelector("h1")),
      url: location.origin + location.pathname,
      codigo: lerCodigo(n),
      preco: lerPreco(n.info.children[1].querySelector("b") ?? n.info.children[1]),
      imagens,
      avaliacao: avaliacoes ? { nota: 0, total: Number(avaliacoes[1]) } : null,
    },
    complemento,
    badges,
  };
}

export function criarLigacao(): LigacaoLoja {
  let atual: EstadoCompra = { preco: 0, quantidade: "1", textoComprar: "COMPRAR" };
  const ler = (): EstadoCompra => {
    const n = encontrar();
    const area = areaCompra();
    const novo = {
      preco: lerPreco(n?.info.children[1].querySelector("b") ?? n?.info.children[1]),
      quantidade: area?.querySelector("input")?.value || "1",
      textoComprar: texto(area?.querySelector("button")) || "COMPRAR",
    };
    // Mesmo objeto enquanto nada muda (exigência do useSyncExternalStore).
    if (novo.preco !== atual.preco || novo.quantidade !== atual.quantidade || novo.textoComprar !== atual.textoComprar) atual = novo;
    return atual;
  };
  ler();
  return {
    estado: () => atual,
    assinar(aoMudar) {
      const relogio = setInterval(() => {
        const antes = atual;
        if (ler() !== antes) aoMudar();
      }, 250);
      return () => clearInterval(relogio);
    },
    alterarQuantidade(delta) {
      const caixa = areaCompra()?.querySelector(".flex.items-center.justify-between");
      (caixa?.querySelector(delta > 0 ? "span:last-child" : "span:first-child") as HTMLElement | null)?.click();
    },
    comprar() {
      areaCompra()?.querySelector("button")?.click();
    },
  };
}
