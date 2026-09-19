// Tela "Lançamentos": lista todas as receitas/despesas do mês escolhido,
// com filtro por tipo e busca por descrição. Cada item leva para o
// formulário de edição.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarTransacoes, listarCategorias, type Transacao, type Categoria, type TipoTransacao } from '../db';
import { formatDataCurta, mesAtual } from '../utils';
import { Valor } from '../privacidade';
import AjudaTela from '../components/AjudaTela';

export default function Lancamentos() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [mes, setMes] = useState(mesAtual());
  const [tipo, setTipo] = useState<TipoTransacao | ''>('');
  const [busca, setBusca] = useState('');

  // Categorias só precisam ser carregadas uma vez.
  useEffect(() => {
    listarCategorias().then(setCategorias);
  }, []);

  // Já as transações são recarregadas sempre que o filtro de mês ou tipo muda.
  useEffect(() => {
    listarTransacoes({ mes, tipo: tipo || undefined }).then(setTransacoes);
  }, [mes, tipo]);

  // Mapa id -> categoria, pra não precisar procurar na lista toda vez que
  // um item da lista precisa mostrar o nome da categoria.
  const categoriaPorId = useMemo(() => {
    const map = new Map<string, Categoria>();
    categorias.forEach((c) => map.set(c.id, c));
    return map;
  }, [categorias]);

  // Filtro de busca por texto é feito aqui no navegador (não no banco),
  // já que a lista do mês normalmente é pequena.
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return transacoes;
    return transacoes.filter((t) => t.descricao.toLowerCase().includes(termo));
  }, [transacoes, busca]);

  return (
    <div>
      <div className="card-row">
        <h2>Lançamentos</h2>
        <Link to="/categorias" style={{ fontSize: 13 }}>
          Gerenciar categorias
        </Link>
      </div>

      <AjudaTela>
        Receitas e despesas avulsas do dia a dia (mercado, transporte, freela...). Contas fixas, parcelamentos e
        cartão de crédito têm suas próprias telas em "Contas" — não precisa lançar aqui.
      </AjudaTela>

      <Link to="/lancamentos/novo" className="btn fab-link">
        + Novo lançamento
      </Link>

      <Link to="/voz" className="btn btn-secondary fab-link">
        🎤 Lançamento por voz
      </Link>

      <div className="field">
        <label>Mês</label>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
      </div>

      <div className="field">
        <label>Tipo</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTransacao | '')}>
          <option value="">Todos</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
        </select>
      </div>

      <div className="field search-box">
        <input
          placeholder="Buscar por descrição..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {filtradas.length === 0 && <div className="empty">Nenhum lançamento encontrado.</div>}

      {filtradas.map((t) => (
        <Link
          key={t.id}
          to={`/lancamentos/${t.id}/editar`}
          className="card card-row"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div>
            <strong>{t.descricao}</strong>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {categoriaPorId.get(t.categoriaId)?.nome ?? '—'} · {formatDataCurta(t.data)}
            </div>
          </div>
          <span style={{ fontWeight: 700, color: t.tipo === 'receita' ? 'var(--ok)' : 'var(--danger)' }}>
            {t.tipo === 'receita' ? '+' : '-'} <Valor valor={t.valor} />
          </span>
        </Link>
      ))}
    </div>
  );
}
