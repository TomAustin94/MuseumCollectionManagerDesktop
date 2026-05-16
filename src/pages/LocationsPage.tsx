import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useLocations } from '@/hooks/useLocations'
import { getLocationTypeColor } from '@/lib/utils'
import type { Location } from '../types/electron'

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  type: z.enum(['gallery', 'storage', 'conservation', 'loan', 'other']),
  description: z.string().optional()
})
type LocationForm = z.infer<typeof locationSchema>

export default function LocationsPage() {
  const navigate = useNavigate()
  const { locations, loading, refetch } = useLocations()
  const [user, setUser] = useState<{ role: string } | null>(null)
  const [formDialog, setFormDialog] = useState<{
    open: boolean
    location: Location | null
  }>({ open: false, location: null })
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    location: Location | null
  }>({ open: false, location: null })
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<LocationForm>({
    resolver: zodResolver(locationSchema),
    defaultValues: { type: 'storage' }
  })

  useEffect(() => {
    window.api.auth.getSession().then(setUser).catch(() => {})
  }, [])

  const openCreate = () => {
    reset({ name: '', type: 'storage', description: '' })
    setFormDialog({ open: true, location: null })
  }

  const openEdit = (loc: Location) => {
    reset({
      name: loc.name,
      type: loc.type,
      description: loc.description || ''
    })
    setFormDialog({ open: true, location: loc })
  }

  const onSave = async (data: LocationForm) => {
    setSaving(true)
    try {
      const payload = {
        name: data.name,
        type: data.type,
        description: data.description || null
      }

      if (formDialog.location) {
        await window.api.locations.update(formDialog.location.id, payload)
        toast.success('Location updated')
      } else {
        await window.api.locations.create(payload)
        toast.success('Location created')
      }
      setFormDialog({ open: false, location: null })
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save location')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog.location) return
    try {
      await window.api.locations.delete(deleteDialog.location.id)
      toast.success('Location deleted')
      setDeleteDialog({ open: false, location: null })
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const canEdit = user?.role === 'admin' || user?.role === 'editor'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-sm text-gray-500">{locations.length} locations</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          ) : locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40">
              <MapPin className="h-10 w-10 text-gray-300 mb-2" />
              <p className="text-gray-500">No locations yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Items</TableHead>
                  {canEdit && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => (
                  <TableRow
                    key={loc.id}
                    className="cursor-pointer hover:bg-amber-50"
                    onClick={() => navigate(`/items?locationId=${loc.id}`)}
                  >
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${getLocationTypeColor(loc.type)}`}
                      >
                        {loc.type}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="text-sm text-muted-foreground truncate block">
                        {loc.description || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-amber-700 underline underline-offset-2">
                        {loc.item_count} item{loc.item_count !== 1 ? 's' : ''}
                      </span>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); openEdit(loc) }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {user?.role === 'admin' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, location: loc }) }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog
        open={formDialog.open}
        onOpenChange={(open) => setFormDialog({ open, location: open ? formDialog.location : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formDialog.location ? 'Edit Location' : 'New Location'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loc-name">Name *</Label>
              <Input id="loc-name" placeholder="Gallery A, Vault 1..." {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={watch('type')}
                onValueChange={(v) => setValue('type', v as LocationForm['type'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gallery">Gallery</SelectItem>
                  <SelectItem value="storage">Storage</SelectItem>
                  <SelectItem value="conservation">Conservation</SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loc-desc">Description</Label>
              <Textarea id="loc-desc" rows={2} {...register('description')} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormDialog({ open: false, location: null })}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : formDialog.location ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, location: open ? deleteDialog.location : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.location?.name}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, location: null })}>
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
