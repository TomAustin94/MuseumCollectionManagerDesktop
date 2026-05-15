import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend
} from 'recharts'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, getConditionColor, getLocationTypeColor } from '@/lib/utils'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

const CONDITION_COLORS: Record<string, string> = {
  excellent: '#10b981',
  good: '#14b8a6',
  fair: '#f59e0b',
  poor: '#f97316',
  critical: '#ef4444',
  unknown: '#9ca3af'
}

export default function ReportsPage() {
  const [overview, setOverview] = useState<{
    totalItems: number
    totalValue: number
    byStatus: Array<{ status: string; count: number }>
    byCondition: Array<{ condition_rating: string; count: number }>
  } | null>(null)

  const [locationData, setLocationData] = useState<{
    byLocation: Array<{ id: number; name: string; type: string; item_count: number; total_value: number | null }>
    unlocated: number
  } | null>(null)

  const [acquisitionData, setAcquisitionData] = useState<{
    byYear: Array<{ year: string; count: number; total_value: number | null }>
    byMonth: Array<{ month: string; count: number; total_value: number | null }>
    byMethod: Array<{ method: string; count: number }>
  } | null>(null)

  const [conditionData, setConditionData] = useState<{
    conditionBreakdown: Array<{ condition_rating: string; count: number; total_value: number | null }>
    byCategory: Array<{ category_name: string; condition_rating: string; count: number }>
    itemsNeedingAttention: Array<{
      id: number; title: string; condition_rating: string | null;
      category_name: string | null; location_name: string | null; estimated_value: number | null
    }>
  } | null>(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      window.api.reports.overview(),
      window.api.reports.byLocation(),
      window.api.reports.acquisitionTimeline(),
      window.api.reports.conditionSummary()
    ])
      .then(([ov, loc, acq, cond]) => {
        setOverview(ov)
        setLocationData(loc)
        setAcquisitionData(acq)
        setConditionData(cond)
      })
      .catch(() => toast.error('Failed to load reports'))
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500">Collection analytics and statistics</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="locations">By Location</TabsTrigger>
          <TabsTrigger value="acquisition">Acquisition Timeline</TabsTrigger>
          <TabsTrigger value="condition">Condition</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="text-3xl font-bold">{overview?.totalItems || 0}</p>
                </CardContent>
              </Card>
              {overview?.byStatus.map((s) => (
                <Card key={s.status}>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground capitalize">{s.status}</p>
                    <p className="text-3xl font-bold">{s.count}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Items by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={overview?.byStatus || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Items" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Condition Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={overview?.byCondition || []}
                        dataKey="count"
                        nameKey="condition_rating"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ condition_rating, percent }) =>
                          `${condition_rating}: ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {(overview?.byCondition || []).map((entry, i) => (
                          <Cell
                            key={entry.condition_rating}
                            fill={CONDITION_COLORS[entry.condition_rating] || COLORS[i % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations">
          <div className="space-y-6">
            {locationData?.unlocated !== undefined && locationData.unlocated > 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>{locationData.unlocated}</strong> item(s) have no location assigned
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Items per Location</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={locationData?.byLocation || []}
                    layout="vertical"
                    margin={{ left: 100 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="item_count" name="Items" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(locationData?.byLocation || []).map((loc) => (
                      <TableRow key={loc.id}>
                        <TableCell className="font-medium">{loc.name}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getLocationTypeColor(loc.type)}`}>
                            {loc.type}
                          </span>
                        </TableCell>
                        <TableCell>{loc.item_count}</TableCell>
                        <TableCell>{formatCurrency(loc.total_value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Acquisition Timeline Tab */}
        <TabsContent value="acquisition">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acquisitions per Year</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={acquisitionData?.byYear || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Items Acquired" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly Acquisitions (Last 2 Years)</CardTitle>
              </CardHeader>
              <CardContent>
                {(acquisitionData?.byMonth || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No acquisition date data available
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={acquisitionData?.byMonth || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" name="Items" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acquisition Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={acquisitionData?.byMethod || []}
                      dataKey="count"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ method, percent }) => `${method}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {(acquisitionData?.byMethod || []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Condition Tab */}
        <TabsContent value="condition">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Condition Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={conditionData?.conditionBreakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="condition_rating" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Items">
                        {(conditionData?.conditionBreakdown || []).map((entry) => (
                          <Cell
                            key={entry.condition_rating}
                            fill={CONDITION_COLORS[entry.condition_rating] || '#9ca3af'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Condition</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Total Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(conditionData?.conditionBreakdown || []).map((row) => (
                        <TableRow key={row.condition_rating}>
                          <TableCell>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${getConditionColor(row.condition_rating)}`}
                            >
                              {row.condition_rating}
                            </span>
                          </TableCell>
                          <TableCell>{row.count}</TableCell>
                          <TableCell>{formatCurrency(row.total_value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Items needing attention */}
            {(conditionData?.itemsNeedingAttention || []).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Items Needing Attention</CardTitle>
                  <CardDescription>Items in poor or critical condition</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Est. Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {conditionData?.itemsNeedingAttention.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${getConditionColor(item.condition_rating)}`}
                            >
                              {item.condition_rating}
                            </span>
                          </TableCell>
                          <TableCell>{item.category_name || '—'}</TableCell>
                          <TableCell>{item.location_name || '—'}</TableCell>
                          <TableCell>{formatCurrency(item.estimated_value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
