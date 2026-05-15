import { useState, useEffect, useCallback } from 'react'
import type { Location } from '../types/electron'

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLocations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.locations.list()
      setLocations(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load locations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  return { locations, loading, error, refetch: fetchLocations }
}
