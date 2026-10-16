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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_active_user: { Args: { user_uid: string }; Returns: boolean }
      is_admin: { Args: { user_uid: string }; Returns: boolean }
    }
    Enums: {
      cliente_porte: 'micro' | 'pequena' | 'média' | 'grande'
      cliente_situacao: 'ativo' | 'arquivado'
      cliente_tipo: 'PJ' | 'PF'
      contato_cargo_area: 'RH' | 'Financeiro' | 'Sócio' | 'Administrativo' | 'Outro'
      indicado_por_tipo: 'cliente' | 'colaborador' | 'parceiro'
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
      cliente_porte: ['micro', 'pequena', 'média', 'grande'],
      cliente_situacao: ['ativo', 'arquivado'],
      cliente_tipo: ['PJ', 'PF'],
      contato_cargo_area: ['RH', 'Financeiro', 'Sócio', 'Administrativo', 'Outro'],
      indicado_por_tipo: ['cliente', 'colaborador', 'parceiro'],
      user_funcao: ['Comercial', 'Pós-venda', 'Gestão'],
      user_perfil: ['Administrador', 'Gestor', 'Colaborador'],
      user_situacao: ['ativo', 'inativo'],
    },
  },
} as const
