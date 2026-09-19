// Tela de utilidade para gerar (ou apagar) dados de demonstração. Não
// aparece no menu de navegação — acesse digitando /#/demo na barra de
// endereços. Pensada para preparar o app antes de mostrar pra alguém.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apagarTodosOsDados, seedCategoriasPadrao } from '../db';
import { seedDadosDemo } from '../demo';

export default function Demo() {
  const [status, setStatus] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleGerarDemo() {
    setCarregando(true);
    setStatus('');
    try {
      await apagarTodosOsDados();
      await seedCategoriasPadrao();
      await seedDadosDemo();
      setStatus('Dados de demonstração criados! Vá para o Início para conferir.');
    } catch (e) {
      setStatus(`Erro ao gerar demonstração: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCarregando(false);
    }
  }

  async function handleApagarTudo() {
    if (!confirm('Isso apaga TODOS os dados do app (reais ou de demonstração) e não pode ser desfeito. Continuar?')) return;
    setCarregando(true);
    setStatus('');
    try {
      await apagarTodosOsDados();
      await seedCategoriasPadrao();
      setStatus('Todos os dados foram apagados. O app está zerado, com as categorias padrão de volta.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      <h2>Modo demonstração</h2>

      <div className="card">
        <p style={{ marginTop: 0 }}>
          Use esta tela para preencher o app com dados fictícios (renda, despesas, contas fixas, um
          parcelamento e metas) só pra fins de apresentação.
        </p>
        <p style={{ color: 'var(--danger)', fontWeight: 600 }}>
          Recomendado: abra o app numa aba anônima/privada do navegador antes de continuar, assim os
          dados de demonstração não se misturam com os seus dados reais (cada aba anônima tem seu
          próprio armazenamento, separado do navegador normal).
        </p>
      </div>

      <button className="btn fab-link" onClick={handleGerarDemo} disabled={carregando}>
        {carregando ? 'Gerando...' : 'Gerar dados de demonstração'}
      </button>

      <button className="btn btn-danger" onClick={handleApagarTudo} disabled={carregando}>
        Apagar tudo e recomeçar do zero
      </button>

      {status && (
        <p style={{ marginTop: 16, color: status.startsWith('Erro') ? 'var(--danger)' : 'var(--ok)' }}>{status}</p>
      )}

      <Link to="/" className="btn btn-secondary" style={{ marginTop: 16 }}>
        Ir para o Início
      </Link>
    </div>
  );
}
