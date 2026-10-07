import { MapaCorteImagem } from "../../templater/blocos";
import { resolverMapaCorte, type MapaCorteProduto, type MapaCortes } from "../../templater/produto";
import { Alternador, Campo, Secao } from "./campos";

// Mapa de Corte do produto: qual mapa (animal) e qual corte. A página monta a imagem com a região
// destacada, o nome do produto e a descrição, e a coloca no fim da galeria.

export function MapaCorteDoProduto({ valor, mapas, nomeProduto, erro, aoMudar }: {
  valor: MapaCorteProduto | null | undefined;
  mapas: MapaCortes[];
  nomeProduto: string;
  erro?: string;
  aoMudar: (v: MapaCorteProduto | null) => void;
}) {
  const ativo = !!valor;
  const mapa = mapas.find((m) => m.id === valor?.mapa);
  const corte = mapa?.cortes.find((c) => c.id === valor?.corte);
  const resolvido = resolverMapaCorte(valor, mapas);
  const ligar = (ligado: boolean) => {
    if (!ligado) return aoMudar(null);
    const unico = mapas.length === 1 ? mapas[0].id : "";
    aoMudar({ mapa: unico, corte: "", descricao: "" });
  };

  return (
    <Secao
      titulo="Mapa de Corte"
      descricao="Mostra de que parte do animal vem o corte, numa imagem no fim da galeria."
      extra={<Alternador ligado={ativo} aoMudar={ligar} rotulo={ativo ? "Ativado" : "Desativado"} />}
    >
      {ativo && mapas.length === 0 && (
        <p className="aviso">Nenhum mapa cadastrado. Cadastre o animal e os cortes em <a href="#/mapas">Mapas de cortes</a>.</p>
      )}
      {ativo && valor && mapas.length > 0 && (
        <div className="linha-campos linha-mapa-corte">
          <div className="campos-mapa-corte">
            <div className="linha-campos">
              <Campo rotulo="Animal" obrigatorio>
                <select className="entrada" value={valor.mapa} onChange={(e) => aoMudar({ ...valor, mapa: e.target.value, corte: "" })}>
                  <option value="">Selecione</option>
                  {mapas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Corte" obrigatorio erro={erro}>
                <select className="entrada" value={valor.corte} disabled={!mapa} onChange={(e) => aoMudar({ ...valor, corte: e.target.value })}>
                  <option value="">{mapa ? "Selecione o corte" : "Escolha o animal"}</option>
                  {[...(mapa?.cortes ?? [])].sort((a, b) => a.numero - b.numero).map((c) => (
                    <option key={c.id} value={c.id} disabled={c.regiao.length < 3}>
                      {c.numero} · {c.nome}{c.regiao.length < 3 ? " (sem contorno no mapa)" : ""}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            <Campo rotulo="Descrição na imagem" dica={`${valor.descricao.length}/400. Em branco, usa a descrição cadastrada no corte.`}>
              <textarea className="entrada" rows={4} maxLength={400} value={valor.descricao} placeholder={corte?.descricao || "Descrição do corte"}
                onChange={(e) => aoMudar({ ...valor, descricao: e.target.value })} />
            </Campo>
          </div>
          <div className="previa-mapa-corte">
            <span className="campo-rotulo">Como fica na galeria</span>
            {resolvido ? (
              <div className="tpl-galeria"><MapaCorteImagem mapa={resolvido} titulo={nomeProduto} p={{}} /></div>
            ) : (
              <p className="vazio">Escolha o animal e o corte.</p>
            )}
            <small className="campo-dica">Cores, fontes e logotipo vêm da Aparência (bloco Galeria).</small>
          </div>
        </div>
      )}
    </Secao>
  );
}
