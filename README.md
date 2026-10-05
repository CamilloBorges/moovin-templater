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

- Interface administrativa responsiva inspirada em painéis de e-commerce.
- Catálogo de componentes e prévia desktop/mobile da página de produto.
- Seleção, reordenação por arrastar, renomeação, visibilidade e remoção de componentes.
- Salvamento de rascunho e publicação local no `localStorage`.
- Exportação da composição atual como JSON.

O salvamento local é apenas para o protótipo. Ainda não há backend de templates nem integração com uma loja Moovin real.

## Formato inicial do template

```json
{
  "version": 1,
  "name": "Página de produto",
  "updatedAt": "2026-10-05T15:00:00.000Z",
  "blocks": [
    { "type": "gallery", "label": "Galeria de imagens", "visible": true },
    { "type": "title", "label": "Nome do produto", "visible": true },
    { "type": "price", "label": "Preço", "visible": true },
    { "type": "variants", "label": "Variações", "visible": true },
    { "type": "buyButton", "label": "Botão comprar", "visible": true }
  ]
}
```

Os valores de `type` são identificadores de componentes conhecidos pelo renderizador, não código executável. A API de templates deverá persistir e devolver esse JSON; o script instalado na loja será responsável por renderizar cada tipo e conectar componentes funcionais às interfaces nativas documentadas pela Moovin.

## Sessão e integração com a loja

O protótipo não lê cookies nem envia chamadas à API Moovin. Quando a API de templates for implementada, prefira um cookie de sessão `HttpOnly`, `Secure` e `SameSite` adequado ao fluxo, enviado pelo navegador com `credentials: "include"`. O JavaScript da página não deve copiar ou expor o token. A API deverá validar a sessão, autorizar a loja e retornar somente a configuração publicada para ela.

Antes da integração, definir:

- endpoint e formato para buscar/publicar templates;
- domínio e política de CORS da API;
- como a sessão da loja é reconhecida entre os domínios;
- interfaces oficiais para dados do produto e ações nativas (variação, quantidade, carrinho e frete);
- fallback se a API de template estiver indisponível ou retornar um formato incompatível.
