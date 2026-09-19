// Este arquivo é o "banco de dados" do app. Ele guarda tudo localmente no
// navegador usando IndexedDB (via biblioteca `idb`), sem nenhuma chamada de
// rede — por isso o app funciona 100% offline e sem integração bancária.
//
// Cada bloco de código abaixo cuida de uma "tabela" (aqui chamada de
// "store"): categorias, transações, contas fixas, parcelamentos, orçamentos
// e renda mensal. Para cada uma existem funções `listar`/`buscar`/`salvar`/
// `excluir`, sempre no mesmo padrão.

import { openDB, type IDBPDatabase } from 'idb';
import { addMonths, format, parseISO } from 'date-fns';
import { hojeISO, mesAtual } from './utils';

// 'receita' = dinheiro que entra (salário, venda etc.)
// 'despesa' = dinheiro que sai (contas, compras etc.)
export type TipoTransacao = 'receita' | 'despesa';

// Uma categoria serve para agrupar lançamentos (ex: "Alimentação",
// "Transporte"). `corIndex` aponta para uma cor fixa em theme.ts, usada nos
// gráficos e nas bolinhas coloridas da tela de Categorias.
export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoTransacao;
  corIndex: number;
  criadoEm: string;
}

// Um lançamento único de receita ou despesa. `contaFixaId`/`parcelaId` são
// preenchidos automaticamente quando a transação foi criada a partir do
// pagamento de uma conta fixa ou de uma parcela (ver pagarContaFixa/
// pagarParcela mais abaixo) — isso permite rastrear a origem do gasto.
export interface Transacao {
  id: string;
  tipo: TipoTransacao;
  valor: number;
  categoriaId: string;
  data: string; // ISO date (yyyy-MM-dd)
  descricao: string;
  contaFixaId?: string;
  parcelaId?: string;
  parcelaCartaoId?: string;
  criadoEm: string;
}

// Uma conta que se repete todo mês (aluguel, assinatura, etc.). Ela é só a
// "definição" — o controle de quais meses já foram pagos fica na tabela
// PagamentoContaFixa logo abaixo.
export interface ContaFixa {
  id: string;
  descricao: string;
  categoriaId: string;
  valor: number;
  diaVencimento: number; // 1-31
  ativa: boolean;
  criadoEm: string;
}

// Marca que uma ContaFixa foi paga em um determinado mês. Cada pagamento
// também gera uma Transacao (despesa) correspondente, guardada em
// `transacaoId`.
export interface PagamentoContaFixa {
  id: string;
  contaFixaId: string;
  mesReferencia: string; // yyyy-MM
  dataPagamento: string;
  transacaoId: string;
}

// Uma compra parcelada (ex: "Notebook em 10x"). Ao criar um Parcelamento,
// já geramos todas as Parcelas de uma vez (ver criarParcelamento).
export interface Parcelamento {
  id: string;
  descricao: string;
  categoriaId: string;
  valorTotal: number;
  numeroParcelas: number;
  dataPrimeiraParcela: string; // ISO date
  criadoEm: string;
}

// Uma parcela individual de um Parcelamento, com sua própria data de
// vencimento e status de pagamento — assim dá pra pagar fora de ordem ou
// atrasada sem perder o histórico.
export interface Parcela {
  id: string;
  parcelamentoId: string;
  numero: number;
  valor: number;
  vencimento: string; // ISO date
  paga: boolean;
  dataPagamento?: string;
  transacaoId?: string;
}

// Um limite mensal de gasto. Se `categoriaId` for null, é o "orçamento
// geral" (soma de todas as despesas do mês); senão, é o limite só daquela
// categoria específica.
export interface Orcamento {
  id: string;
  categoriaId: string | null; // null = orçamento geral (todas as categorias)
  limite: number;
  criadoEm: string;
}

// Quanto o usuário ganha em um determinado mês. Existe no máximo um
// registro por mês (ver índice único 'mesReferencia' criado abaixo).
export interface RendaMensal {
  id: string;
  mesReferencia: string; // yyyy-MM
  valor: number;
  criadoEm: string;
}

// Um cartão de crédito. `diaFechamento` é o dia em que a fatura fecha
// (compras depois dele caem na fatura do mês seguinte); `diaVencimento` é
// o dia em que a fatura já fechada deve ser paga.
export interface CartaoCredito {
  id: string;
  nome: string;
  limite: number;
  diaFechamento: number; // 1-31
  diaVencimento: number; // 1-31
  ativo: boolean;
  criadoEm: string;
}

// Uma compra feita no cartão (à vista ou parcelada). Só a "definição" —
// cada parcela vira um registro próprio em ParcelaCartao, já associada ao
// mês de fatura em que vai cair (ver criarCompraCartao).
export interface CompraCartao {
  id: string;
  cartaoId: string;
  descricao: string;
  categoriaId: string;
  valorTotal: number;
  numeroParcelas: number;
  dataCompra: string; // ISO date
  criadoEm: string;
}

// Uma parcela de uma compra no cartão. `mesFatura` já vem calculado na
// criação (com base no dia de fechamento do cartão), então o resto do app
// só precisa agrupar parcelas por esse campo para montar cada fatura.
export interface ParcelaCartao {
  id: string;
  compraId: string;
  cartaoId: string;
  numero: number;
  valor: number;
  mesFatura: string; // yyyy-MM
  paga: boolean;
  transacaoId?: string;
}

// Marca que a fatura de um cartão, em um mês de referência, foi paga.
// Pagar uma fatura gera uma Transacao (despesa) para cada parcela daquele
// mês ainda não paga (ver pagarFatura), preservando a categoria de cada
// compra original.
export interface PagamentoFatura {
  id: string;
  cartaoId: string;
  mesReferencia: string; // yyyy-MM
  dataPagamento: string;
  valor: number;
}

const DB_NAME = 'controle-financeiro-pessoal';
// Sempre que uma nova "tabela" (object store) for adicionada ou os dados
// precisarem de algum ajuste automático, aumente este número — o bloco
// `upgrade` abaixo roda de novo e aplica só o que faltar, sem apagar nada
// que o usuário já tinha salvo.
const DB_VERSION = 4;

