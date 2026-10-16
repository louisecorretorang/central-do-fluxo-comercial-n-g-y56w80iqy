import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageStateLayout from '@/components/PageStateLayout'
import { useOpportunityModal } from '@/hooks/use-opportunity-modal'
import {
  Briefcase,
  Search,
  Plus,
  Building2,
  Calendar,
  User,
  ArrowRight,
  RefreshCw,
  Filter,
  Download,
  X,
  FileSpreadsheet,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getOportunidades } from '@/services/oportunidades'
import { getProdutosCatalogo, getSeguradorasOperadoras } from '@/services/catalogo'
import { getUsersWithEquipes, getEquipes } from '@/services/usuarios'
import { OportunidadeResumo, OportunidadeSituacao } from '@/types/oportunidades'
import { ProdutoCatalogo, SeguradoraOperadora } from '@/types/catalogo'
import { Equipe, UserProfile } from '@/types/usuarios'
import { formatCurrencyBRL, formatDateBR } from '@/components/NewOpportunityModal'
import { formatCNPJ, formatCPF } from '@/lib/clientes-utils'
import { toast } from 'sonner'

const SITUACOES_OPCOES: { label: string; value: string }[] = [
  { label: 'Todas as situações', value: 'todas' },
  { label: 'Em andamento', value: 'Em andamento' },
  { label: 'Ganha — em finalização', value: 'Ganha — em finalização' },
  { label: 'Ganha', value: 'Ganha' },
  { label: 'Concluída', value: 'Concluída' },
  { label: 'Perdida', value: 'Perdida' },
  { label: 'Descartada', value: 'Descartada' },
  { label: 'Adiada', value: 'Adiada' },
  { label: 'Arquivada', value: 'Arquivada' },
]

