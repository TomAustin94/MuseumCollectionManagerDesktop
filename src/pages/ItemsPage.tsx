import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper
} from '@tanstack/react-table'
import { Search, X, Eye, Pencil, Trash2, Filter, Package } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { formatCurrency, formatDate, getStatusColor, getConditionColor, truncate } from '@/lib/utils'
import { useCategories } from '@/hooks/useCategories'
import { useLocations } from '@/hooks/useLocations'
import type { Item } from '../types/electron'

const columnHelper = createColumnHelper<Item>()

export default function ItemsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { categories } = useCategories()
  const { locations } = useLocations()

  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? '')
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get('categoryId') ?? '')
  const [locationFilter, setLocationFilter] = useState<string>(searchParams.get('locationId') ?? '')
  const [conditionFilter, setConditionFilter] = useState<string>(searchParams.get('conditionRating') ?? '')
  const [showFilters, setShowFilters] = useState(
    !!(searchParams.get('status') || searchParams.get('categoryId') || searchParams.get('locationId') || searchParams.get('conditionRating'))
  )
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Item | null }>({
    open: false,
    item: null
  })
  const [user, setUser] = useState<{ role: string } | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  const LIMIT = 50

  useEffect(() => {
    window.api.auth.getSession().then(setUser).catch(() => {})
  }, [])

  useEffect(() => {
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 250)
    return () => clearTimeout(searchTimeout.current)
  }, [search])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      let result
      if (debouncedSearch.trim()) {
        result = await window.api.items.search(debouncedSearch, { page, limit: LIMIT })
      } else {
        result = await window.api.items.list({
          page,
          limit: LIMIT,
          status: statusFilter || undefined,
          categoryId: categoryFilter ? Number(categoryFilter) : undefined,
          locationId: locationFilter ? Number(locationFilter) : undefined,
          conditionRating: conditionFilter || undefined
        })
      }
      setItems(result.items)
      setTotal(result.total)
      setTotalPages(result.totalPages || Math.ceil(result.total / LIMIT))
    } catch (err) {
      toast.error('Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, statusFilter, categoryFilter, locationFilter, conditionFilter])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleDelete = async () => {
    if (!deleteDialog.item) return
    try {
      await window.api.items.delete(deleteDialog.item.id)
      toast.success('Item deleted')
      setDeleteDialog({ open: false, item: null })
      fetchItems()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const clearFilters = () => {
    setStatusFilter('')
    setCategoryFilter('')
    setLocationFilter('')
    setConditionFilter('')
    setSearch('')
    setPage(1)
  }

  const hasFilters = statusFilter || categoryFilter || locationFilter || conditionFilter || search

  const columns = [
    columnHelper.accessor('accession_number', {
      header: 'Accession #',
      cell: (info) => (
        <span className="font-mono text-sm">{info.getValue()}</span>
      )
    }),
    columnHelper.accessor('title', {
      header: 'Title',
      cell: (info) => (
        <span className="font-medium">{truncate(info.getValue(), 60)}</span>
      )
    }),
    columnHelper.accessor('category_name', {
      header: 'Category',
      cell: (info) => info.getValue() || <span className="text-muted-foreground">—</span>
    }),
    columnHelper.accessor('location_name', {
      header: 'Location',
      cell: (info) => info.getValue() || <span className="text-muted-foreground">—</span>
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(info.getValue())}`}
        >
          {info.getValue()}
        </span>
      )
    }),
    columnHelper.accessor('condition_rating', {
      header: 'Condition',
      cell: (info) =>
        info.getValue() ? (
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${getConditionColor(info.getValue())}`}
          >
            {info.getValue()}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )
    }),
    columnHelper.accessor('estimated_value', {
      header: 'Est. Value',
      cell: (info) => (
        <span className="text-sm">{formatCurrency(info.getValue())}</span>
      )
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(`/items/${row.original.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {(user?.role === 'admin' || user?.role === 'editor') && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate(`/items/${row.original.id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {(user?.role === 'admin' || user?.role === 'editor') && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setDeleteDialog({ open: true, item: row.original })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )
    })
  ]

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Items</h1>
            <p className="text-sm text-gray-500">{total} item{total !== 1 ? 's' : ''} total</p>
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            onClick={() => setShowFilters((v) => !v)}
            className={showFilters ? 'bg-gray-100' : ''}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasFilters && (
              <span className="ml-2 bg-amber-600 text-white rounded-full text-xs w-4 h-4 flex items-center justify-center">
                !
              </span>
            )}
          </Button>

          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} size="sm">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="flex gap-2 flex-wrap mt-3">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="display">Display</SelectItem>
                <SelectItem value="storage">Storage</SelectItem>
                <SelectItem value="loan">Loan</SelectItem>
                <SelectItem value="conservation">Conservation</SelectItem>
                <SelectItem value="deaccessioned">Deaccessioned</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={(v) => { setLocationFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={conditionFilter} onValueChange={(v) => { setConditionFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All conditions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All conditions</SelectItem>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Package className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No items found</p>
            <p className="text-sm text-gray-400">
              {hasFilters ? 'Try adjusting your filters' : 'Add your first item to get started'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/items/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      onClick={
                        cell.column.id === 'actions'
                          ? (e) => e.stopPropagation()
                          : undefined
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t bg-white">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.item?.title}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, item: null })}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
