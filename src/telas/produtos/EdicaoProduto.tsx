import { useEffect, useState, type ReactNode } from "react";
import { ErroApi } from "../../api";
import { carregarCatalogo, type Catalogo } from "../../produtos/catalogo";
import type { ProdutoCadastro, Variacao } from "../../produtos/modelo";
import { carregarProduto, salvarProduto, type Original } from "../../produtos/moovin";
import { templatePublicado, type TemplateData } from "../../templater/padrao";
import { formatarMoeda, paraTemplate, URL_LOJA as LOJA, type Badge, type MapaCortes, type ModeloCadastro, type TipoAba } from "../../templater/produto";
import { listarMapas } from "../../produtos/mapas";
import { MapaCorteDoProduto } from "./MapaCorteDoProduto";
import { aplicarModelo, listarModelos, listarTiposAba, modeloDaCategoria, obrigatoriasVazias, sincronizarTitulos } from "../../produtos/modelos";
import { listarBadges } from "../../produtos/badges";
import { Alternador, Campo, CampoReferencia, Numero, Secao, Texto } from "./campos";
import { SecoesComplemento } from "./Complemento";
import { SecaoImagens } from "./Imagens";
import { SecaoVariacoes } from "./Variacoes";
import { BadgesDoProduto } from "./BadgesDoProduto";
import { PreviaPagina } from "../../componentes/PreviaPagina";
import { EditorTexto } from "../../componentes/EditorTexto";
import { descricaoParaIa } from "../../produtos/descricao";


function validar(p: ProdutoCadastro, tipos: TipoAba[]): Record<string, string> {
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
  // Mapa de Corte ativado precisa do animal e do corte.
  const mapaCorte = p.complemento.mapaCorte;
  if (mapaCorte && (!mapaCorte.mapa || !mapaCorte.corte)) erros["mapa-corte"] = "Mapa de Corte: escolha o animal e o corte (ou desative)";
  // Abas obrigatórias do cadastro sem conteúdo (Campos Complementares).
  obrigatoriasVazias(p.complemento.abas, tipos).forEach((titulo, i) => { erros[`aba-${i}`] = `Aba "${titulo}": obrigatória, preencha o conteúdo`; });
  return erros;
}

// Erros das abas, por posição, para a lista de abas destacar.
const errosDasAbas = (erros: Record<string, string>) =>
  new Map(Object.entries(erros).filter(([campo]) => campo.startsWith("aba-")).map(([campo, texto]) => [Number(campo.slice(4)), texto]));

function PreviaProduto({ produto, badges, mapas, fechar }: { produto: ProdutoCadastro; badges: Badge[]; mapas: MapaCortes[]; fechar: () => void }) {
  const [template, setTemplate] = useState<TemplateData | null>(null);
  useEffect(() => { templatePublicado().then(setTemplate); }, []);
  return <PreviaPagina titulo="Prévia com o template publicado" template={template} produto={paraTemplate(produto, badges, mapas)} fechar={fechar} />;
}

