// Tela "Ajustes": backup dos dados do app. Como tudo é salvo só no
// IndexedDB deste navegador (ver comentário no topo de db.ts), esta tela
// existe para o usuário não perder tudo se limpar o cache, trocar de
// aparelho ou desinstalar o app — e para poder levar os dados para outro
// navegador/dispositivo manualmente.

import { useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { exportarDados, importarDados } from '../db';
import { hojeISO } from '../utils';
import AjudaTela from '../components/AjudaTela';
import { IconFileText } from '../components/Icons';

export default function Ajustes() {
  const [status, setStatus] = useState('');
  const [carregando, setCarregando] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  async function handleExportar() {
    setCarregando(true);
    setStatus('');
    try {
      const dados = await exportarDados();
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `financecontrol-backup-${hojeISO()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('Backup exportado! Guarde o arquivo baixado em um lugar seguro.');
    } catch (e) {
      setStatus(`Erro ao exportar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCarregando(false);
    }
  }

  async function handleArquivoSelecionado(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo depois, se precisar
    if (!arquivo) return;

    if (
      !confirm(
        'Importar um backup substitui TODOS os dados atuais do app (lançamentos, contas, cartões, metas etc.) pelos dados do arquivo. Essa ação não pode ser desfeita. Continuar?'
      )
    ) {
      return;
    }

    setCarregando(true);
    setStatus('');
    try {
      const texto = await arquivo.text();
      const dados = JSON.parse(texto);
      await importarDados(dados);
      setStatus('Dados restaurados com sucesso! Volte para o Início para conferir.');
    } catch (e) {
      setStatus(`Erro ao importar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      <h2>Ajustes</h2>
      <AjudaTela>
        Faça backup de todos os seus dados num arquivo, ou restaure um backup salvo anteriormente.
      </AjudaTela>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Backup dos dados</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Seus dados ficam salvos só neste navegador. Exporte um backup de vez em quando para não
          perder tudo se limpar o cache do navegador, trocar de celular ou desinstalar o app.
        </p>
        <button className="btn" onClick={handleExportar} disabled={carregando}>
          <IconFileText size={18} /> Exportar backup (.json)
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Restaurar backup</h3>
        <p style={{ color: 'var(--danger)', fontSize: 14, fontWeight: 600 }}>
          Isso substitui todos os dados atuais do app pelos dados do arquivo escolhido.
        </p>
        <input
          ref={inputArquivoRef}
          type="file"
          accept="application/json"
          onChange={handleArquivoSelecionado}
          style={{ display: 'none' }}
        />
        <button className="btn btn-secondary" onClick={() => inputArquivoRef.current?.click()} disabled={carregando}>
          Escolher arquivo de backup
        </button>
      </div>

      {status && (
        <p style={{ marginTop: 16, color: status.startsWith('Erro') ? 'var(--danger)' : 'var(--ok)' }}>{status}</p>
      )}

      <Link to="/" className="btn btn-secondary" style={{ marginTop: 16 }}>
        Ir para o Início
      </Link>
    </div>
  );
}
