import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import NGLogo from '@/components/NGLogo'

export const ProtectedRoute: React.FC = () => {
  const { session, loading, situacao } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 gap-4">
        <div className="flex flex-col items-center gap-3">
          <NGLogo variant="color" compact={false} />
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium mt-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#00A896]" />
            <span>Verificando autenticação...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/" replace />
  }

  // Se o usuário estiver inativo, não consegue usar o sistema
  if (situacao === 'inativo') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
