import { useEffect, useRef, type CSSProperties } from "react";

// Estilo de texto escolhido no editor (fonte, cor, tamanho). Valor vazio/0 = o padrão do
// template (o CSS de pagina.css). Os blocos aplicam o estilo por variáveis CSS, então o padrão
// continua no CSS e o template antigo, sem essas propriedades, fica como estava.

export type EstiloTexto = { fonte?: string; cor?: string; tamanho?: number };

export type Fonte = { id: string; nome: string; css: string; google?: string };

// Fontes do sistema (não carregam nada) e algumas do Google Fonts (carregadas só quando usadas).
export const FONTES: Fonte[] = [
  { id: "arial", nome: "Arial", css: "Arial, Helvetica, sans-serif" },
  { id: "verdana", nome: "Verdana", css: "Verdana, Geneva, sans-serif" },
  { id: "trebuchet", nome: "Trebuchet MS", css: '"Trebuchet MS", sans-serif' },
  { id: "georgia", nome: "Georgia", css: 'Georgia, "Times New Roman", serif' },
  { id: "montserrat", nome: "Montserrat", css: '"Montserrat", sans-serif', google: "Montserrat:wght@400;600;700;800" },
  { id: "poppins", nome: "Poppins", css: '"Poppins", sans-serif', google: "Poppins:wght@400;600;700" },
  { id: "lato", nome: "Lato", css: '"Lato", sans-serif', google: "Lato:wght@400;700;900" },
  { id: "roboto", nome: "Roboto", css: '"Roboto", sans-serif', google: "Roboto:wght@400;500;700" },
  { id: "oswald", nome: "Oswald", css: '"Oswald", sans-serif', google: "Oswald:wght@400;600;700" },
  { id: "playfair", nome: "Playfair Display", css: '"Playfair Display", serif', google: "Playfair+Display:wght@400;700" },
];

const porId = new Map(FONTES.map((f) => [f.id, f]));

// Variáveis CSS de um estilo de texto: --<prefixo>-fonte, -cor e -tamanho (só as definidas).
export function varsTexto(prefixo: string, e: EstiloTexto | undefined): Record<string, string> {
  const v: Record<string, string> = {};
  const fonte = e?.fonte ? porId.get(e.fonte) : undefined;
  if (fonte) v[`--${prefixo}-fonte`] = fonte.css;
  if (e?.cor && /^#[0-9a-f]{6}$/i.test(e.cor)) v[`--${prefixo}-cor`] = e.cor;
  if (e?.tamanho && e.tamanho > 0) v[`--${prefixo}-tamanho`] = `${e.tamanho}px`;
  return v;
}

export const estilo = (...grupos: Record<string, string>[]) => Object.assign({}, ...grupos) as CSSProperties;

// Endereço do Google Fonts para as fontes usadas (null se nenhuma é do Google).
export function urlFontes(ids: (string | undefined)[]) {
  const familias = [...new Set(ids.map((id) => (id ? porId.get(id)?.google : undefined)).filter(Boolean))];
  return familias.length ? `https://fonts.googleapis.com/css2?${familias.map((f) => `family=${f}`).join("&")}&display=swap` : null;
}

// Carrega as fontes do Google usadas por um bloco no documento onde ele está (a página da loja,
// a prévia ou o iframe do editor). Cada família entra uma vez só.
export function useFontes(...ids: (string | undefined)[]) {
  const ref = useRef<HTMLElement | null>(null);
  const chave = ids.join("|");
  useEffect(() => {
    const doc = ref.current?.ownerDocument;
    if (!doc) return;
    for (const id of ids) {
      const google = id ? porId.get(id)?.google : undefined;
      if (!google || doc.querySelector(`link[data-tpl-fonte="${id}"]`)) continue;
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = urlFontes([id])!;
      link.dataset.tplFonte = id;
      doc.head.appendChild(link);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return ref;
}
