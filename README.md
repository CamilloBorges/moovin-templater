# Editor de página de produto

Primeiro MVP de um editor visual para compor a página de produto, mantendo a Moovin responsável pelos dados e pelas funcionalidades nativas da loja.

- [`docs/HISTORICO.md`](docs/HISTORICO.md): origem do projeto, decisões e próximos passos.
- [`loja/script-produto-v3.js`](loja/script-produto-v3.js): o Script_Produto que roda hoje na loja, base para o renderizador.

## Executar localmente

```bash
npm install
npm run dev   # painel (Vite, porta 5173) + servidor (Fastify, porta 3001)
```

Em desenvolvimento, sem `MONGO_URL`, o servidor sobe um MongoDB local (`mongodb-memory-server`) com os dados em `%LOCALAPPDATA%\moovin-templater\mongo`, fora do OneDrive. Variáveis: `MONGO_URL`, `MONGO_BANCO`, `MOOVIN_API` (padrão `https://api.moovin.app`), `PORTA`, `COOKIE_SEGURO=1` (com HTTPS) e `SESSAO_HORAS`.

## Testes

```bash
npm test   # Vitest: funções do cadastro, renderizador da loja (jsdom) e rotas do servidor (MongoDB em memória)
```

- `src/produtos/descricao.test.ts`: migração da descrição antiga e texto para a IA.
- `src/loja/Pagina.test.tsx`: o renderizador da loja monta o layout padrão e **conhece todo bloco do editor**. Um bloco novo no editor sem o `case` correspondente em `src/loja/Pagina.tsx` quebra o teste.
- `server/app.test.ts`: rotas do painel e da loja (sessão, Complemento por SKU, templates), com `app.inject`, sem abrir porta. As rotas ficam em `server/app.ts` e a subida do servidor em `server/index.ts`.
- **CI:** `.github/workflows/testes.yml` roda build e testes a cada push.

## Acesso: login da Moovin

O painel só abre com uma sessão válida da Moovin, como o painel administrativo dela. Não usa chave de API: o login é o e-mail e a senha do usuário, com a verificação em duas etapas e a escolha da loja, no mesmo fluxo do `id.moovin.app`. Detalhes em `server/moovin.ts`.

- Os tokens da Moovin ficam só no servidor (MongoDB, coleção `sessoes`, que expira sozinha). O navegador recebe um cookie `HttpOnly` com o id da sessão.
- O painel chama a Moovin por `/api/moovin/<serviço>/...`. O servidor repassa com o token da loja (`X-Authorization: Bearer`), só para os serviços liberados.
- O token é revalidado na Moovin a cada 5 minutos. Se a Moovin recusar, a sessão acaba e o painel volta para o login.
- Os templates (rascunho e publicado) ficam no MongoDB, separados pela loja (`/api/templates/:tipo`).
- **Complemento do cadastro no MongoDB** (coleção `complementos`, por loja e produto, com os SKUs): só o que a Moovin não tem — a descrição da página, o resumo, o conteúdo comercial e as abas. Preço, categoria, marca, estoque e os demais campos padrão ficam só na Moovin. Rotas: `/api/complementos/:produto` (painel) e `/loja/<conta>/complemento/<sku>` (público, para a página da loja).
- **A descrição da Moovin é o texto para a IA** de atendimento (Moovin Desk) e para os feeds: gerado a partir do Complemento (`descricaoParaIa`, em `src/produtos/descricao.ts`), ajustável na tela e com o botão "Gerar de novo". Não aparece na página da loja.
- **Migração:** produto sem Complemento no MongoDB é lido da descrição da Moovin (formato MODO NOVO / @ ou a convenção de 05/10; descrição comum vira a descrição da página). No primeiro salvamento, o Complemento vai para o MongoDB e a descrição da Moovin é trocada pelo texto para a IA.

## Script da loja (página de produto)

O `Script_Produto` da Moovin passa a ser do tipo **URL**, apontando para `https://<servidor>/loja/<id da loja>/produto.js`. O servidor entrega o template publicado junto com o código (`dist-loja/produto.js`, gerado por `npm run build:loja` a partir de `src/loja/`). Cache de 1 minuto: publicar no Templater vale quase na hora, sem o cache da Moovin.

