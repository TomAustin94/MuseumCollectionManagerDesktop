import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Building2, Check, Eye, EyeOff, ShieldCheck,
  CheckCircle2, Database, Users, BarChart3, Copy
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { validatePasswordStrength } from '@/lib/utils'

const adminSchema = z
  .object({
    username: z.string().min(3, 'At least 3 characters').max(50),
    email: z.string().email('Invalid email address'),
    fullName: z.string().optional(),
    password: z.string().min(12, 'At least 12 characters'),
    confirmPassword: z.string()
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

const totpSchema = z.object({
  totpToken: z.string().min(6, 'Enter 6-digit code').max(8)
})

type AdminForm = z.infer<typeof adminSchema>
type TotpForm = z.infer<typeof totpSchema>
type Step = 'welcome' | 'account' | 'mfa' | 'done'

const STEPS: Step[] = ['welcome', 'account', 'mfa', 'done']

function StepDots({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current)
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              i < idx
                ? 'bg-green-600 text-white'
                : i === idx
                ? 'bg-amber-600 text-white'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            {i < idx ? <Check className="h-4 w-4" /> : i + 1}
          </div>
          {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-gray-200 mx-1" />}
        </div>
      ))}
    </div>
  )
}

export default function SetupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('welcome')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [password, setPassword] = useState('')
  const [mfaData, setMfaData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const adminForm = useForm<AdminForm>({ resolver: zodResolver(adminSchema) })
  const totpForm = useForm<TotpForm>({ resolver: zodResolver(totpSchema) })
  const passwordStrength = validatePasswordStrength(password)

  const onCreateAdmin = async (data: AdminForm) => {
    setIsLoading(true)
    setError(null)
    try {
      await window.api.setup.createAdmin({
        username: data.username,
        email: data.email,
        password: data.password,
        fullName: data.fullName || null
      })
      await window.api.auth.login({ username: data.username, password: data.password })
      const mfaSetup = await window.api.auth.setupMfa()
      setMfaData({ secret: mfaSetup.secret, qrCodeDataUrl: mfaSetup.qrCodeDataUrl })
      setStep('mfa')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setIsLoading(false)
    }
  }

  const onConfirmMfa = async (data: TotpForm) => {
    if (!mfaData) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.api.auth.confirmMfa({ token: data.totpToken, secret: mfaData.secret })
      setRecoveryCodes(result.recoveryCodes)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setIsLoading(false)
    }
  }

  const copyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const finish = () => {
    toast.success('Welcome to Museum Collection Manager!')
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <div className="p-3 rounded-full bg-amber-100">
              <Building2 className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Museum Collection Manager</CardTitle>
          <CardDescription className="text-base">
            {step === 'welcome' && 'Welcome — let\'s get you set up'}
            {step === 'account' && 'Create your admin account'}
            {step === 'mfa' && 'Enable two-factor authentication'}
            {step === 'done' && 'You\'re all set!'}
          </CardDescription>
          <StepDots current={step} />
        </CardHeader>

        <CardContent className="pt-2">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* ── Step 1: Welcome ── */}
          {step === 'welcome' && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground text-center">
                This is a fully offline desktop app for cataloguing and managing your museum's
                collection. All data stays on this machine — nothing is sent to the cloud.
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { icon: Database, label: 'SQLite database', sub: 'Local & fast' },
                  { icon: Users, label: 'Role-based access', sub: 'Admin, editor, viewer' },
                  { icon: BarChart3, label: 'Reports & export', sub: 'CSV & charts' }
                ].map(({ icon: Icon, label, sub }) => (
                  <div key={label} className="p-3 rounded-lg bg-gray-50 border space-y-1">
                    <Icon className="h-5 w-5 text-amber-600 mx-auto" />
                    <p className="text-xs font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                ))}
              </div>
              <Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={() => setStep('account')}>
                Get Started
              </Button>
            </div>
          )}

          {/* ── Step 2: Account ── */}
          {step === 'account' && (
            <form onSubmit={adminForm.handleSubmit(onCreateAdmin)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input id="username" placeholder="admin" autoFocus {...adminForm.register('username')} />
                  {adminForm.formState.errors.username && (
                    <p className="text-xs text-destructive">{adminForm.formState.errors.username.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" placeholder="Jane Smith" {...adminForm.register('fullName')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" placeholder="admin@museum.org" {...adminForm.register('email')} />
                {adminForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{adminForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 12 characters"
                    className="pr-10"
                    {...adminForm.register('password', { onChange: (e) => setPassword(e.target.value) })}
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && (
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full ${
                        i <= passwordStrength.score
                          ? passwordStrength.score >= 4 ? 'bg-green-500'
                            : passwordStrength.score >= 3 ? 'bg-yellow-500' : 'bg-red-500'
                          : 'bg-gray-200'
                      }`} />
                    ))}
                  </div>
                )}
                {adminForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{adminForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repeat password"
                    className="pr-10"
                    {...adminForm.register('confirmPassword')}
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {adminForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive">{adminForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={isLoading}>
                {isLoading ? 'Creating account…' : 'Create Admin Account'}
              </Button>
            </form>
          )}

          {/* ── Step 3: MFA ── */}
          {step === 'mfa' && mfaData && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.)
                to enable two-factor authentication. This is optional but strongly recommended.
              </p>

              <div className="flex justify-center p-4 bg-white rounded-lg border">
                {mfaData.qrCodeDataUrl
                  ? <img src={mfaData.qrCodeDataUrl} alt="TOTP QR Code" className="w-44 h-44" />
                  : <p className="text-sm text-muted-foreground">Loading…</p>
                }
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Can't scan? Enter key manually
                </summary>
                <code className="block mt-2 p-2 bg-gray-50 rounded border font-mono break-all text-xs">
                  {mfaData.secret}
                </code>
              </details>

              <form onSubmit={totpForm.handleSubmit(onConfirmMfa)} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="totpToken">6-digit code from your app</Label>
                  <Input
                    id="totpToken"
                    placeholder="000000"
                    maxLength={8}
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    inputMode="numeric"
                    autoFocus
                    {...totpForm.register('totpToken')}
                  />
                  {totpForm.formState.errors.totpToken && (
                    <p className="text-xs text-destructive">{totpForm.formState.errors.totpToken.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={isLoading}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {isLoading ? 'Verifying…' : 'Enable 2FA'}
                </Button>
              </form>

              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setStep('done')}>
                Skip — I'll set this up later in Settings
              </Button>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 'done' && (
            <div className="space-y-5">
              <div className="text-center py-2">
                <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold">Setup complete!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your Museum Collection Manager is ready to use.
                </p>
              </div>

              {recoveryCodes.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-yellow-800">Recovery codes</p>
                    <button
                      onClick={copyRecoveryCodes}
                      className="flex items-center gap-1 text-xs text-yellow-700 hover:text-yellow-900"
                    >
                      <Copy className="h-3 w-3" />
                      {copied ? 'Copied!' : 'Copy all'}
                    </button>
                  </div>
                  <p className="text-xs text-yellow-700">
                    Save these somewhere safe. Each code can only be used once to bypass 2FA.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {recoveryCodes.map((code) => (
                      <code key={code} className="text-xs font-mono bg-white px-2 py-1 rounded border text-center">
                        {code}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              <Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={finish}>
                Open My Collection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
