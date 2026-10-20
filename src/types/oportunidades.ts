import { CatalogoFrente } from './catalogo'
import { ClienteTipo } from './clientes'
import {
  FluxoEtapaTipo,
  FluxoResponsavelTipo,
  ChecklistItemTipo,
  ChecklistCampoFormato,
} from './fluxos'
import { UserFuncao } from './usuarios'

export type OportunidadeSituacao =
  | 'Em andamento'
  | 'Ganha'
  | 'Ganha — em finalização'
  | 'Concluída'
  | 'Perdida'
  | 'Descartada'
  | 'Adiada'
  | 'Arquivada'

export type EtapaOportunidadeSituacao = 'pendente' | 'em_andamento' | 'concluida'

export type InteracaoTipo = 'Ligação' | 'WhatsApp' | 'E-mail' | 'Reunião' | 'Outro'

export interface OportunidadeInteracao {
  id: string
  oportunidade_id: string
  tipo: InteracaoTipo
  data_contato: string
  resumo: string
  registrado_por: string
  registrado_por_nome?: string
  created_at?: string
  updated_at?: string
}

export type TimelineTipo =
  | 'criacao'
  | 'etapa_concluida'
  | 'troca_responsavel'
  | 'documento'
  | 'interacao'
  | 'checklist_item'
  | 'quiver'
  | 'geral'

export interface OportunidadeTimelineItem {
  id: string
  oportunidade_id: string
  tipo: TimelineTipo
  titulo: string
  descricao?: string | null
  usuario_id?: string | null
  usuario_nome?: string | null
  metadados?: Record<string, unknown> | null
  created_at: string
}

export interface OportunidadeDocumento {
  id: string
  oportunidade_id: string
  checklist_item_id: string
  arquivo_nome: string
  arquivo_caminho: string
  arquivo_tamanho: number | null
  enviado_por: string | null
  enviado_por_nome?: string | null
  enviado_em: string
  created_at: string
}

export interface OportunidadeChecklistItem {
  id: string
  etapa_oportunidade_id: string
  ordem: number
  titulo: string
  tipo: ChecklistItemTipo
  formato: ChecklistCampoFormato | null
  opcoes?: string[] | null
  obrigatorio: boolean
  valor?: string | null
  arquivo_nome?: string | null
  arquivo_url?: string | null
  arquivo_tamanho?: number | null
  documentos?: OportunidadeDocumento[]
  concluido: boolean
  concluido_por?: string | null
  concluido_por_nome?: string | null
  concluido_em?: string | null
  created_at?: string
  updated_at?: string
}

export interface OportunidadeEtapa {
  id: string
  oportunidade_id: string
  ordem: number
  nome: string
  descricao?: string | null
  tipo: FluxoEtapaTipo
  responsavel_tipo: FluxoResponsavelTipo
  equipe_id?: string | null
  equipe_nome?: string | null
  funcao?: UserFuncao | null
  responsavel_usuario_id?: string | null
  responsavel_usuario_nome?: string | null
  concluida_por_id?: string | null
  concluida_por_nome?: string | null
  prazo_dias?: number | null
  is_etapa_ganho: boolean
  situacao: EtapaOportunidadeSituacao
  iniciada_em?: string | null
  concluida_em?: string | null
  itens: OportunidadeChecklistItem[]
  created_at?: string
  updated_at?: string
}

export interface OportunidadeResumo {
  id: string
  protocolo: string
  cliente_id: string
  cliente_nome: string
  cliente_tipo: ClienteTipo
  cliente_documento?: string | null
  produto_id: string
  produto_nome: string
  produto_frente: CatalogoFrente
  seguradora_id?: string | null
  seguradora_nome?: string | null
  fluxo_modelo_id: string
  fluxo_versao: number
  usou_fluxo_generico: boolean
  equipe_id?: string | null
  equipe_nome?: string | null
  responsavel_comercial_id: string
  responsavel_comercial_nome: string
  origem_id: string
  origem_nome: string
  valor_estimado: number
  valor_fechado?: number | null
  motivo_perda_id?: string | null
  motivo_perda_nome?: string | null
  observacao_perda?: string | null
  data_prevista_fechamento: string
  observacoes?: string | null
  situacao: OportunidadeSituacao
  etapa_atual_id?: string | null
  etapa_atual_nome?: string | null
  etapa_atual_ordem?: number | null
  etapa_atual_responsavel_tipo?: FluxoResponsavelTipo | null
  etapa_atual_responsavel_usuario_id?: string | null
  etapa_atual_equipe_id?: string | null
  etapa_atual_funcao?: UserFuncao | null
  etapa_atual_iniciada_em?: string | null
  dias_na_etapa?: number
  numero_quiver?: string | null
  criado_por?: string | null
  criado_por_nome?: string | null
  created_at: string
  updated_at: string
}

export interface OportunidadesFilter {
  search?: string
  situacao?: string
  produtoId?: string
  seguradoraId?: string
  responsavelId?: string
  equipeId?: string
  dataInicio?: string // AAAA-MM-DD
  dataFim?: string // AAAA-MM-DD
  clienteId?: string
}

export interface OportunidadeDetalhe extends OportunidadeResumo {
  etapas: OportunidadeEtapa[]
  interacoes: OportunidadeInteracao[]
  timeline: OportunidadeTimelineItem[]
}

export interface CriarOportunidadeInput {
  cliente_id: string
  produto_id: string
  seguradora_id?: string | null
  responsavel_comercial_id: string
  origem_id: string
  valor_estimado: number
  data_prevista_fechamento: string // AAAA-MM-DD
  observacoes?: string | null
}

export interface CriarOportunidadeResult {
  id: string
  protocolo: string
  usou_fluxo_generico: boolean
  fluxo_modelo_id: string
  fluxo_versao: number
  etapa_atual_id: string
}
