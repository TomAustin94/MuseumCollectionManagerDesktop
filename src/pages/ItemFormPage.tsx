import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Upload, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useCategories } from '@/hooks/useCategories'
import { useLocations } from '@/hooks/useLocations'
import type { Item } from '../types/electron'

const itemSchema = z.object({
  accessionNumber: z.string().min(1, 'Required').max(100),
  title: z.string().min(1, 'Required').max(500),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  locationId: z.string().optional(),
  status: z.enum(['storage', 'display', 'loan', 'conservation', 'deaccessioned']),
  acquisitionDate: z.string().optional(),
  acquisitionMethod: z.string().optional(),
  donorName: z.string().optional(),
  estimatedValue: z.string().optional(),
  conditionRating: z.string().optional(),
  provenance: z.string().optional(),
  notes: z.string().optional()
})

type ItemForm = z.infer<typeof itemSchema>

export default function ItemFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id
  const { categories } = useCategories()
  const { locations } = useLocations()

  const [loading, setLoading] = useState(false)
  const [loadingItem, setLoadingItem] = useState(isEdit)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [imagePaths, setImagePaths] = useState<string[]>([])
  const [savedItemId, setSavedItemId] = useState<number | null>(isEdit ? Number(id) : null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: { status: 'storage' }
  })

  useEffect(() => {
    if (!isEdit || !id) return

    setLoadingItem(true)
    window.api.items
      .get(Number(id))
      .then((item) => {
        reset({
          accessionNumber: item.accession_number,
          title: item.title,
          description: item.description || '',
          categoryId: item.category_id ? String(item.category_id) : '',
          locationId: item.location_id ? String(item.location_id) : '',
          status: item.status,
          acquisitionDate: item.acquisition_date || '',
          acquisitionMethod: item.acquisition_method || '',
          donorName: item.donor_name || '',
          estimatedValue: item.estimated_value ? String(item.estimated_value) : '',
          conditionRating: item.condition_rating || '',
          provenance: item.provenance || '',
          notes: item.notes || ''
        })
        setTags(item.tags || [])
        setImagePaths(item.imagePaths || [])
      })
      .catch(() => toast.error('Failed to load item'))
      .finally(() => setLoadingItem(false))
  }, [id, isEdit, reset])

  const onSubmit = async (data: ItemForm) => {
    setLoading(true)
    setError(null)

    const payload = {
      accessionNumber: data.accessionNumber,
      title: data.title,
      description: data.description || null,
      categoryId: data.categoryId ? Number(data.categoryId) : null,
      locationId: data.locationId ? Number(data.locationId) : null,
      status: data.status,
      acquisitionDate: data.acquisitionDate || null,
      acquisitionMethod: data.acquisitionMethod || null,
      donorName: data.donorName || null,
      estimatedValue: data.estimatedValue ? parseFloat(data.estimatedValue) : null,
      conditionRating: data.conditionRating || null,
      provenance: data.provenance || null,
      notes: data.notes || null,
      tags,
      imagePaths
    }

    try {
      if (isEdit && id) {
        await window.api.items.update(Number(id), payload)
        toast.success('Item updated')
        navigate(`/items/${id}`)
      } else {
        const result = await window.api.items.create(payload)
        toast.success('Item created')
        setSavedItemId(result.id)
        navigate(`/items/${result.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadImage = async () => {
    const itemId = savedItemId
    if (!itemId) {
      toast.error('Save the item first before uploading images')
      return
    }
    try {
      const result = await window.api.items.uploadImage(itemId)
      if (result.success) {
        setImagePaths(result.imagePaths)
        toast.success('Image uploaded')
      }
    } catch {
      toast.error('Failed to upload image')
    }
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  if (loadingItem) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Item' : 'Add New Item'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update collection item details' : 'Add a new item to the collection'}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accessionNumber">Accession Number *</Label>
              <Input
                id="accessionNumber"
                placeholder="2024.001.001"
                {...register('accessionNumber')}
              />
              {errors.accessionNumber && (
                <p className="text-xs text-destructive">{errors.accessionNumber.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" placeholder="Item title" {...register('title')} />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the item..."
                rows={3}
                {...register('description')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Classification */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classification</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={watch('categoryId') || ''}
                onValueChange={(v) => setValue('categoryId', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.parent_name ? `${c.parent_name} / ${c.name}` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Select
                value={watch('locationId') || ''}
                onValueChange={(v) => setValue('locationId', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status *</Label>
              <Select
                value={watch('status')}
                onValueChange={(v) => setValue('status', v as ItemForm['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="storage">Storage</SelectItem>
                  <SelectItem value="display">Display</SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                  <SelectItem value="conservation">Conservation</SelectItem>
                  <SelectItem value="deaccessioned">Deaccessioned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Condition</Label>
              <Select
                value={watch('conditionRating') || ''}
                onValueChange={(v) => setValue('conditionRating', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unknown</SelectItem>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Acquisition */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acquisition</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="acquisitionDate">Acquisition Date</Label>
              <Input
                id="acquisitionDate"
                type="date"
                {...register('acquisitionDate')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="acquisitionMethod">Acquisition Method</Label>
              <Input
                id="acquisitionMethod"
                placeholder="Gift, Purchase, Bequest..."
                {...register('acquisitionMethod')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="donorName">Donor Name</Label>
              <Input
                id="donorName"
                placeholder="Donor or seller name"
                {...register('donorName')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedValue">Estimated Value (USD)</Label>
              <Input
                id="estimatedValue"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                {...register('estimatedValue')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Provenance & Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provenance & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provenance">Provenance</Label>
              <Textarea
                id="provenance"
                placeholder="History of ownership and origin..."
                rows={3}
                {...register('provenance')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                rows={3}
                {...register('notes')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Images */}
        {isEdit && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                {imagePaths.map((p, i) => (
                  <div key={i} className="relative w-24 h-24 rounded overflow-hidden bg-gray-100">
                    <img
                      src={`file://${p}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={handleUploadImage}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Images
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update Item' : 'Create Item'}
          </Button>
        </div>
      </form>
    </div>
  )
}
