import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getClientes } from '@/services/clientes'
import { Cliente, ClienteTipo } from '@/types/clientes'
import { formatCNPJ, formatCPF } from '@/lib/clientes-utils'
import { ClienteFormModal } from '@/components/clientes/ClienteFormModal'
import PageStateLayout from '@/components/PageStateLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Building2,
  User,
  Plus,
  Search,
  RefreshCw,
  Archive,
  ChevronRight,
  MapPin,
  Briefcase,
  Users,
} from 'lucide-react'

export default function Clientes() {
  const navigate = useNavigate()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [tipoFilter, setTipoFilter] = useState<ClienteTipo | 'todos'>('todos')
  const [situacaoFilter, setSituacaoFilter] = useState<'ativo' | 'arquivado' | 'todos'>('ativo')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getClientes({
        situacao: situacaoFilter,
        tipo: tipoFilter,
      })
      if (res.error) {
        throw new Error(res.error.message || 'Falha ao buscar clientes')
      }
      setClientes(res.data || [])
    } catch (err) {
      console.error('Erro ao buscar clientes:', err)
      setError('Não foi possível carregar os clientes. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [situacaoFilter, tipoFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtragem local por texto
  const filteredClientes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return clientes

    return clientes.filter((c) => {
      const nomeMatch = (c.nome_completo || '').toLowerCase().includes(term)
      const razaoMatch = (c.razao_social || '').toLowerCase().includes(term)
      const fantasiaMatch = (c.nome_fantasia || '').toLowerCase().includes(term)
      const segmentoMatch = (c.segmento || '').toLowerCase().includes(term)
      const docMatch = (c.cnpj || '').includes(term) || (c.cpf || '').includes(term)
      const respMatch = (c.responsavel_comercial?.nome || '').toLowerCase().includes(term)
      const cidadeMatch = (c.cidade || '').toLowerCase().includes(term)

      return (
        nomeMatch ||
        razaoMatch ||
        fantasiaMatch ||
        segmentoMatch ||
        docMatch ||
        respMatch ||
        cidadeMatch
      )
    })
  }, [clientes, searchTerm])

  const handleCreatedSuccess = (novo: Cliente) => {
    fetchData()
    // Navega para a ficha do cliente recém-criado
    navigate(`/clientes/${novo.id}`)
  }

  // 1. Estado de Carregamento
  if (loading && clientes.length === 0) {
    return (
      <PageStateLayout
        title="Clientes"
        subtitle="Carteira de clientes e empresas parceiras da Nunes & Grossi."
        icon={Building2}
        emptyMessage=""
        status="loading"
      />
    )
  }

  // 2. Estado de Erro
  if (error && clientes.length === 0) {
    return (
      <PageStateLayout
        title="Clientes"
        subtitle="Carteira de clientes e empresas parceiras da Nunes & Grossi."
        icon={Building2}
        emptyMessage=""
        status="error"
        onRetry={fetchData}
      />
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Topo da página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-[28px] font-bold text-[#0C2D48] tracking-tight">
              Clientes
            </h1>
            <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-xs font-semibold">
              {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestão da carteira de Pessoa Jurídica e Pessoa Física com contatos e histórico.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="h-10 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          </Button>

          <Button
            onClick={() => setModalOpen(true)}
            className="h-10 px-4 rounded-xl bg-[#00A896] hover:bg-[#008f80] text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-xs btn-press"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Novo cliente</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Campo de Busca */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            placeholder="Buscar por nome, razão social, CPF ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10 pr-4 rounded-xl text-sm border-slate-200 bg-white shadow-xs focus-visible:ring-2 focus-visible:ring-teal-600"
          />
        </div>

        {/* Filtros rápidos: Tipo e Situação */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-36">
            <Select
              value={tipoFilter}
              onValueChange={(val) => setTipoFilter(val as ClienteTipo | 'todos')}
            >
              <SelectTrigger className="h-10 rounded-xl text-xs border-slate-200 bg-white shadow-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="PJ">Pessoa Jurídica (PJ)</SelectItem>
                <SelectItem value="PF">Pessoa Física (PF)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-36">
            <Select
              value={situacaoFilter}
              onValueChange={(val) => setSituacaoFilter(val as 'ativo' | 'arquivado' | 'todos')}
            >
              <SelectTrigger className="h-10 rounded-xl text-xs border-slate-200 bg-white shadow-xs">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Clientes ativos</SelectItem>
                <SelectItem value="arquivado">Arquivados</SelectItem>
                <SelectItem value="todos">Todas situações</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 3. Estado Vazio caso a busca não retorne nada ou a tabela esteja limpa */}
      {filteredClientes.length === 0 ? (
        <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
          <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700 mb-3">
              <Building2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-[#0C2D48]">
              {searchTerm
                ? 'Nenhum cliente corresponde à busca'
                : 'Nenhum cliente cadastrado ainda'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {searchTerm
                ? `Não encontramos nenhum cliente com "${searchTerm}". Experimente verificar a digitação ou limpar os filtros.`
                : 'Cadastre a primeira empresa ou pessoa física da carteira comercial da Nunes & Grossi.'}
            </p>
            {searchTerm ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="mt-4 rounded-xl text-xs"
              >
                Limpar busca
              </Button>
            ) : (
              <Button
                onClick={() => setModalOpen(true)}
                className="mt-4 h-9 px-4 rounded-xl bg-[#00A896] hover:bg-[#008f80] text-white text-xs font-semibold flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo cliente</span>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ========================================================
              TABELA DESKTOP (telas >= md)
             ======================================================== */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                <TableRow>
                  <TableHead className="w-[300px] font-bold text-[#0C2D48] text-xs">
                    Nome / Razão Social
                  </TableHead>
                  <TableHead className="font-bold text-[#0C2D48] text-xs">Tipo</TableHead>
                  <TableHead className="font-bold text-[#0C2D48] text-xs">CPF / CNPJ</TableHead>
                  <TableHead className="font-bold text-[#0C2D48] text-xs">
                    Segmento / Cidade
                  </TableHead>
                  <TableHead className="font-bold text-[#0C2D48] text-xs">
                    Responsável comercial
                  </TableHead>
                  <TableHead className="text-center font-bold text-[#0C2D48] text-xs">
                    Oportunidades
                  </TableHead>
                  <TableHead className="text-right font-bold text-[#0C2D48] text-xs pr-6">
                    Ação
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientes.map((c) => {
                  const isPJ = c.tipo === 'PJ'
                  const nomePrincipal = isPJ ? c.razao_social || '—' : c.nome_completo || '—'
                  const documentoFormatado = isPJ ? formatCNPJ(c.cnpj) : formatCPF(c.cpf)
                  const isArquivado = c.situacao === 'arquivado'

                  return (
                    <TableRow
                      key={c.id}
                      onClick={() => navigate(`/clientes/${c.id}`)}
                      className={`cursor-pointer hover:bg-slate-50/70 transition-colors ${
                        isArquivado ? 'bg-slate-50/50 opacity-75' : ''
                      }`}
                    >
                      {/* Nome / Razão Social */}
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              isPJ
                                ? 'bg-teal-50 text-teal-700 border border-teal-200/60'
                                : 'bg-sky-50 text-sky-700 border border-sky-200/60'
                            }`}
                          >
                            {isPJ ? (
                              <Building2 className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-[#0C2D48] truncate">
                                {nomePrincipal}
                              </span>
                              {isArquivado && (
                                <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 text-[10px] py-0 px-1.5 font-medium border-none flex items-center gap-1">
                                  <Archive className="w-2.5 h-2.5" />
                                  Arquivado
                                </Badge>
                              )}
                            </div>
                            {isPJ && c.nome_fantasia && (
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                {c.nome_fantasia}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Tipo */}
                      <TableCell className="py-3.5">
                        <Badge
                          className={`font-semibold border-none text-[11px] px-2.5 py-0.5 ${
                            isPJ
                              ? 'bg-teal-100 text-teal-900 hover:bg-teal-100'
                              : 'bg-sky-100 text-sky-900 hover:bg-sky-100'
                          }`}
                        >
                          {isPJ ? 'PJ' : 'PF'}
                        </Badge>
                      </TableCell>

                      {/* Documento formatado */}
                      <TableCell className="py-3.5 font-mono text-xs text-slate-700">
                        {documentoFormatado || '—'}
                      </TableCell>

                      {/* Segmento / Cidade */}
                      <TableCell className="py-3.5 text-xs text-slate-600">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-slate-800">
                            {c.segmento || (isPJ ? 'Segmento não informado' : 'Pessoa Física')}
                          </span>
                          {(c.cidade || c.uf) && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {[c.cidade, c.uf].filter(Boolean).join(' - ')}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Responsável comercial */}
                      <TableCell className="py-3.5 text-xs text-slate-700">
                        {c.responsavel_comercial ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                              {c.responsavel_comercial.nome.charAt(0)}
                            </span>
                            <span className="truncate max-w-[140px]">
                              {c.responsavel_comercial.nome}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>

                      {/* Oportunidades abertas */}
                      <TableCell className="py-3.5 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          {c.total_oportunidades_abertas || 0}
                        </span>
                      </TableCell>

                      {/* Ação */}
                      <TableCell className="py-3.5 text-right pr-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg text-xs font-semibold"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/clientes/${c.id}`)
                          }}
                        >
                          <span>Ver ficha</span>
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* ========================================================
              LISTA MOBILE EM CARTÕES (telas < md)
             ======================================================== */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredClientes.map((c) => {
              const isPJ = c.tipo === 'PJ'
              const nomePrincipal = isPJ ? c.razao_social || '—' : c.nome_completo || '—'
              const documentoFormatado = isPJ ? formatCNPJ(c.cnpj) : formatCPF(c.cpf)
              const isArquivado = c.situacao === 'arquivado'

              return (
                <Card
                  key={c.id}
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  className={`border border-slate-200/80 rounded-2xl p-4 shadow-xs hover:border-teal-500/50 transition-colors cursor-pointer active:scale-[0.99] ${
                    isArquivado ? 'bg-slate-50/70 opacity-80' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          isPJ
                            ? 'bg-teal-50 text-teal-700 border border-teal-200/60'
                            : 'bg-sky-50 text-sky-700 border border-sky-200/60'
                        }`}
                      >
                        {isPJ ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-[#0C2D48] truncate">
                          {nomePrincipal}
                        </h4>
                        {isPJ && c.nome_fantasia && (
                          <p className="text-xs text-slate-500 truncate">{c.nome_fantasia}</p>
                        )}
                        <p className="text-[11px] font-mono text-slate-600 mt-0.5">
                          {documentoFormatado || 'Sem documento'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge
                        className={`font-semibold border-none text-[10px] px-2 py-0.5 ${
                          isPJ ? 'bg-teal-100 text-teal-900' : 'bg-sky-100 text-sky-900'
                        }`}
                      >
                        {isPJ ? 'PJ' : 'PF'}
                      </Badge>
                      {isArquivado && (
                        <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                          <Archive className="w-3 h-3" />
                          Arquivado
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">
                        Segmento / Cidade
                      </span>
                      <span className="truncate block font-medium text-slate-800">
                        {c.segmento || (isPJ ? '—' : 'PF')}
                      </span>
                      {(c.cidade || c.uf) && (
                        <span className="text-[11px] text-slate-500 truncate block">
                          {[c.cidade, c.uf].filter(Boolean).join(' - ')}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">
                        Responsável
                      </span>
                      <span className="truncate block font-medium text-slate-800">
                        {c.responsavel_comercial?.nome || '—'}
                      </span>
                      <span className="text-[11px] text-teal-700 block font-semibold mt-0.5">
                        0 oportunidades
                      </span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* Modal de cadastro de cliente */}
      <ClienteFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleCreatedSuccess}
      />
    </div>
  )
}
