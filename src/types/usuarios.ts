export type UserPerfil = 'Administrador' | 'Gestor' | 'Colaborador'
export type UserFuncao = 'Comercial' | 'Pós-venda' | 'Gestão'
export type UserSituacao = 'ativo' | 'inativo'

export interface Equipe {
  id: string
  nome: string
  descricao: string | null
  created_at: string
}

export interface UserProfile {
  id: string
  nome: string
  email: string
  telefone: string | null
  perfil: UserPerfil
  funcao: UserFuncao
  situacao: UserSituacao
  created_at: string
  updated_at: string
  equipes?: Equipe[]
}

export interface InviteUserInput {
  email: string
  nome: string
  telefone?: string
  perfil: UserPerfil
  funcao: UserFuncao
  equipeIds: string[]
}

export interface UpdateUserInput {
  userId: string
  nome?: string
  telefone?: string
  perfil?: UserPerfil
  funcao?: UserFuncao
  // T2.01 — CA-1-08: 'situacao' saiu daqui. Mudança de situação só pela ação
  // toggle_status (desativar/reativar), que também bane/desbane em auth.users.
  equipeIds?: string[]
}
