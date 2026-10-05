# Editor de página de produto

Primeiro MVP de um editor visual para compor a página de produto, mantendo a Moovin responsável pelos dados e pelas funcionalidades nativas da loja.

- [`docs/HISTORICO.md`](docs/HISTORICO.md): origem do projeto, decisões e próximos passos.
- [`loja/script-produto-v3.js`](loja/script-produto-v3.js): o Script_Produto que roda hoje na loja, base para o renderizador.

## Executar localmente

```bash
npm install
npm run dev
```

Para validar a versão de produção:

```bash
npm run build
npm run preview
```

## O que já está implementado

Editor feito com [Puck](https://puckeditor.com/) (`@puckeditor/core`) dentro do visual do painel Moovin, com a interface em português.

- **Layout padrão da loja** (`src/templater/padrao.ts`): reproduz o Script_Produto V3, com galeria e dois cartões em colunas, abas de detalhes e barra de compra fixa. O botão "Restaurar padrão" volta a ele.
- **Blocos** (`src/templater/config.tsx`), em quatro grupos:
  - *Estrutura:* Colunas e Cartão, que recebem outros blocos;
  - *Produto (Moovin):* Galeria, Nome do produto, Preço/quantidade/comprar e Barra de compra fixa. Representam componentes nativos: o template decide onde aparecem, mas quem executa é a Moovin;
  - *Complemento do cadastro:* Resumo, Preço por kg/L/un e Abas de detalhes. As abas padrão são definidas no template e ligadas a campos do Complemento; o produto pode ter abas extras. Cada aba é uma lista de itens com título e texto formatado;
  - *Conteúdo:* Texto livre.
- **Dados do produto** (`src/templater/produto.ts`): os blocos leem `moovin` (o cadastro atual) e `complemento` (os campos que o futuro Complemento do cadastro vai fornecer). A prévia usa os Cubos de Panela com o conteúdo publicado no shoptest.
- Cada bloco pode ter um nome próprio, que aparece na Estrutura e na etiqueta da prévia.
- Prévia em desktop e celular, com o botão "Interagir com a prévia" para testar as abas. O rascunho e a publicação ficam no `localStorage`, e o template pode ser exportado em JSON.

O salvamento local é apenas para o protótipo. Ainda não há API de templates nem renderizador na loja.

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
