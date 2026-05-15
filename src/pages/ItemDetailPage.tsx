import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Upload,
  MapPin,
  Calendar,
  Tag,
  DollarSign,
  Package,
  FileText,
  History,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getStatusColor,
  getConditionColor
} from '@/lib/utils'
import type { Item, AuditLogEntry } from '../types/electron'

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [item, setItem] = useState<Item | null>(null)
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [moveDialog, setMoveDialog] = useState(false)
  const [moveStatus, setMoveStatus] = useState('')
  const [imageIndex, setImageIndex] = useState(0)
  const [user, setUser] = useState<{ role: string } | null>(null)

  useEffect(() => {
    window.api.auth.getSession().then(setUser).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      window.api.items.get(Number(id)),
      window.api.admin.auditLog.list({ tableName: 'items', limit: 20 })
    ])
      .then(([itemData, logData]) => {
        setItem(itemData)
        setMoveStatus(itemData.status)
        // Filter to this item's log entries
        setAuditLog(logData.entries.filter((e) => e.record_id === Number(id)))
      })
      .catch(() => toast.error('Failed to load item'))
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!item) return
    try {
      await window.api.items.delete(item.id)
      toast.success('Item deleted')
      navigate('/items')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const handleMove = async () => {
    if (!item) return
    try {
      await window.api.items.move(item.id, { status: moveStatus })
      toast.success('Item moved')
      setMoveDialog(false)
      const updated = await window.api.items.get(item.id)
      setItem(updated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to move item')
    }
  }

  const handleUploadImage = async () => {
    if (!item) return
    try {
      const result = await window.api.items.uploadImage(item.id)
      if (result.success) {
        toast.success('Image uploaded')
        const updated = await window.api.items.get(item.id)
        setItem(updated)
      }
    } catch (err) {
      toast.error('Failed to upload image')
    }
  }

  const canEdit = user?.role === 'admin' || user?.role === 'editor'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-gray-500">Item not found</p>
        <Button className="mt-4" onClick={() => navigate('/items')}>
          Back to Items
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{item.title}</h1>
            <p className="text-sm text-gray-500 font-mono mt-0.5">{item.accession_number}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setMoveDialog(true)}>
              <MapPin className="h-4 w-4 mr-2" />
              Move
            </Button>
            <Button variant="outline" onClick={handleUploadImage}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Image
            </Button>
            <Button variant="outline" onClick={() => navigate(`/items/${id}/edit`)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.status)}`}>
              {item.status}
            </span>
            {item.condition_rating && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getConditionColor(item.condition_rating)}`}>
                {item.condition_rating} condition
              </span>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{item.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Details Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Collection Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <DetailField label="Category" value={item.category_name} />
              <DetailField label="Location" value={item.location_name} />
              <DetailField
                label="Acquisition Date"
                value={formatDate(item.acquisition_date)}
              />
              <DetailField label="Acquisition Method" value={item.acquisition_method} />
              <DetailField label="Donor Name" value={item.donor_name} />
              <DetailField label="Estimated Value" value={formatCurrency(item.estimated_value)} />
            </CardContent>
          </Card>

          {/* Provenance */}
          {item.provenance && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Provenance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{item.provenance}</p>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {item.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{item.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {item.tags.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Image Gallery */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Images</CardTitle>
            </CardHeader>
            <CardContent>
              {item.imagePaths.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 bg-gray-50 rounded border-2 border-dashed border-gray-200">
                  <Package className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-xs text-gray-400">No images</p>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-xs"
                      onClick={handleUploadImage}
                    >
                      Upload
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative aspect-square rounded overflow-hidden bg-gray-100">
                    <img
                      src={`file://${item.imagePaths[imageIndex]}`}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = ''
                      }}
                    />
                  </div>
                  {item.imagePaths.length > 1 && (
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setImageIndex((i) => Math.max(0, i - 1))}
                        disabled={imageIndex === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {imageIndex + 1} / {item.imagePaths.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setImageIndex((i) => Math.min(item.imagePaths.length - 1, i + 1))
                        }
                        disabled={imageIndex === item.imagePaths.length - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Record Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{formatDateTime(item.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="text-sm">{formatDateTime(item.updated_at)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Audit Log */}
          {auditLog.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Recent Changes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auditLog.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2">
                      <div
                        className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          entry.action === 'INSERT'
                            ? 'bg-green-500'
                            : entry.action === 'UPDATE'
                            ? 'bg-blue-500'
                            : 'bg-red-500'
                        }`}
                      />
                      <div>
                        <p className="text-xs">
                          <span className="font-medium">{entry.username || 'System'}</span>{' '}
                          {entry.action === 'INSERT' ? 'created' : entry.action === 'UPDATE' ? 'updated' : 'deleted'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(entry.changed_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{item.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={moveDialog} onOpenChange={setMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Item</DialogTitle>
            <DialogDescription>Update the status of this item.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Status</label>
              <Select value={moveStatus} onValueChange={setMoveStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="display">Display</SelectItem>
                  <SelectItem value="storage">Storage</SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                  <SelectItem value="conservation">Conservation</SelectItem>
                  <SelectItem value="deaccessioned">Deaccessioned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMove}>Move Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm">{value || '—'}</p>
    </div>
  )
}
