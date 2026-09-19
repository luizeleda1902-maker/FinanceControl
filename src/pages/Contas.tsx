// Tela "Contas": alterna entre duas abas — Contas Fixas (recorrentes) e
// Parcelamentos (compras parceladas) — cada uma com um botão de "pagar"
// que já registra a transação de despesa correspondente.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarContasFixas,
  buscarPagamentoDoMes,
  calcularStatusContaFixa,
  pagarContaFixa,
  listarParcelamentos,
  listarParcelas,
  pagarParcela,
  statusParcela,
  listarCategorias,
  listarCartoes,
  proximaFaturaAberta,
  statusFatura,
  limiteDisponivel,
  pagarFatura,
  type ContaFixa,
  type Parcelamento,
  type Parcela,
  type Categoria,
  type CartaoCredito,
} from '../db';
import StatusBadge, {
  textoStatusContaFixa,
  textoStatusParcela,
  textoStatusFatura,
} from '../components/StatusBadge';
import { mesAtual } from '../utils';
import { Valor } from '../privacidade';
import AjudaTela from '../components/AjudaTela';

interface ContaFixaComStatus {
  conta: ContaFixa;
  status: ReturnType<typeof calcularStatusContaFixa>;
}

interface ParcelamentoComParcelas {
  parcelamento: Parcelamento;
  parcelas: Parcela[];
}

interface CartaoComFatura {
  cartao: CartaoCredito;
  mes: string;
  fatura: Awaited<ReturnType<typeof statusFatura>>;
  limite: Awaited<ReturnType<typeof limiteDisponivel>>;
}

