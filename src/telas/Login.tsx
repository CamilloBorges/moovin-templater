import { useState, type FormEvent } from "react";
import { api, ErroApi, type Sessao } from "../api";

// Entrada no painel com o usuário da Moovin (o mesmo do id.moovin.app): e-mail e senha,
// código de verificação se a conta usar 2FA, e escolha da loja quando houver mais de uma.
export function Login({ sessao, aoMudar }: { sessao: Sessao; aoMudar: (s: Sessao) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(caminho: string, corpo: unknown) {
    setErro("");
    setEnviando(true);
    try {
      aoMudar(await api<Sessao>(caminho, { corpo }));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível falar com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  const aoEnviar = (acao: () => void) => (e: FormEvent) => { e.preventDefault(); acao(); };
  const contas = (sessao.contas ?? []).filter((c) => c.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  return (
    <div className="login-fundo">
      <div className="login-cartao">
        <div className="brand-lockup">
          <div className="brand-mark">m</div>
          <div><strong>moovin</strong><span>TEMPLATER</span></div>
        </div>

        {sessao.etapa === "login" && (
          <form onSubmit={aoEnviar(() => enviar("sessao/login", { email, senha }))}>
            <h1>Que bom ter você aqui!</h1>
            <p>Entre com o seu usuário da Moovin.</p>
            <label className="campo"><span className="campo-rotulo">E-mail</span>
              <input className="entrada" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="campo"><span className="campo-rotulo">Senha</span>
              <input className="entrada" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </label>
            {erro && <p className="campo-erro">{erro}</p>}
            <button className="button button-primary" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
          </form>
        )}

        {sessao.etapa === "2fa" && (
          <form onSubmit={aoEnviar(() => enviar("sessao/2fa", { codigo }))}>
            <h1>Verificação em duas etapas</h1>
            <p>A Moovin enviou um código de 6 dígitos para o seu e-mail.</p>
            <label className="campo"><span className="campo-rotulo">Código</span>
              <input className="entrada codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} autoFocus />
            </label>
            {erro && <p className="campo-erro">{erro}</p>}
            <button className="button button-primary" disabled={enviando || codigo.length !== 6}>Confirmar</button>
            <button type="button" className="button button-plain" onClick={() => enviar("sessao/sair", {})}>Voltar</button>
          </form>
        )}

        {sessao.etapa === "conta" && (
          <div>
            <h1>Escolha a loja</h1>
            <input className="entrada" placeholder="Pesquisar nome da loja" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <div className="lista-contas">
              {contas.map((c) => (
                <button key={c.id} type="button" disabled={enviando} onClick={() => enviar("sessao/conta", { contaId: c.id })}>{c.nome}</button>
              ))}
              {contas.length === 0 && <p className="vazio">Nenhuma loja encontrada.</p>}
            </div>
            {erro && <p className="campo-erro">{erro}</p>}
            <button type="button" className="button button-plain" onClick={() => enviar("sessao/sair", {})}>Sair</button>
          </div>
        )}
      </div>
    </div>
  );
}
