import { supabase, } from '@/lib/supabase/client'
import { FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
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

/**
 * T2.01 — caminho de erro obrigatório: extrai a mensagem real devolvida pela edge
 * function. Sem isso, o supabase-js mostra só o genérico "Edge Function returned a
 * non-2xx status code" e a mensagem em português da função se perde.
 */
export async function extrairErroEdge(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      // O corpo da resposta vem no context (Response) ou no próprio erro, conforme a versão.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = await (error as any).json?.().catch(() => null)
      const body = payload ?? null
      if (body?.error) return String(body.error)
      if (body?.message) return String(body.message)
    } catch {
      // segue para o fallback abaixo
    }
    // Tenta ler o corpo pelo Response bruto, se disponível
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = (error as any).context
    if (context && typeof context.json === 'function') {
      try {
        const body = await context.json()
        if (body?.error) return String(body.error)
        if (body?.message) return String(body.message)
      } catch {
        // segue para o fallback abaixo
      }
    }
    return 'A função de administração recusou o pedido. Veja os logs da função no Supabase para o motivo exato.'
  }
  if (error instanceof FunctionsRelayError) {
    return 'Falha de comunicação com a função de administração. Tente novamente.'
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Falha ao processar o pedido.'
}

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
      const errorMsg = await extrairErroEdge(error)
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

    // Se a edge function falhou, mostra a mensagem real dela (em português)
    if (error) {
      const errorMsg = await extrairErroEdge(error)
      return { success: false, error: errorMsg }
    }

    if (data?.error) {
      return { success: false, error: data.error }
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

    // Se a edge function falhou, mostra a mensagem real dela (em português).
    // T2.01: sem fallback direto ao banco — o toggle precisa do ban/revogação no
    // auth.users, que só a edge function (service_role) ou o trigger garantem.
    if (error) {
      const errorMsg = await extrairErroEdge(error)
      return { success: false, error: errorMsg }
    }

    if (data?.error) {
      return { success: false, error: data.error }
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
