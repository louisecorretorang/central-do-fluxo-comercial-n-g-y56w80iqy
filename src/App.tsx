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

// Páginas reais da Central do Fluxo Comercial
import MinhaFila from './pages/MinhaFila'
import Oportunidades from './pages/Oportunidades'
import Quadro from './pages/Quadro'
import Clientes from './pages/Clientes'
import Painel from './pages/Painel'
import Usuarios from './pages/Usuarios'

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

            {/* Rotas internas protegidas dentro do Layout institucional N&G */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/minha-fila" element={<MinhaFila />} />
                <Route path="/oportunidades" element={<Oportunidades />} />
                <Route path="/quadro" element={<Quadro />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/painel" element={<Painel />} />
                <Route path="/usuarios" element={<Usuarios />} />
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
