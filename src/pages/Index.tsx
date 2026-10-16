import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import NGLogo from '@/components/NGLogo'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'

export default function Index() {
  const { session, signIn, resetPassword, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal Esqueci minha senha
  const [forgotModalOpen, setForgotModalOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null)
  const [forgotError, setForgotError] = useState<string | null>(null)

  // Se já estiver autenticado, redireciona para a rota padrão
  useEffect(() => {
    if (!authLoading && session) {
      navigate('/minha-fila', { replace: true })
    }
  }, [session, authLoading, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setErrorMessage('Digite seu e-mail.')
      return
    }

    // Validação simples de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Digite um e-mail válido.')
      return
    }

    if (!password) {
      setErrorMessage('Digite sua senha.')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await signIn(trimmedEmail, password)
      if (error) {
        if (error.message?.includes('conta está inativa') || error.message?.includes('inativa')) {
          setErrorMessage('Sua conta está inativa. Fale com um administrador.')
        } else if (
          error.message?.includes('Invalid login credentials') ||
          error.message?.includes('invalid_grant') ||
          ('status' in error && (error as { status?: number }).status === 400)
        ) {
          setErrorMessage('E-mail ou senha incorretos.')
        } else if (
          error.message?.includes('Failed to fetch') ||
          error.message?.includes('Network')
        ) {
          setErrorMessage('Não foi possível conectar. Tente novamente.')
        } else {
          setErrorMessage(error.message || 'E-mail ou senha incorretos.')
        }
      } else {
        navigate('/minha-fila', { replace: true })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('inativa')) {
        setErrorMessage('Sua conta está inativa. Fale com um administrador.')
      } else {
        setErrorMessage('Não foi possível conectar. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError(null)
    setForgotSuccess(null)

    const trimmed = forgotEmail.trim()
    if (!trimmed) {
      setForgotError('Digite seu e-mail.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) {
      setForgotError('Digite um e-mail válido.')
      return
    }

    setForgotSubmitting(true)
    try {
      const { error } = await resetPassword(trimmed)
      if (error && error.message.includes('Failed to fetch')) {
        setForgotError('Não foi possível conectar. Tente novamente.')
      } else {
        // Mensagem exigida na especificação
        setForgotSuccess('Se o e-mail existir, enviaremos um link para redefinir sua senha.')
      }
    } catch {
      setForgotError('Não foi possível conectar. Tente novamente.')
    } finally {
      setForgotSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden"
      style={{
        // Degradê institucional baseado nas cores do site www.corretorang.com.br
        // Azul marinho profundo N&G (#07182b / #0C2340) transitando suavemente para turquesa/verde-água (#0a3641)
        background:
          'radial-gradient(ellipse at 80% 20%, rgba(0, 168, 150, 0.22) 0%, rgba(12, 35, 64, 0) 65%), linear-gradient(135deg, #07192f 0%, #0C2340 50%, #0e2f47 100%)',
      }}
    >
      {/* Elementos visuais sutis de fundo */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl pointer-events-none" />

      {/* Cartão Central de Login */}
      <div className="w-full max-w-[420px] z-10 animate-fade-in-up">
        <Card className="border border-white/10 bg-white shadow-2xl rounded-3xl overflow-hidden backdrop-blur-md">
          {/* Topo do cartão com Logo N&G */}
          <CardHeader className="pt-8 pb-4 px-6 text-center flex flex-col items-center">
            <div className="mb-3 transform transition-transform hover:scale-105">
              <NGLogo variant="color" />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#0C2D48] tracking-tight">
                Central do Fluxo Comercial
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Acesso restrito aos consultores e corretores da equipe N&amp;G
              </p>
            </div>
          </CardHeader>

          <CardContent className="px-6 pb-8 pt-2">
            {/* Mensagem de erro simples e clara */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Campo E-mail */}
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs font-semibold text-slate-700">
                  E-mail profissional
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Seu e-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="h-11 pl-10 rounded-xl text-sm border-slate-200 bg-slate-50/50 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-teal-600 transition-all"
                  />
                </div>
              </div>

              {/* Campo Senha com mostrar/ocultar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="text-xs font-semibold text-slate-700">
                    Senha de acesso
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email)
                      setForgotError(null)
                      setForgotSuccess(null)
                      setForgotModalOpen(true)
                    }}
                    className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline transition-colors focus:outline-none"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="h-11 pl-10 pr-10 rounded-xl text-sm border-slate-200 bg-slate-50/50 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-teal-600 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Botão Entrar com Spinner */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-[#0C2D48] hover:bg-[#071c2e] text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 btn-press"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar</span>
                    <ArrowRight className="w-4 h-4 text-teal-400" />
                  </>
                )}
              </Button>
            </form>

            {/* Aviso: Sem cadastro aberto */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-teal-600 flex-shrink-0" />
              <span>Acesso exclusivo para convidados da Corretora N&amp;G.</span>
            </div>
          </CardContent>
        </Card>

        {/* Rodapé institucional */}
        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} Nunes &amp; Grossi Corretora de Seguros. Todos os direitos
          reservados.
        </p>
      </div>

      {/* Modal / Dialog de Recuperação de Senha */}
      <Dialog open={forgotModalOpen} onOpenChange={setForgotModalOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
          <DialogHeader className="text-left pb-2">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/50 flex items-center justify-center text-teal-700 mb-2">
              <Lock className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-[#0C2D48]">Recuperar senha</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Informe seu e-mail cadastrado para enviarmos instruções de recuperação.
            </DialogDescription>
          </DialogHeader>

          {forgotSuccess ? (
            <div className="py-4 space-y-4">
              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">{forgotSuccess}</p>
              </div>
              <Button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="w-full h-11 rounded-xl bg-[#0C2D48] hover:bg-[#071c2e] text-white font-semibold text-xs btn-press"
              >
                Voltar ao login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4 pt-1">
              {forgotError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  <span>{forgotError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-xs font-semibold text-slate-700">
                  E-mail cadastrado
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="exemplo@corretorang.com.br"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    disabled={forgotSubmitting}
                    className="h-11 pl-10 rounded-xl text-sm border-slate-200 focus-visible:ring-2 focus-visible:ring-teal-600"
                    autoFocus
                  />
                </div>
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotModalOpen(false)}
                  className="h-11 px-4 rounded-xl text-slate-600 border-slate-200 btn-press text-xs font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="h-11 px-5 rounded-xl bg-[#0C2D48] hover:bg-[#071c2e] text-white font-semibold text-xs flex items-center gap-2 btn-press"
                >
                  {forgotSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <span>Enviar instruções</span>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
