import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { getCatalogoCompleto } from '@/services/catalogo'
import {
  SeguradoraOperadora,
  ProdutoCatalogo,
  OrigemLead,
  MotivoCatalogo,
  CatalogoFrente,
} from '@/types/catalogo'
import PageStateLayout from '@/components/PageStateLayout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Building2,
  Package,
  Compass,
  AlertOctagon,
  RefreshCw,
  Search,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Radio,
  FileSpreadsheet,
  Mail,
  MessageSquare,
  Globe,
  Tag,
  Info,
} from 'lucide-react'

export default function Catalogo() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [seguradoras, setSeguradoras] = useState<SeguradoraOperadora[]>([])
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([])
  const [origens, setOrigens] = useState<OrigemLead[]>([])
  const [motivos, setMotivos] = useState<MotivoCatalogo[]>([])

  const [activeTab, setActiveTab] = useState<'seguradoras' | 'produtos' | 'origens' | 'motivos'>(
    'seguradoras',
  )
  const [searchTerm, setSearchTerm] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getCatalogoCompleto()
      if (res.error) {
        throw res.error
      }
      if (res.data) {
        setSeguradoras(res.data.seguradoras)
        setProdutos(res.data.produtos)
        setOrigens(res.data.origensLead)
        setMotivos(res.data.motivos)
      }
    } catch (err: unknown) {
      console.error('Erro ao carregar catálogo:', err)
      setError('Não foi possível carregar o catálogo. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtragens locais com base na busca
  const filteredSeguradoras = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return seguradoras
    return seguradoras.filter(
      (s) =>
        s.nome.toLowerCase().includes(term) ||
        s.frente.toLowerCase().includes(term) ||
        s.canal_cotacao.toLowerCase().includes(term) ||
        s.situacao.toLowerCase().includes(term),
    )
  }, [seguradoras, searchTerm])

  const filteredProdutos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return produtos
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(term) ||
        p.frente.toLowerCase().includes(term) ||
        p.equipe_nome.toLowerCase().includes(term) ||
        p.situacao.toLowerCase().includes(term),
    )
  }, [produtos, searchTerm])

  const filteredOrigens = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return origens
    return origens.filter(
      (o) =>
        o.nome.toLowerCase().includes(term) ||
        (o.situacao && o.situacao.toLowerCase().includes(term)),
    )
  }, [origens, searchTerm])

  const filteredMotivos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return motivos
    return motivos.filter(
      (m) =>
        m.nome.toLowerCase().includes(term) ||
        m.tipo.toLowerCase().includes(term) ||
        (m.situacao && m.situacao.toLowerCase().includes(term)),
    )
  }, [motivos, searchTerm])

  // Helpers visuais
  const getFrenteBadge = (frente: CatalogoFrente) => {
    if (frente === 'Seguros') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-900 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
          <ShieldCheck className="w-3 h-3 text-teal-600" />
          Seguros
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
        <ShieldCheck className="w-3 h-3 text-blue-600" />
        Saúde
      </span>
    )
  }

  const getCanalBadge = (canal: string) => {
    switch (canal) {
      case 'Portal':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            <Globe className="w-3 h-3 text-slate-500" />
            Portal
          </span>
        )
      case 'Multicálculo':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
            <Radio className="w-3 h-3 text-purple-600" />
            Multicálculo
          </span>
        )
      case 'E-mail':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
            <Mail className="w-3 h-3 text-amber-600" />
            E-mail
          </span>
        )
      case 'WhatsApp':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <MessageSquare className="w-3 h-3 text-emerald-600" />
            WhatsApp
          </span>
        )
      default:
        return <span className="text-xs text-slate-600">{canal}</span>
    }
  }

  const getSituacaoBadge = (situacao: string, genero: 'fem' | 'masc' = 'fem') => {
    const isAtivo = situacao === 'ativa'
    const texto = isAtivo
      ? genero === 'masc'
        ? 'Ativo'
        : 'Ativa'
      : genero === 'masc'
        ? 'Inativo'
        : 'Inativa'

    if (isAtivo) {
      return (
        <Badge className="bg-emerald-50 text-emerald-800 hover:bg-emerald-50 border-emerald-200 font-semibold text-[11px] gap-1 px-2.5 py-0.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          {texto}
        </Badge>
      )
    }
    return (
      <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-300 font-medium text-[11px] gap-1 px-2.5 py-0.5">
        <XCircle className="w-3 h-3 text-slate-400" />
        {texto}
      </Badge>
    )
  }

  const getMotivoTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'perda':
        return (
          <Badge className="bg-rose-50 text-rose-800 hover:bg-rose-50 border-rose-200 font-semibold text-[11px] gap-1 px-2.5 py-0.5">
            <AlertOctagon className="w-3 h-3 text-rose-600" />
            Perda
          </Badge>
        )
      case 'descarte':
        return (
          <Badge className="bg-amber-50 text-amber-800 hover:bg-amber-50 border-amber-200 font-semibold text-[11px] gap-1 px-2.5 py-0.5">
            <Tag className="w-3 h-3 text-amber-600" />
            Descarte
          </Badge>
        )
      case 'adiamento':
        return (
          <Badge className="bg-sky-50 text-sky-800 hover:bg-sky-50 border-sky-200 font-semibold text-[11px] gap-1 px-2.5 py-0.5">
            <Tag className="w-3 h-3 text-sky-600" />
            Adiamento
          </Badge>
        )
      default:
        return <Badge variant="outline">{tipo}</Badge>
    }
  }

  // Estado: Carregando
  if (loading && seguradoras.length === 0 && produtos.length === 0) {
    return (
      <PageStateLayout
        title="Catálogo do Sistema"
        subtitle="Configurações > Catálogo de seguradoras, produtos, origens de lead e motivos."
        icon={Package}
        emptyMessage=""
        status="loading"
      />
    )
  }

  // Estado: Erro
  if (error && seguradoras.length === 0 && produtos.length === 0) {
    return (
      <PageStateLayout
        title="Catálogo do Sistema"
        subtitle="Configurações > Catálogo de seguradoras, produtos, origens de lead e motivos."
        icon={Package}
        emptyMessage=""
        status="error"
        onRetry={fetchData}
      />
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">
            <span>Configurações</span>
            <span>&rsaquo;</span>
            <span>Catálogo</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-[28px] font-bold text-[#0C2D48] tracking-tight">
              Catálogo do Sistema
            </h1>
            <Badge className="bg-[#0C2D48] text-white border-none text-[11px] font-semibold">
              Somente Administrador
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Visualização dos dados base utilizados no fluxo comercial e nas oportunidades.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="h-10 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
            title="Atualizar dados do catálogo"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Alerta informativo simples: Somente visualização nesta etapa */}
      <div className="p-3.5 rounded-xl bg-slate-100/80 border border-slate-200/80 text-slate-700 text-xs flex items-start sm:items-center gap-2.5">
        <Info className="w-4 h-4 text-teal-700 flex-shrink-0 mt-0.5 sm:mt-0" />
        <span className="leading-relaxed">
          Nesta etapa, o catálogo está em modo de <strong>somente leitura</strong>. As edições e
          inclusões serão liberadas em fase futura.
        </span>
      </div>

      {/* Campo de busca geral nas abas */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            placeholder="Filtrar nesta lista..."
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

      {/* Abas das 4 listas do Catálogo */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as typeof activeTab)
          setSearchTerm('')
        }}
        className="space-y-4"
      >
        <TabsList className="bg-slate-100/90 p-1 rounded-xl h-auto grid grid-cols-2 lg:grid-cols-4 gap-1 border border-slate-200/60">
          <TabsTrigger
            value="seguradoras"
            className="rounded-lg py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0C2D48] data-[state=active]:shadow-xs"
          >
            <Building2 className="w-4 h-4 text-teal-600" />
            <span>Seguradoras e operadoras</span>
            <Badge className="bg-slate-200/80 text-slate-700 border-none text-[10px] px-1.5 py-0 h-4">
              {seguradoras.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="produtos"
            className="rounded-lg py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0C2D48] data-[state=active]:shadow-xs"
          >
            <Package className="w-4 h-4 text-teal-600" />
            <span>Produtos</span>
            <Badge className="bg-slate-200/80 text-slate-700 border-none text-[10px] px-1.5 py-0 h-4">
              {produtos.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="origens"
            className="rounded-lg py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0C2D48] data-[state=active]:shadow-xs"
          >
            <Compass className="w-4 h-4 text-teal-600" />
            <span>Origens de lead</span>
            <Badge className="bg-slate-200/80 text-slate-700 border-none text-[10px] px-1.5 py-0 h-4">
              {origens.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="motivos"
            className="rounded-lg py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#0C2D48] data-[state=active]:shadow-xs"
          >
            <AlertOctagon className="w-4 h-4 text-teal-600" />
            <span>Motivos</span>
            <Badge className="bg-slate-200/80 text-slate-700 border-none text-[10px] px-1.5 py-0 h-4">
              {motivos.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ========================================================
            ABA 1: SEGURADORAS E OPERADORAS
           ======================================================== */}
        <TabsContent value="seguradoras" className="space-y-4 pt-1">
          <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-[#0C2D48]">
                    Seguradoras e operadoras
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Parceiras cadastradas para cotação em Seguros e Saúde.
                  </CardDescription>
                </div>
                <Badge className="w-fit bg-teal-50 text-teal-800 border-teal-200 text-xs font-semibold">
                  {filteredSeguradoras.length} de {seguradoras.length} registros
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredSeguradoras.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <p className="text-sm font-semibold text-[#0C2D48]">
                    {searchTerm
                      ? 'Nenhuma seguradora ou operadora encontrada para o filtro informado.'
                      : 'Nenhuma seguradora ou operadora cadastrada.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                      <TableRow>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">
                          Nome da seguradora/operadora
                        </TableHead>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">Frente</TableHead>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">
                          Canal de cotação
                        </TableHead>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSeguradoras.map((s) => (
                        <TableRow key={s.id} className="hover:bg-slate-50/70 transition-colors">
                          <TableCell className="font-semibold text-slate-900 text-sm">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-400" />
                              <span>{s.nome}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getFrenteBadge(s.frente)}</TableCell>
                          <TableCell>{getCanalBadge(s.canal_cotacao)}</TableCell>
                          <TableCell>{getSituacaoBadge(s.situacao)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================
            ABA 2: PRODUTOS
           ======================================================== */}
        <TabsContent value="produtos" className="space-y-4 pt-1">
          <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-[#0C2D48]">
                    Produtos
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Linhas de produtos comercializadas, frente de atuação e equipe responsável.
                  </CardDescription>
                </div>
                <Badge className="w-fit bg-teal-50 text-teal-800 border-teal-200 text-xs font-semibold">
                  {filteredProdutos.length} de {produtos.length} registros
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredProdutos.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <p className="text-sm font-semibold text-[#0C2D48]">
                    {searchTerm
                      ? 'Nenhum produto encontrado para o filtro informado.'
                      : 'Nenhum produto cadastrado.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                      <TableRow>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">
                          Nome do produto
                        </TableHead>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">Frente</TableHead>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">
                          Equipe responsável
                        </TableHead>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProdutos.map((p) => (
                        <TableRow key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <TableCell className="font-semibold text-slate-900 text-sm">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-slate-400" />
                              <span>{p.nome}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getFrenteBadge(p.frente)}</TableCell>
                          <TableCell>
                            <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                              {p.equipe_nome}
                            </span>
                          </TableCell>
                          <TableCell>{getSituacaoBadge(p.situacao)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================
            ABA 3: ORIGENS DE LEAD
           ======================================================== */}
        <TabsContent value="origens" className="space-y-4 pt-1">
          <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-[#0C2D48]">
                    Origens de lead
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Canais de entrada e procedência cadastrados no sistema (utilizados no cadastro
                    de clientes).
                  </CardDescription>
                </div>
                <Badge className="w-fit bg-teal-50 text-teal-800 border-teal-200 text-xs font-semibold">
                  {filteredOrigens.length} de {origens.length} registros
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredOrigens.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <p className="text-sm font-semibold text-[#0C2D48]">
                    {searchTerm
                      ? 'Nenhuma origem encontrada para o filtro informado.'
                      : 'Nenhuma origem de lead cadastrada.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                      <TableRow>
                        <TableHead className="w-16 font-bold text-[#0C2D48] text-xs">#</TableHead>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">
                          Nome da origem de lead
                        </TableHead>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">
                          Finalidade
                        </TableHead>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrigens.map((o, idx) => (
                        <TableRow key={o.id} className="hover:bg-slate-50/70 transition-colors">
                          <TableCell className="text-xs text-slate-400 font-mono">
                            {String(idx + 1).padStart(2, '0')}
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900 text-sm">
                            <div className="flex items-center gap-2">
                              <Compass className="w-4 h-4 text-teal-600" />
                              <span>{o.nome}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-500">
                              Disponível no cadastro de clientes e oportunidades
                            </span>
                          </TableCell>
                          <TableCell>{getSituacaoBadge(o.situacao, 'fem')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================
            ABA 4: MOTIVOS
           ======================================================== */}
        <TabsContent value="motivos" className="space-y-4 pt-1">
          <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-[#0C2D48]">
                    Motivos (perda, descarte e adiamento)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Justificativas padrão para encerramento ou adiamento de oportunidades
                    comerciais.
                  </CardDescription>
                </div>
                <Badge className="w-fit bg-teal-50 text-teal-800 border-teal-200 text-xs font-semibold">
                  {filteredMotivos.length} de {motivos.length} registros
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredMotivos.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <p className="text-sm font-semibold text-[#0C2D48]">
                    {searchTerm
                      ? 'Nenhum motivo encontrado para o filtro informado.'
                      : 'Nenhum motivo cadastrado.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                      <TableRow>
                        <TableHead className="w-16 font-bold text-[#0C2D48] text-xs">#</TableHead>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">
                          Descrição do motivo
                        </TableHead>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">
                          Tipo de motivo
                        </TableHead>
                        <TableHead className="font-bold text-[#0C2D48] text-xs">Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMotivos.map((m, idx) => (
                        <TableRow key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          <TableCell className="text-xs text-slate-400 font-mono">
                            {String(idx + 1).padStart(2, '0')}
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900 text-sm">
                            <div className="flex items-center gap-2">
                              <AlertOctagon className="w-4 h-4 text-slate-400" />
                              <span>{m.nome}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getMotivoTipoBadge(m.tipo)}</TableCell>
                          <TableCell>{getSituacaoBadge(m.situacao, 'masc')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
