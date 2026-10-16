import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { getOportunidades, assumirEtapaOportunidade } from '@/services/oportunidades'
import { OportunidadeResumo } from '@/types/oportunidades'
import PageStateLayout from '@/components/PageStateLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Inbox,
  UserCheck,
  Users2,
  Clock,
  RefreshCw,
  Building2,
  Briefcase,
  ArrowRight,
  HandHelping,
  Loader2,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrencyBRL } from '@/components/NewOpportunityModal'

export default function MinhaFila() {
  const { user, profile, equipesIds, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [oportunidades, setOportunidades] = useState<OportunidadeResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assumindoId, setAssumindoId] = useState<string | null>(null)
  const [selectedProduto, setSelectedProduto] = useState<string>('todos')

  const fetchFila = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getOportunidades()
      if (res.error) {
        throw new Error(res.error)
      }
      setOportunidades(res.data || [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar oportunidades da fila.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFila()
  }, [fetchFila])

  // Identificação do usuário logado
  const currentUserId = user?.id || profile?.id || null
  const userFuncao = profile?.funcao || null

  // Filtro de oportunidades ativas (não concluídas/perdidas/arquivadas que não têm etapa atual em andamento)
  // Mas consideramos oportunidades onde a etapa atual existe
  const oppsComEtapa = useMemo(() => {
    return oportunidades.filter(
      (opp) =>
        opp.etapa_atual_id &&
        opp.situacao !== 'Perdida' &&
        opp.situacao !== 'Arquivada' &&
        opp.situacao !== 'Concluída',
    )
  }, [oportunidades])

  // Produtos únicos disponíveis nas oportunidades da fila para o dropdown
  const produtosDisponiveis = useMemo(() => {
    const map = new Map<string, string>()
    for (const opp of oppsComEtapa) {
      if (opp.produto_id && opp.produto_nome) {
        map.set(opp.produto_id, opp.produto_nome)
      }
    }
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }))
  }, [oppsComEtapa])

  // Oportunidades filtradas por produto (se selecionado)
  const oppsFiltradas = useMemo(() => {
    if (selectedProduto === 'todos') {
      return oppsComEtapa
    }
    return oppsComEtapa.filter((opp) => opp.produto_id === selectedProduto)
  }, [oppsComEtapa, selectedProduto])

  // 1) Seção "Comigo": oportunidades em que o usuário logado é o responsável da etapa atual
  const listaComigo = useMemo(() => {
    if (!currentUserId) return []
    return oppsFiltradas
      .filter((opp) => {
        // Se a etapa tem responsável atribuído diretamente
        if (opp.etapa_atual_responsavel_usuario_id) {
          return opp.etapa_atual_responsavel_usuario_id === currentUserId
        }
        // Se for etapa do tipo responsavel_comercial e o usuário for o responsável comercial
        if (
          opp.etapa_atual_responsavel_tipo === 'responsavel_comercial' &&
          opp.responsavel_comercial_id === currentUserId
        ) {
          return true
        }
        return false
      })
      .sort((a, b) => (b.dias_na_etapa ?? 0) - (a.dias_na_etapa ?? 0)) // Mais antiga primeiro (mais dias)
  }, [oppsFiltradas, currentUserId])

  // 2) Seção "Fila da minha equipe": etapas que estão na fila da equipe+função do usuário logado
  // (responsavel_tipo = fila_equipe, etapa_atual_responsavel_usuario_id = null, equipe e função correspondentes)
  const listaFilaEquipe = useMemo(() => {
    return oppsFiltradas
      .filter((opp) => {
        // Precisa ser da fila de equipe
        if (opp.etapa_atual_responsavel_tipo !== 'fila_equipe') {
          return false
        }
        // Ainda não foi assumida por ninguém
        if (opp.etapa_atual_responsavel_usuario_id) {
          return false
        }

        // Admin pode ver todas as filas de equipe
        if (isAdmin) {
          return true
        }

        // Se o usuário não tem equipes vinculadas
        const etapaEquipeId = opp.etapa_atual_equipe_id || opp.equipe_id
        if (!etapaEquipeId || !equipesIds.includes(etapaEquipeId)) {
          return false
        }

        // Se a etapa exige função específica (ex: Pós-venda, Comercial), usuário deve ter essa função
        if (opp.etapa_atual_funcao && userFuncao && opp.etapa_atual_funcao !== userFuncao) {
          return false
        }

        return true
      })
      .sort((a, b) => (b.dias_na_etapa ?? 0) - (a.dias_na_etapa ?? 0)) // Mais tempo na etapa primeiro
  }, [oppsFiltradas, isAdmin, equipesIds, userFuncao])

  const handleAssumir = async (e: React.MouseEvent, opp: OportunidadeResumo) => {
    e.stopPropagation()
    e.preventDefault()

    if (!opp.etapa_atual_id) {
      toast.error('Etapa atual não identificada.')
      return
    }

    setAssumindoId(opp.id)
    try {
      const res = await assumirEtapaOportunidade({
        oportunidade_id: opp.id,
        etapa_id: opp.etapa_atual_id,
      })

      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(
          `Você assumiu a etapa "${opp.etapa_atual_nome}" da oportunidade ${opp.protocolo}!`,
        )
        await fetchFila()
      }
    } catch {
      toast.error('Erro ao assumir etapa.')
    } finally {
      setAssumindoId(null)
    }
  }

  if (loading && oportunidades.length === 0) {
    return (
      <PageStateLayout
        title="Minha fila"
        subtitle="Carregando oportunidades atribuídas e filas de atendimento..."
        icon={Inbox}
        emptyMessage=""
        status="loading"
      />
    )
  }

  if (error && oportunidades.length === 0) {
    return (
      <PageStateLayout
        title="Minha fila"
        subtitle="Não foi possível obter os dados da fila no momento."
        icon={Inbox}
        emptyMessage="Ocorreu uma falha na comunicação com o banco de dados."
        actionLabel="Tentar novamente"
        onAction={fetchFila}
        status="error"
        onRetry={fetchFila}
      />
    )
  }

  const filaVaziaGeral = listaComigo.length === 0 && listaFilaEquipe.length === 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Topo da página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0C2D48] tracking-tight flex items-center gap-2.5">
            <Inbox className="w-7 h-7 text-teal-600" />
            <span>Minha fila</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Priorize atendimentos atribuídos a você e etapas disponíveis na fila da sua equipe.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFila}
            disabled={loading}
            className="h-10 px-3.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar fila</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtro de Produtos e Contadores */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-xs font-bold text-[#0C2D48] whitespace-nowrap">
              Filtrar por produto:
            </span>
            <Select value={selectedProduto} onValueChange={setSelectedProduto}>
              <SelectTrigger className="h-9 w-full sm:w-[260px] rounded-xl text-xs border-slate-200 bg-slate-50/50">
                <SelectValue placeholder="Todos os produtos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os produtos ({oppsComEtapa.length})</SelectItem>
                {produtosDisponiveis.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 font-semibold border border-teal-200/70">
              Comigo: {listaComigo.length}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 font-semibold border border-amber-200/70">
              Fila da equipe: {listaFilaEquipe.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Estado Vazio Geral */}
      {filaVaziaGeral ? (
        <Card className="border border-slate-200/80 bg-white rounded-2xl p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 mx-auto mb-3">
            <UserCheck className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-[#0C2D48]">Tudo em dia por aqui!</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
            Não há oportunidades pendentes no seu nome nem na fila da sua equipe no momento.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/oportunidades')}
            className="mt-5 h-10 px-5 rounded-xl text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50"
          >
            <Briefcase className="w-4 h-4 mr-1.5" />
            <span>Ver todas as oportunidades</span>
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* ========================================================
              SEÇÃO 1: COMIGO
             ======================================================== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-[#0C2D48] tracking-tight">
                    Comigo ({listaComigo.length})
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    Oportunidades em que você é o responsável pela etapa atual.
                  </p>
                </div>
              </div>
            </div>

            {listaComigo.length === 0 ? (
              <Card className="border border-dashed border-slate-200 bg-slate-50/50 rounded-2xl p-6 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  Nenhuma oportunidade atribuída diretamente a você no momento.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listaComigo.map((opp) => (
                  <Card
                    key={opp.id}
                    onClick={() => navigate(`/oportunidades/${opp.id}`)}
                    className="border border-slate-200/80 bg-white hover:border-teal-400 hover:shadow-md transition-all rounded-2xl cursor-pointer group flex flex-col justify-between overflow-hidden"
                  >
                    <CardContent className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Topo do Card: Protocolo e Dias na Etapa */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-900 border border-teal-200">
                            {opp.protocolo}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              (opp.dias_na_etapa ?? 0) >= 3
                                ? 'bg-amber-100 text-amber-900 font-bold'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                            title={`Tempo nesta etapa: ${opp.dias_na_etapa ?? 0} dias`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>
                              {opp.dias_na_etapa === 0
                                ? 'Hoje'
                                : opp.dias_na_etapa === 1
                                  ? 'Há 1 dia'
                                  : `Há ${opp.dias_na_etapa} dias`}
                            </span>
                          </span>
                        </div>

                        {/* Nome do Cliente */}
                        <h3 className="font-bold text-sm sm:text-base text-[#0C2D48] group-hover:text-teal-700 transition-colors line-clamp-1">
                          {opp.cliente_nome}
                        </h3>

                        {/* Produto e Seguradora */}
                        <div className="text-xs text-slate-600 mt-1">
                          <span className="font-semibold text-slate-800">{opp.produto_nome}</span>
                          {opp.seguradora_nome && (
                            <span className="text-slate-500"> — {opp.seguradora_nome}</span>
                          )}
                        </div>
                      </div>

                      {/* Rodapé do Card: Etapa Atual e Valor */}
                      <div className="pt-3 border-t border-slate-100 mt-2 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500 font-medium">
                            Etapa atual:
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-semibold text-[11px] border border-teal-200 truncate max-w-[170px]">
                            {opp.etapa_atual_nome || 'Inicial'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500 font-medium">
                            Valor estimado:
                          </span>
                          <span className="font-bold text-teal-700">
                            {formatCurrencyBRL(opp.valor_estimado)}
                          </span>
                        </div>

                        <div className="pt-1 flex items-center justify-end text-xs text-teal-700 font-semibold group-hover:translate-x-0.5 transition-transform">
                          <span>Abrir ficha</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================
              SEÇÃO 2: FILA DA MINHA EQUIPE
             ======================================================== */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs">
                  <Users2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-[#0C2D48] tracking-tight">
                    Fila da minha equipe ({listaFilaEquipe.length})
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    Etapas coletivas aguardando que um membro da equipe assuma o atendimento.
                  </p>
                </div>
              </div>
            </div>

            {listaFilaEquipe.length === 0 ? (
              <Card className="border border-dashed border-slate-200 bg-slate-50/50 rounded-2xl p-6 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  Nenhuma oportunidade pendente na fila da sua equipe.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listaFilaEquipe.map((opp) => (
                  <Card
                    key={opp.id}
                    onClick={() => navigate(`/oportunidades/${opp.id}`)}
                    className="border border-amber-200/90 bg-white hover:border-amber-400 hover:shadow-md transition-all rounded-2xl cursor-pointer group flex flex-col justify-between overflow-hidden relative"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                    <CardContent className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Topo do Card: Protocolo e Dias na Etapa */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                            {opp.protocolo}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900"
                            title={`Tempo nesta etapa: ${opp.dias_na_etapa ?? 0} dias`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>
                              {opp.dias_na_etapa === 0
                                ? 'Hoje'
                                : opp.dias_na_etapa === 1
                                  ? 'Há 1 dia'
                                  : `Há ${opp.dias_na_etapa} dias`}
                            </span>
                          </span>
                        </div>

                        {/* Nome do Cliente */}
                        <h3 className="font-bold text-sm sm:text-base text-[#0C2D48] group-hover:text-teal-700 transition-colors line-clamp-1">
                          {opp.cliente_nome}
                        </h3>

                        {/* Produto e Seguradora */}
                        <div className="text-xs text-slate-600 mt-1">
                          <span className="font-semibold text-slate-800">{opp.produto_nome}</span>
                          {opp.seguradora_nome && (
                            <span className="text-slate-500"> — {opp.seguradora_nome}</span>
                          )}
                        </div>

                        {opp.equipe_nome && (
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                            <span className="font-medium text-slate-400">Equipe:</span>
                            <span className="font-semibold text-slate-700">{opp.equipe_nome}</span>
                          </div>
                        )}
                      </div>

                      {/* Rodapé: Etapa Atual e Botão ASSUMIR */}
                      <div className="pt-3 border-t border-slate-100 mt-2 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500 font-medium">
                            Etapa da fila:
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 font-semibold text-[11px] border border-amber-200 truncate max-w-[170px]">
                            {opp.etapa_atual_nome || 'Em fila'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={(e) => handleAssumir(e, opp)}
                            disabled={assumindoId === opp.id}
                            className="w-full h-9 rounded-xl bg-[#00A896] hover:bg-[#008f80] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs btn-press"
                          >
                            {assumindoId === opp.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Assumindo...</span>
                              </>
                            ) : (
                              <>
                                <HandHelping className="w-3.5 h-3.5" />
                                <span>Assumir etapa</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
