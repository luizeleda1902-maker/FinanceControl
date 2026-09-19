// Formulário de registrar uma compra no cartão (à vista ou parcelada).
// Mesmo padrão de ParcelamentoForm: depois de criada, só dá pra editar
// descrição e categoria (ver atualizarDescricaoCompraCartao em db.ts).

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  buscarCompraCartao,
  criarCompraCartao,
  atualizarDescricaoCompraCartao,
  excluirCompraCartao,
  listarCartoes,
  buscarCategoria,
  buscarOuCriarCategoria,
  type CartaoCredito,
} from '../db';
import { hojeISO } from '../utils';
import { Valor } from '../privacidade';
import AjudaTela from '../components/AjudaTela';
import CategoriaInput from '../components/CategoriaInput';

export default function CompraCartaoForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editando = Boolean(id);

  const [cartaoId, setCartaoId] = useState(searchParams.get('cartaoId') ?? '');
  const [descricao, setDescricao] = useState('');
  const [categoriaNome, setCategoriaNome] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [numeroParcelas, setNumeroParcelas] = useState('1');
  const [dataCompra, setDataCompra] = useState(hojeISO());
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarCartoes().then((lista) => {
      setCartoes(lista);
      setCartaoId((atual) => atual || lista.find((c) => c.ativo)?.id || lista[0]?.id || '');
    });
  }, []);

  useEffect(() => {
    if (id) {
      buscarCompraCartao(id).then(async (c) => {
        if (!c) return;
        setCartaoId(c.cartaoId);
        setDescricao(c.descricao);
        setValorTotal(String(c.valorTotal));
        setNumeroParcelas(String(c.numeroParcelas));
        setDataCompra(c.dataCompra);
        const categoria = await buscarCategoria(c.categoriaId);
        setCategoriaNome(categoria?.nome ?? '');
      });
    }
  }, [id]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setErro('');
    if (!descricao || !categoriaNome.trim() || !cartaoId) {
      setErro('Preencha todos os campos.');
      return;
    }
    try {
      const categoria = await buscarOuCriarCategoria(categoriaNome, 'despesa');
      if (editando && id) {
        await atualizarDescricaoCompraCartao(id, descricao, categoria.id);
        navigate(`/contas/cartoes/${cartaoId}`);
      } else {
        const valorNumerico = Number(valorTotal.replace(',', '.'));
        const numero = Number(numeroParcelas);
        if (!valorNumerico || valorNumerico <= 0 || !numero || numero < 1) {
          setErro('Informe um valor total e número de parcelas válidos.');
          return;
        }
        await criarCompraCartao({
          cartaoId,
          descricao,
          categoriaId: categoria.id,
          valorTotal: valorNumerico,
          numeroParcelas: numero,
          dataCompra,
        });
        navigate(`/contas/cartoes/${cartaoId}`, { replace: true });
      }
    } catch {
      setErro('Não foi possível salvar a compra.');
    }
  }

  async function handleExcluir() {
    if (!id) return;
    if (!confirm('Excluir esta compra e todas as suas parcelas?')) return;
    await excluirCompraCartao(id);
    navigate(`/contas/cartoes/${cartaoId}`);
  }

  return (
    <div>
      <h2>{editando ? 'Editar compra' : 'Nova compra no cartão'}</h2>
      <AjudaTela>
        Registre aqui uma compra feita no cartão, à vista ou parcelada. O app calcula sozinho em qual fatura cada
        parcela vai cair, com base no dia de fechamento do cartão.
      </AjudaTela>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Cartão</label>
          <select value={cartaoId} onChange={(e) => setCartaoId(e.target.value)} disabled={editando}>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Descrição</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Supermercado" />
        </div>

        <div className="field">
          <label>Categoria</label>
          <CategoriaInput tipo="despesa" value={categoriaNome} onChange={setCategoriaNome} />
        </div>

        {editando ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Valor total: <Valor valor={Number(valorTotal)} /> em {numeroParcelas}x, comprado em{' '}
            {dataCompra.split('-').reverse().join('/')}. Esses dados não podem ser alterados após a criação — exclua
            e crie novamente se precisar mudar valor, parcelas ou data.
          </p>
        ) : (
          <>
            <div className="field">
              <label>Valor total (R$)</label>
              <input
                inputMode="decimal"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                placeholder="Ex: 350,00"
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
              <label>Data da compra</label>
              <input type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} />
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
          Excluir compra
        </button>
      )}
    </div>
  );
}
