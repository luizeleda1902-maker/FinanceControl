// Paleta de cores usada para identificar categorias nos gráficos e nas
// bolinhas coloridas (tela de Categorias). Cada categoria guarda um
// `corIndex` fixo que sempre aponta pra mesma cor aqui — assim a cor de
// "Alimentação" nunca muda de um gráfico pro outro.
export const CORES_CATEGORIA = [
  '#2a78d6',
  '#1baf7a',
  '#eda100',
  '#008300',
  '#4a3aa7',
  '#e34948',
  '#e87ba4',
  '#eb6834',
  '#a56a3a',
] as const;

// Cor cinza usada no gráfico de gastos por categoria (Relatorios.tsx)
// quando várias categorias pequenas são agrupadas num item só "Outros".
export const COR_OUTROS = '#9aa0a6';

// Devolve a cor correspondente a um corIndex. O `% length` garante que a
// função nunca quebre mesmo se corIndex vier maior que a quantidade de
// cores disponíveis (as cores simplesmente se repetem).
export function corDaCategoria(corIndex: number): string {
  return CORES_CATEGORIA[corIndex % CORES_CATEGORIA.length];
}
