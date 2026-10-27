import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getClienteById, toggleClienteSituacao, setContatoPrincipal } from '@/services/clientes'
import { getOportunidades } from '@/services/oportunidades'
import { Cliente, ClienteContato } from '@/types/clientes'
import { OportunidadeResumo } from '@/types/oportunidades'
import { formatCurrencyBRL } from '@/components/NewOpportunityModal'
import { formatCNPJ, formatCPF, formatDateBR, formatPhoneBR } from '@/lib/clientes-utils'
import { useOpportunityModal } from '@/hooks/use-opportunity-modal'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import PageStateLayout from '@/components/PageStateLayout'
import ClienteFormModal from '@/components/clientes/ClienteFormModal'
import ContatoFormModal from '@/components/clientes/ContatoFormModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  User,
  ArrowLeft,
  Edit2,
  Plus,
  Star,
  Archive,
  RefreshCw,
  Mail,
  Phone,
  Briefcase,
  Users,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react'

export default function ClienteDetalhes() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { openModal: openOpportunityModal } = useOpportunityModal()
  // T2.02 — arquivar cliente é ato de administrador ou gestor (regras-e-permissoes).
  // O colaborador não vê o botão; o banco também recusa (trigger), em duas camadas.
  const { isAdmin, isGestor } = useAuth()
  const podeArquivarCliente = isAdmin || isGestor

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [oportunidades, setOportunidades] = useState<OportunidadeResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modais de edição
  const [editClienteOpen, setEditClienteOpen] = useState(false)
  const [contatoModalOpen, setContatoModalOpen] = useState(false)
  const [editingContato, setEditingContato] = useState<ClienteContato | null>(null)

  // Diálogo de confirmação de arquivamento / reativação
  const [toggleArchiveOpen, setToggleArchiveOpen] = useState(false)
  const [toggling, setToggling] = useState(false)

  const fetchCliente = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [res, oppsRes] = await Promise.all([
        getClienteById(id),
        getOportunidades({ clienteId: id }),
      ])
      if (res.error || !res.data) {
        throw new Error(res.error?.message || 'Cliente não encontrado')
      }
      setCliente(res.data)
      if (oppsRes.data) {
        setOportunidades(oppsRes.data)
      }
    } catch (err: any) {
      console.error('Erro ao buscar cliente:', err)
      setError('Não foi possível encontrar a ficha deste cliente.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchCliente()
  }, [fetchCliente])

  // Ação de arquivar / reativar cliente
  const handleToggleArchiveConfirm = async () => {
    if (!cliente) return
    setToggling(true)
    const novaSituacao = cliente.situacao === 'ativo' ? 'arquivado' : 'ativo'

    try {
      const res = await toggleClienteSituacao(cliente.id, novaSituacao)
      if (res.success) {
        toast({
          title:
            novaSituacao === 'arquivado'
              ? 'Cliente arquivado com sucesso'
              : 'Cliente reativado com sucesso',
          description:
            novaSituacao === 'arquivado'
              ? 'O cliente foi marcado como arquivado e permanece seguro no histórico.'
              : 'O cliente voltou a figurar como ativo na carteira comercial.',
        })
        setToggleArchiveOpen(false)
        fetchCliente()
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao alterar situação',
          description: res.error || 'Não foi possível alterar a situação do cliente.',
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha de comunicação. Tente novamente.',
      })
    } finally {
      setToggling(false)
    }
  }

  // Ação de definir contato principal
  const handleSetPrincipal = async (contatoId: string) => {
    if (!cliente) return
    try {
      const res = await setContatoPrincipal(cliente.id, contatoId)
      if (res.success) {
        toast({
          title: 'Contato principal atualizado',
          description: 'Este contato agora é a referência principal deste cliente.',
        })
        fetchCliente()
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: res.error || 'Não foi possível atualizar o contato principal.',
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha na conexão.',
      })
    }
  }

  // Abrir modal de Nova Oportunidade pré-selecionando o cliente
  const handleOpenNovaOportunidade = () => {
    if (!cliente) return
    const nomeCliente =
      cliente.tipo === 'PJ'
        ? cliente.razao_social || cliente.nome_fantasia || 'Cliente PJ'
        : cliente.nome_completo || 'Cliente PF'
    openOpportunityModal(nomeCliente)
  }

  // 1. Loading
  if (loading && !cliente) {
    return (
      <PageStateLayout
        title="Ficha do cliente"
        subtitle="Carregando dados cadastrais, contatos e oportunidades..."
        icon={Building2}
        emptyMessage=""
        status="loading"
      />
    )
  }

  // 2. Erro ou Não encontrado
  if (error || !cliente) {
    return (
      <PageStateLayout
        title="Cliente não encontrado"
        subtitle="O cliente solicitado não existe ou você não tem permissão para acessá-lo."
        icon={Building2}
        emptyMessage="Não foi possível carregar as informações."
        actionLabel="Voltar para Clientes"
        onAction={() => navigate('/clientes')}
        status="error"
        onRetry={fetchCliente}
      />
    )
  }

  const isPJ = cliente.tipo === 'PJ'
  const isArquivado = cliente.situacao === 'arquivado'
  const nomeExibicao = isPJ
    ? cliente.razao_social || 'Razão Social não informada'
    : cliente.nome_completo || 'Nome não informado'
  const documentoFormatado = isPJ ? formatCNPJ(cliente.cnpj) : formatCPF(cliente.cpf)
  const contatosList = cliente.contatos || []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Botão voltar e breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/clientes"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors btn-press"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para lista de clientes</span>
        </Link>

        {isArquivado && (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-xs px-2.5 py-0.5 font-semibold flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5 text-amber-700" />
            Cliente arquivado
          </Badge>
        )}
      </div>

      {/* Topo da Ficha: Cabeçalho com identificação do cliente e ações principais */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 sm:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-xs ${
                isPJ ? 'bg-teal-600 text-white' : 'bg-sky-600 text-white'
              }`}
            >
              {isPJ ? <Building2 className="w-7 h-7" /> : <User className="w-7 h-7" />}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#0C2D48] tracking-tight">
                  {nomeExibicao}
                </h1>
                <Badge
                  className={`font-semibold border-none text-xs px-2.5 py-0.5 ${
                    isPJ ? 'bg-teal-100 text-teal-900' : 'bg-sky-100 text-sky-900'
                  }`}
                >
                  {isPJ ? 'Pessoa Jurídica (PJ)' : 'Pessoa Física (PF)'}
                </Badge>
              </div>

              {isPJ && cliente.nome_fantasia && (
                <p className="text-sm font-medium text-slate-600 mt-0.5">
                  Nome fantasia: <span className="text-slate-800">{cliente.nome_fantasia}</span>
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-500 mt-1.5">
                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded-md font-semibold text-slate-700">
                  {isPJ ? 'CNPJ' : 'CPF'}: {documentoFormatado || 'Não informado'}
                </span>

                {(cliente.cidade || cliente.uf) && (
                  <span className="flex items-center gap-1 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {[cliente.cidade, cliente.uf].filter(Boolean).join(' - ')}
                  </span>
                )}

                <span className="text-slate-400">
                  Cadastrado em {formatDateBR(cliente.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Botões de Ação no topo */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
            {/* Nova oportunidade para este cliente */}
            <Button
              onClick={handleOpenNovaOportunidade}
              className="h-10 px-4 rounded-xl bg-[#00A896] hover:bg-[#008f80] text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-xs btn-press"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nova oportunidade</span>
            </Button>

            {/* Editar dados */}
            <Button
              variant="outline"
              onClick={() => setEditClienteOpen(true)}
              className="h-10 px-3.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm flex items-center gap-2 btn-press"
            >
              <Edit2 className="w-4 h-4" />
              <span>Editar</span>
            </Button>

            {/* Arquivar / Reativar — só administrador e gestor (T2.02) */}
            {podeArquivarCliente && (
              <Button
                variant="outline"
                onClick={() => setToggleArchiveOpen(true)}
                className={`h-10 px-3.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 btn-press ${
                  isArquivado
                    ? 'border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                    : 'border-slate-200 text-slate-600 hover:bg-amber-50 hover:text-amber-800'
                }`}
              >
                {isArquivado ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-emerald-600" />
                    <span>Reativar cliente</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4 text-slate-500" />
                    <span>Arquivar</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Detalhes Cadastrais em Grid */}
        <CardContent className="p-5 sm:p-7">
          <h3 className="text-xs font-bold text-[#0C2D48] uppercase tracking-wider mb-4">
            Informações cadastrais e comerciais
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {isPJ ? (
              <>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-medium block">Segmento ou atividade</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                    {cliente.segmento || 'Não informado'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-medium block">Porte da empresa</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block capitalize">
                    {cliente.porte ? `${cliente.porte} empresa` : 'Não informado'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-medium block">Número de vidas</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                    {cliente.numero_vidas ? `${cliente.numero_vidas} vidas` : 'Não informado'}
                  </span>
                </div>
              </>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-medium block">Data de nascimento</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                  {cliente.data_de_nascimento
                    ? formatDateBR(cliente.data_de_nascimento)
                    : 'Não informada'}
                </span>
              </div>
            )}

            {/* Responsável comercial */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Responsável comercial</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {cliente.responsavel_comercial?.nome || 'Não atribuído'}
              </span>
            </div>

            {/* Origem */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Origem do cliente</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {cliente.origem || 'Não informada'}
              </span>
            </div>

            {/* Indicação */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Indicado por</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {cliente.indicado_por_nome ? (
                  <>
                    {cliente.indicado_por_nome}{' '}
                    {cliente.indicado_por_tipo && (
                      <span className="text-slate-500 font-normal text-xs">
                        ({cliente.indicado_por_tipo})
                      </span>
                    )}
                  </>
                ) : (
                  'Não houve indicação'
                )}
              </span>
            </div>

            {/* Situação */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Situação cadastral</span>
              <span className="mt-0.5 inline-flex items-center gap-1.5 font-semibold text-slate-800 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    cliente.situacao === 'ativo' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                {cliente.situacao === 'ativo' ? 'Ativo' : 'Arquivado'}
              </span>
            </div>
          </div>

          {/* Observações */}
          {cliente.observacoes && (
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Observações internas
              </span>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {cliente.observacoes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================
          BLOCO DE CONTATOS DO CLIENTE
         ======================================================== */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-bold text-[#0C2D48]">
                Contatos do cliente
              </CardTitle>
              <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-xs font-semibold">
                {contatosList.length} {contatosList.length === 1 ? 'contato' : 'contatos'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pessoas de contato com cargos, telefones, e-mails e marcação do contato principal.
            </p>
          </div>

          <Button
            onClick={() => {
              setEditingContato(null)
              setContatoModalOpen(true)
            }}
            size="sm"
            className="h-9 px-3.5 rounded-xl bg-[#00A896] hover:bg-[#008f80] text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs btn-press"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Adicionar contato</span>
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {contatosList.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700 mx-auto mb-2">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#0C2D48]">Nenhum contato adicionado ainda</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Cadastre os responsáveis pelo RH, Financeiro, Sócios ou interlocutores deste
                cliente.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingContato(null)
                  setContatoModalOpen(true)
                }}
                className="mt-3.5 h-8 px-3 rounded-xl text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Adicionar primeiro contato
              </Button>
            </div>
          ) : (
            <>
              {/* Tabela de contatos para telas médias/grandes */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/70 border-b border-slate-200">
                    <TableRow>
                      <TableHead className="font-bold text-[#0C2D48] text-xs">Nome</TableHead>
                      <TableHead className="font-bold text-[#0C2D48] text-xs">
                        Cargo / Área
                      </TableHead>
                      <TableHead className="font-bold text-[#0C2D48] text-xs">Telefone</TableHead>
                      <TableHead className="font-bold text-[#0C2D48] text-xs">E-mail</TableHead>
                      <TableHead className="font-bold text-[#0C2D48] text-xs">Principal</TableHead>
                      <TableHead className="text-right font-bold text-[#0C2D48] text-xs pr-6">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contatosList.map((ct) => (
                      <TableRow key={ct.id} className="hover:bg-slate-50/60 transition-colors">
                        <TableCell className="py-3 font-semibold text-sm text-[#0C2D48]">
                          {ct.nome}
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {ct.cargo_area}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-slate-600">
                          {ct.telefone ? (
                            <span className="flex items-center gap-1.5 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {formatPhoneBR(ct.telefone)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-xs text-slate-600">
                          {ct.email ? (
                            <span className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {ct.email}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          {ct.principal ? (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[11px] font-semibold flex items-center gap-1 w-fit">
                              <Star className="w-3 h-3 text-amber-600 fill-amber-500" />
                              Principal
                            </Badge>
                          ) : (
                            <button
                              onClick={() => handleSetPrincipal(ct.id)}
                              className="text-[11px] font-medium text-slate-500 hover:text-teal-700 hover:underline flex items-center gap-1"
                              title="Tornar contato principal"
                            >
                              <Star className="w-3 h-3 text-slate-400" />
                              Definir principal
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right pr-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingContato(ct)
                                setContatoModalOpen(true)
                              }}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg"
                              title="Editar contato"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Lista em cartões para mobile */}
              <div className="block sm:hidden divide-y divide-slate-100 p-3 space-y-2.5">
                {contatosList.map((ct) => (
                  <div key={ct.id} className="pt-2.5 first:pt-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-[#0C2D48]">{ct.nome}</span>
                          {ct.principal && (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] py-0 px-1 font-semibold flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                              Principal
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Área: <strong>{ct.cargo_area}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingContato(ct)
                            setContatoModalOpen(true)
                          }}
                          className="h-8 w-8 p-0 text-slate-500"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      {ct.telefone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{formatPhoneBR(ct.telefone)}</span>
                        </div>
                      )}
                      {ct.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{ct.email}</span>
                        </div>
                      )}
                    </div>

                    {!ct.principal && (
                      <button
                        onClick={() => handleSetPrincipal(ct.id)}
                        className="mt-2 text-[11px] font-medium text-teal-700 hover:underline flex items-center gap-1"
                      >
                        <Star className="w-3 h-3" />
                        Tornar contato principal
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ========================================================
          BLOCO DE OPORTUNIDADES DO CLIENTE
         ======================================================== */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-bold text-[#0C2D48]">
                Oportunidades deste cliente
              </CardTitle>
              <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs font-semibold">
                {oportunidades.length} {oportunidades.length === 1 ? 'aberta' : 'abertas'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Negociações, renovações e cotações vinculadas ao fluxo comercial da Nunes & Grossi.
            </p>
          </div>

          <Button
            onClick={handleOpenNovaOportunidade}
            size="sm"
            className="h-9 px-3.5 rounded-xl bg-[#00A896] hover:bg-[#008f80] text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs btn-press"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nova oportunidade para este cliente</span>
          </Button>
        </CardHeader>

        <CardContent className="p-0 sm:p-0">
          {oportunidades.length === 0 ? (
            <div className="text-center py-10 px-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700 mx-auto mb-2">
                <Briefcase className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#0C2D48]">
                Nenhuma oportunidade aberta no momento
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Quando houver uma cotação, implantação ou renovação para este cliente, ela aparecerá
                aqui no fluxo comercial.
              </p>
              <Button
                onClick={handleOpenNovaOportunidade}
                variant="outline"
                size="sm"
                className="mt-4 h-9 px-4 rounded-xl text-xs font-semibold text-teal-800 border-teal-200 hover:bg-teal-50 btn-press"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Criar oportunidade agora
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {oportunidades.map((opp) => (
                <div
                  key={opp.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs uppercase px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200 font-bold">
                        {opp.protocolo}
                      </span>
                      <span className="font-bold text-sm text-[#0C2D48]">
                        {opp.produto_nome}
                        {opp.seguradora_nome ? ` — ${opp.seguradora_nome}` : ''}
                      </span>
                      <Badge className="bg-slate-100 text-slate-700 border-none text-[10px]">
                        {opp.situacao}
                      </Badge>
                      {opp.usou_fluxo_generico && (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                          Fluxo padrão
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-500 mt-1.5">
                      <span className="font-medium text-teal-800">
                        Etapa: {opp.etapa_atual_nome || 'Inicial'}
                      </span>
                      <span>Resp: {opp.responsavel_comercial_nome}</span>
                      <span className="font-semibold text-slate-700">
                        {formatCurrencyBRL(opp.valor_estimado)}
                      </span>
                      <span>Previsto: {formatDateBR(opp.data_prevista_fechamento)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-9 px-3.5 rounded-xl border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Link to={`/oportunidades/${opp.id}`}>Ver oportunidade</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edição do Cliente */}
      <ClienteFormModal
        open={editClienteOpen}
        onOpenChange={setEditClienteOpen}
        cliente={cliente}
        onSuccess={(updated) => {
          setCliente(updated)
          toast({
            title: 'Dados do cliente atualizados',
            description: 'As alterações cadastrais foram salvas com sucesso.',
          })
          fetchCliente()
        }}
      />

      {/* Modal de Criação / Edição de Contato */}
      <ContatoFormModal
        open={contatoModalOpen}
        onOpenChange={setContatoModalOpen}
        clienteId={cliente.id}
        contato={editingContato}
        onSuccess={() => {
          toast({
            title: editingContato ? 'Contato atualizado' : 'Contato adicionado',
            description: 'As informações de contato foram registradas.',
          })
          fetchCliente()
        }}
      />

      {/* Diálogo de Confirmação: Arquivar / Reativar Cliente */}
      <AlertDialog open={toggleArchiveOpen} onOpenChange={setToggleArchiveOpen}>
        <AlertDialogContent className="rounded-2xl sm:max-w-[460px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isArquivado ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                {isArquivado ? <RefreshCw className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
              </div>
              <AlertDialogTitle className="text-lg font-bold text-[#0C2D48]">
                {isArquivado ? 'Reativar cliente?' : 'Arquivar este cliente?'}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-600 mt-2 leading-relaxed">
              {isArquivado
                ? 'Ao reativar, o cliente voltará a figurar na lista principal de clientes ativos da corretora.'
                : 'Nenhum cliente é apagado do sistema. Ao arquivar, o cliente é movido para o arquivo inativo mas todo o histórico cadastral e contatos permanecem preservados.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 pt-3">
            <AlertDialogCancel
              disabled={toggling}
              className="rounded-xl h-10 text-xs font-semibold"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleArchiveConfirm}
              disabled={toggling}
              className={`rounded-xl h-10 text-xs font-semibold ${
                isArquivado
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {toggling
                ? 'Processando...'
                : isArquivado
                  ? 'Sim, reativar cliente'
                  : 'Sim, arquivar cliente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
