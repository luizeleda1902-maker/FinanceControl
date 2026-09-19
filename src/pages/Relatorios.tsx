// Tela "Relatórios": mostra os lançamentos de um mês, dois gráficos
// (receitas x despesas dos últimos 6 meses, e gastos por categoria do mês
// escolhido) e permite exportar tudo em PDF.

import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { listarTransacoes, listarCategorias, resumoMes, type Transacao, type Categoria } from '../db';
import GraficoReceitasDespesas from '../components/GraficoReceitasDespesas';
import GraficoCategorias from '../components/GraficoCategorias';
import { formatMoeda, formatDataCurta, mesAtual, mesesAnteriores, formatMesLabel, hojeISO } from '../utils';
import { Valor, useVisibilidade } from '../privacidade';
import { IconFileText, IconEyeOff } from '../components/Icons';
import AjudaTela from '../components/AjudaTela';

export default function Relatorios() {
  const { visivel } = useVisibilidade();
  const [mes, setMes] = useState(mesAtual());
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [historico, setHistorico] = useState<{ mes: string; receitas: number; despesas: number }[]>([]);

  useEffect(() => {
    listarCategorias().then(setCategorias);
  }, []);

  useEffect(() => {
    listarTransacoes({ mes }).then(setTransacoes);
  }, [mes]);

  // Carrega o resumo de receitas/despesas dos últimos 6 meses de uma vez,
  // pra alimentar o gráfico de barras — independente do mês escolhido no
  // filtro acima.
  useEffect(() => {
    const meses = mesesAnteriores(6);
    Promise.all(meses.map((m) => resumoMes(m))).then((resumos) => {
      setHistorico(meses.map((m, i) => ({ mes: m, receitas: resumos[i].receitas, despesas: resumos[i].despesas })));
    });
  }, []);

  const categoriaPorId = useMemo(() => {
    const map = new Map<string, Categoria>();
    categorias.forEach((c) => map.set(c.id, c));
    return map;
  }, [categorias]);

  // Agrupa as despesas do mês por categoria, somando os valores — é isso
  // que vira as barrinhas do gráfico de "Gastos por categoria".
  const gastosPorCategoria = useMemo(() => {
    const somas = new Map<string, number>();
    transacoes
      .filter((t) => t.tipo === 'despesa')
      .forEach((t) => {
        somas.set(t.categoriaId, (somas.get(t.categoriaId) ?? 0) + t.valor);
      });
    return Array.from(somas.entries()).map(([categoriaId, valor]) => ({
      nome: categoriaPorId.get(categoriaId)?.nome ?? 'Sem categoria',
      valor,
      corIndex: categoriaPorId.get(categoriaId)?.corIndex ?? 0,
    }));
  }, [transacoes, categoriaPorId]);

  // Gera o PDF com jsPDF + jspdf-autotable: um cabeçalho com o mês e data
  // de geração, e uma tabela com todos os lançamentos filtrados. Note que
  // aqui usamos formatMoeda() direto (não o componente <Valor>), porque o
  // PDF não é uma tela React — o botão já fica desabilitado no modo
  // privado para essa função nunca rodar com valores ocultos.
  function exportarPDF() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Relatório Financeiro Pessoal', 14, 16);
    doc.setFontSize(10);
    doc.text(`Mês de referência: ${formatMesLabel(mes)} · Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 22);

    const rows = transacoes.map((t) => [
      formatDataCurta(t.data),
      t.tipo === 'receita' ? 'Receita' : 'Despesa',
      categoriaPorId.get(t.categoriaId)?.nome ?? '—',
      t.descricao,
      formatMoeda(t.valor),
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor']],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`relatorio-financeiro-${mes}.pdf`);
  }

  // Mesmo formato do exportarPDF acima, mas busca TODAS as transações (sem
  // filtro de mês) — pensado para o usuário salvar o histórico completo
  // antes de usar "Apagar tudo e recomeçar do zero" (tela /#/demo).
  async function exportarTudoPDF() {
    const todas = await listarTransacoes();
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Relatório Financeiro Pessoal — Histórico completo', 14, 16);
    doc.setFontSize(10);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 22);

    const rows = todas.map((t) => [
      formatDataCurta(t.data),
      t.tipo === 'receita' ? 'Receita' : 'Despesa',
      categoriaPorId.get(t.categoriaId)?.nome ?? '—',
      t.descricao,
      formatMoeda(t.valor),
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor']],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`relatorio-financeiro-completo-${hojeISO()}.pdf`);
  }

  return (
    <div>
      <h2>Relatórios</h2>
      <AjudaTela>
        Gráficos e a lista de lançamentos de um mês escolhido, com opção de exportar tudo em PDF.
      </AjudaTela>

      <div className="field">
        <label>Mês</label>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
      </div>

      <button className="btn" onClick={exportarPDF} disabled={transacoes.length === 0 || !visivel}>
        <IconFileText size={18} /> Exportar relatório em PDF
      </button>
      <button
        className="btn btn-secondary"
        onClick={exportarTudoPDF}
        disabled={!visivel}
        style={{ marginTop: 8 }}
      >
        <IconFileText size={18} /> Exportar histórico completo em PDF
      </button>
      {!visivel && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
          Mostre os valores no topo para poder exportar o relatório.
        </p>
      )}

      <h3 style={{ marginTop: 20 }}>Receitas x despesas (últimos 6 meses)</h3>
      {visivel ? (
        <GraficoReceitasDespesas dados={historico} />
      ) : (
        <p className="empty">
          <IconEyeOff size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Valores ocultos
        </p>
      )}

      <h3 style={{ marginTop: 20 }}>Gastos por categoria no mês</h3>
      {visivel ? (
        <GraficoCategorias dados={gastosPorCategoria} />
      ) : (
        <p className="empty">
          <IconEyeOff size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Valores ocultos
        </p>
      )}

      <h3 style={{ marginTop: 20 }}>Lançamentos do mês</h3>
      {transacoes.length === 0 && <div className="empty">Nenhum lançamento neste mês.</div>}
      {transacoes.map((t) => (
        <div key={t.id} className="card card-row">
          <div>
            <strong>{t.descricao}</strong>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {categoriaPorId.get(t.categoriaId)?.nome} · {formatDataCurta(t.data)}
            </div>
          </div>
          <span style={{ fontWeight: 700, color: t.tipo === 'receita' ? 'var(--ok)' : 'var(--danger)' }}>
            {t.tipo === 'receita' ? '+' : '-'} <Valor valor={t.valor} />
          </span>
        </div>
      ))}
    </div>
  );
}
