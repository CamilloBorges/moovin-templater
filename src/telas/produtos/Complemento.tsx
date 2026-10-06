import { useState } from "react";
import { EditorTexto } from "../../componentes/EditorTexto";
import { precoPorUnidade, textoUnidade, type Aba, type ComplementoProduto, type UnidadeConteudo } from "../../templater/produto";
import { Campo, Numero, Secao, Texto } from "./campos";

// Resumo, descrição da página, conteúdo da embalagem e abas: o que a Moovin não tem.
// Gravados no nosso servidor (MongoDB); a página da loja os busca pelo SKU.

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

export function SecoesComplemento({ complemento, preco, migrar, aoMudar }: {
  complemento: ComplementoProduto;
  preco: number;
  migrar: boolean;
  aoMudar: (c: ComplementoProduto) => void;
}) {
  const alterar = (parcial: Partial<ComplementoProduto>) => aoMudar({ ...complemento, ...parcial });
  const conteudo = complemento.conteudoComercial;
  const referencia = precoPorUnidade(preco, conteudo);

  return (
    <>
      <div className="divisor-complemento">
        <h2>Complemento do cadastro</h2>
        <p>
          O que a página da loja mostra além dos campos da Moovin. Fica guardado no Templater (não na Moovin); a descrição
          da Moovin recebe o texto para a IA, no topo desta página.
        </p>
      </div>

      {migrar && (
        <p className="aviso">
          Este produto ainda não tem Complemento no Templater: os campos abaixo foram lidos da descrição da Moovin. Ao salvar,
          eles passam para o Templater e a descrição da Moovin é trocada pelo texto para a IA. Confira antes de salvar.
        </p>
      )}

      <Secao titulo="Resumo do produto" descricao="Texto curto exibido ao lado das imagens.">
        <EditorTexto valor={complemento.resumo} titulos={false} aoMudar={(resumo) => alterar({ resumo })} />
      </Secao>

      <Secao titulo="Descrição do produto" descricao="Texto principal da página da loja.">
        <EditorTexto valor={complemento.descricao} aoMudar={(descricao) => alterar({ descricao })} />
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
              <Campo rotulo="Abaixo do preço, na página">
                <output className="valor-calculado">{textoUnidade(conteudo) ?? "—"}</output>
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

    </>
  );
}
