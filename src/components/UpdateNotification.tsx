import { useState, useEffect } from 'react'
import { Download, CheckCircle, X, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'not-available' }
  | { status: 'available'; version: string }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; error: string }

export default function UpdateNotification() {
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!window.api?.updater?.onStatus) return
    window.api.updater.onStatus((payload) => {
      setDismissed(false)
      if (payload.status === 'checking') {
        setUpdate({ status: 'checking' })
      } else if (payload.status === 'available') {
        setUpdate({ status: 'available', version: payload.version ?? '' })
      } else if (payload.status === 'downloading') {
        setUpdate({ status: 'downloading', version: payload.version ?? '', percent: payload.percent ?? 0 })
      } else if (payload.status === 'downloaded') {
        setUpdate({ status: 'downloaded', version: payload.version ?? '' })
      } else if (payload.status === 'not-available') {
        setUpdate({ status: 'not-available' })
        // Auto-dismiss after 3 s
        setTimeout(() => setDismissed(true), 3000)
      } else if (payload.status === 'error') {
        setUpdate({ status: 'error', error: payload.error ?? 'Unknown error' })
      }
    })
  }, [])

  if (update.status === 'idle' || update.status === 'checking' || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
      {update.status === 'not-available' && (
        <div className="flex items-center gap-3 p-4">
          <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
          <p className="text-sm text-gray-700 flex-1">You&apos;re on the latest version.</p>
          <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {update.status === 'available' && (
        <div className="flex items-center gap-3 p-4">
          <Download className="h-5 w-5 text-amber-500 shrink-0 animate-bounce" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">Update v{update.version} available</p>
            <p className="text-xs text-gray-500">Starting download…</p>
          </div>
        </div>
      )}

      {update.status === 'downloading' && (
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">Downloading v{update.version}</p>
              <p className="text-xs text-gray-500">{update.percent}% complete</p>
            </div>
            <span className="text-sm font-mono font-medium text-amber-600 shrink-0">
              {update.percent}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300 ease-out"
              style={{ width: `${update.percent}%` }}
            />
          </div>
        </div>
      )}

      {update.status === 'downloaded' && (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">v{update.version} ready to install</p>
              <p className="text-xs text-gray-500">The app will restart to apply the update.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-gray-600"
              onClick={() => setDismissed(true)}
            >
              Later
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              onClick={() => window.api.updater.install()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Restart &amp; install
            </Button>
          </div>
        </div>
      )}

      {update.status === 'error' && (
        <div className="flex items-start gap-3 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">Update failed</p>
            <p className="text-xs text-gray-500 truncate">{update.error}</p>
          </div>
          <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
