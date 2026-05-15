import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Building2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const mfaSchema = z.object({
  totpToken: z.string().min(6, 'Enter your 6-digit code').max(8)
})
type MfaForm = z.infer<typeof mfaSchema>

export default function MfaPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const tempToken = (location.state as { tempToken?: string })?.tempToken
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<MfaForm>({
    resolver: zodResolver(mfaSchema)
  })

  if (!tempToken) {
    navigate('/login', { replace: true })
    return null
  }

  const onSubmit = async (data: MfaForm) => {
    setIsLoading(true)
    setError(null)

    try {
      await window.api.auth.verifyMfa({ tempToken, totpToken: data.totpToken })
      toast.success('Welcome back!')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-amber-100">
              <ShieldCheck className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totpToken">Authentication Code</Label>
              <Input
                id="totpToken"
                placeholder="000000"
                maxLength={8}
                className="text-center text-2xl tracking-widest"
                autoComplete="one-time-code"
                inputMode="numeric"
                {...register('totpToken')}
              />
              {errors.totpToken && (
                <p className="text-sm text-destructive">{errors.totpToken.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Verify'}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate('/login')}
            >
              Back to Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
