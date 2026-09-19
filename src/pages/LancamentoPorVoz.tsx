// Tela de destino do atalho "Lançamento por voz" (ver manifest.shortcuts em
// vite.config.ts): ao abrir, já começa a ouvir o microfone sozinha, sem
// nenhum toque extra. Interpreta a fala (src/voz.ts), salva o lançamento
// (gasto ou receita) direto no banco e mostra uma confirmação — pensada pra
// ser usada num ícone separado na tela inicial do celular, não pela
// navegação normal do app (por isso não tem o menu inferior, ver App.tsx).

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buscarOuCriarCategoria,
  excluirTransacao,
  listarCategorias,
  salvarTransacao,
  type TipoTransacao,
} from '../db';
import { interpretarLancamentoPorVoz, sugerirCategoria } from '../voz';
import { formatMoeda, hojeISO } from '../utils';

type Estado = 'ouvindo' | 'processando' | 'confirmado' | 'erro';

interface Confirmacao {
  transacaoId: string;
  tipo: TipoTransacao;
  valor: number;
  descricao: string;
  categoriaNome: string;
}

const RECOGNITION_SUPORTADO =
  typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

export default function LancamentoPorVoz() {
  const [estado, setEstado] = useState<Estado>('ouvindo');
  const [transcricao, setTranscricao] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Interpreta o que foi ouvido e, se achou um valor, já resolve a
  // categoria (reaproveitando ou criando, ver buscarOuCriarCategoria em
  // db.ts) e salva a transação — mesmo padrão usado no LancamentoForm e no
  // "gasto rápido" do Dashboard.
  const processarFala = useCallback(async (fala: string) => {
    setTranscricao(fala);
    const interpretado = interpretarLancamentoPorVoz(fala);
    if (interpretado.valor === null || interpretado.valor <= 0) {
      setMensagemErro(`Não entendi o valor em "${fala}". Tente algo como "gastei 30 reais com almoço" ou "recebi 500 reais de salário".`);
      setEstado('erro');
      return;
    }
    setEstado('processando');
    try {
      const categoriasExistentes = await listarCategorias(interpretado.tipo);
      const nomeCategoria = sugerirCategoria(interpretado.tipo, interpretado.descricao, categoriasExistentes);
      const categoria = await buscarOuCriarCategoria(nomeCategoria, interpretado.tipo);
      const transacao = await salvarTransacao({
        tipo: interpretado.tipo,
        valor: interpretado.valor,
        categoriaId: categoria.id,
        data: hojeISO(),
        descricao: interpretado.descricao,
      });
      setConfirmacao({
        transacaoId: transacao.id,
        tipo: interpretado.tipo,
        valor: interpretado.valor,
        descricao: interpretado.descricao,
        categoriaNome: categoria.nome,
      });
      setEstado('confirmado');
    } catch {
      setMensagemErro('Entendi o que você falou, mas não consegui salvar. Tente de novo.');
      setEstado('erro');
    }
  }, []);

  // Cria uma instância nova de reconhecimento a cada chamada — instâncias
  // do SpeechRecognition não são reaproveitáveis com segurança depois que
  // terminam (onend), então "tentar de novo" ou "falar outro" sempre
  // recria do zero.
  const iniciarEscuta = useCallback(() => {
    if (!RECOGNITION_SUPORTADO) return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    // Alguns navegadores terminam o reconhecimento (onend) sem nunca
    // chamar onresult nem onerror — por exemplo quando não detectam fala
    // com clareza suficiente. Essa flag existe só para o onend saber se
    // precisa mostrar um erro ele mesmo (nenhum dos outros dois cuidou).
    let resolvido = false;

    const recognition = new Ctor();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (ev) => {
      resolvido = true;
      const fala = ev.results[0]?.[0]?.transcript ?? '';
      void processarFala(fala);
    };
    recognition.onerror = (ev) => {
      // "aborted" acontece quando a gente mesmo interrompe um
      // reconhecimento antigo (ex: o React remontando o componente em modo
      // de desenvolvimento, ou o usuário clicando em "Tentar de novo"/
      // "Falar outro" enquanto o anterior ainda não tinha terminado) — não
      // é uma falha real, então ignora em vez de mostrar erro.
      if (ev.error === 'aborted') {
        resolvido = true;
        return;
      }
      resolvido = true;
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        setMensagemErro('Permissão de microfone negada. Habilite o microfone nas configurações do app/site e tente de novo.');
      } else if (ev.error === 'no-speech') {
        setMensagemErro('Não ouvi nada. Toque em "Tentar de novo" e diga o valor e o motivo do lançamento.');
      } else if (ev.error === 'network') {
        setMensagemErro('Falha de rede no reconhecimento de voz (ele depende de internet). Verifique a conexão e tente de novo.');
      } else {
        setMensagemErro(`Não consegui usar o microfone agora (erro: ${ev.error}). Tente de novo.`);
      }
      setEstado('erro');
    };
    recognition.onend = () => {
      if (resolvido) return;
      setMensagemErro('Não entendi nada. Toque em "Tentar de novo" e fale mais alto, perto do microfone.');
      setEstado('erro');
    };

    recognitionRef.current = recognition;
    setMensagemErro('');
    setConfirmacao(null);
    setEstado('ouvindo');
    try {
      recognition.start();
    } catch {
      setMensagemErro('Não consegui iniciar o microfone. Tente de novo.');
      setEstado('erro');
    }
  }, [processarFala]);

  // Começa a ouvir sozinho assim que a tela abre — é o comportamento que
  // torna o atalho "1 toque + fala" (sem precisar apertar outro botão).
  useEffect(() => {
    iniciarEscuta();
    return () => recognitionRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDesfazer() {
    if (!confirmacao) return;
    await excluirTransacao(confirmacao.transacaoId);
    iniciarEscuta();
  }

  if (!RECOGNITION_SUPORTADO) {
    return (
      <div className="voz-tela">
        <div className="card-row">
          <h2>Lançamento por voz</h2>
          <Link to="/" className="btn btn-secondary btn-small" style={{ width: 'auto' }}>
            ✕ Sair
          </Link>
        </div>
        <div className="empty">
          Este navegador não suporta reconhecimento de voz. Use o Chrome no Android, ou registre manualmente.
        </div>
        <Link to="/lancamentos/novo" className="btn">
          Abrir formulário manual
        </Link>
      </div>
    );
  }

  return (
    <div className="voz-tela">
      <div className="card-row">
        <h2>Lançamento por voz</h2>
        <Link to="/" className="btn btn-secondary btn-small" style={{ width: 'auto' }}>
          ✕ Sair
        </Link>
      </div>

      {estado === 'ouvindo' && (
        <div className="card voz-card">
          <div className="voz-mic">🎤</div>
          <p>Ouvindo... diga algo como "gastei 30 reais com almoço" ou "recebi 500 reais de salário"</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
            Depois de falar, pode levar alguns segundos pra processar — isso é normal.
          </p>
        </div>
      )}

      {estado === 'processando' && (
        <div className="card voz-card">
          <p>Salvando "{transcricao}"...</p>
        </div>
      )}

      {estado === 'confirmado' && confirmacao && (
        <div className="card voz-card">
          <div className="voz-check">✅</div>
          <p>
            <strong style={{ color: confirmacao.tipo === 'receita' ? 'var(--ok)' : 'var(--danger)' }}>
              {confirmacao.tipo === 'receita' ? '+' : '-'} {formatMoeda(confirmacao.valor)}
            </strong>
            <br />
            {confirmacao.descricao} · {confirmacao.categoriaNome}
          </p>
          <button type="button" className="btn" onClick={iniciarEscuta} style={{ marginTop: 12 }}>
            🎤 Falar outro
          </button>
          <Link
            to={`/lancamentos/${confirmacao.transacaoId}/editar`}
            className="btn btn-secondary"
            style={{ marginTop: 8 }}
          >
            ✏️ Editar
          </Link>
          <button type="button" className="btn btn-danger" onClick={handleDesfazer} style={{ marginTop: 8 }}>
            ↩️ Desfazer
          </button>
        </div>
      )}

      {estado === 'erro' && (
        <div className="card voz-card">
          <p>{mensagemErro}</p>
          <button type="button" className="btn" onClick={iniciarEscuta} style={{ marginTop: 8 }}>
            Tentar de novo
          </button>
          <Link to="/lancamentos/novo" className="btn btn-secondary" style={{ marginTop: 8 }}>
            Abrir formulário manual
          </Link>
        </div>
      )}
    </div>
  );
}
