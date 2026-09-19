// Tela "Categorias": lista e gerencia as categorias de receita/despesa.
// Não tem aba própria no menu de baixo — é acessada por um link na tela
// de Lançamentos.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarCategorias, type Categoria } from '../db';
import { corDaCategoria } from '../theme';
import AjudaTela from '../components/AjudaTela';

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    listarCategorias().then(setCategorias);
  }, []);

  const receitas = categorias.filter((c) => c.tipo === 'receita');
  const despesas = categorias.filter((c) => c.tipo === 'despesa');

  return (
    <div>
      <h2>Categorias</h2>
      <AjudaTela>
        Organize receitas e despesas em categorias — elas são usadas nos gráficos de relatórios e nas metas de
        orçamento.
      </AjudaTela>

      <Link to="/categorias/nova" className="btn fab-link">
        + Nova categoria
      </Link>

      <h3>Receitas</h3>
      {receitas.length === 0 && <div className="empty">Nenhuma categoria de receita.</div>}
      {receitas.map((c) => (
        <Link
          key={c.id}
          to={`/categorias/${c.id}/editar`}
          className="card card-row"
          style={{ textDecoration: 'none', color: 'inherit', gap: 10 }}
        >
          <span
            style={{ width: 12, height: 12, borderRadius: 999, background: corDaCategoria(c.corIndex), flexShrink: 0 }}
          />
          <strong style={{ flex: 1 }}>{c.nome}</strong>
        </Link>
      ))}

      <h3 style={{ marginTop: 16 }}>Despesas</h3>
      {despesas.length === 0 && <div className="empty">Nenhuma categoria de despesa.</div>}
      {despesas.map((c) => (
        <Link
          key={c.id}
          to={`/categorias/${c.id}/editar`}
          className="card card-row"
          style={{ textDecoration: 'none', color: 'inherit', gap: 10 }}
        >
          <span
            style={{ width: 12, height: 12, borderRadius: 999, background: corDaCategoria(c.corIndex), flexShrink: 0 }}
          />
          <strong style={{ flex: 1 }}>{c.nome}</strong>
        </Link>
      ))}
    </div>
  );
}
