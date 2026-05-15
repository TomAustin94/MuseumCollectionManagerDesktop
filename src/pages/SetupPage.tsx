import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Building2, Check, Eye, EyeOff, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
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
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

type AdminForm = z.infer<typeof adminSchema>

const totpSchema = z.object({
  totpToken: z.string().min(6, 'Enter 6-digit code').max(8)
})
type TotpForm = z.infer<typeof totpSchema>

type Step = 'account' | 'mfa' | 'done'

export default function SetupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('account')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [password, setPassword] = useState('')
  const [mfaData, setMfaData] = useState<{
    secret: string
    qrCodeDataUrl: string
  } | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])

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

      // Log in automatically
      const loginResult = await window.api.auth.login({
        username: data.username,
        password: data.password
      })

      if (!loginResult.requiresMfa) {
        // Setup MFA optionally
        const mfaSetup = await window.api.auth.setupMfa()
        setMfaData({ secret: mfaSetup.secret, qrCodeDataUrl: mfaSetup.qrCodeDataUrl })
        setStep('mfa')
      }
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
      const result = await window.api.auth.confirmMfa({
        token: data.totpToken,
        secret: mfaData.secret
      })
      setRecoveryCodes(result.recoveryCodes)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA verification failed')
    } finally {
      setIsLoading(false)
    }
  }

  const skipMfa = () => setStep('done')

  const finish = () => {
    toast.success('Setup complete! Welcome to Museum Collection Manager.')
    navigate('/dashboard', { replace: true })
  }

  const stepTitles: Record<Step, string> = {
    account: 'Create Admin Account',
    mfa: 'Set Up Two-Factor Authentication',
    done: 'Setup Complete'
  }

  const stepNumbers: Record<Step, number> = { account: 1, mfa: 2, done: 3 }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-amber-100">
              <Building2 className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to Museum Collection Manager</CardTitle>
          <CardDescription>{stepTitles[step]}</CardDescription>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {(['account', 'mfa', 'done'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    stepNumbers[step] > i + 1
                      ? 'bg-green-600 text-white'
                      : stepNumbers[step] === i + 1
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {stepNumbers[step] > i + 1 ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                {i < 2 && <div className="w-8 h-0.5 bg-gray-200 mx-1" />}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'account' && (
            <form onSubmit={adminForm.handleSubmit(onCreateAdmin)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    placeholder="admin"
                    {...adminForm.register('username')}
                  />
                  {adminForm.formState.errors.username && (
                    <p className="text-xs text-destructive">
                      {adminForm.formState.errors.username.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" placeholder="John Smith" {...adminForm.register('fullName')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@museum.org"
                  {...adminForm.register('email')}
                />
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
                    {...adminForm.register('password', {
                      onChange: (e) => setPassword(e.target.value)
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i <= passwordStrength.score
                              ? passwordStrength.score >= 4
                                ? 'bg-green-500'
                                : passwordStrength.score >= 3
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    {passwordStrength.errors.length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {passwordStrength.errors.map((e) => (
                          <li key={e} className="flex items-center gap-1">
                            <span className="text-red-500">✗</span> {e}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {adminForm.formState.errors.password && (
                  <p className="text-xs text-destructive">
                    {adminForm.formState.errors.password.message}
                  </p>
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
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {adminForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive">
                    {adminForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create Admin Account'}
              </Button>
            </form>
          )}

          {step === 'mfa' && mfaData && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.) to
                enable two-factor authentication. This step is optional but recommended.
              </p>

              <div className="flex justify-center p-4 bg-white rounded-lg border">
                {mfaData.qrCodeDataUrl ? (
                  <img
                    src={mfaData.qrCodeDataUrl}
                    alt="QR Code for TOTP setup"
                    className="w-48 h-48"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading QR code...</p>
                )}
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Manual entry key:</p>
                <code className="text-xs font-mono break-all">{mfaData.secret}</code>
              </div>

              <form onSubmit={totpForm.handleSubmit(onConfirmMfa)} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="totpToken">Verification Code</Label>
                  <Input
                    id="totpToken"
                    placeholder="000000"
                    maxLength={8}
                    className="text-center text-xl tracking-widest"
                    inputMode="numeric"
                    {...totpForm.register('totpToken')}
                  />
                  {totpForm.formState.errors.totpToken && (
                    <p className="text-xs text-destructive">
                      {totpForm.formState.errors.totpToken.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {isLoading ? 'Verifying...' : 'Enable 2FA'}
                </Button>
              </form>

              <Button variant="outline" className="w-full" onClick={skipMfa}>
                Skip for now
              </Button>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold">Setup Complete!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your Museum Collection Manager is ready to use.
                </p>
              </div>

              {recoveryCodes.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800 mb-2">
                    Save these recovery codes in a safe place:
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {recoveryCodes.map((code) => (
                      <code key={code} className="text-xs font-mono bg-white p-1 rounded border text-center">
                        {code}
                      </code>
                    ))}
                  </div>
                  <p className="text-xs text-yellow-700 mt-2">
                    Each code can only be used once. Keep them secure.
                  </p>
                </div>
              )}

              <Button className="w-full" onClick={finish}>
                Get Started
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
