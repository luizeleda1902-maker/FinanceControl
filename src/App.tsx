// Componente raiz do app: define a "casca" visual (cabeçalho + conteúdo +
// menu inferior) e todas as rotas de navegação entre telas.

import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { seedCategoriasPadrao } from './db';
import { VisibilidadeProvider, useVisibilidade } from './privacidade';
import { IconHome, IconWallet, IconCalendar, IconTarget, IconChart, IconEye, IconEyeOff, IconSettings } from './components/Icons';
import SplashScreen from './components/SplashScreen';
import Dashboard from './pages/Dashboard';
import Lancamentos from './pages/Lancamentos';
import LancamentoForm from './pages/LancamentoForm';
import Contas from './pages/Contas';
import ContaFixaForm from './pages/ContaFixaForm';
import ParcelamentoForm from './pages/ParcelamentoForm';
import ParcelamentoDetalhe from './pages/ParcelamentoDetalhe';
import CartaoForm from './pages/CartaoForm';
import CartaoDetalhe from './pages/CartaoDetalhe';
import CompraCartaoForm from './pages/CompraCartaoForm';
import Metas from './pages/Metas';
import OrcamentoForm from './pages/OrcamentoForm';
import Relatorios from './pages/Relatorios';
import Categorias from './pages/Categorias';
import CategoriaForm from './pages/CategoriaForm';
import Demo from './pages/Demo';
import LancamentoPorVoz from './pages/LancamentoPorVoz';
import Ajustes from './pages/Ajustes';
import './App.css';

// Tempo mínimo (ms) que a splash fica na tela, mesmo que o carregamento
// inicial seja instantâneo — sem isso, em aparelhos rápidos o logo pisca
// rápido demais pra dar tempo de ver.
const SPLASH_DURACAO_MINIMA_MS = 3000;

function App() {
  // splashPronta: true assim que o carregamento inicial termina (dispara a
  // animação de saída da splash). splashVisivel: continua true até a
  // animação de saída realmente terminar, pra splash e app conviverem
  // durante o fade em vez de a splash sumir de repente.
  const [splashPronta, setSplashPronta] = useState(false);
  const [splashVisivel, setSplashVisivel] = useState(true);

  // Roda uma única vez, quando o app abre: garante que exista pelo menos
  // as categorias padrão (rede de segurança — o banco já faz isso sozinho
  // ao ser criado, ver db.ts) e controla por quanto tempo a splash fica visível.
  useEffect(() => {
    const inicio = Date.now();
    seedCategoriasPadrao().finally(() => {
      const faltam = Math.max(0, SPLASH_DURACAO_MINIMA_MS - (Date.now() - inicio));
      setTimeout(() => setSplashPronta(true), faltam);
    });
  }, []);

  return (
    // VisibilidadeProvider precisa envolver o HashRouter (e não ficar
    // dentro de AppShell) para que o estado do modo privado não se perca
    // quando o usuário troca de página.
    <VisibilidadeProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
      {splashVisivel && <SplashScreen saindo={splashPronta} onSaiu={() => setSplashVisivel(false)} />}
    </VisibilidadeProvider>
  );
}

