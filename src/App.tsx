import { useEffect, useState } from "react";
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

function App() {
  const [secao, id] = useRota();
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
      </aside>
      <main className="main-area">{tela}</main>
    </div>
  );
}

export default App;
