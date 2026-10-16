import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { getFluxoModelos, getFluxoModeloById } from '@/services/fluxos'
import {
  FluxoModeloResumo,
  FluxoModeloDetalhe,
  FluxoEtapa,
  ChecklistItem,
  FluxoEtapaTipo,
  ChecklistItemTipo,
  ChecklistCampoFormato,
} from '@/types/fluxos'
import PageStateLayout from '@/components/PageStateLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Sparkles,
  Search,
  RefreshCw,
  GitFork,
  ArrowRight,
  Clock,
  UserCheck,
  Users2,
  Trophy,
  FileText,
  FormInput,
  CheckSquare,
  ShieldCheck,
  Building2,
  Package,
  Layers,
  ChevronRight,
  Info,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Calendar,
  Hash,
  DollarSign,
  ToggleLeft,
  ListFilter,
  Eye,
} from 'lucide-react'

export default function Fluxos() {
  const [modelos, setModelos] = useState<FluxoModeloResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Estado do modal de detalhes do modelo
  const [selectedModeloId, setSelectedModeloId] = useState<string | null>(null)
  const [modeloDetalhe, setModeloDetalhe] = useState<FluxoModeloDetalhe | null>(null)
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [errorDetalhe, setErrorDetalhe] = useState<string | null>(null)
  const [filtroEtapaTipo, setFiltroEtapaTipo] = useState<string>('todos')

  const fetchModelos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getFluxoModelos()
      if (res.error) {
        throw res.error
      }
      setModelos(res.data || [])
    } catch (err: unknown) {
      console.error('Erro ao carregar modelos de fluxo:', err)
      setError('Não foi possível carregar os modelos de fluxo. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModelos()
  }, [fetchModelos])

  // Abre e carrega os detalhes completos do modelo selecionado
  const handleOpenDetalhes = async (id: string) => {
    setSelectedModeloId(id)
    setLoadingDetalhe(true)
    setErrorDetalhe(null)
    setFiltroEtapaTipo('todos')
    try {
      const res = await getFluxoModeloById(id)
      if (res.error) {
        throw res.error
      }
      setModeloDetalhe(res.data)
    } catch (err: unknown) {
      console.error('Erro ao carregar detalhe do fluxo:', err)
      setErrorDetalhe('Não foi possível carregar as etapas deste modelo. Tente novamente.')
    } finally {
      setLoadingDetalhe(false)
    }
  }

  const handleCloseDetalhes = () => {
    setSelectedModeloId(null)
    setModeloDetalhe(null)
    setErrorDetalhe(null)
  }

  // Filtragem da lista principal por busca
  const filteredModelos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return modelos
    return modelos.filter((m) => {
      const nome = m.nome.toLowerCase()
      const produto = (m.produto_nome || '').toLowerCase()
      const seguradora = (m.seguradora_nome || '').toLowerCase()
      const desc = (m.descricao || '').toLowerCase()
      return (
        nome.includes(term) ||
        produto.includes(term) ||
        seguradora.includes(term) ||
        desc.includes(term)
      )
    })
  }, [modelos, searchTerm])

  // Etapas filtradas no detalhe (se usuário filtrar por tipo)
  const etapasFiltradas = useMemo(() => {
    if (!modeloDetalhe?.etapas) return []
    if (filtroEtapaTipo === 'todos') return modeloDetalhe.etapas
    return modeloDetalhe.etapas.filter((e) => e.tipo === filtroEtapaTipo)
  }, [modeloDetalhe, filtroEtapaTipo])

  // Helpers visuais para Etapas
  const getEtapaTipoBadge = (tipo: FluxoEtapaTipo) => {
    switch (tipo) {
      case 'Trabalho interno':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            Trabalho interno
          </span>
        )
      case 'Aguardando cliente':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Aguardando cliente
          </span>
        )
      case 'Aguardando seguradora':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-900 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-200">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            Aguardando seguradora
          </span>
        )
    }
  }

  // Helpers visuais para Checklist
  const getChecklistItemBadge = (tipo: ChecklistItemTipo) => {
    switch (tipo) {
      case 'Documento':
        return (
          <Badge className="bg-purple-50 text-purple-800 hover:bg-purple-50 border-purple-200 font-semibold text-[11px] gap-1 px-2 py-0.5">
            <FileText className="w-3 h-3 text-purple-600" />
            Documento
          </Badge>
        )
      case 'Informação':
        return (
          <Badge className="bg-blue-50 text-blue-800 hover:bg-blue-50 border-blue-200 font-semibold text-[11px] gap-1 px-2 py-0.5">
            <FormInput className="w-3 h-3 text-blue-600" />
            Informação
          </Badge>
        )
      case 'Confirmação':
        return (
          <Badge className="bg-emerald-50 text-emerald-800 hover:bg-emerald-50 border-emerald-200 font-semibold text-[11px] gap-1 px-2 py-0.5">
            <CheckSquare className="w-3 h-3 text-emerald-600" />
            Confirmação
          </Badge>
        )
    }
  }

  const getFormatoBadge = (formato: ChecklistCampoFormato | null) => {
    if (!formato) return null
    switch (formato) {
      case 'texto':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
            <FileText className="w-3 h-3 text-slate-500" />
            Texto
          </span>
        )
      case 'número':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
            <Hash className="w-3 h-3 text-slate-500" />
            Número
          </span>
        )
      case 'valor':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
            <DollarSign className="w-3 h-3 text-emerald-600" />
            Valor em R$
          </span>
        )
      case 'data':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-medium">
            <Calendar className="w-3 h-3 text-indigo-600" />
            Data
          </span>
        )
      case 'sim_nao':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
            <ToggleLeft className="w-3 h-3 text-amber-600" />
            Sim / Não
          </span>
        )
      case 'opções':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 font-medium">
            <ListFilter className="w-3 h-3 text-cyan-600" />
            Lista de opções
          </span>
        )
    }
  }

  // Estado: Carregando principal
  if (loading && modelos.length === 0) {
    return (
      <PageStateLayout
        title="Modelos de Fluxo"
        subtitle="Configurações > Fluxos de oportunidade comercial, etapas e checklists."
        icon={GitFork}
        emptyMessage=""
        status="loading"
      />
    )
  }

  // Estado: Erro principal
  if (error && modelos.length === 0) {
    return (
      <PageStateLayout
        title="Modelos de Fluxo"
        subtitle="Configurações > Fluxos de oportunidade comercial, etapas e checklists."
        icon={GitFork}
        emptyMessage=""
        status="error"
        onRetry={fetchModelos}
      />
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho da página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">
            <span>Configurações</span>
            <span>&rsaquo;</span>
            <span>Fluxos</span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-[28px] font-bold text-[#0C2D48] tracking-tight">
              Modelos de Fluxo
            </h1>
            <Badge className="bg-[#0C2D48] text-white border-none text-[11px] font-semibold">
              Somente Administrador
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            O coração do sistema comercial: define quais etapas cada oportunidade percorre e as
            tarefas necessárias em cada fase.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchModelos}
            disabled={loading}
            className="h-10 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
            title="Atualizar modelos de fluxo"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Alerta de consulta (sem edição) */}
      <div className="p-3.5 rounded-xl bg-slate-100/80 border border-slate-200/80 text-slate-700 text-xs flex items-start sm:items-center gap-2.5">
        <Info className="w-4 h-4 text-teal-700 flex-shrink-0 mt-0.5 sm:mt-0" />
        <span className="leading-relaxed">
          Página em modo de <strong>somente consulta</strong>. Clique em qualquer modelo abaixo para
          visualizar a trilha completa de etapas, responsáveis, prazos sugeridos e itens de
          checklist.
        </span>
      </div>

      {/* Campo de busca */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            placeholder="Filtrar por nome, produto ou seguradora..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10 pr-4 rounded-xl text-sm border-slate-200 bg-white shadow-xs focus-visible:ring-2 focus-visible:ring-teal-600"
          />
        </div>

        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-teal-700 hover:underline font-medium text-xs self-center"
          >
            Limpar filtro
          </button>
        )}
      </div>

      {/* Grid de Modelos de Fluxo */}
      {filteredModelos.length === 0 ? (
        <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs p-12 text-center">
          <GitFork className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#0C2D48]">
            {searchTerm
              ? 'Nenhum modelo de fluxo encontrado para o filtro informado.'
              : 'Nenhum modelo de fluxo cadastrado.'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchTerm
              ? 'Tente buscar por termos mais genéricos como "seguro" ou "genérico".'
              : 'Os modelos de fluxo cadastrados pelo administrador aparecerão aqui.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredModelos.map((modelo) => {
            const isGenerico = modelo.is_generico
            return (
              <Card
                key={modelo.id}
                className="group relative border border-slate-200/90 hover:border-teal-400/80 bg-white rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
                onClick={() => handleOpenDetalhes(modelo.id)}
              >
                {/* Linha superior de destaque colorido */}
                <div
                  className={`h-1.5 w-full ${
                    isGenerico
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-400'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-500'
                  }`}
                />

                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isGenerico
                            ? 'bg-teal-50 text-teal-700 border border-teal-200/70'
                            : 'bg-blue-50 text-blue-700 border border-blue-200/70'
                        }`}
                      >
                        <GitFork className="w-5 h-5 stroke-[2.2]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base sm:text-lg font-bold text-[#0C2D48] group-hover:text-teal-700 transition-colors">
                            {modelo.nome}
                          </CardTitle>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Versão {modelo.versao} &bull;{' '}
                          {modelo.total_etapas !== undefined
                            ? `${modelo.total_etapas} etapas`
                            : 'Etapas configuradas'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {modelo.situacao === 'ativo' ? (
                        <Badge className="bg-emerald-50 text-emerald-800 hover:bg-emerald-50 border-emerald-200 font-semibold text-[11px] gap-1 px-2.5 py-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-300 font-medium text-[11px] gap-1 px-2.5 py-0.5">
                          <XCircle className="w-3 h-3 text-slate-400" />
                          Inativo
                        </Badge>
                      )}

                      {isGenerico && (
                        <Badge className="bg-teal-50 text-teal-900 border-teal-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 mt-0.5">
                          Fluxo genérico
                        </Badge>
                      )}
                    </div>
                  </div>

                  {modelo.descricao && (
                    <CardDescription className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                      {modelo.descricao}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="p-5 pt-2 flex-1 flex flex-col justify-between">
                  {/* Bloco de Metadados: Produto e Seguradora */}
                  <div className="space-y-2 py-3 border-y border-slate-100 text-xs">
                    {/* Linha do Produto */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                        Produto:
                      </span>
                      <span className="font-semibold text-slate-800 text-right">
                        {modelo.produto_nome ? (
                          modelo.produto_nome
                        ) : (
                          <span className="italic text-teal-800 font-medium bg-teal-50/70 px-2 py-0.5 rounded border border-teal-100">
                            Qualquer produto sem fluxo próprio
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Linha da Seguradora */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        Seguradora:
                      </span>
                      <span className="font-semibold text-slate-800 text-right">
                        {modelo.seguradora_nome ? (
                          modelo.seguradora_nome
                        ) : (
                          <span className="italic text-slate-600 font-normal bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                            Vale para qualquer seguradora
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Rodapé do Card com CTA visual */}
                  <div className="pt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-teal-600" />
                      Visualizar etapas e checklist
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-teal-700 group-hover:text-teal-800 group-hover:translate-x-0.5 transition-all">
                      Abrir detalhes
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ========================================================
          MODAL DE DETALHES COMPLETOS DO MODELO DE FLUXO
         ======================================================== */}
      <Dialog open={!!selectedModeloId} onOpenChange={(open) => !open && handleCloseDetalhes()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-slate-200">
          {/* Cabeçalho do Modal */}
          <DialogHeader className="p-6 pb-4 border-b border-slate-200/80 bg-slate-50/70 sticky top-0 z-10 backdrop-blur-sm">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase tracking-wider">
                <span>Configurações</span>
                <span>&rsaquo;</span>
                <span>Modelos de Fluxo</span>
                <span>&rsaquo;</span>
                <span>Visualização</span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-800 border border-teal-200 flex items-center justify-center flex-shrink-0">
                    <GitFork className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl sm:text-2xl font-bold text-[#0C2D48]">
                      {modeloDetalhe?.nome || 'Carregando modelo...'}
                    </DialogTitle>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {modeloDetalhe?.is_generico && (
                        <Badge className="bg-teal-50 text-teal-900 border-teal-200 font-bold text-[10px] uppercase tracking-wider">
                          Fluxo genérico
                        </Badge>
                      )}
                      <span className="text-xs text-slate-500 font-medium">
                        Versão {modeloDetalhe?.versao ?? 1}
                      </span>
                      <span className="text-slate-300">&bull;</span>
                      <span className="text-xs text-slate-500 font-medium">
                        Situação: {modeloDetalhe?.situacao === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Descrição e escopo */}
              {modeloDetalhe && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-700">
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200/70">
                    <Package className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span className="text-slate-500 font-medium">Produto:</span>
                    <span className="font-semibold text-slate-900">
                      {modeloDetalhe.produto_nome || 'Qualquer produto (fluxo genérico)'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200/70">
                    <Building2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span className="text-slate-500 font-medium">Seguradora:</span>
                    <span className="font-semibold text-slate-900">
                      {modeloDetalhe.seguradora_nome ||
                        'Vale para qualquer seguradora deste produto'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Conteúdo do Modal: Lista de Etapas e seus Itens */}
          <div className="p-6 space-y-6">
            {loadingDetalhe && (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
                <p className="text-sm font-semibold text-[#0C2D48]">
                  Carregando etapas e checklist...
                </p>
              </div>
            )}

            {errorDetalhe && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
                <span>{errorDetalhe}</span>
              </div>
            )}

            {!loadingDetalhe && modeloDetalhe && (
              <>
                {/* Barra de resumo com total de etapas e filtro rápido */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#0C2D48]">
                      Etapas em ordem sequencial ({modeloDetalhe.etapas.length})
                    </h3>
                  </div>

                  {/* Filtro simples por tipo de etapa */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="text-slate-500 font-medium mr-1">Filtrar:</span>
                    <button
                      type="button"
                      onClick={() => setFiltroEtapaTipo('todos')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                        filtroEtapaTipo === 'todos'
                          ? 'bg-[#0C2D48] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Todas ({modeloDetalhe.etapas.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroEtapaTipo('Trabalho interno')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        filtroEtapaTipo === 'Trabalho interno'
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Interno
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroEtapaTipo('Aguardando cliente')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        filtroEtapaTipo === 'Aguardando cliente'
                          ? 'bg-amber-600 text-white font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Cliente
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroEtapaTipo('Aguardando seguradora')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        filtroEtapaTipo === 'Aguardando seguradora'
                          ? 'bg-sky-600 text-white font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Seguradora
                    </button>
                  </div>
                </div>

                {/* Lista Vertical de Etapas */}
                <div className="space-y-4">
                  {etapasFiltradas.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                      Nenhuma etapa encontrada para este filtro.
                    </div>
                  ) : (
                    etapasFiltradas.map((etapa) => {
                      const totalItens = etapa.itens?.length || 0
                      const isGanho = etapa.is_etapa_ganho

                      return (
                        <div
                          key={etapa.id}
                          className={`rounded-2xl border transition-all duration-150 overflow-hidden ${
                            isGanho
                              ? 'border-emerald-300/80 bg-emerald-50/20 shadow-xs ring-1 ring-emerald-200'
                              : 'border-slate-200 bg-white shadow-xs'
                          }`}
                        >
                          {/* Cabeçalho da Etapa */}
                          <div className="p-4 sm:p-5 pb-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {/* Número + Nome */}
                              <div className="flex items-center gap-3">
                                <span
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                    isGanho
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-[#0C2D48] text-white'
                                  }`}
                                >
                                  {etapa.ordem}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-base sm:text-lg font-bold text-[#0C2D48]">
                                      {etapa.nome}
                                    </h4>
                                    {isGanho && (
                                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 border-none font-bold text-[11px] gap-1 px-2.5 py-0.5 shadow-xs">
                                        <Trophy className="w-3.5 h-3.5 text-amber-300" />
                                        ETAPA DE GANHO
                                      </Badge>
                                    )}
                                  </div>
                                  {etapa.descricao && (
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      {etapa.descricao}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Badges de Tipo e Metadados da Etapa */}
                              <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                                {getEtapaTipoBadge(etapa.tipo)}

                                {etapa.prazo_dias !== null &&
                                  etapa.prazo_dias !== undefined &&
                                  etapa.prazo_dias > 0 && (
                                    <span
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200"
                                      title="Prazo sugerido em dias (informativo)"
                                    >
                                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                                      {etapa.prazo_dias} {etapa.prazo_dias === 1 ? 'dia' : 'dias'}
                                    </span>
                                  )}
                              </div>
                            </div>

                            {/* Informações adicionais da etapa: Responsável padrão e prazo */}
                            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                                <span className="text-slate-500 font-medium">
                                  Responsável padrão:
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {etapa.responsavel_tipo === 'responsavel_comercial'
                                    ? 'Responsável comercial da oportunidade'
                                    : `Fila da equipe ${etapa.equipe_nome || ''} (${
                                        etapa.funcao || 'Geral'
                                      })`}
                                </span>
                              </div>

                              {isGanho && (
                                <div className="text-emerald-700 font-medium flex items-center gap-1">
                                  <span>&bull;</span>
                                  <span>Ao concluir esta etapa, a oportunidade é ganha.</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Bloco de Itens de Checklist da Etapa */}
                          <div className="px-4 sm:px-5 pb-4 pt-1 bg-slate-50/50 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                <CheckSquare className="w-3 h-3 text-teal-600" />
                                Checklist da etapa ({totalItens}{' '}
                                {totalItens === 1 ? 'item' : 'itens'})
                              </span>
                            </div>

                            {totalItens === 0 ? (
                              <p className="text-xs text-slate-400 italic py-2">
                                Nenhum item de checklist cadastrado para esta etapa.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {etapa.itens?.map((item, idx) => (
                                  <div
                                    key={item.id}
                                    className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                  >
                                    {/* Número + Título */}
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      <span className="text-xs font-mono font-bold text-slate-400 mt-0.5">
                                        {String(idx + 1).padStart(2, '0')}.
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                                          {item.titulo}
                                        </p>
                                        {item.tipo === 'Informação' && item.formato && (
                                          <p className="text-[11px] text-slate-500 mt-0.5">
                                            Campo de preenchimento obrigatório para avanço.
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Badges de Tipo, Formato e Obrigatoriedade */}
                                    <div className="flex items-center gap-2 flex-wrap sm:flex-shrink-0 self-start sm:self-center">
                                      {getChecklistItemBadge(item.tipo)}
                                      {getFormatoBadge(item.formato)}

                                      {item.obrigatorio ? (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] font-semibold text-rose-700 bg-rose-50/50 border-rose-200 px-2 py-0.5"
                                        >
                                          Obrigatório
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] font-medium text-slate-500 bg-slate-50 border-slate-200 px-2 py-0.5"
                                        >
                                          Opcional
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Rodapé do Modal com botão Fechar */}
          <div className="p-4 sm:p-5 border-t border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              Central do Fluxo Comercial N&amp;G &bull; Somente consulta
            </span>
            <Button
              variant="outline"
              onClick={handleCloseDetalhes}
              className="rounded-xl border-slate-300 text-slate-700 hover:bg-white text-xs font-semibold h-9 px-4"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
