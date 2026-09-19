// Gera um conjunto de dados de exemplo (renda, despesas de vários meses,
// contas fixas, um parcelamento e metas de orçamento) para demonstrar o
// app com uma tela "cheia" em vez de tudo zerado. Usado pela tela
// src/pages/Demo.tsx — veja lá as instruções de uso (recomendado rodar
// numa aba anônima, pra não misturar com dados reais).

import { addMonths, format } from 'date-fns';
import {
  listarCategorias,
  salvarRendaMensal,
  salvarTransacao,
  salvarContaFixa,
  pagarContaFixa,
  criarParcelamento,
  listarParcelas,
  pagarParcela,
  salvarOrcamento,
} from './db';
import { mesAtual, hojeISO } from './utils';

// Mês de referência (formato 'yyyy-MM') de N meses atrás.
function mesesAtras(n: number): string {
  return format(addMonths(new Date(), -n), 'yyyy-MM');
}

// Monta uma data ISO a partir de um mês ('yyyy-MM') e um dia do mês.
function dataNoMes(mesReferencia: string, dia: number): string {
  return `${mesReferencia}-${String(dia).padStart(2, '0')}`;
}

export async function seedDadosDemo(): Promise<void> {
  const categorias = await listarCategorias();
  const porNome = (nome: string) => {
    const categoria = categorias.find((c) => c.nome === nome);
    if (!categoria) throw new Error(`Categoria "${nome}" não encontrada — rode "Apagar tudo" antes da demo.`);
    return categoria;
  };

  const cOutrasReceitas = porNome('Outras receitas');
  const cAlimentacao = porNome('Alimentação');
  const cTransporte = porNome('Transporte');
  const cMoradia = porNome('Moradia');
  const cSaude = porNome('Saúde');
  const cLazer = porNome('Lazer');
  const cOutrasDespesas = porNome('Outras despesas');
  const cGastosVariaveis = porNome('Gastos variáveis');

  // ---- Renda dos últimos 3 meses (com um pequeno aumento no mês atual) ----
  await salvarRendaMensal(mesesAtras(0), 4800);
  await salvarRendaMensal(mesesAtras(1), 4500);
  await salvarRendaMensal(mesesAtras(2), 4500);

  // ---- Despesas e receitas extras dos últimos 3 meses ----
  // Valores de alimentação variam por mês de propósito: o mês atual fica
  // perto do limite do orçamento (ver mais abaixo), pra mostrar o badge
  // de "atenção" durante a demonstração.
  const gastosAlimentacaoPorMes = [570, 420, 400]; // [mês atual, 1 mês atrás, 2 meses atrás]

  for (let m = 0; m <= 2; m++) {
    const mes = mesesAtras(m);
    await salvarTransacao({
      tipo: 'despesa',
      valor: gastosAlimentacaoPorMes[m],
      categoriaId: cAlimentacao.id,
      data: dataNoMes(mes, 6),
      descricao: 'Supermercado',
    });
    await salvarTransacao({
      tipo: 'despesa',
      valor: 180,
      categoriaId: cAlimentacao.id,
      data: dataNoMes(mes, 18),
      descricao: 'Restaurante',
    });
    await salvarTransacao({
      tipo: 'despesa',
      valor: 150,
      categoriaId: cTransporte.id,
      data: dataNoMes(mes, 10),
      descricao: 'Combustível',
    });
    await salvarTransacao({
      tipo: 'despesa',
      valor: 60,
      categoriaId: cTransporte.id,
      data: dataNoMes(mes, 22),
      descricao: 'Aplicativo de transporte',
    });
    await salvarTransacao({
      tipo: 'despesa',
      valor: 90,
      categoriaId: cSaude.id,
      data: dataNoMes(mes, 14),
      descricao: 'Farmácia',
    });
    await salvarTransacao({
      tipo: 'despesa',
      valor: 220,
      categoriaId: cLazer.id,
      data: dataNoMes(mes, 20),
      descricao: 'Cinema e streaming',
    });
    await salvarTransacao({
      tipo: 'despesa',
      valor: 35,
      categoriaId: cGastosVariaveis.id,
      data: dataNoMes(mes, 8),
      descricao: 'Lanche na padaria',
    });
    await salvarTransacao({
      tipo: 'receita',
      valor: 300,
      categoriaId: cOutrasReceitas.id,
      data: dataNoMes(mes, 25),
      descricao: 'Trabalho freelance',
    });
  }

  // Gasto extra de lazer só no mês atual, pra essa meta ficar "estourada"
  // durante a demonstração (ver orçamento de Lazer mais abaixo).
  await salvarTransacao({
    tipo: 'despesa',
    valor: 90,
    categoriaId: cLazer.id,
    data: hojeISO(),
    descricao: 'Show/ingresso',
  });

  // ---- Contas fixas: uma paga, uma atrasada, uma vencendo em breve ----
  const diaHoje = new Date().getDate();

  const aluguel = await salvarContaFixa({
    descricao: 'Aluguel',
    categoriaId: cMoradia.id,
    valor: 1200,
    diaVencimento: 5,
    ativa: true,
  });
  await pagarContaFixa(aluguel.id, dataNoMes(mesAtual(), Math.min(5, diaHoje)));

  await salvarContaFixa({
    descricao: 'Internet',
    categoriaId: cMoradia.id,
    valor: 120,
    diaVencimento: Math.max(1, diaHoje - 1), // já venceu este mês -> aparece como "atrasada"
    ativa: true,
  });

  await salvarContaFixa({
    descricao: 'Streaming',
    categoriaId: cLazer.id,
    valor: 40,
    diaVencimento: Math.min(28, diaHoje + 3), // vence em poucos dias -> aparece como "atenção"
    ativa: true,
  });

  // ---- Parcelamento: celular novo em 6x, começado há 2 meses ----
  // As duas primeiras parcelas já pagas, o resto pendente — mostra o
  // cronograma completo na tela de detalhe do parcelamento.
  const parcelamento = await criarParcelamento({
    descricao: 'Celular novo',
    categoriaId: cOutrasDespesas.id,
    valorTotal: 1800,
    numeroParcelas: 6,
    dataPrimeiraParcela: dataNoMes(mesesAtras(2), 15),
  });
  const parcelas = await listarParcelas(parcelamento.id);
  await pagarParcela(parcelas[0].id, parcelas[0].vencimento);
  await pagarParcela(parcelas[1].id, parcelas[1].vencimento);

  // ---- Metas de orçamento ----
  // Alimentação fica perto do limite (badge amarelo "atenção"), Lazer
  // passa do limite (badge vermelho "estourado") e Gastos variáveis
  // (criada automaticamente pelo banco) fica tranquila (badge verde) —
  // assim a demonstração mostra os três estados possíveis de uma vez.
  await salvarOrcamento({ categoriaId: cAlimentacao.id, limite: 800 });
  await salvarOrcamento({ categoriaId: cLazer.id, limite: 200 });
}