// Categorias que já vêm prontas na primeira vez que o app é aberto, para o
// usuário não precisar cadastrar tudo do zero.
const CATEGORIAS_PADRAO: Array<{ nome: string; tipo: TipoTransacao; corIndex: number }> = [
  { nome: 'Salário', tipo: 'receita', corIndex: 0 },
  { nome: 'Outras receitas', tipo: 'receita', corIndex: 1 },
  { nome: 'Alimentação', tipo: 'despesa', corIndex: 2 },
  { nome: 'Transporte', tipo: 'despesa', corIndex: 3 },
  { nome: 'Moradia', tipo: 'despesa', corIndex: 4 },
  { nome: 'Saúde', tipo: 'despesa', corIndex: 5 },
  { nome: 'Lazer', tipo: 'despesa', corIndex: 6 },
  { nome: 'Outras despesas', tipo: 'despesa', corIndex: 7 },
];

// Nome usado para achar/criar a categoria de gastos variáveis (lanches,
// besteiras, compras aleatórias). Mantido como constante para o atalho de
// "gasto rápido" do Dashboard localizar essa categoria sem depender de id.
export const NOME_GASTOS_VARIAVEIS = 'Gastos variáveis';
const COR_INDEX_GASTOS_VARIAVEIS = 8;
const LIMITE_SUGERIDO_GASTOS_VARIAVEIS = 200;

// Guarda a "promessa" de conexão com o banco, criada uma única vez. Assim,
// mesmo que várias telas chamem getDb() ao mesmo tempo, todas esperam a
// MESMA conexão em vez de abrir uma nova cada vez.
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      // Esta função só roda quando o banco é criado pela primeira vez ou
      // quando DB_VERSION aumenta. É aqui que criamos as "tabelas" (stores)
      // e seus índices (usados para buscas rápidas, tipo "todas as
      // transações de julho").
      async upgrade(db, _oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('categorias')) {
          const store = db.createObjectStore('categorias', { keyPath: 'id' });
          store.createIndex('tipo', 'tipo');
          // Semeia categorias padrão já na criação do banco, evitando uma
          // corrida entre o seed assíncrono do App.tsx e páginas que
          // listam categorias logo no primeiro carregamento (deep link).
          for (const categoria of CATEGORIAS_PADRAO) {
            await store.put({ id: crypto.randomUUID(), criadoEm: new Date().toISOString(), ...categoria });
          }
        }
        if (!db.objectStoreNames.contains('transacoes')) {
          const store = db.createObjectStore('transacoes', { keyPath: 'id' });
          store.createIndex('data', 'data');
          store.createIndex('categoriaId', 'categoriaId');
          store.createIndex('tipo', 'tipo');
        }
        if (!db.objectStoreNames.contains('contasFixas')) {
          const store = db.createObjectStore('contasFixas', { keyPath: 'id' });
          store.createIndex('categoriaId', 'categoriaId');
        }
        if (!db.objectStoreNames.contains('pagamentosContaFixa')) {
          const store = db.createObjectStore('pagamentosContaFixa', { keyPath: 'id' });
          store.createIndex('contaFixaId', 'contaFixaId');
          store.createIndex('mesReferencia', 'mesReferencia');
        }
        if (!db.objectStoreNames.contains('parcelamentos')) {
          const store = db.createObjectStore('parcelamentos', { keyPath: 'id' });
          store.createIndex('categoriaId', 'categoriaId');
        }
        if (!db.objectStoreNames.contains('parcelas')) {
          const store = db.createObjectStore('parcelas', { keyPath: 'id' });
          store.createIndex('parcelamentoId', 'parcelamentoId');
          store.createIndex('vencimento', 'vencimento');
        }
        if (!db.objectStoreNames.contains('orcamentos')) {
          const store = db.createObjectStore('orcamentos', { keyPath: 'id' });
          store.createIndex('categoriaId', 'categoriaId');
        }
        if (!db.objectStoreNames.contains('rendasMensais')) {
          const store = db.createObjectStore('rendasMensais', { keyPath: 'id' });
          store.createIndex('mesReferencia', 'mesReferencia', { unique: true });
        }
        if (!db.objectStoreNames.contains('cartoes')) {
          db.createObjectStore('cartoes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('comprasCartao')) {
          const store = db.createObjectStore('comprasCartao', { keyPath: 'id' });
          store.createIndex('cartaoId', 'cartaoId');
        }
        if (!db.objectStoreNames.contains('parcelasCartao')) {
          const store = db.createObjectStore('parcelasCartao', { keyPath: 'id' });
          store.createIndex('compraId', 'compraId');
          store.createIndex('cartaoId', 'cartaoId');
          store.createIndex('mesFatura', 'mesFatura');
        }
        if (!db.objectStoreNames.contains('pagamentosFatura')) {
          const store = db.createObjectStore('pagamentosFatura', { keyPath: 'id' });
          store.createIndex('cartaoId', 'cartaoId');
        }

        // Garante a categoria "Gastos variáveis" + uma meta sugerida de
        // orçamento, tanto em bancos novos (recém-criados acima) quanto em
        // bancos de usuários que já tinham dados antes dessa versão. Por
        // isso não colocamos essa categoria direto em CATEGORIAS_PADRAO:
        // assim ela é adicionada também para quem já usava o app antes
        // dela existir, sem duplicar se o código rodar de novo.
        const catStore = transaction.objectStore('categorias');
        const categoriasDespesa = await catStore.index('tipo').getAll('despesa');
        let categoriaGastosVariaveis = categoriasDespesa.find((c) => c.nome === NOME_GASTOS_VARIAVEIS);
        if (!categoriaGastosVariaveis) {
          categoriaGastosVariaveis = {
            id: crypto.randomUUID(),
            nome: NOME_GASTOS_VARIAVEIS,
            tipo: 'despesa',
            corIndex: COR_INDEX_GASTOS_VARIAVEIS,
            criadoEm: new Date().toISOString(),
          };
          await catStore.put(categoriaGastosVariaveis);
        }

        const orcStore = transaction.objectStore('orcamentos');
        const orcamentos = await orcStore.getAll();
        const jaTemMeta = orcamentos.some((o) => o.categoriaId === categoriaGastosVariaveis!.id);
        if (!jaTemMeta) {
          await orcStore.put({
            id: crypto.randomUUID(),
            categoriaId: categoriaGastosVariaveis.id,
            limite: LIMITE_SUGERIDO_GASTOS_VARIAVEIS,
            criadoEm: new Date().toISOString(),
          });
        }
      },
    });
  }
  return dbPromise;
}

