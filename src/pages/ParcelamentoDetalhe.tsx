import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  buscarParcelamento,
  listarParcelas,
  pagarParcela,
  statusParcela,
  buscarCategoria,
  type Parcelamento,
  type Parcela,
  type Categoria,
} from '../db';
import StatusBadge, { textoStatusParcela } from '../components/StatusBadge';
import { formatDataCurta } from '../utils';
import { Valor } from '../privacidade';
import AjudaTela from '../components/AjudaTela';

// Tela de detalhe de um parcelamento: mostra o cronograma completo (todas
// as parcelas, pagas ou não) e permite pagar qualquer uma delas, mesmo
// fora de ordem.
export default function ParcelamentoDetalhe() {
  const { id } = useParams();
  // `undefined` = ainda carregando, `null` = não encontrado, objeto = carregado.
  const [parcelamento, setParcelamento] = useState<Parcelamento | null | undefined>(undefined);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [categoria, setCategoria] = useState<Categoria>();

  async function carregar() {
    if (!id) return;
    const p = await buscarParcelamento(id);
    setParcelamento(p ?? null);
    if (p) {
      setCategoria(await buscarCategoria(p.categoriaId));
      setParcelas(await listarParcelas(id));
    }
  }

  useEffect(() => {
    carregar();
  }, [id]);

  async function handlePagar(parcelaId: string) {
    await pagarParcela(parcelaId);
    carregar();
  }

  if (parcelamento === undefined) return <p>Carregando...</p>;
  if (parcelamento === null) return <div className="empty">Parcelamento não encontrado.</div>;

  const pagas = parcelas.filter((p) => p.paga).length;

  return (
    <div>
      <h2>{parcelamento.descricao}</h2>
      <AjudaTela>Cronograma completo das parcelas dessa compra. Pode pagar qualquer parcela, mesmo fora de ordem.</AjudaTela>
      <p style={{ color: 'var(--text-muted)' }}>
        {categoria?.nome} · <Valor valor={parcelamento.valorTotal} /> em {parcelamento.numeroParcelas}x · {pagas}/
        {parcelamento.numeroParcelas} pagas
      </p>

      <Link to={`/contas/parcelamentos/${parcelamento.id}/editar`} className="btn btn-secondary fab-link">
        Editar descrição/categoria
      </Link>

      {parcelas.map((parcela) => {
        const status = statusParcela(parcela);
        return (
          <div key={parcela.id} className="card">
            <div className="card-row">
              <div>
                <strong>
                  Parcela {parcela.numero}/{parcelamento.numeroParcelas}
                </strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  <Valor valor={parcela.valor} /> · vence em {formatDataCurta(parcela.vencimento)}
                </div>
              </div>
              <StatusBadge
                nivel={status.nivel}
                texto={textoStatusParcela(status.nivel, status.diasRestantes, parcela.paga)}
              />
            </div>
            {!parcela.paga && (
              <button className="btn btn-small" style={{ marginTop: 10 }} onClick={() => handlePagar(parcela.id)}>
                Marcar como paga
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
