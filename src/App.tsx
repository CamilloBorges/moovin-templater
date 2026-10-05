import { useEffect, useState } from "react";
import { api, EVENTO_SESSAO_EXPIRADA, type Sessao } from "./api";
import { Login } from "./telas/Login";
import { novoProduto } from "./produtos/modelo";
import { repositorioLocal } from "./produtos/repositorio";
import { EdicaoProduto } from "./telas/produtos/EdicaoProduto";
import { ListaProdutos } from "./telas/produtos/ListaProdutos";
import { Templater } from "./telas/Templater";

// Navegação pelo endereço: #/produtos, #/produtos/<id>, #/produtos/novo e #/aparencia.
function useRota() {
  const [rota, setRota] = useState(location.hash);
  useEffect(() => {
    const aoMudar = () => setRota(location.hash);
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);
  return rota.replace(/^#\/?/, "").split("/");
}

// Sessão do painel: sem login válido na Moovin, só a tela de login aparece.
function useSessao() {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  useEffect(() => {
    api<Sessao>("sessao").then(setSessao, () => setSessao({ etapa: "login" }));
    const expirou = () => setSessao({ etapa: "login" });
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, expirou);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, expirou);
  }, []);
  return [sessao, setSessao] as const;
}

function App() {
  const [sessao, setSessao] = useSessao();
  const [secao, id] = useRota();
  if (!sessao) return <div className="login-fundo"><p className="vazio">Carregando…</p></div>;
  if (sessao.etapa !== "ativa") return <Login sessao={sessao} aoMudar={setSessao} />;
  return <Painel sessao={sessao} sair={() => api<Sessao>("sessao/sair", { corpo: {} }).then(setSessao)} secao={secao} id={id} />;
}

function Painel({ sessao, sair, secao, id }: { sessao: Sessao; sair: () => void; secao: string; id?: string }) {
  const repositorio = repositorioLocal;

  let tela;
  if (secao === "aparencia") {
    tela = <Templater produtos={repositorio.listar()} />;
  } else if (id) {
    const produto = id === "novo" ? novoProduto() : repositorio.obter(id);
    tela = produto ? (
      <EdicaoProduto key={id} inicial={produto} repositorio={repositorio} voltar={() => { location.hash = "#/produtos"; }} />
    ) : (
      <p className="vazio">Produto não encontrado. <a href="#/produtos">Voltar à lista</a></p>
    );
  } else {
    tela = <ListaProdutos produtos={repositorio.listar()} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">m</div>
          <div><strong>moovin</strong><span>PAINEL DA LOJA</span></div>
        </div>
        <div className="nav-caption">MENU PRINCIPAL</div>
        <nav className="side-nav">
          <a className={secao !== "aparencia" ? "nav-active" : ""} href="#/produtos"><span>▧</span> Produtos</a>
          <a className={secao === "aparencia" ? "nav-active" : ""} href="#/aparencia"><span>◩</span> Aparência</a>
        </nav>
        <div className="sidebar-conta">
          <strong>{sessao.conta?.nome}</strong>
          <span>{sessao.usuario?.nome}</span>
          <button type="button" className="button button-plain" onClick={sair}>Sair</button>
        </div>
      </aside>
      <main className="main-area">{tela}</main>
    </div>
  );
}

export default App;
