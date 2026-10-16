import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Clock,
  Circle,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  FileText,
  Calendar,
} from 'lucide-react'
import { OportunidadeEtapa, OportunidadeChecklistItem } from '@/types/oportunidades'
import { formatDateBR } from '@/components/NewOpportunityModal'

interface TrilhaEtapasProps {
  etapas: OportunidadeEtapa[]
  etapaAtualId: string | null
  responsavelComercialNome: string
  equipePadraoNome?: string | null
}

export function TrilhaEtapas({
  etapas,
  etapaAtualId,
  responsavelComercialNome,
  equipePadraoNome,
}: TrilhaEtapasProps) {
  // Estado para expandir/recolher checklist de etapas concluídas (somente leitura)
  const [etapaExpandidaId, setEtapaExpandidaId] = useState<string | null>(null)

  const toggleExpandir = (id: string) => {
    setEtapaExpandidaId((prev) => (prev === id ? null : id))
  }

  // Ordenar etapas pela ordem
  const etapasOrdenadas = [...etapas].sort((a, b) => a.ordem - b.ordem)

  return (
    <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
      <CardHeader className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold text-[#0C2D48]">Trilha de etapas</CardTitle>
            <Badge className="bg-slate-100 text-slate-700 border-none text-xs font-semibold">
              {etapasOrdenadas.length} {etapasOrdenadas.length === 1 ? 'etapa' : 'etapas'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe a evolução do fluxo: concluídas, etapa atual e próximas fases
          </p>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <div className="space-y-3">
          {etapasOrdenadas.map((etapa) => {
            const isAtual = etapa.id === etapaAtualId
            const isConcluida = etapa.situacao === 'concluida'
            const isFutura = !isAtual && !isConcluida
            const isExpanded = etapaExpandidaId === etapa.id

            // Resolução do responsável da etapa
            let respText = responsavelComercialNome || 'Responsável comercial'
            if (etapa.responsavel_tipo === 'fila_equipe') {
              const eqNome = etapa.equipe_nome || equipePadraoNome || 'Equipe'
              const funcNome = etapa.funcao ? ` (${etapa.funcao})` : ''
              respText = `Fila da equipe ${eqNome}${funcNome}`
            }

            return (
              <div
                key={etapa.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isAtual
                    ? 'border-teal-500 bg-teal-50/20 ring-2 ring-teal-500/20 shadow-xs'
                    : isConcluida
                      ? 'border-emerald-200 bg-emerald-50/15'
                      : 'border-slate-200/80 bg-white opacity-85'
                }`}
              >
                {/* Linha principal da Etapa */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3.5">
                    {/* Badge de status/ordem */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-2xs ${
                        isAtual
                          ? 'bg-[#00A896] text-white shadow-teal-700/20 shadow-md'
                          : isConcluida
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {isConcluida ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : isAtual ? (
                        <Clock className="w-5 h-5 text-white animate-pulse" />
                      ) : (
                        <span>{etapa.ordem}</span>
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-[#0C2D48]">{etapa.nome}</span>

                        {isAtual && (
                          <Badge className="bg-teal-600 text-white text-[11px] font-semibold px-2 py-0.5">
                            Etapa atual
                          </Badge>
                        )}

                        {isConcluida && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-none text-[11px] font-semibold px-2 py-0.5">
                            Concluída
                          </Badge>
                        )}

                        {isFutura && (
                          <Badge className="bg-slate-100 text-slate-600 border-none text-[11px] font-medium px-2 py-0.5">
                            Futura
                          </Badge>
                        )}

                        {etapa.is_etapa_ganho && (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            Etapa de ganho
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {respText}
                        </span>

                        {isConcluida && etapa.concluida_em && (
                          <span className="flex items-center gap-1 text-emerald-700 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            Concluída em {formatDateBR(etapa.concluida_em)}
                            {etapa.responsavel_usuario_nome &&
                              ` por ${etapa.responsavel_usuario_nome}`}
                          </span>
                        )}

                        {etapa.prazo_dias ? (
                          <span className="text-slate-400">
                            Prazo: {etapa.prazo_dias} {etapa.prazo_dias === 1 ? 'dia' : 'dias'}
                          </span>
                        ) : null}
                      </div>

                      {etapa.descricao && (
                        <p className="text-xs text-slate-500 mt-1">{etapa.descricao}</p>
                      )}
                    </div>
                  </div>

                  {/* Ações / Expandir checklist em concluídas */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {isConcluida && etapa.itens.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpandir(etapa.id)}
                        className="h-8 px-3 text-xs font-semibold text-slate-600 hover:text-teal-700 hover:bg-white rounded-lg border border-slate-200 btn-press"
                      >
                        <CheckSquare className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                        <span>Checklist realizado ({etapa.itens.length})</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 ml-1 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 ml-1 text-slate-400" />
                        )}
                      </Button>
                    )}

                    {isAtual && (
                      <span className="text-xs font-semibold text-teal-700 bg-teal-100/70 px-2.5 py-1 rounded-lg">
                        Preencha o checklist abaixo ↓
                      </span>
                    )}
                  </div>
                </div>

                {/* Checklist expandido da etapa concluída (somente leitura) */}
                {isConcluida && isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-emerald-100 bg-white/70 animate-fade-in">
                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                      Checklist realizado nesta etapa (Somente leitura)
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {etapa.itens.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-slate-800 leading-snug">
                              {item.titulo}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1 font-normal text-slate-600 border-slate-200"
                            >
                              {item.tipo}
                            </Badge>
                          </div>

                          {item.tipo === 'Documento' && (
                            <div className="text-[11px] text-slate-600 flex items-center gap-1.5 pt-1">
                              <FileText className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                              <span className="truncate">
                                {item.arquivo_nome ? item.arquivo_nome : 'Nenhum arquivo anexado'}
                              </span>
                            </div>
                          )}

                          {item.tipo === 'Informação' && (
                            <div className="text-[11px] text-slate-700 pt-0.5">
                              <span className="text-slate-400 font-medium">Resposta: </span>
                              <span className="font-semibold text-teal-900">
                                {item.valor !== null &&
                                item.valor !== undefined &&
                                item.valor !== ''
                                  ? item.valor
                                  : 'Não preenchido'}
                              </span>
                            </div>
                          )}

                          {item.tipo === 'Confirmação' && (
                            <div className="text-[11px] text-slate-700 flex items-center gap-1 pt-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="font-medium text-emerald-800">
                                {item.concluido ? 'Confirmado' : 'Não marcado'}
                              </span>
                            </div>
                          )}

                          {item.concluido && (item.concluido_em || item.concluido_por_nome) && (
                            <p className="text-[10px] text-slate-400 pt-0.5 border-t border-slate-200/60">
                              {item.concluido_em && `Em ${formatDateBR(item.concluido_em)}`}
                              {item.concluido_por_nome && ` por ${item.concluido_por_nome}`}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
