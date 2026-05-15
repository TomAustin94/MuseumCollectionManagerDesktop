import { useState, useEffect, useCallback } from 'react'
import type { Item, PaginatedResult } from '../types/electron'

interface UseItemsOptions {
  page?: number
  limit?: number
  status?: string
  categoryId?: number
  locationId?: number
  conditionRating?: string
  search?: string
}

export function useItems(options: UseItemsOptions = {}) {
  const [data, setData] = useState<PaginatedResult<Item> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let result: PaginatedResult<Item>
      if (options.search && options.search.trim()) {
        result = await window.api.items.search(options.search, {
          page: options.page,
          limit: options.limit
        })
      } else {
        result = await window.api.items.list({
          page: options.page,
          limit: options.limit,
          status: options.status,
          categoryId: options.categoryId,
          locationId: options.locationId,
          conditionRating: options.conditionRating
        })
      }
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [
    options.page,
    options.limit,
    options.status,
    options.categoryId,
    options.locationId,
    options.conditionRating,
    options.search
  ])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  return { data, loading, error, refetch: fetchItems }
}

export function useItem(id: number | null) {
  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setItem(null)
      return
    }

    setLoading(true)
    setError(null)

    window.api.items
      .get(id)
      .then(setItem)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load item'))
      .finally(() => setLoading(false))
  }, [id])

  return { item, loading, error }
}