- **Mesmos blocos do editor:** os blocos (`src/templater/blocos.tsx`) e o CSS (`src/templater/pagina.css`) são os mesmos da prévia, então a página fica igual ao editor.
- **Elementos nativos:** nunca são movidos. A linha do produto e a seção "Descrição" ficam escondidas, e os botões do template (quantidade, COMPRAR, compartilhar) acionam os nativos. O carrinho continua sendo da Moovin.
- **Na dúvida, não mexe:** sem template publicado, sem a estrutura esperada da página ou com variação para escolher, a página fica como a Moovin a monta.
- **Navegação:** acompanha a navegação do Next.js da Moovin (troca de produto sem recarregar).

## Telas

O painel tem duas áreas, navegadas pelo endereço (`#/produtos` e `#/aparencia`).

### Produtos (`src/telas/produtos/`)

Substitui a tela de cadastro de produto da Moovin, com as mesmas seções, mais o Complemento. No topo fica o nome do produto; abaixo, dois grupos recolhíveis: **Campos do Moovin** (fechado por padrão; abre sozinho se houver erro de validação nele) e **Campos Complementares** (aberto):

- **Informações principais:** ativo/inativo, nome e descrição (editor de texto formatado com contador).
- **Organização:** categoria principal, mais categorias e marca. Permite escolher ou criar, como na Moovin.
- **Variação:** SKU com "Gerar código", código de barras, MPN e estoque. Ou a tabela de variações, com atributos criados na hora e preço por variação.
- **Preços:** preço, preço promocional (menor que o preço) e custo, com margem e lucro calculados. Preço zerado = sob consulta.
- **Dimensões da embalagem e disponibilidade da entrega:** Imediata, de 1 a 5 dias úteis ou personalizada.
- **Imagens e vídeo:** por link, com ordem e vínculo da imagem a uma variação. O envio de arquivo fica para a integração com a API.
- **Características:** conforme a categoria.
- **SEO**, **visível apenas por link** e o link do produto.
- **Complemento do cadastro:** resumo, conteúdo comercial (com o preço por kg/L/un calculado), itens das abas definidas no template publicado e abas extras.
- Validação ao salvar, descartar alterações, excluir e **prévia da página** com o template publicado.

Os campos que o Logus também atualiza (nome, categoria, preço e estoque) têm o selo "Logus". Continuam editáveis, mas o Logus pode sobrescrevê-los em cerca de 30 minutos.

Os dados ficam no navegador (`src/produtos/repositorio.ts`), começando pelos Cubos de Panela. O modelo (`src/produtos/modelo.ts`) traz, em comentário, o nome de cada campo na API da Moovin, para a etapa de integração.

### Badges (`src/telas/Badges.tsx`)

Cadastro de selos da loja: nome, imagem, texto do balão (tooltip, até 300 caracteres) e link opcional para a descrição completa.
- **A imagem é enviada para a Moovin** (`PUT dam-storage/file/public/templater/badges/<nome>-<carimbo>.<ext>`); o cadastro guarda o endereço. Os demais dados ficam no MongoDB (coleção `badges`).
- **No produto**, os badges são marcados nos Campos Complementares, na ordem de exibição. O Complemento guarda só os ids.
- **Na loja**, o bloco "Badges" mostra as imagens com o balão ao passar o mouse (ou ao focar pelo teclado). Badge com link vira um link que abre em outra aba; sem link, não há link. A rota `/loja/<conta>/complemento/<sku>` já devolve os badges resolvidos.
- Excluir um badge o tira de todos os produtos.
- **Imagem ou ícone:** no lugar da imagem, o badge pode usar um ícone da [Lucide](https://lucide.dev) (licença ISC), com cor e fundo (ou sem fundo). O SVG fica no cadastro, então a loja não carrega a biblioteca; no painel ela vem sob demanda. O servidor recusa SVG com script, eventos ou `javascript:`, e a loja ainda passa o SVG pelo DOMPurify.
- **Bloco Badges:** tamanho de 64, 80, 96 ou 128 px, badges por linha (1 a 8) e máximo de linhas (1 a 4). O que passa do limite não aparece, e o editor avisa.
- **Editor de imagem** (`src/componentes/EditorImagem.tsx`, funções em `src/imagem/processamento.ts`): toda imagem escolhida abre no editor antes de ir para a Moovin, e a imagem atual pode ser reeditada.
  - **Remover o fundo por cor:** cor do canto ou conta-gotas, com tolerância; por padrão só o fundo ligado às bordas, preservando partes internas da mesma cor.
  - **Remover o fundo com IA:** usa o rembg (MIT), self-hosted no compose, só na rede interna, com o modelo `isnet-general-use` (Apache 2.0). Rotas `/api/imagem/recursos` e `/api/imagem/remover-fundo`; sem `REMBG_URL`, o botão some.
  - **Enquadrar:** arrastar, zoom pela roda do mouse ou controle deslizante, margem e aparar as sobras transparentes.
  - **Redimensionar:** saída PNG quadrada de 64, 128, 256 ou 512 px, com desfazer.
  - Imagens já salvas na Moovin são baixadas pelo servidor (`/api/imagem/baixar`, só `storage.moovin.store`), porque o canvas não lê pixels de outro domínio.

### Aparência: Templater (`src/telas/Templater.tsx`)

O editor ocupa a janela inteira, como o editor de temas da Moovin, e o botão **× Fechar** volta ao menu (avisa se houver alterações não salvas). O botão **Visualizar** abre a **prévia em tela cheia**, que usa o mesmo renderizador do script da loja (`src/loja/Pagina.tsx`) dentro de um iframe com a largura do aparelho (desktop, tablet e celular), para o CSS responsivo valer como na loja. A mesma prévia é usada na tela do produto, com o template publicado.

Editor feito com [Puck](https://puckeditor.com/) (`@puckeditor/core`) dentro do visual do painel Moovin, com a interface em português.

- **Layout padrão da loja** (`src/templater/padrao.ts`): reproduz o Script_Produto V3, com galeria e dois cartões em colunas, abas de detalhes e barra de compra fixa. O botão "Restaurar padrão" volta a ele.
- **Blocos** (`src/templater/config.tsx`), em quatro grupos:
  - *Estrutura:* Colunas e Cartão, que recebem outros blocos;
  - *Produto (Moovin):* Galeria, Nome do produto, Preço/quantidade/comprar e Barra de compra fixa. Representam componentes nativos: o template decide onde aparecem, mas quem executa é a Moovin;
  - *Complemento do cadastro:* Resumo, Preço por kg/L/un e Abas de detalhes. As abas padrão são definidas no template e ligadas a campos do Complemento; o produto pode ter abas extras. Cada aba é uma lista de itens com título e texto formatado;
  - *Conteúdo:* Texto livre.
- **Dados do produto** (`src/templater/produto.ts`): os blocos leem `moovin` (recorte do cadastro) e `complemento` (o Complemento do cadastro). A prévia usa um produto cadastrado na tela de Produtos, escolhido no topo.
- Cada bloco pode ter um nome próprio, que aparece na Estrutura e na etiqueta da prévia.
- Prévia em desktop e celular, com o botão "Interagir com a prévia" para testar as abas. O rascunho e a publicação ficam no `localStorage`, e o template pode ser exportado em JSON.

O salvamento local é apenas para o protótipo. Ainda não há backend, API de templates nem renderizador na loja.

## Formato do template

O template é o JSON de dados do Puck (`root` + `content`). As cores ficam em `root.props`, e as colunas e os cartões guardam seus blocos em listas dentro de `props`:

```json
{
  "root": { "props": { "title": "Página de produto — padrão", "corPrincipal": "#173a4d", "corDestaque": "#b58a3c" } },
  "content": [
    { "type": "Colunas", "props": { "id": "colunas-produto", "proporcao": "50/50",
      "esquerda": [{ "type": "Galeria", "props": { "id": "galeria", "sombra": "sim" } }],
      "direita": [{ "type": "Cartao", "props": { "id": "cartao-compra", "fundo": "branco",
        "conteudo": [{ "type": "LinhaCompra", "props": { "id": "linha-compra" } }] } }] } },
    { "type": "AbasDetalhes", "props": { "id": "abas", "sobretitulo": "CONHEÇA O PRODUTO", "titulo": "Informações e detalhes" } }
  ]
}
```

Os valores de `type` são blocos conhecidos pelo renderizador, nunca código executável. Os blocos não guardam dados do produto: eles os leem do produto em exibição.

## Sessão e integração com a loja

O protótipo não lê cookies nem envia chamadas à API Moovin. Quando a API de templates for implementada, prefira um cookie de sessão `HttpOnly`, `Secure` e `SameSite` adequado ao fluxo, enviado pelo navegador com `credentials: "include"`. O JavaScript da página não deve copiar ou expor o token. A API deverá validar a sessão, autorizar a loja e retornar somente a configuração publicada para ela.

Antes da integração, definir:

- endpoint e formato para buscar/publicar templates;
- domínio e política de CORS da API;
- como a sessão da loja é reconhecida entre os domínios;
- interfaces oficiais para dados do produto e ações nativas (variação, quantidade, carrinho e frete);
- fallback se a API de template estiver indisponível ou retornar um formato incompatível.
