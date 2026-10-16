import React, { useState, useEffect } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClienteContato, ClienteContatoFormData, ContatoCargoArea } from '@/types/clientes'
import { createContato, updateContato } from '@/services/clientes'
import { formatPhoneBR, onlyDigits } from '@/lib/clientes-utils'
import { Contact, AlertCircle, CheckCircle2 } from 'lucide-react'

interface ContatoFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clienteId: string
  contato?: ClienteContato | null
  onSuccess: (contato: ClienteContato) => void
}

export const ContatoFormModal: React.FC<ContatoFormModalProps> = ({
  open,
  onOpenChange,
  clienteId,
  contato,
  onSuccess,
}) => {
  const isEditing = Boolean(contato?.id)

  const [nome, setNome] = useState('')
  const [cargoArea, setCargoArea] = useState<ContatoCargoArea>('Outro')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [principal, setPrincipal] = useState(false)

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setErrors({})
      if (contato) {
        setNome(contato.nome || '')
        setCargoArea(contato.cargo_area || 'Outro')
        setTelefone(formatPhoneBR(contato.telefone || ''))
        setEmail(contato.email || '')
        setPrincipal(Boolean(contato.principal))
      } else {
        setNome('')
        setCargoArea('Outro')
        setTelefone('')
        setEmail('')
        setPrincipal(false)
      }
    }
  }, [open, contato])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatPhoneBR(e.target.value))
    if (errors.telefone) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.telefone
        return next
      })
    }
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    if (!nome.trim()) {
      errs.nome = 'Preencha o nome do contato.'
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'E-mail em formato inválido.'
    }

    if (telefone) {
      const digits = onlyDigits(telefone)
      if (digits.length < 10) {
        errs.telefone = 'Informe o DDD e telefone completo (mínimo 10 dígitos).'
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    const payload: ClienteContatoFormData = {
      nome: nome.trim(),
      cargo_area: cargoArea,
      telefone: telefone.trim(),
      email: email.trim(),
      principal,
    }

    try {
      if (isEditing && contato?.id) {
        const res = await updateContato(contato.id, payload)
        if (!res.success || !res.data) {
          setErrors({ general: res.error || 'Não foi possível atualizar o contato.' })
          return
        }
        onSuccess(res.data)
        onOpenChange(false)
      } else {
        const res = await createContato(clienteId, payload)
        if (!res.success || !res.data) {
          setErrors({ general: res.error || 'Não foi possível criar o contato.' })
          return
        }
        onSuccess(res.data)
        onOpenChange(false)
      }
    } catch {
      setErrors({ general: 'Falha de conexão. Tente novamente.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="text-left pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
              <Contact className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[#0C2D48]">
                {isEditing ? 'Editar contato' : 'Novo contato'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Preencha os dados da pessoa de contato no cliente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          {errors.general && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="ct-nome" className="text-xs font-semibold text-slate-700">
              Nome do contato <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ct-nome"
              placeholder="Ex.: Carlos Souza"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                if (errors.nome) {
                  setErrors((prev) => {
                    const n = { ...prev }
                    delete n.nome
                    return n
                  })
                }
              }}
              className={`h-10 rounded-xl text-sm ${
                errors.nome ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
              }`}
              autoFocus
            />
            {errors.nome && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors.nome}
              </p>
            )}
          </div>

          {/* Cargo ou Área */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Cargo ou área</Label>
            <Select
              value={cargoArea}
              onValueChange={(val) => setCargoArea(val as ContatoCargoArea)}
            >
              <SelectTrigger className="h-10 rounded-xl text-sm border-slate-200">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RH">RH (Recursos Humanos)</SelectItem>
                <SelectItem value="Financeiro">Financeiro</SelectItem>
                <SelectItem value="Sócio">Sócio / Diretor</SelectItem>
                <SelectItem value="Administrativo">Administrativo</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <Label htmlFor="ct-tel" className="text-xs font-semibold text-slate-700">
              Telefone / WhatsApp
            </Label>
            <Input
              id="ct-tel"
              placeholder="(11) 99999-9999"
              maxLength={15}
              value={telefone}
              onChange={handlePhoneChange}
              className={`h-10 rounded-xl text-sm ${
                errors.telefone ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
              }`}
            />
            {errors.telefone && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors.telefone}
              </p>
            )}
          </div>

          {/* E-mail */}
          <div className="space-y-1.5">
            <Label htmlFor="ct-email" className="text-xs font-semibold text-slate-700">
              E-mail corporativo ou pessoal
            </Label>
            <Input
              id="ct-email"
              type="email"
              placeholder="carlos@empresa.com.br"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (errors.email) {
                  setErrors((prev) => {
                    const n = { ...prev }
                    delete n.email
                    return n
                  })
                }
              }}
              className={`h-10 rounded-xl text-sm ${
                errors.email ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
              }`}
            />
            {errors.email && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors.email}
              </p>
            )}
          </div>

          {/* Checkbox Contato Principal */}
          <div className="pt-2">
            <label
              htmlFor="ct-principal"
              className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer hover:bg-slate-100/60 transition-colors"
            >
              <Checkbox
                id="ct-principal"
                checked={principal}
                onCheckedChange={(checked) => setPrincipal(Boolean(checked))}
                className="mt-0.5 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
              />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-[#0C2D48] block">
                  Definir como contato principal
                </span>
                <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                  Ao marcar esta opção, os outros contatos deste cliente serão desmarcados
                  automaticamente.
                </span>
              </div>
            </label>
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-10 px-4 rounded-xl text-slate-600 border-slate-200 hover:bg-slate-100 btn-press"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-[#0C2D48] hover:bg-[#071d30] text-white font-semibold flex items-center gap-2 shadow-sm btn-press"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {saving ? 'Salvando...' : isEditing ? 'Salvar contato' : 'Adicionar contato'}
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export default ContatoFormModal
