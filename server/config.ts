// Configuração do servidor, por variáveis de ambiente.
export const config = {
  porta: Number(process.env.PORTA ?? 3001),
  // No contêiner, HOST=0.0.0.0 para o proxy do EasyPanel alcançar o servidor.
  host: process.env.HOST ?? "127.0.0.1",
  // A mesma API que o painel da Moovin usa (store.moovin.app/api repassa para ela).
  moovinApi: (process.env.MOOVIN_API ?? "https://api.moovin.app").replace(/\/$/, ""),
  // Sem MONGO_URL, o servidor sobe um MongoDB local de desenvolvimento (mongodb-memory-server).
  mongoUrl: process.env.MONGO_URL ?? "",
  mongoBanco: process.env.MONGO_BANCO ?? "templater",
  // Em produção (HTTPS), o cookie de sessão precisa ser Secure.
  cookieSeguro: process.env.COOKIE_SEGURO === "1",
  sessaoHoras: Number(process.env.SESSAO_HORAS ?? 12),
  // Remoção de fundo por IA (rembg, self-hosted na rede interna). Em branco, o editor só tem a remoção por cor.
  rembgUrl: (process.env.REMBG_URL ?? "").replace(/\/$/, ""),
  rembgModelo: process.env.REMBG_MODELO ?? "u2net", // modelo padrão (ver MODELOS_IA em app.ts)
  // Loja na Moovin (a tela de Implantação abre a página de um produto para ver se o script carrega).
  lojaUrl: (process.env.LOJA_URL ?? "https://shoptest.bomgado.com").replace(/\/$/, ""),
};
