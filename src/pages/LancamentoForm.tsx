// Formulário de "Novo lançamento" e "Editar lançamento" ao mesmo tempo: é
// o mesmo componente para os dois casos, diferenciados pela presença (ou
// não) do parâmetro `:id` na rota. Esse é o mesmo padrão usado em
// ContaFixaForm, ParcelamentoForm, OrcamentoForm e CategoriaForm.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  buscarTransacao,
  buscarCategoria,
  buscarOuCriarCategoria,
  excluirTransacao,
  salvarTransacao,
  type TipoTransacao,
} from '../db';
import { hojeISO } from '../utils';
import AjudaTela from '../components/AjudaTela';
import CategoriaInput from '../components/CategoriaInput';

export default function LancamentoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Se a rota tem :id, estamos editando um lançamento existente; senão,
  // estamos criando um novo.
  const editando = Boolean(id);

  const [tipo, setTipo] = useState<TipoTransacao>('despesa');
  const [valor, setValor] = useState('');
  const [categoriaNome, setCategoriaNome] = useState('');
  const [data, setData] = useState(hojeISO());
  const [descricao, setDescricao] = useState('');
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const [erro, setErro] = useState('');

  // Quando estamos editando (tem :id na rota), busca o lançamento e
  // preenche o formulário com os dados dele, incluindo o nome (não o id)
  // da categoria, já que o campo agora é texto livre.
  useEffect(() => {
    if (id) {
      buscarTransacao(id).then(async (t) => {
        if (!t) return;
        setTipo(t.tipo);
        setValor(String(t.valor));
        setData(t.data);
        setDescricao(t.descricao);
        const categoria = await buscarCategoria(t.categoriaId);
        setCategoriaNome(categoria?.nome ?? '');
      });
    }
  }, [id]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    const valorNumerico = Number(valor.replace(',', '.'));
    if (!descricao || !categoriaNome.trim() || !data || !valorNumerico || valorNumerico <= 0) {
      setErro('Preencha todos os campos com um valor válido.');
      return;
    }
    try {
      const categoria = await buscarOuCriarCategoria(categoriaNome, tipo);
      const transacao = await salvarTransacao({
        id,
        tipo,
        valor: valorNumerico,
        categoriaId: categoria.id,
        data,
        descricao,
      });
      setSalvoComSucesso(true);
      // Ao CRIAR um lançamento novo, troca a URL para a de edição (sem
      // recarregar a página) — assim, se o usuário continuar mexendo no
      // formulário, já está no modo "editar" em vez de criar duplicado.
      if (!id) navigate(`/lancamentos/${transacao.id}/editar`, { replace: true });
    } catch {
      setErro('Não foi possível salvar o lançamento.');
    }
  }

  async function handleExcluir() {
    if (!id) return;
    if (!confirm('Excluir este lançamento?')) return;
    await excluirTransacao(id);
    navigate('/lancamentos');
  }

  return (
    <div>
      <h2>{editando ? 'Editar lançamento' : 'Novo lançamento'}</h2>
      <AjudaTela>Registre aqui um gasto ou ganho pontual, sem repetição automática.</AjudaTela>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoTransacao)}>
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </select>
        </div>

        <div className="field">
          <label>Descrição</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Supermercado" />
        </div>

        <div className="field">
          <label>Valor (R$)</label>
          <input
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ex: 150,00"
          />
        </div>

        <div className="field">
          <label>Categoria</label>
          <CategoriaInput tipo={tipo} value={categoriaNome} onChange={setCategoriaNome} />
        </div>

        <div className="field">
          <label>Data</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>

        {erro && <p style={{ color: 'var(--danger)' }}>{erro}</p>}

        <button type="submit" className="btn">
          Salvar
        </button>
      </form>

      {salvoComSucesso && <p style={{ color: 'var(--ok)', marginTop: 12 }}>Lançamento salvo com sucesso.</p>}

      {editando && (
        <button type="button" className="btn btn-danger" style={{ marginTop: 12 }} onClick={handleExcluir}>
          Excluir lançamento
        </button>
      )}
    </div>
  );
}
