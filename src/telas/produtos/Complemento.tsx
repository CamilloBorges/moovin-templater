import { useState } from "react";
import { EditorTexto } from "../../componentes/EditorTexto";
import { precoPorUnidade, textoUnidade, type Aba, type ComplementoProduto, type ModeloCadastro, type TipoAba, type UnidadeConteudo } from "../../templater/produto";
import { aplicarModelo, modeloPadrao, novaAba } from "../../produtos/modelos";
import { Campo, Numero, Secao, Texto } from "./campos";

// Resumo, descrição da página, conteúdo da embalagem e abas: o que a Moovin não tem.
// Gravados no nosso servidor (MongoDB); a página da loja os busca pelo SKU.

// Abas do produto: as do cadastro (título fixo, vindo de "Abas e modelos") e as avulsas (título livre).
function ListaAbas({ abas, tipos, modelos, erros, aoMudar }: {
  abas: Aba[];
  tipos: TipoAba[];
  modelos: ModeloCadastro[];
  erros: Map<number, string>;
  aoMudar: (abas: Aba[]) => void;
}) {
  // Muda quando a lista muda de forma (ordem, inclusão por modelo), para os editores remontarem com o conteúdo da nova posição.
  const [ordem, setOrdem] = useState(0);
  const [modeloId, setModeloId] = useState(() => modeloPadrao(modelos)?.id ?? modelos[0]?.id ?? "");
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
  const adicionar = (valor: string) => {
    if (valor === "avulsa") return aoMudar([...abas, { titulo: "", conteudo: "" }]);
    const tipo = tipos.find((t) => t.id === valor);
    if (tipo) aoMudar([...abas, novaAba(tipo)]);
  };
  const modelo = modelos.find((m) => m.id === modeloId);
  const disponiveis = tipos.filter((t) => !abas.some((a) => a.tipo === t.id));

  return (
    <div className="itens-aba">
      {modelos.length > 0 && (
        <div className="aplicar-modelo">
          <select className="entrada" value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
            {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.padrao ? " (padrão)" : ""}</option>)}
          </select>
          <button type="button" className="button button-secondary" disabled={!modelo} title="Acrescenta as abas do modelo que faltam e põe na ordem do modelo, sem apagar o que já foi escrito"
            onClick={() => modelo && reordenar(aplicarModelo(abas, modelo, tipos))}>
            Aplicar modelo
          </button>
          <small className="campo-dica">Acrescenta as abas do modelo que faltam, na ordem do modelo. Nada do que já foi escrito é apagado; as abas fora do modelo vão para o fim.</small>
        </div>
      )}
      {abas.map((aba, i) => {
        const tipo = aba.tipo ? tipos.find((t) => t.id === aba.tipo) : undefined;
        return (
          <div className={`aba-complemento${erros.has(i) ? " com-erro" : ""}`} key={`${ordem}-${i}`}>
            <div className="item-aba-topo">
              <span className="item-aba-numero">{String(i + 1).padStart(2, "0")}</span>
              {tipo ? (
                <span className="item-modelo-titulo" title="Aba do cadastro: o título muda em Abas e modelos">
                  {tipo.titulo}
                  {tipo.obrigatoria && <span className="selo-obrigatoria">obrigatória</span>}
                  <span className="selo-cadastro">cadastro</span>
                </span>
              ) : (
                <Texto valor={aba.titulo} aoMudar={(titulo) => alterar(i, { titulo })} placeholder="Título da aba avulsa (ex.: Dicas do chef)" />
              )}
              <button type="button" className="botao-icone" title="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>↑</button>
              <button type="button" className="botao-icone" title="Descer" disabled={i === abas.length - 1} onClick={() => mover(i, 1)}>↓</button>
              <button type="button" className="botao-icone perigo" title="Remover aba" onClick={() => reordenar(abas.filter((_, j) => j !== i))}>×</button>
            </div>
            {tipo?.instrucao && <small className="campo-dica">{tipo.instrucao}</small>}
            <EditorTexto valor={aba.conteudo} aoMudar={(conteudo) => alterar(i, { conteudo })} />
            {erros.has(i) && <small className="campo-erro">Aba obrigatória: preencha o conteúdo.</small>}
          </div>
        );
      })}
      <select className="entrada seletor-adicionar" value="" onChange={(e) => e.target.value && adicionar(e.target.value)}>
        <option value="">+ Adicionar aba…</option>
        {disponiveis.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
        <option value="avulsa">Aba avulsa (só deste produto)</option>
      </select>
    </div>
  );
}

export function SecoesComplemento({ complemento, preco, migrar, tipos, modelos, errosAbas, modeloAplicado, aoMudar }: {
  complemento: ComplementoProduto;
  preco: number;
  migrar: boolean;
  tipos: TipoAba[];
  modelos: ModeloCadastro[];
  errosAbas: Map<number, string>;
  modeloAplicado: string | null; // nome do modelo padrão aplicado ao abrir um produto sem Complemento
  aoMudar: (c: ComplementoProduto) => void;
}) {
  const alterar = (parcial: Partial<ComplementoProduto>) => aoMudar({ ...complemento, ...parcial });
  const conteudo = complemento.conteudoComercial;
  const referencia = precoPorUnidade(preco, conteudo);

  return (
    <>
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
        {modeloAplicado && <p className="aviso">Produto novo no Templater: as abas do modelo padrão "{modeloAplicado}" já foram incluídas. Confira antes de salvar.</p>}
        <ListaAbas abas={complemento.abas} tipos={tipos} modelos={modelos} erros={errosAbas} aoMudar={(abas) => alterar({ abas })} />
      </Secao>

    </>
  );
}
