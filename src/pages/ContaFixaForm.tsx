// Formulário de criar/editar uma conta fixa (aluguel, assinatura, etc.).
// Mesmo padrão de LancamentoForm: um componente só, usando a presença de
// `:id` na rota para saber se é criação ou edição.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buscarContaFixa, buscarCategoria, buscarOuCriarCategoria, excluirContaFixa, salvarContaFixa } from '../db';
import AjudaTela from '../components/AjudaTela';
import CategoriaInput from '../components/CategoriaInput';

export default function ContaFixaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editando = Boolean(id);

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoriaNome, setCategoriaNome] = useState('');
  const [diaVencimento, setDiaVencimento] = useState('5');
  const [ativa, setAtiva] = useState(true);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (id) {
      buscarContaFixa(id).then(async (c) => {
        if (!c) return;
        setDescricao(c.descricao);
        setValor(String(c.valor));
        setDiaVencimento(String(c.diaVencimento));
        setAtiva(c.ativa);
        const categoria = await buscarCategoria(c.categoriaId);
        setCategoriaNome(categoria?.nome ?? '');
      });
    }
  }, [id]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    const valorNumerico = Number(valor.replace(',', '.'));
    const dia = Number(diaVencimento);
    if (!descricao || !categoriaNome.trim() || !valorNumerico || valorNumerico <= 0 || dia < 1 || dia > 31) {
      setErro('Preencha todos os campos com valores válidos.');
      return;
    }
    try {
      const categoria = await buscarOuCriarCategoria(categoriaNome, 'despesa');
      await salvarContaFixa({ id, descricao, categoriaId: categoria.id, valor: valorNumerico, diaVencimento: dia, ativa });
      setSalvoComSucesso(true);
      if (!id) navigate('/contas');
    } catch {
      setErro('Não foi possível salvar a conta fixa.');
    }
  }

  async function handleExcluir() {
    if (!id) return;
    if (!confirm('Excluir esta conta fixa e seu histórico de pagamentos?')) return;
    await excluirContaFixa(id);
    navigate('/contas');
  }

  return (
    <div>
      <h2>{editando ? 'Editar conta fixa' : 'Nova conta fixa'}</h2>
      <AjudaTela>
        Para uma conta que se repete todo mês com o mesmo valor. O dia de vencimento é usado para avisar quando ela
        está perto de vencer ou atrasada.
      </AjudaTela>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Descrição</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Aluguel" />
        </div>

        <div className="field">
          <label>Valor (R$)</label>
          <input
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ex: 1200,00"
          />
        </div>

        <div className="field">
          <label>Categoria</label>
          <CategoriaInput tipo="despesa" value={categoriaNome} onChange={setCategoriaNome} />
        </div>

        <div className="field">
          <label>Dia do vencimento</label>
          <input
            type="number"
            min={1}
            max={31}
            value={diaVencimento}
            onChange={(e) => setDiaVencimento(e.target.value)}
          />
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={ativa}
              onChange={(e) => setAtiva(e.target.checked)}
              style={{ width: 'auto', marginRight: 8 }}
            />
            Ativa
          </label>
        </div>

        {erro && <p style={{ color: 'var(--danger)' }}>{erro}</p>}

        <button type="submit" className="btn">
          Salvar
        </button>
      </form>

      {salvoComSucesso && <p style={{ color: 'var(--ok)', marginTop: 12 }}>Conta fixa salva com sucesso.</p>}

      {editando && (
        <button type="button" className="btn btn-danger" style={{ marginTop: 12 }} onClick={handleExcluir}>
          Excluir conta fixa
        </button>
      )}
    </div>
  );
}
