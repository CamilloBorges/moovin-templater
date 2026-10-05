import { useState } from "react";
import type { ProdutoCadastro } from "../../produtos/modelo";
import { formatarMoeda } from "../../templater/produto";

export function ListaProdutos({ produtos }: { produtos: ProdutoCadastro[] }) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const filtrados = produtos.filter(
    (p) => !termo || p.nome.toLowerCase().includes(termo) || p.variacoes.some((v) => v.sku.includes(termo)),
  );

  return (
    <>
      <header className="topbar">
        <div className="breadcrumbs"><strong>Produtos</strong></div>
        <div className="heading-actions">
          <a className="button button-primary botao-link" href="#/produtos/novo">Criar produto</a>
        </div>
      </header>
      <div className="pagina-produto">
        <input className="entrada busca" placeholder="Buscar por nome ou SKU" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <table className="tabela-produtos">
          <thead>
            <tr><th /><th>Produto</th><th>SKU</th><th>Preço</th><th>Estoque</th><th>Situação</th></tr>
          </thead>
          <tbody>
            {filtrados.map((p) => {
              const v = p.variacoes[0];
              return (
                <tr key={p.id} onClick={() => { location.hash = `#/produtos/${p.id}`; }}>
                  <td>{p.imagens[0] ? <img src={p.imagens[0].url} alt="" /> : <span className="sem-imagem" />}</td>
                  <td><a href={`#/produtos/${p.id}`}>{p.nome || "Sem nome"}</a>{p.possuiVariacoes && <small> · {p.variacoes.length} variações</small>}</td>
                  <td>{v?.sku}</td>
                  <td>{v ? (v.preco.venda ? formatarMoeda(v.preco.venda) : "Sob consulta") : ""}</td>
                  <td>{p.variacoes.reduce((total, x) => total + x.estoque, 0)}</td>
                  <td><span className={p.ativo ? "situacao ativo" : "situacao"}>{p.ativo ? "Ativo" : "Inativo"}</span></td>
                </tr>
              );
            })}
            {filtrados.length === 0 && <tr><td colSpan={6} className="vazio">Nenhum produto encontrado.</td></tr>}
          </tbody>
        </table>
        <p className="campo-dica">Dados de demonstração gravados neste navegador. A lista da Moovin entra na etapa de integração com a API.</p>
      </div>
    </>
  );
}