// Gera um id único para cada novo registro (categoria, transação, etc.).
function generateId() {
  return crypto.randomUUID();
}

// Nível de urgência usado nos "badges" coloridos (ver StatusBadge.tsx):
// 'ok' = tudo certo, 'atencao' = vencendo em breve, 'atrasada' = já venceu.
export type Nivel = 'ok' | 'atencao' | 'atrasada';

// Quantos dias faltam (número negativo = já passou) até uma data. Usado
// por contas fixas e parcelas para decidir a cor do badge de vencimento.
export function diasParaVencer(dataIso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataIso);
  venc.setHours(0, 0, 0, 0);
  return Math.round((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------- Categorias ----------

// Lista todas as categorias (ou só as de um tipo, se `tipo` for informado),
// em ordem alfabética.
export async function listarCategorias(tipo?: TipoTransacao): Promise<Categoria[]> {
  const db = await getDb();
  const all = tipo
    ? await db.getAllFromIndex('categorias', 'tipo', tipo)
    : await db.getAll('categorias');
  return all.sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function buscarCategoria(id: string): Promise<Categoria | undefined> {
  const db = await getDb();
  return db.get('categorias', id);
}

// Cria uma categoria nova (quando `data.id` não é informado) ou atualiza
// uma existente (quando é). Esse padrão de "criar ou atualizar com o mesmo
// nome de função" se repete em quase todo o arquivo.
export async function salvarCategoria(
  data: Omit<Categoria, 'id' | 'criadoEm'> & { id?: string }
): Promise<Categoria> {
  const db = await getDb();
  const categoria: Categoria = {
    id: data.id ?? generateId(),
    nome: data.nome,
    tipo: data.tipo,
    corIndex: data.corIndex,
    criadoEm: new Date().toISOString(),
  };
  await db.put('categorias', categoria);
  return categoria;
}

export async function excluirCategoria(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('categorias', id);
}

// Rede de segurança: se por algum motivo o app abrir com a lista de
// categorias totalmente vazia (o `upgrade` acima já cuida do caso normal,
// e isso também acontece depois de um apagarTodosOsDados()), esta função
// recria as categorias padrão + a categoria/meta de gastos variáveis.
// Chamada uma vez no App.tsx.
export async function seedCategoriasPadrao(): Promise<void> {
  const existentes = await listarCategorias();
  if (existentes.length > 0) return;
  for (const categoria of CATEGORIAS_PADRAO) {
    await salvarCategoria(categoria);
  }
  const gastosVariaveis = await salvarCategoria({
    nome: NOME_GASTOS_VARIAVEIS,
    tipo: 'despesa',
    corIndex: COR_INDEX_GASTOS_VARIAVEIS,
  });
  await salvarOrcamento({ categoriaId: gastosVariaveis.id, limite: LIMITE_SUGERIDO_GASTOS_VARIAVEIS });
}

// Usada pelo campo de categoria em texto livre (ver components/
// CategoriaInput.tsx): o usuário digita qualquer nome, sem precisar
// escolher de uma lista fixa. Se já existir uma categoria com esse nome
// (ignorando maiúsculas/minúsculas) para o tipo pedido, reaproveita ela;
// senão, cria uma nova na hora.
export async function buscarOuCriarCategoria(nome: string, tipo: TipoTransacao): Promise<Categoria> {
  const nomeLimpo = nome.trim();
  const existentes = await listarCategorias(tipo);
  const encontrada = existentes.find((c) => c.nome.toLowerCase() === nomeLimpo.toLowerCase());
  if (encontrada) return encontrada;
  const todas = await listarCategorias();
  return salvarCategoria({ nome: nomeLimpo, tipo, corIndex: todas.length });
}

// ---------- Backup (exportar/importar) ----------

// Nomes de todas as "tabelas" do banco, na ordem em que aparecem no objeto
// de backup. Reaproveitado tanto por exportarDados quanto por
// apagarTodosOsDados/importarDados, pra nunca esquecer uma tabela nova.
const NOMES_DAS_TABELAS = [
  'categorias',
  'transacoes',
  'contasFixas',
  'pagamentosContaFixa',
  'parcelamentos',
  'parcelas',
  'orcamentos',
  'rendasMensais',
  'cartoes',
  'comprasCartao',
  'parcelasCartao',
  'pagamentosFatura',
] as const;

// Formato do arquivo `.json` gerado por exportarDados/lido por
// importarDados. `versao` guarda o DB_VERSION no momento da exportação —
// não é usado para migração hoje, mas fica registrado para diagnóstico.
export interface DadosExportados {
  versao: number;
  exportadoEm: string;
  categorias: Categoria[];
  transacoes: Transacao[];
  contasFixas: ContaFixa[];
  pagamentosContaFixa: PagamentoContaFixa[];
  parcelamentos: Parcelamento[];
  parcelas: Parcela[];
  orcamentos: Orcamento[];
  rendasMensais: RendaMensal[];
  cartoes: CartaoCredito[];
  comprasCartao: CompraCartao[];
  parcelasCartao: ParcelaCartao[];
  pagamentosFatura: PagamentoFatura[];
}

// Lê todas as tabelas do banco e devolve um único objeto serializável em
// JSON — usado pela tela de Ajustes para gerar o arquivo de backup que o
// usuário baixa. Como o app é 100% local (ver comentário no topo do
// arquivo), esse arquivo é a única forma de não perder os dados se o
// navegador limpar o armazenamento, trocar de aparelho, etc.
export async function exportarDados(): Promise<DadosExportados> {
  const db = await getDb();
  const tabelas = await Promise.all(NOMES_DAS_TABELAS.map((nome) => db.getAll(nome)));
  const dados = Object.fromEntries(NOMES_DAS_TABELAS.map((nome, i) => [nome, tabelas[i]]));
  return { versao: DB_VERSION, exportadoEm: new Date().toISOString(), ...dados } as DadosExportados;
}

// Confere, de forma simples, se um objeto lido de um arquivo tem a cara de
// um backup válido (todas as tabelas presentes como array) antes de deixar
// importarDados apagar os dados atuais.
function pareceDadosExportados(valor: unknown): valor is DadosExportados {
  if (!valor || typeof valor !== 'object') return false;
  return NOMES_DAS_TABELAS.every((nome) => Array.isArray((valor as Record<string, unknown>)[nome]));
}

// Restaura um backup gerado por exportarDados: apaga tudo que existe hoje
// no banco e regrava, tabela por tabela, com o conteúdo do arquivo. Não dá
// pra desfeito — a tela de Ajustes exige confirmação do usuário antes de
// chamar esta função.
export async function importarDados(dados: unknown): Promise<void> {
  if (!pareceDadosExportados(dados)) {
    throw new Error('Arquivo inválido: não parece ser um backup deste app.');
  }
  await apagarTodosOsDados();
  const db = await getDb();
  const tx = db.transaction(NOMES_DAS_TABELAS, 'readwrite');
  await Promise.all(
    NOMES_DAS_TABELAS.map((nome) =>
      Promise.all(dados[nome].map((registro) => tx.objectStore(nome).put(registro)))
    )
  );
  await tx.done;
}

// ---------- Utilitário de manutenção ----------

// Apaga TODOS os registros de TODAS as tabelas, deixando o banco vazio
// (como se o app tivesse acabado de ser instalado). Usado pela tela de
// Demonstração (src/pages/Demo.tsx) para resetar antes de gerar dados de
// exemplo, ou para o usuário recomeçar do zero. Não tem como desfazer.
export async function apagarTodosOsDados(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(NOMES_DAS_TABELAS, 'readwrite');
  await Promise.all(NOMES_DAS_TABELAS.map((nome) => tx.objectStore(nome).clear()));
  await tx.done;
}

// ---------- Transações ----------

// Lista lançamentos com filtros opcionais por mês (formato 'yyyy-MM'),
// categoria e tipo. Mais recentes primeiro.
export async function listarTransacoes(filtro?: {
  mes?: string;
  categoriaId?: string;
  tipo?: TipoTransacao;
}): Promise<Transacao[]> {
  const db = await getDb();
  let all: Transacao[];
  if (filtro?.mes) {
    // IDBKeyRange.bound busca direto no índice 'data' só o intervalo do
    // mês pedido, em vez de carregar todas as transações e filtrar depois.
    const range = IDBKeyRange.bound(`${filtro.mes}-01`, `${filtro.mes}-31`);
    all = await db.getAllFromIndex('transacoes', 'data', range);
  } else {
    all = await db.getAll('transacoes');
  }
  if (filtro?.categoriaId) all = all.filter((t) => t.categoriaId === filtro.categoriaId);
  if (filtro?.tipo) all = all.filter((t) => t.tipo === filtro.tipo);
  return all.sort((a, b) => b.data.localeCompare(a.data));
}

export async function buscarTransacao(id: string): Promise<Transacao | undefined> {
  const db = await getDb();
  return db.get('transacoes', id);
}

export async function salvarTransacao(
  data: Omit<Transacao, 'id' | 'criadoEm'> & { id?: string }
): Promise<Transacao> {
  const db = await getDb();
  const transacao: Transacao = {
    id: data.id ?? generateId(),
    tipo: data.tipo,
    valor: data.valor,
    categoriaId: data.categoriaId,
    data: data.data,
    descricao: data.descricao,
    contaFixaId: data.contaFixaId,
    parcelaId: data.parcelaId,
    criadoEm: new Date().toISOString(),
  };
  await db.put('transacoes', transacao);
  return transacao;
}

export async function excluirTransacao(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('transacoes', id);
}

// Calcula o resumo financeiro de um mês: quanto entrou (renda base fixa +
// receitas extras avulsas), quanto saiu, e o saldo. Usado no Dashboard e
// no gráfico de Relatórios.
export async function resumoMes(mesReferencia: string): Promise<{
  rendaBase: number;
  receitasExtras: number;
  receitas: number;
  despesas: number;
  saldo: number;
}> {
  const [renda, transacoes] = await Promise.all([
    buscarRendaMensal(mesReferencia),
    listarTransacoes({ mes: mesReferencia }),
  ]);
  const rendaBase = renda?.valor ?? 0;
  const receitasExtras = transacoes.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
  const despesas = transacoes.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);
  const receitas = rendaBase + receitasExtras;
  return { rendaBase, receitasExtras, receitas, despesas, saldo: receitas - despesas };
}

// ---------- Renda mensal ----------

export async function buscarRendaMensal(mesReferencia: string): Promise<RendaMensal | undefined> {
  const db = await getDb();
  const todas = await db.getAllFromIndex('rendasMensais', 'mesReferencia', mesReferencia);
  return todas[0];
}

// "Upsert": se já existe uma renda cadastrada para esse mês, atualiza o
// valor; senão, cria um registro novo. Por isso o Dashboard pode chamar
// essa função tanto para "Definir renda" quanto para "Editar".
export async function salvarRendaMensal(mesReferencia: string, valor: number): Promise<RendaMensal> {
  const db = await getDb();
  const existente = await buscarRendaMensal(mesReferencia);
  const renda: RendaMensal = {
    id: existente?.id ?? generateId(),
    mesReferencia,
    valor,
    criadoEm: existente?.criadoEm ?? new Date().toISOString(),
  };
  await db.put('rendasMensais', renda);
  return renda;
}

// ---------- Contas fixas ----------

export async function listarContasFixas(): Promise<ContaFixa[]> {
  const db = await getDb();
  const all = await db.getAll('contasFixas');
  return all.sort((a, b) => a.diaVencimento - b.diaVencimento);
}

export async function buscarContaFixa(id: string): Promise<ContaFixa | undefined> {
  const db = await getDb();
  return db.get('contasFixas', id);
}

export async function salvarContaFixa(
  data: Omit<ContaFixa, 'id' | 'criadoEm'> & { id?: string }
): Promise<ContaFixa> {
  const db = await getDb();
  const conta: ContaFixa = {
    id: data.id ?? generateId(),
    descricao: data.descricao,
    categoriaId: data.categoriaId,
    valor: data.valor,
    diaVencimento: data.diaVencimento,
    ativa: data.ativa,
    criadoEm: new Date().toISOString(),
  };
  await db.put('contasFixas', conta);
  return conta;
}

// Ao excluir uma conta fixa, também apaga (em cascata, via cursor no
// índice 'contaFixaId') todo o histórico de pagamentos dela — senão
// ficariam registros "órfãos" apontando para uma conta que não existe mais.
export async function excluirContaFixa(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('contasFixas', id);
  const tx = db.transaction('pagamentosContaFixa', 'readwrite');
  const idx = tx.store.index('contaFixaId');
  let cursor = await idx.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// Verifica se uma conta fixa específica já foi paga em um mês específico.
export async function buscarPagamentoDoMes(
  contaFixaId: string,
  mesReferencia: string
): Promise<PagamentoContaFixa | undefined> {
  const db = await getDb();
  const pagamentos = await db.getAllFromIndex('pagamentosContaFixa', 'contaFixaId', contaFixaId);
  return pagamentos.find((p) => p.mesReferencia === mesReferencia);
}

// Registra o pagamento de uma conta fixa: cria a Transacao (despesa)
// correspondente e o registro de PagamentoContaFixa que marca aquele mês
// como quitado.
export async function pagarContaFixa(
  contaFixaId: string,
  data?: string
): Promise<{ pagamento: PagamentoContaFixa; transacao: Transacao }> {
  const conta = await buscarContaFixa(contaFixaId);
  if (!conta) throw new Error('Conta fixa não encontrada');
  const dataPagamento = data ?? hojeISO();
  const mesReferencia = dataPagamento.slice(0, 7);
  const transacao = await salvarTransacao({
    tipo: 'despesa',
    valor: conta.valor,
    categoriaId: conta.categoriaId,
    data: dataPagamento,
    descricao: conta.descricao,
    contaFixaId: conta.id,
  });
  const db = await getDb();
  const pagamento: PagamentoContaFixa = {
    id: generateId(),
    contaFixaId,
    mesReferencia,
    dataPagamento,
    transacaoId: transacao.id,
  };
  await db.put('pagamentosContaFixa', pagamento);
  return { pagamento, transacao };
}

// Calcula, para o mês atual, quando a conta fixa vence e qual o nível de
// urgência (ok/atenção/atrasada). Se `diaVencimento` for maior que o
// último dia do mês atual (ex: dia 31 em fevereiro), usa o último dia
// válido daquele mês.
export function calcularStatusContaFixa(
  conta: ContaFixa,
  pagamentoDoMes: PagamentoContaFixa | undefined
): { vencimentoEsteMes: string; diasRestantes: number; nivel: Nivel; paga: boolean } {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const ultimoDiaDoMes = new Date(ano, mes + 1, 0).getDate();
  const dia = Math.min(conta.diaVencimento, ultimoDiaDoMes);
  const vencimentoEsteMes = format(new Date(ano, mes, dia), 'yyyy-MM-dd');
  const diasRestantes = diasParaVencer(vencimentoEsteMes);
  const paga = Boolean(pagamentoDoMes);

  let nivel: Nivel = 'ok';
  if (!paga) {
    if (diasRestantes < 0) nivel = 'atrasada';
    else if (diasRestantes <= 7) nivel = 'atencao';
  }
  return { vencimentoEsteMes, diasRestantes, nivel, paga };
}

// ---------- Parcelamentos / parcelas ----------

export async function listarParcelamentos(): Promise<Parcelamento[]> {
  const db = await getDb();
  const all = await db.getAll('parcelamentos');
  return all.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export async function buscarParcelamento(id: string): Promise<Parcelamento | undefined> {
  const db = await getDb();
  return db.get('parcelamentos', id);
}

// Cria o Parcelamento e já gera todas as N Parcelas de uma vez (uma por
// mês, a partir da data da primeira parcela), dividindo o valor total em
// partes iguais. Fazer isso de uma vez só (em vez de calcular "a próxima
// parcela" sob demanda) permite pagar fora de ordem e ver o cronograma
// completo em ParcelamentoDetalhe.tsx.
export async function criarParcelamento(
  data: Omit<Parcelamento, 'id' | 'criadoEm'>
): Promise<Parcelamento> {
  const db = await getDb();
  const parcelamento: Parcelamento = {
    id: generateId(),
    descricao: data.descricao,
    categoriaId: data.categoriaId,
    valorTotal: data.valorTotal,
    numeroParcelas: data.numeroParcelas,
    dataPrimeiraParcela: data.dataPrimeiraParcela,
    criadoEm: new Date().toISOString(),
  };
  await db.put('parcelamentos', parcelamento);

  const valorParcela = Math.round((data.valorTotal / data.numeroParcelas) * 100) / 100;
  const dataBase = parseISO(data.dataPrimeiraParcela);
  for (let numero = 1; numero <= data.numeroParcelas; numero++) {
    const vencimento = format(addMonths(dataBase, numero - 1), 'yyyy-MM-dd');
    const parcela: Parcela = {
      id: generateId(),
      parcelamentoId: parcelamento.id,
      numero,
      valor: valorParcela,
      vencimento,
      paga: false,
    };
    await db.put('parcelas', parcela);
  }
  return parcelamento;
}

// Só permite editar descrição e categoria depois de criado — valor total,
// número de parcelas e datas de vencimento ficam travados, porque mudá-los
// exigiria recalcular/apagar parcelas já pagas.
export async function atualizarDescricaoParcelamento(
  id: string,
  descricao: string,
  categoriaId: string
): Promise<void> {
  const db = await getDb();
  const parcelamento = await db.get('parcelamentos', id);
  if (!parcelamento) return;
  parcelamento.descricao = descricao;
  parcelamento.categoriaId = categoriaId;
  await db.put('parcelamentos', parcelamento);
}

// Exclui o parcelamento e, em cascata, todas as suas parcelas.
export async function excluirParcelamento(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('parcelamentos', id);
  const tx = db.transaction('parcelas', 'readwrite');
  const idx = tx.store.index('parcelamentoId');
  let cursor = await idx.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// Lista as parcelas de um parcelamento específico (ou de todos, se não
// informado), em ordem de número (1ª, 2ª, 3ª...).
export async function listarParcelas(parcelamentoId?: string): Promise<Parcela[]> {
  const db = await getDb();
  const all = parcelamentoId
    ? await db.getAllFromIndex('parcelas', 'parcelamentoId', parcelamentoId)
    : await db.getAll('parcelas');
  return all.sort((a, b) => a.numero - b.numero);
}

// Todas as parcelas ainda não pagas, de qualquer parcelamento, ordenadas
// pela data de vencimento mais próxima. Usado no Dashboard para saber o
// que está por vencer.
export async function listarParcelasPendentes(): Promise<Parcela[]> {
  const db = await getDb();
  const all = await db.getAll('parcelas');
  return all.filter((p) => !p.paga).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

// Registra o pagamento de uma parcela específica: cria a Transacao
// (despesa) correspondente e marca a parcela como paga.
export async function pagarParcela(
  parcelaId: string,
  data?: string
): Promise<{ parcela: Parcela; transacao: Transacao }> {
  const db = await getDb();
  const parcela = await db.get('parcelas', parcelaId);
  if (!parcela) throw new Error('Parcela não encontrada');
  const parcelamento = await buscarParcelamento(parcela.parcelamentoId);
  if (!parcelamento) throw new Error('Parcelamento não encontrado');
  const dataPagamento = data ?? hojeISO();
  const transacao = await salvarTransacao({
    tipo: 'despesa',
    valor: parcela.valor,
    categoriaId: parcelamento.categoriaId,
    data: dataPagamento,
    descricao: `${parcelamento.descricao} (${parcela.numero}/${parcelamento.numeroParcelas})`,
    parcelaId: parcela.id,
  });
  parcela.paga = true;
  parcela.dataPagamento = dataPagamento;
  parcela.transacaoId = transacao.id;
  await db.put('parcelas', parcela);
  return { parcela, transacao };
}

// Mesmo cálculo de urgência da conta fixa, mas para uma parcela: usa a
// data de vencimento dela diretamente (sem precisar calcular "este mês").
export function statusParcela(parcela: Parcela): { diasRestantes: number; nivel: Nivel } {
  const diasRestantes = diasParaVencer(parcela.vencimento);
  let nivel: Nivel = 'ok';
  if (!parcela.paga) {
    if (diasRestantes < 0) nivel = 'atrasada';
    else if (diasRestantes <= 7) nivel = 'atencao';
  }
  return { diasRestantes, nivel };
}

// ---------- Orçamentos ----------

export async function listarOrcamentos(): Promise<Orcamento[]> {
  const db = await getDb();
  return db.getAll('orcamentos');
}

// Procura o orçamento de uma categoria (ou o orçamento geral, se
// `categoriaId` for null). Como só pode existir um orçamento por
// categoria, isso também serve para saber se salvarOrcamento deve criar
// um novo ou atualizar o existente.
export async function buscarOrcamentoPorCategoria(
  categoriaId: string | null
): Promise<Orcamento | undefined> {
  const db = await getDb();
  const all = await db.getAll('orcamentos');
  return all.find((o) => o.categoriaId === categoriaId);
}

// "Upsert" de orçamento: se `data.id` for passado, atualiza aquele
// registro; senão, procura por categoria e atualiza se já existir, ou cria
// um novo.
export async function salvarOrcamento(data: {
  id?: string;
  categoriaId: string | null;
  limite: number;
}): Promise<Orcamento> {
  const db = await getDb();
  const existente = data.id ? await db.get('orcamentos', data.id) : await buscarOrcamentoPorCategoria(data.categoriaId);
  const orcamento: Orcamento = {
    id: existente?.id ?? generateId(),
    categoriaId: data.categoriaId,
    limite: data.limite,
    criadoEm: existente?.criadoEm ?? new Date().toISOString(),
  };
  await db.put('orcamentos', orcamento);
  return orcamento;
}

export async function excluirOrcamento(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('orcamentos', id);
}

// Soma quanto já foi gasto em despesas num mês, opcionalmente filtrando
// por categoria (se `categoriaId` for omitido/null, soma TODAS as
// despesas — usado no orçamento geral).
export async function resumoGastoPorCategoriaNoMes(
  mesReferencia: string,
  categoriaId?: string | null
): Promise<number> {
  const transacoes = await listarTransacoes({ mes: mesReferencia, tipo: 'despesa' });
  const filtradas = categoriaId ? transacoes.filter((t) => t.categoriaId === categoriaId) : transacoes;
  return filtradas.reduce((s, t) => s + t.valor, 0);
}

// 'ok' = ainda dá folga, 'atencao' = perto do limite (>=80%), 'estourado'
// = já passou do limite.
export type NivelOrcamento = 'ok' | 'atencao' | 'estourado';

// Compara o gasto atual com o limite do orçamento e devolve os números já
// prontos para a barra de progresso e o texto do badge (ver Metas.tsx e
// Dashboard.tsx).
export function calcularStatusOrcamento(
  orcamento: Orcamento,
  gastoAtual: number
): { limite: number; gasto: number; percentual: number; restante: number; nivel: NivelOrcamento } {
  const percentual = orcamento.limite > 0 ? gastoAtual / orcamento.limite : 0;
  let nivel: NivelOrcamento = 'ok';
  if (percentual > 1) nivel = 'estourado';
  else if (percentual >= 0.8) nivel = 'atencao';
  return {
    limite: orcamento.limite,
    gasto: gastoAtual,
    percentual,
    restante: orcamento.limite - gastoAtual,
    nivel,
  };
}

// ---------- Cartões de crédito ----------

export async function listarCartoes(): Promise<CartaoCredito[]> {
  const db = await getDb();
  const all = await db.getAll('cartoes');
  return all.sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function buscarCartao(id: string): Promise<CartaoCredito | undefined> {
  const db = await getDb();
  return db.get('cartoes', id);
}

export async function salvarCartao(
  data: Omit<CartaoCredito, 'id' | 'criadoEm'> & { id?: string }
): Promise<CartaoCredito> {
  const db = await getDb();
  const existente = data.id ? await db.get('cartoes', data.id) : undefined;
  const cartao: CartaoCredito = {
    id: data.id ?? generateId(),
    nome: data.nome,
    limite: data.limite,
    diaFechamento: data.diaFechamento,
    diaVencimento: data.diaVencimento,
    ativo: data.ativo,
    criadoEm: existente?.criadoEm ?? new Date().toISOString(),
  };
  await db.put('cartoes', cartao);
  return cartao;
}

// Ao excluir um cartão, apaga em cascata todas as compras, parcelas e
// pagamentos de fatura associados a ele (as Transacao já geradas por
// faturas pagas continuam existindo, como histórico — mesmo padrão de
// excluirContaFixa/excluirParcelamento).
export async function excluirCartao(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('cartoes', id);

  const tx1 = db.transaction('comprasCartao', 'readwrite');
  let cursor1 = await tx1.store.index('cartaoId').openCursor(id);
  while (cursor1) {
    await cursor1.delete();
    cursor1 = await cursor1.continue();
  }
  await tx1.done;

  const tx2 = db.transaction('parcelasCartao', 'readwrite');
  let cursor2 = await tx2.store.index('cartaoId').openCursor(id);
  while (cursor2) {
    await cursor2.delete();
    cursor2 = await cursor2.continue();
  }
  await tx2.done;

  const tx3 = db.transaction('pagamentosFatura', 'readwrite');
  let cursor3 = await tx3.store.index('cartaoId').openCursor(id);
  while (cursor3) {
    await cursor3.delete();
    cursor3 = await cursor3.continue();
  }
  await tx3.done;
}

// ---------- Compras no cartão / parcelas do cartão ----------

export async function listarComprasCartao(cartaoId?: string): Promise<CompraCartao[]> {
  const db = await getDb();
  const all = cartaoId
    ? await db.getAllFromIndex('comprasCartao', 'cartaoId', cartaoId)
    : await db.getAll('comprasCartao');
  return all.sort((a, b) => b.dataCompra.localeCompare(a.dataCompra));
}

export async function buscarCompraCartao(id: string): Promise<CompraCartao | undefined> {
  const db = await getDb();
  return db.get('comprasCartao', id);
}

// Acha em qual mês de fatura (yyyy-MM) cai a 1ª parcela de uma compra: se
// o dia da compra é até o dia de fechamento, ela entra na fatura que fecha
// nesse mesmo mês; se é depois, só entra na fatura do mês seguinte.
function mesFaturaInicial(dataCompraIso: string, diaFechamento: number): string {
  const data = parseISO(dataCompraIso);
  const base = data.getDate() <= diaFechamento ? data : addMonths(data, 1);
  return format(base, 'yyyy-MM');
}

// Cria a compra e já gera todas as N parcelas de uma vez, cada uma já
// associada ao mês de fatura em que vai cair (1ª parcela no mês calculado
// por mesFaturaInicial, as seguintes um mês depois da anterior).
export async function criarCompraCartao(
  data: Omit<CompraCartao, 'id' | 'criadoEm'>
): Promise<CompraCartao> {
  const cartao = await buscarCartao(data.cartaoId);
  if (!cartao) throw new Error('Cartão não encontrado');

  const db = await getDb();
  const compra: CompraCartao = {
    id: generateId(),
    cartaoId: data.cartaoId,
    descricao: data.descricao,
    categoriaId: data.categoriaId,
    valorTotal: data.valorTotal,
    numeroParcelas: data.numeroParcelas,
    dataCompra: data.dataCompra,
    criadoEm: new Date().toISOString(),
  };
  await db.put('comprasCartao', compra);

  const valorParcela = Math.round((data.valorTotal / data.numeroParcelas) * 100) / 100;
  const mesBase = mesFaturaInicial(data.dataCompra, cartao.diaFechamento);
  for (let numero = 1; numero <= data.numeroParcelas; numero++) {
    const mesFatura = format(addMonths(parseISO(`${mesBase}-01`), numero - 1), 'yyyy-MM');
    const parcela: ParcelaCartao = {
      id: generateId(),
      compraId: compra.id,
      cartaoId: data.cartaoId,
      numero,
      valor: valorParcela,
      mesFatura,
      paga: false,
    };
    await db.put('parcelasCartao', parcela);
  }
  return compra;
}

// Só permite editar descrição e categoria depois de criada — mesma regra
// do atualizarDescricaoParcelamento, pelo mesmo motivo (mudar valor/
// parcelas exigiria recalcular parcelas que já podem estar pagas).
export async function atualizarDescricaoCompraCartao(
  id: string,
  descricao: string,
  categoriaId: string
): Promise<void> {
  const db = await getDb();
  const compra = await db.get('comprasCartao', id);
  if (!compra) return;
  compra.descricao = descricao;
  compra.categoriaId = categoriaId;
  await db.put('comprasCartao', compra);
}

// Exclui a compra e, em cascata, todas as suas parcelas.
export async function excluirCompraCartao(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('comprasCartao', id);
  const tx = db.transaction('parcelasCartao', 'readwrite');
  let cursor = await tx.store.index('compraId').openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// Lista parcelas de cartão com filtros opcionais por cartão e/ou mês de
// fatura, ordenadas por mês e depois por número da parcela.
export async function listarParcelasCartao(filtro?: {
  cartaoId?: string;
  mesFatura?: string;
}): Promise<ParcelaCartao[]> {
  const db = await getDb();
  let all = filtro?.cartaoId
    ? await db.getAllFromIndex('parcelasCartao', 'cartaoId', filtro.cartaoId)
    : await db.getAll('parcelasCartao');
  if (filtro?.mesFatura) all = all.filter((p) => p.mesFatura === filtro.mesFatura);
  return all.sort((a, b) => a.mesFatura.localeCompare(b.mesFatura) || a.numero - b.numero);
}

// ---------- Faturas ----------

export async function buscarPagamentoFatura(
  cartaoId: string,
  mesReferencia: string
): Promise<PagamentoFatura | undefined> {
  const db = await getDb();
  const todos = await db.getAllFromIndex('pagamentosFatura', 'cartaoId', cartaoId);
  return todos.find((p) => p.mesReferencia === mesReferencia);
}

// Data de vencimento da fatura que fecha no `mesReferencia`: se o dia de
// vencimento do cartão vem depois do dia de fechamento, o pagamento cai
// ainda dentro do mesmo mês; senão (caso comum: fecha dia 28, vence dia 5),
// cai no mês seguinte.
function vencimentoFatura(mesReferencia: string, cartao: CartaoCredito): string {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  const mesBase = new Date(ano, mes - 1, 1);
  const mesVencimento =
    cartao.diaVencimento > cartao.diaFechamento ? mesBase : addMonths(mesBase, 1);
  const ultimoDia = new Date(mesVencimento.getFullYear(), mesVencimento.getMonth() + 1, 0).getDate();
  const dia = Math.min(cartao.diaVencimento, ultimoDia);
  return format(new Date(mesVencimento.getFullYear(), mesVencimento.getMonth(), dia), 'yyyy-MM-dd');
}

// Resumo completo da fatura de um cartão num mês de referência: total,
// se já foi paga, data de vencimento e nível de urgência (mesmo padrão de
// calcularStatusContaFixa/statusParcela).
export async function statusFatura(
  cartaoId: string,
  mesReferencia: string
): Promise<{
  mesReferencia: string;
  parcelas: ParcelaCartao[];
  total: number;
  paga: boolean;
  vencimento: string;
  diasRestantes: number;
  nivel: Nivel;
}> {
  const cartao = await buscarCartao(cartaoId);
  if (!cartao) throw new Error('Cartão não encontrado');
  const [parcelas, pagamento] = await Promise.all([
    listarParcelasCartao({ cartaoId, mesFatura: mesReferencia }),
    buscarPagamentoFatura(cartaoId, mesReferencia),
  ]);
  const total = parcelas.reduce((s, p) => s + p.valor, 0);
  const paga = Boolean(pagamento);
  const vencimento = vencimentoFatura(mesReferencia, cartao);
  const diasRestantes = diasParaVencer(vencimento);

  let nivel: Nivel = 'ok';
  if (!paga && total > 0) {
    if (diasRestantes < 0) nivel = 'atrasada';
    else if (diasRestantes <= 7) nivel = 'atencao';
  }
  return { mesReferencia, parcelas, total, paga, vencimento, diasRestantes, nivel };
}

// Mês da fatura em aberto mais próxima de vencer (a primeira, em ordem
// cronológica, que ainda tem parcela não paga). Usado como mês padrão ao
// abrir a tela de um cartão. Se não houver nada pendente, cai no mês atual.
export async function proximaFaturaAberta(cartaoId: string): Promise<string> {
  const parcelas = await listarParcelasCartao({ cartaoId });
  const pendentes = parcelas.filter((p) => !p.paga);
  if (pendentes.length === 0) return mesAtual();
  return pendentes.map((p) => p.mesFatura).sort()[0];
}

// Paga a fatura de um cartão num mês: para cada parcela daquele mês ainda
// não paga, gera uma Transacao (despesa) preservando a categoria da compra
// original — mesmo princípio de pagarParcela, só que em lote — e marca o
// mês como quitado.
export async function pagarFatura(
  cartaoId: string,
  mesReferencia: string,
  data?: string
): Promise<PagamentoFatura> {
  const db = await getDb();
  const dataPagamento = data ?? hojeISO();
  const parcelas = await listarParcelasCartao({ cartaoId, mesFatura: mesReferencia });
  const pendentes = parcelas.filter((p) => !p.paga);

  for (const parcela of pendentes) {
    const compra = await buscarCompraCartao(parcela.compraId);
    if (!compra) continue;
    const transacao = await salvarTransacao({
      tipo: 'despesa',
      valor: parcela.valor,
      categoriaId: compra.categoriaId,
      data: dataPagamento,
      descricao: `${compra.descricao} (${parcela.numero}/${compra.numeroParcelas})`,
      parcelaCartaoId: parcela.id,
    });
    parcela.paga = true;
    parcela.transacaoId = transacao.id;
    await db.put('parcelasCartao', parcela);
  }

  const total = parcelas.reduce((s, p) => s + p.valor, 0);
  const pagamento: PagamentoFatura = {
    id: generateId(),
    cartaoId,
    mesReferencia,
    dataPagamento,
    valor: total,
  };
  await db.put('pagamentosFatura', pagamento);
  return pagamento;
}

// Quanto do limite do cartão está comprometido: soma de todas as parcelas
// (de qualquer fatura, passada ou futura) ainda não pagas. É esse valor
// que reduz o limite disponível, já que ele só volta a ficar livre quando
// a fatura correspondente é efetivamente paga.
export async function limiteDisponivel(
  cartaoId: string
): Promise<{ limite: number; usado: number; disponivel: number }> {
  const cartao = await buscarCartao(cartaoId);
  if (!cartao) throw new Error('Cartão não encontrado');
  const parcelas = await listarParcelasCartao({ cartaoId });
  const usado = parcelas.filter((p) => !p.paga).reduce((s, p) => s + p.valor, 0);
  return { limite: cartao.limite, usado, disponivel: cartao.limite - usado };
}
