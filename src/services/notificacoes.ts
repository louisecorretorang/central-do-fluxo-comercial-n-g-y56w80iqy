import { supabase } from '@/lib/supabase/client'
import { NotificacaoItem } from '@/types/notificacoes'

// Helper de banco tipado dinamicamente
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Busca as notificações do usuário logado (mais recentes primeiro)
 */
export async function getMinhasNotificacoes(): Promise<{
  data: NotificacaoItem[] | null
  error: string | null
}> {
  try {
    const { data, error } = await db
      .from('notificacoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('Erro ao buscar notificações:', error)
      return { data: null, error: error.message }
    }

    return { data: (data as NotificacaoItem[]) || [], error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao buscar notificações.'
    return { data: null, error: msg }
  }
}

/**
 * Marca uma notificação específica ou todas como lida(s)
 */
export async function marcarNotificacoesLidas(
  notificacaoId?: string | null,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await db.rpc('marcar_notificacoes_lidas', {
      p_notificacao_id: notificacaoId || null,
    })

    if (error) {
      console.error('Erro ao marcar notificações como lidas:', error)
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao atualizar notificação.'
    return { success: false, error: msg }
  }
}
