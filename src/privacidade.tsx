// "Modo privado": controla se os valores em R$ aparecem normalmente ou
// mascarados (R$ ••••) na tela inteira. Serve pra você poder mostrar o
// app pra alguém sem revelar seus ganhos/gastos.
//
// Como funciona: um React Context guarda o estado `visivel` e a função
// `alternar()` que liga/desliga. O componente <Valor> lê esse contexto e
// decide se mostra o número real ou a máscara — por isso, em vez de
// escrever `{formatMoeda(x)}` nas telas, usamos `<Valor valor={x} />`.

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { formatMoeda } from './utils';

// Chave usada no localStorage do navegador para lembrar a preferência do
// usuário entre uma sessão e outra (se ele fechar e abrir o app de novo,
// continua no mesmo modo que deixou).
const CHAVE_STORAGE = 'controle-financeiro:valores-visiveis';

interface VisibilidadeContextValue {
  visivel: boolean;
  alternar: () => void;
}

const VisibilidadeContext = createContext<VisibilidadeContextValue | null>(null);

// Lê a preferência salva. Se nunca foi definida (primeiro uso do app) ou
// se o localStorage não estiver disponível, assume "visível" por padrão.
function lerEstadoInicial(): boolean {
  try {
    const salvo = localStorage.getItem(CHAVE_STORAGE);
    return salvo === null ? true : salvo === '1';
  } catch {
    return true;
  }
}

// Envolve toda a aplicação (ver App.tsx) para que qualquer tela consiga
// ler o estado de visibilidade via useVisibilidade().
export function VisibilidadeProvider({ children }: { children: ReactNode }) {
  const [visivel, setVisivel] = useState(lerEstadoInicial);

  const alternar = useCallback(() => {
    setVisivel((atual) => {
      const novo = !atual;
      try {
        localStorage.setItem(CHAVE_STORAGE, novo ? '1' : '0');
      } catch {
        // localStorage indisponível (ex: navegação privada) — mantém só em memória.
      }
      return novo;
    });
  }, []);

  return <VisibilidadeContext.Provider value={{ visivel, alternar }}>{children}</VisibilidadeContext.Provider>;
}

// Hook usado pelas telas/componentes para ler `visivel` e chamar `alternar()`
// (ex: o botão de olho no topo do app).
export function useVisibilidade(): VisibilidadeContextValue {
  const ctx = useContext(VisibilidadeContext);
  if (!ctx) throw new Error('useVisibilidade deve ser usado dentro de VisibilidadeProvider');
  return ctx;
}

// Texto mostrado no lugar do valor real quando o modo privado está ativo.
const MASCARA = 'R$ ••••';

// Componente central do modo privado: em vez de formatar o valor direto
// nas telas, usamos <Valor valor={x} /> em todo lugar que mostra dinheiro.
// Assim, ativar/desativar o modo privado muda o app inteiro de uma vez só.
export function Valor({ valor, className, style }: { valor: number; className?: string; style?: React.CSSProperties }) {
  const { visivel } = useVisibilidade();
  return (
    <span className={className} style={style}>
      {visivel ? formatMoeda(valor) : MASCARA}
    </span>
  );
}

// Versão em função (em vez de componente) para os poucos lugares que
// precisam do texto puro, como dentro do SVG do gráfico de barras.
export function useValorTexto() {
  const { visivel } = useVisibilidade();
  return (valor: number) => (visivel ? formatMoeda(valor) : MASCARA);
}
