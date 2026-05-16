import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Plus, Download } from 'lucide-react'
import { toast } from 'sonner'
import Sidebar from './Sidebar'
import { Button } from './ui/button'

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const navigate = useNavigate()

  const handleExport = async () => {
    try {
      const result = await window.api.export.csv()
      if (result.success) {
        toast.success(`Exported ${result.count} items to ${result.filePath}`)
      } else if (result.reason !== 'cancelled') {
        toast.error('Export failed')
      }
    } catch {
      toast.error('Export failed')
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-end gap-2 px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="flex items-center gap-1.5 text-gray-600"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/items/new')}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            New Item
          </Button>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
