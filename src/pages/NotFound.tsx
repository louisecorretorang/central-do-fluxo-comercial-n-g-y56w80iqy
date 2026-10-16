/* 404 Page - Central do Fluxo Comercial N&G */
import { useLocation, Link } from 'react-router-dom'
import NGLogo from '@/components/NGLogo'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'

const NotFound = () => {
  const location = useLocation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <NGLogo variant="color" />
        </div>
        <div className="space-y-2">
          <span className="text-6xl font-extrabold text-[#0C2D48]">404</span>
          <h1 className="text-xl font-bold text-slate-800">Página não encontrada</h1>
          <p className="text-sm text-slate-500">
            A rota{' '}
            <code className="text-teal-700 bg-slate-100 px-1.5 py-0.5 rounded">
              {location.pathname}
            </code>{' '}
            não existe ou não está acessível no fluxo comercial.
          </p>
        </div>
        <div>
          <Link to="/">
            <Button className="rounded-xl bg-[#0C2D48] hover:bg-[#071c2e] text-white font-semibold text-xs h-11 px-5 btn-press gap-2">
              <Home className="w-4 h-4 text-teal-400" />
              <span>Voltar ao início</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFound
