import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ConteudoBadge } from "../../templater/blocos";
import type { Badge } from "../../templater/produto";
import { Secao } from "./campos";

// Badges do produto: os escolhidos, na ordem em que aparecem na página (arrastar para
// reordenar; pelo teclado, ← e →), e os disponíveis (um clique adiciona ao final).
// O arraste é por eventos de ponteiro (mouse, toque e caneta): o HTML5 draggable não funciona
// em tela de toque.

// Move o item da posição `de` para a posição `para`.
export function mover<T>(lista: T[], de: number, para: number): T[] {
  if (de === para || de < 0 || de >= lista.length) return lista;
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(Math.max(0, Math.min(para, nova.length)), 0, item);
  return nova;
}

export function BadgesDoProduto({ selecionados, todos, aoMudar }: { selecionados: string[]; todos: Badge[]; aoMudar: (ids: string[]) => void }) {
  const [arraste, setArraste] = useState<{ de: number; dx: number; dy: number } | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  // Estado do arraste em ref: o soltar pode vir antes de o React redesenhar com o último destino.
  const inicio = useRef<{ de: number; x: number; y: number; ativo: boolean; alvo: number } | null>(null);
  const itens = useRef<(HTMLLIElement | null)[]>([]);
  const caixas = useRef<DOMRect[]>([]); // posições de antes do arraste (o item arrastado segue o ponteiro)
  const porId = new Map(todos.map((b) => [b.id, b]));
  const escolhidos = selecionados.filter((id) => porId.has(id));
  const disponiveis = todos.filter((b) => !selecionados.includes(b.id));

  // Posição de destino: o item (na posição de antes do arraste) mais próximo do ponteiro.
  function posicaoSob(x: number, y: number) {
    let melhor = 0, menor = Infinity;
    caixas.current.forEach((c, i) => {
      const d = Math.hypot(x - (c.left + c.width / 2), y - (c.top + c.height / 2));
      if (d < menor) { menor = d; melhor = i; }
    });
    return melhor;
  }

  function pressionar(e: PointerEvent<HTMLLIElement>, i: number) {
    if ((e.target as HTMLElement).closest("button") || e.button !== 0) return; // o × não arrasta
    inicio.current = { de: i, x: e.clientX, y: e.clientY, ativo: false, alvo: i };
    try {
      e.currentTarget.setPointerCapture(e.pointerId); // o arraste continua mesmo se o ponteiro sair do badge
    } catch {
      /* ponteiro já liberado: segue sem captura */
    }
  }

  function arrastar(e: PointerEvent<HTMLLIElement>) {
    const s = inicio.current;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.ativo && Math.hypot(dx, dy) < 5) return; // pequeno tremor não é arraste
    if (!s.ativo) caixas.current = itens.current.slice(0, escolhidos.length).map((el) => el!.getBoundingClientRect());
    s.ativo = true;
    s.alvo = posicaoSob(e.clientX, e.clientY);
    setArraste({ de: s.de, dx, dy });
    setAlvo(s.alvo);
  }

  function soltar() {
    const s = inicio.current;
    inicio.current = null;
    if (s?.ativo) aoMudar(mover(escolhidos, s.de, s.alvo));
    setArraste(null);
    setAlvo(null);
  }

  function teclado(e: KeyboardEvent<HTMLElement>, i: number) {
    const destino = e.key === "ArrowLeft" ? i - 1 : e.key === "ArrowRight" ? i + 1 : null;
    if (destino === null || destino < 0 || destino >= escolhidos.length) return;
    e.preventDefault();
    aoMudar(mover(escolhidos, i, destino));
    // Mantém o foco no badge que foi movido.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-badge-ordem="${destino}"]`)?.focus());
  }

  return (
    <Secao titulo="Badges" descricao="Selos exibidos pelo bloco Badges do template. Arraste para mudar a ordem (ou use ← e → no badge selecionado).">
      {todos.length === 0 ? (
        <p className="campo-dica">Nenhum badge cadastrado. <a href="#/badges">Cadastrar badges</a></p>
      ) : (
        <>
          <div className="campo">
            <span className="campo-rotulo">Na página, nesta ordem</span>
            {escolhidos.length === 0 ? (
              <small className="campo-dica">Nenhum badge neste produto. Clique nos disponíveis abaixo para adicionar.</small>
            ) : (
              <ol className="badges-ordem">
                {escolhidos.map((id, i) => {
                  const b = porId.get(id)!;
                  return (
                    <li
                      key={id}
                      ref={(el) => { itens.current[i] = el; }}
                      data-badge-ordem={i}
                      className={`badge-opcao marcado arrastavel${arraste?.de === i ? " arrastando" : ""}${arraste && alvo === i && arraste.de !== i ? (alvo < arraste.de ? " alvo-antes" : " alvo-depois") : ""}`}
                      style={arraste?.de === i ? { transform: `translate(${arraste.dx}px, ${arraste.dy}px)` } : undefined}
                      tabIndex={0}
                      title={b.tooltip || b.nome}
                      aria-label={`${b.nome}, posição ${i + 1} de ${escolhidos.length}`}
                      onPointerDown={(e) => pressionar(e, i)}
                      onPointerMove={arrastar}
                      onPointerUp={soltar}
                      onPointerCancel={soltar}
                      onKeyDown={(e) => teclado(e, i)}
                    >
                      <span className="alca" aria-hidden="true">⋮⋮</span>
                      <b>{i + 1}</b>
                      <ConteudoBadge badge={b} tamanho={32} />
                      <span>{b.nome}</span>
                      <button type="button" className="botao-icone perigo" title={`Tirar ${b.nome} deste produto`} onClick={() => aoMudar(escolhidos.filter((x) => x !== id))}>×</button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          {disponiveis.length > 0 && (
            <div className="campo">
              <span className="campo-rotulo">Disponíveis</span>
              <div className="badges-escolha">
                {disponiveis.map((b) => (
                  <button key={b.id} type="button" className="badge-opcao" title={b.tooltip || b.nome} onClick={() => aoMudar([...escolhidos, b.id])}>
                    <span className="mais" aria-hidden="true">+</span>
                    <ConteudoBadge badge={b} tamanho={32} />
                    <span>{b.nome}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Secao>
  );
}
