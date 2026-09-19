// Formulário de criar/editar um cartão de crédito. Mesmo padrão de
// ContaFixaForm: um componente só, usando a presença de `:id` na rota
// para saber se é criação ou edição.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buscarCartao, excluirCartao, salvarCartao } from '../db';
import AjudaTela from '../components/AjudaTela';

export default function CartaoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editando = Boolean(id);

  const [nome, setNome] = useState('');
  const [limite, setLimite] = useState('');
  const [diaFechamento, setDiaFechamento] = useState('1');
  const [diaVencimento, setDiaVencimento] = useState('10');
  const [ativo, setAtivo] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (id) {
      buscarCartao(id).then((c) => {
        if (!c) return;
        setNome(c.nome);
        setLimite(String(c.limite));
        setDiaFechamento(String(c.diaFechamento));
        setDiaVencimento(String(c.diaVencimento));
        setAtivo(c.ativo);
      });
    }
  }, [id]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    const limiteNumerico = Number(limite.replace(',', '.'));
    const fechamento = Number(diaFechamento);
    const vencimento = Number(diaVencimento);
    if (
      !nome ||
      !limiteNumerico ||
      limiteNumerico <= 0 ||
      fechamento < 1 ||
      fechamento > 31 ||
      vencimento < 1 ||
      vencimento > 31
    ) {
      setErro('Preencha todos os campos com valores válidos.');
      return;
    }
    try {
      const cartao = await salvarCartao({
        id,
        nome,
        limite: limiteNumerico,
        diaFechamento: fechamento,
        diaVencimento: vencimento,
        ativo,
      });
      navigate(editando ? '/contas' : `/contas/cartoes/${cartao.id}`);
    } catch {
      setErro('Não foi possível salvar o cartão.');
    }
  }

  async function handleExcluir() {
    if (!id) return;
    if (!confirm('Excluir este cartão, suas compras e o histórico de faturas pagas?')) return;
    await excluirCartao(id);
    navigate('/contas');
  }

  return (
    <div>
      <h2>{editando ? 'Editar cartão' : 'Novo cartão'}</h2>
      <AjudaTela>
        Dia de fechamento é quando a fatura para de receber novas compras (compras depois disso vão para a fatura
        seguinte). Dia de vencimento é quando essa fatura já fechada deve ser paga.
      </AjudaTela>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Nubank" />
        </div>

        <div className="field">
          <label>Limite (R$)</label>
          <input
            inputMode="decimal"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            placeholder="Ex: 2000,00"
          />
        </div>

        <div className="field">
          <label>Dia do fechamento da fatura</label>
          <input
            type="number"
            min={1}
            max={31}
            value={diaFechamento}
            onChange={(e) => setDiaFechamento(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Dia do vencimento da fatura</label>
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
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              style={{ width: 'auto', marginRight: 8 }}
            />
            Ativo
          </label>
        </div>

        {erro && <p style={{ color: 'var(--danger)' }}>{erro}</p>}

        <button type="submit" className="btn">
          Salvar
        </button>
      </form>

      {editando && (
        <button type="button" className="btn btn-danger" style={{ marginTop: 12 }} onClick={handleExcluir}>
          Excluir cartão
        </button>
      )}
    </div>
  );
}
