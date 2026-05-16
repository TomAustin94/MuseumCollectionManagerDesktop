import { useEffect, useState } from 'react'
import { FolderOpen, X, HardDrive, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  const [backupDir, setBackupDir] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.settings.get().then((s) => {
      setBackupDir(s.backupDir)
      setLoading(false)
    })
  }, [])

  const handleChooseDir = async () => {
    const result = await window.api.settings.chooseBackupDir()
    if (!result.cancelled && result.path) {
      setBackupDir(result.path)
      toast.success('Backup location updated')
    }
  }

  const handleClearDir = async () => {
    await window.api.settings.setBackupDir(null)
    setBackupDir(null)
    toast.success('Backup location reset to default')
  }

  const defaultDir = '~/.config/museum-collection-manager/backups'

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Application preferences</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">Automatic Backup Location</CardTitle>
          </div>
          <CardDescription>
            The app backs up the database automatically once per day. Choose a custom folder to
            save backups to a NAS, SharePoint sync folder, or any other location.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border">
              <FolderOpen className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 flex-1 truncate font-mono">
                {backupDir ?? defaultDir}
              </span>
              {backupDir && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium flex-shrink-0">
                  Custom
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleChooseDir} className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Choose folder…
            </Button>
            {backupDir && (
              <Button variant="ghost" onClick={handleClearDir} className="flex items-center gap-2 text-gray-500">
                <X className="h-4 w-4" />
                Reset to default
              </Button>
            )}
          </div>

          <div className="flex gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-700">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              Up to 7 daily backups are kept. The most recent backup is never deleted.
              To back up immediately or restore from a backup, use the <strong>Admin</strong> panel.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
