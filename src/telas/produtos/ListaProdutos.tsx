import { useEffect, useState } from "react";
import { listarProdutos, precoEEstoque, type ItemLista } from "../../produtos/moovin";
import { formatarMoeda } from "../../templater/produto";

const POR_PAGINA = 20;

function PrecoEstoque({ sku }: { sku: string }) {
  const [dados, setDados] = useState<{ preco: number; estoque: number } | null>(null);
  useEffect(() => { precoEEstoque(sku).then(setDados, () => setDados(null)); }, [sku]);
  if (!dados) return <><td className="vazio">…</td><td className="vazio">…</td></>;
  return <><td>{dados.preco ? formatarMoeda(dados.preco) : "Sob consulta"}</td><td>{dados.estoque}</td></>;
}

// Produtos da loja, lidos da Moovin. Produtos novos entram pelo Logus (ou pelo painel da Moovin).
export function ListaProdutos() {
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<{ total: number; itens: ItemLista[] } | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setResultado(null);
    setErro("");
    listarProdutos(pagina, POR_PAGINA, termo).then(setResultado, (e) => setErro(e.message));
  }, [pagina, termo]);

  const paginas = resultado ? Math.max(1, Math.ceil(resultado.total / POR_PAGINA)) : 1;

  return (
    <>
      <header className="topbar">
        <div className="breadcrumbs"><strong>Produtos</strong>{resultado && <span>{resultado.total} na Moovin</span>}</div>
      </header>
      <div className="pagina-produto">
        <form className="entrada-com-botao busca" onSubmit={(e) => { e.preventDefault(); setPagina(1); setTermo(busca); }}>
          <input className="entrada" placeholder="Buscar pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <button className="button button-secondary">Buscar</button>
        </form>
        {erro && <p className="caixa-erros">Não foi possível listar os produtos: {erro}</p>}
        <table className="tabela-produtos">
          <thead>
            <tr><th /><th>Produto</th><th>SKU</th><th>Preço</th><th>Estoque</th><th>Situação</th></tr>
          </thead>
          <tbody>
            {!resultado && !erro && <tr><td colSpan={6} className="vazio">Carregando da Moovin…</td></tr>}
            {resultado?.itens.map((p) => (
              <tr key={p.id} onClick={() => { location.hash = `#/produtos/${p.id}`; }}>
                <td>{p.imagem ? <img src={p.imagem} alt="" loading="lazy" /> : <span className="sem-imagem" />}</td>
                <td><a href={`#/produtos/${p.id}`}>{p.nome}</a>{p.variacoes > 1 && <small> · {p.variacoes} variações</small>}</td>
                <td>{p.skus[0]}</td>
                {p.skus[0] ? <PrecoEstoque sku={p.skus[0]} /> : <><td /><td /></>}
                <td><span className={p.ativo ? "situacao ativo" : "situacao"}>{p.ativo ? "Ativo" : "Inativo"}</span></td>
              </tr>
            ))}
            {resultado && resultado.itens.length === 0 && <tr><td colSpan={6} className="vazio">Nenhum produto encontrado.</td></tr>}
          </tbody>
        </table>
        <div className="paginacao">
          <button className="button button-secondary" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
          <span>Página {pagina} de {paginas}</span>
          <button className="button button-secondary" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
        </div>
      </div>
    </>
  );
}
