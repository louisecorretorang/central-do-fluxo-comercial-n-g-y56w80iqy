import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { UserProfile, UserPerfil, UserFuncao, UserSituacao } from '@/types/usuarios'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  perfil: UserPerfil | null
  funcao: UserFuncao | null
  situacao: UserSituacao | null
  isAdmin: boolean
  isGestor: boolean
  isColaborador: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | Error | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  refreshProfile: () => Promise<void>
  loading: boolean
  userDisplayName: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Função para carregar o perfil do usuário logado
  const loadProfile = useCallback(async (userId: string, userEmail?: string | null) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any
      const { data, error } = await client
        .from('profiles')
        .select('id, nome, email, telefone, perfil, funcao, situacao, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle()

      if (!error && data) {
        setProfile(data as UserProfile)
        return data as UserProfile
      }

      // Se não encontrou por ID, tentar por email
      if (userEmail) {
        const { data: byEmail } = await client
          .from('profiles')
          .select('id, nome, email, telefone, perfil, funcao, situacao, created_at, updated_at')
          .eq('email', userEmail.toLowerCase())
          .maybeSingle()

        if (byEmail) {
          setProfile(byEmail as UserProfile)
          return byEmail as UserProfile
        }
      }

      return null
    } catch (err) {
      console.error('Erro ao buscar perfil:', err)
      return null
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await loadProfile(user.id, user.email)
    }
  }, [user, loadProfile])

  useEffect(() => {
    // REGRA DE OURO DO SKILL: NENHUM CÓDIGO ASYNC/AWAIT DENTRO DO onAuthStateChange
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (!newSession?.user) {
        setProfile(null)
        setLoading(false)
      } else {
        // Disparar carga de perfil fora da assinatura síncrona
        loadProfile(newSession.user.id, newSession.user.email).finally(() => {
          setLoading(false)
        })
      }
    })

    // Obter sessão inicial
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      if (initialSession?.user) {
        loadProfile(initialSession.user.id, initialSession.user.email).finally(() => {
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  const signIn = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase()

    // 1. Antes mesmo de autenticar ou logo em seguida, verificamos situação
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (authError) {
      return { error: authError }
    }

    if (authData.user) {
      // 2. Checar situação no banco
      const userProf = await loadProfile(authData.user.id, cleanEmail)

      if (userProf && userProf.situacao === 'inativo') {
        // Desloga imediatamente e bloqueia acesso
        await supabase.auth.signOut()
        setSession(null)
        setUser(null)
        setProfile(null)
        return {
          error: new Error('Sua conta está inativa. Fale com um administrador.'),
        }
      }
    }

    return { error: null }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    setProfile(null)
    setUser(null)
    setSession(null)
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    })
    return { error }
  }

  // Nome de exibição preferencial
  const userDisplayName =
    profile?.nome ||
    (user?.user_metadata?.nome as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.email ? user.email.split('@')[0].replace('.', ' ') : 'Louise Faraguti')

  const perfil =
    profile?.perfil ||
    (user?.email === 'louise.faraguti@corretorang.com.br' ? 'Administrador' : null)
  const funcao = profile?.funcao || null
  const situacao = profile?.situacao || 'ativo'
  const isAdmin = perfil === 'Administrador'
  const isGestor = perfil === 'Gestor'
  const isColaborador = perfil === 'Colaborador'

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        perfil,
        funcao,
        situacao,
        isAdmin,
        isGestor,
        isColaborador,
        signIn,
        signOut,
        resetPassword,
        refreshProfile,
        loading,
        userDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
