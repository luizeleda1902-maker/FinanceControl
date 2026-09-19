// Interpretação de comandos de voz em português para lançamentos rápidos
// (ver src/pages/LancamentoPorVoz.tsx). Funções puras — não tocam no banco
// (db.ts): só recebem o texto já transcrito pela Web Speech API e devolvem
// o que foi entendido (tipo/valor/descrição/sugestão de categoria).

import { NOME_GASTOS_VARIAVEIS, type TipoTransacao, type Categoria } from './db';

function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Números por 0-999999 escritos por extenso, usados como fallback quando a
// fala não vier já em dígitos (ex: "trinta e cinco reais" em vez de "35
// reais" — a Web Speech API para pt-BR normalmente já devolve dígitos, mas
// nem sempre).
const UNIDADES_EXTENSO: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40,
  cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300,
  trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500,
  quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700,
  setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900,
  novecentas: 900,
};

// Converte algo como "trinta e cinco" -> 35, "cento e vinte" -> 120,
// "dois mil e trezentos" -> 2300. Devolve null se nenhuma palavra numérica
// foi reconhecida (texto não é um número por extenso).
function palavrasParaNumero(texto: string): number | null {
  const tokens = removerAcentos(texto.toLowerCase())
    .split(/\s+/)
    .filter((t) => t && t !== 'e');
  if (tokens.length === 0) return null;

  let total = 0;
  let atual = 0;
  let encontrouAlgum = false;
  for (const token of tokens) {
    if (token === 'mil') {
      total += (atual === 0 ? 1 : atual) * 1000;
      atual = 0;
      encontrouAlgum = true;
      continue;
    }
    const valorToken = UNIDADES_EXTENSO[token];
    if (valorToken !== undefined) {
      atual += valorToken;
      encontrouAlgum = true;
    }
  }
  total += atual;
  return encontrouAlgum ? total : null;
}

// Procura "e XX centavos" (dígito ou extenso) logo depois de onde o valor em
// reais terminou, para completar valores como "30 reais e 50 centavos".
function extrairCentavos(lower: string, apartirDe: number): { valor: number; novoSpanEnd: number } | null {
  const restante = lower.slice(apartirDe);
  const digitoCentavos = restante.match(/^\s*e\s+(\d{1,2})\s*centavos?\b/);
  if (digitoCentavos) {
    return { valor: Number(digitoCentavos[1]), novoSpanEnd: apartirDe + digitoCentavos[0].length };
  }
  const extensoCentavos = restante.match(/^\s*e\s+([a-zçãáéíóõêô\s]+?)\s*centavos?\b/);
  if (extensoCentavos) {
    const numero = palavrasParaNumero(extensoCentavos[1]);
    if (numero !== null) {
      return { valor: numero, novoSpanEnd: apartirDe + extensoCentavos[0].length };
    }
  }
  return null;
}

// Acha o valor em reais dentro da fala e o intervalo de caracteres (no
// texto original) que ele ocupa, para que esse trecho possa ser removido na
// hora de montar a descrição. Tenta primeiro dígitos ("30 reais"), e só cai
// para números por extenso ("trinta reais") se não achar nenhum dígito.
function extrairValor(original: string): { valor: number; spanStart: number; spanEnd: number } | null {
  const lower = original.toLowerCase();

  const digitoMatch = lower.match(/\d+(?:[.,]\d{1,2})?/);
  if (digitoMatch && digitoMatch.index !== undefined) {
    let spanStart = digitoMatch.index;
    let spanEnd = spanStart + digitoMatch[0].length;
    let valorReais = parseFloat(digitoMatch[0].replace(',', '.'));

    const depois = lower.slice(spanEnd);
    const moedaDepois = depois.match(/^\s*(reais|real|r\$|contos|conto)/);
    if (moedaDepois) {
      spanEnd += moedaDepois[0].length;
    } else {
      const antes = lower.slice(0, spanStart);
      const moedaAntes = antes.match(/r\$\s*$/);
      if (moedaAntes) spanStart -= moedaAntes[0].length;
    }

    const centavos = extrairCentavos(lower, spanEnd);
    if (centavos) {
      valorReais += centavos.valor / 100;
      spanEnd = centavos.novoSpanEnd;
    }
    return { valor: Math.round(valorReais * 100) / 100, spanStart, spanEnd };
  }

  const idxReais = lower.search(/\breais?\b/);
  if (idxReais === -1) return null;
  const antesTexto = lower.slice(0, idxReais);
  const antesTrim = antesTexto.trimEnd();
  const palavrasAntes = antesTrim.split(/\s+/);
  const janela = palavrasAntes.slice(-6).join(' ');
  const numero = palavrasParaNumero(janela);
  if (numero === null) return null;

  const spanStart = Math.max(0, antesTrim.length - janela.length);
  const fimPalavraReais = idxReais + (lower.slice(idxReais).match(/^reais?/)?.[0].length ?? 5);
  let valorReais = numero;
  let spanEnd = fimPalavraReais;
  const centavos = extrairCentavos(lower, fimPalavraReais);
  if (centavos) {
    valorReais += centavos.valor / 100;
    spanEnd = centavos.novoSpanEnd;
  }
  return { valor: Math.round(valorReais * 100) / 100, spanStart, spanEnd };
}

