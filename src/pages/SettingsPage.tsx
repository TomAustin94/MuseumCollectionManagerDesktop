import { useEffect, useState } from 'react'
import { FolderOpen, X, HardDrive, Info, Network, Server, Monitor, Laptop, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type NetworkMode = 'standalone' | 'server' | 'client'

const MODE_LABELS: Record<NetworkMode, { label: string; icon: React.ReactNode; desc: string }> = {
  standalone: {
    label: 'Standalone',
    icon: <Monitor className="h-4 w-4" />,
    desc: 'Single PC — database is local to this machine.'
  },
  server: {
    label: 'Server',
    icon: <Server className="h-4 w-4" />,
    desc: 'This PC hosts the database and accepts connections from client PCs on the network.'
  },
  client: {
    label: 'Client',
    icon: <Laptop className="h-4 w-4" />,
    desc: 'This PC connects to a server PC over the network. No local database.'
  }
}

export default function SettingsPage() {
  const [backupDir, setBackupDir] = useState<string | null>(null)
  const [scheduleHour, setScheduleHour] = useState(2)
  const [retention, setRetention] = useState(7)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [networkMode, setNetworkMode] = useState<NetworkMode>('standalone')
  const [serverPort, setServerPort] = useState(4567)
  const [serverAddress, setServerAddress] = useState('')
  const [localIps, setLocalIps] = useState<string[]>([])
  const [networkSaving, setNetworkSaving] = useState(false)

  useEffect(() => {
    window.api.settings.get().then((s) => setBackupDir(s.backupDir)).catch(() => null)
    window.api.settings.getNetwork().then((n) => {
      setNetworkMode(n.networkMode)
      setServerPort(n.serverPort)
      setServerAddress(n.serverAddress)
    }).catch(() => null)
    window.api.settings.getLocalIps().then(setLocalIps).catch(() => null)
    window.api.settings.getBackupInfo().then((b) => {
      setScheduleHour(b.backupScheduleHour)
      setRetention(b.backupRetention)
    }).catch(() => null).finally(() => setLoading(false))
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

  const handleSaveNetwork = async () => {
    setNetworkSaving(true)
    try {
      await window.api.settings.setNetwork({
        networkMode,
        serverPort,
        serverAddress: serverAddress.trim()
      })
      toast.success('Network settings saved — restart the app for changes to take effect.')
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setNetworkSaving(false)
    }
  }

  const handleSaveSchedule = async () => {
    setScheduleSaving(true)
    try {
      await window.api.settings.setBackupSchedule({ backupScheduleHour: scheduleHour, backupRetention: retention })
      toast.success('Backup schedule saved')
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setScheduleSaving(false)
    }
  }

  const formatHour = (h: number) => {
    const ampm = h < 12 ? 'AM' : 'PM'
    const display = h % 12 === 0 ? 12 : h % 12
    return `${display}:00 ${ampm}`
  }

  const defaultDir = '~/.config/museum-collection-manager/backups'

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Application preferences</p>
      </div>

      {/* ── Network Mode ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">Network Mode</CardTitle>
          </div>
          <CardDescription>
            Choose how this PC connects to the museum database. Requires a restart to take effect.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && (
            <>
              {/* Mode selector */}
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(MODE_LABELS) as NetworkMode[]).map((mode) => {
                  const { label, icon, desc } = MODE_LABELS[mode]
                  const active = networkMode === mode
                  return (
                    <button
                      key={mode}
                      onClick={() => setNetworkMode(mode)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-colors ${
                        active
                          ? 'border-amber-500 bg-amber-50 text-amber-800'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-medium text-sm">
                        {icon}
                        {label}
                      </div>
                      <p className="text-xs text-gray-500 leading-tight">{desc}</p>
                    </button>
                  )
                })}
              </div>

              {/* Server mode: port + local IPs */}
              {networkMode === 'server' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Listen on port
                    </label>
                    <input
                      type="number"
                      min={1024}
                      max={65535}
                      value={serverPort}
                      onChange={(e) => setServerPort(Number(e.target.value))}
                      className="w-32 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  {localIps.length > 0 && (
                    <div className="p-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-800">
                      <p className="font-medium mb-1">Clients should connect to:</p>
                      <ul className="space-y-0.5">
                        {localIps.map((ip) => (
                          <li key={ip} className="font-mono">
                            {ip}:{serverPort}
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs mt-2 text-green-700">
                        Ensure port {serverPort} is allowed through your firewall.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Client mode: server address */}
              {networkMode === 'client' && (
                <div className="space-y-2 pt-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Server address{' '}
                    <span className="text-gray-400 font-normal">(IP:port)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="192.168.1.100:4567"
                    value={serverAddress}
                    onChange={(e) => setServerAddress(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-xs text-gray-500">
                    Enter the IP address and port shown on the server PC&apos;s Settings page.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  onClick={handleSaveNetwork}
                  disabled={networkSaving}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {networkSaving ? 'Saving…' : 'Save network settings'}
                </Button>
              </div>

              <div className="flex gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-700">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>
                  A restart is required after changing the network mode. In <strong>Server</strong>{' '}
                  mode, other PCs on the same network can connect using this PC&apos;s IP address.
                  In <strong>Client</strong> mode, this PC needs no local database — all data is
                  stored on the server PC.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Backup Location (standalone/server only) ──────── */}
      {(networkMode === 'standalone' || networkMode === 'server') && (
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
                <Button
                  variant="ghost"
                  onClick={handleClearDir}
                  className="flex items-center gap-2 text-gray-500"
                >
                  <X className="h-4 w-4" />
                  Reset to default
                </Button>
              )}
            </div>

            <div className="flex gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-700">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                To back up immediately or restore from a backup, use the <strong>Admin</strong> panel.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Backup Schedule (standalone/server only) ──────── */}
      {(networkMode === 'standalone' || networkMode === 'server') && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base">Backup Schedule</CardTitle>
            </div>
            <CardDescription>
              Configure when automatic backups run and how many are kept.
              The app must be running at the scheduled time for automatic backups to occur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!loading && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Daily backup time
                    </label>
                    <select
                      value={scheduleHour}
                      onChange={(e) => setScheduleHour(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{formatHour(i)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Backups to keep
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={retention}
                      onChange={(e) => setRetention(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSaveSchedule}
                  disabled={scheduleSaving}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {scheduleSaving ? 'Saving…' : 'Save schedule'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
