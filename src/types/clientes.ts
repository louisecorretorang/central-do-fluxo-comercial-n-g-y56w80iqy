export type ClienteTipo = 'PJ' | 'PF'

export type ClientePorte = 'micro' | 'pequena' | 'média' | 'grande'

export type ClienteSituacao = 'ativo' | 'arquivado'

export type IndicadoPorTipo = 'cliente' | 'colaborador' | 'parceiro'

export type ContatoCargoArea = 'RH' | 'Financeiro' | 'Sócio' | 'Administrativo' | 'Outro'

export interface Cliente {
  id: string
  tipo: ClienteTipo

  // PJ
  cnpj?: string | null
  razao_social?: string | null
  nome_fantasia?: string | null
  segmento?: string | null
  porte?: ClientePorte | null
  numero_vidas?: number | null

  // PF
  cpf?: string | null
  nome_completo?: string | null
  data_de_nascimento?: string | null

  // Comuns
  cidade?: string | null
  uf?: string | null
  origem?: string | null
  origem_id?: string | null
  origem_nome?: string | null
  indicado_por_tipo?: IndicadoPorTipo | null
  indicado_por_nome?: string | null
  responsavel_comercial_id?: string | null
  observacoes?: string | null
  situacao: ClienteSituacao

  created_at: string
  updated_at: string

  // Relacionamento opcional com perfil do responsável
  responsavel_comercial?: {
    id: string
    nome: string
    email: string
  } | null

  // Relacionamento opcional com origem_lead
  origem_lead?: {
    id: string
    nome: string
  } | null

  // Contatos vinculados
  contatos?: ClienteContato[]

  // Total de oportunidades abertas (calculado ou 0)
  total_oportunidades_abertas?: number
}

export interface ClienteContato {
  id: string
  cliente_id: string
  nome: string
  cargo_area: ContatoCargoArea
  telefone?: string | null
  email?: string | null
  principal: boolean
  created_at: string
  updated_at: string
}

export interface ClienteFormData {
  tipo: ClienteTipo

  // PJ
  cnpj?: string
  razao_social?: string
  nome_fantasia?: string
  segmento?: string
  porte?: ClientePorte | ''
  numero_vidas?: number | ''

  // PF
  cpf?: string
  nome_completo?: string
  data_de_nascimento?: string // dd/mm/aaaa ou aaaa-mm-dd

  // Comuns
  cidade?: string
  uf?: string
  origem?: string
  origem_id?: string | ''
  indicado_por_tipo?: IndicadoPorTipo | ''
  indicado_por_nome?: string
  responsavel_comercial_id?: string | ''
  observacoes?: string
}

export interface ClienteContatoFormData {
  nome: string
  cargo_area: ContatoCargoArea
  telefone?: string
  email?: string
  principal: boolean
}
