import { useMemo, useState } from "react";

type BlockType =
  | "gallery"
  | "title"
  | "price"
  | "description"
  | "variants"
  | "quantity"
  | "buyButton"
  | "shipping"
  | "trust";

type Block = {
  id: string;
  type: BlockType;
  label: string;
  visible: boolean;
};

type Template = {
  version: 1;
  name: string;
  updatedAt: string;
  blocks: Array<{ type: BlockType; label: string; visible: boolean }>;
};

const knownBlockTypes = new Set<BlockType>([
  "gallery",
  "title",
  "price",
  "description",
  "variants",
  "quantity",
  "buyButton",
  "shipping",
  "trust",
]);

const initialBlocks: Block[] = [
  { id: "gallery-1", type: "gallery", label: "Galeria de imagens", visible: true },
  { id: "title-1", type: "title", label: "Nome do produto", visible: true },
  { id: "price-1", type: "price", label: "Preço", visible: true },
  { id: "variants-1", type: "variants", label: "Variações do produto", visible: true },
  { id: "quantity-1", type: "quantity", label: "Quantidade", visible: true },
  { id: "buy-1", type: "buyButton", label: "Botão comprar (Moovin)", visible: true },
  { id: "shipping-1", type: "shipping", label: "Calcular frete", visible: true },
  { id: "description-1", type: "description", label: "Descrição", visible: true },
];

const blockCatalog: Array<{ type: BlockType; label: string; icon: string; group: string }> = [
  { type: "gallery", label: "Galeria de imagens", icon: "▧", group: "Produto" },
  { type: "title", label: "Nome do produto", icon: "T", group: "Produto" },
  { type: "price", label: "Preço", icon: "R$", group: "Produto" },
  { type: "description", label: "Descrição", icon: "≡", group: "Produto" },
  { type: "variants", label: "Variações", icon: "▦", group: "Funcionalidades Moovin" },
  { type: "quantity", label: "Quantidade", icon: "−+", group: "Funcionalidades Moovin" },
  { type: "buyButton", label: "Botão comprar", icon: "＋", group: "Funcionalidades Moovin" },
  { type: "shipping", label: "Calcular frete", icon: "⌁", group: "Funcionalidades Moovin" },
  { type: "trust", label: "Selos de confiança", icon: "◇", group: "Conteúdo" },
];

const productPhoto =
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadTemplate(key: string): Template | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      parsed.version !== 1 ||
      !("name" in parsed) ||
      typeof parsed.name !== "string" ||
      !("blocks" in parsed) ||
      !Array.isArray(parsed.blocks)
    ) {
      return null;
    }
    const blocks = parsed.blocks.filter(
      (block): block is { type: BlockType; label: string; visible: boolean } =>
        typeof block === "object" &&
        block !== null &&
        "type" in block &&
        typeof block.type === "string" &&
        knownBlockTypes.has(block.type as BlockType) &&
        "label" in block &&
        typeof block.label === "string" &&
        "visible" in block &&
        typeof block.visible === "boolean",
    );
    return {
      version: 1,
      name: parsed.name,
      updatedAt: "updatedAt" in parsed && typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      blocks,
    };
  } catch {
    return null;
  }
}

function App() {
  const [savedDraft] = useState(() => loadTemplate("moovin-product-template-draft"));
  const [savedPublication] = useState(() => loadTemplate("moovin-product-template-published"));
  const [blocks, setBlocks] = useState<Block[]>(() =>
    savedDraft
      ? savedDraft.blocks.map((block) => ({ ...block, id: makeId() }))
      : initialBlocks,
  );
  const [selectedId, setSelectedId] = useState("");
  const [templateName, setTemplateName] = useState(savedDraft?.name ?? "Página de produto");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [status, setStatus] = useState(savedDraft ? "Rascunho carregado" : "Todas as alterações salvas");
  const [published, setPublished] = useState(Boolean(savedPublication));
  const [previewOnly, setPreviewOnly] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const selectedBlock = blocks.find((block) => block.id === selectedId);
  const groupedCatalog = useMemo(
    () => [...new Set(blockCatalog.map((block) => block.group))],
    [],
  );

  function updateBlock(id: string, updater: (block: Block) => Block) {
    setBlocks((current) => current.map((block) => (block.id === id ? updater(block) : block)));
    setStatus("Alterações não salvas");
    setPublished(false);
  }

  function addBlock(type: BlockType) {
    const definition = blockCatalog.find((block) => block.type === type);
    if (!definition) return;
    const newBlock = { id: makeId(), type, label: definition.label, visible: true };
    setBlocks((current) => [...current, newBlock]);
    setSelectedId(newBlock.id);
    setStatus("Alterações não salvas");
    setPublished(false);
  }

  function removeBlock(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
    if (selectedId === id) setSelectedId("");
    setStatus("Alterações não salvas");
    setPublished(false);
  }

  function moveBlock(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setBlocks((current) => {
      const sourceIndex = current.findIndex((block) => block.id === sourceId);
      const targetIndex = current.findIndex((block) => block.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setStatus("Alterações não salvas");
    setPublished(false);
  }

  function serializeTemplate(): Template {
    return {
      version: 1,
      name: templateName,
      updatedAt: new Date().toISOString(),
      blocks: blocks.map(({ type, label, visible }) => ({ type, label, visible })),
    };
  }

  function saveTemplate(publish = false) {
    const template = serializeTemplate();
    localStorage.setItem("moovin-product-template-draft", JSON.stringify(template));
    if (publish) {
      localStorage.setItem("moovin-product-template-published", JSON.stringify(template));
      setPublished(true);
      setStatus("Template publicado");
    } else {
      setStatus("Rascunho salvo");
    }
  }

  function exportTemplate() {
    const file = new Blob([JSON.stringify(serializeTemplate(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "moovin-product-template.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (previewOnly) {
    return (
      <div className="preview-mode">
        <div className="preview-mode-bar">
          <span><span className="status-dot" /> Pré-visualização do tema</span>
          <button className="button button-secondary" onClick={() => setPreviewOnly(false)}>
            Voltar ao editor
          </button>
        </div>
        <ProductCanvas blocks={blocks} device={device} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">m</div>
          <div><strong>moovin</strong><span>PAINEL DA LOJA</span></div>
        </div>
        <div className="store-switcher">
          <div className="store-avatar">L</div>
          <div><strong>Loja de demonstração</strong><span>Ambiente de teste</span></div>
          <span className="chevron">⌄</span>
        </div>
        <div className="nav-caption">MENU PRINCIPAL</div>
        <nav className="side-nav">
          <a href="#dashboard"><span>▦</span> Visão geral</a>
          <a href="#catalog"><span>▧</span> Produtos</a>
          <a href="#orders"><span>▤</span> Pedidos</a>
          <a href="#customers"><span>♙</span> Clientes</a>
          <a href="#marketing"><span>✧</span> Marketing</a>
          <a href="#store"><span>▣</span> Minha loja</a>
          <a className="nav-active" href="#themes"><span>◩</span> Aparência</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">?</div>
            <strong>Precisa de ajuda?</strong>
            <p>Acesse nossa central de ajuda para saber mais.</p>
            <a href="#help">Acessar central <span>↗</span></a>
          </div>
          <button className="profile">
            <div className="profile-avatar">CA</div>
            <div><strong>Camila Admin</strong><span>Administradora</span></div>
            <span className="chevron">···</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Minha loja</span><b>/</b><span>Aparência</span><b>/</b><strong>Editor de página de produto</strong></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notificações">♧<i /></button>
            <button className="icon-button" aria-label="Ajuda">?</button>
            <div className="topbar-separator" />
            <button className="view-store">Ver minha loja <span>↗</span></button>
          </div>
        </header>

        <section className="editor-heading">
          <div>
            <div className="eyebrow"><span className="crumb-icon">◩</span> APARÊNCIA DA LOJA <span className="heading-slash">/</span> PÁGINA DE PRODUTO</div>
            <h1>Editor de página de produto</h1>
            <p>Personalize como seus produtos aparecem na loja.</p>
          </div>
          <div className="heading-actions">
            <span className="save-indicator"><span className={status === "Alterações não salvas" ? "status-dot amber" : "status-dot"} />{status}</span>
            <button className="button button-secondary" onClick={() => saveTemplate(false)}>Salvar rascunho</button>
            <button className="button button-primary" onClick={() => saveTemplate(true)}><span>↑</span> Publicar alterações</button>
          </div>
        </section>

        <section className="template-toolbar">
          <div className="template-name">
            <span className="template-icon">▧</span>
            <div><small>TEMPLATE</small><input aria-label="Nome do template" value={templateName} onChange={(event) => { setTemplateName(event.target.value); setStatus("Alterações não salvas"); setPublished(false); }} /></div>
            <button className="subtle-icon" aria-label="Editar nome">✎</button>
          </div>
          <div className="template-meta">
            <span className={`draft-badge ${published ? "is-published" : ""}`}><i />{published ? "Publicado" : "Rascunho"}</span>
            <span className="meta-divider" />
            <span>Última edição: agora</span>
          </div>
          <div className="toolbar-right">
            <button className="button button-plain" onClick={() => setPreviewOnly(true)}>◉ Pré-visualizar</button>
            <button className="button button-plain" onClick={exportTemplate}>⇩ Exportar JSON</button>
            <button className="more-button" aria-label="Mais opções">···</button>
          </div>
        </section>

        <div className="editor-layout">
          <aside className="components-panel">
            <div className="panel-title-row"><div><h2>Componentes</h2><p>Adicione elementos à página</p></div><button className="collapse-button" aria-label="Recolher painel">‹</button></div>
            <label className="search-box"><span>⌕</span><input placeholder="Buscar componente..." /><kbd>⌘ K</kbd></label>
            <div className="component-groups">
              {groupedCatalog.map((group) => (
                <div className="component-group" key={group}>
                  <div className="group-label">{group}<span>⌄</span></div>
                  <div className="component-list">
                    {blockCatalog.filter((item) => item.group === group).map((item) => (
                      <button className="component-item" key={item.type} onClick={() => addBlock(item.type)}>
                        <span className="component-icon">{item.icon}</span><span>{item.label}</span><b>＋</b>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="native-note"><span>✦</span><p><strong>Recursos nativos Moovin</strong>Componentes funcionais usam os dados e ações disponíveis na loja.</p></div>
          </aside>

          <section className="workspace">
            <div className="canvas-toolbar">
              <div className="canvas-label"><span className="green-pulse" /> PRÉVIA DA PÁGINA <span className="canvas-divider" /> <span className="url-label">lojaexemplo.com.br/produto/tenis</span></div>
              <div className="device-controls">
                <button className={device === "desktop" ? "device-button selected" : "device-button"} onClick={() => setDevice("desktop")} aria-label="Prévia desktop">▱</button>
                <button className={device === "mobile" ? "device-button selected" : "device-button"} onClick={() => setDevice("mobile")} aria-label="Prévia mobile">▯</button>
                <span className="canvas-divider" /><button className="zoom-button">100%⌄</button>
              </div>
            </div>
            <div className="canvas-stage">
              <ProductCanvas
                blocks={blocks}
                device={device}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                onMove={moveBlock}
                draggedId={draggedId}
                setDraggedId={setDraggedId}
              />
            </div>
            <div className="canvas-footer"><span>↗</span> Prévia com produto de demonstração <button onClick={() => setStatus("Produto de demonstração selecionado")}>Trocar produto</button></div>
          </section>

          <aside className="inspector-panel">
            <div className="inspector-tabs"><button className="active">Propriedades</button><button>Estilos</button></div>
            {selectedBlock ? (
              <>
                <div className="selected-component">
                  <span className="selected-icon">{blockCatalog.find((item) => item.type === selectedBlock.type)?.icon}</span>
                  <div><strong>{selectedBlock.label}</strong><span>Componente de produto</span></div>
                  <button className="subtle-icon" aria-label="Mais ações">···</button>
                </div>
                <div className="inspector-section">
                  <div className="inspector-section-heading"><h3>Conteúdo</h3><span>⌄</span></div>
                  <label className="field-label">Nome do componente</label>
                  <input className="text-field" value={selectedBlock.label} onChange={(event) => updateBlock(selectedBlock.id, (block) => ({ ...block, label: event.target.value }))} />
                  <div className="visibility-row"><div><strong>Visibilidade</strong><span>Exibir este componente na loja</span></div><button className={`toggle ${selectedBlock.visible ? "on" : ""}`} onClick={() => updateBlock(selectedBlock.id, (block) => ({ ...block, visible: !block.visible }))} aria-label="Alternar visibilidade"><i /></button></div>
                </div>
                <div className="inspector-section">
                  <div className="inspector-section-heading"><h3>Layout</h3><span>⌄</span></div>
                  <label className="field-label">Largura</label>
                  <div className="segmented-control"><button className="chosen">Automática</button><button>Preencher</button></div>
                  <label className="field-label spaced">Alinhamento</label>
                  <div className="align-control"><button>≡</button><button className="chosen">☰</button><button>≣</button><button>⋮</button></div>
                </div>
                <div className="inspector-section compact-section">
                  <div className="inspector-section-heading"><h3>Avançado</h3><span>›</span></div>
                </div>
                <button className="delete-component" onClick={() => removeBlock(selectedBlock.id)}>⌫ <span>Remover componente</span></button>
              </>
            ) : (
              <div className="empty-inspector"><span>▱</span><strong>Selecione um componente</strong><p>Escolha um item na prévia para editar suas propriedades.</p></div>
            )}
            <div className="inspector-footnote"><span>ⓘ</span> Componentes Moovin preservam funcionalidades nativas quando conectados à loja.</div>
          </aside>
        </div>
      </main>
    </div>
  );
}

type ProductCanvasProps = {
  blocks: Block[];
  device: "desktop" | "mobile";
  selectedId?: string;
  setSelectedId?: (id: string) => void;
  onMove?: (sourceId: string, targetId: string) => void;
  draggedId?: string | null;
  setDraggedId?: (id: string | null) => void;
};

function ProductCanvas({
  blocks,
  device,
  selectedId,
  setSelectedId,
  onMove,
  draggedId,
  setDraggedId,
}: ProductCanvasProps) {
  return (
    <div className={`preview-frame ${device === "mobile" ? "mobile-frame" : ""}`}>
      <div className="store-preview-top"><span className="store-preview-logo">VÉRTICE</span><div className="store-preview-links"><span>Novidades</span><span>Feminino</span><span>Masculino</span><span>Outlet</span></div><div className="store-preview-tools"><span>⌕</span><span>♙</span><span>♧</span></div></div>
      <div className="store-preview-breadcrumb">Início <span>/</span> Calçados <span>/</span> Tênis Urban Move</div>
      <div className="product-layout">
        <div className="product-column gallery-column">
          {blocks.filter((block) => block.type === "gallery" && block.visible).map((block) => (
            <PreviewBlock key={block.id} block={block} selected={selectedId === block.id} setSelectedId={setSelectedId} onMove={onMove} draggedId={draggedId} setDraggedId={setDraggedId} className="gallery-block">
              <div className="product-image-wrap"><span className="product-tag">MAIS VENDIDO</span><img src={productPhoto} alt="Tênis vermelho Urban Move" /><button className="image-favorite">♡</button></div>
              <div className="product-thumbnails"><span className="thumb active"><img src={productPhoto} alt="" /></span><span className="thumb"><img src={productPhoto} alt="" /></span><span className="thumb"><img src={productPhoto} alt="" /></span><span className="thumb"><img src={productPhoto} alt="" /></span></div>
            </PreviewBlock>
          ))}
        </div>
        <div className="product-column detail-column">
          {blocks.filter((block) => block.type !== "gallery" && block.visible).map((block) => (
            <PreviewBlock key={block.id} block={block} selected={selectedId === block.id} setSelectedId={setSelectedId} onMove={onMove} draggedId={draggedId} setDraggedId={setDraggedId}>
              {renderProductComponent(block.type)}
            </PreviewBlock>
          ))}
        </div>
      </div>
      <div className="store-preview-bottom"><span>Compra 100% segura</span><span>Frete grátis acima de R$ 299</span><span>Até 10x sem juros</span></div>
    </div>
  );
}

type PreviewBlockProps = {
  block: Block;
  selected: boolean;
  setSelectedId?: (id: string) => void;
  onMove?: (sourceId: string, targetId: string) => void;
  draggedId?: string | null;
  setDraggedId?: (id: string | null) => void;
  className?: string;
  children: React.ReactNode;
};

function PreviewBlock({
  block,
  selected,
  setSelectedId,
  onMove,
  draggedId,
  setDraggedId,
  className = "",
  children,
}: PreviewBlockProps) {
  return (
    <div
      className={`preview-block ${selected ? "block-selected" : ""} ${draggedId === block.id ? "block-dragging" : ""} ${className}`}
      onClick={(event) => { event.stopPropagation(); setSelectedId?.(block.id); }}
      draggable={Boolean(setDraggedId)}
      onDragStart={() => setDraggedId?.(block.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); if (draggedId) onMove?.(draggedId, block.id); setDraggedId?.(null); }}
      onDragEnd={() => setDraggedId?.(null)}
    >
      {selected && <span className="block-handle" title="Arraste para reorganizar">⠿</span>}
      {children}
    </div>
  );
}

function renderProductComponent(type: BlockType) {
  switch (type) {
    case "title":
      return <><div className="product-kicker">VÉRTICE · RUNNING</div><h2 className="product-title">Tênis Urban Move<br />Unissex</h2><div className="rating-line"><span>★★★★★</span><b>4.9</b><small>(128 avaliações)</small></div></>;
    case "price":
      return <div className="price-area"><div><strong>R$ 349,90</strong><span className="old-price">R$ 429,90</span><span className="discount-chip">−19%</span></div><p>ou <b>10x de R$ 34,99</b> sem juros</p><a href="#pix">R$ 332,41 no Pix <span>5% OFF</span></a></div>;
    case "description":
      return <div className="description-area"><strong>Leveza para acompanhar seu ritmo.</strong><p>Conforto e estilo para todos os momentos. Conheça o novo Urban Move.</p><button>Ver descrição completa <span>⌄</span></button></div>;
    case "variants":
      return <div className="variant-area"><div className="variant-heading"><strong>Cor: <span>Vermelho</span></strong><a href="#guide">Guia de tamanhos</a></div><div className="color-swatches"><button className="swatch active-swatch" /><button className="swatch dark-swatch" /><button className="swatch sand-swatch" /></div><div className="variant-heading size-heading"><strong>Tamanho</strong><a href="#size">Não sei meu tamanho</a></div><div className="size-options"><button>38</button><button>39</button><button className="size-selected">40</button><button>41</button><button>42</button><button>43</button></div></div>;
    case "quantity":
      return <div className="quantity-row"><span>Quantidade</span><div className="quantity-input"><button>−</button><b>1</b><button>＋</button></div></div>;
    case "buyButton":
      return <button className="buy-button"><span>ADICIONAR À SACOLA</span><b>→</b></button>;
    case "shipping":
      return <div className="shipping-area"><span>⌁</span><div><strong>Calcule o frete e prazo</strong><p>Entrega para todo o Brasil</p></div><a href="#shipping">Calcular</a></div>;
    case "trust":
      return <div className="trust-row"><span>♧ Compra segura</span><span>↺ Troca fácil</span></div>;
    case "gallery":
      return null;
  }
}

export default App;
