import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Sessao } from "../api";
import { carregarProduto } from "../produtos/moovin";
import {
  analisarScripts, ativarScript, cadastrarScript, carregarResumo, listarScripts, maxAge, NOME_SCRIPT, novoScript, urlDoScript, verificarPagina,
  type Resumo, type ScriptMoovin,
} from "../produtos/implantacao";

// Tutorial de implantação: o que precisa estar pronto para a página de produto da loja usar o
// Templater. Cada passo se verifica sozinho (Templater, Moovin e a própria página da loja) e
// traz a ação para resolver. As ações que mexem na loja pedem confirmação.

type Estado = "ok" | "aviso" | "erro" | "verificando" | "aguardando";
const ROTULO: Record<Estado, string> = { ok: "Pronto", aviso: "Atenção", erro: "Pendente", verificando: "Verificando…", aguardando: "Aguardando" };

function Passo({ numero, titulo, estado, children }: { numero: number; titulo: string; estado: Estado; children: ReactNode }) {
  return (
    <section className={`passo-implantacao estado-${estado}`}>
      <span className="passo-marca" aria-label={ROTULO[estado]}>{estado === "ok" ? "✓" : numero}</span>
      <div className="passo-corpo">
        <h2>{titulo} <small className={`passo-estado estado-${estado}`}>{ROTULO[estado]}</small></h2>
        {children}
      </div>
    </section>
  );
}

function Copiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <span className="entrada-com-botao">
      <input className="entrada" readOnly value={texto} onFocus={(e) => e.target.select()} />
      <button type="button" className="button button-secondary" onClick={() => navigator.clipboard.writeText(texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800); })}>
        {copiado ? "Copiado!" : "Copiar"}
      </button>
    </span>
  );
}

type Script = { status: number; temTemplate: boolean; maxAge: number | null } | { erro: string };
type Pagina = { url: string; status: number; carregaTemplater: boolean; carregaV3: boolean } | { erro: string };

