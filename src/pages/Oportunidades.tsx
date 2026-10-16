import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import PageStateLayout from '@/components/PageStateLayout'
import { useOpportunityModal } from '@/hooks/use-opportunity-modal'
import {
  Briefcase,
  Search,
  Plus,
  Building2,
  Calendar,
  DollarSign,
  User,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Filter,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getOportunidades } from '@/services/oportunidades'
import { OportunidadeResumo } from '@/types/oportunidades'
import { formatCurrencyBRL, formatDateBR } from '@/components/NewOpportunityModal'
import { formatCNPJ, formatCPF } from '@/lib/clientes-utils'

export default function Oportunidades() {
  const { openModal } = useOpportunityModal()

  const [oportunidades, setOportunidades] = useState<OportunidadeResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchOpps = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getOportunidades({ search: searchTerm })
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
  }, [searchTerm])

  useEffect(() => {
    fetchOpps()
  }, [fetchOpps])

  if (loading && oportunidades.length === 0) {
    return (
      <PageStateLayout
        title="Oportunidades"
        subtitle="Carregando todas as negociações em andamento da Corretora N&G..."
        icon={Briefcase}
        emptyMessage=""
        status="loading"
      />
    )
  }

  if (error && oportunidades.length === 0) {
    return (
      <PageStateLayout
        title="Erro ao carregar oportunidades"
        subtitle="Não foi possível se comunicar com o banco de dados."
        icon={Briefcase}
        emptyMessage="Ocorreu uma falha ao listar as oportunidades."
        actionLabel="Tentar novamente"
        onAction={fetchOpps}
        status="error"
        onRetry={fetchOpps}
      />
    )
  }

  // Se não há nenhuma oportunidade cadastrada no sistema
  if (!loading && oportunidades.length === 0 && !searchTerm) {
    return (
      <PageStateLayout
        title="Oportunidades"
        subtitle="Todas as negociações em andamento da Corretora N&G."
        icon={Briefcase}
        emptyMessage="Nenhuma oportunidade cadastrada ainda — crie a primeira negociação."
        actionLabel="Nova oportunidade"
        onAction={() => openModal()}
        status="empty"
      />
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Topo com Título, Subtítulo e Botão de Nova Oportunidade */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0C2D48] tracking-tight">
            Oportunidades
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestão comercial e acompanhamento das etapas do fluxo comercial.
          </p>
        </div>

        <Button
          onClick={() => openModal()}
          className="h-11 px-5 rounded-xl bg-[#00A896] hover:bg-[#008f80] text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-xs btn-press self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nova oportunidade</span>
        </Button>
      </div>

      {/* Barra de Filtro e Busca */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="Buscar por protocolo, cliente, produto, seguradora..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-10 rounded-xl text-xs border-slate-200 focus-visible:ring-2 focus-visible:ring-teal-600 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOpps}
              className="h-10 px-3 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Listagem em Tabela e Cards */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
        {oportunidades.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700 mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#0C2D48]">Nenhuma oportunidade encontrada</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Não encontramos oportunidades para o termo "{searchTerm}". Tente buscar por outros
              termos.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm('')}
              className="mt-4 h-9 px-4 rounded-xl text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50"
            >
              Limpar busca
            </Button>
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
                    <TableHead className="font-bold text-[#0C2D48] text-xs">Cliente</TableHead>
                    <TableHead className="font-bold text-[#0C2D48] text-xs">
                      Produto / Seguradora
                    </TableHead>
                    <TableHead className="font-bold text-[#0C2D48] text-xs">Etapa Atual</TableHead>
                    <TableHead className="font-bold text-[#0C2D48] text-xs">Responsável</TableHead>
                    <TableHead className="font-bold text-[#0C2D48] text-xs">
                      Valor Estimado
                    </TableHead>
                    <TableHead className="font-bold text-[#0C2D48] text-xs">Previsto</TableHead>
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
                          className="font-bold text-xs text-[#0C2D48] hover:text-teal-700 hover:underline block truncate max-w-[180px]"
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
                        {opp.usou_fluxo_generico && (
                          <span className="block text-[10px] text-amber-700 font-medium mt-0.5">
                            Fluxo padrão
                          </span>
                        )}
                      </TableCell>

                      {/* Responsável Comercial */}
                      <TableCell className="py-4 text-xs text-slate-600">
                        {opp.responsavel_comercial_nome}
                      </TableCell>

                      {/* Valor Estimado */}
                      <TableCell className="py-4 font-semibold text-xs text-teal-700">
                        {formatCurrencyBRL(opp.valor_estimado)}
                      </TableCell>

                      {/* Data Prevista */}
                      <TableCell className="py-4 text-xs text-slate-600 font-mono">
                        {formatDateBR(opp.data_prevista_fechamento)}
                      </TableCell>

                      {/* Situação */}
                      <TableCell className="py-4 text-xs">
                        <Badge
                          className={`text-[10px] px-2 py-0.5 font-semibold border ${
                            opp.situacao === 'Em andamento'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : opp.situacao === 'Ganha'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
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
                      <span className="text-[11px] text-slate-400 block">Previsão:</span>
                      <span className="font-medium text-slate-700">
                        {formatDateBR(opp.data_prevista_fechamento)}
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