// Grupo recolhível da tela do produto (Campos do Moovin / Campos Complementares).
function Grupo({ titulo, descricao, aberto, aoAlternar, children }: {
  titulo: string;
  descricao: string;
  aberto: boolean;
  aoAlternar: (aberto: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details className="grupo-campos" open={aberto} onToggle={(e) => aoAlternar(e.currentTarget.open)}>
      <summary>
        <strong>{titulo}</strong>
        <small>{descricao}</small>
      </summary>
      <div className="grupo-conteudo">{children}</div>
    </details>
  );
}

// Carrega o produto da Moovin (com o complemento) e o catálogo de apoio.
export function EdicaoProduto({ id }: { id: string }) {
  const [dados, setDados] = useState<{ original: Original; catalogo: Catalogo; badges: Badge[]; tipos: TipoAba[]; modelos: ModeloCadastro[]; mapas: MapaCortes[] } | null>(null);
  const [erro, setErro] = useState("");
  const [carga, setCarga] = useState(0);
  const [mensagem, setMensagem] = useState(""); // resultado do último salvamento, mostrado após reler
  useEffect(() => {
    setErro("");
    setDados(null); // o formulário só monta de novo com o produto relido
    Promise.all([
      carregarProduto(id),
      carregarCatalogo(),
      listarBadges().catch(() => [] as Badge[]),
      listarTiposAba().catch(() => [] as TipoAba[]),
      listarModelos().catch(() => [] as ModeloCadastro[]),
      listarMapas().catch(() => [] as MapaCortes[]),
    ]).then(
      ([original, catalogo, badges, tipos, modelos, mapas]) => {
        // Abas do cadastro com o título atual (renomeado em Abas e modelos), sem contar como alteração.
        const complemento = { ...original.cadastro.complemento, abas: sincronizarTitulos(original.cadastro.complemento.abas, tipos) };
        setDados({ original: { ...original, cadastro: { ...original.cadastro, complemento } }, catalogo, badges, tipos, modelos, mapas });
      },
      (e) => setErro(e instanceof ErroApi && e.status === 404 ? "Produto não encontrado na Moovin." : `Não foi possível carregar o produto: ${e.message}`),
    );
  }, [id, carga]);
  if (erro) return <div className="pagina-produto"><p className="caixa-erros">{erro} <a href="#/produtos">Voltar à lista</a></p></div>;
  if (!dados) return <div className="pagina-produto"><p className="vazio">Carregando o produto da Moovin…</p></div>;
  return (
    <FormularioProduto
      key={carga}
      original={dados.original}
      catalogo={dados.catalogo}
      todosBadges={dados.badges}
      tipos={dados.tipos}
      modelos={dados.modelos}
      mapas={dados.mapas}
      avisoInicial={mensagem}
      recarregar={(texto) => { setMensagem(texto); setCarga((c) => c + 1); }}
    />
  );
}

function FormularioProduto({ original, catalogo, todosBadges, tipos, modelos, mapas, avisoInicial, recarregar }: {
  original: Original;
  catalogo: Catalogo;
  todosBadges: Badge[];
  tipos: TipoAba[];
  modelos: ModeloCadastro[];
  mapas: MapaCortes[];
  avisoInicial: string;
  recarregar: (mensagem: string) => void;
}) {
  const salvo = original.cadastro;
  // Produto ainda sem Complemento no Templater: já começa com o texto para a IA gerado e com as
  // abas do modelo padrão (aproveitando as que vieram da descrição da Moovin).
  // O modelo da categoria principal (ou da categoria acima, ou o padrão geral).
  const escolhido = original.migrar ? modeloDaCategoria(modelos, salvo.categoriaPrincipal?.id, catalogo.categorias) : null;
  const padrao = escolhido?.modelo ?? null;
  const [produto, setProduto] = useState(() => {
    if (!original.migrar) return salvo;
    const abas = padrao ? aplicarModelo(salvo.complemento.abas, padrao, tipos) : salvo.complemento.abas;
    const comModelo = { ...salvo, complemento: { ...salvo.complemento, abas } };
    return { ...comModelo, descricao: descricaoParaIa(comModelo) };
  });
  const [mostrarErros, setMostrarErros] = useState(false);
  const [previa, setPrevia] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");
  const [aviso, setAviso] = useState(avisoInicial);
  const [moovinAberto, setMoovinAberto] = useState(false);
  const [complementaresAberto, setComplementaresAberto] = useState(true);
  // Remonta os editores de texto ao descartar alterações (eles só leem o valor ao montar).
  const [versao, setVersao] = useState(0);

  const alterar = (parcial: Partial<ProdutoCadastro>) => { setProduto((p) => ({ ...p, ...parcial })); setAviso(""); };
  const alterarTodas = (parcial: Partial<Variacao>) => alterar({ variacoes: produto.variacoes.map((v) => ({ ...v, ...parcial })) });
  const alterarUnica = (parcial: Partial<Variacao>) => alterar({ variacoes: produto.variacoes.map((v, i) => (i === 0 ? { ...v, ...parcial } : v)) });

  const erros = validar(produto, tipos);
  const errosVisiveis = mostrarErros ? erros : {};
  const alterado = original.migrar || JSON.stringify(produto) !== JSON.stringify(salvo);
  const unica = produto.variacoes[0];
  const precoEfetivo = unica.preco.promocional || unica.preco.venda;
  const lucro = precoEfetivo - unica.preco.custo;
  const margem = precoEfetivo > 0 && unica.preco.custo > 0 ? (lucro / precoEfetivo) * 100 : null;
  const dimensoes = unica.dimensoes;
  const semDimensoes = Object.values(dimensoes).some((v) => !v);
  const prazo = unica.prazoExtraDias;
  const [prazoPersonalizado, setPrazoPersonalizado] = useState(prazo > 5);
  const { categorias, marcas, caracteristicas, atributos } = catalogo;
  const caminhoDaCategoria = (id: string) => categorias.find((c) => c.id === id)?.caminho ?? "";
  const caracteristicasDaCategoria = caracteristicas.filter((c) => produto.categoriaPrincipal && c.categorias.includes(produto.categoriaPrincipal.id));
  const url = produto.urn;

  // Grava na Moovin só as partes que mudaram e depois relê o produto, para mostrar o que ficou gravado.
  async function salvar() {
    if (Object.keys(erros).length) {
      setMostrarErros(true);
      setAviso("Corrija os campos destacados antes de salvar.");
      // Erros das abas e do Mapa de Corte ficam nos Campos Complementares; os outros (fora o nome), nos da Moovin.
      const complementar = (campo: string) => campo.startsWith("aba-") || campo === "mapa-corte";
      if (Object.keys(erros).some((campo) => campo !== "nome" && !complementar(campo))) setMoovinAberto(true);
      if (Object.keys(erros).some(complementar)) setComplementaresAberto(true);
      return;
    }
    setSalvando(true);
    setErroSalvar("");
    try {
      const feito = await salvarProduto(original, produto);
      recarregar(feito.length ? `Salvo: ${feito.join(", ")}.` : "Nada para salvar.");
    } catch (e) {
      setErroSalvar(`A gravação parou com erro: ${e instanceof Error ? e.message : e}. O que foi gravado antes do erro continua gravado; confira e salve de novo.`);
      setSalvando(false);
    }
  }


  function descartar() {
    setProduto(salvo);
    setVersao((v) => v + 1);
    setErroSalvar("");
    setMostrarErros(false);
    setAviso("");
  }

  return (
    <>
      <header className="topbar">
        <div className="breadcrumbs">
          <a href="#/produtos">Produtos</a><b>/</b><strong>{produto.nome}</strong>
        </div>
        <div className="heading-actions">
          {aviso && <span className="save-indicator">{aviso}</span>}
          {!aviso && alterado && <span className="save-indicator"><span className="status-dot amber" />Alterações não salvas</span>}
          <button className="button button-plain" onClick={() => setPrevia(true)}>Prévia da página</button>
          <button className="button button-secondary" disabled={!alterado || salvando} onClick={descartar}>Descartar</button>
          <button className="button button-primary" disabled={!alterado || salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar na Moovin"}</button>
        </div>
      </header>

      <div className="pagina-produto" key={versao}>
        {erroSalvar && <div className="caixa-erros">{erroSalvar}</div>}
        {mostrarErros && Object.keys(erros).length > 0 && (
          <div className="caixa-erros">
            <strong>Não foi possível salvar:</strong>
            <ul>{Object.values(erros).map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}

        <Secao titulo="Produto" extra={<Alternador ligado={produto.ativo} aoMudar={(ativo) => alterar({ ativo })} rotulo={produto.ativo ? "Ativo" : "Inativo"} />}>
          <Campo rotulo="Nome do produto" obrigatorio logus erro={errosVisiveis.nome}>
            <Texto valor={produto.nome} aoMudar={(nome) => alterar({ nome })} />
          </Campo>
        </Secao>

        <Grupo titulo="Campos do Moovin" descricao="Cadastro padrão da Moovin: descrição para a IA, organização, variações, preços, frete, imagens, características, SEO e visibilidade." aberto={moovinAberto} aoAlternar={setMoovinAberto}>
          <Secao titulo="Descrição para a IA de atendimento" descricao="É a descrição do produto na Moovin.">
            <Campo rotulo="Texto">
              <EditorTexto valor={produto.descricao} aoMudar={(descricao) => alterar({ descricao })} />
            </Campo>
            <div className="linha-acoes">
              <small className="campo-dica">
                Lida pela IA do Moovin Desk e pelos feeds. Gerada a partir do Complemento (fim desta página), só com o que a Moovin não
                tem nos outros campos; pode ser ajustada à mão. Não é mostrada na página da loja.
              </small>
              <button type="button" className="button button-secondary" onClick={() => { alterar({ descricao: descricaoParaIa(produto) }); setVersao((v) => v + 1); }}>
                Gerar de novo
              </button>
            </div>
          </Secao>

          <Secao titulo="Organização">
            <div className="linha-campos">
              <Campo rotulo="Categoria principal" logus>
                <CampoReferencia
                  opcoes={categorias}
                  valor={produto.categoriaPrincipal}
                  rotuloDe={(c) => caminhoDaCategoria(c.id) || c.nome}
                  placeholder="Selecione a categoria"
                  aoMudar={(categoriaPrincipal) =>
                    alterar(categoriaPrincipal ? { categoriaPrincipal } : { categoriaPrincipal: null, categoriasAdicionais: [] })
                  }
                />
              </Campo>
              <Campo rotulo="Marca" obrigatorio erro={errosVisiveis.marca}>
                <CampoReferencia opcoes={marcas} valor={produto.marca} placeholder="Selecione a marca" aoMudar={(marca) => alterar({ marca })} />
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

          <SecaoVariacoes produto={produto} alterar={alterar} erros={errosVisiveis} atributosVariacao={atributos} />

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
            <Campo rotulo="URL do produto" dica="Definida pela Moovin. Mudar o endereço fica no painel dela, para não quebrar links já publicados.">
              <input className="entrada" value={`${LOJA}/${url}/p`} readOnly />
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

        </Grupo>

        <Grupo titulo="Campos Complementares" descricao="O que a Moovin não tem: descrição da página, resumo, conteúdo comercial, abas e badges. Guardados no Templater." aberto={complementaresAberto} aoAlternar={setComplementaresAberto}>
          <SecoesComplemento
            complemento={produto.complemento}
            preco={precoEfetivo}
            migrar={original.migrar}
            tipos={tipos}
            modelos={modelos}
            errosAbas={errosDasAbas(errosVisiveis)}
            modeloAplicado={escolhido ? { nome: escolhido.modelo.nome, motivo: escolhido.motivo } : null}
            modeloSugerido={modeloDaCategoria(modelos, produto.categoriaPrincipal?.id, catalogo.categorias)?.modelo.id ?? null}
            aoMudar={(complemento) => alterar({ complemento })}
          />
          <BadgesDoProduto
            selecionados={produto.complemento.badges}
            todos={todosBadges}
            aoMudar={(badges) => alterar({ complemento: { ...produto.complemento, badges } })}
          />
          <MapaCorteDoProduto
            valor={produto.complemento.mapaCorte}
            mapas={mapas}
            nomeProduto={produto.nome}
            erro={errosVisiveis["mapa-corte"]}
            aoMudar={(mapaCorte) => alterar({ complemento: { ...produto.complemento, mapaCorte } })}
          />
        </Grupo>

      </div>

      {previa && <PreviaProduto produto={produto} badges={todosBadges} mapas={mapas} fechar={() => setPrevia(false)} />}
    </>
  );
}
