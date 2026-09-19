// Tela "Início": o painel principal do app. Mostra a renda do mês, quanto
// já foi gasto, o que falta pagar, o atalho de "gasto rápido" para
// besteiras/lanches, e uma lista de "Atenção necessária" com tudo que
// está vencendo ou estourando o orçamento.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarContasFixas,
  buscarPagamentoDoMes,
  calcularStatusContaFixa,
  listarParcelasPendentes,
  buscarParcelamento,
  statusParcela,
  listarOrcamentos,
  resumoGastoPorCategoriaNoMes,
  calcularStatusOrcamento,
  buscarCategoria,
  listarCategorias,
  resumoMes,
  listarTransacoes,
  salvarTransacao,
  salvarRendaMensal,
  listarCartoes,
  proximaFaturaAberta,
  statusFatura,
  NOME_GASTOS_VARIAVEIS,
  type ContaFixa,
  type Parcela,
  type Parcelamento,
  type Orcamento,
  type Categoria,
  type CartaoCredito,
} from '../db';
import StatusBadge, {
  textoStatusContaFixa,
  textoStatusParcela,
  textoStatusOrcamento,
  textoStatusFatura,
} from '../components/StatusBadge';
import AjudaTela from '../components/AjudaTela';
import { Valor } from '../privacidade';
import { mesAtual, hojeISO } from '../utils';

// Cada "ComStatus" combina o registro (conta/parcela/orçamento) com os
// dados que precisam ser calculados na hora (status de vencimento,
// categoria já resolvida) — assim a tela não recalcula tudo de novo a
// cada re-render.
interface ContaFixaComStatus {
  conta: ContaFixa;
  categoria?: Categoria;
  status: ReturnType<typeof calcularStatusContaFixa>;
}

interface ParcelaComStatus {
  parcela: Parcela;
  parcelamento: Parcelamento;
  status: ReturnType<typeof statusParcela>;
}

interface OrcamentoComStatus {
  orcamento: Orcamento;
  categoria?: Categoria;
  status: ReturnType<typeof calcularStatusOrcamento>;
}

interface CartaoComFatura {
  cartao: CartaoCredito;
  status: Awaited<ReturnType<typeof statusFatura>>;
}

// Valor inicial do resumo, usado enquanto os dados ainda não carregaram
// do banco (evita a tela mostrar "undefined" por uma fração de segundo).
const resumoInicial = { rendaBase: 0, receitasExtras: 0, receitas: 0, despesas: 0, saldo: 0 };

