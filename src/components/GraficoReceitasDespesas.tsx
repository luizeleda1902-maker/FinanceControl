// Gráfico de barras "divergente": receitas crescem pra cima a partir de
// uma linha central, despesas crescem pra baixo. Desenhado em SVG puro
// (sem biblioteca de gráficos) porque é simples o bastante e mantém o app
// leve. O <title> dentro de cada barra vira um tooltip nativo do navegador
// ao passar o mouse — de graça, sem JavaScript extra.

import { formatMesLabel, formatMoeda } from '../utils';

export interface PontoReceitaDespesa {
  mes: string; // yyyy-MM
  receitas: number;
  despesas: number;
}

interface Props {
  dados: PontoReceitaDespesa[];
}

// Medidas do desenho, em "pixels" do viewBox do SVG (o `width="100%"`
// depois escala tudo pra caber na tela).
const ALTURA = 160;
const METADE = ALTURA / 2; // linha central: onde receita e despesa se encontram
const LARGURA_BARRA = 22;
const GAP = 14;

export default function GraficoReceitasDespesas({ dados }: Props) {
  if (dados.length === 0) return null;

  // `maior` é o maior valor entre todas as barras — usado para calcular a
  // altura proporcional de cada uma (a maior barra ocupa quase toda a
  // metade disponível). O `Math.max(1, ...)` evita divisão por zero
  // quando não há nenhum dado ainda.
  const maior = Math.max(1, ...dados.map((d) => Math.max(d.receitas, d.despesas)));
  const largura = dados.length * (LARGURA_BARRA * 2 + GAP) + GAP;

  return (
    <svg width="100%" viewBox={`0 0 ${largura} ${ALTURA + 24}`} role="img" aria-label="Receitas x despesas por mês">
      {/* Linha do "zero", onde as barras de receita (acima) e despesa (abaixo) se encontram */}
      <line x1={0} y1={METADE} x2={largura} y2={METADE} stroke="var(--border)" strokeWidth={1} />
      {dados.map((d, i) => {
        const x = GAP + i * (LARGURA_BARRA * 2 + GAP);
        const alturaReceita = (d.receitas / maior) * (METADE - 8);
        const alturaDespesa = (d.despesas / maior) * (METADE - 8);
        return (
          <g key={d.mes}>
            {/* Barra de receita: cresce para cima a partir da linha central */}
            <rect
              x={x}
              y={METADE - alturaReceita}
              width={LARGURA_BARRA}
              height={alturaReceita}
              fill="var(--ok)"
              rx={2}
            >
              <title>{`Receitas ${formatMesLabel(d.mes)}: ${formatMoeda(d.receitas)}`}</title>
            </rect>
            {/* Barra de despesa: cresce para baixo a partir da linha central */}
            <rect
              x={x + LARGURA_BARRA}
              y={METADE}
              width={LARGURA_BARRA}
              height={alturaDespesa}
              fill="var(--danger)"
              rx={2}
            >
              <title>{`Despesas ${formatMesLabel(d.mes)}: ${formatMoeda(d.despesas)}`}</title>
            </rect>
            <text
              x={x + LARGURA_BARRA}
              y={ALTURA + 18}
              textAnchor="middle"
              fontSize={10}
              fill="var(--text-muted)"
            >
              {formatMesLabel(d.mes)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
