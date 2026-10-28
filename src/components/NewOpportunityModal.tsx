import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import {
  Briefcase,
  Calendar,
  DollarSign,
  User,
  AlertCircle,
  CheckCircle2,
  Search,
  PlusCircle,
  Building2,
  X,
  Sparkles,
  Info,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { getCatalogoCompleto } from '@/services/catalogo'
import { getClientes, createCliente } from '@/services/clientes'
import { getResponsaveisComerciais } from '@/services/clientes'
import { createOportunidade } from '@/services/oportunidades'
import { Cliente, ClienteTipo } from '@/types/clientes'
import { ProdutoCatalogo, SeguradoraOperadora, OrigemLead } from '@/types/catalogo'
import {
  normalizarDocumento,
  formatCPF,
  formatCNPJ,
  isValidCPF,
  isValidCNPJ,
  parseDateBRToISO,
} from '@/lib/clientes-utils'

interface NewOpportunityModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialClient?: string
}

export const formatCurrencyBRL = (value: string | number): string => {
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const num = Number(digits) / 100
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export const parseCurrencyToNumber = (value: string): number => {
  const digits = value.replace(/\D/g, '')
  if (!digits) return 0
  return Number(digits) / 100
}

export const formatDateBR = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
}

export const NewOpportunityModal: React.FC<NewOpportunityModalProps> = ({
  open,
  onOpenChange,
  initialClient = '',
}) => {
  const { toast } = useToast()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  // Catálogos e opções
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([])
  const [seguradoras, setSeguradoras] = useState<SeguradoraOperadora[]>([])
  const [origens, setOrigens] = useState<OrigemLead[]>([])
  const [responsaveis, setResponsaveis] = useState<{ id: string; nome: string; email: string }[]>(
    [],
  )
  const [catalogLoading, setCatalogLoading] = useState(false)

  // Cliente selecionado e busca
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const [clientSearchResults, setClientSearchResults] = useState<Cliente[]>([])
  const [clientSearching, setClientSearching] = useState(false)
  const [showClientDropdown, setShowClientDropdown] = useState(false)

  // Modo rápido de cadastro de cliente
  const [quickClientMode, setQuickClientMode] = useState(false)
  const [quickTipo, setQuickTipo] = useState<ClienteTipo>('PJ')
  const [quickDocumento, setQuickDocumento] = useState('')
  const [quickNome, setQuickNome] = useState('')
  const [quickError, setQuickError] = useState<string | null>(null)
  const [quickExistingCliente, setQuickExistingCliente] = useState<Cliente | null>(null)
  const [creatingQuickClient, setCreatingQuickClient] = useState(false)

  // Formulário de Oportunidade
  const [produtoId, setProdutoId] = useState('')
  const [seguradoraId, setSeguradoraId] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [origemId, setOrigemId] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [deadline, setDeadline] = useState('')
  const [notes, setNotes] = useState('')

  // Estado de submissão e erros
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{
    cliente?: string
    produto?: string
    seguradora?: string
    responsavel?: string
    origem?: string
    deadline?: string
    valor?: string
  }>({})

  // Carrega catálogos e usuários ao abrir
  useEffect(() => {
    if (!open) return

    let isMounted = true
    setCatalogLoading(true)

    const loadData = async () => {
      try {
        const [catRes, respRes] = await Promise.all([
          getCatalogoCompleto(),
          getResponsaveisComerciais(),
        ])

        if (!isMounted) return

        if (catRes.data) {
          // T4.02 (emenda 20/10) — só o que está ativo aparece na abertura.
          // Produtos e seguradoras já eram filtrados; as origens não eram, então uma origem
          // desativada continuava podendo ser escolhida aqui.
          setProdutos(catRes.data.produtos.filter((p) => p.situacao === 'ativa'))
          setSeguradoras(catRes.data.seguradoras.filter((s) => s.situacao === 'ativa'))
          setOrigens(catRes.data.origensLead.filter((o) => o.situacao === 'ativa'))
        }

        if (respRes.data) {
          setResponsaveis(respRes.data)
        }
      } catch (err) {
        console.error('Erro ao carregar dados para o modal de oportunidade:', err)
      } finally {
        if (isMounted) setCatalogLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [open])

  // Inicializa responsável padrão com usuário logado
  useEffect(() => {
    if (open && profile?.id && !responsavelId) {
      setResponsavelId(profile.id)
    }
  }, [open, profile?.id, responsavelId])

  // Busca cliente inicial se passado via props
  useEffect(() => {
    if (open && initialClient) {
      const matchInitialClient = async () => {
        setClientSearching(true)
        const res = await getClientes({ search: initialClient, situacao: 'ativo' })
        if (res.data && res.data.length > 0) {
          const found =
            res.data.find(
              (c) =>
                (c.tipo === 'PJ' ? c.razao_social : c.nome_completo)?.toLowerCase() ===
                initialClient.toLowerCase(),
            ) || res.data[0]
          setSelectedCliente(found)
          setClientSearchTerm('')
        } else {
          setClientSearchTerm(initialClient)
        }
        setClientSearching(false)
      }
      matchInitialClient()
    }
  }, [open, initialClient])

  // Debounced search para clientes cadastrados
  useEffect(() => {
    if (!open || selectedCliente || quickClientMode) {
      setClientSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      if (clientSearchTerm.trim().length >= 2) {
        setClientSearching(true)
        const res = await getClientes({ search: clientSearchTerm, situacao: 'ativo' })
        setClientSearchResults(res.data || [])
        setClientSearching(false)
        setShowClientDropdown(true)
      } else {
        setClientSearchResults([])
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [clientSearchTerm, open, selectedCliente, quickClientMode])

  // Produto selecionado atualmente
  const selectedProduto = useMemo(() => {
    return produtos.find((p) => p.id === produtoId) || null
  }, [produtos, produtoId])

  // Seguradoras/Operadoras filtradas pela frente do produto selecionado
  const filteredSeguradoras = useMemo(() => {
    if (!selectedProduto) return []
    return seguradoras.filter((s) => s.frente === selectedProduto.frente)
  }, [seguradoras, selectedProduto])

  // Reset de seguradora se o produto mudar para uma frente incompatível
  useEffect(() => {
    if (seguradoraId && selectedProduto) {
      const currentSeg = seguradoras.find((s) => s.id === seguradoraId)
      if (currentSeg && currentSeg.frente !== selectedProduto.frente) {
        setSeguradoraId('')
      }
    }
  }, [produtoId, selectedProduto, seguradoras, seguradoraId])

  // Reset do formulário ao fechar
  const resetForm = () => {
    setSelectedCliente(null)
    setClientSearchTerm('')
    setClientSearchResults([])
    setShowClientDropdown(false)
    setQuickClientMode(false)
    setQuickTipo('PJ')
    setQuickDocumento('')
    setQuickNome('')
    setQuickError(null)
    setQuickExistingCliente(null)

    setProdutoId('')
    setSeguradoraId('')
    setResponsavelId(profile?.id || '')
    setOrigemId('')
    setEstimatedValue('')
    setDeadline('')
    setNotes('')
    setErrors({})
    setIsSubmitting(false)
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  // Manipulador do cadastro rápido de cliente
  const handleCreateQuickClient = async () => {
    setQuickError(null)
    setQuickExistingCliente(null)

    // T3.01 — normalizarDocumento preserva letras: o cadastro rápido também precisa
    // aceitar o CNPJ alfanumérico, senão a Nova Oportunidade recusa o que o cadastro aceita.
    const docDigits = normalizarDocumento(quickDocumento, quickTipo === 'PJ' ? 'PJ' : 'PF')
    if (!docDigits) {
      setQuickError(quickTipo === 'PJ' ? 'Informe o CNPJ da empresa.' : 'Informe o CPF do cliente.')
      return
    }

    if (quickTipo === 'PJ') {
      if (docDigits.length !== 14 || !isValidCNPJ(docDigits)) {
        setQuickError('CNPJ inválido. Confira os números e, se houver, as letras.')
        return
      }
    } else {
      if (docDigits.length !== 11 || !isValidCPF(docDigits)) {
        setQuickError('CPF inválido. Verifique os números digitados.')
        return
      }
    }

    if (!quickNome.trim()) {
      setQuickError(
        quickTipo === 'PJ'
          ? 'Informe a Razão Social da empresa.'
          : 'Informe o nome completo do cliente.',
      )
      return
    }

    setCreatingQuickClient(true)

    // A origem do cliente pode herdar da origem se já foi selecionada
    const matchedOrigem = origens.find((o) => o.id === origemId)
    const origemNome = matchedOrigem?.nome || null

    const res = await createCliente({
      tipo: quickTipo,
      razao_social: quickTipo === 'PJ' ? quickNome.trim() : undefined,
      nome_completo: quickTipo === 'PF' ? quickNome.trim() : undefined,
      cnpj: quickTipo === 'PJ' ? docDigits : undefined,
      cpf: quickTipo === 'PF' ? docDigits : undefined,
      responsavel_comercial_id: responsavelId || profile?.id || undefined,
      origem: origemNome || undefined,
      origem_id: origemId || undefined,
    })

    setCreatingQuickClient(false)

    if (res.success && res.data) {
      toast({
        title: 'Cliente cadastrado com sucesso!',
        description: `${quickNome.trim()} já foi selecionado para a oportunidade.`,
        className: 'bg-emerald-50 border-emerald-200 text-emerald-950',
      })
      setSelectedCliente(res.data)
      setQuickClientMode(false)
      setQuickDocumento('')
      setQuickNome('')
      setQuickError(null)
      if (errors.cliente) setErrors((prev) => ({ ...prev, cliente: undefined }))
    } else {
      if (res.existingCliente) {
        setQuickExistingCliente(res.existingCliente)
        setQuickError('Este cliente já está cadastrado.')
      } else {
        setQuickError(res.error || 'Não foi possível cadastrar o cliente.')
      }
    }
  }

  // Submissão da oportunidade
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: typeof errors = {}

    if (!selectedCliente) {
      newErrors.cliente = 'Selecione ou cadastre o cliente da oportunidade.'
    }

    if (!produtoId) {
      newErrors.produto = 'Selecione o produto.'
    }

    // Seguradora: Se houver seguradoras ativas na frente do produto, exige seleção
    if (filteredSeguradoras.length > 0 && !seguradoraId) {
      newErrors.seguradora =
        selectedProduto?.frente === 'Saúde'
          ? 'Selecione a operadora de saúde.'
          : 'Selecione a seguradora.'
    }

    if (!responsavelId) {
      newErrors.responsavel = 'Selecione o responsável comercial.'
    }

    if (!origemId) {
      newErrors.origem = 'Selecione a origem da oportunidade.'
    }

    if (!deadline || deadline.length < 10) {
      newErrors.deadline = 'Informe a data prevista no formato dd/mm/aaaa.'
    } else {
      const isoDate = parseDateBRToISO(deadline)
      if (!isoDate) {
        newErrors.deadline = 'Data inválida.'
      }
    }

    const valorNumerico = parseCurrencyToNumber(estimatedValue)

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const isoDate = parseDateBRToISO(deadline)!

    setIsSubmitting(true)

    const res = await createOportunidade({
      cliente_id: selectedCliente!.id,
      produto_id: produtoId,
      seguradora_id: seguradoraId || null,
      responsavel_comercial_id: responsavelId,
      origem_id: origemId,
      valor_estimado: valorNumerico,
      data_prevista_fechamento: isoDate,
      observacoes: notes.trim() || null,
    })

    setIsSubmitting(false)

    if (res.error || !res.data) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível abrir a oportunidade',
        description: res.error || 'Ocorreu um erro no servidor. Tente novamente.',
      })
      return
    }

    const createdOpp = res.data

    // Aviso quando o fluxo genérico foi acionado
    if (createdOpp.usou_fluxo_generico) {
      toast({
        title: `Oportunidade ${createdOpp.protocolo} aberta`,
        description: 'Este produto ainda não tem um fluxo próprio; usamos o fluxo padrão.',
        className: 'bg-amber-50 border-amber-200 text-amber-950',
      })
    } else {
      toast({
        title: `Oportunidade ${createdOpp.protocolo} aberta com sucesso!`,
        description: 'O fluxo de etapas foi gerado e está pronto para andamento.',
        className: 'bg-emerald-50 border-emerald-200 text-emerald-950',
      })
    }

    // Fecha o modal e redireciona para a ficha da oportunidade recém-criada
    handleClose()
    navigate(`/oportunidades/${createdOpp.id}`)
  }

  // Label amigável de Seguradora ou Operadora
  const seguradoraLabel = selectedProduto?.frente === 'Saúde' ? 'Operadora' : 'Seguradora'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto p-6 rounded-2xl">
        <DialogHeader className="text-left pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-[#0C2D48]">
                Nova oportunidade
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Preencha os dados comerciais para abrir o fluxo da negociação.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          {/* ========================================================
              SEÇÃO CLIENTE (Busca + Cadastro Rápido)
             ======================================================== */}
          <div className="space-y-2 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                Cliente <span className="text-red-500">*</span>
              </Label>

              {!selectedCliente && (
                <button
                  type="button"
                  onClick={() => {
                    setQuickClientMode(!quickClientMode)
                    setQuickError(null)
                    setQuickExistingCliente(null)
                  }}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1"
                >
                  {quickClientMode ? (
                    'Voltar para busca de clientes'
                  ) : (
                    <>
                      <PlusCircle className="w-3.5 h-3.5" />
                      Cadastrar cliente rápido
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Caso 1: Cliente já selecionado */}
            {selectedCliente ? (
              <div className="p-3 bg-white rounded-xl border border-teal-200 flex items-center justify-between shadow-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#0C2D48] truncate">
                      {selectedCliente.tipo === 'PJ'
                        ? selectedCliente.razao_social
                        : selectedCliente.nome_completo}
                    </span>
                    <Badge className="bg-teal-100 text-teal-900 border-none text-[10px] px-2 py-0.5">
                      {selectedCliente.tipo}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedCliente.tipo === 'PJ'
                      ? formatCNPJ(selectedCliente.cnpj)
                      : formatCPF(selectedCliente.cpf)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCliente(null)
                    setClientSearchTerm('')
                  }}
                  className="h-8 px-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs"
                >
                  <X className="w-4 h-4 mr-1" />
                  Trocar
                </Button>
              </div>
            ) : quickClientMode ? (
              /* Caso 2: Modo de Cadastro Rápido */
              <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-200">
                <div className="flex items-center gap-4">
                  <Label className="text-xs font-medium text-slate-600">Tipo de cliente:</Label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="quickTipo"
                        checked={quickTipo === 'PJ'}
                        onChange={() => {
                          setQuickTipo('PJ')
                          setQuickDocumento('')
                        }}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      Pessoa Jurídica (PJ)
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="quickTipo"
                        checked={quickTipo === 'PF'}
                        onChange={() => {
                          setQuickTipo('PF')
                          setQuickDocumento('')
                        }}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      Pessoa Física (PF)
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">
                      {quickTipo === 'PJ' ? 'CNPJ' : 'CPF'} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder={quickTipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                      value={quickDocumento}
                      onChange={(e) => {
                        const val = e.target.value
                        setQuickDocumento(quickTipo === 'PJ' ? formatCNPJ(val) : formatCPF(val))
                        setQuickError(null)
                        setQuickExistingCliente(null)
                      }}
                      className="h-10 text-xs rounded-lg font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">
                      {quickTipo === 'PJ' ? 'Razão Social' : 'Nome Completo'}{' '}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder={
                        quickTipo === 'PJ' ? 'Ex.: Alpha Serviços LTDA' : 'Ex.: Maria dos Santos'
                      }
                      value={quickNome}
                      onChange={(e) => {
                        setQuickNome(e.target.value)
                        setQuickError(null)
                      }}
                      className="h-10 text-xs rounded-lg"
                    />
                  </div>
                </div>

                {quickError && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{quickError}</span>
                    </div>
                    {quickExistingCliente && (
                      <div className="pt-1 text-slate-600 flex items-center justify-between">
                        <span>
                          {quickExistingCliente.tipo === 'PJ'
                            ? quickExistingCliente.razao_social
                            : quickExistingCliente.nome_completo}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCliente(quickExistingCliente)
                              setQuickClientMode(false)
                              setQuickError(null)
                            }}
                            className="h-7 px-2 text-[11px] text-teal-800 border-teal-300 hover:bg-teal-50"
                          >
                            Usar este cliente
                          </Button>
                          <Link
                            to={`/clientes/${quickExistingCliente.id}`}
                            target="_blank"
                            className="text-[11px] text-teal-700 hover:underline flex items-center gap-0.5"
                          >
                            Ver ficha <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQuickClientMode(false)
                      setQuickError(null)
                    }}
                    className="h-9 px-3 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={creatingQuickClient}
                    onClick={handleCreateQuickClient}
                    className="h-9 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
                  >
                    {creatingQuickClient ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Cadastrando...
                      </>
                    ) : (
                      'Salvar e usar cliente'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              /* Caso 3: Busca padrão de cliente */
              <div className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    placeholder="Digite a razão social, nome ou CNPJ/CPF do cliente..."
                    value={clientSearchTerm}
                    onChange={(e) => {
                      setClientSearchTerm(e.target.value)
                      if (errors.cliente) setErrors((prev) => ({ ...prev, cliente: undefined }))
                    }}
                    onFocus={() => {
                      if (clientSearchResults.length > 0) setShowClientDropdown(true)
                    }}
                    className={`h-11 pl-9 rounded-xl text-xs bg-white ${
                      errors.cliente ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                    }`}
                  />
                  {clientSearching && (
                    <Loader2 className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
                  )}
                </div>

                {/* Dropdown de resultados de clientes */}
                {showClientDropdown && clientSearchResults.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-lg divide-y divide-slate-100">
                    {clientSearchResults.map((c) => {
                      const nome = c.tipo === 'PJ' ? c.razao_social : c.nome_completo
                      const doc = c.tipo === 'PJ' ? formatCNPJ(c.cnpj) : formatCPF(c.cpf)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCliente(c)
                            setShowClientDropdown(false)
                            setClientSearchTerm('')
                            if (errors.cliente)
                              setErrors((prev) => ({ ...prev, cliente: undefined }))
                          }}
                          className="w-full text-left p-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 block truncate">
                              {nome}
                            </span>
                            <span className="text-slate-500 font-mono text-[11px]">{doc}</span>
                          </div>
                          <Badge className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 ml-2">
                            {c.tipo}
                          </Badge>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {errors.cliente && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors.cliente}
              </p>
            )}
          </div>

          {/* ========================================================
              PRODUTO & SEGURADORA / OPERADORA
             ======================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Produto */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                Produto <span className="text-red-500">*</span>
              </Label>
              <Select
                value={produtoId}
                onValueChange={(val) => {
                  setProdutoId(val)
                  if (errors.produto) setErrors((prev) => ({ ...prev, produto: undefined }))
                }}
              >
                <SelectTrigger
                  className={`h-11 rounded-xl text-xs ${
                    errors.produto ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                  }`}
                >
                  <SelectValue placeholder="Selecione o produto..." />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.nome} <span className="text-slate-400 text-[11px]">({p.frente})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.produto && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {errors.produto}
                </p>
              )}
            </div>

            {/* Seguradora / Operadora */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                {seguradoraLabel}{' '}
                {filteredSeguradoras.length > 0 && <span className="text-red-500">*</span>}
              </Label>
              <Select
                value={seguradoraId}
                onValueChange={(val) => {
                  setSeguradoraId(val)
                  if (errors.seguradora) setErrors((prev) => ({ ...prev, seguradora: undefined }))
                }}
                disabled={!selectedProduto}
              >
                <SelectTrigger
                  className={`h-11 rounded-xl text-xs ${
                    errors.seguradora ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                  }`}
                >
                  <SelectValue
                    placeholder={
                      !selectedProduto
                        ? 'Selecione primeiro o produto'
                        : filteredSeguradoras.length === 0
                          ? `Nenhuma ${seguradoraLabel.toLowerCase()} cadastrada nesta frente`
                          : `Selecione a ${seguradoraLabel.toLowerCase()}...`
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredSeguradoras.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.seguradora && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {errors.seguradora}
                </p>
              )}
            </div>
          </div>

          {/* ========================================================
              RESPONSÁVEL COMERCIAL & ORIGEM DO LEAD
             ======================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Responsável Comercial */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                Responsável comercial <span className="text-red-500">*</span>
              </Label>
              <Select
                value={responsavelId}
                onValueChange={(val) => {
                  setResponsavelId(val)
                  if (errors.responsavel) setErrors((prev) => ({ ...prev, responsavel: undefined }))
                }}
              >
                <SelectTrigger
                  className={`h-11 rounded-xl text-xs ${
                    errors.responsavel ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                  }`}
                >
                  <SelectValue placeholder="Selecione o responsável..." />
                </SelectTrigger>
                <SelectContent>
                  {responsaveis.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {u.nome} {u.id === profile?.id ? '(você)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.responsavel && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {errors.responsavel}
                </p>
              )}
            </div>

            {/* Origem */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                Origem <span className="text-red-500">*</span>
              </Label>
              <Select
                value={origemId}
                onValueChange={(val) => {
                  setOrigemId(val)
                  if (errors.origem) setErrors((prev) => ({ ...prev, origem: undefined }))
                }}
              >
                <SelectTrigger
                  className={`h-11 rounded-xl text-xs ${
                    errors.origem ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                  }`}
                >
                  <SelectValue placeholder="Selecione a origem..." />
                </SelectTrigger>
                <SelectContent>
                  {origens.map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-xs">
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.origem && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {errors.origem}
                </p>
              )}
            </div>
          </div>

          {/* ========================================================
              VALOR ESTIMADO & DATA PREVISTA DE FECHAMENTO
             ======================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="opp-value" className="text-xs font-semibold text-slate-700">
                Valor estimado (prêmio ou mensalidade)
              </Label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="opp-value"
                  placeholder="R$ 0,00"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(formatCurrencyBRL(e.target.value))}
                  className="h-11 pl-10 rounded-xl text-xs border-slate-200 focus-visible:ring-2 focus-visible:ring-teal-600 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="opp-deadline"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1"
              >
                Data prevista de fechamento <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="opp-deadline"
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                  value={deadline}
                  onChange={(e) => {
                    setDeadline(formatDateBR(e.target.value))
                    if (errors.deadline) setErrors((prev) => ({ ...prev, deadline: undefined }))
                  }}
                  className={`h-11 pl-10 rounded-xl text-xs transition-all focus-visible:ring-2 focus-visible:ring-teal-600 font-mono ${
                    errors.deadline ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                  }`}
                />
              </div>
              {errors.deadline && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {errors.deadline}
                </p>
              )}
            </div>
          </div>

          {/* ========================================================
              OBSERVAÇÕES
             ======================================================== */}
          <div className="space-y-1.5">
            <Label htmlFor="opp-notes" className="text-xs font-semibold text-slate-700">
              Observações
            </Label>
            <Textarea
              id="opp-notes"
              rows={2}
              placeholder="Detalhes adicionais, requisitos de cobertura, operadora de preferência..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none rounded-xl text-xs border-slate-200 focus-visible:ring-2 focus-visible:ring-teal-600"
            />
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="h-11 px-5 rounded-xl text-slate-600 border-slate-200 hover:bg-slate-100 btn-press text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || catalogLoading}
              className="h-11 px-6 rounded-xl bg-[#0C2D48] hover:bg-[#071d30] text-white font-semibold flex items-center gap-2 shadow-sm btn-press text-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando oportunidade...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Salvar oportunidade
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default NewOpportunityModal
