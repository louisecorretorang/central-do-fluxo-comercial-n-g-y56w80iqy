import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import NGLogo from '@/components/NGLogo'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const processAuth = async () => {
      // 1. Verificar se há erro no hash da URL (#error=...&error_description=...)
      // ou na query string (?error=...)
      const fullUrl = window.location.href
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.substring(1)
        : window.location.hash
      const search = window.location.search.startsWith('?')
        ? window.location.search.substring(1)
        : window.location.search

      const hashParams = new URLSearchParams(hash)
      const searchParams = new URLSearchParams(search)

      const errorCode = hashParams.get('error_code') || searchParams.get('error_code')
      const errorDesc = hashParams.get('error_description') || searchParams.get('error_description')
      const errorParam = hashParams.get('error') || searchParams.get('error')

      if (errorCode || errorParam || errorDesc) {
        if (!isMounted) return
        setStatus('error')

        const descLower = (errorDesc || '').toLowerCase()
        const codeLower = (errorCode || '').toLowerCase()

        if (
          codeLower.includes('otp_expired') ||
          descLower.includes('expired') ||
          descLower.includes('expirado') ||
          descLower.includes('invalid')
        ) {
          setErrorMessage(
            'Este link expirou ou já foi utilizado. Peça a um administrador para reenviar o convite pela página de Usuários.',
          )
        } else if (descLower.includes('denied') || codeLower.includes('access_denied')) {
          setErrorMessage(
            'Acesso negado. O link de ativação é inválido ou expirou. Solicite um novo convite ao administrador.',
          )
        } else {
          setErrorMessage(
            'Não foi possível validar seu link de acesso. Peça a um administrador para reenviar o convite.',
          )
        }
        return
      }

      // 2. Tratar tokens no hash (ex.: invite, recovery, access_token)
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type') || searchParams.get('type')

      if (accessToken && refreshToken) {
        try {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionErr) {
            console.error('Erro ao definir sessão por token:', sessionErr)
            if (!isMounted) return
            setStatus('error')
            setErrorMessage(
              'Este link expirou ou não é mais válido. Peça a um administrador para reenviar o convite.',
            )
            return
          }

          // Sessão estabelecida com sucesso
          if (!isMounted) return
          setStatus('success')

          // Se for convite ou recuperação de senha, direciona para definir a senha
          if (type === 'invite' || type === 'recovery' || type === 'signup' || !type) {
            setTimeout(() => {
              if (isMounted) {
                navigate('/definir-senha', { replace: true })
              }
            }, 800)
          } else {
            setTimeout(() => {
              if (isMounted) {
                navigate('/minha-fila', { replace: true })
              }
            }, 800)
          }
          return
        } catch (err) {
          console.error('Falha ao processar token:', err)
          if (!isMounted) return
          setStatus('error')
          setErrorMessage('Este link expirou. Peça a um administrador para reenviar o convite.')
          return
        }
      }

      // 3. Caso os tokens venham via PKCE code na query (?code=...)
      const code = searchParams.get('code')
      if (code) {
        try {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeErr) {
            console.error('Erro ao trocar code por sessão:', exchangeErr)
            if (!isMounted) return
            setStatus('error')
            setErrorMessage(
              'Este link expirou ou já foi utilizado. Peça a um administrador para reenviar o convite.',
            )
            return
          }

          if (!isMounted) return
          setStatus('success')
          setTimeout(() => {
            if (isMounted) {
              navigate('/definir-senha', { replace: true })
            }
          }, 800)
          return
        } catch {
          if (!isMounted) return
          setStatus('error')
          setErrorMessage('Este link expirou. Peça a um administrador para reenviar o convite.')
          return
        }
      }

      // 4. Se não havia hash nem code, mas já há uma sessão ativa
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (currentSession) {
        if (!isMounted) return
        setStatus('success')
        setTimeout(() => {
          if (isMounted) {
            navigate('/minha-fila', { replace: true })
          }
        }, 500)
        return
      }

      // 5. Sem tokens e sem sessão ativa
      if (!isMounted) return
      setStatus('error')
      setErrorMessage(
        'Nenhum dado de acesso encontrado no link. Peça a um administrador para reenviar o convite.',
      )
    }

    processAuth()

    return () => {
      isMounted = false
    }
  }, [navigate])

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 80% 20%, rgba(0, 168, 150, 0.22) 0%, rgba(12, 35, 64, 0) 65%), linear-gradient(135deg, #07192f 0%, #0C2340 50%, #0e2f47 100%)',
      }}
    >
      <div className="w-full max-w-[420px] z-10 animate-fade-in-up">
        <Card className="border border-white/10 bg-white shadow-2xl rounded-3xl overflow-hidden backdrop-blur-md">
          <CardHeader className="pt-8 pb-4 px-6 text-center flex flex-col items-center">
            <div className="mb-3">
              <NGLogo variant="color" />
            </div>
            <h1 className="text-xl font-extrabold text-[#0C2D48] tracking-tight">
              Central do Fluxo Comercial
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Ativação de conta e confirmação de acesso
            </p>
          </CardHeader>

          <CardContent className="px-6 pb-8 pt-2">
            {status === 'processing' && (
              <div className="flex flex-col items-center text-center py-6 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#00A896]" />
                <p className="text-sm font-semibold text-[#0C2D48]">Validando link de acesso...</p>
                <p className="text-xs text-slate-500 max-w-xs">
                  Aguarde um instante enquanto confirmamos sua autorização.
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="flex flex-col items-center text-center py-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-[#00A896]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-[#0C2D48]">Acesso validado com sucesso!</p>
                <p className="text-xs text-slate-500">
                  Redirecionando para a definição de senha...
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4 py-2">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Link não disponível</p>
                    <p className="text-amber-800 leading-relaxed">
                      {errorMessage ||
                        'Este link expirou. Peça a um administrador para reenviar o convite.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    onClick={() => navigate('/', { replace: true })}
                    className="w-full h-11 rounded-xl bg-[#0C2D48] hover:bg-[#071c2e] text-white font-semibold text-xs flex items-center justify-center gap-2 btn-press"
                  >
                    <span>Ir para a tela de login</span>
                    <ArrowRight className="w-4 h-4 text-teal-400" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} Nunes &amp; Grossi Corretora de Seguros.
        </p>
      </div>
    </div>
  )
}
