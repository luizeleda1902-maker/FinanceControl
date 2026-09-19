// Formulário de criar/editar uma meta de orçamento mensal.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buscarCategoria, buscarOuCriarCategoria, listarOrcamentos, salvarOrcamento, excluirOrcamento } from '../db';
import AjudaTela from '../components/AjudaTela';
import CategoriaInput from '../components/CategoriaInput';

export default function OrcamentoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editando = Boolean(id);

  const [geral, setGeral] = useState(true);
  const [categoriaNome, setCategoriaNome] = useState('');
  const [limite, setLimite] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (id) {
      listarOrcamentos().then(async (lista) => {
        const o = lista.find((x) => x.id === id);
        if (!o) return;
        setLimite(String(o.limite));
        if (o.categoriaId) {
          setGeral(false);
          const categoria = await buscarCategoria(o.categoriaId);
          setCategoriaNome(categoria?.nome ?? '');
        } else {
          setGeral(true);
        }
      });
    }
  }, [id]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    const limiteNumerico = Number(limite.replace(',', '.'));
    if (!limiteNumerico || limiteNumerico <= 0 || (!geral && !categoriaNome.trim())) {
      setErro('Informe um limite válido e, se não for orçamento geral, uma categoria.');
      return;
    }
    try {
      const categoriaId = geral ? null : (await buscarOuCriarCategoria(categoriaNome, 'despesa')).id;
      await salvarOrcamento({ id, categoriaId, limite: limiteNumerico });
      navigate('/metas');
    } catch {
      setErro('Não foi possível salvar a meta.');
    }
  }

  async function handleExcluir() {
    if (!id) return;
    if (!confirm('Excluir esta meta?')) return;
    await excluirOrcamento(id);
    navigate('/metas');
  }

  return (
    <div>
      <h2>{editando ? 'Editar meta' : 'Nova meta'}</h2>
      <AjudaTela>
        Escolha uma categoria (ou "geral" para somar todas as despesas) e o valor máximo que você quer gastar por
        mês nela.
      </AjudaTela>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={geral}
              onChange={(e) => setGeral(e.target.checked)}
              style={{ width: 'auto', marginRight: 8 }}
            />
            Orçamento geral (soma todas as despesas)
          </label>
        </div>

        {!geral && (
          <div className="field">
            <label>Categoria</label>
            <CategoriaInput tipo="despesa" value={categoriaNome} onChange={setCategoriaNome} />
          </div>
        )}

        <div className="field">
          <label>Limite mensal (R$)</label>
          <input
            inputMode="decimal"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            placeholder="Ex: 800,00"
          />
        </div>

        {erro && <p style={{ color: 'var(--danger)' }}>{erro}</p>}

        <button type="submit" className="btn">
          Salvar
        </button>
      </form>

      {editando && (
        <button type="button" className="btn btn-danger" style={{ marginTop: 12 }} onClick={handleExcluir}>
          Excluir meta
        </button>
      )}
    </div>
  );
}