export default function Contas() {
  const [aba, setAba] = useState<'fixas' | 'parcelamentos' | 'cartoes'>('fixas');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contasFixas, setContasFixas] = useState<ContaFixaComStatus[]>([]);
  const [parcelamentos, setParcelamentos] = useState<ParcelamentoComParcelas[]>([]);
  const [cartoes, setCartoes] = useState<CartaoComFatura[]>([]);

  async function carregarContasFixas() {
    const mes = mesAtual();
    const contas = await listarContasFixas();
    const comStatus = await Promise.all(
      contas.map(async (conta) => {
        const pagamento = await buscarPagamentoDoMes(conta.id, mes);
        return { conta, status: calcularStatusContaFixa(conta, pagamento) };
      })
    );
    setContasFixas(comStatus);
  }

  async function carregarParcelamentos() {
    const lista = await listarParcelamentos();
    const comParcelas = await Promise.all(
      lista.map(async (parcelamento) => ({ parcelamento, parcelas: await listarParcelas(parcelamento.id) }))
    );
    setParcelamentos(comParcelas);
  }

  async function carregarCartoes() {
    const lista = await listarCartoes();
    const comFatura = await Promise.all(
      lista.map(async (cartao) => {
        const mes = await proximaFaturaAberta(cartao.id);
        const [fatura, limite] = await Promise.all([statusFatura(cartao.id, mes), limiteDisponivel(cartao.id)]);
        return { cartao, mes, fatura, limite };
      })
    );
    setCartoes(comFatura);
  }

  useEffect(() => {
    listarCategorias().then(setCategorias);
    carregarContasFixas();
    carregarParcelamentos();
    carregarCartoes();
  }, []);

  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));

  // Depois de pagar, recarrega a lista pra atualizar o badge de status
  // (some o botão "Marcar como paga" e aparece "Paga este mês").
  async function handlePagarConta(id: string) {
    await pagarContaFixa(id);
    carregarContasFixas();
  }

  async function handlePagarParcela(id: string) {
    await pagarParcela(id);
    carregarParcelamentos();
  }

  async function handlePagarFatura(cartaoId: string, mes: string) {
    await pagarFatura(cartaoId, mes);
    carregarCartoes();
  }

  return (
    <div>
      <h2>Contas</h2>

      <div className="segmented">
        <button className={aba === 'fixas' ? 'active' : ''} onClick={() => setAba('fixas')}>
          Fixas
        </button>
        <button className={aba === 'parcelamentos' ? 'active' : ''} onClick={() => setAba('parcelamentos')}>
          Parcelamentos
        </button>
        <button className={aba === 'cartoes' ? 'active' : ''} onClick={() => setAba('cartoes')}>
          Cartões
        </button>
      </div>

      {aba === 'fixas' && (
        <>
          <AjudaTela>
            Contas que se repetem todo mês (aluguel, assinaturas...). Marque como paga quando quitar — isso já
            registra a despesa do mês certinho.
          </AjudaTela>

          <Link to="/contas/fixas/nova" className="btn fab-link">
            + Nova conta fixa
          </Link>

          {contasFixas.length === 0 && <div className="empty">Nenhuma conta fixa cadastrada.</div>}

          {contasFixas.map(({ conta, status }) => (
            <div key={conta.id} className="card">
              <div className="card-row">
                <div>
                  <strong>{conta.descricao}</strong>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {categoriaPorId.get(conta.categoriaId)?.nome} · <Valor valor={conta.valor} />
                  </div>
                </div>
                <StatusBadge
                  nivel={status.nivel}
                  texto={textoStatusContaFixa(status.nivel, status.diasRestantes, status.paga)}
                />
              </div>
              <div className="card-row" style={{ marginTop: 10, gap: 8 }}>
                {!status.paga && (
                  <button className="btn btn-small" style={{ flex: 1 }} onClick={() => handlePagarConta(conta.id)}>
                    Marcar como paga
                  </button>
                )}
                <Link
                  to={`/contas/fixas/${conta.id}/editar`}
                  className="btn btn-secondary btn-small"
                  style={{ flex: 1 }}
                >
                  Editar
                </Link>
              </div>
            </div>
          ))}
        </>
      )}

      {aba === 'parcelamentos' && (
        <>
          <AjudaTela>
            Compras parceladas fora do cartão de crédito (ex: boleto de loja, carnê). Pague cada parcela conforme
            for vencendo.
          </AjudaTela>

          <Link to="/contas/parcelamentos/novo" className="btn fab-link">
            + Novo parcelamento
          </Link>

          {parcelamentos.length === 0 && <div className="empty">Nenhum parcelamento cadastrado.</div>}

          {parcelamentos.map(({ parcelamento, parcelas }) => {
            const pagas = parcelas.filter((p) => p.paga).length;
            // `proxima` é a primeira parcela ainda não paga — é ela que o
            // botão "Pagar próxima parcela" quita. Se não sobrar nenhuma,
            // o parcelamento está totalmente quitado.
            const proxima = parcelas.find((p) => !p.paga);
            const status = proxima ? statusParcela(proxima) : undefined;
            return (
              <div key={parcelamento.id} className="card">
                <div className="card-row">
                  <div>
                    <strong>{parcelamento.descricao}</strong>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {categoriaPorId.get(parcelamento.categoriaId)?.nome} · {pagas}/{parcelamento.numeroParcelas} pagas
                    </div>
                  </div>
                  {status ? (
                    <StatusBadge
                      nivel={status.nivel}
                      texto={textoStatusParcela(status.nivel, status.diasRestantes, false)}
                    />
                  ) : (
                    <span className="badge badge-ok">Quitado</span>
                  )}
                </div>
                <div className="card-row" style={{ marginTop: 10, gap: 8 }}>
                  {proxima && (
                    <button className="btn btn-small" style={{ flex: 1 }} onClick={() => handlePagarParcela(proxima.id)}>
                      Pagar próxima parcela
                    </button>
                  )}
                  <Link
                    to={`/contas/parcelamentos/${parcelamento.id}`}
                    className="btn btn-secondary btn-small"
                    style={{ flex: 1 }}
                  >
                    Ver parcelas
                  </Link>
                </div>
              </div>
            );
          })}
        </>
      )}

      {aba === 'cartoes' && (
        <>
          <AjudaTela>
            Cartões de crédito: cadastre o cartão, registre as compras (à vista ou parceladas) e pague a fatura
            inteira quando ela vencer — cada compra vira uma despesa na categoria certa automaticamente.
          </AjudaTela>

          <Link to="/contas/cartoes/novo" className="btn fab-link">
            + Novo cartão
          </Link>

          {cartoes.length === 0 && <div className="empty">Nenhum cartão cadastrado.</div>}

          {cartoes.map(({ cartao, mes, fatura, limite }) => (
            <div key={cartao.id} className="card">
              <div className="card-row">
                <div>
                  <strong>{cartao.nome}</strong>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    <Valor valor={fatura.total} /> nesta fatura · <Valor valor={limite.disponivel} /> disponível
                  </div>
                </div>
                <StatusBadge
                  nivel={fatura.nivel}
                  texto={textoStatusFatura(fatura.nivel, fatura.diasRestantes, fatura.paga)}
                />
              </div>
              <div className="card-row" style={{ marginTop: 10, gap: 8 }}>
                {!fatura.paga && fatura.total > 0 && (
                  <button
                    className="btn btn-small"
                    style={{ flex: 1 }}
                    onClick={() => handlePagarFatura(cartao.id, mes)}
                  >
                    Pagar fatura
                  </button>
                )}
                <Link to={`/contas/cartoes/${cartao.id}`} className="btn btn-secondary btn-small" style={{ flex: 1 }}>
                  Ver fatura
                </Link>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
