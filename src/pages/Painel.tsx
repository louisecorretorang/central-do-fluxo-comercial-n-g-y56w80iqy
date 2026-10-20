import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getOportunidades } from '@/services/oportunidades'
import { getEquipes } from '@/services/usuarios'
import { getMotivosCatalogo } from '@/services/catalogo'
import { supabase } from '@/lib/supabase/client'
import { OportunidadeResumo } from '@/types/oportunidades'
import { Equipe } from '@/types/usuarios'
import { MotivoCatalogo } from '@/types/catalogo'
import PageStateLayout from '@/components/PageStateLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Users2,
  Calendar,
  Layers,
  Award,
  AlertTriangle,
  ArrowRight,
  Filter,
} from 'lucide-react'
import { formatCurrencyBRL } from '@/components/NewOpportunityModal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export default function Painel() {
  const navigate = useNavigate()

  // Estados dos filtros
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [selectedEquipe, setSelectedEquipe] = useState<string>('todas')

  // Período: mês/ano atual como padrão
  const currentDate = new Date()
  const currentAno = currentDate.getFullYear()
  const currentMes = currentDate.getMonth() + 1 // 1 a 12

  const [selectedAno, setSelectedAno] = useState<number>(currentAno)
  const [selectedMes, setSelectedMes] = useState<number>(currentMes)

  // Dados carregados
  const [oportunidades, setOportunidades] = useState<OportunidadeResumo[]>([])
  const [motivosCatalogo, setMotivosCatalogo] = useState<MotivoCatalogo[]>([])
  const [timelineItems, setTimelineItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Carregar equipes e motivos
  useEffect(() => {
    async function init() {
      const [eqRes, motRes] = await Promise.all([getEquipes(), getMotivosCatalogo()])
      if (eqRes.data) setEquipes(eqRes.data)
      if (motRes.data) setMotivosCatalogo(motRes.data)
    }
    init()
  }, [])

  // Buscar dados consolidados
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Buscar todas as oportunidades visíveis pelo usuário
      const res = await getOportunidades({
        equipeId: selectedEquipe !== 'todas' ? selectedEquipe : undefined,
      })

      if (res.error) {
        throw new Error(res.error)
      }
      setOportunidades(res.data || [])

      // 2. Buscar itens da linha do tempo com eventos de ganho ou perda
      // Filtrados pelo período selecionado
      const dataInicioMes = new Date(Date.UTC(selectedAno, selectedMes - 1, 1, 0, 0, 0))
      const dataFimMes = new Date(Date.UTC(selectedAno, selectedMes, 0, 23, 59, 59, 999))

      const { data: timelineData, error: timelineErr } = await db
        .from('oportunidades_linha_tempo')
        .select('id, oportunidade_id, titulo, descricao, metadados, created_at')
        .gte('created_at', dataInicioMes.toISOString())
        .lte('created_at', dataFimMes.toISOString())

      if (!timelineErr && timelineData) {
        setTimelineItems(timelineData)
      } else {
        setTimelineItems([])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar métricas do painel.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [selectedEquipe, selectedAno, selectedMes])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtrar oportunidades pela equipe selecionada (redundância de segurança)
  const oppsFiltradas = useMemo(() => {
    if (selectedEquipe === 'todas') return oportunidades
    return oportunidades.filter((o) => o.equipe_id === selectedEquipe)
  }, [oportunidades, selectedEquipe])

  // =========================================================================
  // 1. Oportunidades EM ANDAMENTO (por etapa e por responsável comercial)
  // =========================================================================
  const oppsEmAndamento = useMemo(() => {
    return oppsFiltradas.filter(
      (o) => o.situacao === 'Em andamento' || o.situacao === 'Ganha — em finalização',
    )
  }, [oppsFiltradas])

  // Contagem por Etapa Atual
  const porEtapa = useMemo(() => {
    const map = new Map<string, { nome: string; count: number; totalValor: number }>()
    for (const opp of oppsEmAndamento) {
      const etapaNome = opp.etapa_atual_nome || 'Sem etapa definida'
      const curr = map.get(etapaNome) || { nome: etapaNome, count: 0, totalValor: 0 }
      curr.count += 1
      curr.totalValor += opp.valor_estimado || 0
      map.set(etapaNome, curr)
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [oppsEmAndamento])

  // Contagem por Responsável Comercial
  const porResponsavel = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; count: number; totalValor: number }>()
    for (const opp of oppsEmAndamento) {
      const respId = opp.responsavel_comercial_id
      const respNome = opp.responsavel_comercial_nome || 'Não atribuído'
      const curr = map.get(respId) || { id: respId, nome: respNome, count: 0, totalValor: 0 }
      curr.count += 1
      curr.totalValor += opp.valor_estimado || 0
      map.set(respId, curr)
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [oppsEmAndamento])

  // =========================================================================
  // 2. Ganhas e Perdidas no MÊS Selecionado
  // Ganhas: quantidade e valor fechado (se valor_fechado estiver vazio, usa o estimado)
  // Perdidas: quantidade e motivos a partir do novo campo motivo da perda (motivo_perda_id / motivo_perda_nome)
  // =========================================================================
  const metricasMes = useMemo(() => {
    const oppIdsFiltradas = new Set(oppsFiltradas.map((o) => o.id))
    const oppsMap = new Map(oppsFiltradas.map((o) => [o.id, o]))

    // Identificar eventos de ganho e perda da timeline no mês
    let qtdGanhas = 0
    let valorGanhas = 0
    let qtdPerdidas = 0
    let valorPerdidas = 0

    // Para evitar duplicidade de contagem por oportunidade se houve múltiplos eventos
    const ganhasIds = new Set<string>()
    const perdidasIds = new Set<string>()
    const motivosPerdaContagem = new Map<string, number>()

    for (const item of timelineItems) {
      if (!oppIdsFiltradas.has(item.oportunidade_id)) continue

      const opp = oppsMap.get(item.oportunidade_id)
      const meta = item.metadados || {}
      const titulo = item.titulo || ''

      // Checar se é evento de ganho
      if (
        titulo.includes('Fechamento confirmado') ||
        titulo.includes('Ganha') ||
        meta.valor_fechado !== undefined
      ) {
        if (!ganhasIds.has(item.oportunidade_id)) {
          ganhasIds.add(item.oportunidade_id)
          qtdGanhas += 1
          // Valor fechado da oportunidade; se vazio, usa valor_estimado
          const vFechado =
            opp?.valor_fechado !== null && opp?.valor_fechado !== undefined
              ? Number(opp.valor_fechado)
              : Number(meta.valor_fechado) || (opp && Number(opp.valor_estimado)) || 0
          valorGanhas += vFechado
        }
      }

      // Checar se é evento de perda
      if (
        titulo.includes('Perdida') ||
        meta.motivo_id !== undefined ||
        meta.motivo_nome !== undefined
      ) {
        if (!perdidasIds.has(item.oportunidade_id)) {
          perdidasIds.add(item.oportunidade_id)
          qtdPerdidas += 1
          const vEstimado = (opp && Number(opp.valor_estimado)) || 0
          valorPerdidas += vEstimado

          // Contar a partir do novo campo motivo da perda da oportunidade (ou fallback para linha do tempo)
          const motivoNome =
            opp?.motivo_perda_nome || (meta.motivo_nome as string) || 'Outro / Não especificado'
          motivosPerdaContagem.set(motivoNome, (motivosPerdaContagem.get(motivoNome) || 0) + 1)
        }
      }
    }

    // Complementar com oportunidades cuja updated_at está dentro do mês e situação é Ganha ou Perdida
    for (const opp of oppsFiltradas) {
      const upDate = new Date(opp.updated_at)
      const pertenceAoMes =
        upDate.getUTCFullYear() === selectedAno && upDate.getUTCMonth() + 1 === selectedMes

      if (pertenceAoMes) {
        if (
          (opp.situacao === 'Ganha' || opp.situacao === 'Ganha — em finalização') &&
          !ganhasIds.has(opp.id)
        ) {
          ganhasIds.add(opp.id)
          qtdGanhas += 1
          const vFechado =
            opp.valor_fechado !== null && opp.valor_fechado !== undefined
              ? Number(opp.valor_fechado)
              : Number(opp.valor_estimado) || 0
          valorGanhas += vFechado
        } else if (opp.situacao === 'Perdida' && !perdidasIds.has(opp.id)) {
          perdidasIds.add(opp.id)
          qtdPerdidas += 1
          valorPerdidas += opp.valor_estimado || 0

          const motivoNome = opp.motivo_perda_nome || 'Outro / Não especificado'
          motivosPerdaContagem.set(motivoNome, (motivosPerdaContagem.get(motivoNome) || 0) + 1)
        }
      }
    }

    // Ranking de Motivos de Perda
    const rankingMotivos = Array.from(motivosPerdaContagem.entries())
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count)

    return {
      qtdGanhas,
      valorGanhas,
      qtdPerdidas,
      valorPerdidas,
      rankingMotivos,
    }
  }, [oppsFiltradas, timelineItems, selectedAno, selectedMes])

  // Opções de Meses
  const MESES_OPCOES = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ]

  const maxEtapaCount = Math.max(1, ...porEtapa.map((e) => e.count))
  const maxRespCount = Math.max(1, ...porResponsavel.map((r) => r.count))
  const maxMotivoCount = Math.max(1, ...metricasMes.rankingMotivos.map((m) => m.count))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Topo com Título, Subtítulo e Filtros Globais */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0C2D48] tracking-tight flex items-center gap-2.5">
            <LayoutDashboard className="w-7 h-7 text-teal-600" />
            <span>Painel comercial</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Indicadores de desempenho, distribuição do funil e motivos de fechamento.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="h-10 px-3.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar dados</span>
        </Button>
      </div>

      {/* Barra de Filtros: Equipe e Período (Mês / Ano) */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0C2D48]">
              <Filter className="w-4 h-4 text-slate-400" />
              <span>Filtros do painel:</span>
            </div>

            {/* Filtro de Equipe */}
            <div className="w-full sm:w-[200px]">
              <Select value={selectedEquipe} onValueChange={setSelectedEquipe}>
                <SelectTrigger className="h-9 rounded-xl text-xs border-slate-200 bg-slate-50/50">
                  <SelectValue placeholder="Todas as equipes" />
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

            {/* Filtro de Mês */}
            <div className="w-[140px]">
              <Select
                value={String(selectedMes)}
                onValueChange={(val) => setSelectedMes(Number(val))}
              >
                <SelectTrigger className="h-9 rounded-xl text-xs border-slate-200 bg-slate-50/50">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {MESES_OPCOES.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Ano */}
            <div className="w-[100px]">
              <Select
                value={String(selectedAno)}
                onValueChange={(val) => setSelectedAno(Number(val))}
              >
                <SelectTrigger className="h-9 rounded-xl text-xs border-slate-200 bg-slate-50/50">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {[currentAno - 1, currentAno, currentAno + 1].map((ano) => (
                    <SelectItem key={ano} value={String(ano)}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Período:{' '}
            <span className="font-bold text-[#0C2D48]">
              {MESES_OPCOES.find((m) => m.value === selectedMes)?.label}/{selectedAno}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Erro inline se houver */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchData} className="h-8 text-xs">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* =========================================================================
          CARDS DE RESUMO DO MÊS: GANHAS vs PERDIDAS
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total em Andamento */}
        <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Em andamento</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#0C2D48] mt-2">{oppsEmAndamento.length}</div>
            <div className="text-xs text-slate-500 mt-1">
              {formatCurrencyBRL(
                oppsEmAndamento.reduce((acc, o) => acc + (o.valor_estimado || 0), 0),
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ganhas no Mês */}
        <Card className="border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/40 rounded-2xl shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800">Ganhas no mês</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2">{metricasMes.qtdGanhas}</div>
            <div className="text-xs font-semibold text-emerald-900 mt-1">
              {formatCurrencyBRL(metricasMes.valorGanhas)} fechados
            </div>
          </CardContent>
        </Card>

        {/* Perdidas no Mês */}
        <Card className="border border-rose-200/80 bg-gradient-to-br from-white to-rose-50/40 rounded-2xl shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-800">Perdidas no mês</span>
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-700 mt-2">{metricasMes.qtdPerdidas}</div>
            <div className="text-xs font-semibold text-rose-900 mt-1">
              {formatCurrencyBRL(metricasMes.valorPerdidas)} estimados
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Conversão do Mês */}
        <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Taxa de conversão</span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#0C2D48] mt-2">
              {metricasMes.qtdGanhas + metricasMes.qtdPerdidas > 0
                ? `${Math.round(
                    (metricasMes.qtdGanhas / (metricasMes.qtdGanhas + metricasMes.qtdPerdidas)) *
                      100,
                  )}%`
                : '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {metricasMes.qtdGanhas + metricasMes.qtdPerdidas} desfechos no mês
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =========================================================================
          GRÁFICOS E DISTRIBUIÇÃO
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1) OPORTUNIDADES EM ANDAMENTO POR ETAPA */}
        <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-sm sm:text-base font-bold text-[#0C2D48] flex items-center justify-between">
              <span>Em andamento por etapa</span>
              <Badge variant="outline" className="text-xs font-bold text-teal-800 bg-teal-50">
                {oppsEmAndamento.length} oportunidades
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {porEtapa.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                Nenhuma oportunidade ativa no momento.
              </p>
            ) : (
              porEtapa.map((etapa) => {
                const percent = Math.round((etapa.count / maxEtapaCount) * 100)
                return (
                  <div key={etapa.nome} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 truncate max-w-[220px]">
                        {etapa.nome}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-[11px]">
                          {formatCurrencyBRL(etapa.totalValor)}
                        </span>
                        <span className="font-bold text-[#0C2D48] w-6 text-right">
                          {etapa.count}
                        </span>
                      </div>
                    </div>
                    {/* Barra de Progresso Simples */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-600 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* 2) OPORTUNIDADES EM ANDAMENTO POR RESPONSÁVEL COMERCIAL */}
        <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-sm sm:text-base font-bold text-[#0C2D48] flex items-center justify-between">
              <span>Em andamento por responsável comercial</span>
              <Badge variant="outline" className="text-xs font-bold text-teal-800 bg-teal-50">
                {porResponsavel.length} consultores
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {porResponsavel.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                Nenhum responsável comercial atribuído a oportunidades ativas.
              </p>
            ) : (
              porResponsavel.map((resp) => {
                const percent = Math.round((resp.count / maxRespCount) * 100)
                return (
                  <div key={resp.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 truncate max-w-[220px]">
                        {resp.nome}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-[11px]">
                          {formatCurrencyBRL(resp.totalValor)}
                        </span>
                        <span className="font-bold text-[#0C2D48] w-6 text-right">
                          {resp.count}
                        </span>
                      </div>
                    </div>
                    {/* Barra de Progresso Simples */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0C2D48] rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* =========================================================================
          3) PRINCIPAIS MOTIVOS DE PERDA DO MÊS
         ========================================================================= */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <CardTitle className="text-sm sm:text-base font-bold text-[#0C2D48] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Principais motivos de perda do mês</span>
            </div>
            <span className="text-xs text-slate-400 font-normal">
              {metricasMes.qtdPerdidas} perda(s) registrada(s)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {metricasMes.rankingMotivos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-slate-500 font-medium">
                Nenhuma oportunidade perdida registrada neste mês.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {metricasMes.rankingMotivos.map((motivo, index) => {
                const percent = Math.round((motivo.count / maxMotivoCount) * 100)
                return (
                  <div key={motivo.nome} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="font-semibold text-slate-700 truncate">{motivo.nome}</span>
                      </div>
                      <span className="font-bold text-rose-700">{motivo.count}</span>
                    </div>
                    {/* Barra de Perda */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
