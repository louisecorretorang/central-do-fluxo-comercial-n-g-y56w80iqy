import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useOpportunityModal } from '@/hooks/use-opportunity-modal'
import NGLogo from '@/components/NGLogo'
import NewOpportunityModal from '@/components/NewOpportunityModal'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Inbox,
  Briefcase,
  KanbanSquare,
  Building2,
  LayoutDashboard,
  Users2,
  Settings,
  Bell,
  LogOut,
  Plus,
  Menu,
  X,
  User as UserIcon,
  Sparkles,
} from 'lucide-react'

// Itens de navegação da Central do Fluxo Comercial N&G
// Configurações e Usuários visíveis apenas para Administrador
const NAV_ITEMS = [
  { path: '/minha-fila', label: 'Minha fila', icon: Inbox },
  { path: '/oportunidades', label: 'Oportunidades', icon: Briefcase },
  { path: '/quadro', label: 'Quadro', icon: KanbanSquare },
  { path: '/clientes', label: 'Clientes', icon: Building2 },
  { path: '/painel', label: 'Painel', icon: LayoutDashboard },
  { path: '/usuarios', label: 'Usuários', icon: Users2, adminOnly: true },
  {
    path: '/configuracoes/fluxos',
    label: 'Fluxos',
    icon: Sparkles,
    adminOnly: true,
    section: 'Configurações',
  },
  {
    path: '/configuracoes/catalogo',
    label: 'Catálogo',
    icon: Settings,
    adminOnly: true,
    section: 'Configurações',
  },
]

