export interface NotificacaoItem {
  id: string
  destinatario_id: string
  titulo: string
  mensagem: string
  link?: string | null
  oportunidade_id?: string | null
  lida: boolean
  lida_em?: string | null
  created_at: string
}
