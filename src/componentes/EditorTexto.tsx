import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

// Editor de texto formatado (Tiptap, o mesmo do Puck). Grava HTML: negrito, itálico, sublinhado,
// títulos, listas e links. O valor inicial só é lido na montagem; para trocar de conteúdo, mude a `key`.
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
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false, link: { openOnClick: false } })],
    content: valor,
    onUpdate: ({ editor }) => aoMudarAtual.current(editor.isEmpty ? "" : editor.getHTML()),
  });
  const ativo = useEditorState({
    editor,
    selector: ({ editor }) => ({
      negrito: editor.isActive("bold"),
      italico: editor.isActive("italic"),
      sublinhado: editor.isActive("underline"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      lista: editor.isActive("bulletList"),
      numerada: editor.isActive("orderedList"),
      link: editor.isActive("link"),
      caracteres: editor.getText().length,
    }),
  });
  const [link, setLink] = useState<string | null>(null);

  const botao = (rotulo: string, titulo: string, marcado: boolean, acao: () => void) => (
    <button type="button" title={titulo} className={marcado ? "marcado" : ""} onMouseDown={(e) => e.preventDefault()} onClick={acao}>
      {rotulo}
    </button>
  );

  function aplicarLink() {
    const url = (link ?? "").trim();
    const cadeia = editor.chain().focus().extendMarkRange("link");
    if (url) cadeia.setLink({ href: url }).run();
    else cadeia.unsetLink().run();
    setLink(null);
  }

  return (
    <div className="editor-texto">
      <div className="editor-texto-barra">
        {botao("N", "Negrito", ativo.negrito, () => editor.chain().focus().toggleBold().run())}
        {botao("I", "Itálico", ativo.italico, () => editor.chain().focus().toggleItalic().run())}
        {botao("S", "Sublinhado", ativo.sublinhado, () => editor.chain().focus().toggleUnderline().run())}
        {titulos && botao("T2", "Título", ativo.h2, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        {titulos && botao("T3", "Subtítulo", ativo.h3, () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
        {botao("•", "Lista", ativo.lista, () => editor.chain().focus().toggleBulletList().run())}
        {botao("1.", "Lista numerada", ativo.numerada, () => editor.chain().focus().toggleOrderedList().run())}
        {botao("Link", "Link", ativo.link, () => setLink(editor.getAttributes("link").href ?? ""))}
        {contarCaracteres && <span className="editor-texto-contador">{ativo.caracteres} caracteres</span>}
      </div>
      {link !== null && (
        <div className="editor-texto-link">
          <input
            autoFocus
            placeholder="https://… (vazio remove o link)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); aplicarLink(); }
              if (e.key === "Escape") setLink(null);
            }}
          />
          <button type="button" onClick={aplicarLink}>Aplicar</button>
          <button type="button" onClick={() => setLink(null)}>Cancelar</button>
        </div>
      )}
      <EditorContent editor={editor} className="editor-texto-area" />
    </div>
  );
}
