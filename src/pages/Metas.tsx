import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarOrcamentos,
  resumoGastoPorCategoriaNoMes,
  calcularStatusOrcamento,
  buscarCategoria,
  excluirOrcamento,
  type Orcamento,
  type Categoria,
} from '../db';
import StatusBadge, { textoStatusOrcamento } from '../components/StatusBadge';
import { mesAtual } from '../utils';
import { Valor } from '../privacidade';
import AjudaTela from '../components/AjudaTela';

// Tela "Metas": lista todos os orçamentos mensais (geral ou por
// categoria) com uma barra de progresso mostrando quanto já foi gasto.

interface OrcamentoComStatus {
  orcamento: Orcamento;
  categoria?: Categoria;
  status: ReturnType<typeof calcularStatusOrcamento>;
}

export default function Metas() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoComStatus[]>([]);

  async function carregar() {
    const mes = mesAtual();
    const lista = await listarOrcamentos();
    const comStatus = await Promise.all(
      lista.map(async (orcamento) => {
        const [gasto, categoria] = await Promise.all([
          resumoGastoPorCategoriaNoMes(mes, orcamento.categoriaId),
          orcamento.categoriaId ? buscarCategoria(orcamento.categoriaId) : Promise.resolve(undefined),
        ]);
        return { orcamento, categoria, status: calcularStatusOrcamento(orcamento, gasto) };
      })
    );
    setOrcamentos(comStatus);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleExcluir(id: string) {
    if (!confirm('Excluir esta meta?')) return;
    await excluirOrcamento(id);
    carregar();
  }

  return (
    <div>
      <h2>Metas e orçamento mensal</h2>
      <AjudaTela>
        Defina limites de gasto mensal, por categoria ou geral (somando tudo), e acompanhe aqui quanto já foi usado
        em cada um.
      </AjudaTela>

      <Link to="/metas/novo" className="btn fab-link">
        + Nova meta
      </Link>

      {orcamentos.length === 0 && <div className="empty">Nenhuma meta de orçamento cadastrada.</div>}

      {orcamentos.map(({ orcamento, categoria, status }) => (
        <div key={orcamento.id} className="card">
          <div className="card-row">
            <strong>{categoria?.nome ?? 'Orçamento geral'}</strong>
            <StatusBadge nivel={status.nivel} texto={textoStatusOrcamento(status.nivel, status.percentual)} />
          </div>
          <div className="progress-track">
            <div
              className={`progress-fill ${status.nivel}`}
              style={{ width: `${Math.min(100, status.percentual * 100)}%` }}
            />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            <Valor valor={status.gasto} /> de <Valor valor={status.limite} />
          </div>
          <div className="card-row" style={{ marginTop: 10, gap: 8 }}>
            <Link to={`/metas/${orcamento.id}/editar`} className="btn btn-secondary btn-small" style={{ flex: 1 }}>
              Editar
            </Link>
            <button
              className="btn btn-danger btn-small"
              style={{ flex: 1 }}
              onClick={() => handleExcluir(orcamento.id)}
            >
              Excluir
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
