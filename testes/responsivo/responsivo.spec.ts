import { expect, test, type Page } from "@playwright/test";

// Responsividade da página de produto em cada aparelho do playwright.config.ts.
// Para cada cenário: nada rola na horizontal, nada sai do cartão, textos não são cortados,
// botões com área de toque mínima no celular e as abas funcionam. Um print de cada aparelho
// vai para o relatório (testes/relatorio).

const CENARIOS = ["padrao", "extremo", "pilula-centralizada", "sanfona"];
const TOQUE_MINIMO = 40; // px; Apple pede 44 pt e o Material 48 dp; 40 é o mínimo aceitável aqui

async function abrir(page: Page, cenario: string) {
  await page.goto(`/testes/responsivo/index.html?cenario=${cenario}`);
  await page.waitForFunction(() => (window as { __cenarioPronto?: boolean }).__cenarioPronto && document.querySelector(".tpl"));
  await page.evaluate(() => document.fonts.ready);
}

// Problemas de layout encontrados na página (lista vazia = tudo certo).
async function problemasDeLayout(page: Page, celular: boolean) {
  // Largura da tela do aparelho: no celular, conteúdo largo faz o navegador ampliar a área da
  // página (innerWidth cresce junto), então a comparação é com a tela, não com innerWidth.
  const tela = page.viewportSize()!.width;
  return page.evaluate(({ celular, toque, tela }) => {
    const problemas: string[] = [];
    const descrever = (el: Element) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`;
    // Dentro de uma área com rolagem própria (barra de abas, tabela larga): pode passar da largura.
    const emRolagem = (el: Element, limite: Element) => {
      for (let p = el.parentElement; p && p !== limite; p = p.parentElement) {
        if (["auto", "scroll"].includes(getComputedStyle(p).overflowX)) return true;
      }
      return false;
    };
    const visivel = (el: Element) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.visibility !== "hidden" && s.display !== "none" && r.width > 0 && r.height > 0;
    };

    // 1. A página não rola na horizontal.
    const largura = Math.max(document.documentElement.scrollWidth, window.innerWidth);
    if (largura > tela + 1) problemas.push(`a página fica mais larga que a tela (${largura}px > ${tela}px)`);

    // 2. Nada sai do cartão onde está (balões de tooltip ficam fora: são escondidos).
    for (const cartao of document.querySelectorAll(".tpl-cartao")) {
      const c = cartao.getBoundingClientRect();
      for (const el of cartao.querySelectorAll("*")) {
        if (!visivel(el) || el.closest(".tpl-badge-balao, .tpl-compartilhar-aviso")) continue;
        const r = el.getBoundingClientRect();
        if (r.left < c.left - 1 || r.right > c.right + 1) problemas.push(`${descrever(el)} sai do cartão (${Math.round(r.left)}..${Math.round(r.right)} fora de ${Math.round(c.left)}..${Math.round(c.right)})`);
      }
    }

    // 3. Textos importantes não são cortados.
    for (const el of document.querySelectorAll(".tpl-titulo h1, .tpl-preco, .tpl-comprar, .tpl-unidade, .tpl-precokg")) {
      if (visivel(el) && el.scrollWidth > el.clientWidth + 1) problemas.push(`${descrever(el)} cortado (${el.scrollWidth}px de conteúdo em ${el.clientWidth}px)`);
    }

    // 4. O conteúdo das abas não estica a seção (só a barra de abas pode rolar).
    for (const sec of document.querySelectorAll(".tpl-detalhes")) {
      const s = sec.getBoundingClientRect();
      for (const el of sec.querySelectorAll(".tpl-aba-conteudo *, .tpl-abas, .tpl-abas-nav")) {
        if (!visivel(el)) continue;
        const r = el.getBoundingClientRect();
        if (emRolagem(el, sec)) continue; // abas dentro da barra rolável, linhas de tabela larga
        if (r.right > s.right + 1 || r.left < s.left - 1) problemas.push(`${descrever(el)} sai da seção de abas`);
      }
    }

    // 5. Área de toque no celular: comprar, + e −, abas e compartilhar.
    if (celular) {
      for (const el of document.querySelectorAll(".tpl-compra .tpl-comprar, .tpl-compra .tpl-quantidade button, .tpl-abas-nav button, .tpl-compartilhar")) {
        if (!visivel(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.height < toque || r.width < toque) problemas.push(`${descrever(el)} pequeno para o toque (${Math.round(r.width)}×${Math.round(r.height)}px)`);
      }
    }
    return [...new Set(problemas)];
  }, { celular, toque: TOQUE_MINIMO, tela });
}

for (const cenario of CENARIOS) {
  test(`página de produto: ${cenario}`, async ({ page, isMobile }, info) => {
    await abrir(page, cenario);
    await info.attach(`${cenario}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    expect(await problemasDeLayout(page, isMobile)).toEqual([]);
  });
}

test("abas: a última aba abre e fica visível na barra", async ({ page }) => {
  await abrir(page, "extremo");
  const abas = page.getByRole("tab");
  const ultima = abas.last();
  // No celular a barra de compra fixa cobre o rodapé da tela: centraliza a aba antes de tocar,
  // como uma pessoa rolaria a página.
  await ultima.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
  await ultima.click();
  await expect(ultima).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("Nutriente");
  // A aba selecionada está dentro da área visível da barra (a barra rola até ela no celular).
  const dentro = await page.evaluate(() => {
    const nav = document.querySelector(".tpl-abas-nav")!.getBoundingClientRect();
    const aba = document.querySelector('.tpl-abas-nav [aria-selected="true"]')!.getBoundingClientRect();
    return aba.left >= nav.left - 1 && aba.right <= nav.right + 1;
  });
  expect(dentro).toBe(true);
});

test("abas: teclado (setas, Home e End)", async ({ page, isMobile }) => {
  test.skip(isMobile, "teclado é para computador");
  await abrir(page, "padrao");
  await page.getByRole("tab").first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(page.getByRole("tab").last()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
});

test("comprar e quantidade respondem ao toque/clique", async ({ page }) => {
  await abrir(page, "padrao");
  const linha = page.locator(".tpl-compra");
  await linha.getByRole("button", { name: "Aumentar" }).click();
  await expect(linha.locator(".tpl-quantidade b")).toHaveText("2");
  await linha.locator(".tpl-comprar").click();
  await expect(linha.locator(".tpl-comprar")).toContainText("ADICIONADO");
});
