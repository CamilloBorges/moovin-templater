import { useState } from "react";
import { EditorTexto } from "../../componentes/EditorTexto";
import { abasDoTemplate, templatePublicado } from "../../templater/padrao";
import { precoPorUnidade, type ComplementoProduto, type ItemAba, type UnidadeConteudo } from "../../templater/produto";
import { Campo, Numero, Secao, Texto } from "./campos";

// Campos que não existem na Moovin e alimentam a página de produto do Templater.

function ItensAba({ itens, aoMudar }: { itens: ItemAba[]; aoMudar: (itens: ItemAba[]) => void }) {
  // Muda só quando a ordem muda, para os editores remontarem com o conteúdo da nova posição.
  const [ordem, setOrdem] = useState(0);
  const alterar = (i: number, parcial: Partial<ItemAba>) => aoMudar(itens.map((item, j) => (j === i ? { ...item, ...parcial } : item)));
  const reordenar = (novo: ItemAba[]) => {
    setOrdem((o) => o + 1);
    aoMudar(novo);
  };
  const mover = (i: number, d: number) => {
    const novo = [...itens];
    [novo[i], novo[i + d]] = [novo[i + d], novo[i]];
    reordenar(novo);
  };
  return (
    <div className="itens-aba">
      {itens.map((item, i) => (
        <div className="item-aba" key={`${ordem}-${i}`}>
          <div className="item-aba-topo">
            <span className="item-aba-numero">{String(i + 1).padStart(2, "0")}</span>
            <Texto valor={item.titulo} aoMudar={(titulo) => alterar(i, { titulo })} placeholder="Título do item" />
            <button type="button" className="botao-icone" title="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>↑</button>
            <button type="button" className="botao-icone" title="Descer" disabled={i === itens.length - 1} onClick={() => mover(i, 1)}>↓</button>
            <button type="button" className="botao-icone perigo" title="Remover item" onClick={() => reordenar(itens.filter((_, j) => j !== i))}>×</button>
          </div>
          <EditorTexto valor={item.texto} titulos={false} aoMudar={(texto) => alterar(i, { texto })} />
        </div>
      ))}
      <button type="button" className="button button-plain" onClick={() => aoMudar([...itens, { titulo: "", texto: "" }])}>
        + Adicionar item
      </button>
    </div>
  );
}

export function SecoesComplemento({ complemento, preco, aoMudar }: {
  complemento: ComplementoProduto;
  preco: number;
  aoMudar: (c: ComplementoProduto) => void;
}) {
  const alterar = (parcial: Partial<ComplementoProduto>) => aoMudar({ ...complemento, ...parcial });
  const [remocoes, setRemocoes] = useState(0); // remonta as abas extras após remover uma
  const abasTemplate = abasDoTemplate(templatePublicado());
  const camposSemAba = Object.keys(complemento.campos).filter(
    (campo) => complemento.campos[campo].length > 0 && !abasTemplate.some((a) => a.campo === campo),
  );
  const conteudo = complemento.conteudoComercial;
  const referencia = precoPorUnidade(preco, conteudo);

  return (
    <>
      <div className="divisor-complemento">
        <h2>Complemento do cadastro</h2>
        <p>Informações que não existem na Moovin e montam a página de produto do Templater.</p>
      </div>

      <Secao titulo="Resumo do produto" descricao="Texto curto exibido ao lado das imagens.">
        <textarea className="entrada" rows={4} value={complemento.resumo} onChange={(e) => alterar({ resumo: e.target.value })} />
      </Secao>

      <Secao titulo="Conteúdo comercial" descricao="Quanto vem em cada unidade vendida. Usado para mostrar o preço por kg, litro ou unidade.">
        <div className="linha-campos">
          <Campo rotulo="Informar conteúdo">
            <select
              className="entrada"
              value={conteudo ? "sim" : "nao"}
              onChange={(e) => alterar({ conteudoComercial: e.target.value === "sim" ? { quantidade: 1, unidade: "kg" } : null })}
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </Campo>
          {conteudo && (
            <>
              <Campo rotulo="Quantidade">
                <Numero valor={conteudo.quantidade} passo={0.001} aoMudar={(quantidade) => alterar({ conteudoComercial: { ...conteudo, quantidade } })} />
              </Campo>
              <Campo rotulo="Unidade">
                <select
                  className="entrada"
                  value={conteudo.unidade}
                  onChange={(e) => alterar({ conteudoComercial: { ...conteudo, unidade: e.target.value as UnidadeConteudo } })}
                >
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="l">L</option>
                  <option value="un">un</option>
                </select>
              </Campo>
              <Campo rotulo="Preço de referência">
                <output className="valor-calculado">{referencia ?? "—"}</output>
              </Campo>
            </>
          )}
        </div>
      </Secao>

      <Secao titulo="Abas da página" descricao="As abas vêm do template publicado. Aba sem itens não aparece na página.">
        {abasTemplate.length === 0 && <p className="vazio">O template publicado não tem abas de detalhes.</p>}
        {abasTemplate.map((aba) => (
          <div className="aba-complemento" key={aba.campo}>
            <h3>{aba.titulo} <small>campo "{aba.campo}"</small></h3>
            <ItensAba
              itens={complemento.campos[aba.campo] ?? []}
              aoMudar={(itens) => alterar({ campos: { ...complemento.campos, [aba.campo]: itens } })}
            />
          </div>
        ))}
        {camposSemAba.length > 0 && (
          <p className="aviso">
            Este produto tem conteúdo em campos que o template publicado não usa: {camposSemAba.join(", ")}. Ele fica guardado, mas não aparece na página.
          </p>
        )}
      </Secao>

      <Secao titulo="Abas extras" descricao="Abas só deste produto, exibidas depois das abas do template (se o template permitir).">
        {complemento.abasExtras.map((aba, i) => {
          const alterarAba = (parcial: Partial<typeof aba>) =>
            alterar({ abasExtras: complemento.abasExtras.map((a, j) => (j === i ? { ...a, ...parcial } : a)) });
          return (
            <div className="aba-complemento" key={`${remocoes}-${i}`}>
              <div className="item-aba-topo">
                <Texto valor={aba.titulo} aoMudar={(titulo) => alterarAba({ titulo })} placeholder="Título da aba" />
                <button
                  type="button"
                  className="botao-icone perigo"
                  title="Remover aba"
                  onClick={() => {
                    setRemocoes((r) => r + 1);
                    alterar({ abasExtras: complemento.abasExtras.filter((_, j) => j !== i) });
                  }}
                >
                  ×
                </button>
              </div>
              <ItensAba itens={aba.itens} aoMudar={(itens) => alterarAba({ itens })} />
            </div>
          );
        })}
        <button
          type="button"
          className="button button-secondary"
          onClick={() => alterar({ abasExtras: [...complemento.abasExtras, { titulo: "", itens: [] }] })}
        >
          + Adicionar aba extra
        </button>
      </Secao>
    </>
  );
}
