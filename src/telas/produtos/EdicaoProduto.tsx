import { useState } from "react";
import { Render } from "@puckeditor/core";
import { EditorTexto } from "../../componentes/EditorTexto";
import { caminhoDaCategoria, categorias, caracteristicas, marcas } from "../../produtos/catalogo";
import { gerarUrl, type ProdutoCadastro, type Variacao } from "../../produtos/modelo";
import type { RepositorioProdutos } from "../../produtos/repositorio";
import { config } from "../../templater/config";
import { templatePublicado } from "../../templater/padrao";
import { formatarMoeda, paraTemplate } from "../../templater/produto";
import { Alternador, Campo, CampoReferencia, Numero, Secao, Texto } from "./campos";
import { SecoesComplemento } from "./Complemento";
import { SecaoImagens } from "./Imagens";
import { SecaoVariacoes } from "./Variacoes";

const LOJA = "https://shoptest.bomgado.com";

function validar(p: ProdutoCadastro): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!p.nome.trim()) erros.nome = "Informe o nome do produto";
  if (!p.marca) erros.marca = "Informe a marca";
  const skus = p.variacoes.map((v) => v.sku.trim());
  p.variacoes.forEach((v, i) => {
    // Com variações, a mensagem diz qual linha da tabela tem o problema.
    const msg = (texto: string) => (p.possuiVariacoes ? `Variação ${i + 1}: ${texto}` : texto[0].toUpperCase() + texto.slice(1));
    if (!skus[i]) erros[`sku-${i}`] = msg("informe o SKU");
    else if (skus.indexOf(skus[i]) !== i) erros[`sku-${i}`] = msg("SKU repetido; ele é único por variação");
    if (v.preco.promocional > 0 && v.preco.promocional >= v.preco.venda)
      erros[`promo-${i}`] = msg("o preço promocional precisa ser menor que o preço do produto");
  });
  return erros;
}

function PreviaPagina({ produto, fechar }: { produto: ProdutoCadastro; fechar: () => void }) {
  return (
    <div className="previa-fundo" role="dialog" aria-label="Prévia da página do produto">
      <div className="previa-janela">
        <header>
          <strong>Prévia com o template publicado</strong>
          <button type="button" className="button button-secondary" onClick={fechar}>Fechar</button>
        </header>
        <div className="previa-conteudo">
          <Render config={config} data={templatePublicado()} metadata={{ produto: paraTemplate(produto) }} />
        </div>
      </div>
    </div>
  );
}

