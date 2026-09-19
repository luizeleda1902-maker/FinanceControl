// Badge (etiqueta colorida) usado para mostrar o status de vencimento de
// contas fixas, parcelas e orçamentos. As funções `textoStatusX` abaixo
// geram o texto certo pra cada situação; o componente <StatusBadge> só
// cuida da cor.

import type { Nivel, NivelOrcamento } from '../db';

interface Props {
  nivel: Nivel | NivelOrcamento;
  texto: string;
}

// Mapeia cada nível para uma classe CSS já definida em App.css
// (.badge-ok = verde, .badge-warn = amarelo, .badge-danger = vermelho).
const CLASSE_POR_NIVEL: Record<string, string> = {
  ok: 'badge-ok',
  atencao: 'badge-warn',
  atrasada: 'badge-danger',
  estourado: 'badge-danger',
};

export default function StatusBadge({ nivel, texto }: Props) {
  return <span className={`badge ${CLASSE_POR_NIVEL[nivel]}`}>{texto}</span>;
}

// Texto do badge de uma conta fixa: prioriza "já paga", senão mostra
// quantos dias faltam (ou já passaram, se atrasada).
export function textoStatusContaFixa(nivel: Nivel, diasRestantes: number, paga: boolean): string {
  if (paga) return 'Paga este mês';
  if (nivel === 'atrasada') return `Atrasada há ${Math.abs(diasRestantes)} dia(s)`;
  if (nivel === 'atencao') return `Vence em ${diasRestantes} dia(s)`;
  return `Vence em ${diasRestantes} dias`;
}

// Mesma lógica da conta fixa, mas para uma parcela específica.
export function textoStatusParcela(nivel: Nivel, diasRestantes: number, paga: boolean): string {
  if (paga) return 'Paga';
  if (nivel === 'atrasada') return `Atrasada há ${Math.abs(diasRestantes)} dia(s)`;
  if (nivel === 'atencao') return `Vence em ${diasRestantes} dia(s)`;
  return `Vence em ${diasRestantes} dias`;
}

// Mesma lógica da conta fixa, mas para a fatura de um cartão de crédito.
export function textoStatusFatura(nivel: Nivel, diasRestantes: number, paga: boolean): string {
  if (paga) return 'Fatura paga';
  if (nivel === 'atrasada') return `Atrasada há ${Math.abs(diasRestantes)} dia(s)`;
  if (nivel === 'atencao') return `Vence em ${diasRestantes} dia(s)`;
  return `Vence em ${diasRestantes} dias`;
}

// Texto do badge de um orçamento: mostra a porcentagem já usada, ou
// avisa que estourou o limite.
export function textoStatusOrcamento(nivel: NivelOrcamento, percentual: number): string {
  const pct = Math.round(percentual * 100);
  if (nivel === 'estourado') return `Orçamento estourado (${pct}%)`;
  if (nivel === 'atencao') return `${pct}% do orçamento usado`;
  return `${pct}% do orçamento usado`;
}