export default function Dashboard() {
  const mes = mesAtual();
  const [temTransacoes, setTemTransacoes] = useState<boolean | null>(null);
  const [resumo, setResumo] = useState(resumoInicial);
  const [contasFixas, setContasFixas] = useState<ContaFixaComStatus[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaComStatus[]>([]);
  const [orcamentos, setOrcamentos] = useState<OrcamentoComStatus[]>([]);
  const [cartoes, setCartoes] = useState<CartaoComFatura[]>([]);
  const [categoriasDespesa, setCategoriasDespesa] = useState<Categoria[]>([]);
  const [editandoRenda, setEditandoRenda] = useState(false);
  const [rendaInput, setRendaInput] = useState('');
  const [gastoRapidoAberto, setGastoRapidoAberto] = useState(false);
  const [valorRapido, setValorRapido] = useState('');
  const [descricaoRapida, setDescricaoRapida] = useState('');

  // As quatro funções `carregarX` abaixo são separadas (em vez de tudo
  // dentro do useEffect) porque também precisam ser chamadas de novo
  // depois de uma ação do usuário — por exemplo, depois de salvar um
  // gasto rápido, chamamos carregarResumo() e carregarOrcamentos() de
  // novo pra tela atualizar na hora, sem precisar dar F5.

  async function carregarResumo() {
    const r = await resumoMes(mes);
    setResumo(r);
    setRendaInput(r.rendaBase ? String(r.rendaBase) : '');
  }

  async function carregarContasFixas() {
    const contas = await listarContasFixas();
    const comStatus = await Promise.all(
      contas
        .filter((c) => c.ativa)
        .map(async (conta) => {
          const [pagamento, categoria] = await Promise.all([
            buscarPagamentoDoMes(conta.id, mes),
            buscarCategoria(conta.categoriaId),
          ]);
          return { conta, categoria, status: calcularStatusContaFixa(conta, pagamento) };
        })
    );
    setContasFixas(comStatus);
  }

  async function carregarParcelas() {
    const pendentes = await listarParcelasPendentes();
    const comStatus = await Promise.all(
      pendentes.map(async (parcela) => {
        const parcelamento = await buscarParcelamento(parcela.parcelamentoId);
        return parcelamento ? { parcela, parcelamento, status: statusParcela(parcela) } : null;
      })
    );
    setParcelas(comStatus.filter((p): p is ParcelaComStatus => p !== null));
  }

  async function carregarOrcamentos() {
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

  async function carregarCartoes() {
    const lista = await listarCartoes();
    const comStatus = await Promise.all(
      lista
        .filter((c) => c.ativo)
        .map(async (cartao) => {
          const mesFatura = await proximaFaturaAberta(cartao.id);
          return { cartao, status: await statusFatura(cartao.id, mesFatura) };
        })
    );
    setCartoes(comStatus);
  }

  useEffect(() => {
    listarTransacoes().then((t) => setTemTransacoes(t.length > 0));
    listarCategorias('despesa').then(setCategoriasDespesa);
    carregarResumo();
    carregarContasFixas();
    carregarParcelas();
    carregarOrcamentos();
    carregarCartoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSalvarRenda(ev: React.FormEvent) {
    ev.preventDefault();
    const valorNumerico = Number(rendaInput.replace(',', '.')) || 0;
    await salvarRendaMensal(mes, valorNumerico);
    setEditandoRenda(false);
    carregarResumo();
  }

  // Acha a categoria "Gastos variáveis" (criada automaticamente pelo
  // banco, ver db.ts) e o orçamento vinculado a ela, para desenhar o card
  // de "gasto rápido" com a barra de progresso do mês.
  const categoriaGastosVariaveis = categoriasDespesa.find((c) => c.nome === NOME_GASTOS_VARIAVEIS);
  const orcamentoGastosVariaveis = orcamentos.find(
    (o) => categoriaGastosVariaveis && o.orcamento.categoriaId === categoriaGastosVariaveis.id
  );

  // Salva um gasto rápido (lanche, besteira) já na categoria certa e com
  // a data de hoje, sem precisar abrir o formulário completo de lançamento.
  async function handleGastoRapido(ev: React.FormEvent) {
    ev.preventDefault();
    if (!categoriaGastosVariaveis) return;
    const valorNumerico = Number(valorRapido.replace(',', '.'));
    if (!valorNumerico || valorNumerico <= 0) return;
    await salvarTransacao({
      tipo: 'despesa',
      valor: valorNumerico,
      categoriaId: categoriaGastosVariaveis.id,
      data: hojeISO(),
      descricao: descricaoRapida.trim() || 'Besteira/lanche',
    });
    setValorRapido('');
    setDescricaoRapida('');
    setGastoRapidoAberto(false);
    carregarResumo();
    carregarOrcamentos();
  }

  // "Atenção necessária": tudo que não está com nível 'ok' (vencendo,
  // atrasado ou com orçamento estourado) vira um card clicável na lista.
  const contasAtencao = contasFixas.filter((c) => c.status.nivel !== 'ok');
  const parcelasAtencao = parcelas.filter((p) => p.status.nivel !== 'ok');
  const orcamentosAtencao = orcamentos.filter((o) => o.status.nivel !== 'ok');
  const cartoesAtencao = cartoes.filter((c) => c.status.nivel !== 'ok' && c.status.total > 0);
  const totalAtencao =
    contasAtencao.length + parcelasAtencao.length + orcamentosAtencao.length + cartoesAtencao.length;

  // "Falta pagar": soma das contas fixas ainda não pagas + parcelas deste
  // mês (ou atrasadas de meses anteriores) que ainda não foram pagas +
  // faturas de cartão ainda não pagas. Isso é dinheiro já comprometido mas
  // que ainda não saiu da conta.
  const contasNaoPagas = contasFixas.filter((c) => !c.status.paga);
  const parcelasAPagarEsteMes = parcelas.filter((p) => p.parcela.vencimento.slice(0, 7) <= mes);
  const faturasNaoPagas = cartoes.filter((c) => !c.status.paga && c.status.mesReferencia <= mes);
  const totalFaltaPagar =
    contasNaoPagas.reduce((s, c) => s + c.conta.valor, 0) +
    parcelasAPagarEsteMes.reduce((s, p) => s + p.parcela.valor, 0) +
    faturasNaoPagas.reduce((s, c) => s + c.status.total, 0);
  // Projeção: quanto sobraria se todas as contas pendentes fossem pagas agora.
  const sobraAposPagarTudo = resumo.saldo - totalFaltaPagar;

  return (
    <div>
      <h2>Visão geral</h2>
      <AjudaTela>
        Resumo do mês: quanto entrou, quanto já foi gasto e o que ainda falta pagar (contas, parcelas e faturas
        pendentes). Use "+ Nova despesa ou receita" para lançar algo avulso rapidamente.
      </AjudaTela>

      <div className="card">
        <div className="card-row">
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Renda do mês</div>
            <strong style={{ fontSize: 22 }}>
              <Valor valor={resumo.rendaBase} />
            </strong>
          </div>
          {!editandoRenda && (
            <button className="btn btn-secondary btn-small" onClick={() => setEditandoRenda(true)}>
              {resumo.rendaBase ? 'Editar' : 'Definir renda'}
            </button>
          )}
        </div>
        {editandoRenda && (
          <form onSubmit={handleSalvarRenda} className="card-row" style={{ marginTop: 10, gap: 8 }}>
            <input
              inputMode="decimal"
              autoFocus
              value={rendaInput}
              onChange={(e) => setRendaInput(e.target.value)}
              placeholder="Ex: 3000,00"
              style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}
            />
            <button type="submit" className="btn btn-small" style={{ width: 'auto' }}>
              Salvar
            </button>
          </form>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="num danger">
            <Valor valor={resumo.despesas} />
          </div>
          <div className="label">Já gasto no mês</div>
        </div>
        <div className="stat-card">
          <div className="num warn">
            <Valor valor={totalFaltaPagar} />
          </div>
          <div className="label">Falta pagar</div>
        </div>
        <div className="stat-card">
          <div className={`num ${resumo.saldo >= 0 ? 'ok' : 'danger'}`}>
            <Valor valor={resumo.saldo} />
          </div>
          <div className="label">Ainda tenho</div>
        </div>
        <div className="stat-card">
          <div className={`num ${sobraAposPagarTudo >= 0 ? 'ok' : 'danger'}`}>
            <Valor valor={sobraAposPagarTudo} />
          </div>
          <div className="label">Sobra após pagar tudo</div>
        </div>
      </div>

      {categoriaGastosVariaveis && (
        <div className="card">
          <div className="card-row">
            <strong>Gastos variáveis (lanches, besteiras...)</strong>
            {orcamentoGastosVariaveis && (
              <StatusBadge
                nivel={orcamentoGastosVariaveis.status.nivel}
                texto={textoStatusOrcamento(
                  orcamentoGastosVariaveis.status.nivel,
                  orcamentoGastosVariaveis.status.percentual
                )}
              />
            )}
          </div>
          {orcamentoGastosVariaveis && (
            <>
              <div className="progress-track">
                <div
                  className={`progress-fill ${orcamentoGastosVariaveis.status.nivel}`}
                  style={{ width: `${Math.min(100, orcamentoGastosVariaveis.status.percentual * 100)}%` }}
                />
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                <Valor valor={orcamentoGastosVariaveis.status.gasto} /> de{' '}
                <Valor valor={orcamentoGastosVariaveis.status.limite} /> este mês
              </div>
            </>
          )}

          {!gastoRapidoAberto ? (
            <button
              className="btn btn-secondary btn-small"
              style={{ marginTop: 10 }}
              onClick={() => setGastoRapidoAberto(true)}
            >
              + Registrar gasto rápido
            </button>
          ) : (
            <form onSubmit={handleGastoRapido} style={{ marginTop: 10 }}>
              <div className="field">
                <label>Valor (R$)</label>
                <input
                  inputMode="decimal"
                  autoFocus
                  value={valorRapido}
                  onChange={(e) => setValorRapido(e.target.value)}
                  placeholder="Ex: 12,50"
                />
              </div>
              <div className="field">
                <label>Descrição (opcional)</label>
                <input
                  value={descricaoRapida}
                  onChange={(e) => setDescricaoRapida(e.target.value)}
                  placeholder="Ex: Lanche na padaria"
                />
              </div>
              <div className="card-row" style={{ gap: 8 }}>
                <button type="submit" className="btn btn-small" style={{ flex: 1 }}>
                  Salvar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  style={{ flex: 1 }}
                  onClick={() => setGastoRapidoAberto(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <Link to="/lancamentos/novo" className="btn fab-link">
        + Nova despesa ou receita
      </Link>

      <Link to="/voz" className="btn btn-secondary fab-link">
        🎤 Lançamento por voz
      </Link>

      {totalAtencao > 0 && (
        <>
          <h3>Atenção necessária</h3>
          {contasAtencao.map(({ conta, categoria, status }) => (
            <Link
              key={conta.id}
              to="/contas"
              className={`card card-row att-${status.nivel}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div>
                <strong>{conta.descricao}</strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {categoria?.nome} · <Valor valor={conta.valor} />
                </div>
              </div>
              <StatusBadge
                nivel={status.nivel}
                texto={textoStatusContaFixa(status.nivel, status.diasRestantes, status.paga)}
              />
            </Link>
          ))}
          {parcelasAtencao.map(({ parcela, parcelamento, status }) => (
            <Link
              key={parcela.id}
              to={`/contas/parcelamentos/${parcelamento.id}`}
              className={`card card-row att-${status.nivel}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div>
                <strong>{parcelamento.descricao}</strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Parcela {parcela.numero}/{parcelamento.numeroParcelas} · <Valor valor={parcela.valor} />
                </div>
              </div>
              <StatusBadge
                nivel={status.nivel}
                texto={textoStatusParcela(status.nivel, status.diasRestantes, parcela.paga)}
              />
            </Link>
          ))}
          {orcamentosAtencao.map(({ orcamento, categoria, status }) => (
            <Link
              key={orcamento.id}
              to="/metas"
              className={`card card-row att-${status.nivel}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div>
                <strong>{categoria?.nome ?? 'Orçamento geral'}</strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  <Valor valor={status.gasto} /> de <Valor valor={status.limite} />
                </div>
              </div>
              <StatusBadge nivel={status.nivel} texto={textoStatusOrcamento(status.nivel, status.percentual)} />
            </Link>
          ))}
          {cartoesAtencao.map(({ cartao, status }) => (
            <Link
              key={cartao.id}
              to={`/contas/cartoes/${cartao.id}`}
              className={`card card-row att-${status.nivel}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div>
                <strong>Fatura {cartao.nome}</strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  <Valor valor={status.total} />
                </div>
              </div>
              <StatusBadge
                nivel={status.nivel}
                texto={textoStatusFatura(status.nivel, status.diasRestantes, status.paga)}
              />
            </Link>
          ))}
        </>
      )}

      {temTransacoes === false && resumo.rendaBase === 0 && (
        <div className="empty">
          <p>Comece definindo a renda do mês acima e registrando seus gastos.</p>
          <Link to="/lancamentos/novo" className="btn" style={{ marginTop: 12 }}>
            Registrar primeiro lançamento
          </Link>
        </div>
      )}
    </div>
  );
}
