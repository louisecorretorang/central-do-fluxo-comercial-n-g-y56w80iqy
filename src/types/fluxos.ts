import { CatalogoFrente } from './catalogo'
import { UserFuncao } from './usuarios'

export type FluxoSituacao = 'ativo' | 'inativo'

export type FluxoEtapaTipo = 'Trabalho interno' | 'Aguardando cliente' | 'Aguardando seguradora'

export type FluxoResponsavelTipo = 'responsavel_comercial' | 'fila_equipe'

export type ChecklistItemTipo = 'Documento' | 'Informação' | 'Confirmação'

export type ChecklistCampoFormato = 'texto' | 'número' | 'valor' | 'data' | 'sim_nao' | 'opções'

export interface ChecklistItem {
  id: string
  etapa_id: string
  ordem: number
  titulo: string
  tipo: ChecklistItemTipo
  formato: ChecklistCampoFormato | null
  opcoes?: string[] | null
  obrigatorio: boolean
  created_at?: string
  updated_at?: string
}

export interface FluxoEtapa {
  id: string
  modelo_id: string
  ordem: number
  nome: string
  descricao?: string | null
  tipo: FluxoEtapaTipo
  responsavel_tipo: FluxoResponsavelTipo
  equipe_id?: string | null
  equipe_nome?: string | null
  funcao?: UserFuncao | null
  prazo_dias?: number | null
  is_etapa_ganho: boolean
  itens?: ChecklistItem[]
  created_at?: string
  updated_at?: string
}

export interface FluxoModeloResumo {
  id: string
  nome: string
  produto_id?: string | null
  produto_nome?: string | null
  produto_frente?: CatalogoFrente | null
  seguradora_id?: string | null
  seguradora_nome?: string | null
  is_generico: boolean
  versao: number
  situacao: FluxoSituacao
  descricao?: string | null
  total_etapas?: number
  created_at?: string
  updated_at?: string
}

export interface FluxoModeloDetalhe extends FluxoModeloResumo {
  etapas: FluxoEtapa[]
}
