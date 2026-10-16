import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LucideIcon, Loader2, AlertCircle, PlusCircle } from 'lucide-react'

interface PageStateLayoutProps {
  title: string
  subtitle?: string
  icon: LucideIcon
  emptyMessage: string
  actionLabel?: string
  onAction?: () => void
  status?: 'idle' | 'loading' | 'empty' | 'error'
  onRetry?: () => void
}

export const PageStateLayout: React.FC<PageStateLayoutProps> = ({
  title,
  subtitle,
  icon: Icon,
  emptyMessage,
  actionLabel,
  onAction,
  status = 'empty',
  onRetry,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho da página interna */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200/70">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-[#0C2D48] tracking-tight">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
      </div>

      {/* Estado: Carregando */}
      {status === 'loading' && (
        <Card className="border border-slate-200/80 bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200/50 flex items-center justify-center text-teal-600 mb-4 animate-spin">
              <Loader2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-[#0C2D48]">Carregando...</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Buscando informações da Central do Fluxo Comercial.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Estado: Erro */}
      {status === 'error' && (
        <Card className="border border-red-200 bg-red-50/40 rounded-2xl shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-100/80 border border-red-200 flex items-center justify-center text-red-600 mb-4">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              Não foi possível carregar. Tente novamente.
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Houve uma instabilidade temporária ao buscar as informações do fluxo.
            </p>
            {onRetry && (
              <Button
                variant="outline"
                onClick={onRetry}
                className="mt-5 rounded-xl border-slate-300 text-slate-700 hover:bg-white btn-press"
              >
                Tentar novamente
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Estado: Vazio amigável (padrão) */}
      {status === 'empty' && (
        <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-sm overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="relative mb-5">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-50 to-teal-50/60 border border-slate-200/70 flex items-center justify-center text-[#0C2D48] shadow-sm">
                <Icon className="w-10 h-10 text-teal-700 stroke-[1.75]" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-teal-200 flex items-center justify-center shadow-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
              </div>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-[#0C2D48] max-w-md">{emptyMessage}</h3>

            <p className="text-sm text-slate-500 mt-2 max-w-md leading-relaxed">
              Os registros da Central do Fluxo Comercial aparecerão organizados aqui conforme forem
              criados e movimentados pela equipe.
            </p>

            {actionLabel && (
              <Button
                onClick={onAction}
                className="mt-6 h-11 px-6 rounded-xl bg-[#0C2D48] hover:bg-[#071d30] text-white font-semibold flex items-center gap-2 shadow-sm btn-press"
              >
                <PlusCircle className="w-4 h-4 text-teal-300" />
                {actionLabel}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default PageStateLayout
