import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontFamily, TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { CharacterCount } from "@tiptap/extensions";

// Editor de HTML com os mesmos recursos do editor de descrição da Moovin (também Tiptap):
// títulos, negrito, itálico, sublinhado, tachado, sobrescrito/subscrito, cor, marca-texto, fonte,
// alinhamento, listas, citação, código, linha, link e imagem por endereço. Sem tabelas nem vídeo,
// como na Moovin. O valor inicial só é lido na montagem; para trocar de conteúdo, mude a `key`.

const FONTES = [
  { rotulo: "Fonte padrão", valor: "" },
  { rotulo: "Serifada (Georgia)", valor: "Georgia, serif" },
  { rotulo: "Sem serifa (Arial)", valor: "Arial, sans-serif" },
];

type Janela = { tipo: "link" | "imagem"; valor: string } | null;

export function EditorTexto({
  valor,
  aoMudar,
  titulos = true,
  contarCaracteres = false,
}: {
  valor: string;
  aoMudar: (html: string) => void;
  titulos?: boolean;
  contarCaracteres?: boolean;
}) {
  const aoMudarAtual = useRef(aoMudar);
  aoMudarAtual.current = aoMudar;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: false, allowBase64: false }),
      Subscript,
      Superscript,
      CharacterCount,
    ],
    content: valor,
    onUpdate: ({ editor }) => aoMudarAtual.current(editor.isEmpty ? "" : editor.getHTML()),
  });
  const ativo = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bloco: editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : editor.isActive("heading", { level: 4 }) ? "h4" : "p",
      negrito: editor.isActive("bold"),
      italico: editor.isActive("italic"),
      sublinhado: editor.isActive("underline"),
      tachado: editor.isActive("strike"),
      sobrescrito: editor.isActive("superscript"),
      subscrito: editor.isActive("subscript"),
      alinhamento: (["left", "center", "right", "justify"] as const).find((a) => editor.isActive({ textAlign: a })) ?? "left",
      lista: editor.isActive("bulletList"),
      numerada: editor.isActive("orderedList"),
      citacao: editor.isActive("blockquote"),
      codigo: editor.isActive("codeBlock"),
      link: editor.isActive("link"),
      cor: (editor.getAttributes("textStyle").color as string | undefined) ?? "#000000",
      fonte: (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
      caracteres: editor.storage.characterCount.characters() as number,
      podeDesfazer: editor.can().undo(),
      podeRefazer: editor.can().redo(),
    }),
  });
  const [janela, setJanela] = useState<Janela>(null);

  const cadeia = () => editor.chain().focus();
  const botao = (rotulo: string, titulo: string, marcado: boolean, acao: () => void, desabilitado = false) => (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      className={marcado ? "marcado" : ""}
      disabled={desabilitado}
      onMouseDown={(e) => e.preventDefault()}
      onClick={acao}
    >
      {rotulo}
    </button>
  );

  function aplicarJanela() {
    if (!janela) return;
    const url = janela.valor.trim();
    if (janela.tipo === "link") {
      if (url) cadeia().extendMarkRange("link").setLink({ href: url }).run();
      else cadeia().extendMarkRange("link").unsetLink().run();
    } else if (/^https?:\/\//.test(url)) {
      cadeia().setImage({ src: url }).run();
    }
    setJanela(null);
  }

  function mudarBloco(bloco: string) {
    if (bloco === "p") cadeia().setParagraph().run();
    else cadeia().setHeading({ level: Number(bloco.slice(1)) as 2 | 3 | 4 }).run();
  }

  return (
    <div className="editor-texto">
      <div className="editor-texto-barra">
        {titulos && (
          <select value={ativo.bloco} title="Tipo de texto" onChange={(e) => mudarBloco(e.target.value)}>
            <option value="p">Parágrafo</option>
            <option value="h2">Título</option>
            <option value="h3">Subtítulo</option>
            <option value="h4">Título menor</option>
          </select>
        )}
        <select value={ativo.fonte} title="Fonte" onChange={(e) => (e.target.value ? cadeia().setFontFamily(e.target.value).run() : cadeia().unsetFontFamily().run())}>
          {FONTES.map((f) => <option key={f.rotulo} value={f.valor}>{f.rotulo}</option>)}
        </select>
        <span className="separador" />
        {botao("N", "Negrito", ativo.negrito, () => cadeia().toggleBold().run())}
        {botao("I", "Itálico", ativo.italico, () => cadeia().toggleItalic().run())}
        {botao("S", "Sublinhado", ativo.sublinhado, () => cadeia().toggleUnderline().run())}
        {botao("T̶", "Tachado", ativo.tachado, () => cadeia().toggleStrike().run())}
        {botao("x²", "Sobrescrito", ativo.sobrescrito, () => cadeia().toggleSuperscript().run())}
        {botao("x₂", "Subscrito", ativo.subscrito, () => cadeia().toggleSubscript().run())}
        <label className="editor-texto-cor" title="Cor do texto">
          A<input type="color" value={ativo.cor} onChange={(e) => cadeia().setColor(e.target.value).run()} />
        </label>
        <label className="editor-texto-cor marca" title="Marca-texto">
          ▮<input type="color" defaultValue="#fff3a3" onChange={(e) => cadeia().setHighlight({ color: e.target.value }).run()} />
        </label>
        {botao("⌫", "Limpar formatação", false, () => cadeia().unsetAllMarks().clearNodes().run())}
        <span className="separador" />
        {botao("⯇", "Alinhar à esquerda", ativo.alinhamento === "left", () => cadeia().setTextAlign("left").run())}
        {botao("≡", "Centralizar", ativo.alinhamento === "center", () => cadeia().setTextAlign("center").run())}
        {botao("⯈", "Alinhar à direita", ativo.alinhamento === "right", () => cadeia().setTextAlign("right").run())}
        {botao("☰", "Justificar", ativo.alinhamento === "justify", () => cadeia().setTextAlign("justify").run())}
        <span className="separador" />
        {botao("•", "Lista", ativo.lista, () => cadeia().toggleBulletList().run())}
        {botao("1.", "Lista numerada", ativo.numerada, () => cadeia().toggleOrderedList().run())}
        {botao("❝", "Citação", ativo.citacao, () => cadeia().toggleBlockquote().run())}
        {botao("</>", "Bloco de código", ativo.codigo, () => cadeia().toggleCodeBlock().run())}
        {botao("—", "Linha horizontal", false, () => cadeia().setHorizontalRule().run())}
        <span className="separador" />
        {botao("Link", "Link", ativo.link, () => setJanela({ tipo: "link", valor: editor.getAttributes("link").href ?? "" }))}
        {botao("Imagem", "Imagem por endereço", false, () => setJanela({ tipo: "imagem", valor: "" }))}
        <span className="separador" />
        {botao("↶", "Desfazer", false, () => cadeia().undo().run(), !ativo.podeDesfazer)}
        {botao("↷", "Refazer", false, () => cadeia().redo().run(), !ativo.podeRefazer)}
        {contarCaracteres && <span className="editor-texto-contador">{ativo.caracteres} caracteres</span>}
      </div>
      {janela && (
        <div className="editor-texto-link">
          <input
            autoFocus
            placeholder={janela.tipo === "link" ? "https://… (vazio remove o link)" : "Endereço da imagem (https://…)"}
            value={janela.valor}
            onChange={(e) => setJanela({ ...janela, valor: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); aplicarJanela(); }
              if (e.key === "Escape") setJanela(null);
            }}
          />
          <button type="button" onClick={aplicarJanela}>{janela.tipo === "link" ? "Aplicar" : "Inserir"}</button>
          <button type="button" onClick={() => setJanela(null)}>Cancelar</button>
        </div>
      )}
      <EditorContent editor={editor} className="editor-texto-area" />
    </div>
  );
}
