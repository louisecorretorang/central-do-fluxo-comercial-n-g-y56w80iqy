export type CatalogoFrente = 'Seguros' | 'Saúde'

export type CanalCotacao = 'Portal' | 'Multicálculo' | 'E-mail' | 'WhatsApp'

export type CatalogoSituacao = 'ativa' | 'inativa'

export type MotivoTipo = 'perda' | 'descarte' | 'adiamento'

export interface SeguradoraOperadora {
  id: string
  nome: string
  frente: CatalogoFrente
  canal_cotacao: CanalCotacao
  situacao: CatalogoSituacao
  created_at: string
  updated_at: string
}

export interface ProdutoCatalogo {
  id: string
  nome: string
  frente: CatalogoFrente
  equipe_id?: string | null
  equipe_nome: string
  situacao: CatalogoSituacao
  created_at: string
  updated_at: string
}

export interface OrigemLead {
  id: string
  nome: string
  situacao: CatalogoSituacao
  created_at?: string
}

export interface MotivoCatalogo {
  id: string
  nome: string
  tipo: MotivoTipo
  situacao: CatalogoSituacao
  created_at?: string
}
export interface CatalogoData {
  seguradoras: SeguradoraOperadora[]
  produtos: ProdutoCatalogo[]
  origensLead: OrigemLead[]
  motivos: MotivoCatalogo[]
}
