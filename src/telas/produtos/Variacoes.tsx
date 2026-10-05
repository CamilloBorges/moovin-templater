import { useState } from "react";
import { atributosVariacao } from "../../produtos/catalogo";
import { novaVariacao, type ProdutoCadastro, type Referencia, type Variacao } from "../../produtos/modelo";
import { Campo, CampoReferencia, Numero, Secao, Texto } from "./campos";

// Como no botão "Gerar código" da Moovin: um código numérico de 13 dígitos.
export const gerarSku = () => String(Date.now());

export function SecaoVariacoes({ produto, alterar, erros }: {
  produto: ProdutoCadastro;
  alterar: (parcial: Partial<ProdutoCadastro>) => void;
  erros: Record<string, string>;
}) {
  const [novoAtributo, setNovoAtributo] = useState<Referencia | null>(null);
  const variacoes = produto.variacoes;
  const alterarVariacao = (i: number, parcial: Partial<Variacao>) =>
    alterar({ variacoes: variacoes.map((v, j) => (j === i ? { ...v, ...parcial } : v)) });

  function ligarVariacoes(ligar: boolean) {
    // Ao desligar, fica só a primeira variação, sem atributos (produto simples).
    if (ligar) alterar({ possuiVariacoes: true });
    else alterar({ possuiVariacoes: false, atributosVariacao: [], variacoes: [{ ...variacoes[0], atributos: {} }] });
  }

  function adicionarAtributo(atributo: Referencia | null) {
    setNovoAtributo(null);
    if (!atributo || produto.atributosVariacao.some((a) => a.id === atributo.id)) return;
    alterar({ atributosVariacao: [...produto.atributosVariacao, atributo] });
  }

  function removerAtributo(id: string) {
    alterar({
      atributosVariacao: produto.atributosVariacao.filter((a) => a.id !== id),
      variacoes: variacoes.map((v) => {
        const { [id]: _, ...resto } = v.atributos;
        return { ...v, atributos: resto };
      }),
    });
  }

  const unica = variacoes[0];

  return (
    <Secao titulo="Variação do produto">
      <label className="caixa-marcacao">
        <input type="checkbox" checked={produto.possuiVariacoes} onChange={(e) => ligarVariacoes(e.target.checked)} />
        Este produto possui variações, como tamanhos ou cores diferentes.
      </label>

      {!produto.possuiVariacoes ? (
        <div className="linha-campos">
          <Campo rotulo="SKU" obrigatorio erro={erros["sku-0"]}>
            <span className="entrada-com-botao">
              <Texto valor={unica.sku} aoMudar={(sku) => alterarVariacao(0, { sku })} />
              <button type="button" className="button button-secondary" onClick={() => alterarVariacao(0, { sku: gerarSku() })}>
                Gerar código
              </button>
            </span>
          </Campo>
          <Campo rotulo="Cód. de barras" dica="13 dígitos, único por variação">
            <Texto valor={unica.codigoBarras} aoMudar={(codigoBarras) => alterarVariacao(0, { codigoBarras })} />
          </Campo>
          <Campo rotulo="Ref. fabricante (MPN)">
            <Texto valor={unica.mpn} aoMudar={(mpn) => alterarVariacao(0, { mpn })} />
          </Campo>
          <Campo rotulo="Estoque" logus>
            <Numero valor={unica.estoque} aoMudar={(estoque) => alterarVariacao(0, { estoque })} />
          </Campo>
        </div>
      ) : (
        <>
          <div className="atributos">
            <span className="campo-rotulo">Atributos que variam</span>
            <div className="fichas">
              {produto.atributosVariacao.map((a) => (
                <span className="ficha" key={a.id}>
                  {a.nome}
                  <button type="button" title={`Remover ${a.nome}`} onClick={() => removerAtributo(a.id)}>×</button>
                </span>
              ))}
              <CampoReferencia
                key={produto.atributosVariacao.length}
                opcoes={atributosVariacao}
                valor={novoAtributo}
                aoMudar={adicionarAtributo}
                placeholder="Adicionar atributo (ex.: Peso, Corte)"
              />
            </div>
          </div>

          <div className="tabela-rolagem">
            <table className="tabela-variacoes">
              <thead>
                <tr>
                  {produto.atributosVariacao.map((a) => <th key={a.id}>{a.nome}</th>)}
                  <th>SKU *</th>
                  <th>Cód. de barras</th>
                  <th>MPN</th>
                  <th>Estoque</th>
                  <th>Preço</th>
                  <th>Promocional</th>
                  <th>Custo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {variacoes.map((v, i) => (
                  <tr key={i} className={erros[`sku-${i}`] ? "com-erro" : ""}>
                    {produto.atributosVariacao.map((a) => (
                      <td key={a.id}>
                        <Texto valor={v.atributos[a.id] ?? ""} aoMudar={(valor) => alterarVariacao(i, { atributos: { ...v.atributos, [a.id]: valor } })} />
                      </td>
                    ))}
                    <td>
                      <span className="entrada-com-botao">
                        <Texto valor={v.sku} aoMudar={(sku) => alterarVariacao(i, { sku })} />
                        <button type="button" className="botao-icone" title="Gerar código" onClick={() => alterarVariacao(i, { sku: String(Date.now() + i) })}>#</button>
                      </span>
                    </td>
                    <td><Texto valor={v.codigoBarras} aoMudar={(codigoBarras) => alterarVariacao(i, { codigoBarras })} /></td>
                    <td><Texto valor={v.mpn} aoMudar={(mpn) => alterarVariacao(i, { mpn })} /></td>
                    <td><Numero valor={v.estoque} aoMudar={(estoque) => alterarVariacao(i, { estoque })} /></td>
                    <td><Numero valor={v.preco.venda} passo={0.01} aoMudar={(venda) => alterarVariacao(i, { preco: { ...v.preco, venda } })} /></td>
                    <td><Numero valor={v.preco.promocional} passo={0.01} aoMudar={(promocional) => alterarVariacao(i, { preco: { ...v.preco, promocional } })} /></td>
                    <td><Numero valor={v.preco.custo} passo={0.01} aoMudar={(custo) => alterarVariacao(i, { preco: { ...v.preco, custo } })} /></td>
                    <td>
                      <button
                        type="button"
                        className="botao-icone perigo"
                        title="Remover variação"
                        disabled={variacoes.length === 1}
                        onClick={() => alterar({ variacoes: variacoes.filter((_, j) => j !== i) })}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Object.entries(erros).filter(([k]) => k.startsWith("sku-") || k.startsWith("promo-")).map(([k, msg]) => (
            <small className="campo-erro" key={k}>{msg}</small>
          ))}
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              // A nova variação herda medidas e prazo da última, como ponto de partida.
              const ultima = variacoes[variacoes.length - 1];
              alterar({ variacoes: [...variacoes, { ...novaVariacao(), dimensoes: ultima.dimensoes, prazoExtraDias: ultima.prazoExtraDias }] });
            }}
          >
            + Adicionar variação
          </button>
        </>
      )}
    </Secao>
  );
}
