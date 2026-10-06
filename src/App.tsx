import { useEffect, useState } from "react";
import { api, EVENTO_SESSAO_EXPIRADA, type Sessao } from "./api";
import { Login } from "./telas/Login";
import { EdicaoProduto } from "./telas/produtos/EdicaoProduto";
import { ListaProdutos } from "./telas/produtos/ListaProdutos";
import { Templater } from "./telas/Templater";

// Navegação pelo endereço: #/produtos, #/produtos/<id> e #/aparencia.
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
  // O editor de aparência ocupa a janela inteira, como o editor de temas da Moovin; "Fechar" volta ao menu.
  if (secao === "aparencia") return <Templater fechar={() => { location.hash = "#/produtos"; }} />;
  let tela;
  if (id) tela = <EdicaoProduto key={id} id={id} />;
  else tela = <ListaProdutos />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">m</div>
          <div><strong>moovin</strong><span>PAINEL DA LOJA</span></div>
        </div>
        <div className="nav-caption">MENU PRINCIPAL</div>
        <nav className="side-nav">
          <a className="nav-active" href="#/produtos"><span>▧</span> Produtos</a>
          <a href="#/aparencia"><span>◩</span> Aparência</a>
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
