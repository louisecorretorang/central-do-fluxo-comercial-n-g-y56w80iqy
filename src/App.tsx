/* Main App Component - Handles routing (using react-router-dom), auth provider and other providers */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import { OpportunityModalProvider } from '@/hooks/use-opportunity-modal'

import Index from './pages/Index'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'

// Páginas reais da Central do Fluxo Comercial
import MinhaFila from './pages/MinhaFila'
import Oportunidades from './pages/Oportunidades'
import OportunidadeDetalhes from './pages/OportunidadeDetalhes'
import Quadro from './pages/Quadro'
import Clientes from './pages/Clientes'
import ClienteDetalhes from './pages/ClienteDetalhes'
import Painel from './pages/Painel'
import Usuarios from './pages/Usuarios'
import Catalogo from './pages/Catalogo'
import Fluxos from './pages/Fluxos'
import AuthCallback from './pages/AuthCallback'
import DefinirSenha from './pages/DefinirSenha'
import SemAcesso from './pages/SemAcesso'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <OpportunityModalProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Tela de Login pública */}
            <Route path="/" element={<Index />} />

            {/* Confirmação de e-mail / ativação / troca de senha */}
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/definir-senha" element={<DefinirSenha />} />

            {/* T2.04 — a tela de sem acesso precisa ser alcançável por qualquer usuário
                autenticado. Fica DENTRO do ProtectedRoute (exige login) e FORA do
                AdminRoute (senão entraria em laço: um colaborador nunca chegaria nela). */}
            <Route element={<ProtectedRoute />}>
              <Route path="/sem-acesso" element={<SemAcesso />} />
            </Route>

            {/* Rotas internas protegidas dentro do Layout institucional N&G */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/minha-fila" element={<MinhaFila />} />
                <Route path="/oportunidades" element={<Oportunidades />} />
                <Route path="/oportunidades/:id" element={<OportunidadeDetalhes />} />
                <Route path="/quadro" element={<Quadro />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/clientes/:id" element={<ClienteDetalhes />} />
                <Route path="/painel" element={<Painel />} />
                {/* Rotas restritas a Administrador */}
                <Route element={<AdminRoute />}>
                  <Route path="/usuarios" element={<Usuarios />} />
                  <Route path="/configuracoes/fluxos" element={<Fluxos />} />
                  <Route path="/configuracoes/catalogo" element={<Catalogo />} />
                  <Route
                    path="/configuracoes"
                    element={<Navigate to="/configuracoes/fluxos" replace />}
                  />
                </Route>
              </Route>
            </Route>

            {/* Redirecionamentos e 404 */}
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </OpportunityModalProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
