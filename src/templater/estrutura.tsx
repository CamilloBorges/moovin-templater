import type { ReactNode } from "react";
import { ActionBar, createUsePuck } from "@puckeditor/core";
import { config, nomeDoBloco } from "./config";

// O Puck mostra sempre o rótulo do tipo de bloco. Estes dois substitutos mostram o "Nome do bloco".

const usePuck = createUsePuck<typeof config>();

type Item = { type: string; props: Record<string, any> };

function Itens({ itens, nivel }: { itens: Item[]; nivel: number }) {
  const selecionado = usePuck((s) => s.selectedItem?.props.id);
  const dispatch = usePuck((s) => s.dispatch);
  const getSelectorForId = usePuck((s) => s.getSelectorForId);
  return (
    <ul className="estrutura-lista">
      {itens.map((item) => {
        const campos = config.components[item.type as keyof typeof config.components]?.fields ?? {};
        const slots = Object.entries(campos).filter(([, campo]) => campo.type === "slot");
        return (
          <li key={item.props.id}>
            <button
              type="button"
              className={item.props.id === selecionado ? "estrutura-item selecionado" : "estrutura-item"}
              style={{ paddingLeft: 10 + nivel * 16 }}
              onClick={() => dispatch({ type: "setUi", ui: { itemSelector: getSelectorForId(item.props.id) } })}
            >
              {nomeDoBloco(item.type, item.props.nome)}
            </button>
            {slots.map(([chave, campo]) => (
              <div key={chave}>
                <span className="estrutura-area" style={{ paddingLeft: 10 + (nivel + 1) * 16 }}>{campo.label}</span>
                <Itens itens={item.props[chave] ?? []} nivel={nivel + 1} />
              </div>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

export function Estrutura() {
  const conteudo = usePuck((s) => s.appState.data.content) as Item[];
  return (
    <div className="estrutura">
      {conteudo.length ? <Itens itens={conteudo} nivel={0} /> : <p className="estrutura-vazia">Nenhum bloco</p>}
    </div>
  );
}

export function BarraDeAcoes({ label, children, parentAction }: { label?: string; children: ReactNode; parentAction: ReactNode }) {
  const nome = usePuck((s) => s.selectedItem?.props.nome as string | undefined);
  return (
    <ActionBar>
      <ActionBar.Group>
        {parentAction}
        {label && <ActionBar.Label label={nome?.trim() || label} />}
      </ActionBar.Group>
      <ActionBar.Group>{children}</ActionBar.Group>
    </ActionBar>
  );
}
