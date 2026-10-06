# Histórico do projeto

Reconstruído em 05/10/2026 a partir das sessões do GitHub Copilot (VS Code e CLI) gravadas em `~/.copilot/session-state/`. O projeto começou na pasta `eComerce_Teste`, que foi renomeada para `moovin-templater`.

## Fase 1 — Script_Produto (02 e 03/10/2026)

### Objetivo

Modernizar a página de produto da loja Bomgado na Moovin, com referências visuais da [Swift](https://www.swift.com.br/detail/cubos-de-coxao-mole-swift-500g) e da Pantynova: galeria à esquerda, informações e compra à direita e detalhes abaixo. O tema da Moovin não oferece esses recursos, então a página é transformada por um script JS/CSS cadastrado no painel. Preço, quantidade e compra continuam sendo os componentes nativos da Moovin.

### Onde está cada peça

| Peça | Endereço |
|---|---|
| Script_Produto (painel) | https://store.moovin.app/configuration/script/edit/c42bee55-b8fb-4ddd-a4dd-b41d0214fda6 |
| Cópia do código V3 | [`loja/script-produto-v3.js`](../loja/script-produto-v3.js) |
| Produto de teste (cadastro) | https://store.moovin.app/catalog/product/edit/2170b12c-3c6b-4954-ab5c-03379b78d8c5 |
| Produto de teste (loja) | https://shoptest.bomgado.com/cubos-de-panela-1-kg/p |
| Tema "Protótipo" (não publicado) | https://editor.moovin.app/57dd3f83-b1a7-4f34-a671-09909670ec3e |

Configuração do script no painel: ativo, tipo `CONTENT`, posição Cabeçalho, página Detalhe do produto.

### Descrição do produto como "pseudo formulário"

O cadastro da Moovin tem um único campo de descrição. O script lê marcadores nele:

```text
MODO NOVO

CONTEÚDO COMERCIAL: 500 g

RESUMO DO PRODUTO
Resumo comercial, exibido ao lado da galeria.

DETALHES DO PRODUTO
@ Preparo
Conteúdo da aba.

@ Sugestões
Conteúdo da aba.
```

- Sem `MODO NOVO`, `RESUMO DO PRODUTO` e `DETALHES DO PRODUTO` (nessa ordem), o script não faz nada e a página fica no layout antigo.
- Cada linha iniciada por `@` abre uma aba (também aceita `@1 Título`). O `#` foi descartado porque o editor da Moovin o usa para títulos.
- `CONTEÚDO COMERCIAL` é opcional e aceita `g`, `kg`, `ml`, `l` e `un`.

### Layout implementado na V3

- Galeria à esquerda; imagem principal com cantos arredondados e sombra sutil; miniaturas em faixa abaixo.
- Cartão de informações à direita: nome, código, avaliação, resumo e botão de compartilhar com ícone ao lado da avaliação (como na Swift, no lugar de "Compartilhe:" com links).
- Cartão de compra separado logo abaixo: preço, quantidade e COMPRAR na mesma linha. Saíram o simulador de frete (vai para o carrinho) e "Ver mais formas de pagamento".
- Abas de detalhes num painel com a mesma largura da área do produto, com navegação por clique e teclado.
- Barra de compra fixa que sobe suavemente quando a linha de compra sai da tela. É um clone: os botões delegam aos controles nativos e a quantidade é sincronizada. No celular, fica a barra nativa da Moovin.
- Preço de referência abaixo da linha de compra: preço da embalagem ÷ conteúdo comercial. Ex.: 500 g por R$ 69,38 → **R$ 138,76 / kg**. Não converte a quantidade do carrinho.

### Decisões e aprendizados

- **Não mover elementos nativos.** Mover a linha de compra quebrou o layout. A V3 usa atributos e CSS para estilizar e clona o que precisa duplicar.
- **Peso e Dimensões do cadastro são do frete**, não conteúdo líquido (no produto de teste estão zerados). Por isso existe o marcador `CONTEÚDO COMERCIAL`.
- **A busca pública não traz peso nem dimensões.** Os cards mostram só imagem, nome e preço, então o preço por kg na busca exigirá outra fonte de dados.
- **Propagação lenta.** O script salvo demora muito para chegar à loja, e a documentação da Moovin não tem opção para desligar o cache. Durante o desenvolvimento, as mudanças foram testadas por injeção no navegador. Em 05/10 a loja já publicava a V3 final (com `CONTEÚDO COMERCIAL`).
- O guarda por caminho (`/cubos-de-panela-1-kg/p`) citado nas sessões não está na versão publicada: hoje a ativação depende só dos marcadores.

### Pendências da fase 1

1. Confirmar o conteúdo comercial dos Cubos de Panela: o título diz 1 kg, e o teste usou 500 g.
2. Conferir se a descrição publicada já tem os marcadores e validar abas, barra fixa e preço por kg na loja, no desktop e no celular.
3. Se a propagação continuar inconsistente, pedir ao suporte da Moovin que investigue o cache do ambiente de teste.

## Fase 2 — Editor de templates (05/10/2026)

### A ideia

Em vez de o layout depender de marcadores na descrição, um **editor externo** desenha a página de produto e uma **API de templates** devolve a composição. Na Moovin fica só um script que busca o template publicado e monta a tela, como o Script_Produto faz hoje.

```text
Editor (este repositório) → publica o template (JSON)
                                   ↓
Página do produto na Moovin → script JS → API de templates
                                   ↓
                 renderiza o layout; ações continuam nativas da Moovin
```

### Decisões

- O template é **JSON declarativo** com tipos de bloco conhecidos pelo renderizador, nunca HTML ou JS executável.
- O editor só controla **o que aparece e onde**. Variações, quantidade, carrinho e frete continuam sendo da Moovin.
- O visual do editor segue o painel administrativo da Moovin, para manter o padrão.
- **Autenticação:** a API oficial da Moovin (`POST /iam-manager/authentication` com `app_id`/`app_secret`, token de 6 h) é de aplicativo e não pode ir para o navegador. A hipótese de trabalho é que o cookie da loja carrega um **token de sessão**: a API de templates o recebe com `credentials: "include"`, e o JS nunca lê nem expõe o token. Chamadas à API da Moovin, se forem necessárias, saem do backend.
- Stack sugerida para evoluir: React + TypeScript + Vite (já em uso); [Puck](https://puckeditor.com/) para o editor de blocos; Zod para validar templates; PostgreSQL para versões e publicação.

### O que existe hoje

MVP em React 18 + TypeScript + Vite (`src/App.tsx`, `src/styles.css`):

- painel no estilo Moovin, com catálogo de blocos (galeria, título, preço, descrição, variações, quantidade, botão comprar, frete e selos);
- prévia desktop/mobile com produto de demonstração, seleção, arrastar para reordenar, renomear, ocultar e remover;
- rascunho e publicação no `localStorage` e exportação do JSON.

Ainda não há backend, API de templates nem renderizador da loja.

## Fase 3 — Templater com Puck (05/10/2026, no Claude Code)

- **Decisões:** usar o Puck como motor do editor, com um único layout padrão para a loja; variações por categoria ou produto ficam para depois, como sobreposição.
- O editor próprio do MVP foi substituído pelo Puck, e o painel Moovin foi mantido em volta. O template agora é o JSON de dados do Puck (ver README).
- Os blocos são ligados a dados, não a conteúdo fixo: `moovin.*` vem do cadastro atual e `complemento.*` vem do futuro Complemento do cadastro (resumo, conteúdo comercial e abas).
- Em 05/10 a descrição publicada dos Cubos já tinha os marcadores e informava "PESO DA UNIDADE/PACOTE — 1 kg", sem a linha `CONTEÚDO COMERCIAL`. A prévia usa 1 kg.

### Nome dos blocos e abas (05/10/2026)

- **Nome do bloco:** todo bloco tem um campo "Nome do bloco", usado só no editor. Como o Puck mostra sempre o rótulo do tipo, a Estrutura e a etiqueta da prévia foram substituídas por versões próprias (`src/templater/estrutura.tsx`). Em troca, não dá mais para arrastar blocos pela Estrutura, só pela prévia.
- **Abas (decisão do Camillo):**
  - O **template define as abas padrão**, cada uma ligada a um campo do Complemento (`preparo`, `sugestoes`, `porcoes`, `origem`, `importante`). Se o produto não preencher o campo, a aba não aparece.
  - O **produto pode ter abas extras**, exibidas depois das abas padrão (o template pode desligar).
  - Cada aba é uma **lista de itens com título e texto formatado** (HTML com negrito, listas e links, limpo com DOMPurify). A numeração "01 ·" vem do template e continua de uma aba para a outra.
- O botão "Interagir com a prévia" (ou Ctrl+I) faz a prévia responder como na loja, com as abas clicáveis. No modo de edição, o clique serve para selecionar blocos.

## Fase 4 — Tela de produtos com o Complemento (05/10/2026)

- **Pedido do Camillo:** uma tela que substitua o cadastro de produto da Moovin, com todas as funções dela, mais o Complemento.
- **Levantamento da tela da Moovin:** wiki (artigos de Produtos), API (`oms-product`, `oms-pricing`, `oms-inventory` e `eco-seo`) e o texto da tela dos Cubos registrado pela sessão do Copilot de 02/10 (o Chrome não estava logado na Moovin em 05/10).
- **Decisões:**
  - Dados de demonstração agora, com uma camada (`RepositorioProdutos`) pronta para trocar pela API.
  - Campos que o Logus também atualiza continuam editáveis, com um selo de aviso.
- **Dados reais na demonstração:**
  - O "Cod.: 13925" que a loja exibe é o SKU (o GTIN também é 13925).
  - A marca dos Cubos no painel é "Bomgado Seleção".
  - As categorias vêm do menu do shoptest, e as 248 marcas, da planilha de marcas do cofre.
- **O Templater passou a usar os produtos cadastrados** (seletor "Produto da prévia"). A tela de produto tem uma prévia da página com o template publicado.
- **Fora desta etapa:**
  - envio de imagem por arquivo (depende do `dam-storage`);
  - preços por tabela de preço (a Moovin só mostra esses campos quando a loja tem uma tabela "por produto"; os Cubos não tinham em 02/10);
  - atributos e características reais da loja (nenhum conhecido).

## Fase 5 — Login da Moovin, renderizador e implantação (05 e 06/10/2026)

- **05/10:**
  - servidor Fastify com o login da Moovin (sessão no MongoDB, cookie HttpOnly) e repasse para `api.moovin.app`;
  - telas ligadas à Moovin;
  - Complemento gravado **na descrição do produto**;
  - **renderizador da loja** (`src/loja`, commit `48e64b7`): script IIFE servido em `GET /loja/<conta>/produto.js`, junto com o template publicado. Na dúvida, a página fica no layout nativo.
- **06/10, preparo do deploy no EasyPanel:**
  - `Dockerfile` e `docker-compose.yml` (app + `mongo:7` com volume);
  - em produção, o servidor entrega também o painel (`dist/`, via `@fastify/static`) e escuta em `HOST=0.0.0.0`;
  - testado localmente: o painel responde 200, a API sem sessão responde 401 e o `/loja` responde sem template.

## Próximos passos

1. **Implantar (Camillo):** serviço Compose no EasyPanel a partir deste repositório e domínio pelo túnel da Cloudflare apontando para `app:3001`. O caminho `/loja/*` precisa ficar **público** (sem Cloudflare Access), porque a loja o carrega no navegador do cliente.
2. Entrar no painel publicado com o login da Moovin e publicar o template padrão.
3. Trocar o `Script_Produto` da Moovin para o tipo **URL** (`https://<domínio>/loja/<id da loja>/produto.js`) e testar no shoptest.
4. Primeiro "Salvar na Moovin" pelo Camillo (os Cubos), convertendo a descrição para a convenção nova.
5. Depois: converter os demais produtos; versões e rollback de template; atributos reais.
