// Tela de detalhe de um cartão: mostra o limite disponível e a fatura de
// um mês por vez (com navegação entre meses), permitindo pagar a fatura
// inteira de uma vez — o que gera uma Transacao (despesa) para cada
// parcela daquele mês, preservando a categoria de cada compra original.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addMonths, format, parseISO } from 'date-fns';
import {
  buscarCartao,
  listarComprasCartao,
  statusFatura,
  limiteDisponivel,
  proximaFaturaAberta,
  pagarFatura,
  type CartaoCredito,
  type CompraCartao,
} from '../db';
import StatusBadge, { textoStatusFatura } from '../components/StatusBadge';
import { formatDataCurta, formatMesLabel } from '../utils';
import { Valor } from '../privacidade';
import AjudaTela from '../components/AjudaTela';

function mesAnterior(mes: string): string {
  return format(addMonths(parseISO(`${mes}-01`), -1), 'yyyy-MM');
}

function mesSeguinte(mes: string): string {
  return format(addMonths(parseISO(`${mes}-01`), 1), 'yyyy-MM');
}

export default function CartaoDetalhe() {
  const { id } = useParams();
  const [cartao, setCartao] = useState<CartaoCredito | null | undefined>(undefined);
  const [compras, setCompras] = useState<CompraCartao[]>([]);
  const [mes, setMes] = useState<string | null>(null);
  const [fatura, setFatura] = useState<Awaited<ReturnType<typeof statusFatura>> | null>(null);
  const [limite, setLimite] = useState<Awaited<ReturnType<typeof limiteDisponivel>> | null>(null);

  useEffect(() => {
    if (!id) return;
    buscarCartao(id).then((c) => setCartao(c ?? null));
    listarComprasCartao(id).then(setCompras);
    proximaFaturaAberta(id).then(setMes);
  }, [id]);

  async function carregarFatura() {
    if (!id || !mes) return;
    setFatura(await statusFatura(id, mes));
    setLimite(await limiteDisponivel(id));
  }

  useEffect(() => {
    carregarFatura();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mes]);

  async function handlePagarFatura() {
    if (!id || !mes) return;
    await pagarFatura(id, mes);
    carregarFatura();
  }

  if (cartao === undefined) return <p>Carregando...</p>;
  if (cartao === null) return <div className="empty">Cartão não encontrado.</div>;

  const compraPorId = new Map(compras.map((c) => [c.id, c]));

  return (
    <div>
      <h2>{cartao.nome}</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Fecha dia {cartao.diaFechamento} · Vence dia {cartao.diaVencimento}
        {!cartao.ativo && ' · Inativo'}
      </p>
      <AjudaTela>
        Navegue entre os meses para ver cada fatura. Pague a fatura inteira quando ela vencer — isso registra a
        despesa de cada compra na categoria certa, automaticamente.
      </AjudaTela>

      {limite && (
        <div className="card">
          <div className="card-row">
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Limite disponível</div>
              <strong style={{ fontSize: 20 }}>
                <Valor valor={limite.disponivel} />
              </strong>
            </div>
            <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>
              <Valor valor={limite.usado} /> usado
              <br />
              de <Valor valor={limite.limite} />
            </div>
          </div>
        </div>
      )}

      <Link to={`/contas/cartoes/${cartao.id}/editar`} className="btn btn-secondary fab-link">
        Editar cartão
      </Link>
      <Link to={`/contas/cartoes/compras/novo?cartaoId=${cartao.id}`} className="btn fab-link">
        + Nova compra
      </Link>

      {mes && (
        <div className="card-row" style={{ marginBottom: 10, gap: 8 }}>
          <button className="btn btn-secondary btn-small" onClick={() => setMes(mesAnterior(mes))}>
            ← Anterior
          </button>
          <strong style={{ flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>
            {formatMesLabel(mes)}
          </strong>
          <button className="btn btn-secondary btn-small" onClick={() => setMes(mesSeguinte(mes))}>
            Próxima →
          </button>
        </div>
      )}

      {fatura && (
        <div className="card">
          <div className="card-row">
            <div>
              <strong>Total da fatura</strong>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                <Valor valor={fatura.total} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Vence em {formatDataCurta(fatura.vencimento)}
              </div>
            </div>
            <StatusBadge
              nivel={fatura.nivel}
              texto={textoStatusFatura(fatura.nivel, fatura.diasRestantes, fatura.paga)}
            />
          </div>
          {!fatura.paga && fatura.total > 0 && (
            <button className="btn btn-small" style={{ marginTop: 10 }} onClick={handlePagarFatura}>
              Pagar fatura
            </button>
          )}
        </div>
      )}

      {fatura && fatura.parcelas.length === 0 && (
        <div className="empty">Nenhuma compra nesta fatura.</div>
      )}

      {fatura?.parcelas.map((parcela) => {
        const compra = compraPorId.get(parcela.compraId);
        return (
          <div key={parcela.id} className="card">
            <div className="card-row">
              <div>
                <strong>{compra?.descricao ?? 'Compra removida'}</strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {compra && compra.numeroParcelas > 1 && `${parcela.numero}/${compra.numeroParcelas} · `}
                  <Valor valor={parcela.valor} />
                </div>
              </div>
              {compra && (
                <Link to={`/contas/cartoes/compras/${compra.id}/editar`} className="btn btn-secondary btn-small">
                  Editar
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