// Separado do App() porque precisa do hook useVisibilidade(), que só
// funciona dentro do VisibilidadeProvider declarado acima.
function AppShell() {
  const { visivel, alternar } = useVisibilidade();
  // A tela de "Lançamento por voz" é o destino direto do atalho de tela inicial
  // (ver manifest.shortcuts em vite.config.ts) — some o menu inferior nela
  // pra ficar mais parecida com um "acessório" separado do app completo.
  const location = useLocation();
  const escondeNav = location.pathname === '/voz';

  return (
    <div className="app">
      <header className="topbar topbar-row">
        <div className="topbar-brand">
          <img src="/icon-192.png" alt="" className="topbar-logo" />
          <span className="topbar-title">
            <span className="topbar-title-bold">Finance</span>
            <span className="topbar-title-light">Control</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Botão de olho: liga/desliga o modo privado (ver privacidade.tsx) */}
          <button
            type="button"
            className="btn-eye"
            onClick={alternar}
            title={visivel ? 'Ocultar valores' : 'Mostrar valores'}
            aria-label={visivel ? 'Ocultar valores' : 'Mostrar valores'}
          >
            {visivel ? <IconEye /> : <IconEyeOff />}
          </button>
          {/* Botão de engrenagem: leva para a tela de Ajustes (backup dos dados) */}
          <NavLink to="/ajustes" className="btn-eye" title="Ajustes" aria-label="Ajustes">
            <IconSettings />
          </NavLink>
        </div>
      </header>

      <main className="content">
        <div key={location.pathname} className="page-transition">
        <Routes>
          <Route path="/" element={<Dashboard />} />

          <Route path="/lancamentos" element={<Lancamentos />} />
          <Route path="/lancamentos/novo" element={<LancamentoForm />} />
          <Route path="/lancamentos/:id/editar" element={<LancamentoForm />} />

          <Route path="/contas" element={<Contas />} />
          <Route path="/contas/fixas/nova" element={<ContaFixaForm />} />
          <Route path="/contas/fixas/:id/editar" element={<ContaFixaForm />} />
          <Route path="/contas/parcelamentos/novo" element={<ParcelamentoForm />} />
          <Route path="/contas/parcelamentos/:id" element={<ParcelamentoDetalhe />} />
          <Route path="/contas/parcelamentos/:id/editar" element={<ParcelamentoForm />} />
          <Route path="/contas/cartoes/novo" element={<CartaoForm />} />
          <Route path="/contas/cartoes/compras/novo" element={<CompraCartaoForm />} />
          <Route path="/contas/cartoes/compras/:id/editar" element={<CompraCartaoForm />} />
          <Route path="/contas/cartoes/:id" element={<CartaoDetalhe />} />
          <Route path="/contas/cartoes/:id/editar" element={<CartaoForm />} />

          <Route path="/metas" element={<Metas />} />
          <Route path="/metas/novo" element={<OrcamentoForm />} />
          <Route path="/metas/:id/editar" element={<OrcamentoForm />} />

          <Route path="/relatorios" element={<Relatorios />} />

          {/* Categorias não tem aba própria no menu de baixo — é acessada
              por um link dentro da tela de Lançamentos. */}
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/categorias/nova" element={<CategoriaForm />} />
          <Route path="/categorias/:id/editar" element={<CategoriaForm />} />

          {/* Utilitário de demonstração, sem link no menu — acesse via /#/demo */}
          <Route path="/demo" element={<Demo />} />

          {/* Destino do atalho "Lançamento por voz" da tela inicial — sem
              link no menu, ver comentário de escondeNav acima. */}
          <Route path="/voz" element={<LancamentoPorVoz />} />

          {/* Backup dos dados — acessada pelo ícone de engrenagem no topo. */}
          <Route path="/ajustes" element={<Ajustes />} />
        </Routes>
        </div>
      </main>

      {/* Menu fixo na parte de baixo da tela. O react-router-dom marca
          automaticamente o link da página atual com a classe "active"
          (estilizada em App.css). */}
      {!escondeNav && (
        <nav className="bottomnav">
          <NavLink to="/" end className="navitem">
            <IconHome />
            <small>Início</small>
          </NavLink>
          <NavLink to="/lancamentos" className="navitem">
            <IconWallet />
            <small>Lançamentos</small>
          </NavLink>
          <NavLink to="/contas" className="navitem">
            <IconCalendar />
            <small>Contas</small>
          </NavLink>
          <NavLink to="/metas" className="navitem">
            <IconTarget />
            <small>Metas</small>
          </NavLink>
          <NavLink to="/relatorios" className="navitem">
            <IconChart />
            <small>Relatórios</small>
          </NavLink>
        </nav>
      )}
    </div>
  );
}

export default App;
