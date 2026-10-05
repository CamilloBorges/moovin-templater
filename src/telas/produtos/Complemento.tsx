import { useState } from "react";
import DOMPurify from "dompurify";
import { EditorTexto } from "../../componentes/EditorTexto";
import { montarDescricao } from "../../produtos/descricao";
import { precoPorUnidade, type Aba, type ComplementoProduto, type UnidadeConteudo } from "../../templater/produto";
import { Campo, Numero, Secao, Texto } from "./campos";

// Resumo, conteúdo da embalagem e abas: campos separados aqui, gravados juntos na descrição do
// produto na Moovin (convenção em produtos/descricao.ts), onde a IA de atendimento também lê.

function ListaAbas({ abas, aoMudar }: { abas: Aba[]; aoMudar: (abas: Aba[]) => void }) {
  // Muda só quando a ordem muda, para os editores remontarem com o conteúdo da nova posição.
  const [ordem, setOrdem] = useState(0);
  const alterar = (i: number, parcial: Partial<Aba>) => aoMudar(abas.map((aba, j) => (j === i ? { ...aba, ...parcial } : aba)));
  const reordenar = (novas: Aba[]) => {
    setOrdem((o) => o + 1);
    aoMudar(novas);
  };
  const mover = (i: number, d: number) => {
    const novas = [...abas];
    [novas[i], novas[i + d]] = [novas[i + d], novas[i]];
    reordenar(novas);
  };
  return (
    <div className="itens-aba">
      {abas.map((aba, i) => (
        <div className="aba-complemento" key={`${ordem}-${i}`}>
          <div className="item-aba-topo">
            <span className="item-aba-numero">{String(i + 1).padStart(2, "0")}</span>
            <Texto valor={aba.titulo} aoMudar={(titulo) => alterar(i, { titulo })} placeholder="Título da aba (ex.: Preparo)" />
            <button type="button" className="botao-icone" title="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>↑</button>
            <button type="button" className="botao-icone" title="Descer" disabled={i === abas.length - 1} onClick={() => mover(i, 1)}>↓</button>
            <button type="button" className="botao-icone perigo" title="Remover aba" onClick={() => reordenar(abas.filter((_, j) => j !== i))}>×</button>
          </div>
          <EditorTexto valor={aba.conteudo} aoMudar={(conteudo) => alterar(i, { conteudo })} />
        </div>
      ))}
      <button type="button" className="button button-secondary" onClick={() => aoMudar([...abas, { titulo: "", conteudo: "" }])}>
        + Adicionar aba
      </button>
    </div>
  );
}

export function SecoesComplemento({ complemento, preco, formatoAntigo, aoMudar }: {
  complemento: ComplementoProduto;
  preco: number;
  formatoAntigo: boolean;
  aoMudar: (c: ComplementoProduto) => void;
}) {
  const alterar = (parcial: Partial<ComplementoProduto>) => aoMudar({ ...complemento, ...parcial });
  const conteudo = complemento.conteudoComercial;
  const referencia = precoPorUnidade(preco, conteudo);

  return (
    <>
      <div className="divisor-complemento">
        <h2>Descrição do produto</h2>
        <p>
          Vira a descrição do produto na Moovin: o resumo no começo e cada aba como um Título, com o conteúdo abaixo.
          É o texto que a página, a IA de atendimento e os feeds (Google e Meta) usam.
        </p>
      </div>

      {formatoAntigo && (
        <p className="aviso">
          A descrição está no formato antigo (MODO NOVO / @). Ao salvar uma alteração aqui, ela é reescrita no formato novo.
          Atenção: a loja ainda usa o Script_Produto V3, que só entende o formato antigo; até o script novo entrar no ar,
          o produto convertido aparece com o layout padrão da Moovin.
        </p>
      )}

      <Secao titulo="Resumo do produto" descricao="Texto curto exibido ao lado das imagens.">
        <EditorTexto valor={complemento.resumo} titulos={false} aoMudar={(resumo) => alterar({ resumo })} />
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

      <Secao
        titulo="Abas da página"
        descricao="Quantas abas forem necessárias, na ordem em que devem aparecer. O template define onde elas ficam e o visual."
      >
        <ListaAbas abas={complemento.abas} aoMudar={(abas) => alterar({ abas })} />
      </Secao>

      <details className="secao previa-descricao">
        <summary>Ver a descrição como ela fica na Moovin</summary>
        <div className="tpl-aba-conteudo" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(montarDescricao(complemento)) }} />
      </details>
    </>
  );
}
