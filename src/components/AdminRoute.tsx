import React from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import NGLogo from '@/components/NGLogo'
import SemAcesso from '@/pages/SemAcesso'

/**
 * T2.04 — guarda das rotas de administrador (Usuários e Configurações).
 *
 * Antes: quem não era administrador era redirecionado para /minha-fila sem nenhuma
 * explicação — não dava para saber se o endereço estava errado, se o acesso foi perdido
 * ou se o sistema falhou.
 *
 * Agora: mostra a tela de "sem acesso", com uma saída clara. O bloqueio continua
 * exatamente o mesmo; muda só o que a pessoa vê.
 *
 * Importante: SemAcesso é renderizado aqui, e a rota /sem-acesso NÃO fica dentro deste
 * guard (ver App.tsx) — se ficasse, entraria em laço.
 */
export const AdminRoute: React.FC = () => {
  const { loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 gap-4">
        <div className="flex flex-col items-center gap-3">
          <NGLogo variant="color" compact={false} />
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium mt-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#00A896]" />
            <span>Verificando permissões...</span>
          </div>
        </div>
      </div>
    )
  }

  // Apenas Administrador tem permissão para acessar.
  // Dentro do Layout (menu e marca já visíveis), então o painel vai no modo inline.
  if (!isAdmin) {
    return <SemAcesso fullPage={false} />
  }

  return <Outlet />
}

export default AdminRoute
