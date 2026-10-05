// Script_Produto V3 — renderizador atual da página de produto na Moovin (versão legada, anterior ao editor).
// Recuperado em 05/10/2026 da página pública https://shoptest.bomgado.com/cubos-de-panela-1-kg/p,
// onde a Moovin o publica no payload do Next.js; decodificado e formatado com Prettier.
// Fonte de verdade continua sendo o painel: https://store.moovin.app/configuration/script/edit/c42bee55-b8fb-4ddd-a4dd-b41d0214fda6
// Configuração no painel: ativo, tipo CONTENT, posição Cabeçalho, página Detalhe do produto.
// Ativação: a descrição do produto precisa ter MODO NOVO, RESUMO DO PRODUTO e DETALHES DO PRODUTO (ver docs/HISTORICO.md).
(function () {
  "use strict";
  var KEY = "__bomgadoProductLayoutV3",
    STYLE = "bomgado-product-layout-v3-style",
    TABS = "bomgado-product-tabs-v3",
    SHARE = "bomgado-product-share-v3",
    STICKY = "bomgado-product-sticky-v3";
  var busy = false,
    active = false,
    timer = null,
    observer,
    sharePosition,
    stickyUpdate;
  function txt(node) {
    return ((node && (node.innerText || node.textContent)) || "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function schedule() {
    if (busy) return;
    busy = true;
    requestAnimationFrame(function () {
      busy = false;
      sync();
    });
  }
  function row(main) {
    return Array.from(main.querySelectorAll("div")).find(function (n) {
      return (
        n.classList.contains("flex") &&
        n.classList.contains("flex-1") &&
        n.classList.contains("gap-[30px]") &&
        n.querySelector('img[alt="product image"]')
      );
    });
  }
  function parse(main) {
    var h = Array.from(main.querySelectorAll("h1")).find(function (n) {
        return txt(n).toUpperCase() === "DESCRIÇÃO:";
      }),
      section = h && h.parentElement,
      body = section && section.querySelector(".disable-preflight");
    if (!body || !section.parentElement) return null;
    var nodes = Array.from(body.children),
      norm = function (n) {
        return txt(n).toUpperCase();
      },
      mode = nodes.findIndex(function (n) {
        return norm(n) === "MODO NOVO";
      }),
      summary = nodes.findIndex(function (n) {
        return norm(n) === "RESUMO DO PRODUTO";
      }),
      details = nodes.findIndex(function (n) {
        return norm(n) === "DETALHES DO PRODUTO";
      });
    if (mode < 0 || summary <= mode || details <= summary) return null;
    var commercial = nodes
        .slice(mode + 1, summary)
        .map(txt)
        .map(function (value) {
          var m =
            /^CONTEÚDO COMERCIAL\s*:\s*(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|un(?:idade)?s?)$/i.exec(
              value,
            );
          if (!m) return null;
          var amount = Number(m[1].replace(",", ".")),
            unit = m[2].toLowerCase().replace(/unidades?/, "un");
          return amount > 0 ? { amount: amount, unit: unit } : null;
        })
        .find(Boolean),
      summaryText = nodes
        .slice(summary + 1, details)
        .map(txt)
        .filter(Boolean)
        .join(" "),
      sections = [],
      current = null;
    nodes.slice(details + 1).forEach(function (n) {
      var m = /^@\s*(?:\d+\s*)?(.+)$/i.exec(txt(n));
      if (m) {
        current = { title: m[1].trim(), nodes: [] };
        sections.push(current);
      } else if (current) current.nodes.push(n.cloneNode(true));
    });
    sections = sections.filter(function (s) {
      return s.title && s.nodes.length;
    });
    return summaryText && sections.length
      ? {
          summary: summaryText,
          sections: sections,
          section: section,
          commercial: commercial,
        }
      : null;
  }
  function source(main) {
    var r = row(main),
      info = r && r.children[1];
    return info &&
      info.children[2] &&
      !info.children[2].className.includes("fixed bottom-0 left-0")
      ? info.children[2]
      : null;
  }
  function updateUnitPrice(actions, price, commercial) {
    if (!commercial) {
      actions.removeAttribute("data-bg-unit-price");
      return "";
    }
    var text =
        (price.querySelector("b") && price.querySelector("b").textContent) ||
        "",
      match = /([\d.]+,[\d]{2})/.exec(text),
      value = match
        ? Number(match[1].replace(/\./g, "").replace(",", "."))
        : NaN;
    if (!Number.isFinite(value) || value <= 0) {
      actions.removeAttribute("data-bg-unit-price");
      return "";
    }
    var base, label;
    if (commercial.unit === "g") {
      base = 1000;
      label = "kg";
    } else if (commercial.unit === "kg") {
      base = 1;
      label = "kg";
    } else if (commercial.unit === "ml") {
      base = 1000;
      label = "L";
    } else if (commercial.unit === "l") {
      base = 1;
      label = "L";
    } else if (commercial.unit === "un") {
      base = 1;
      label = "un";
    } else {
      actions.removeAttribute("data-bg-unit-price");
      return "";
    }
    var result = (value * base) / commercial.amount;
    if (!Number.isFinite(result) || result <= 0) {
      actions.removeAttribute("data-bg-unit-price");
      return "";
    }
    var formatted = result.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    actions.setAttribute(
      "data-bg-unit-price",
      "R$ " + formatted + " / " + label,
    );
    return actions.getAttribute("data-bg-unit-price");
  }
  function addStyle() {
    if (document.getElementById(STYLE)) return;
    var s = document.createElement("style");
    s.id = STYLE;
    s.textContent =
      "main img[alt='product image']{border-radius:18px!important;box-shadow:0 8px 22px rgba(23,58,77,.15)!important}[data-bg-info]{display:grid!important;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto!important;align-content:start;gap:14px!important;position:relative;background:transparent!important;padding:0!important;box-shadow:none!important}[data-bg-info]::before{content:'';grid-column:1;grid-row:2;background:#fff;border:1px solid rgba(23,58,77,.12);border-radius:20px;box-shadow:0 8px 26px rgba(23,58,77,.08);z-index:0}[data-bg-heading]{grid-column:1;grid-row:1;z-index:1;padding:24px!important;border:1px solid rgba(23,58,77,.12);border-radius:20px;background:#fff;box-shadow:0 8px 26px rgba(23,58,77,.08);box-sizing:border-box}[data-bg-heading]>div:nth-child(2){width:100%;padding-right:40px;box-sizing:border-box}[data-bg-heading]::after{content:attr(data-bg-summary);display:block;margin-top:18px;color:#675f55;font:italic 16px/1.8 Georgia,'Times New Roman',serif}[data-bg-price]{grid-column:1;grid-row:2;z-index:1;align-self:start;justify-self:start;width:max-content;padding:22px 0 0 24px!important;box-sizing:border-box}[data-bg-payment],[data-bg-shipping],[data-bg-sharing],[data-bg-description]{display:none!important}[data-bg-actions]{grid-column:1;grid-row:2;z-index:1;align-self:stretch;justify-self:stretch;display:flex;align-items:center;justify-content:flex-end;width:100%;height:90px;padding:20px 24px 20px 140px!important;box-sizing:border-box}[data-bg-product-area]{padding-bottom:16px!important}main [data-bg-tabs-holder]>#" +
      TABS +
      "{width:100%;max-width:none;box-sizing:border-box;margin:0 0 30px;padding:0;color:#173a4d}#" +
      TABS +
      " .bg-tabs-heading{margin:0 0 22px}#" +
      TABS +
      " .bg-tabs-eyebrow{display:block;margin-bottom:8px;color:#a27b3b;font:700 11px/1.4 Arial,sans-serif;letter-spacing:.16em}#" +
      TABS +
      " .bg-tabs-heading h2{margin:0;color:#173a4d;font:700 30px/1.2 Georgia,'Times New Roman',serif}#" +
      TABS +
      " .bg-tabs-shell{overflow:hidden;border:1px solid rgba(23,58,77,.13);border-radius:20px;background:#fff;box-shadow:0 8px 26px rgba(23,58,77,.08)}#" +
      TABS +
      " .bg-tabs-nav{display:flex;overflow-x:auto;padding:12px 14px 0;border-bottom:1px solid rgba(23,58,77,.12);background:#f5efe4}#" +
      TABS +
      " .bg-tab{display:flex;align-items:center;gap:10px;min-width:160px;margin:0 5px;padding:15px 18px 14px;border:0;border-bottom:3px solid transparent;border-radius:12px 12px 0 0;background:transparent;color:#52616a;font:600 14px/1.25 Arial,sans-serif;white-space:nowrap;cursor:pointer}#" +
      TABS +
      " .bg-tab[aria-selected=true]{border-bottom-color:#b58a3c;background:#fff;color:#173a4d}#" +
      TABS +
      " .bg-tab-index{color:#a27b3b;font-size:11px;letter-spacing:.08em}#" +
      TABS +
      " .bg-tab-chevron{margin-left:auto;font-size:16px}#" +
      TABS +
      " .bg-tab-panel{min-height:150px;padding:28px 32px;color:#514b43;font:16px/1.8 Georgia,'Times New Roman',serif}#" +
      TABS +
      " .bg-tab-panel[hidden]{display:none}#" +
      TABS +
      " .bg-tab-panel>*:first-child{margin-top:0}#" +
      TABS +
      " .bg-tab-panel>*:last-child{margin-bottom:0}#" +
      TABS +
      " .bg-tab-panel h2,#" +
      TABS +
      " .bg-tab-panel h3{color:#173a4d}#" +
      TABS +
      " .bg-tab-panel h2{font:700 23px/1.35 Georgia,'Times New Roman',serif}#" +
      TABS +
      " .bg-tab-panel h3{font:700 17px/1.4 Georgia,'Times New Roman',serif}#" +
      SHARE +
      " .bg-share-feedback{position:absolute;left:calc(100% + 8px);top:50%;transform:translateY(-50%);white-space:nowrap;font:12px Arial;color:#173a4d}#" +
      STICKY +
      "{position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:1000!important;display:flex!important;justify-content:center!important;box-sizing:border-box!important;padding:12px 20px!important;background:#173a4d!important;box-shadow:0 -6px 24px rgba(10,32,44,.2)!important;transform:translateY(110%)!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:transform 360ms cubic-bezier(.22,1,.36,1),opacity 220ms ease,visibility 0s linear 360ms!important;will-change:transform!important}#" +
      STICKY +
      ".is-visible{transform:translateY(0)!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;transition:transform 360ms cubic-bezier(.22,1,.36,1),opacity 220ms ease,visibility 0s!important}#" +
      STICKY +
      " [data-bg-sticky-controls]{display:flex!important;align-items:center!important;flex-flow:row nowrap!important;width:min(100%,1000px)!important;max-width:1000px!important;gap:14px!important;margin:0!important;box-sizing:border-box!important}#" +
      STICKY +
      " .bg-sticky-price{display:flex!important;flex:0 0 auto!important;flex-direction:column!important;justify-content:center!important;align-self:center!important;min-width:max-content!important;min-height:50px!important;margin:0!important;color:#fff!important;font-size:22px!important;line-height:1.25!important}#" +
      STICKY +
      " .bg-sticky-price b{line-height:1.25!important}#" +
      STICKY +
      " .bg-sticky-quantity{display:flex!important;flex:0 0 95px!important;width:95px!important;background:#fff!important;color:#173a4d!important;border-color:rgba(255,255,255,.65)!important}#" +
      STICKY +
      " .bg-sticky-quantity input,#" +
      STICKY +
      " .bg-sticky-quantity span{color:#173a4d!important}#" +
      STICKY +
      " .bg-sticky-buy{display:flex!important;flex:1 1 auto!important;min-width:120px!important;background:#b58a3c!important;color:#173a4d!important;font-weight:700!important;border-radius:12px!important;cursor:pointer}[data-bg-mobile-bar]{box-sizing:border-box!important;padding:8px 15px 10px!important;background:#173a4d!important;border-top-color:#173a4d!important}[data-bg-mobile-bar]::before{content:attr(data-bg-mobile-price);display:block;margin-bottom:6px;color:#fff;font-size:18px;font-weight:700;line-height:24px}[data-bg-mobile-bar] button{background:#b58a3c!important;color:#173a4d!important;font-weight:700!important}[data-bg-mobile-bar] [class*='items-counter']{background:#fff!important}[data-bg-mobile-bar] input,[data-bg-mobile-bar] span{color:#173a4d!important}[data-bg-actions][data-bg-unit-price]{height:auto!important;min-height:90px!important;flex-wrap:wrap!important;row-gap:8px!important;align-content:center!important;padding-bottom:20px!important;position:relative!important;z-index:2!important}[data-bg-actions][data-bg-unit-price]>button{flex:1 1 0%!important;min-width:0!important;width:auto!important}[data-bg-actions][data-bg-unit-price]::after{content:attr(data-bg-unit-price);display:block;flex:0 0 100%;width:100%;box-sizing:border-box;text-align:right;color:#173a4d;font:600 15px/1.4 Arial,sans-serif;padding-right:2px;white-space:normal}#" +
      STICKY +
      " [data-bg-unit-price]{flex-flow:row wrap!important;height:auto!important;min-height:50px!important;row-gap:2px!important;padding-bottom:4px!important}#" +
      STICKY +
      " [data-bg-unit-price]::after{order:4;flex:0 0 100%;text-align:center;font-size:12px;padding:0}@media(max-width:700px){[data-bg-actions][data-bg-unit-price]::after{text-align:left;font-size:14px;padding-left:2px}[data-bg-info]{grid-template-rows:auto auto auto!important;gap:10px!important}[data-bg-info]::before{grid-row:2/span 2;border-radius:16px}[data-bg-heading]{padding:18px!important;border-radius:16px}[data-bg-heading]::after{margin-top:14px;font-size:14px;line-height:1.65}[data-bg-price]{grid-row:2;width:auto;padding:16px 16px 0!important}[data-bg-actions]{grid-row:3;height:auto;padding:0 16px 16px!important}main [data-bg-tabs-holder]>#" +
      TABS +
      "{margin-bottom:24px}#" +
      TABS +
      " .bg-tabs-heading{margin-bottom:16px}#" +
      TABS +
      " .bg-tabs-heading h2{font-size:24px}#" +
      TABS +
      " .bg-tabs-shell{border-radius:16px}#" +
      TABS +
      " .bg-tabs-nav{padding:8px 8px 0}#" +
      TABS +
      " .bg-tab{min-width:max-content;padding:13px 12px 11px;font-size:13px}#" +
      TABS +
      " .bg-tab-chevron{display:none}#" +
      TABS +
      " .bg-tab-panel{min-height:120px;padding:20px 18px;font-size:14px;line-height:1.7}#" +
      STICKY +
      "{display:none!important}[data-bg-mobile-bar]{display:flex!important;flex-flow:row wrap!important;align-items:center!important;gap:4px!important;padding:8px 15px 10px!important}[data-bg-mobile-bar]::before{flex:0 0 100%;width:100%;box-sizing:border-box;margin:0}[data-bg-mobile-bar]>div{width:100%!important;flex:0 0 100%!important;box-sizing:border-box}[data-bg-mobile-bar]>div>button{flex:1 1 auto!important;min-width:0!important}}";
    document.head.appendChild(s);
  }
  function renderTabs(parent, section, sections, signature) {
    var tabs = document.getElementById(TABS);
    if (
      tabs &&
      tabs.dataset.signature === signature &&
      tabs.parentElement === parent
    )
      return tabs;
    if (tabs) tabs.remove();
    tabs = document.createElement("section");
    tabs.id = TABS;
    tabs.dataset.signature = signature;
    tabs.setAttribute("aria-label", "Informações detalhadas do produto");
    tabs.innerHTML =
      "<div class='bg-tabs-heading'><span class='bg-tabs-eyebrow'>CONHEÇA O PRODUTO</span><h2>Informações e detalhes</h2></div><div class='bg-tabs-shell'><div class='bg-tabs-nav' role='tablist' aria-label='Seções do produto'></div><div class='bg-tabs-panels'></div></div>";
    var nav = tabs.querySelector("[role='tablist']"),
      panels = tabs.querySelector(".bg-tabs-panels");
    sections.forEach(function (section, index) {
      var id = "bg-tab-" + (index + 1),
        button = document.createElement("button");
      button.type = "button";
      button.className = "bg-tab";
      button.id = id + "-button";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", id + "-panel");
      button.setAttribute("aria-selected", index === 0 ? "true" : "false");
      button.tabIndex = index === 0 ? 0 : -1;
      button.innerHTML =
        "<span class='bg-tab-index'></span><span class='bg-tab-label'></span><span class='bg-tab-chevron' aria-hidden='true'>↗</span>";
      button.querySelector(".bg-tab-index").textContent = String(
        index + 1,
      ).padStart(2, "0");
      button.querySelector(".bg-tab-label").textContent = section.title;
      var panel = document.createElement("div");
      panel.id = id + "-panel";
      panel.className = "bg-tab-panel";
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", button.id);
      panel.tabIndex = 0;
      panel.hidden = index !== 0;
      section.nodes.forEach(function (node) {
        panel.appendChild(node.cloneNode(true));
      });
      button.addEventListener("click", function () {
        Array.from(nav.querySelectorAll("[role='tab']")).forEach(
          function (tab, i) {
            var selected = i === index;
            tab.setAttribute("aria-selected", selected ? "true" : "false");
            tab.tabIndex = selected ? 0 : -1;
            panels.children[i].hidden = !selected;
          },
        );
      });
      button.addEventListener("keydown", function (event) {
        if (["ArrowRight", "ArrowLeft", "Home", "End"].indexOf(event.key) < 0)
          return;
        event.preventDefault();
        var all = Array.from(nav.querySelectorAll("[role='tab']")),
          next = index;
        if (event.key === "ArrowRight") next = (index + 1) % all.length;
        if (event.key === "ArrowLeft")
          next = (index + all.length - 1) % all.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = all.length - 1;
        all[next].focus();
        all[next].click();
      });
      nav.appendChild(button);
      panels.appendChild(panel);
    });
    parent.insertBefore(tabs, section);
    return tabs;
  }
  function placeShare() {
    var button = document.getElementById(SHARE),
      heading = document.querySelector("[data-bg-heading]"),
      rating = heading && heading.children[1];
    if (!button || !rating) return;
    var r = rating.getBoundingClientRect();
    button.style.left = Math.round(r.right - 40) + "px";
    button.style.top = Math.round(r.top - 8) + "px";
  }
  function fallback(url) {
    var field = document.createElement("textarea");
    field.value = url;
    field.readOnly = true;
    field.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(field);
    field.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    field.remove();
    return ok;
  }
  function addShare() {
    if (document.getElementById(SHARE)) return;
    var b = document.createElement("button");
    b.id = SHARE;
    b.type = "button";
    b.title = "Compartilhar produto";
    b.setAttribute("aria-label", "Compartilhar produto");
    b.innerHTML =
      "<svg width='18' height='18' viewBox='0 0 18 18' aria-hidden='true'><path fill='currentColor' d='M13.5 16.6a2.3 2.3 0 0 1-1.7-.7 2.3 2.3 0 0 1-.7-1.7 2 2 0 0 1 .08-.55l-5.07-2.95a2.4 2.4 0 0 1-1.62.64 2.4 2.4 0 1 1 1.62-4.18l5.07-2.95a2 2 0 0 1-.08-.55 2.4 2.4 0 1 1 1.4 2.2 2.4 2.4 0 0 1-.73-.46l-5.07 2.94a2.2 2.2 0 0 1 0 .56l5.07 2.94a2.4 2.4 0 1 1 1.72-4.06Z'/></svg><span class='bg-share-feedback'></span>";
    b.style.cssText =
      "position:fixed;z-index:1001;width:40px;height:40px;padding:9px;border:1px solid rgba(23,58,77,.14);border-radius:50%;background:#fff;color:#173a4d;cursor:pointer;display:flex;align-items:center;justify-content:center;box-sizing:border-box";
    b.addEventListener("click", function () {
      var url = location.origin + location.pathname,
        copy =
          navigator.clipboard && navigator.clipboard.writeText
            ? navigator.clipboard.writeText(url).then(
                function () {
                  return true;
                },
                function () {
                  return fallback(url);
                },
              )
            : Promise.resolve(fallback(url));
      copy.then(function (ok) {
        var label = b.querySelector(".bg-share-feedback");
        label.textContent = ok ? "Link copiado!" : "Copie o link: " + url;
        b.setAttribute(
          "aria-label",
          ok ? "Link copiado!" : "Copie o link do produto",
        );
        setTimeout(function () {
          label.textContent = "";
          b.setAttribute("aria-label", "Compartilhar produto");
        }, 2200);
      });
    });
    document.body.appendChild(b);
    sharePosition = placeShare;
    window.addEventListener("scroll", sharePosition, { passive: true });
    window.addEventListener("resize", sharePosition);
  }
  function addSticky(main, actions, price, signature) {
    var sticky = document.getElementById(STICKY);
    if (
      sticky &&
      (sticky.__source !== actions || sticky.dataset.signature !== signature)
    ) {
      sticky.remove();
      sticky = null;
    }
    if (!sticky) {
      sticky = document.createElement("div");
      sticky.id = STICKY;
      sticky.setAttribute("aria-label", "Compra do produto");
      var controls = actions.cloneNode(true);
      controls.removeAttribute("data-bg-actions");
      controls.setAttribute("data-bg-sticky-controls", "");
      var p = price.firstElementChild.cloneNode(true);
      p.classList.add("bg-sticky-price");
      controls.prepend(p);
      var q = controls.children[1];
      if (q) q.classList.add("bg-sticky-quantity");
      var input = controls.querySelector("input");
      if (input) input.readOnly = true;
      var button = controls.querySelector("button"),
        original = actions.querySelector("button");
      if (button) {
        button.classList.add("bg-sticky-buy");
        button.textContent = txt(original) || "COMPRAR";
        button.addEventListener("click", function () {
          var current = source(document.querySelector("main")),
            native = current && current.querySelector("button");
          if (native) native.click();
        });
      }
      if (q)
        Array.from(q.querySelectorAll("span")).forEach(
          function (control, index) {
            control.addEventListener("click", function () {
              var current = source(document.querySelector("main")),
                box =
                  current &&
                  current.querySelector(".flex.items-center.justify-between"),
                native =
                  box &&
                  box.querySelector(
                    index ? "span:last-child" : "span:first-child",
                  );
              if (native) native.click();
            });
          },
        );
      sticky.appendChild(controls);
      sticky.__source = actions;
      sticky.dataset.signature = signature;
      document.body.appendChild(sticky);
    }
    if (stickyUpdate) {
      window.removeEventListener("scroll", stickyUpdate);
      window.removeEventListener("resize", stickyUpdate);
    }
    stickyUpdate = function () {
      var m = document.querySelector("main"),
        native = source(m),
        rect = native && native.getBoundingClientRect(),
        bar = document.getElementById(STICKY);
      if (!bar) return;
      bar.classList.toggle(
        "is-visible",
        innerWidth > 700 && !!rect && rect.bottom <= 0,
      );
      var a = native && native.querySelector("input"),
        b = bar.querySelector("input");
      if (a && b && a.value !== b.value) b.value = a.value;
      var n = native && native.querySelector("button"),
        c = bar.querySelector("button");
      if (n && c && txt(n) && c.textContent !== txt(n)) c.textContent = txt(n);
      var unit = native && native.getAttribute("data-bg-unit-price"),
        controls = bar.querySelector("[data-bg-sticky-controls]");
      if (controls) {
        if (unit) controls.setAttribute("data-bg-unit-price", unit);
        else controls.removeAttribute("data-bg-unit-price");
      }
    };
    window.addEventListener("scroll", stickyUpdate, { passive: true });
    window.addEventListener("resize", stickyUpdate);
    stickyUpdate();
    if (!timer) timer = setInterval(stickyUpdate, 200);
  }
  function cleanup(main) {
    if (main)
      main
        .querySelectorAll(
          "[data-bg-info],[data-bg-heading],[data-bg-price],[data-bg-actions],[data-bg-payment],[data-bg-shipping],[data-bg-sharing],[data-bg-description],[data-bg-product-area],[data-bg-mobile-bar],[data-bg-tabs-holder]",
        )
        .forEach(function (n) {
          [
            "data-bg-info",
            "data-bg-heading",
            "data-bg-summary",
            "data-bg-price",
            "data-bg-actions",
            "data-bg-payment",
            "data-bg-shipping",
            "data-bg-sharing",
            "data-bg-description",
            "data-bg-product-area",
            "data-bg-mobile-bar",
            "data-bg-mobile-price",
            "data-bg-tabs-holder",
          ].forEach(function (a) {
            n.removeAttribute(a);
          });
        });
    [STYLE, TABS, SHARE, STICKY].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) n.remove();
    });
    if (timer) clearInterval(timer);
    timer = null;
    if (sharePosition) {
      window.removeEventListener("scroll", sharePosition);
      window.removeEventListener("resize", sharePosition);
    }
    if (stickyUpdate) {
      window.removeEventListener("scroll", stickyUpdate);
      window.removeEventListener("resize", stickyUpdate);
    }
    sharePosition = null;
    stickyUpdate = null;
    active = false;
  }
  function sync() {
    var main = document.querySelector("main");
    if (!main) {
      if (active) cleanup(main);
      return;
    }
    var data = parse(main);
    if (!data) {
      if (active) cleanup(main);
      return;
    }
    var r = row(main),
      info = r && r.children[1],
      heading = info && info.children[0],
      price = info && info.children[1],
      actions = source(main);
    if (!info || !heading || !price || !actions) return;
    var parent = data.section.parentElement,
      area = r.parentElement && r.parentElement.parentElement,
      shipping = info.children[3],
      sharing = info.children[4];
    var signature = data.sections
      .map(function (s) {
        return s.title + ":" + s.nodes.map(txt).join("|");
      })
      .join("||");
    var unitPrice = updateUnitPrice(actions, price, data.commercial);
    signature += "||unit:" + unitPrice;
    info.setAttribute("data-bg-info", "");
    heading.setAttribute("data-bg-heading", "");
    heading.setAttribute("data-bg-summary", data.summary);
    price.setAttribute("data-bg-price", "");
    actions.setAttribute("data-bg-actions", "");
    if (shipping) shipping.setAttribute("data-bg-shipping", "");
    if (sharing) sharing.setAttribute("data-bg-sharing", "");
    var payment = Array.from(price.querySelectorAll("span")).find(function (n) {
      return n.textContent.indexOf("Ver mais formas de pagamento") >= 0;
    });
    if (payment) payment.setAttribute("data-bg-payment", "");
    data.section.setAttribute("data-bg-description", "");
    if (area) area.setAttribute("data-bg-product-area", "");
    parent.setAttribute("data-bg-tabs-holder", "");
    renderTabs(parent, data.section, data.sections, signature);
    addStyle();
    addShare();
    placeShare();
    addSticky(main, actions, price, signature);
    var mobile = main.querySelector("[class*='fixed bottom-0 left-0']");
    if (mobile) {
      mobile.setAttribute("data-bg-mobile-bar", "");
      mobile.setAttribute(
        "data-bg-mobile-price",
        price.querySelector("b")
          ? price.querySelector("b").textContent.trim()
          : "",
      );
    }
    active = true;
  }
  window[KEY] = schedule;
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener("resize", schedule);
  window.addEventListener("popstate", schedule);
  var originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(this, arguments);
    schedule();
  };
  var originalReplaceState = history.replaceState;
  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    schedule();
  };
  schedule();
})();
