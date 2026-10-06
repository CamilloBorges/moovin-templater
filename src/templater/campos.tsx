// Campos do Puck tipados como Field<any>: os valores podem vir vazios (padrão do template).
import { useState } from "react";
import type { Field } from "@puckeditor/core";
import { enviarImagem } from "../produtos/badges";
import { FONTES } from "./estilo";

// Campos do editor (Puck) para as propriedades de estilo dos blocos.

const TAMANHOS_TEXTO = [11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40];

// Cor: seletor + valor em hexadecimal; vazio = padrão do template.
export function campoCor(label: string): Field<any> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly }) => (
      <div className="campo-cor-puck">
        <input type="color" disabled={readOnly} value={value || "#000000"} onChange={(e) => onChange(e.target.value)} />
        <input className="entrada" disabled={readOnly} value={value ?? ""} placeholder="Padrão do template" maxLength={7}
          onChange={(e) => onChange(e.target.value.trim())} />
        {value && <button type="button" className="botao-icone" title="Voltar ao padrão" onClick={() => onChange("")}>×</button>}
      </div>
    ),
  };
}

export const campoFonte = (label = "Fonte"): Field<any> => ({
  type: "select",
  label,
  options: [{ label: "Padrão do template", value: "" }, ...FONTES.map((f) => ({ label: f.nome, value: f.id }))],
});

export const campoTamanho = (label = "Tamanho", tamanhos = TAMANHOS_TEXTO): Field<any> => ({
  type: "select",
  label,
  options: [{ label: "Padrão do template", value: 0 }, ...tamanhos.map((px) => ({ label: `${px} px`, value: px }))],
});

// Grupo fonte + cor + tamanho.
export const campoTexto = (label: string): Field<any> => ({
  type: "object",
  label,
  objectFields: { fonte: campoFonte(), cor: campoCor("Cor"), tamanho: campoTamanho() },
});

// Imagem: endereço ou envio de arquivo (vai para a Moovin, como as dos badges).
export function campoImagem(label: string): Field<any> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly }) => <CampoImagem valor={value ?? ""} aoMudar={onChange} somenteLeitura={!!readOnly} />,
  };
}

function CampoImagem({ valor, aoMudar, somenteLeitura }: { valor: string; aoMudar: (v: string) => void; somenteLeitura: boolean }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro("");
    setEnviando(true);
    try {
      aoMudar(await enviarImagem(`fundo-${arquivo.name.replace(/\.[^.]+$/, "")}`, arquivo, "templater/fundos"));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <div className="campo-imagem-puck">
      {valor && <img src={valor} alt="" />}
      <input className="entrada" disabled={somenteLeitura} value={valor} placeholder="https://" onChange={(e) => aoMudar(e.target.value.trim())} />
      <input type="file" accept="image/*" disabled={somenteLeitura || enviando} onChange={(e) => { enviar(e.target.files?.[0]); e.target.value = ""; }} />
      {enviando && <small>Enviando para a Moovin…</small>}
      {erro && <small className="campo-erro">{erro}</small>}
    </div>
  );
}
