import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, FolderTree } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useCategories } from '@/hooks/useCategories'
import type { Category } from '../types/electron'

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  parentId: z.string().optional()
})
type CategoryForm = z.infer<typeof categorySchema>

export default function CategoriesPage() {
  const { categories, loading, refetch } = useCategories()
  const [user, setUser] = useState<{ role: string } | null>(null)
  const [formDialog, setFormDialog] = useState<{
    open: boolean
    category: Category | null
  }>({ open: false, category: null })
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    category: Category | null
  }>({ open: false, category: null })
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema)
  })

  useEffect(() => {
    window.api.auth.getSession().then(setUser).catch(() => {})
  }, [])

  const openCreate = () => {
    reset({ name: '', description: '', parentId: '' })
    setFormDialog({ open: true, category: null })
  }

  const openEdit = (cat: Category) => {
    reset({
      name: cat.name,
      description: cat.description || '',
      parentId: cat.parent_id ? String(cat.parent_id) : ''
    })
    setFormDialog({ open: true, category: cat })
  }

  const onSave = async (data: CategoryForm) => {
    setSaving(true)
    try {
      const payload = {
        name: data.name,
        description: data.description || null,
        parentId: data.parentId && data.parentId !== 'none' ? Number(data.parentId) : null
      }

      if (formDialog.category) {
        await window.api.categories.update(formDialog.category.id, payload)
        toast.success('Category updated')
      } else {
        await window.api.categories.create(payload)
        toast.success('Category created')
      }
      setFormDialog({ open: false, category: null })
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog.category) return
    try {
      await window.api.categories.delete(deleteDialog.category.id)
      toast.success('Category deleted')
      setDeleteDialog({ open: false, category: null })
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const canEdit = user?.role === 'admin' || user?.role === 'editor'

  // Filter parent options (exclude current and its children)
  const parentOptions = formDialog.category
    ? categories.filter(
        (c) =>
          c.id !== formDialog.category!.id &&
          c.parent_id !== formDialog.category!.id
      )
    : categories

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500">{categories.length} categories</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40">
              <FolderTree className="h-10 w-10 text-gray-300 mb-2" />
              <p className="text-gray-500">No categories yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Items</TableHead>
                  {canEdit && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">
                      {cat.parent_id && (
                        <span className="text-muted-foreground mr-1">└</span>
                      )}
                      {cat.name}
                    </TableCell>
                    <TableCell>{cat.parent_name || '—'}</TableCell>
                    <TableCell className="max-w-xs">
                      <span className="text-sm text-muted-foreground truncate block">
                        {cat.description || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{cat.item_count}</span>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(cat)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {user?.role === 'admin' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteDialog({ open: true, category: cat })}
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
      <Dialog open={formDialog.open} onOpenChange={(open) => setFormDialog({ open, category: open ? formDialog.category : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formDialog.category ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name *</Label>
              <Input id="cat-name" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Parent Category</Label>
              <Select
                value={watch('parentId') || ''}
                onValueChange={(v) => setValue('parentId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level)</SelectItem>
                  {parentOptions.filter((c) => !c.parent_id).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea id="cat-desc" rows={2} {...register('description')} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormDialog({ open: false, category: null })}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : formDialog.category ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, category: open ? deleteDialog.category : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.category?.name}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, category: null })}>
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
