// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          cidade: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          data_de_nascimento: string | null
          id: string
          indicado_por_nome: string | null
          indicado_por_tipo: Database['public']['Enums']['indicado_por_tipo'] | null
          nome_completo: string | null
          nome_fantasia: string | null
          numero_vidas: number | null
          observacoes: string | null
          origem: string | null
          porte: Database['public']['Enums']['cliente_porte'] | null
          razao_social: string | null
          responsavel_comercial_id: string | null
          segmento: string | null
          situacao: Database['public']['Enums']['cliente_situacao']
          tipo: Database['public']['Enums']['cliente_tipo']
          uf: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          data_de_nascimento?: string | null
          id?: string
          indicado_por_nome?: string | null
          indicado_por_tipo?: Database['public']['Enums']['indicado_por_tipo'] | null
          nome_completo?: string | null
          nome_fantasia?: string | null
          numero_vidas?: number | null
          observacoes?: string | null
          origem?: string | null
          porte?: Database['public']['Enums']['cliente_porte'] | null
          razao_social?: string | null
          responsavel_comercial_id?: string | null
          segmento?: string | null
          situacao?: Database['public']['Enums']['cliente_situacao']
          tipo: Database['public']['Enums']['cliente_tipo']
          uf?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          data_de_nascimento?: string | null
          id?: string
          indicado_por_nome?: string | null
          indicado_por_tipo?: Database['public']['Enums']['indicado_por_tipo'] | null
          nome_completo?: string | null
          nome_fantasia?: string | null
          numero_vidas?: number | null
          observacoes?: string | null
          origem?: string | null
          porte?: Database['public']['Enums']['cliente_porte'] | null
          razao_social?: string | null
          responsavel_comercial_id?: string | null
          segmento?: string | null
          situacao?: Database['public']['Enums']['cliente_situacao']
          tipo?: Database['public']['Enums']['cliente_tipo']
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clientes_responsavel_comercial_id_fkey'
            columns: ['responsavel_comercial_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      clientes_contatos: {
        Row: {
          cargo_area: Database['public']['Enums']['contato_cargo_area']
          cliente_id: string
          created_at: string
          email: string | null
          id: string
          nome: string
          principal: boolean
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cargo_area?: Database['public']['Enums']['contato_cargo_area']
          cliente_id: string
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          principal?: boolean
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cargo_area?: Database['public']['Enums']['contato_cargo_area']
          cliente_id?: string
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          principal?: boolean
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clientes_contatos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
        ]
      }
      equipes: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      fluxo_checklist_itens: {
        Row: {
          created_at: string
          etapa_id: string
          formato: Database['public']['Enums']['checklist_campo_formato'] | null
          id: string
          obrigatorio: boolean
          opcoes: Json | null
          ordem: number
          tipo: Database['public']['Enums']['checklist_item_tipo']
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          etapa_id: string
          formato?: Database['public']['Enums']['checklist_campo_formato'] | null
          id?: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem: number
          tipo: Database['public']['Enums']['checklist_item_tipo']
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          etapa_id?: string
          formato?: Database['public']['Enums']['checklist_campo_formato'] | null
          id?: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem?: number
          tipo?: Database['public']['Enums']['checklist_item_tipo']
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fluxo_checklist_itens_etapa_id_fkey'
            columns: ['etapa_id']
            isOneToOne: false
            referencedRelation: 'fluxo_etapas'
            referencedColumns: ['id']
          },
        ]
      }
      fluxo_etapas: {
        Row: {
          created_at: string
          descricao: string | null
          equipe_id: string | null
          funcao: Database['public']['Enums']['user_funcao'] | null
          id: string
          is_etapa_ganho: boolean
          modelo_id: string
          nome: string
          ordem: number
          prazo_dias: number | null
          responsavel_tipo: Database['public']['Enums']['fluxo_responsavel_tipo']
          tipo: Database['public']['Enums']['fluxo_etapa_tipo']
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          equipe_id?: string | null
          funcao?: Database['public']['Enums']['user_funcao'] | null
          id?: string
          is_etapa_ganho?: boolean
          modelo_id: string
          nome: string
          ordem: number
          prazo_dias?: number | null
          responsavel_tipo?: Database['public']['Enums']['fluxo_responsavel_tipo']
          tipo: Database['public']['Enums']['fluxo_etapa_tipo']
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          equipe_id?: string | null
          funcao?: Database['public']['Enums']['user_funcao'] | null
          id?: string
          is_etapa_ganho?: boolean
          modelo_id?: string
          nome?: string
          ordem?: number
          prazo_dias?: number | null
          responsavel_tipo?: Database['public']['Enums']['fluxo_responsavel_tipo']
          tipo?: Database['public']['Enums']['fluxo_etapa_tipo']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fluxo_etapas_equipe_id_fkey'
            columns: ['equipe_id']
            isOneToOne: false
            referencedRelation: 'equipes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fluxo_etapas_modelo_id_fkey'
            columns: ['modelo_id']
            isOneToOne: false
            referencedRelation: 'fluxo_modelos'
            referencedColumns: ['id']
          },
        ]
      }
      fluxo_modelos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_generico: boolean
          nome: string
          produto_id: string | null
          seguradora_id: string | null
          situacao: Database['public']['Enums']['fluxo_situacao']
          updated_at: string
          versao: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_generico?: boolean
          nome: string
          produto_id?: string | null
          seguradora_id?: string | null
          situacao?: Database['public']['Enums']['fluxo_situacao']
          updated_at?: string
          versao?: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_generico?: boolean
          nome?: string
          produto_id?: string | null
          seguradora_id?: string | null
          situacao?: Database['public']['Enums']['fluxo_situacao']
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: 'fluxo_modelos_produto_id_fkey'
            columns: ['produto_id']
            isOneToOne: false
            referencedRelation: 'produtos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fluxo_modelos_seguradora_id_fkey'
            columns: ['seguradora_id']
            isOneToOne: false
            referencedRelation: 'seguradoras_operadoras'
            referencedColumns: ['id']
          },
        ]
      }
      motivos: {
        Row: {
          created_at: string
          id: string
          nome: string
          tipo: Database['public']['Enums']['motivo_tipo']
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          tipo: Database['public']['Enums']['motivo_tipo']
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          tipo?: Database['public']['Enums']['motivo_tipo']
        }
        Relationships: []
      }
      origens_lead: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          created_at: string
          equipe_id: string | null
          equipe_nome: string
          frente: Database['public']['Enums']['catalogo_frente']
          id: string
          nome: string
          situacao: Database['public']['Enums']['catalogo_situacao']
          updated_at: string
        }
        Insert: {
          created_at?: string
          equipe_id?: string | null
          equipe_nome: string
          frente: Database['public']['Enums']['catalogo_frente']
          id?: string
          nome: string
          situacao?: Database['public']['Enums']['catalogo_situacao']
          updated_at?: string
        }
        Update: {
          created_at?: string
          equipe_id?: string | null
          equipe_nome?: string
          frente?: Database['public']['Enums']['catalogo_frente']
          id?: string
          nome?: string
          situacao?: Database['public']['Enums']['catalogo_situacao']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'produtos_equipe_id_fkey'
            columns: ['equipe_id']
            isOneToOne: false
            referencedRelation: 'equipes'
            referencedColumns: ['id']
          },
        ]
      }
      profile_equipes: {
        Row: {
          created_at: string
          equipe_id: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          equipe_id: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          equipe_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profile_equipes_equipe_id_fkey'
            columns: ['equipe_id']
            isOneToOne: false
            referencedRelation: 'equipes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'profile_equipes_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          funcao: Database['public']['Enums']['user_funcao']
          id: string
          nome: string
          perfil: Database['public']['Enums']['user_perfil']
          situacao: Database['public']['Enums']['user_situacao']
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          funcao?: Database['public']['Enums']['user_funcao']
          id: string
          nome: string
          perfil?: Database['public']['Enums']['user_perfil']
          situacao?: Database['public']['Enums']['user_situacao']
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          funcao?: Database['public']['Enums']['user_funcao']
          id?: string
          nome?: string
          perfil?: Database['public']['Enums']['user_perfil']
          situacao?: Database['public']['Enums']['user_situacao']
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seguradoras_operadoras: {
        Row: {
          canal_cotacao: Database['public']['Enums']['canal_cotacao']
          created_at: string
          frente: Database['public']['Enums']['catalogo_frente']
          id: string
          nome: string
          situacao: Database['public']['Enums']['catalogo_situacao']
          updated_at: string
        }
        Insert: {
          canal_cotacao: Database['public']['Enums']['canal_cotacao']
          created_at?: string
          frente: Database['public']['Enums']['catalogo_frente']
          id?: string
          nome: string
          situacao?: Database['public']['Enums']['catalogo_situacao']
          updated_at?: string
        }
        Update: {
          canal_cotacao?: Database['public']['Enums']['canal_cotacao']
          created_at?: string
          frente?: Database['public']['Enums']['catalogo_frente']
          id?: string
          nome?: string
          situacao?: Database['public']['Enums']['catalogo_situacao']
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_active_user: { Args: { user_uid: string }; Returns: boolean }
      is_admin: { Args: { user_uid: string }; Returns: boolean }
    }
    Enums: {
      canal_cotacao: 'Portal' | 'Multicálculo' | 'E-mail' | 'WhatsApp'
      catalogo_frente: 'Seguros' | 'Saúde'
      catalogo_situacao: 'ativa' | 'inativa'
      checklist_campo_formato: 'texto' | 'número' | 'valor' | 'data' | 'sim_nao' | 'opções'
      checklist_item_tipo: 'Documento' | 'Informação' | 'Confirmação'
      cliente_porte: 'micro' | 'pequena' | 'média' | 'grande'
      cliente_situacao: 'ativo' | 'arquivado'
      cliente_tipo: 'PJ' | 'PF'
      contato_cargo_area: 'RH' | 'Financeiro' | 'Sócio' | 'Administrativo' | 'Outro'
      fluxo_etapa_tipo: 'Trabalho interno' | 'Aguardando cliente' | 'Aguardando seguradora'
      fluxo_responsavel_tipo: 'responsavel_comercial' | 'fila_equipe'
      fluxo_situacao: 'ativo' | 'inativo'
      indicado_por_tipo: 'cliente' | 'colaborador' | 'parceiro'
      motivo_tipo: 'perda' | 'descarte' | 'adiamento'
      user_funcao: 'Comercial' | 'Pós-venda' | 'Gestão'
      user_perfil: 'Administrador' | 'Gestor' | 'Colaborador'
      user_situacao: 'ativo' | 'inativo'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      canal_cotacao: ['Portal', 'Multicálculo', 'E-mail', 'WhatsApp'],
      catalogo_frente: ['Seguros', 'Saúde'],
      catalogo_situacao: ['ativa', 'inativa'],
      checklist_campo_formato: ['texto', 'número', 'valor', 'data', 'sim_nao', 'opções'],
      checklist_item_tipo: ['Documento', 'Informação', 'Confirmação'],
      cliente_porte: ['micro', 'pequena', 'média', 'grande'],
      cliente_situacao: ['ativo', 'arquivado'],
      cliente_tipo: ['PJ', 'PF'],
      contato_cargo_area: ['RH', 'Financeiro', 'Sócio', 'Administrativo', 'Outro'],
      fluxo_etapa_tipo: ['Trabalho interno', 'Aguardando cliente', 'Aguardando seguradora'],
      fluxo_responsavel_tipo: ['responsavel_comercial', 'fila_equipe'],
      fluxo_situacao: ['ativo', 'inativo'],
      indicado_por_tipo: ['cliente', 'colaborador', 'parceiro'],
      motivo_tipo: ['perda', 'descarte', 'adiamento'],
      user_funcao: ['Comercial', 'Pós-venda', 'Gestão'],
      user_perfil: ['Administrador', 'Gestor', 'Colaborador'],
      user_situacao: ['ativo', 'inativo'],
    },
  },
} as const
