import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Cliente,
  ClienteFormData,
  ClientePorte,
  ClienteTipo,
  IndicadoPorTipo,
} from '@/types/clientes'
import { createCliente, updateCliente, getResponsaveisComerciais } from '@/services/clientes'
import {
  formatCNPJ,
  formatCPF,
  formatDateBR,
  onlyDigits,
  isValidCNPJ,
  isValidCPF,
  ESTADOS_BRASIL,
} from '@/lib/clientes-utils'
import { Building2, User, AlertCircle, CheckCircle2, ExternalLink, Users } from 'lucide-react'

interface ClienteFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente?: Cliente | null // se fornecido, está em modo edição
  onSuccess: (cliente: Cliente) => void
}

export const ClienteFormModal: React.FC<ClienteFormModalProps> = ({
  open,
  onOpenChange,
  cliente,
  onSuccess,
}) => {
  const isEditing = Boolean(cliente?.id)

  const [tipo, setTipo] = useState<ClienteTipo>('PJ')

  // Campos PJ
  const [cnpj, setCnpj] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [segmento, setSegmento] = useState('')
  const [porte, setPorte] = useState<ClientePorte | ''>('')
  const [numeroVidas, setNumeroVidas] = useState<string>('')

  // Campos PF
  const [cpf, setCpf] = useState('')
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')

  // Campos comuns
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [origem, setOrigem] = useState('')
  const [indicadoPorTipo, setIndicadoPorTipo] = useState<IndicadoPorTipo | ''>('')
  const [indicadoPorNome, setIndicadoPorNome] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Estados da interface
  const [responsaveis, setResponsaveis] = useState<{ id: string; nome: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicateCliente, setDuplicateCliente] = useState<Cliente | null>(null)

  // Carregar lista de responsáveis comerciais
  useEffect(() => {
    if (open) {
      getResponsaveisComerciais().then((res) => {
        if (res.data) setResponsaveis(res.data)
      })
    }
  }, [open])

  // Preenche valores ao abrir em modo edição ou reseta ao abrir em modo criação
  useEffect(() => {
    if (open) {
      setErrors({})
      setDuplicateCliente(null)

      if (cliente) {
        setTipo(cliente.tipo)
        if (cliente.tipo === 'PJ') {
          setCnpj(formatCNPJ(cliente.cnpj || ''))
          setRazaoSocial(cliente.razao_social || '')
          setNomeFantasia(cliente.nome_fantasia || '')
          setSegmento(cliente.segmento || '')
          setPorte(cliente.porte || '')
          setNumeroVidas(
            cliente.numero_vidas !== null && cliente.numero_vidas !== undefined
              ? String(cliente.numero_vidas)
              : '',
          )
          setCpf('')
          setNomeCompleto('')
          setDataNascimento('')
        } else {
          setCpf(formatCPF(cliente.cpf || ''))
          setNomeCompleto(cliente.nome_completo || '')
          setDataNascimento(
            cliente.data_de_nascimento ? formatDateBR(cliente.data_de_nascimento) : '',
          )
          setCnpj('')
          setRazaoSocial('')
          setNomeFantasia('')
          setSegmento('')
          setPorte('')
          setNumeroVidas('')
        }
        setCidade(cliente.cidade || '')
        setUf(cliente.uf || '')
        setOrigem(cliente.origem || '')
        setIndicadoPorTipo(cliente.indicado_por_tipo || '')
        setIndicadoPorNome(cliente.indicado_por_nome || '')
        setResponsavelId(cliente.responsavel_comercial_id || '')
        setObservacoes(cliente.observacoes || '')
      } else {
        // Reset modo criação
        setTipo('PJ')
        setCnpj('')
        setRazaoSocial('')
        setNomeFantasia('')
        setSegmento('')
        setPorte('')
        setNumeroVidas('')
        setCpf('')
        setNomeCompleto('')
        setDataNascimento('')
        setCidade('')
        setUf('')
        setOrigem('')
        setIndicadoPorTipo('')
        setIndicadoPorNome('')
        setResponsavelId('')
        setObservacoes('')
      }
    }
  }, [open, cliente])

  const handleTipoChange = (newTipo: ClienteTipo) => {
    setTipo(newTipo)
    setErrors({})
    setDuplicateCliente(null)
  }

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value)
    setCnpj(formatted)
    setDuplicateCliente(null)
    if (errors.cnpj) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.cnpj
        return next
      })
    }
  }

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value)
    setCpf(formatted)
    setDuplicateCliente(null)
    if (errors.cpf) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.cpf
        return next
      })
    }
  }

  const handleDataNascimentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDateBR(e.target.value)
    setDataNascimento(formatted)
    if (errors.dataNascimento) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.dataNascimento
        return next
      })
    }
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    if (tipo === 'PJ') {
      const cnpjDigits = onlyDigits(cnpj)
      if (!cnpjDigits) {
        errs.cnpj = 'Informe o CNPJ da empresa.'
      } else if (cnpjDigits.length !== 14 || !isValidCNPJ(cnpjDigits)) {
        errs.cnpj = 'CNPJ inválido. Verifique os números digitados.'
      }

      if (!razaoSocial.trim()) {
        errs.razaoSocial = 'Preencha a razão social da empresa.'
      }
    } else {
      const cpfDigits = onlyDigits(cpf)
      if (!cpfDigits) {
        errs.cpf = 'Informe o CPF do cliente.'
      } else if (cpfDigits.length !== 11 || !isValidCPF(cpfDigits)) {
        errs.cpf = 'CPF inválido. Verifique os números digitados.'
      }

      if (!nomeCompleto.trim()) {
        errs.nomeCompleto = 'Preencha o nome completo do cliente.'
      }

      if (dataNascimento) {
        const nascDigits = onlyDigits(dataNascimento)
        if (nascDigits.length !== 8) {
          errs.dataNascimento = 'Informe a data no formato dd/mm/aaaa.'
        }
      }
    }

    if (numeroVidas && Number(numeroVidas) < 0) {
      errs.numeroVidas = 'O número de vidas não pode ser negativo.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDuplicateCliente(null)

    if (!validate()) return

    setSaving(true)

    const payload: ClienteFormData = {
      tipo,
      cidade: cidade.trim(),
      uf: uf.trim(),
      origem: origem.trim(),
      indicado_por_tipo: indicadoPorTipo || undefined,
      indicado_por_nome: indicadoPorNome.trim(),
      responsavel_comercial_id: responsavelId || undefined,
      observacoes: observacoes.trim(),
    }

    if (tipo === 'PJ') {
      payload.cnpj = cnpj
      payload.razao_social = razaoSocial.trim()
      payload.nome_fantasia = nomeFantasia.trim()
      payload.segmento = segmento.trim()
      payload.porte = porte || undefined
      payload.numero_vidas = numeroVidas ? Number(numeroVidas) : undefined
    } else {
      payload.cpf = cpf
      payload.nome_completo = nomeCompleto.trim()
      payload.data_de_nascimento = dataNascimento.trim()
    }

    try {
      if (isEditing && cliente?.id) {
        const res = await updateCliente(cliente.id, payload)
        if (!res.success) {
          if (res.error === 'Este cliente já está cadastrado') {
            setDuplicateCliente(res.existingCliente || null)
            setErrors({
              [tipo === 'PJ' ? 'cnpj' : 'cpf']: 'Este cliente já está cadastrado',
            })
          } else {
            setErrors({ general: res.error || 'Não foi possível salvar o cliente.' })
          }
          return
        }
        if (res.data) onSuccess(res.data)
        onOpenChange(false)
      } else {
        const res = await createCliente(payload)
        if (!res.success) {
          if (res.error === 'Este cliente já está cadastrado') {
            setDuplicateCliente(res.existingCliente || null)
            setErrors({
              [tipo === 'PJ' ? 'cnpj' : 'cpf']: 'Este cliente já está cadastrado',
            })
          } else {
            setErrors({ general: res.error || 'Não foi possível cadastrar o cliente.' })
          }
          return
        }
        if (res.data) onSuccess(res.data)
        onOpenChange(false)
      }
    } catch {
      setErrors({ general: 'Falha na conexão. Tente novamente.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto p-5 sm:p-7 rounded-2xl">
        <DialogHeader className="text-left pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
              {tipo === 'PJ' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-[#0C2D48]">
                {isEditing ? 'Editar cliente' : 'Novo cliente'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {isEditing
                  ? 'Atualize as informações cadastrais e comerciais do cliente.'
                  : 'Selecione se é Pessoa Jurídica ou Física e preencha os dados cadastrais.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Seletor do Tipo (PJ / PF) */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Tipo de pessoa
            </Label>
            <RadioGroup
              value={tipo}
              onValueChange={(val) => handleTipoChange(val as ClienteTipo)}
              className="grid grid-cols-2 gap-3"
            >
              <label
                htmlFor="tipo-pj"
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium cursor-pointer transition-colors ${
                  tipo === 'PJ'
                    ? 'border-teal-600 bg-white text-teal-950 ring-2 ring-teal-600/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-100/60 text-slate-700'
                }`}
              >
                <RadioGroupItem value="PJ" id="tipo-pj" />
                <div className="flex items-center gap-2 min-w-0">
                  <Building2
                    className={`w-4 h-4 ${tipo === 'PJ' ? 'text-teal-700' : 'text-slate-400'}`}
                  />
                  <span className="font-semibold text-xs sm:text-sm">Pessoa Jurídica (PJ)</span>
                </div>
              </label>

              <label
                htmlFor="tipo-pf"
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium cursor-pointer transition-colors ${
                  tipo === 'PF'
                    ? 'border-teal-600 bg-white text-teal-950 ring-2 ring-teal-600/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-100/60 text-slate-700'
                }`}
              >
                <RadioGroupItem value="PF" id="tipo-pf" />
                <div className="flex items-center gap-2 min-w-0">
                  <User
                    className={`w-4 h-4 ${tipo === 'PF' ? 'text-teal-700' : 'text-slate-400'}`}
                  />
                  <span className="font-semibold text-xs sm:text-sm">Pessoa Física (PF)</span>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Banner de erro quando documento já existe com link para ficha */}
          {duplicateCliente && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">Este cliente já está cadastrado</p>
                <p className="mt-0.5 text-amber-800">
                  Já existe um registro com este {tipo === 'PJ' ? 'CNPJ' : 'CPF'}:{' '}
                  <strong>{duplicateCliente.razao_social || duplicateCliente.nome_completo}</strong>
                  .
                </p>
                <div className="mt-2">
                  <Link
                    to={`/clientes/${duplicateCliente.id}`}
                    onClick={() => onOpenChange(false)}
                    className="inline-flex items-center gap-1 font-semibold text-teal-800 underline hover:text-teal-950"
                  >
                    Abrir a ficha do cliente existente
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {errors.general && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* ========================================================
              CAMPOS CONDICIONAIS PESSOA JURÍDICA
             ======================================================== */}
          {tipo === 'PJ' ? (
            <div className="space-y-3.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* CNPJ */}
                <div className="space-y-1.5">
                  <Label htmlFor="cli-cnpj" className="text-xs font-semibold text-slate-700">
                    CNPJ <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="cli-cnpj"
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    value={cnpj}
                    onChange={handleCnpjChange}
                    className={`h-10 rounded-xl text-sm ${
                      errors.cnpj ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                    }`}
                  />
                  {errors.cnpj && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {errors.cnpj}
                    </p>
                  )}
                </div>

                {/* Razão Social */}
                <div className="space-y-1.5">
                  <Label htmlFor="cli-razao" className="text-xs font-semibold text-slate-700">
                    Razão Social <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="cli-razao"
                    placeholder="Ex.: Nunes & Grossi Corretora Ltda"
                    value={razaoSocial}
                    onChange={(e) => {
                      setRazaoSocial(e.target.value)
                      if (errors.razaoSocial) {
                        setErrors((prev) => {
                          const n = { ...prev }
                          delete n.razaoSocial
                          return n
                        })
                      }
                    }}
                    className={`h-10 rounded-xl text-sm ${
                      errors.razaoSocial ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                    }`}
                  />
                  {errors.razaoSocial && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {errors.razaoSocial}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Nome Fantasia */}
                <div className="space-y-1.5">
                  <Label htmlFor="cli-fantasia" className="text-xs font-semibold text-slate-700">
                    Nome Fantasia
                  </Label>
                  <Input
                    id="cli-fantasia"
                    placeholder="Ex.: Nunes & Grossi Seguros"
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    className="h-10 rounded-xl text-sm border-slate-200"
                  />
                </div>

                {/* Segmento ou Atividade */}
                <div className="space-y-1.5">
                  <Label htmlFor="cli-segmento" className="text-xs font-semibold text-slate-700">
                    Segmento ou atividade
                  </Label>
                  <Input
                    id="cli-segmento"
                    placeholder="Ex.: Tecnologia, Indústria, Saúde..."
                    value={segmento}
                    onChange={(e) => setSegmento(e.target.value)}
                    className="h-10 rounded-xl text-sm border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Porte */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Porte da empresa</Label>
                  <Select
                    value={porte || 'none'}
                    onValueChange={(val) => setPorte(val === 'none' ? '' : (val as ClientePorte))}
                  >
                    <SelectTrigger className="h-10 rounded-xl text-sm border-slate-200">
                      <SelectValue placeholder="Selecione o porte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não informado</SelectItem>
                      <SelectItem value="micro">Microempresa (ME)</SelectItem>
                      <SelectItem value="pequena">Pequena empresa (EPP)</SelectItem>
                      <SelectItem value="média">Média empresa</SelectItem>
                      <SelectItem value="grande">Grande empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Número de Vidas */}
                <div className="space-y-1.5">
                  <Label htmlFor="cli-vidas" className="text-xs font-semibold text-slate-700">
                    Número de vidas (opcional)
                  </Label>
                  <div className="relative">
                    <Users className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      id="cli-vidas"
                      type="number"
                      min={0}
                      placeholder="Ex.: 45"
                      value={numeroVidas}
                      onChange={(e) => setNumeroVidas(e.target.value)}
                      className="h-10 pl-9 rounded-xl text-sm border-slate-200"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================
               CAMPOS CONDICIONAIS PESSOA FÍSICA
               ======================================================== */
            <div className="space-y-3.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* CPF */}
                <div className="space-y-1.5">
                  <Label htmlFor="cli-cpf" className="text-xs font-semibold text-slate-700">
                    CPF <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="cli-cpf"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    value={cpf}
                    onChange={handleCpfChange}
                    className={`h-10 rounded-xl text-sm ${
                      errors.cpf ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                    }`}
                  />
                  {errors.cpf && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {errors.cpf}
                    </p>
                  )}
                </div>

                {/* Nome Completo */}
                <div className="space-y-1.5">
                  <Label htmlFor="cli-nome" className="text-xs font-semibold text-slate-700">
                    Nome Completo <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="cli-nome"
                    placeholder="Ex.: Maria Aparecida da Silva"
                    value={nomeCompleto}
                    onChange={(e) => {
                      setNomeCompleto(e.target.value)
                      if (errors.nomeCompleto) {
                        setErrors((prev) => {
                          const n = { ...prev }
                          delete n.nomeCompleto
                          return n
                        })
                      }
                    }}
                    className={`h-10 rounded-xl text-sm ${
                      errors.nomeCompleto ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                    }`}
                  />
                  {errors.nomeCompleto && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {errors.nomeCompleto}
                    </p>
                  )}
                </div>
              </div>

              {/* Data de Nascimento */}
              <div className="space-y-1.5 max-w-sm">
                <Label htmlFor="cli-nasc" className="text-xs font-semibold text-slate-700">
                  Data de nascimento (dd/mm/aaaa)
                </Label>
                <Input
                  id="cli-nasc"
                  placeholder="Ex.: 15/08/1985"
                  maxLength={10}
                  value={dataNascimento}
                  onChange={handleDataNascimentoChange}
                  className={`h-10 rounded-xl text-sm ${
                    errors.dataNascimento ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                  }`}
                />
                {errors.dataNascimento && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {errors.dataNascimento}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              CAMPOS COMUNS (Localização, Origem, Indicação, Responsável)
             ======================================================== */}
          <div className="pt-2 border-t border-slate-100 space-y-3.5">
            <h4 className="text-xs font-bold text-[#0C2D48] uppercase tracking-wider">
              Localização e Atendimento Comercial
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Cidade */}
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cli-cidade" className="text-xs font-semibold text-slate-700">
                  Cidade
                </Label>
                <Input
                  id="cli-cidade"
                  placeholder="Ex.: Santos, São Paulo, Campinas..."
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="h-10 rounded-xl text-sm border-slate-200"
                />
              </div>

              {/* UF */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">UF</Label>
                <Select
                  value={uf || 'none'}
                  onValueChange={(val) => setUf(val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="h-10 rounded-xl text-sm border-slate-200">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">Selecione</SelectItem>
                    {ESTADOS_BRASIL.map((est) => (
                      <SelectItem key={est.sigla} value={est.sigla}>
                        {est.sigla} - {est.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Origem */}
              <div className="space-y-1.5">
                <Label htmlFor="cli-origem" className="text-xs font-semibold text-slate-700">
                  Origem do cliente
                </Label>
                <Input
                  id="cli-origem"
                  placeholder="Ex.: Site N&G, Google, Telefone, Feira..."
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  className="h-10 rounded-xl text-sm border-slate-200"
                />
              </div>

              {/* Responsável Comercial */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Responsável comercial
                </Label>
                <Select
                  value={responsavelId || 'none'}
                  onValueChange={(val) => setResponsavelId(val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="h-10 rounded-xl text-sm border-slate-200">
                    <SelectValue placeholder="Selecione um responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável definido</SelectItem>
                    {responsaveis.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Indicação: Tipo + Nome */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Indicado por (tipo)</Label>
                <Select
                  value={indicadoPorTipo || 'none'}
                  onValueChange={(val) =>
                    setIndicadoPorTipo(val === 'none' ? '' : (val as IndicadoPorTipo))
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl text-sm border-slate-200">
                    <SelectValue placeholder="Não houve indicação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não houve indicação</SelectItem>
                    <SelectItem value="cliente">Cliente da carteira</SelectItem>
                    <SelectItem value="colaborador">Colaborador da N&G</SelectItem>
                    <SelectItem value="parceiro">Parceiro comercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cli-ind-nome" className="text-xs font-semibold text-slate-700">
                  Nome de quem indicou
                </Label>
                <Input
                  id="cli-ind-nome"
                  placeholder="Nome da pessoa ou parceiro"
                  value={indicadoPorNome}
                  onChange={(e) => setIndicadoPorNome(e.target.value)}
                  className="h-10 rounded-xl text-sm border-slate-200"
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="cli-obs" className="text-xs font-semibold text-slate-700">
                Observações internas
              </Label>
              <Textarea
                id="cli-obs"
                rows={3}
                placeholder="Anotações comerciais, particularidades de atendimento, histórico de relacionamento..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="resize-none rounded-xl text-sm border-slate-200"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-11 px-5 rounded-xl text-slate-600 border-slate-200 hover:bg-slate-100 btn-press"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-11 px-6 rounded-xl bg-[#0C2D48] hover:bg-[#071d30] text-white font-semibold flex items-center gap-2 shadow-sm btn-press"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar cliente'}
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export default ClienteFormModal
