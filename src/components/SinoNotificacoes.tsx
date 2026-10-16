import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Bell, CheckCheck, ExternalLink, Loader2 } from 'lucide-react'
import { NotificacaoItem } from '@/types/notificacoes'
import { getMinhasNotificacoes, marcarNotificacoesLidas } from '@/services/notificacoes'
import { formatDateBR } from '@/components/NewOpportunityModal'
import { useAuth } from '@/hooks/use-auth'

export function SinoNotificacoes() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([])
  const [carregando, setCarregando] = useState(false)
  const [marcandoTodas, setMarcandoTodas] = useState(false)

  const carregarNotificacoes = useCallback(async () => {
    if (!user) return
    setCarregando(true)
    const res = await getMinhasNotificacoes()
    if (res.data) {
      setNotificacoes(res.data)
    }
    setCarregando(false)
  }, [user])

  useEffect(() => {
    if (user) {
      carregarNotificacoes()
    }
  }, [user, carregarNotificacoes])

  // Recarregar ao abrir o popover
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      carregarNotificacoes()
    }
  }

  const naoLidas = notificacoes.filter((n) => !n.lida)
  const totalNaoLidas = naoLidas.length

  const handleMarcarTodasLidas = async () => {
    setMarcandoTodas(true)
    const res = await marcarNotificacoesLidas(null)
    if (res.success) {
      setNotificacoes((prev) =>
        prev.map((n) => ({ ...n, lida: true, lida_em: new Date().toISOString() })),
      )
    }
    setMarcandoTodas(false)
  }

  const handleMarcarUmaLida = async (id: string) => {
    const res = await marcarNotificacoesLidas(id)
    if (res.success) {
      setNotificacoes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, lida: true, lida_em: new Date().toISOString() } : n,
        ),
      )
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-2 rounded-xl text-slate-500 hover:text-[#0C2D48] hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-600 btn-press"
          aria-label="Notificações"
        >
          <Bell className="w-5 h-5" />
          {totalNaoLidas > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-white animate-pulse">
              {totalNaoLidas > 9 ? '9+' : totalNaoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 rounded-2xl shadow-xl border-slate-200 overflow-hidden bg-white z-50"
      >
        <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs uppercase text-[#0C2D48] tracking-wider">
              Notificações
            </span>
            {totalNaoLidas > 0 && (
              <span className="text-[11px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                {totalNaoLidas} nova{totalNaoLidas > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {totalNaoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarcarTodasLidas}
              disabled={marcandoTodas}
              className="h-7 px-2 text-[11px] font-medium text-teal-700 hover:text-teal-900 hover:bg-teal-50"
            >
              {marcandoTodas ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5 mr-1 text-teal-600" />
              )}
              Marcar todas como lidas
            </Button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
          {carregando && notificacoes.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
              Carregando notificações...
            </div>
          ) : notificacoes.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                <Bell className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-[#0C2D48]">Nenhuma notificação</h4>
              <p className="text-xs text-slate-500 mt-1">
                Você será avisado sobre atualizações na sua fila comercial.
              </p>
            </div>
          ) : (
            notificacoes.map((item) => {
              return (
                <div
                  key={item.id}
                  className={`p-3.5 transition-colors text-xs ${
                    item.lida
                      ? 'bg-white hover:bg-slate-50/70'
                      : 'bg-teal-50/40 hover:bg-teal-50/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {!item.lida && (
                          <span className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0" />
                        )}
                        <h5 className="font-bold text-slate-900 leading-snug truncate">
                          {item.titulo}
                        </h5>
                      </div>
                      <p className="text-slate-600 mt-1 leading-relaxed text-[11px] whitespace-pre-wrap">
                        {item.mensagem}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-2">
                        <span>{formatDateBR(item.created_at)}</span>
                        {item.link && (
                          <Link
                            to={item.link}
                            onClick={() => {
                              if (!item.lida) handleMarcarUmaLida(item.id)
                              setOpen(false)
                            }}
                            className="font-semibold text-teal-700 hover:underline flex items-center gap-1"
                          >
                            <span>Abrir oportunidade</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {!item.lida && (
                      <button
                        type="button"
                        onClick={() => handleMarcarUmaLida(item.id)}
                        className="text-[10px] text-slate-400 hover:text-teal-700 font-medium px-1.5 py-0.5 rounded hover:bg-white"
                        title="Marcar como lida"
                      >
                        Lida
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
