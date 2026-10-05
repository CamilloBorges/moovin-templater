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

## Acesso: login da Moovin

O painel só abre com uma sessão válida da Moovin, como o painel administrativo dela. Não usa chave de API: o login é o e-mail e a senha do usuário, com a verificação em duas etapas e a escolha da loja, no mesmo fluxo do `id.moovin.app`. Detalhes em `server/moovin.ts`.

- Os tokens da Moovin ficam só no servidor (MongoDB, coleção `sessoes`, que expira sozinha). O navegador recebe um cookie `HttpOnly` com o id da sessão.
- O painel chama a Moovin por `/api/moovin/<serviço>/...`. O servidor repassa com o token da loja (`X-Authorization: Bearer`), só para os serviços liberados.
- O token é revalidado na Moovin a cada 5 minutos. Se a Moovin recusar, a sessão acaba e o painel volta para o login.
- O Complemento do cadastro e os templates ficam no MongoDB, separados pela loja (`/api/complementos/:produtoId` e `/api/templates/:tipo`).

## Telas

O painel tem duas áreas, navegadas pelo endereço (`#/produtos` e `#/aparencia`).

### Produtos (`src/telas/produtos/`)

Substitui a tela de cadastro de produto da Moovin, com as mesmas seções, mais o Complemento:

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

### Aparência: Templater (`src/telas/Templater.tsx`)

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
