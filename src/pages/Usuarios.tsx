import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  getUsersWithEquipes,
  getEquipes,
  inviteUser,
  resendInviteUser,
  updateUser,
  toggleUserStatus,
} from '@/services/usuarios'
import { UserProfile, Equipe, InviteUserInput, UpdateUserInput } from '@/types/usuarios'
import { useToast } from '@/hooks/use-toast'
import PageStateLayout from '@/components/PageStateLayout'
import { InviteUserModal } from '@/components/usuarios/InviteUserModal'
import { EditUserModal } from '@/components/usuarios/EditUserModal'
import { ToggleStatusDialog } from '@/components/usuarios/ToggleStatusDialog'
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
  Users2,
  UserPlus,
  Search,
  Shield,
  Briefcase,
  Layers,
  Phone,
  Mail,
  Edit2,
  UserX,
  UserCheck,
  Send,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export default function Usuarios() {
  const { user: currentUser } = useAuth()
  const { toast } = useToast()

  // Dados
  const [users, setUsers] = useState<UserProfile[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')

  // Modais
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [statusUser, setStatusUser] = useState<UserProfile | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  // Carregar dados
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [equipesRes, usersRes] = await Promise.all([getEquipes(), getUsersWithEquipes()])

      if (equipesRes.error) {
        throw new Error(equipesRes.error.message)
      }
      if (usersRes.error) {
        throw new Error(usersRes.error.message)
      }

      setEquipes(equipesRes.data || [])
      setUsers(usersRes.data || [])
    } catch (err) {
      console.error('Erro ao carregar dados de usuários:', err)
      setError('Não foi possível carregar os usuários. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtragem local por nome ou email
  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return users

    return users.filter((u) => {
      const nameMatch = u.nome.toLowerCase().includes(term)
      const emailMatch = u.email.toLowerCase().includes(term)
      const phoneMatch = u.telefone ? u.telefone.toLowerCase().includes(term) : false
      const perfilMatch = u.perfil.toLowerCase().includes(term)
      const funcaoMatch = u.funcao.toLowerCase().includes(term)
      return nameMatch || emailMatch || phoneMatch || perfilMatch || funcaoMatch
    })
  }, [users, searchTerm])

  // Ação de convidar
  const handleInvite = async (data: InviteUserInput) => {
    const res = await inviteUser(data)
    if (res.success) {
      toast({
        title: 'Convite enviado com sucesso!',
        description: `Enviamos as orientações de primeiro acesso para ${data.email}.`,
      })
      fetchData()
    }
    return res
  }

  const [resendingUserIdsState, setResendingUserIdsState] = useState<Record<string, boolean>>({})

  // Helper para verificar se um usuário específico está com reenvio em andamento
  const isResendingUser = (userId: string) => Boolean(resendingUserIdsState[userId])

  // Tratamento de mensagens amigáveis em português para erros de envio / limite
  const formatResendInviteError = (rawError?: string | null): string => {
    if (!rawError) {
      return 'Não foi possível reenviar o convite. Tente novamente mais tarde.'
    }

    const lower = rawError.toLowerCase()

    // Caso de limite de taxa do Supabase Auth (ex.: email rate limit exceeded, 429, etc.)
    if (
      lower.includes('rate limit') ||
      lower.includes('email_rate_limit') ||
      lower.includes('rate_limit') ||
      lower.includes('429') ||
      lower.includes('over_email_send_rate_limit') ||
      lower.includes('too many requests')
    ) {
      return 'Muitos envios em pouco tempo. Aguarde alguns minutos e tente de novo. Verifique também se o e-mail já não chegou na caixa de entrada ou no spam.'
    }

    // Se o backend retornou mensagem já tratada ou outro erro
    return rawError
  }

  // Ação de reenviar convite
  const handleResendInvite = async (user: UserProfile) => {
    // Evita duplo clique para este usuário específico
    if (resendingUserIdsState[user.id]) return

    setResendingUserIdsState((prev) => ({ ...prev, [user.id]: true }))
    try {
      const res = await resendInviteUser(user.email, user.id)
      if (res.success) {
        toast({
          title: 'Convite reenviado!',
          description: res.message || `Um novo link de ativação foi enviado para ${user.email}.`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao reenviar convite',
          description: formatResendInviteError(res.error),
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao reenviar convite',
        description: 'Falha na conexão. Verifique sua internet e tente novamente.',
      })
    } finally {
      setResendingUserIdsState((prev) => {
        const next = { ...prev }
        delete next[user.id]
        return next
      })
    }
  }

  // Ação de editar
  const handleUpdate = async (data: UpdateUserInput) => {
    const res = await updateUser(data)
    if (res.success) {
      toast({
        title: 'Usuário atualizado com sucesso!',
        description: 'As alterações de perfil, função e equipes já estão em vigor.',
      })
      fetchData()
    }
    return res
  }

  // Ação de alternar status
  const handleToggleStatusConfirm = async () => {
    if (!statusUser) return

    const newStatus = statusUser.situacao === 'ativo' ? 'inativo' : 'ativo'
    setStatusLoading(true)
    try {
      const res = await toggleUserStatus(statusUser.id, newStatus)
      if (res.success) {
        toast({
          title: newStatus === 'ativo' ? 'Usuário reativado!' : 'Usuário desativado!',
          description:
            res.message ||
            (newStatus === 'ativo'
              ? 'Usuário reativado com sucesso.'
              : 'Usuário desativado com sucesso.'),
        })
        setStatusUser(null)
        fetchData()
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao alterar situação',
          description: res.error || 'Não foi possível alterar a situação do usuário.',
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha na conexão. Tente novamente.',
      })
    } finally {
      setStatusLoading(false)
    }
  }

  // Cores do perfil
  const getPerfilBadge = (perfil: string) => {
    switch (perfil) {
      case 'Administrador':
        return (
          <Badge className="bg-[#0C2D48] text-white hover:bg-[#0C2D48] font-semibold border-none text-[11px] gap-1 px-2.5 py-0.5">
            <Shield className="w-3 h-3 text-teal-400" />
            Administrador
          </Badge>
        )
      case 'Gestor':
        return (
          <Badge className="bg-sky-100 text-sky-900 hover:bg-sky-100 font-semibold border-sky-300 text-[11px] gap-1 px-2.5 py-0.5">
            <Shield className="w-3 h-3 text-sky-600" />
            Gestor
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 font-medium border-slate-300 text-[11px] px-2.5 py-0.5">
            Colaborador
          </Badge>
        )
    }
  }

  // Cores da função
  const getFuncaoBadge = (funcao: string) => {
    switch (funcao) {
      case 'Gestão':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
            <Briefcase className="w-3 h-3 text-indigo-600" />
            Gestão
          </span>
        )
      case 'Pós-venda':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <Briefcase className="w-3 h-3 text-emerald-600" />
            Pós-venda
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-900 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
            <Briefcase className="w-3 h-3 text-teal-600" />
            Comercial
          </span>
        )
    }
  }

  // Formatação de data simples dd/mm/aaaa
  const formatDateBR = (iso: string) => {
    try {
      const d = new Date(iso)
      const dia = String(d.getDate()).padStart(2, '0')
      const mes = String(d.getMonth() + 1).padStart(2, '0')
      const ano = d.getFullYear()
      return `${dia}/${mes}/${ano}`
    } catch {
      return ''
    }
  }

  // 1. Estado de Carregamento Geral
  if (loading && users.length === 0) {
    return (
      <PageStateLayout
        title="Usuários"
        subtitle="Gestão de acessos, perfis, equipes e permissões da Central do Fluxo Comercial."
        icon={Users2}
        emptyMessage=""
        status="loading"
      />
    )
  }

  // 2. Estado de Erro
  if (error && users.length === 0) {
    return (
      <PageStateLayout
        title="Usuários"
        subtitle="Gestão de acessos, perfis, equipes e permissões da Central do Fluxo Comercial."
        icon={Users2}
        emptyMessage=""
        status="error"
        onRetry={fetchData}
      />
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho da página com título e botão Convidar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-[28px] font-bold text-[#0C2D48] tracking-tight">
              Usuários
            </h1>
            <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-xs font-semibold">
              {users.length} {users.length === 1 ? 'usuário' : 'usuários'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestão de acessos, perfis, equipes (Seguros e Saúde/Odonto) e funções comerciais.
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
            onClick={() => setInviteModalOpen(true)}
            className="h-10 px-4 rounded-xl bg-[#00A896] hover:bg-[#008f80] text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-xs btn-press"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span>Convidar usuário</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            placeholder="Buscar por nome, e-mail, perfil ou função..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10 pr-4 rounded-xl text-sm border-slate-200 bg-white shadow-xs focus-visible:ring-2 focus-visible:ring-teal-600"
          />
        </div>

        {searchTerm && (
          <div className="text-xs text-slate-500 flex items-center gap-1.5 self-center">
            <span>
              Encontrados: <strong>{filteredUsers.length}</strong> de {users.length}
            </span>
            <button
              onClick={() => setSearchTerm('')}
              className="text-teal-700 hover:underline font-medium text-xs ml-1"
            >
              Limpar busca
            </button>
          </div>
        )}
      </div>

      {/* 3. Estado Vazio caso a busca não retorne nada ou tabela esteja vazia */}
      {filteredUsers.length === 0 ? (
        <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs">
          <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
              <Users2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-[#0C2D48]">
              {searchTerm ? 'Nenhum usuário corresponde à busca' : 'Nenhum usuário encontrado'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {searchTerm
                ? `Não encontramos nenhum resultado para "${searchTerm}". Verifique o termo e tente novamente.`
                : 'Clique no botão acima para convidar o primeiro membro da equipe comercial.'}
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
                onClick={() => setInviteModalOpen(true)}
                className="mt-4 h-9 px-4 rounded-xl bg-[#00A896] hover:bg-[#008f80] text-white text-xs font-semibold flex items-center gap-2"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Convidar usuário</span>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ========================================================
              TABELA DESKTOP (Escondida em telas menores que lg)
             ======================================================== */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                <TableRow>
                  <TableHead className="w-[280px] font-bold text-[#0C2D48] text-xs">
                    Usuário
                  </TableHead>
                  <TableHead className="font-bold text-[#0C2D48] text-xs">
                    Perfil de acesso
                  </TableHead>
                  <TableHead className="font-bold text-[#0C2D48] text-xs">Função</TableHead>
                  <TableHead className="font-bold text-[#0C2D48] text-xs">Equipes</TableHead>
                  <TableHead className="font-bold text-[#0C2D48] text-xs">Situação</TableHead>
                  <TableHead className="text-right font-bold text-[#0C2D48] text-xs pr-6">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id
                  const isInactive = u.situacao === 'inativo'

                  return (
                    <TableRow
                      key={u.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isInactive ? 'bg-slate-50/50 opacity-75' : ''
                      }`}
                    >
                      {/* Nome, e-mail e telefone */}
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 ${
                              isInactive
                                ? 'bg-slate-200 text-slate-500'
                                : 'bg-[#0C2340] text-teal-300'
                            }`}
                          >
                            {u.nome.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-sm text-[#0C2D48] truncate">
                                {u.nome}
                              </span>
                              {isCurrent && (
                                <Badge className="bg-teal-100 text-teal-900 border-teal-300 text-[10px] py-0 px-1.5 font-semibold">
                                  Você
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{u.email}</span>
                            </div>
                            {u.telefone && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span>{u.telefone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Perfil */}
                      <TableCell className="py-3.5">{getPerfilBadge(u.perfil)}</TableCell>

                      {/* Função */}
                      <TableCell className="py-3.5">{getFuncaoBadge(u.funcao)}</TableCell>

                      {/* Equipes */}
                      <TableCell className="py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {u.equipes && u.equipes.length > 0 ? (
                            u.equipes.map((eq) => (
                              <span
                                key={eq.id}
                                className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                              >
                                <Layers className="w-2.5 h-2.5 text-teal-600" />
                                {eq.nome}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">Nenhuma equipe</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Situação */}
                      <TableCell className="py-3.5">
                        {u.situacao === 'ativo' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00A896]" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Inativo
                          </span>
                        )}
                      </TableCell>

                      {/* Ações */}
                      <TableCell className="py-3.5 text-right pr-6">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Botão Reenviar Convite */}
                          {!isCurrent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendInvite(u)}
                              disabled={isInactive || isResendingUser(u.id)}
                              className="h-8 px-2.5 text-xs text-teal-700 hover:text-teal-800 hover:bg-teal-50 rounded-lg flex items-center gap-1"
                              title={
                                isInactive
                                  ? 'Reative o usuário para reenviar o convite'
                                  : isResendingUser(u.id)
                                    ? 'Reenviando convite...'
                                    : 'Reenviar link de ativação / acesso por e-mail'
                              }
                            >
                              {isResendingUser(u.id) ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                              ) : (
                                <Send className="w-3.5 h-3.5 text-teal-600" />
                              )}
                              <span>{isResendingUser(u.id) ? 'Reenviando...' : 'Reenviar'}</span>
                            </Button>
                          )}

                          {/* Botão Editar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingUser(u)}
                            className="h-8 px-2.5 text-xs text-slate-700 hover:text-[#0C2D48] hover:bg-slate-100 rounded-lg flex items-center gap-1"
                            title="Editar usuário"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Editar</span>
                          </Button>

                          {/* Botão Desativar / Reativar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isCurrent}
                            onClick={() => setStatusUser(u)}
                            className={`h-8 px-2.5 text-xs rounded-lg flex items-center gap-1 ${
                              u.situacao === 'ativo'
                                ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                                : 'text-teal-700 hover:text-teal-800 hover:bg-teal-50'
                            }`}
                            title={
                              isCurrent
                                ? 'Você não pode desativar seu próprio acesso'
                                : u.situacao === 'ativo'
                                  ? 'Desativar usuário'
                                  : 'Reativar usuário'
                            }
                          >
                            {u.situacao === 'ativo' ? (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                <span>Desativar</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Reativar</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* ========================================================
              LISTA DE CARTÕES MOBILE (Exibida em telas < lg)
              Garante responsividade total conforme especificação
             ======================================================== */}
          <div className="lg:hidden space-y-3">
            {filteredUsers.map((u) => {
              const isCurrent = currentUser?.id === u.id
              const isInactive = u.situacao === 'inativo'

              return (
                <Card
                  key={u.id}
                  className={`border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs ${
                    isInactive ? 'bg-slate-50/70 border-slate-200' : 'bg-white'
                  }`}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Linha superior: Avatar, Nome e Situação */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 ${
                            isInactive
                              ? 'bg-slate-200 text-slate-500'
                              : 'bg-[#0C2340] text-teal-300'
                          }`}
                        >
                          {u.nome.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-sm text-[#0C2D48] truncate">{u.nome}</h3>
                            {isCurrent && (
                              <Badge className="bg-teal-100 text-teal-900 border-teal-300 text-[10px] py-0 px-1.5 font-semibold">
                                Você
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            {u.email}
                          </p>
                        </div>
                      </div>

                      {/* Status pill */}
                      <div className="flex-shrink-0">
                        {u.situacao === 'ativo' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00A896]" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Inativo
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadados: Perfil e Função */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Perfil
                        </span>
                        {getPerfilBadge(u.perfil)}
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Função
                        </span>
                        {getFuncaoBadge(u.funcao)}
                      </div>
                    </div>

                    {/* Equipes */}
                    <div className="pt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Equipes
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {u.equipes && u.equipes.length > 0 ? (
                          u.equipes.map((eq) => (
                            <span
                              key={eq.id}
                              className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                            >
                              <Layers className="w-2.5 h-2.5 text-teal-600" />
                              {eq.nome}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">Nenhuma equipe</span>
                        )}
                      </div>
                    </div>

                    {/* Telefone se houver */}
                    {u.telefone && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 pt-1">
                        <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span>{u.telefone}</span>
                      </div>
                    )}

                    {/* Botões de Ação Mobile */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      {!isCurrent && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isInactive || isResendingUser(u.id)}
                          onClick={() => handleResendInvite(u)}
                          className="flex-1 h-9 rounded-xl text-xs font-semibold text-teal-700 border-teal-200 hover:bg-teal-50 flex items-center justify-center gap-1.5"
                        >
                          {isResendingUser(u.id) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                          ) : (
                            <Send className="w-3.5 h-3.5 text-teal-600" />
                          )}
                          <span>{isResendingUser(u.id) ? 'Reenviando...' : 'Reenviar'}</span>
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingUser(u)}
                        className="flex-1 h-9 rounded-xl text-xs font-semibold text-slate-700 border-slate-200 flex items-center justify-center gap-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Editar</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isCurrent}
                        onClick={() => setStatusUser(u)}
                        className={`flex-1 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 ${
                          u.situacao === 'ativo'
                            ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                            : 'border-teal-200 text-teal-700 hover:bg-teal-50'
                        }`}
                      >
                        {u.situacao === 'ativo' ? (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            <span>Desativar</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Reativar</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* Modal de Convidar Usuário */}
      <InviteUserModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        equipes={equipes}
        onInvite={handleInvite}
      />

      {/* Modal de Editar Usuário */}
      <EditUserModal
        open={Boolean(editingUser)}
        onOpenChange={(open) => !open && setEditingUser(null)}
        user={editingUser}
        equipes={equipes}
        currentUserId={currentUser?.id}
        onUpdate={handleUpdate}
      />

      {/* Confirmação de Desativar/Reativar */}
      <ToggleStatusDialog
        open={Boolean(statusUser)}
        onOpenChange={(open) => !open && setStatusUser(null)}
        user={statusUser}
        loading={statusLoading}
        onConfirm={handleToggleStatusConfirm}
      />
    </div>
  )
}
