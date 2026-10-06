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
};