export default function Oportunidades() {
  const navigate = useNavigate()
  const { openModal } = useOpportunityModal()

  const [oportunidades, setOportunidades] = useState<OportunidadeResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dados auxiliares para dropdowns de filtros
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([])
  const [seguradoras, setSeguradoras] = useState<SeguradoraOperadora[]>([])
  const [usuarios, setUsuarios] = useState<UserProfile[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])

  // Filtros ativos
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState<string>('todas')
  const [filtroProduto, setFiltroProduto] = useState<string>('todos')
  const [filtroSeguradora, setFiltroSeguradora] = useState<string>('todas')
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>('todos')
  const [filtroEquipe, setFiltroEquipe] = useState<string>('todas')
  const [dataInicioBR, setDataInicioBR] = useState<string>('') // dd/mm/aaaa
  const [dataFimBR, setDataFimBR] = useState<string>('') // dd/mm/aaaa
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)

  // Carregar dados de catálogos e usuários
  useEffect(() => {
    async function loadAux() {
      const [prodRes, segRes, userRes, eqRes] = await Promise.all([
        getProdutosCatalogo(),
        getSeguradorasOperadoras(),
        getUsersWithEquipes(),
        getEquipes(),
      ])
      if (prodRes.data) setProdutos(prodRes.data)
      if (segRes.data) setSeguradoras(segRes.data)
      if (userRes.data) setUsuarios(userRes.data)
      if (eqRes.data) setEquipes(eqRes.data)
    }
    loadAux()
  }, [])

  // Converte dd/mm/aaaa para YYYY-MM-DD
  const convertDateBRToISO = (val: string): string | undefined => {
    const clean = val.replace(/\D/g, '')
    if (clean.length === 8) {
      const dia = clean.substring(0, 2)
      const mes = clean.substring(2, 4)
      const ano = clean.substring(4, 8)
      return `${ano}-${mes}-${dia}`
    }
    return undefined
  }

  // Busca oportunidades com query completa
  const fetchOpps = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const isoInicio = convertDateBRToISO(dataInicioBR)
      const isoFim = convertDateBRToISO(dataFimBR)

      const res = await getOportunidades({
        search: searchTerm,
        situacao: filtroSituacao,
        produtoId: filtroProduto,
        seguradoraId: filtroSeguradora,
        responsavelId: filtroResponsavel,
        equipeId: filtroEquipe,
        dataInicio: isoInicio,
        dataFim: isoFim,
      })

      if (res.error) {
        throw new Error(res.error)
      }
      setOportunidades(res.data || [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao buscar oportunidades'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [
    searchTerm,
    filtroSituacao,
    filtroProduto,
    filtroSeguradora,
    filtroResponsavel,
    filtroEquipe,
    dataInicioBR,
    dataFimBR,
  ])

  useEffect(() => {
    fetchOpps()
  }, [fetchOpps])

  // Máscara dd/mm/aaaa
  const handleDateMask = (val: string, setter: (v: string) => void) => {
    const digits = val.replace(/\D/g, '').slice(0, 8)
    let masked = ''
    if (digits.length <= 2) {
      masked = digits
    } else if (digits.length <= 4) {
      masked = `${digits.slice(0, 2)}/${digits.slice(2)}`
    } else {
      masked = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
    }
    setter(masked)
  }

  const limparFiltros = () => {
    setSearchTerm('')
    setFiltroSituacao('todas')
    setFiltroProduto('todos')
    setFiltroSeguradora('todas')
    setFiltroResponsavel('todos')
    setFiltroEquipe('todas')
    setDataInicioBR('')
    setDataFimBR('')
  }

  const temFiltroAtivo =
    Boolean(searchTerm) ||
    filtroSituacao !== 'todas' ||
    filtroProduto !== 'todos' ||
    filtroSeguradora !== 'todas' ||
    filtroResponsavel !== 'todos' ||
    filtroEquipe !== 'todas' ||
    Boolean(dataInicioBR) ||
    Boolean(dataFimBR)

  // Exportação CSV formatada rigorosamente conforme especificação
  const handleExportCSV = () => {
    if (oportunidades.length === 0) {
      toast.error('Nenhuma oportunidade para exportar.')
      return
    }

    // Colunas exigidas:
    // protocolo, cliente, documento, produto, seguradora, responsável, equipe, situação, etapa atual, valor estimado, data de criação.
    const headers = [
      'protocolo',
      'cliente',
      'documento',
      'produto',
      'seguradora',
      'responsável',
      'equipe',
      'situação',
      'etapa atual',
      'valor estimado',
      'data de criação',
    ]

    const escapeCSV = (field: string | number | null | undefined): string => {
      if (field === null || field === undefined) return '""'
      const str = String(field).replace(/"/g, '""')
      return `"${str}"`
    }

    const rows = oportunidades.map((opp) => {
      // Valor com vírgula decimal pt-BR ex: 1500,50
      const valorStr = opp.valor_estimado
        ? opp.valor_estimado.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : '0,00'

      const dataCriacaoBR = formatDateBR(opp.created_at)

      const docFormatado = opp.cliente_documento
        ? opp.cliente_tipo === 'PJ'
          ? formatCNPJ(opp.cliente_documento)
          : formatCPF(opp.cliente_documento)
        : ''

      return [
        escapeCSV(opp.protocolo),
        escapeCSV(opp.cliente_nome),
        escapeCSV(docFormatado),
        escapeCSV(opp.produto_nome),
        escapeCSV(opp.seguradora_nome || 'Não informada'),
        escapeCSV(opp.responsavel_comercial_nome),
        escapeCSV(opp.equipe_nome || 'Geral'),
        escapeCSV(opp.situacao),
        escapeCSV(opp.etapa_atual_nome || 'Inicial'),
        escapeCSV(valorStr),
        escapeCSV(dataCriacaoBR),
      ].join(';')
    })

    // Adicionar BOM UTF-8 (\uFEFF) para Excel abrir acentos em pt-BR perfeitamente
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const nowIso = new Date().toISOString().split('T')[0] // AAAA-MM-DD
    const fileName = `oportunidades-${nowIso}.csv`

    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success(`Planilha gerada com sucesso: ${fileName} (${oportunidades.length} linhas)`)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Topo com Título, Subtítulo e Botões */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0C2D48] tracking-tight">
            Oportunidades
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestão comercial completa e acompanhamento das negociações da Corretora N&G.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={oportunidades.length === 0}
            className="h-11 px-4 rounded-xl border-slate-200 text-[#0C2D48] hover:bg-slate-100 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs"
            title="Exportar planilha filtrada em CSV"
          >
            <Download className="w-4 h-4 stroke-[2]" />
            <span>Exportar CSV</span>
          </Button>

          <Button
            onClick={() => openModal()}
            className="h-11 px-5 rounded-xl bg-[#00A896] hover:bg-[#008f80] text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-xs btn-press"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nova oportunidade</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtro Principal */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
            {/* Campo de Busca Rápida: Cliente, Documento ou Protocolo */}
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="Buscar por cliente, CPF/CNPJ ou protocolo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 pl-10 rounded-xl text-xs border-slate-200 focus-visible:ring-2 focus-visible:ring-teal-600 bg-slate-50/50"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Ações: Botão Mostrar/Ocultar Filtros + Atualizar */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant={filtrosAbertos || temFiltroAtivo ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setFiltrosAbertos(!filtrosAbertos)}
                className={`h-10 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                  temFiltroAtivo ? 'border-teal-300 text-teal-800 bg-teal-50' : 'border-slate-200'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtros avançados</span>
                {temFiltroAtivo && (
                  <span className="w-2 h-2 rounded-full bg-teal-600 inline-block ml-0.5" />
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchOpps}
                disabled={loading}
                className="h-10 px-3 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
            </div>
          </div>

          {/* Painel Expansível de Filtros Avançados */}
          {filtrosAbertos && (
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
              {/* Situação */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Situação</label>
                <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
                  <SelectTrigger className="h-9 rounded-xl text-xs border-slate-200 bg-slate-50/50">
                    <SelectValue placeholder="Situação" />
                  </SelectTrigger>
                  <SelectContent>
                    {SITUACOES_OPCOES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Produto */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Produto</label>
                <Select value={filtroProduto} onValueChange={setFiltroProduto}>
                  <SelectTrigger className="h-9 rounded-xl text-xs border-slate-200 bg-slate-50/50">
                    <SelectValue placeholder="Produto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os produtos</SelectItem>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seguradora */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Seguradora</label>
                <Select value={filtroSeguradora} onValueChange={setFiltroSeguradora}>
                  <SelectTrigger className="h-9 rounded-xl text-xs border-slate-200 bg-slate-50/50">
                    <SelectValue placeholder="Seguradora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as seguradoras</SelectItem>
                    {seguradoras.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Responsável Comercial */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">
                  Responsável comercial
                </label>
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
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Equipe</label>
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

              {/* Período de criação: Data Inicial */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Criação a partir de</label>
                <Input
                  placeholder="dd/mm/aaaa"
                  value={dataInicioBR}
                  onChange={(e) => handleDateMask(e.target.value, setDataInicioBR)}
                  className="h-9 rounded-xl text-xs border-slate-200 bg-slate-50/50"
                />
              </div>

              {/* Período de criação: Data Final */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Criação até</label>
                <Input
                  placeholder="dd/mm/aaaa"
                  value={dataFimBR}
                  onChange={(e) => handleDateMask(e.target.value, setDataFimBR)}
                  className="h-9 rounded-xl text-xs border-slate-200 bg-slate-50/50"
                />
              </div>

              {/* Botão para limpar */}
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={limparFiltros}
                  className="h-9 w-full rounded-xl text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-semibold"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  <span>Limpar todos os filtros</span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mensagem de Erro Inline se houver */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchOpps} className="h-8 text-xs">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Listagem em Tabela e Cards */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
        {loading && oportunidades.length === 0 ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-7 h-7 text-teal-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Buscando oportunidades...</p>
          </div>
        ) : oportunidades.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700 mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#0C2D48]">Nenhuma oportunidade encontrada</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Não encontramos oportunidades com os filtros selecionados. Tente ajustar os
              parâmetros.
            </p>
            {temFiltroAtivo && (
              <Button
                variant="outline"
                size="sm"
                onClick={limparFiltros}
                className="mt-4 h-9 px-4 rounded-xl text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Tabela Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 border-b border-slate-100">
                  <TableRow>
                    <TableHead className="font-bold text-[#0C2D48] text-xs pl-6">
                      Protocolo
                    </TableHead>
                    <TableHead className="font-bold text-[#0C2D48] text-xs">
                      Cliente / Doc
                    </TableHead>
                    <TableHead className="font-bold text-[#0C2D48] text-xs">
                      Produto / Seguradora
                    </TableHead>
                    <TableHead className="font-bold text-[#0C2D48] text-xs">Etapa Atual</TableHead>
                    <TableHead className="font-bold text-[#0C2D48] text-xs">
                      Responsável / Equipe
                    </TableHead>
                    <TableHead className="font-bold text-[#0C2D48] text-xs">
                      Valor Estimado
                    </TableHead>
                    <TableHead className="font-bold text-[#0C2D48] text-xs">Criação</TableHead>
                    <TableHead className="font-bold text-[#0C2D48] text-xs">Situação</TableHead>
                    <TableHead className="text-right font-bold text-[#0C2D48] text-xs pr-6">
                      Ação
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {oportunidades.map((opp) => (
                    <TableRow key={opp.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Protocolo */}
                      <TableCell className="pl-6 py-4 font-mono text-xs font-bold text-teal-900">
                        <Link
                          to={`/oportunidades/${opp.id}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200/80">
                            {opp.protocolo}
                          </span>
                        </Link>
                      </TableCell>

                      {/* Cliente */}
                      <TableCell className="py-4">
                        <Link
                          to={`/clientes/${opp.cliente_id}`}
                          className="font-bold text-xs text-[#0C2D48] hover:text-teal-700 hover:underline block truncate max-w-[190px]"
                        >
                          {opp.cliente_nome}
                        </Link>
                        {opp.cliente_documento && (
                          <span className="font-mono text-[11px] text-slate-400 block">
                            {opp.cliente_tipo === 'PJ'
                              ? formatCNPJ(opp.cliente_documento)
                              : formatCPF(opp.cliente_documento)}
                          </span>
                        )}
                      </TableCell>

                      {/* Produto e Seguradora */}
                      <TableCell className="py-4 text-xs">
                        <span className="font-semibold text-slate-800 block">
                          {opp.produto_nome}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {opp.seguradora_nome || 'Sem seguradora fixa'}
                        </span>
                      </TableCell>

                      {/* Etapa Atual */}
                      <TableCell className="py-4 text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-medium text-[11px] border border-teal-200">
                          {opp.etapa_atual_nome || 'Inicial'}
                        </span>
                        {opp.dias_na_etapa !== undefined && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {opp.dias_na_etapa === 0 ? 'Hoje' : `${opp.dias_na_etapa}d na etapa`}
                          </span>
                        )}
                      </TableCell>

                      {/* Responsável Comercial e Equipe */}
                      <TableCell className="py-4 text-xs">
                        <span className="font-medium text-slate-700 block">
                          {opp.responsavel_comercial_nome}
                        </span>
                        {opp.equipe_nome && (
                          <span className="text-[11px] text-slate-400">{opp.equipe_nome}</span>
                        )}
                      </TableCell>

                      {/* Valor Estimado */}
                      <TableCell className="py-4 font-semibold text-xs text-teal-700">
                        {formatCurrencyBRL(opp.valor_estimado)}
                      </TableCell>

                      {/* Data Criação */}
                      <TableCell className="py-4 text-xs text-slate-600 font-mono">
                        {formatDateBR(opp.created_at)}
                      </TableCell>

                      {/* Situação */}
                      <TableCell className="py-4 text-xs">
                        <Badge
                          className={`text-[10px] px-2 py-0.5 font-semibold border ${
                            opp.situacao === 'Em andamento'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : opp.situacao === 'Ganha' ||
                                  opp.situacao === 'Ganha — em finalização'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : opp.situacao === 'Perdida'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {opp.situacao}
                        </Badge>
                      </TableCell>

                      {/* Ação */}
                      <TableCell className="py-4 text-right pr-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 px-2.5 text-xs font-semibold text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-lg"
                        >
                          <Link to={`/oportunidades/${opp.id}`}>
                            <span>Abrir</span>
                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Lista em Cartões para Mobile/Tablet */}
            <div className="block lg:hidden divide-y divide-slate-100">
              {oportunidades.map((opp) => (
                <div key={opp.id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-teal-50 text-teal-900 border border-teal-200 font-bold">
                        {opp.protocolo}
                      </span>
                      <h3 className="text-sm font-bold text-[#0C2D48] mt-1.5">
                        {opp.produto_nome}
                        {opp.seguradora_nome ? ` — ${opp.seguradora_nome}` : ''}
                      </h3>
                      <Link
                        to={`/clientes/${opp.cliente_id}`}
                        className="text-xs text-teal-700 font-medium hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <Building2 className="w-3 h-3" />
                        <span>{opp.cliente_nome}</span>
                      </Link>
                    </div>

                    <Badge
                      className={`text-[10px] px-2 py-0.5 font-semibold ${
                        opp.situacao === 'Em andamento'
                          ? 'bg-blue-50 text-blue-800'
                          : opp.situacao === 'Ganha'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {opp.situacao}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Valor estimado:</span>
                      <span className="font-bold text-teal-700">
                        {formatCurrencyBRL(opp.valor_estimado)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Criação:</span>
                      <span className="font-medium text-slate-700">
                        {formatDateBR(opp.created_at)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Etapa atual:</span>
                      <span className="font-medium text-teal-800">
                        {opp.etapa_atual_nome || 'Inicial'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Responsável:</span>
                      <span className="font-medium text-slate-700">
                        {opp.responsavel_comercial_nome}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 px-3 rounded-xl border-slate-200 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                    >
                      <Link to={`/oportunidades/${opp.id}`}>
                        <span>Ver detalhes</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
