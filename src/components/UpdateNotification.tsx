import { useState, useEffect } from 'react'
import { Download, CheckCircle, X, RefreshCw, AlertCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

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
        setTimeout(() => setDismissed(true), 3000)
      } else if (payload.status === 'error') {
        setUpdate({ status: 'error', error: payload.error ?? 'Unknown error' })
      }
    })
  }, [])

  if (update.status === 'idle' || update.status === 'checking' || dismissed) return null

  // Full dialog for downloading and downloaded states
  if (update.status === 'downloading' || update.status === 'downloaded') {
    return (
      <Dialog open>
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => {
            // Allow interaction outside during download so user can keep working
            if (update.status === 'downloading') e.preventDefault()
          }}
        >
          {update.status === 'downloading' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-amber-500 animate-bounce" />
                  Downloading update v{update.version}
                </DialogTitle>
                <DialogDescription>
                  Your update is downloading in the background.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-mono font-medium text-amber-600">{update.percent}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-300 ease-out"
                      style={{ width: `${update.percent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-800">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>
                    You can continue working on the database while the update downloads. The app
                    will ask you to restart once it&apos;s ready.
                  </p>
                </div>
              </div>
            </>
          )}

          {update.status === 'downloaded' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Update v{update.version} ready to install
                </DialogTitle>
                <DialogDescription>
                  The update has downloaded and is ready to apply.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-800">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>
                    Your collection data is safe. The app will restart briefly to apply the
                    update, then reopen automatically.
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDismissed(true)}>
                  Remind me later
                </Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                  onClick={() => window.api.updater.install()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Restart &amp; install
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  // Small floating card for other states
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
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">Update v{update.version} available</p>
              <p className="text-xs text-gray-500">Download runs in the background — you can keep working.</p>
            </div>
            <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-gray-600 shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 text-gray-600" onClick={() => setDismissed(true)}>
              Later
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              onClick={() => window.api.updater.download()}
            >
              <Download className="h-3.5 w-3.5" />
              Download
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
