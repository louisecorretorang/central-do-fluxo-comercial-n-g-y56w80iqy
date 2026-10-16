import { supabase } from '@/lib/supabase/client'
import {
  Equipe,
  UserProfile,
  InviteUserInput,
  UpdateUserInput,
  UserSituacao,
} from '@/types/usuarios'

// Helper seguro para chamadas tipadas enquanto os tipos em Database types não forem sincronizados
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface ProfileEquipeRelation {
  profile_id: string
  equipe_id: string
  equipes: Equipe | null
}

/**
 * Busca todas as equipes cadastradas no sistema (Seguros, Saúde e Odonto)
 */
export async function getEquipes(): Promise<{ data: Equipe[] | null; error: Error | null }> {
  try {
    const { data, error } = await db
      .from('equipes')
      .select('id, nome, descricao, created_at')
      .order('nome', { ascending: true })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    return { data: (data as Equipe[]) ?? [], error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Não foi possível carregar as equipes.'
    return { data: null, error: new Error(message) }
  }
}

/**
 * Busca lista completa de usuários com suas equipes vinculadas
 */
export async function getUsersWithEquipes(): Promise<{
  data: UserProfile[] | null
  error: Error | null
}> {
  try {
    const { data: profiles, error: pError } = await db
      .from('profiles')
      .select('id, nome, email, telefone, perfil, funcao, situacao, created_at, updated_at')
      .order('nome', { ascending: true })

    if (pError) {
      return { data: null, error: new Error(pError.message) }
    }

    // Busca vínculos de equipes
    const { data: links, error: lError } = await db
      .from('profile_equipes')
      .select('profile_id, equipe_id, equipes(id, nome, descricao, created_at)')

    if (lError) {
      console.warn('Aviso ao carregar vínculos de equipes:', lError)
    }

    const equipeMap = new Map<string, Equipe[]>()
    if (links) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const link of links as any[]) {
        const pId = link.profile_id as string
        const eq = link.equipes as unknown as Equipe | null
        if (eq) {
          const list = equipeMap.get(pId) || []
          list.push(eq)
          equipeMap.set(pId, list)
        }
      }
    }

    const result: UserProfile[] = ((profiles as UserProfile[]) || []).map((p) => ({
      ...p,
      equipes: equipeMap.get(p.id) || [],
    }))

    return { data: result, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Não foi possível carregar os usuários.'
    return { data: null, error: new Error(message) }
  }
}

/**
 * Convida um usuário por e-mail chamando a Edge Function admin-users.
 */
export async function inviteUser(
  input: InviteUserInput,
): Promise<{ success: boolean; error: string | null }> {
  try {
    // 1. Tentar chamar Edge Function
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        action: 'invite',
        ...input,
      },
    })

    if (!error && data?.success) {
      return { success: true, error: null }
    }

    if (error) {
      console.warn('Falha na invocação da função de admin, tentando tratamento:', error)
      const errorMsg = data?.error || error.message || 'Falha ao processar convite.'
      return { success: false, error: errorMsg }
    }

    if (data?.error) {
      return { success: false, error: data.error }
    }

    return { success: true, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Não foi possível enviar o convite.'
    return { success: false, error: message }
  }
}

/**
 * Atualiza dados de um usuário (perfil, função, nome, telefone, equipes)
 */
export async function updateUser(
  input: UpdateUserInput,
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Tenta primeiro via Edge Function
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        action: 'update',
        ...input,
      },
    })

    if (!error && data?.success) {
      return { success: true, error: null }
    }

    // Se a edge function falhou, executa no banco usando RLS (o usuário é admin)
    const updatePayload: Record<string, unknown> = {}
    if (input.nome !== undefined) updatePayload.nome = input.nome.trim()
    if (input.telefone !== undefined) updatePayload.telefone = input.telefone.trim() || null
    if (input.perfil !== undefined) updatePayload.perfil = input.perfil
    if (input.funcao !== undefined) updatePayload.funcao = input.funcao
    if (input.situacao !== undefined) updatePayload.situacao = input.situacao

    const { error: dbErr } = await db.from('profiles').update(updatePayload).eq('id', input.userId)

    if (dbErr) {
      return { success: false, error: dbErr.message }
    }

    if (Array.isArray(input.equipeIds)) {
      await db.from('profile_equipes').delete().eq('profile_id', input.userId)
      if (input.equipeIds.length > 0) {
        const inserts = input.equipeIds.map((eqId) => ({
          profile_id: input.userId,
          equipe_id: eqId,
        }))
        const { error: insErr } = await db.from('profile_equipes').insert(inserts)
        if (insErr) {
          return { success: false, error: insErr.message }
        }
      }
    }

    return { success: true, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Não foi possível atualizar o usuário.'
    return { success: false, error: message }
  }
}

/**
 * Altera a situação do usuário (desativar ou reativar)
 */
export async function toggleUserStatus(
  userId: string,
  situacao: UserSituacao,
): Promise<{ success: boolean; error: string | null; message?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        action: 'toggle_status',
        userId,
        situacao,
      },
    })

    if (!error && data?.success) {
      return {
        success: true,
        error: null,
        message:
          data.message ||
          (situacao === 'ativo'
            ? 'Usuário reativado com sucesso.'
            : 'Usuário desativado com sucesso.'),
      }
    }

    // Fallback direto via Supabase Client (RLS permite Administrador atualizar)
    const { error: dbErr } = await db.from('profiles').update({ situacao }).eq('id', userId)

    if (dbErr) {
      return { success: false, error: dbErr.message }
    }

    return {
      success: true,
      error: null,
      message:
        situacao === 'ativo' ? 'Usuário reativado com sucesso.' : 'Usuário desativado com sucesso.',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Não foi possível alterar a situação.'
    return { success: false, error: message }
  }
}
