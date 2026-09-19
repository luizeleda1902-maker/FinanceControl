// Formulário de criar/editar uma categoria: nome, tipo (receita/despesa)
// e uma cor escolhida entre a paleta fixa de theme.ts.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buscarCategoria, excluirCategoria, salvarCategoria, type TipoTransacao } from '../db';
import { CORES_CATEGORIA } from '../theme';
import AjudaTela from '../components/AjudaTela';

export default function CategoriaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editando = Boolean(id);

  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoTransacao>('despesa');
  const [corIndex, setCorIndex] = useState(0);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (id) {
      buscarCategoria(id).then((c) => {
        if (!c) return;
        setNome(c.nome);
        setTipo(c.tipo);
        setCorIndex(c.corIndex);
      });
    }
  }, [id]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    if (!nome) {
      setErro('Informe um nome para a categoria.');
      return;
    }
    try {
      await salvarCategoria({ id, nome, tipo, corIndex });
      navigate('/categorias');
    } catch {
      setErro('Não foi possível salvar a categoria.');
    }
  }

  async function handleExcluir() {
    if (!id) return;
    if (!confirm('Excluir esta categoria? Lançamentos existentes manterão a referência antiga.')) return;
    await excluirCategoria(id);
    navigate('/categorias');
  }

  return (
    <div>
      <h2>{editando ? 'Editar categoria' : 'Nova categoria'}</h2>
      <AjudaTela>Nome, tipo (receita ou despesa) e a cor usada nos gráficos e nas bolinhas de identificação.</AjudaTela>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Educação" />
        </div>

        <div className="field">
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTransacao)}>
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </select>
        </div>

        <div className="field">
          <label>Cor</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CORES_CATEGORIA.map((cor, i) => (
              <button
                key={cor}
                type="button"
                onClick={() => setCorIndex(i)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: cor,
                  border: corIndex === i ? '3px solid var(--text)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
                aria-label={`Selecionar cor ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {erro && <p style={{ color: 'var(--danger)' }}>{erro}</p>}

        <button type="submit" className="btn">
          Salvar
        </button>
      </form>

      {editando && (
        <button type="button" className="btn btn-danger" style={{ marginTop: 12 }} onClick={handleExcluir}>
          Excluir categoria
        </button>
      )}
    </div>
  );
}
