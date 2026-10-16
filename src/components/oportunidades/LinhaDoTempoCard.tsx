import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  History,
  CheckCircle2,
  FileText,
  MessageCircle,
  Hash,
  ArrowRightCircle,
  User,
  Sparkles,
  Inbox,
} from 'lucide-react'
import { OportunidadeTimelineItem, TimelineTipo } from '@/types/oportunidades'

interface LinhaDoTempoCardProps {
  timeline: OportunidadeTimelineItem[]
}

function formatarDataHoraBR(isoString: string): { data: string; hora: string } {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return { data: '—', hora: '—' }
    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const ano = d.getFullYear()
    const horas = String(d.getHours()).padStart(2, '0')
    const minutos = String(d.getMinutes()).padStart(2, '0')
    return {
      data: `${dia}/${mes}/${ano}`,
      hora: `${horas}:${minutos}`,
    }
  } catch {
    return { data: '—', hora: '—' }
  }
}

function getTipoIcon(tipo: TimelineTipo) {
  switch (tipo) {
    case 'criacao':
      return {
        icon: Sparkles,
        color: 'text-teal-700',
        bg: 'bg-teal-50 border-teal-200',
      }
    case 'etapa_concluida':
      return {
        icon: CheckCircle2,
        color: 'text-emerald-700',
        bg: 'bg-emerald-50 border-emerald-200',
      }
    case 'documento':
      return {
        icon: FileText,
        color: 'text-blue-700',
        bg: 'bg-blue-50 border-blue-200',
      }
    case 'interacao':
      return {
        icon: MessageCircle,
        color: 'text-purple-700',
        bg: 'bg-purple-50 border-purple-200',
      }
    case 'quiver':
      return {
        icon: Hash,
        color: 'text-indigo-700',
        bg: 'bg-indigo-50 border-indigo-200',
      }
    case 'troca_responsavel':
      return {
        icon: User,
        color: 'text-amber-700',
        bg: 'bg-amber-50 border-amber-200',
      }
    default:
      return {
        icon: ArrowRightCircle,
        color: 'text-slate-700',
        bg: 'bg-slate-50 border-slate-200',
      }
  }
}

export function LinhaDoTempoCard({ timeline }: LinhaDoTempoCardProps) {
  return (
    <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
      <CardHeader className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex flex-row items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <History className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-[#0C2D48]">Linha do tempo</CardTitle>
              <Badge className="bg-slate-100 text-slate-700 border-none text-xs font-semibold">
                {timeline.length} {timeline.length === 1 ? 'registro' : 'registros'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tudo o que aconteceu na oportunidade (criação, etapas, documentos, interações)
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        {timeline.length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-slate-50/50 border border-dashed border-slate-200">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Linha do tempo vazia</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Nenhuma ação foi registrada nesta oportunidade até o momento.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {timeline.map((item) => {
              const { data, hora } = formatarDataHoraBR(item.created_at)
              const cfg = getTipoIcon(item.tipo)
              const IconComp = cfg.icon

              return (
                <div key={item.id} className="relative group">
                  {/* Ícone no eixo da linha */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 rounded-full border flex items-center justify-center ${cfg.bg} ${cfg.color} shadow-2xs z-10`}
                  >
                    <IconComp className="w-3 h-3" />
                  </div>

                  <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 sm:p-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">
                        {item.titulo}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                        <span>{data}</span>
                        <span>às</span>
                        <span>{hora}</span>
                      </div>
                    </div>

                    {item.descricao && (
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {item.descricao}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{item.usuario_nome || 'Sistema N&G'}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
