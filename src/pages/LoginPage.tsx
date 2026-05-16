import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Building2, Eye, EyeOff, Lock, Server, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Network mode / server address state
  const [networkMode, setNetworkMode] = useState<'standalone' | 'server' | 'client'>('standalone')
  const [serverAddress, setServerAddress] = useState('')
  const [serverAddressInput, setServerAddressInput] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'unchecked' | 'checking' | 'ok' | 'error'>('unchecked')
  const [connectionError, setConnectionError] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  })

  useEffect(() => {
    window.api.auth.getSession().then((user) => {
      if (user) navigate(from, { replace: true })
    }).catch(() => {})

    window.api.setup.isFirstRun().then((firstRun) => {
      if (firstRun) navigate('/setup', { replace: true })
    }).catch(() => {})

    window.api.settings.getNetwork().then((n) => {
      setNetworkMode(n.networkMode)
      setServerAddress(n.serverAddress)
      setServerAddressInput(n.serverAddress)
    }).catch(() => null)
  }, [navigate, from])

  const testAndSaveAddress = async () => {
    const addr = serverAddressInput.trim()
    if (!addr) {
      setConnectionError('Please enter the server address.')
      setConnectionStatus('error')
      return
    }
    setSavingAddress(true)
    setConnectionStatus('checking')
    setConnectionError('')
    try {
      // Try to reach the server
      const res = await fetch(`http://${addr}/api/setup/is-first-run`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      // Save
      await window.api.settings.setServerAddress(addr)
      setServerAddress(addr)
      setConnectionStatus('ok')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not reach server'
      setConnectionError(`Connection failed: ${msg}. Check the address and that the server is running.`)
      setConnectionStatus('error')
    } finally {
      setSavingAddress(false)
    }
  }

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.api.auth.login(data)

      if (result.requiresMfa) {
        navigate('/login/mfa', { state: { tempToken: result.tempToken } })
      } else {
        toast.success('Welcome back!')
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const isClientWithNoAddress = networkMode === 'client' && !serverAddress

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-amber-100">
              <Building2 className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Museum Collection Manager</CardTitle>
          <CardDescription>Sign in to access your collection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Client mode: server address selector */}
          {networkMode === 'client' && (
            <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 space-y-3">
              <div className="flex items-center gap-2 text-amber-800">
                <Server className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm font-medium">Connecting to server</p>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. 192.168.1.100:4567"
                  value={serverAddressInput}
                  onChange={(e) => {
                    setServerAddressInput(e.target.value)
                    setConnectionStatus('unchecked')
                  }}
                  className="font-mono text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && testAndSaveAddress()}
                />
                <Button
                  variant="outline"
                  onClick={testAndSaveAddress}
                  disabled={savingAddress}
                  className="shrink-0"
                >
                  {savingAddress ? '…' : 'Connect'}
                </Button>
              </div>

              {connectionStatus === 'ok' && (
                <div className="flex items-center gap-1.5 text-green-700 text-xs">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Connected to {serverAddress}
                </div>
              )}
              {connectionStatus === 'error' && (
                <div className="flex items-start gap-1.5 text-red-700 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  {connectionError}
                </div>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter your username"
                autoComplete="username"
                disabled={isClientWithNoAddress}
                {...register('username')}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="pr-10"
                  disabled={isClientWithNoAddress}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            {isClientWithNoAddress && (
              <p className="text-xs text-amber-700 text-center">
                Connect to a server above before signing in.
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading || isClientWithNoAddress}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
