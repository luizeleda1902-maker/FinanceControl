// Formulário de criar/editar um parcelamento. Diferente dos outros
// formulários do app, a edição é limitada: depois de criado, só dá pra
// mudar descrição e categoria (valor total, número de parcelas e datas
// ficam travados — ver o comentário em atualizarDescricaoParcelamento no
// db.ts para o motivo).

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  buscarParcelamento,
  criarParcelamento,
  atualizarDescricaoParcelamento,
  excluirParcelamento,
  buscarCategoria,
  buscarOuCriarCategoria,
} from '../db';
import { formatDataCurta, hojeISO } from '../utils';
import { Valor } from '../privacidade';
import AjudaTela from '../components/AjudaTela';
import CategoriaInput from '../components/CategoriaInput';

export default function ParcelamentoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editando = Boolean(id);

  const [descricao, setDescricao] = useState('');
  const [categoriaNome, setCategoriaNome] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [numeroParcelas, setNumeroParcelas] = useState('2');
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(hojeISO());
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (id) {
      buscarParcelamento(id).then(async (p) => {
        if (!p) return;
        setDescricao(p.descricao);
        setValorTotal(String(p.valorTotal));
        setNumeroParcelas(String(p.numeroParcelas));
        setDataPrimeiraParcela(p.dataPrimeiraParcela);
        const categoria = await buscarCategoria(p.categoriaId);
        setCategoriaNome(categoria?.nome ?? '');
      });
    }
  }, [id]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    if (!descricao || !categoriaNome.trim()) {
      setErro('Preencha todos os campos.');
      return;
    }
    try {
      const categoria = await buscarOuCriarCategoria(categoriaNome, 'despesa');
      if (editando && id) {
        // Modo edição: só descrição/categoria podem mudar.
        await atualizarDescricaoParcelamento(id, descricao, categoria.id);
        navigate(`/contas/parcelamentos/${id}`);
      } else {
        // Modo criação: gera o parcelamento e todas as parcelas de uma vez
        // (ver criarParcelamento em db.ts), depois vai direto para a tela
        // de detalhe mostrando o cronograma completo.
        const valorNumerico = Number(valorTotal.replace(',', '.'));
        const numero = Number(numeroParcelas);
        if (!valorNumerico || valorNumerico <= 0 || !numero || numero < 1) {
          setErro('Informe um valor total e número de parcelas válidos.');
          return;
        }
        const parcelamento = await criarParcelamento({
          descricao,
          categoriaId: categoria.id,
          valorTotal: valorNumerico,
          numeroParcelas: numero,
          dataPrimeiraParcela,
        });
        navigate(`/contas/parcelamentos/${parcelamento.id}`, { replace: true });
      }
    } catch {
      setErro('Não foi possível salvar o parcelamento.');
    }
  }

  async function handleExcluir() {
    if (!id) return;
    if (!confirm('Excluir este parcelamento e todas as suas parcelas?')) return;
    await excluirParcelamento(id);
    navigate('/contas');
  }

  return (
    <div>
      <h2>{editando ? 'Editar parcelamento' : 'Novo parcelamento'}</h2>
      <AjudaTela>
        Para uma compra parcelada fora do cartão de crédito (boleto, carnê). O app já gera todas as parcelas com
        suas datas de vencimento de uma vez.
      </AjudaTela>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Descrição</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Notebook novo" />
        </div>

        <div className="field">
          <label>Categoria</label>
          <CategoriaInput tipo="despesa" value={categoriaNome} onChange={setCategoriaNome} />
        </div>

        {editando ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Valor total: <Valor valor={Number(valorTotal)} /> em {numeroParcelas}x, 1ª parcela em{' '}
            {formatDataCurta(dataPrimeiraParcela)}. Esses dados não podem ser alterados após a criação — exclua e
            crie novamente se precisar mudar valor ou número de parcelas.
          </p>
        ) : (
          <>
            <div className="field">
              <label>Valor total (R$)</label>
              <input
                inputMode="decimal"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                placeholder="Ex: 2400,00"
              />
            </div>

            <div className="field">
              <label>Número de parcelas</label>
              <input
                type="number"
                min={1}
                value={numeroParcelas}
                onChange={(e) => setNumeroParcelas(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Data da primeira parcela</label>
              <input
                type="date"
                value={dataPrimeiraParcela}
                onChange={(e) => setDataPrimeiraParcela(e.target.value)}
              />
            </div>
          </>
        )}

        {erro && <p style={{ color: 'var(--danger)' }}>{erro}</p>}

        <button type="submit" className="btn">
          Salvar
        </button>
      </form>

      {editando && (
        <button type="button" className="btn btn-danger" style={{ marginTop: 12 }} onClick={handleExcluir}>
          Excluir parcelamento
        </button>
      )}
    </div>
  );
}
