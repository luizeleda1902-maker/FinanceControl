// Funções pequenas de formatação de dinheiro e datas, reaproveitadas em
// várias telas do app.

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Formatador de moeda configurado uma única vez (fora da função) porque
// criar um `Intl.NumberFormat` novo a cada chamada seria desperdício.
const formatterMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

// Transforma um número em texto de moeda brasileira, ex: 1500 -> "R$ 1.500,00".
export function formatMoeda(valor: number): string {
  return formatterMoeda.format(valor);
}

// Mês atual no formato usado como chave em todo o app (ex: "2026-07").
export function mesAtual(): string {
  return format(new Date(), 'yyyy-MM');
}

// Data de hoje no formato ISO (ex: "2026-07-02"), usado como valor padrão
// em formulários e como data de pagamento quando nenhuma é informada.
export function hojeISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// Data ISO para o formato de exibição brasileiro (ex: "2026-07-02" -> "02/07/2026").
export function formatDataCurta(dataIso: string): string {
  return format(parseISO(dataIso), 'dd/MM/yyyy');
}

// Mês no formato "yyyy-MM" para um rótulo curto em português (ex: "2026-07" -> "jul/2026"),
// usado nos eixos do gráfico de Relatórios.
export function formatMesLabel(mesReferencia: string): string {
  return format(parseISO(`${mesReferencia}-01`), 'MMM/yyyy', { locale: ptBR });
}

// Lista os últimos N meses (incluindo o atual) no formato "yyyy-MM", do
// mais antigo para o mais recente. Usado para montar o gráfico de
// receitas x despesas dos últimos 6 meses.
export function mesesAnteriores(quantidade: number): string[] {
  const hoje = new Date();
  const meses: string[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push(format(d, 'yyyy-MM'));
  }
  return meses;
}
