import { useState } from "react";
import type { Imagem, ProdutoCadastro } from "../../produtos/modelo";
import { Campo, Secao, Texto } from "./campos";

// Imagens por link. O envio de arquivo depende do armazenamento da Moovin (dam-storage),
// que entra na etapa de integração com a API.
export function SecaoImagens({ produto, alterar }: { produto: ProdutoCadastro; alterar: (parcial: Partial<ProdutoCadastro>) => void }) {
  const [url, setUrl] = useState("");
  const imagens = produto.imagens;
  const definir = (novas: Imagem[]) => alterar({ imagens: novas });
  const mover = (i: number, d: number) => {
    const novas = [...imagens];
    [novas[i], novas[i + d]] = [novas[i + d], novas[i]];
    definir(novas);
  };

  // Valores de atributo das variações, para vincular a imagem (ex.: Cor = Preto).
  const opcoesVinculo = produto.possuiVariacoes
    ? produto.atributosVariacao.flatMap((a) =>
        [...new Set(produto.variacoes.map((v) => v.atributos[a.id]).filter(Boolean))].map((valor) => ({ id: a.id, nome: a.nome, valor })),
      )
    : [];

  function adicionar() {
    const link = url.trim();
    if (!/^https?:\/\//.test(link)) return;
    definir([...imagens, { url: link, atributo: null }]);
    setUrl("");
  }

  const videoValido = !produto.video || /youtube\.com|youtu\.be|vimeo\.com/.test(produto.video);

  return (
    <Secao titulo="Imagens e vídeo" descricao="Tamanho recomendado: 1200 × 1200 px. A primeira imagem é a principal.">
      <div className="grade-imagens">
        {imagens.map((imagem, i) => (
          <figure key={imagem.url + i} className="imagem-produto">
            <img src={imagem.url} alt={`Imagem ${i + 1}`} />
            <figcaption>
              <button type="button" className="botao-icone" title="Mover para a esquerda" disabled={i === 0} onClick={() => mover(i, -1)}>←</button>
              <button type="button" className="botao-icone" title="Mover para a direita" disabled={i === imagens.length - 1} onClick={() => mover(i, 1)}>→</button>
              <button type="button" className="botao-icone perigo" title="Remover imagem" onClick={() => definir(imagens.filter((_, j) => j !== i))}>×</button>
            </figcaption>
            {opcoesVinculo.length > 0 && (
              <select
                className="entrada"
                title="Vincular imagem ao atributo"
                value={imagem.atributo ? `${imagem.atributo.id}|${imagem.atributo.valor}` : ""}
                onChange={(e) => {
                  const [id, valor] = e.target.value.split("|");
                  definir(imagens.map((img, j) => (j === i ? { ...img, atributo: id ? { id, valor } : null } : img)));
                }}
              >
                <option value="">Todas as variações</option>
                {opcoesVinculo.map((o) => (
                  <option key={`${o.id}|${o.valor}`} value={`${o.id}|${o.valor}`}>{o.nome}: {o.valor}</option>
                ))}
              </select>
            )}
          </figure>
        ))}
        {imagens.length === 0 && <p className="vazio">Nenhuma imagem.</p>}
      </div>
      <div className="entrada-com-botao">
        <input
          className="entrada"
          placeholder="Link da imagem (https://…)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
        />
        <button type="button" className="button button-secondary" onClick={adicionar}>Adicionar imagem</button>
      </div>
      <small className="campo-dica">Envio de arquivo: na etapa de integração com a API da Moovin.</small>
      <Campo rotulo="Link do vídeo do seu produto no YouTube ou Vimeo" erro={videoValido ? undefined : "Use um link do YouTube ou do Vimeo"}>
        <Texto valor={produto.video} aoMudar={(video) => alterar({ video })} placeholder="https://www.youtube.com/watch?v=…" />
      </Campo>
    </Secao>
  );
}
