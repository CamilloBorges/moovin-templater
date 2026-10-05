import { useId, useState, type ReactNode } from "react";
import { gerarUrl, type Referencia } from "../../produtos/modelo";

// Peças de formulário da tela de produto, no visual do painel Moovin.

export function Secao({ titulo, descricao, children, extra }: { titulo: string; descricao?: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="secao">
      <header className="secao-cabecalho">
        <div>
          <h2>{titulo}</h2>
          {descricao && <p>{descricao}</p>}
        </div>
        {extra}
      </header>
      {children}
    </section>
  );
}

export function Campo({ rotulo, obrigatorio, logus, dica, erro, children }: {
  rotulo: string;
  obrigatorio?: boolean;
  logus?: boolean;
  dica?: string;
  erro?: string;
  children: ReactNode;
}) {
  return (
    <label className={erro ? "campo com-erro" : "campo"}>
      <span className="campo-rotulo">
        {rotulo}
        {obrigatorio && " *"}
        {logus && (
          <span className="selo-logus" title="O Logus também atualiza este campo a cada ~30 min; uma alteração aqui pode ser sobrescrita.">
            Logus
          </span>
        )}
      </span>
      {children}
      {erro ? <small className="campo-erro">{erro}</small> : dica && <small className="campo-dica">{dica}</small>}
    </label>
  );
}

export function Texto({ valor, aoMudar, ...resto }: { valor: string; aoMudar: (v: string) => void; placeholder?: string; maxLength?: number }) {
  return <input className="entrada" value={valor} onChange={(e) => aoMudar(e.target.value)} {...resto} />;
}

export function Numero({ valor, aoMudar, unidade, passo = 1 }: { valor: number; aoMudar: (v: number) => void; unidade?: string; passo?: number }) {
  const entrada = (
    <input
      className="entrada"
      type="number"
      min={0}
      step={passo}
      value={Number.isFinite(valor) ? valor : 0}
      onChange={(e) => aoMudar(e.target.value === "" ? 0 : Number(e.target.value))}
    />
  );
  if (!unidade) return entrada;
  return (
    <span className="entrada-com-unidade">
      {unidade === "R$" && <b>{unidade}</b>}
      {entrada}
      {unidade !== "R$" && <b>{unidade}</b>}
    </span>
  );
}

export function Alternador({ ligado, aoMudar, rotulo }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} className="alternador" onClick={() => aoMudar(!ligado)}>
      <i className={ligado ? "ligado" : ""} />
      {rotulo}
    </button>
  );
}

// Escolhe um item da lista ou cria um novo pelo nome digitado ("Selecione ou crie…", como na Moovin).
// Itens criados aqui ficam com id "nova:…" até a integração criá-los na Moovin.
export function CampoReferencia({ opcoes, valor, aoMudar, placeholder, rotuloDe = (r) => r.nome }: {
  opcoes: Referencia[];
  valor: Referencia | null;
  aoMudar: (r: Referencia | null) => void;
  placeholder: string;
  rotuloDe?: (r: Referencia) => string;
}) {
  const lista = useId();
  const [texto, setTexto] = useState(valor ? rotuloDe(valor) : "");
  const [editando, setEditando] = useState(false);
  const mostrado = editando ? texto : valor ? rotuloDe(valor) : "";

  function confirmar() {
    setEditando(false);
    const nome = texto.trim();
    if (!nome) return aoMudar(null);
    const existente = opcoes.find((o) => rotuloDe(o).toLowerCase() === nome.toLowerCase() || o.nome.toLowerCase() === nome.toLowerCase());
    aoMudar(existente ?? { id: `nova:${gerarUrl(nome)}`, nome });
  }

  return (
    <span className="referencia">
      <input
        className="entrada"
        list={lista}
        placeholder={placeholder}
        value={mostrado}
        onFocus={() => { setTexto(valor ? rotuloDe(valor) : ""); setEditando(true); }}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
      />
      {valor?.id.startsWith("nova:") && <span className="selo-nova" title="Será criada na Moovin ao salvar, na etapa de integração">nova</span>}
      <datalist id={lista}>
        {opcoes.map((o) => <option key={o.id} value={rotuloDe(o)} />)}
      </datalist>
    </span>
  );
}