// Verbos/conectores removidos das pontas da descrição — repete a checagem
// em loop porque depois de remover um, outro pode ter ficado exposto (ex:
// "gastei com almoço" -> remove "gastei " -> "com almoço" -> remove "com ").
const INICIO_A_REMOVER = /^(gastei|paguei|comprei|recebi|ganhei|entrou|caiu|com|em|de|do|da|no|na|um|uma|os|as|o|a|e)\s+/i;
const FIM_A_REMOVER = /\s+(com|em|de|do|da|no|na|e)$/i;

export interface LancamentoInterpretado {
  tipo: TipoTransacao;
  valor: number | null;
  descricao: string;
}

// Interpreta uma frase falada (já transcrita) como um lançamento: detecta
// se é receita ou despesa, extrai o valor em reais e usa o resto da frase
// como descrição. `valor: null` sinaliza que não foi possível entender
// nenhum valor — quem chama deve tratar isso como falha de reconhecimento.
export function interpretarLancamentoPorVoz(fala: string): LancamentoInterpretado {
  const original = fala.trim();
  const semAcento = removerAcentos(original.toLowerCase());

  const tipo: TipoTransacao = /\b(recebi|ganhei|entrou|caiu)\b/.test(semAcento) ? 'receita' : 'despesa';

  const encontrado = extrairValor(original);
  const valor = encontrado ? encontrado.valor : null;

  let descricao = encontrado
    ? `${original.slice(0, encontrado.spanStart)} ${original.slice(encontrado.spanEnd)}`
    : original;
  descricao = descricao.replace(/\s+/g, ' ').trim();

  let anterior = '';
  while (anterior !== descricao) {
    anterior = descricao;
    descricao = descricao.replace(INICIO_A_REMOVER, '').replace(FIM_A_REMOVER, '').trim();
  }

  if (!descricao) descricao = tipo === 'despesa' ? 'Gasto por voz' : 'Receita por voz';
  descricao = descricao.charAt(0).toUpperCase() + descricao.slice(1);

  return { tipo, valor, descricao };
}

// Palavras-chave -> categoria padrão (ver CATEGORIAS_PADRAO em db.ts). Só
// se aplica a despesas — para receitas o fallback "Outras receitas" já
// cobre a maioria dos casos de uso por voz.
const PALAVRAS_CHAVE_DESPESA: Array<{ categoria: string; palavras: string[] }> = [
  {
    categoria: 'Alimentação',
    palavras: ['almoco', 'janta', 'jantar', 'cafe', 'lanche', 'mercado', 'supermercado', 'restaurante', 'padaria', 'pizza', 'hamburguer', 'comida', 'ifood', 'delivery', 'marmita'],
  },
  {
    categoria: 'Transporte',
    palavras: ['uber', '99', 'taxi', 'gasolina', 'combustivel', 'onibus', 'metro', 'passagem', 'estacionamento', 'pedagio', 'corrida'],
  },
  {
    categoria: 'Moradia',
    palavras: ['aluguel', 'condominio', 'luz', 'energia', 'agua', 'internet', 'gas', 'iptu'],
  },
  {
    categoria: 'Saúde',
    palavras: ['farmacia', 'remedio', 'medico', 'consulta', 'dentista', 'exame'],
  },
  {
    categoria: 'Lazer',
    palavras: ['cinema', 'show', 'viagem', 'passeio', 'jogo', 'streaming', 'netflix', 'bar', 'festa', 'balada'],
  },
];

// Sugere o NOME de uma categoria (não o id) para o lançamento interpretado:
// 1) reaproveita uma categoria já cadastrada (padrão ou criada pelo
//    usuário) se o nome dela aparecer na descrição; 2) senão tenta o mapa de
// palavras-chave acima; 3) senão cai no fallback de "gastos variáveis"/
// "outras receitas", que já existem no banco. Quem chama ainda precisa
// passar esse nome por buscarOuCriarCategoria (db.ts) para resolver o id.
export function sugerirCategoria(tipo: TipoTransacao, descricao: string, categoriasExistentes: Categoria[]): string {
  const normDescricao = removerAcentos(descricao.toLowerCase());

  for (const cat of categoriasExistentes) {
    const nomeCat = removerAcentos(cat.nome.toLowerCase());
    if (nomeCat && (normDescricao.includes(nomeCat) || nomeCat.includes(normDescricao))) {
      return cat.nome;
    }
  }

  if (tipo === 'despesa') {
    for (const { categoria, palavras } of PALAVRAS_CHAVE_DESPESA) {
      if (palavras.some((p) => normDescricao.includes(p))) return categoria;
    }
  }

  return tipo === 'despesa' ? NOME_GASTOS_VARIAVEIS : 'Outras receitas';
}