export function EdicaoProduto({ inicial, repositorio, voltar }: {
  inicial: ProdutoCadastro;
  repositorio: RepositorioProdutos;
  voltar: () => void;
}) {
  const [salvo, setSalvo] = useState(inicial);
  const [produto, setProduto] = useState(inicial);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [previa, setPrevia] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [aviso, setAviso] = useState("");
  // Remonta os editores de texto ao descartar alterações (eles só leem o valor ao montar).
  const [versao, setVersao] = useState(0);

  const alterar = (parcial: Partial<ProdutoCadastro>) => { setProduto((p) => ({ ...p, ...parcial })); setAviso(""); };
  const alterarTodas = (parcial: Partial<Variacao>) => alterar({ variacoes: produto.variacoes.map((v) => ({ ...v, ...parcial })) });
  const alterarUnica = (parcial: Partial<Variacao>) => alterar({ variacoes: produto.variacoes.map((v, i) => (i === 0 ? { ...v, ...parcial } : v)) });

  const erros = validar(produto);
  const errosVisiveis = mostrarErros ? erros : {};
  const alterado = JSON.stringify(produto) !== JSON.stringify(salvo);
  const unica = produto.variacoes[0];
  const precoEfetivo = unica.preco.promocional || unica.preco.venda;
  const lucro = precoEfetivo - unica.preco.custo;
  const margem = precoEfetivo > 0 && unica.preco.custo > 0 ? (lucro / precoEfetivo) * 100 : null;
  const dimensoes = unica.dimensoes;
  const semDimensoes = Object.values(dimensoes).some((v) => !v);
  const prazo = unica.prazoExtraDias;
  const [prazoPersonalizado, setPrazoPersonalizado] = useState(prazo > 5);
  const caracteristicasDaCategoria = caracteristicas.filter((c) => produto.categoriaPrincipal && c.categorias.includes(produto.categoriaPrincipal.id));
  const url = gerarUrl(produto.seo.url) || gerarUrl(produto.nome);

  function salvar() {
    if (Object.keys(erros).length) {
      setMostrarErros(true);
      setAviso("Corrija os campos destacados antes de salvar.");
      return;
    }
    const final = { ...produto, seo: { ...produto.seo, url } };
    repositorio.salvar(final);
    setProduto(final);
    setSalvo(final);
    setMostrarErros(false);
    setAviso("Produto salvo.");
    if (location.hash === "#/produtos/novo") location.hash = `#/produtos/${final.id}`;
  }

  function descartar() {
    setProduto(salvo);
    setVersao((v) => v + 1);
    setMostrarErros(false);
    setAviso("");
  }

  return (
    <>
      <header className="topbar">
        <div className="breadcrumbs">
          <a href="#/produtos">Produtos</a><b>/</b><strong>{produto.nome || "Novo produto"}</strong>
        </div>
        <div className="heading-actions">
          {aviso && <span className="save-indicator">{aviso}</span>}
          {!aviso && alterado && <span className="save-indicator"><span className="status-dot amber" />Alterações não salvas</span>}
          <button className="button button-plain" onClick={() => setPrevia(true)}>Prévia da página</button>
          <button className="button button-secondary" disabled={!alterado} onClick={descartar}>Descartar</button>
          <button className="button button-primary" onClick={salvar}>Salvar</button>
        </div>
      </header>

      <div className="pagina-produto" key={versao}>
        {mostrarErros && Object.keys(erros).length > 0 && (
          <div className="caixa-erros">
            <strong>Não foi possível salvar:</strong>
            <ul>{Object.values(erros).map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}

        <Secao titulo="Informações principais" extra={<Alternador ligado={produto.ativo} aoMudar={(ativo) => alterar({ ativo })} rotulo={produto.ativo ? "Ativo" : "Inativo"} />}>
          <Campo rotulo="Nome do produto" obrigatorio logus erro={errosVisiveis.nome}>
            <Texto valor={produto.nome} aoMudar={(nome) => alterar({ nome })} />
          </Campo>
          <div className="campo">
            <span className="campo-rotulo">Descrição do produto</span>
            <EditorTexto valor={produto.descricao} contarCaracteres aoMudar={(descricao) => alterar({ descricao })} />
          </div>
        </Secao>

        <Secao titulo="Organização">
          <div className="linha-campos">
            <Campo rotulo="Categoria principal" logus>
              <CampoReferencia
                opcoes={categorias}
                valor={produto.categoriaPrincipal}
                rotuloDe={(c) => caminhoDaCategoria(c.id) || c.nome}
                placeholder="Selecione ou crie uma nova categoria"
                aoMudar={(categoriaPrincipal) =>
                  alterar(categoriaPrincipal ? { categoriaPrincipal } : { categoriaPrincipal: null, categoriasAdicionais: [] })
                }
              />
            </Campo>
            <Campo rotulo="Marca" obrigatorio erro={errosVisiveis.marca}>
              <CampoReferencia opcoes={marcas} valor={produto.marca} placeholder="Selecione ou crie uma nova marca" aoMudar={(marca) => alterar({ marca })} />
            </Campo>
          </div>
          <div className="campo">
            <span className="campo-rotulo">Mais categorias</span>
            {produto.categoriaPrincipal ? (
              <div className="fichas">
                {produto.categoriasAdicionais.map((c) => (
                  <span className="ficha" key={c.id}>
                    {caminhoDaCategoria(c.id) || c.nome}
                    <button type="button" title="Remover categoria" onClick={() => alterar({ categoriasAdicionais: produto.categoriasAdicionais.filter((x) => x.id !== c.id) })}>×</button>
                  </span>
                ))}
                <CampoReferencia
                  key={produto.categoriasAdicionais.length}
                  opcoes={categorias.filter((c) => c.id !== produto.categoriaPrincipal?.id && !produto.categoriasAdicionais.some((x) => x.id === c.id))}
                  valor={null}
                  rotuloDe={(c) => caminhoDaCategoria(c.id) || c.nome}
                  placeholder="Vincular mais categorias"
                  aoMudar={(c) => c && c.id !== produto.categoriaPrincipal?.id && alterar({ categoriasAdicionais: [...produto.categoriasAdicionais, c] })}
                />
              </div>
            ) : (
              <small className="campo-dica">Escolha a categoria principal para vincular outras.</small>
            )}
          </div>
        </Secao>

        <SecaoVariacoes produto={produto} alterar={alterar} erros={errosVisiveis} />

        {!produto.possuiVariacoes && (
          <Secao titulo="Preços" descricao="Com o preço zerado, a loja mostra o botão “Preço sob consulta”.">
            <div className="linha-campos">
              <Campo rotulo="Preço do produto" logus>
                <Numero unidade="R$" passo={0.01} valor={unica.preco.venda} aoMudar={(venda) => alterarUnica({ preco: { ...unica.preco, venda } })} />
              </Campo>
              <Campo rotulo="Preço promocional" erro={errosVisiveis["promo-0"]}>
                <Numero unidade="R$" passo={0.01} valor={unica.preco.promocional} aoMudar={(promocional) => alterarUnica({ preco: { ...unica.preco, promocional } })} />
              </Campo>
              <Campo rotulo="Preço de custo">
                <Numero unidade="R$" passo={0.01} valor={unica.preco.custo} aoMudar={(custo) => alterarUnica({ preco: { ...unica.preco, custo } })} />
              </Campo>
              <Campo rotulo="Margem">
                <output className="valor-calculado">{margem === null ? "—" : `${margem.toFixed(2).replace(".", ",")} %`}</output>
              </Campo>
              <Campo rotulo="Lucro">
                <output className="valor-calculado">{unica.preco.custo > 0 ? formatarMoeda(lucro) : "—"}</output>
              </Campo>
            </div>
            {unica.preco.venda === 0 && <p className="aviso">Preço zerado: a loja vai mostrar “Preço sob consulta”.</p>}
          </Secao>
        )}

        <Secao
          titulo="Dimensões da embalagem"
          descricao={`Usadas para calcular o frete.${produto.possuiVariacoes ? " Valem para todas as variações." : ""}`}
        >
          <div className="linha-campos">
            <Campo rotulo="Peso"><Numero unidade="g" valor={dimensoes.pesoG} aoMudar={(pesoG) => alterarTodas({ dimensoes: { ...dimensoes, pesoG } })} /></Campo>
            <Campo rotulo="Altura"><Numero unidade="cm" valor={dimensoes.alturaCm} aoMudar={(alturaCm) => alterarTodas({ dimensoes: { ...dimensoes, alturaCm } })} /></Campo>
            <Campo rotulo="Largura"><Numero unidade="cm" valor={dimensoes.larguraCm} aoMudar={(larguraCm) => alterarTodas({ dimensoes: { ...dimensoes, larguraCm } })} /></Campo>
            <Campo rotulo="Profundidade"><Numero unidade="cm" valor={dimensoes.profundidadeCm} aoMudar={(profundidadeCm) => alterarTodas({ dimensoes: { ...dimensoes, profundidadeCm } })} /></Campo>
            <Campo rotulo="Disponibilidade da entrega">
              <select
                className="entrada"
                value={prazoPersonalizado ? "p" : String(prazo)}
                onChange={(e) => {
                  const personalizado = e.target.value === "p";
                  setPrazoPersonalizado(personalizado);
                  if (!personalizado) alterarTodas({ prazoExtraDias: Number(e.target.value) });
                }}
              >
                <option value="0">Imediata</option>
                {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} {d === 1 ? "dia útil" : "dias úteis"}</option>)}
                <option value="p">Personalizada</option>
              </select>
            </Campo>
            {prazoPersonalizado && (
              <Campo rotulo="Dias a mais para enviar">
                <Numero unidade="dias" valor={prazo} aoMudar={(prazoExtraDias) => alterarTodas({ prazoExtraDias })} />
              </Campo>
            )}
          </div>
          {semDimensoes && <p className="aviso">A Moovin exige todas as dimensões para calcular o frete.</p>}
        </Secao>

        <SecaoImagens produto={produto} alterar={alterar} />

        <Secao titulo="Características do produto">
          {caracteristicasDaCategoria.length === 0 ? (
            <p className="vazio">Você não possui características relacionadas a esta categoria.</p>
          ) : (
            <div className="linha-campos">
              {caracteristicasDaCategoria.map((c) => (
                <Campo rotulo={c.nome} key={c.id}>
                  {c.tipo === "lista" ? (
                    <select className="entrada" value={produto.caracteristicas[c.id] ?? ""} onChange={(e) => alterar({ caracteristicas: { ...produto.caracteristicas, [c.id]: e.target.value } })}>
                      <option value="">—</option>
                      {c.valores.map((v) => <option key={v}>{v}</option>)}
                    </select>
                  ) : (
                    <Texto valor={produto.caracteristicas[c.id] ?? ""} aoMudar={(v) => alterar({ caracteristicas: { ...produto.caracteristicas, [c.id]: v } })} />
                  )}
                </Campo>
              ))}
            </div>
          )}
        </Secao>

        <Secao titulo="SEO" descricao="Como o produto aparece no Google. Em branco, a loja usa o nome e a descrição.">
          <Campo rotulo="Meta title" dica={`${produto.seo.titulo.length}/70 caracteres`}>
            <Texto valor={produto.seo.titulo} maxLength={70} placeholder={produto.nome} aoMudar={(titulo) => alterar({ seo: { ...produto.seo, titulo } })} />
          </Campo>
          <Campo rotulo="URL do produto" dica={`${LOJA}/${url}/p`}>
            <Texto valor={produto.seo.url} placeholder={gerarUrl(produto.nome)} aoMudar={(v) => alterar({ seo: { ...produto.seo, url: v } })} />
          </Campo>
          <Campo rotulo="Meta description" dica={`${produto.seo.descricao.length}/160 caracteres`}>
            <textarea className="entrada" rows={3} maxLength={160} value={produto.seo.descricao} onChange={(e) => alterar({ seo: { ...produto.seo, descricao: e.target.value } })} />
          </Campo>
        </Secao>

        <Secao titulo="Visibilidade" extra={<Alternador ligado={produto.visivelApenasPorLink} aoMudar={(visivelApenasPorLink) => alterar({ visivelApenasPorLink })} rotulo="Visível apenas por link" />}>
          <p className="campo-dica">
            Quando ativado, o produto não aparece na busca, categorias, vitrines e listagens da loja, nem nos feeds de integração (Google Shopping e Meta Shopping). Só pode ser acessado pelo link direto.
          </p>
          <p className="link-produto">Link do produto: <a href={`${LOJA}/${url}/p`} target="_blank" rel="noreferrer">{`${LOJA}/${url}/p`}</a></p>
        </Secao>

        <SecoesComplemento complemento={produto.complemento} preco={precoEfetivo} aoMudar={(complemento) => alterar({ complemento })} />

        <div className="zona-perigo">
          {confirmarExclusao ? (
            <>
              <span>Excluir este produto? Esta ação não pode ser desfeita.</span>
              <button type="button" className="button button-secondary" onClick={() => setConfirmarExclusao(false)}>Cancelar</button>
              <button type="button" className="button botao-perigo" onClick={() => { repositorio.excluir(produto.id); voltar(); }}>Excluir</button>
            </>
          ) : (
            <button type="button" className="button button-plain perigo" onClick={() => setConfirmarExclusao(true)}>Excluir produto</button>
          )}
        </div>
      </div>

      {previa && <PreviaPagina produto={produto} fechar={() => setPrevia(false)} />}
    </>
  );
}
