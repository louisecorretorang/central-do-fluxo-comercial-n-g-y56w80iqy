import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import NGLogo from '@/components/NGLogo'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'

export default function DefinirSenha() {
  const navigate = useNavigate()
  const { session, loading: authLoading, updatePassword, refreshProfile } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Se não estiver autenticado após terminar de carregar, redireciona para o login
  useEffect(() => {
    if (!authLoading && !session) {
      navigate('/', { replace: true })
    }
  }, [session, authLoading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!password) {
      setErrorMessage('Digite sua nova senha.')
      return
    }

    if (password.length < 8) {
      setErrorMessage('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await updatePassword(password)
      if (error) {
        setErrorMessage(
          error.message?.includes('Password')
            ? 'A senha não atende aos requisitos mínimos de segurança.'
            : error.message || 'Não foi possível cadastrar a nova senha.',
        )
        return
      }

      await refreshProfile()
      setSuccess(true)

      // Redireciona para Minha Fila após mensagem de sucesso
      setTimeout(() => {
        navigate('/minha-fila', { replace: true })
      }, 1200)
    } catch {
      setErrorMessage('Ocorreu um erro ao definir sua senha. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#07192f]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    )
  }

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
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0C2D48] tracking-tight">
              Definir nova senha
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Crie sua senha de acesso para a Central do Fluxo Comercial N&amp;G
            </p>
          </CardHeader>

          <CardContent className="px-6 pb-8 pt-2">
            {success ? (
              <div className="py-6 space-y-4 text-center">
                <div className="w-14 h-14 rounded-full bg-teal-50 border border-teal-200 mx-auto flex items-center justify-center text-[#00A896]">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#0C2D48]">
                    Senha cadastrada com sucesso!
                  </h3>
                  <p className="text-xs text-slate-500">
                    Acessando sua conta na Central do Fluxo Comercial...
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5 animate-shake">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Nova senha */}
                <div className="space-y-1.5">
                  <Label htmlFor="nova-senha" className="text-xs font-semibold text-slate-700">
                    Nova senha (mínimo de 8 caracteres)
                  </Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      id="nova-senha"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      className="h-11 pl-10 pr-10 rounded-xl text-sm border-slate-200 focus-visible:ring-2 focus-visible:ring-teal-600"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirmar senha */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirmar-senha" className="text-xs font-semibold text-slate-700">
                    Confirmar nova senha
                  </Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      id="confirmar-senha"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repita sua senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={submitting}
                      className="h-11 pl-10 pr-10 rounded-xl text-sm border-slate-200 focus-visible:ring-2 focus-visible:ring-teal-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-xl bg-[#0C2D48] hover:bg-[#071c2e] text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 btn-press"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                      <span>Salvando senha...</span>
                    </>
                  ) : (
                    <>
                      <span>Salvar senha e entrar</span>
                      <ArrowRight className="w-4 h-4 text-teal-400" />
                    </>
                  )}
                </Button>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-teal-600 flex-shrink-0" />
                  <span>Sua senha deve ser mantida em sigilo.</span>
                </div>
              </form>
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