export function Implantacao({ sessao }: { sessao: Sessao }) {
  const conta = sessao.conta!;
  const url = urlDoScript(location.origin, conta.id);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [scripts, setScripts] = useState<ScriptMoovin[] | { erro: string } | null>(null);
  const [caminho, setCaminho] = useState("");
  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [acao, setAcao] = useState("");
  const [erroAcao, setErroAcao] = useState("");

  const verificarScript = useCallback(async () => {
    setScript(null);
    try {
      const r = await fetch(url, { cache: "no-store" });
      const corpo = await r.text();
      setScript({ status: r.status, temTemplate: corpo.startsWith("window.__TEMPLATER_BOMGADO__="), maxAge: maxAge(r.headers.get("cache-control")) });
    } catch (e) {
      setScript({ erro: e instanceof Error ? e.message : String(e) });
    }
  }, [url]);

  const verificarScripts = useCallback(() => {
    setScripts(null);
    listarScripts().then(setScripts, (e) => setScripts({ erro: e.message }));
  }, []);

  const verificarNaLoja = useCallback(async (alvo: string) => {
    if (!alvo) return;
    setPagina(null);
    try {
      setPagina(await verificarPagina(alvo));
    } catch (e) {
      setPagina({ erro: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    carregarResumo().then(async (r) => {
      setResumo(r);
      // Página de exemplo: o último produto com Complemento salvo.
      if (r.produtoExemplo) {
        const urn = (await carregarProduto(r.produtoExemplo).catch(() => null))?.cadastro.urn;
        if (urn) { setCaminho(`/${urn}/p`); verificarNaLoja(`/${urn}/p`); }
      }
    }, () => setResumo(null));
    verificarScript();
    verificarScripts();
  }, [verificarScript, verificarScripts, verificarNaLoja]);

  const lista = Array.isArray(scripts) ? scripts : [];
  const { templater, antigos } = analisarScripts(lista, url);
  const antigosAtivos = antigos.filter((s) => s.active);

  async function executar(descricao: string, confirmacao: string, fazer: () => Promise<unknown>) {
    if (!window.confirm(confirmacao)) return;
    setErroAcao("");
    setAcao(descricao);
    try {
      await fazer();
      verificarScripts();
    } catch (e) {
      setErroAcao(`${descricao}: ${e instanceof Error ? e.message : e}`);
    } finally {
      setAcao("");
    }
  }

  // Estados de cada passo
  const e2: Estado = !resumo ? "verificando" : resumo.publicadoEm ? "ok" : "erro";
  const e3: Estado = !resumo ? "verificando" : resumo.produtos > 0 ? "ok" : "aviso";
  const e4: Estado = !script ? "verificando" : "erro" in script || script.status !== 200 || !script.temTemplate ? "erro" : script.maxAge !== null && script.maxAge > 300 ? "aviso" : "ok";
  const e5: Estado = !scripts ? "verificando" : "erro" in scripts ? "erro" : templater?.active ? "ok" : templater ? "aviso" : "erro";
  const e6: Estado = !pagina ? (caminho ? "verificando" : "aguardando") : "erro" in pagina || pagina.status !== 200 ? "erro" : pagina.carregaTemplater ? "ok" : "erro";
  const e8: Estado = !scripts ? "verificando" : antigosAtivos.length ? "aviso" : "ok";
  const prontos = [e2, e3, e4, e5, e6].filter((e) => e === "ok").length + 1;

  return (
    <>
      <header className="topbar">
        <div className="breadcrumbs"><strong>Implantação</strong><span>{prontos} de 6 verificações prontas</span></div>
        <div className="heading-actions">
          <button className="button button-secondary" onClick={() => { verificarScript(); verificarScripts(); verificarNaLoja(caminho); carregarResumo().then(setResumo); }}>
            Verificar tudo de novo
          </button>
        </div>
      </header>
      <div className="pagina-produto implantacao">
        <p className="campo-dica">
          Passo a passo para a página de produto da loja passar a usar o Templater. Os passos se verificam sozinhos; os botões que mexem na
          Moovin pedem confirmação antes.
        </p>
        {erroAcao && <p className="caixa-erros">{erroAcao}</p>}
        {acao && <p className="aviso">{acao}…</p>}

        <Passo numero={1} titulo="Templater conectado à loja" estado="ok">
          <p>Loja <strong>{conta.nome}</strong> (id <code>{conta.id}</code>). Este é o endereço do script da página de produto:</p>
          <Copiar texto={url} />
        </Passo>

        <Passo numero={2} titulo="Template publicado" estado={e2}>
          {resumo?.publicadoEm ? (
            <p>Publicado em {new Date(resumo.publicadoEm).toLocaleString("pt-BR")}. Ao publicar de novo, a loja recebe a versão nova.</p>
          ) : (
            <p>Sem template publicado, o script não muda a página. <a href="#/aparencia">Abra a Aparência</a>, confira com <em>Visualizar</em> e clique em <strong>Publicar</strong>.</p>
          )}
        </Passo>

        <Passo numero={3} titulo="Produtos com Complemento" estado={e3}>
          <p>
            {resumo ? <><strong>{resumo.produtos}</strong> produto(s) com Complemento salvo e <strong>{resumo.badges}</strong> badge(s) cadastrado(s). </> : null}
            Só os produtos com Complemento usam o layout novo; os outros continuam como a Moovin monta. Para migrar um produto, abra-o em{" "}
            <a href="#/produtos">Produtos</a>, confira os Campos Complementares e salve.
          </p>
        </Passo>

        <Passo numero={4} titulo="Script respondendo no Templater" estado={e4}>
          {!script ? null : "erro" in script ? (
            <p>Não foi possível abrir o script: {script.erro}</p>
          ) : !script.temTemplate ? (
            <p>O script respondeu ({script.status}), mas ainda sem template: publique o template (passo 2).</p>
          ) : (
            <p>O script está no ar e já leva o template publicado.</p>
          )}
          {script && !("erro" in script) && script.maxAge !== null && script.maxAge > 300 && (
            <div className="aviso">
              <strong>Cache longo:</strong> o navegador guarda o script por {Math.round(script.maxAge / 3600 * 10) / 10} h (o Templater pede 1 min).
              É a Cloudflare reescrevendo o cabeçalho, e uma publicação pode levar esse tempo para chegar ao cliente. Na Cloudflare, crie uma
              <em> Cache Rule</em> para <code>{new URL(url).host}/loja/*</code> com <em>Browser TTL</em> “Respect origin” e <em>Edge TTL</em> “Use cache-control header”.
            </div>
          )}
          <button type="button" className="button button-plain" onClick={verificarScript}>Verificar de novo</button>
        </Passo>

        <Passo numero={5} titulo="Script cadastrado na Moovin" estado={e5}>
          {!scripts ? null : "erro" in scripts ? (
            <p>Não foi possível ler os scripts da Moovin: {scripts.erro}</p>
          ) : templater ? (
            templater.active ? (
              <p>Cadastrado como <strong>{templater.name}</strong> (tipo URL, {templater.loadPosition === "FOOTER" ? "rodapé" : "cabeçalho"}) e ativo.</p>
            ) : (
              <>
                <p>Cadastrado como <strong>{templater.name}</strong>, mas <strong>inativo</strong>.</p>
                <button type="button" className="button button-primary" disabled={!!acao}
                  onClick={() => executar("Ativando o script", "Ativar o script do Templater na loja? A página de produto passa a usar o layout novo nos produtos com Complemento.", () => ativarScript(templater.id, true))}>
                  Ativar o script
                </button>
              </>
            )
          ) : (
            <>
              <p>O script ainda não está cadastrado na Moovin. Dá para cadastrar daqui ou fazer à mão:</p>
              <button type="button" className="button button-primary" disabled={!!acao}
                onClick={() => executar("Cadastrando o script", `Cadastrar o script "${NOME_SCRIPT}" na Moovin, ativo? A página de produto passa a usar o layout novo nos produtos com Complemento.`, () => cadastrarScript(novoScript(url, antigos)))}>
                Cadastrar na Moovin automaticamente
              </button>
              <details className="manual">
                <summary>Fazer à mão no painel da Moovin</summary>
                <ol>
                  <li>No painel da Moovin, abra <strong>Configurações › Scripts</strong> e clique em <strong>Novo script</strong>.</li>
                  <li>Nome: <strong>{NOME_SCRIPT}</strong>.</li>
                  <li>Tipo: <strong>URL</strong>; método de carregamento: <strong>Defer</strong>; cole a URL do passo 1.</li>
                  <li>Posição: <strong>Rodapé</strong>. Página: <strong>Detalhe do produto</strong> (ou Todas: o script só age nas páginas de produto).</li>
                  <li>Deixe <strong>ativo</strong>, salve e volte aqui para verificar.</li>
                </ol>
              </details>
            </>
          )}
          <button type="button" className="button button-plain" onClick={verificarScripts}>Verificar de novo</button>
        </Passo>

        <Passo numero={6} titulo="Script carregando na página da loja" estado={e6}>
          <p>O Templater abre a página de um produto na loja ({resumo?.lojaUrl ?? "…"}) e procura o script.</p>
          <form className="entrada-com-botao" onSubmit={(e) => { e.preventDefault(); verificarNaLoja(caminho); }}>
            <input className="entrada" placeholder="/caminho-do-produto/p" value={caminho} onChange={(e) => setCaminho(e.target.value)} />
            <button className="button button-secondary" disabled={!caminho}>Verificar</button>
          </form>
          {!caminho && <small className="campo-dica">Salve o Complemento de um produto (passo 3) ou informe o caminho de uma página de produto.</small>}
          {pagina && ("erro" in pagina ? (
            <p>{pagina.erro}</p>
          ) : pagina.status !== 200 ? (
            <p>A página respondeu {pagina.status}. Confira o caminho.</p>
          ) : pagina.carregaTemplater ? (
            <p>A página <a href={pagina.url} target="_blank" rel="noreferrer">{pagina.url}</a> carrega o script do Templater.</p>
          ) : (
            <p>A página <a href={pagina.url} target="_blank" rel="noreferrer">{pagina.url}</a> ainda não carrega o script. Se ele acabou de ser cadastrado (passo 5), a Moovin pode levar alguns minutos para atualizar a loja.</p>
          ))}
        </Passo>

        <Passo numero={7} titulo="Conferir a página com os próprios olhos" estado={pagina && !("erro" in pagina) && pagina.carregaTemplater ? "aviso" : "aguardando"}>
          {pagina && !("erro" in pagina) ? (
            <>
              <p><a className="button button-secondary" href={pagina.url} target="_blank" rel="noreferrer">Abrir a página na loja</a> e conferir, de preferência no computador e no celular:</p>
              <ul className="conferencia">
                <li>o layout novo aparece (galeria, cartões, descrição e abas);</li>
                <li>os badges aparecem, com o balão ao passar o mouse;</li>
                <li>quantidade e <strong>COMPRAR</strong> funcionam e o produto vai para o carrinho;</li>
                <li>o botão compartilhar copia o link;</li>
                <li>um produto <em>sem</em> Complemento continua com o layout da Moovin.</li>
              </ul>
            </>
          ) : (
            <p>Disponível quando o passo 6 encontrar a página.</p>
          )}
        </Passo>

        <Passo numero={8} titulo="Script antigo (Script_Produto V3)" estado={e8}>
          {antigosAtivos.length ? (
            <>
              <p>
                O script antigo <strong>{antigosAtivos.map((s) => s.name).join(", ")}</strong> continua ativo. Durante a migração os dois convivem: o antigo só age em
                produtos com a descrição no formato antigo (MODO NOVO), e o Templater só nos produtos com Complemento. Desative o antigo quando todos os produtos
                estiverem migrados.
              </p>
              {antigosAtivos.map((s) => (
                <button key={s.id} type="button" className="button button-secondary" disabled={!!acao}
                  onClick={() => executar("Desativando o script antigo", `Desativar "${s.name}" na Moovin? Os produtos ainda no formato antigo voltam ao layout padrão da Moovin.`, () => ativarScript(s.id, false))}>
                  Desativar “{s.name}”
                </button>
              ))}
            </>
          ) : (
            <p>Nenhum script antigo de página de produto ativo.</p>
          )}
        </Passo>
      </div>
    </>
  );
}
