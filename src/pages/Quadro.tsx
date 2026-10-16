import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFluxoModelos, getFluxoModeloById } from '@/services/fluxos'
import { getOportunidades } from '@/services/oportunidades'
import { getUsersWithEquipes, getEquipes } from '@/services/usuarios'
import { FluxoModeloResumo, FluxoModeloDetalhe, FluxoEtapa } from '@/types/fluxos'
import { OportunidadeResumo } from '@/types/oportunidades'
import { UserProfile, Equipe } from '@/types/usuarios'
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
  Kanban,
  RefreshCw,
  Filter,
  User,
  Users2,
  Clock,
  ArrowRight,
  GitBranch,
  Building2,
  Briefcase,
} from 'lucide-react'
import { formatCurrencyBRL } from '@/components/NewOpportunityModal'

export default function Quadro() {
  const navigate = useNavigate()

  // Estados principais
  const [modelos, setModelos] = useState<FluxoModeloResumo[]>([])
  const [selectedModeloId, setSelectedModeloId] = useState<string>('')
  const [modeloDetalhe, setModeloDetalhe] = useState<FluxoModeloDetalhe | null>(null)
  const [oportunidades, setOportunidades] = useState<OportunidadeResumo[]>([])

  // Filtros
  const [usuarios, setUsuarios] = useState<UserProfile[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>('todos')
  const [filtroEquipe, setFiltroEquipe] = useState<string>('todas')

  // Loading e erros
  const [loadingModelos, setLoadingModelos] = useState(true)
  const [loadingQuadro, setLoadingQuadro] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 1. Carregar lista de modelos ativos e dados auxiliares de usuários/equipes
  useEffect(() => {
    async function init() {
      setLoadingModelos(true)
      try {
        const [modRes, userRes, eqRes] = await Promise.all([
          getFluxoModelos(),
          getUsersWithEquipes(),
          getEquipes(),
        ])

        if (userRes.data) setUsuarios(userRes.data)
        if (eqRes.data) setEquipes(eqRes.data)

        if (modRes.data && modRes.data.length > 0) {
          // Filtrar apenas modelos ativos
          const ativos = modRes.data.filter((m) => m.situacao === 'ativo')
          setModelos(ativos)
          if (ativos.length > 0) {
            setSelectedModeloId(ativos[0].id)
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao carregar modelos de fluxo'
        setError(msg)
      } finally {
        setLoadingModelos(false)
      }
    }
    init()
  }, [])

  // 2. Carregar etapas do modelo selecionado e as oportunidades correspondentes
  const fetchQuadro = useCallback(async () => {
    if (!selectedModeloId) return

    setLoadingQuadro(true)
    setError(null)
    try {
      const [detalheRes, oppsRes] = await Promise.all([
        getFluxoModeloById(selectedModeloId),
        getOportunidades({
          fluxoModeloId: selectedModeloId,
          responsavelId: filtroResponsavel,
          equipeId: filtroEquipe,
        }),
      ])

      if (detalheRes.error) {
        throw detalheRes.error
      }
      if (oppsRes.error) {
        throw new Error(oppsRes.error)
      }

      setModeloDetalhe(detalheRes.data)
      setOportunidades(oppsRes.data || [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar quadro'
      setError(msg)
    } finally {
      setLoadingQuadro(false)
    }
  }, [selectedModeloId, filtroResponsavel, filtroEquipe])

  useEffect(() => {
    fetchQuadro()
  }, [fetchQuadro])

  // Regra do Quadro:
  // Cartões = oportunidades EM ANDAMENTO (situação "Em andamento" ou "Ganha — em finalização")
  // cuja etapa atual corresponde àquela etapa do modelo (corresponder por ordem da etapa)
  const oppsEmAndamento = useMemo(() => {
    return oportunidades.filter(
      (opp) => opp.situacao === 'Em andamento' || opp.situacao === 'Ganha — em finalização',
    )
  }, [oportunidades])

  // Agrupar oportunidades por ordem da etapa atual
  const oppsPorOrdemEtapa = useMemo(() => {
    const mapa = new Map<number, OportunidadeResumo[]>()
    for (const opp of oppsEmAndamento) {
      const ordem = opp.etapa_atual_ordem ?? 1
      const lista = mapa.get(ordem) || []
      lista.push(opp)
      mapa.set(ordem, lista)
    }
    return mapa
  }, [oppsEmAndamento])

  // Se o carregamento inicial de modelos estiver ocorrendo
  if (loadingModelos) {
    return (
      <PageStateLayout
        title="Quadro"
        subtitle="Carregando modelos de fluxo de trabalho..."
        icon={Kanban}
        emptyMessage=""
        status="loading"
      />
    )
  }

  // Se não houver nenhum modelo de fluxo ativo cadastrado
  if (modelos.length === 0) {
    return (
      <PageStateLayout
        title="Quadro"
        subtitle="Visualização do pipeline comercial por etapas do fluxo."
        icon={Kanban}
        emptyMessage="Nenhum modelo de fluxo ativo encontrado. Cadastre ou ative um fluxo na página de Fluxos."
        actionLabel="Ir para Fluxos"
        onAction={() => navigate('/fluxos')}
        status="empty"
      />
    )
  }

  const etapas = modeloDetalhe?.etapas || []

  return (
    <div className="space-y-6 animate-fade-in flex flex-col h-[calc(100vh-8.5rem)]">
      {/* Topo: Título + Seletor de Modelo de Fluxo + Filtros */}
      <div className="flex flex-col gap-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0C2D48] tracking-tight flex items-center gap-2.5">
              <Kanban className="w-7 h-7 text-teal-600" />
              <span>Quadro de oportunidades</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Acompanhe visualmente a distribuição de oportunidades ativas em cada etapa do fluxo.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchQuadro}
            disabled={loadingQuadro}
            className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingQuadro ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        </div>

        {/* Barra de Filtros e Seleção do Modelo */}
        <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
          <CardContent className="p-3.5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Seletor de Modelo */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 max-w-xl">
              <span className="text-xs font-bold text-[#0C2D48] flex items-center gap-1.5 whitespace-nowrap">
                <GitBranch className="w-4 h-4 text-teal-600" />
                <span>Modelo de fluxo:</span>
              </span>
              <Select value={selectedModeloId} onValueChange={setSelectedModeloId}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-medium border-slate-200 bg-slate-50/50">
                  <SelectValue placeholder="Selecione um modelo de fluxo" />
                </SelectTrigger>
                <SelectContent>
                  {modelos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} {m.is_generico ? '(Padrão geral)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtros por Responsável Comercial e Equipe */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Responsável Comercial */}
              <div className="w-full sm:w-[190px]">
                <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
                  <SelectTrigger className="h-9 rounded-xl text-xs border-slate-200 bg-slate-50/50">
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os consultores</SelectItem>
                    {usuarios.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Equipe */}
              <div className="w-full sm:w-[170px]">
                <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
                  <SelectTrigger className="h-9 rounded-xl text-xs border-slate-200 bg-slate-50/50">
                    <SelectValue placeholder="Equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as equipes</SelectItem>
                    {equipes.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Total no quadro */}
              <div className="hidden lg:flex items-center px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-bold whitespace-nowrap">
                Total ativas: {oppsEmAndamento.length}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Erro */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchQuadro} className="h-7 text-xs">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Área do Kanban com Rolagem Horizontal no Desktop e Empilhado/Rolável no Mobile */}
      <div className="flex-1 min-h-0 overflow-x-auto pb-4 pt-1">
        {loadingQuadro && !modeloDetalhe ? (
          <div className="h-full flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
          </div>
        ) : etapas.length === 0 ? (
          <Card className="border border-dashed border-slate-200 p-12 text-center rounded-2xl bg-white">
            <p className="text-sm font-semibold text-[#0C2D48]">
              Este modelo não possui etapas configuradas.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col md:flex-row gap-4 h-full min-w-full md:w-max">
            {etapas.map((etapa) => {
              const oppsEtapa = oppsPorOrdemEtapa.get(etapa.ordem) || []
              const totalValorEtapa = oppsEtapa.reduce((acc, o) => acc + (o.valor_estimado || 0), 0)

              return (
                <div
                  key={etapa.id}
                  className="w-full md:w-[320px] flex-shrink-0 flex flex-col bg-slate-100/80 rounded-2xl border border-slate-200/70 p-3 max-h-[75vh] md:max-h-full"
                >
                  {/* Cabeçalho da Coluna (Etapa) */}
                  <div className="mb-2.5 px-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {etapa.ordem}
                        </span>
                        <h3
                          className="font-bold text-xs sm:text-sm text-[#0C2D48] truncate"
                          title={etapa.nome}
                        >
                          {etapa.nome}
                        </h3>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-white text-slate-700 border border-slate-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      >
                        {oppsEtapa.length}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 px-0.5">
                      <span>{formatCurrencyBRL(totalValorEtapa)}</span>
                      {etapa.is_etapa_ganho && (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          Ganho
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lista de Cartões da Etapa */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {oppsEtapa.length === 0 ? (
                      <div className="h-28 flex items-center justify-center border border-dashed border-slate-200 rounded-xl bg-white/50 text-slate-400 text-xs">
                        Nenhuma oportunidade
                      </div>
                    ) : (
                      oppsEtapa.map((opp) => (
                        <Card
                          key={opp.id}
                          onClick={() => navigate(`/oportunidades/${opp.id}`)}
                          className="border border-slate-200/90 bg-white hover:border-teal-400 hover:shadow-md transition-all rounded-xl cursor-pointer group shadow-2xs"
                        >
                          <CardContent className="p-3.5 space-y-2">
                            {/* Topo do Card: Protocolo e Dias na Etapa */}
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-900 border border-teal-200">
                                {opp.protocolo}
                              </span>

                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  (opp.dias_na_etapa ?? 0) >= 3
                                    ? 'bg-amber-100 text-amber-900 font-bold'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                                title={`Tempo nesta etapa: ${opp.dias_na_etapa ?? 0} dias`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                <span>
                                  {opp.dias_na_etapa === 0
                                    ? 'Hoje'
                                    : opp.dias_na_etapa === 1
                                      ? '1d'
                                      : `${opp.dias_na_etapa}d`}
                                </span>
                              </span>
                            </div>

                            {/* Cliente */}
                            <div className="font-bold text-xs sm:text-sm text-[#0C2D48] group-hover:text-teal-700 transition-colors line-clamp-1">
                              {opp.cliente_nome}
                            </div>

                            {/* Produto */}
                            <div className="text-[11px] text-slate-500 truncate">
                              {opp.produto_nome}
                              {opp.seguradora_nome ? ` • ${opp.seguradora_nome}` : ''}
                            </div>

                            {/* Rodapé: Responsável e Valor Estimado */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                              <div
                                className="flex items-center gap-1 text-[11px] text-slate-600 truncate max-w-[130px]"
                                title={opp.responsavel_comercial_nome}
                              >
                                <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{opp.responsavel_comercial_nome}</span>
                              </div>

                              <div className="font-bold text-xs text-teal-700 whitespace-nowrap">
                                {formatCurrencyBRL(opp.valor_estimado)}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
