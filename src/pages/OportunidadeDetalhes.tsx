import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import PageStateLayout from '@/components/PageStateLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Briefcase,
  ArrowLeft,
  Calendar,
  DollarSign,
  Building2,
  User,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Tag,
  CheckSquare,
  HelpCircle,
  Hash,
} from 'lucide-react'
import { getOportunidadeById } from '@/services/oportunidades'
import { OportunidadeDetalhe, OportunidadeEtapa } from '@/types/oportunidades'
import { formatDateBR, formatCurrencyBRL } from '@/components/NewOpportunityModal'
import { formatCNPJ, formatCPF } from '@/lib/clientes-utils'

export default function OportunidadeDetalhes() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [opp, setOpp] = useState<OportunidadeDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOportunidade = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await getOportunidadeById(id)
      if (res.error || !res.data) {
        throw new Error(res.error || 'Oportunidade não encontrada.')
      }
      setOpp(res.data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao buscar oportunidade.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchOportunidade()
  }, [fetchOportunidade])

  if (loading && !opp) {
    return (
      <PageStateLayout
        title="Ficha da oportunidade"
        subtitle="Carregando dados da negociação e trilha de etapas..."
        icon={Briefcase}
        emptyMessage=""
        status="loading"
      />
    )
  }

  if (error || !opp) {
    return (
      <PageStateLayout
        title="Oportunidade não encontrada"
        subtitle="A negociação solicitada não existe ou você não tem acesso."
        icon={Briefcase}
        emptyMessage="Não foi possível carregar as informações desta oportunidade."
        actionLabel="Voltar para Oportunidades"
        onAction={() => navigate('/oportunidades')}
        status="error"
        onRetry={fetchOportunidade}
      />
    )
  }

  const docFormatado =
    opp.cliente_tipo === 'PJ' ? formatCNPJ(opp.cliente_documento) : formatCPF(opp.cliente_documento)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Voltar e topo */}
      <div className="flex items-center justify-between">
        <Link
          to="/oportunidades"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors btn-press"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para lista de oportunidades</span>
        </Link>

        <Badge
          className={`text-xs px-3 py-1 font-semibold border ${
            opp.situacao === 'Em andamento'
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : opp.situacao === 'Ganha'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}
        >
          {opp.situacao}
        </Badge>
      </div>

      {/* Aviso quando usou fluxo genérico */}
      {opp.usou_fluxo_generico && (
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-3 text-amber-900 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-sm text-amber-950">Aviso sobre o fluxo aplicado</h4>
            <p className="text-amber-900 leading-relaxed">
              Este produto ainda não tem um fluxo próprio; usamos o fluxo padrão.
            </p>
          </div>
        </div>
      )}

      {/* Cabeçalho da Oportunidade com Protocolo em Destaque */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 sm:p-7 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0C2D48] text-white flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-xs">
              <Briefcase className="w-7 h-7 text-teal-300" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs uppercase px-2.5 py-0.5 rounded-md bg-teal-100 text-teal-900 font-bold tracking-wider">
                  {opp.protocolo}
                </span>
                <Badge className="bg-slate-100 text-slate-800 border-none text-xs px-2.5 py-0.5 font-semibold">
                  Versão {opp.fluxo_versao} do fluxo
                </Badge>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-[#0C2D48] tracking-tight mt-1 truncate">
                {opp.produto_nome}
                {opp.seguradora_nome ? ` — ${opp.seguradora_nome}` : ''}
              </h1>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-500 mt-1">
                <Link
                  to={`/clientes/${opp.cliente_id}`}
                  className="font-semibold text-teal-700 hover:underline flex items-center gap-1"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{opp.cliente_nome}</span>
                </Link>

                {docFormatado && <span className="font-mono text-slate-400">({docFormatado})</span>}

                <span className="text-slate-400">Criada em {formatDateBR(opp.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              asChild
              className="h-10 px-4 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold btn-press"
            >
              <Link to={`/clientes/${opp.cliente_id}`}>
                <Building2 className="w-4 h-4 mr-1.5 text-teal-600" />
                Ver cliente
              </Link>
            </Button>
          </div>
        </div>

        {/* Informações comerciais principais em Grid */}
        <CardContent className="p-5 sm:p-7">
          <h3 className="text-xs font-bold text-[#0C2D48] uppercase tracking-wider mb-4">
            Dados comerciais da negociação
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Valor estimado */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Valor estimado</span>
              <span className="font-bold text-slate-900 text-base mt-0.5 block text-teal-700">
                {formatCurrencyBRL(opp.valor_estimado)}
              </span>
            </div>

            {/* Data prevista */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Data prevista de fechamento</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {formatDateBR(opp.data_prevista_fechamento)}
              </span>
            </div>

            {/* Responsável comercial */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Responsável comercial</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {opp.responsavel_comercial_nome}
              </span>
            </div>

            {/* Origem */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Origem do lead</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {opp.origem_nome}
              </span>
            </div>

            {/* Equipe do produto */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Equipe responsável</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {opp.equipe_nome || 'Equipe Geral'}
              </span>
            </div>

            {/* Frente */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Frente de negócio</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {opp.produto_frente}
              </span>
            </div>

            {/* Etapa atual */}
            <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 col-span-1 sm:col-span-2">
              <span className="text-teal-700 font-medium block">Etapa atual do fluxo</span>
              <span className="font-bold text-teal-950 text-sm mt-0.5 block">
                {opp.etapa_atual_nome || 'Primeira etapa em andamento'}
              </span>
            </div>
          </div>

          {/* Observações se preenchidas */}
          {opp.observacoes && (
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs font-bold text-slate-700 block mb-1">Observações</span>
              <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                {opp.observacoes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================
          TRILHA DE ETAPAS COPIADAS (Snapshot da Oportunidade)
         ======================================================== */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-600" />
              <CardTitle className="text-lg font-bold text-[#0C2D48]">
                Trilha de etapas do fluxo
              </CardTitle>
              <Badge className="bg-slate-100 text-slate-700 text-xs font-semibold">
                {opp.etapas.length} {opp.etapas.length === 1 ? 'etapa' : 'etapas'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cópia das etapas e itens de checklist congelados na versão {opp.fluxo_versao} do
              modelo.
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6">
          <div className="space-y-4">
            {opp.etapas.map((etapa) => {
              const isAtual = opp.etapa_atual_id === etapa.id
              const isConcluida = etapa.situacao === 'concluida'
              const isEmAndamento = etapa.situacao === 'em_andamento'

              // Resolução amigável de exibição do responsável da etapa
              let respText = 'Responsável comercial'
              if (etapa.responsavel_tipo === 'responsavel_comercial') {
                respText = opp.responsavel_comercial_nome || 'Responsável comercial'
              } else if (etapa.responsavel_tipo === 'fila_equipe') {
                const equipeParte = etapa.equipe_nome || opp.equipe_nome || 'Equipe'
                const funcaoParte = etapa.funcao ? ` (${etapa.funcao})` : ''
                respText = `Fila da equipe ${equipeParte}${funcaoParte}`
              }

              return (
                <div
                  key={etapa.id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isAtual
                      ? 'border-teal-500 bg-teal-50/20 shadow-xs'
                      : isConcluida
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Cabeçalho da Etapa */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
                    <div className="flex items-start sm:items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          isAtual
                            ? 'bg-[#00A896] text-white shadow-xs'
                            : isConcluida
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {etapa.ordem}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-sm text-[#0C2D48]">{etapa.nome}</h4>
                          {isAtual && (
                            <Badge className="bg-teal-100 text-teal-900 border-none text-[10px] font-semibold">
                              Etapa atual
                            </Badge>
                          )}
                          {etapa.is_etapa_ganho && (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-semibold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              Etapa de ganho
                            </Badge>
                          )}
                        </div>

                        {etapa.descricao && (
                          <p className="text-xs text-slate-500 mt-0.5">{etapa.descricao}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                        {etapa.tipo}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {respText}
                      </span>
                      {etapa.prazo_dias ? (
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Prazo: {etapa.prazo_dias} {etapa.prazo_dias === 1 ? 'dia' : 'dias'}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Itens do Checklist da Etapa */}
                  <div className="p-4 sm:p-5 bg-slate-50/40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-teal-600" />
                        Checklist da etapa ({etapa.itens.length})
                      </span>
                    </div>

                    {etapa.itens.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        Esta etapa não possui itens de checklist cadastrados.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {etapa.itens.map((item) => (
                          <div
                            key={item.id}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs flex items-start gap-2.5 shadow-2xs"
                          >
                            <div className="w-5 h-5 rounded-md border border-slate-300 flex items-center justify-center flex-shrink-0 mt-0.5 bg-slate-50">
                              <span className="text-[10px] text-slate-400 font-mono">
                                {item.ordem}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-medium text-slate-800 leading-tight">
                                  {item.titulo}
                                </span>
                                {item.obrigatorio && (
                                  <span
                                    className="text-[10px] text-red-500 font-semibold flex-shrink-0"
                                    title="Obrigatório"
                                  >
                                    *
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] py-0 px-1 font-normal text-slate-600 border-slate-200"
                                >
                                  {item.tipo}
                                </Badge>
                                {item.formato && (
                                  <span className="text-[10px] text-slate-400">
                                    • Formato: {item.formato}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
