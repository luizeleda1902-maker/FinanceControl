// Gráfico de gastos por categoria, no estilo "lista com barrinha de
// progresso" (em vez de um gráfico de pizza — mais fácil de ler quando há
// muitas categorias). Feito com CSS puro, sem biblioteca de gráficos.

import { corDaCategoria, COR_OUTROS } from '../theme';
import { formatMoeda } from '../utils';

export interface FatiaCategoria {
  nome: string;
  valor: number;
  corIndex: number;
}

interface Props {
  dados: FatiaCategoria[];
}

// Mostra no máximo 8 categorias individualmente; o resto vira uma linha
// "Outros" agrupada, pra lista não ficar gigante quando há muitas
// categorias com valores pequenos.
const MAX_LINHAS = 8;

export default function GraficoCategorias({ dados }: Props) {
  const total = dados.reduce((s, d) => s + d.valor, 0);
  if (total === 0) return <p className="empty">Sem despesas no período.</p>;

  // Ordena da categoria que mais gastou para a que menos gastou, e separa
  // o que passar de MAX_LINHAS para juntar num "Outros" só.
  const ordenadas = [...dados].filter((d) => d.valor > 0).sort((a, b) => b.valor - a.valor);
  const principais = ordenadas.slice(0, MAX_LINHAS);
  const outros = ordenadas.slice(MAX_LINHAS);
  const valorOutros = outros.reduce((s, d) => s + d.valor, 0);

  const linhas = valorOutros > 0
    ? [...principais, { nome: 'Outros', valor: valorOutros, corIndex: -1 }]
    : principais;

  return (
    <div>
      {linhas.map((linha) => {
        const pct = (linha.valor / total) * 100;
        // corIndex -1 é o marcador da linha "Outros" (usa cinza, não uma cor de categoria).
        const cor = linha.corIndex >= 0 ? corDaCategoria(linha.corIndex) : COR_OUTROS;
        return (
          <div className="chart-row" key={linha.nome}>
            <span className="chart-swatch" style={{ background: cor }} />
            <span className="chart-label">{linha.nome}</span>
            <span className="chart-track">
              <span className="chart-fill" style={{ width: `${pct}%`, background: cor }} />
            </span>
            <span className="chart-value">
              {formatMoeda(linha.valor)} ({pct.toFixed(0)}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}
