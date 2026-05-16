import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { Package, MapPin, Tag, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateTime, getStatusColor, getConditionColor } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  display: '#10b981',
  storage: '#3b82f6',
  loan: '#f59e0b',
  conservation: '#f97316',
  deaccessioned: '#ef4444'
}

const CONDITION_COLORS: Record<string, string> = {
  excellent: '#10b981',
  good: '#14b8a6',
  fair: '#f59e0b',
  poor: '#f97316',
  critical: '#ef4444',
  unknown: '#9ca3af'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [overview, setOverview] = useState<{
    totalItems: number
    totalValue: number
    byStatus: Array<{ status: string; count: number }>
    byCondition: Array<{ condition_rating: string; count: number }>
    recentItems: Array<{
      id: number
      accession_number: string
      title: string
      status: string
      condition_rating: string | null
      created_at: string
      category_name: string | null
    }>
    recentActivity: Array<{
      id: number
      table_name: string
      action: string
      username: string | null
      changed_at: string
    }>
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.reports
      .overview()
      .then(setOverview)
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Overview of your collection</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-3xl font-bold mt-1">{overview?.totalItems || 0}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">On Display</p>
                <p className="text-3xl font-bold mt-1">
                  {overview?.byStatus.find((s) => s.status === 'display')?.count || 0}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Tag className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Storage</p>
                <p className="text-3xl font-bold mt-1">
                  {overview?.byStatus.find((s) => s.status === 'storage')?.count || 0}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <MapPin className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Est. Value</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(overview?.totalValue || 0)}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={overview?.byStatus || []}>
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Items">
                  {(overview?.byStatus || []).map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status] || '#9ca3af'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Condition Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={overview?.byCondition || []}
                  dataKey="count"
                  nameKey="condition_rating"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ condition_rating, percent }) =>
                    `${condition_rating} (${(percent * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                >
                  {(overview?.byCondition || []).map((entry) => (
                    <Cell
                      key={entry.condition_rating}
                      fill={CONDITION_COLORS[entry.condition_rating] || '#9ca3af'}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently Added Items</CardTitle>
            <CardDescription>Latest additions to the collection</CardDescription>
          </CardHeader>
          <CardContent>
            {(overview?.recentItems || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No items yet. Add your first item!
              </p>
            ) : (
              <div className="space-y-3">
                {overview?.recentItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    onClick={() => navigate(`/items/${item.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.accession_number}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest changes to the collection</CardDescription>
          </CardHeader>
          <CardContent>
            {(overview?.recentActivity || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {overview?.recentActivity.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        entry.action === 'INSERT'
                          ? 'bg-green-500'
                          : entry.action === 'UPDATE'
                          ? 'bg-blue-500'
                          : entry.action === 'DELETE'
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{entry.username || 'System'}</span>{' '}
                        {entry.action === 'INSERT' ? 'added' : entry.action === 'UPDATE' ? 'updated' : 'deleted'} a{' '}
                        {entry.table_name.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(entry.changed_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