export default function Layout() {
  const { userDisplayName, signOut, perfil, isAdmin } = useAuth()
  const { isOpen, prefilledClient, openModal, closeModal, setIsOpen } = useOpportunityModal()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Os itens "Usuários" e "Configurações" só aparecem no menu para Administrador
  const navItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly) {
      return isAdmin
    }
    return true
  })

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    await signOut()
    navigate('/', { replace: true })
    setIsLoggingOut(false)
  }

  const getPageTitle = () => {
    if (location.pathname.startsWith('/clientes/')) {
      return 'Ficha do Cliente'
    }
    if (location.pathname.startsWith('/configuracoes/fluxos')) {
      return 'Configurações > Fluxos'
    }
    if (location.pathname.startsWith('/configuracoes/catalogo')) {
      return 'Configurações > Catálogo'
    }
    if (location.pathname.startsWith('/configuracoes')) {
      return 'Configurações'
    }
    const item = NAV_ITEMS.find((n) => n.path === location.pathname)
    return item ? item.label : 'Central do Fluxo Comercial'
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans antialiased selection:bg-teal-100 selection:text-teal-900">
      {/* ========================================================
          SIDEBAR DESKTOP (Fixa à esquerda, 260px, identidade N&G)
         ======================================================== */}
      <aside className="hidden md:flex flex-col w-[260px] bg-[#0C2340] text-slate-100 flex-shrink-0 border-r border-[#15345a] fixed inset-y-0 left-0 z-30 shadow-lg">
        {/* Topo do menu com Logo N&G */}
        <div className="p-5 border-b border-[#15345a] flex flex-col items-start gap-2 bg-[#08182d]">
          <div className="flex items-center gap-3">
            <NGLogo variant="white" compact />
            <div className="flex flex-col leading-tight">
              <span className="font-extrabold text-sm tracking-wide text-white">
                NUNES <span className="text-teal-400">&amp;</span> GROSSI
              </span>
              <span className="text-[10px] uppercase tracking-wider text-teal-300 font-medium">
                Corretora de Seguros
              </span>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-950/80 border border-teal-500/30 text-[11px] text-teal-300 font-medium mt-1">
            <Sparkles className="w-3 h-3 text-teal-400" />
            Central do Fluxo Comercial
          </div>
        </div>

        {/* Links de navegação vertical */}
        <nav className="flex-1 p-3.5 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Navegação Principal
          </div>
          {navItems
            .filter((item) => !('section' in item))
            .map((item) => {
              const Icon = item.icon
              const isActive =
                location.pathname === item.path ||
                (item.path === '/clientes' && location.pathname.startsWith('/clientes/'))
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative ${
                    isActive
                      ? 'bg-[#14375f] text-white font-semibold shadow-inner'
                      : 'text-slate-300 hover:text-white hover:bg-[#112d50]'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-teal-400" />
                  )}
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-teal-400' : 'text-slate-400 group-hover:text-teal-300'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              )
            })}

          {isAdmin && (
            <>
              <div className="pt-3 px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Configurações</span>
                <span className="text-[10px] text-teal-400/80 font-normal">Admin</span>
              </div>
              {navItems
                .filter((item) => 'section' in item)
                .map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname.startsWith(item.path)
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative ${
                        isActive
                          ? 'bg-[#14375f] text-white font-semibold shadow-inner'
                          : 'text-slate-300 hover:text-white hover:bg-[#112d50]'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-teal-400" />
                      )}
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive ? 'text-teal-400' : 'text-slate-400 group-hover:text-teal-300'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  )
                })}
            </>
          )}
        </nav>

        {/* Rodapé da Sidebar */}
        <div className="p-3.5 border-t border-[#15345a] bg-[#08182d]/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 text-xs font-bold flex-shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate capitalize">
                {userDisplayName}
              </p>
              <p className="text-[10px] text-teal-300/80 truncate font-medium">
                {perfil || 'Comercial N&G'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================
          DRAWER MOBILE (Deslizante via Sheet do shadcn)
         ======================================================== */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="p-0 w-[280px] bg-[#0C2340] text-slate-100 border-r border-[#15345a]"
        >
          <SheetHeader className="p-4 border-b border-[#15345a] bg-[#08182d] text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <NGLogo variant="white" compact />
                <div className="flex flex-col leading-tight">
                  <SheetTitle className="text-white text-sm font-extrabold tracking-wide">
                    NUNES <span className="text-teal-400">&amp;</span> GROSSI
                  </SheetTitle>
                  <span className="text-[10px] text-teal-300 font-medium">
                    Corretora de Seguros
                  </span>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-teal-300/90 pt-1">Central do Fluxo Comercial</div>
          </SheetHeader>

          <nav className="p-3 space-y-1.5 overflow-y-auto">
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Navegação
            </div>
            {navItems
              .filter((item) => !('section' in item))
              .map((item) => {
                const Icon = item.icon
                const isActive =
                  location.pathname === item.path ||
                  (item.path === '/clientes' && location.pathname.startsWith('/clientes/'))
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#14375f] text-white font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-[#112d50]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}

            {isAdmin && (
              <>
                <div className="pt-3 px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Configurações
                </div>
                {navItems
                  .filter((item) => 'section' in item)
                  .map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname.startsWith(item.path)
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-[#14375f] text-white font-semibold'
                            : 'text-slate-300 hover:text-white hover:bg-[#112d50]'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-400'}`}
                        />
                        <span>{item.label}</span>
                      </NavLink>
                    )
                  })}
              </>
            )}
          </nav>

          <div className="p-4 border-t border-[#15345a] mt-auto bg-[#08182d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <UserIcon className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <span className="text-xs text-white truncate capitalize font-medium">
                  {userDisplayName}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="text-xs text-rose-300 hover:text-white hover:bg-rose-900/40 h-8 px-2"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Sair
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ========================================================
          ÁREA PRINCIPAL (HEADER + CONTEÚDO)
         ======================================================== */}
      <div className="flex-1 flex flex-col md:pl-[260px] min-w-0">
        {/* HEADER FIXO DE 64px */}
        <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 shadow-xs">
          {/* Lado esquerdo: hambúrguer mobile + título da página */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0C2D48] truncate">
                {getPageTitle()}
              </h2>
            </div>
          </div>

          {/* Lado direito: Botão Nova oportunidade + Notificações + Usuário + Sair */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botão de destaque "Nova oportunidade" SEMPRE visível no topo (desktop) */}
            <Button
              onClick={() => openModal()}
              className="hidden md:inline-flex h-10 px-4 rounded-xl bg-[#00A896] hover:bg-[#008f80] text-white font-semibold shadow-xs items-center gap-2 btn-press"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nova oportunidade</span>
            </Button>

            {/* Sino de Notificações com popover amigável */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="relative p-2 rounded-xl text-slate-500 hover:text-[#0C2D48] hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-600 btn-press"
                  aria-label="Notificações"
                >
                  <Bell className="w-5 h-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-72 p-4 rounded-2xl shadow-lg border-slate-200"
              >
                <div className="text-center py-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                    <Bell className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-[#0C2D48]">Nenhuma notificação</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Você será avisado sobre atualizações na sua fila comercial.
                  </p>
                </div>
              </PopoverContent>
            </Popover>

            {/* Nome da pessoa logada (desktop) */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 text-xs font-semibold text-slate-700 capitalize">
              <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                {userDisplayName.charAt(0).toUpperCase()}
              </span>
              <span className="max-w-[140px] truncate">{userDisplayName}</span>
            </div>

            {/* Botão Sair */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="h-9 px-2.5 sm:px-3 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 text-xs font-medium flex items-center gap-1.5 transition-colors btn-press"
              title="Encerrar sessão"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </header>

        {/* ÁREA DE CONTEÚDO PRINCIPAL */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* ========================================================
          MOBILE FAB: Botão "Nova oportunidade" flutuante
         ======================================================== */}
      <button
        type="button"
        onClick={() => openModal()}
        className="md:hidden fixed bottom-5 right-5 z-40 h-14 px-5 rounded-full bg-[#00A896] hover:bg-[#008f80] text-white shadow-xl flex items-center gap-2 font-semibold text-sm active:scale-95 transition-transform"
        aria-label="Criar nova oportunidade"
      >
        <Plus className="w-5 h-5 stroke-[2.5]" />
        <span>Nova oportunidade</span>
      </button>

      {/* Modal global de criação de oportunidade */}
      <NewOpportunityModal open={isOpen} onOpenChange={setIsOpen} initialClient={prefilledClient} />
    </div>
  )
}
