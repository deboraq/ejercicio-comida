import { useState, useEffect } from 'react'

/** Evita pantalla en blanco si localStorage o la nube devolvieron un tipo distinto al esperado. */
export function normalizeStorageValue(value, initialValue) {
  if (value == null) return initialValue
  if (Array.isArray(initialValue)) return Array.isArray(value) ? value : initialValue
  if (initialValue !== null && typeof initialValue === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : initialValue
  }
  return value
}

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? normalizeStorageValue(JSON.parse(item), initialValue) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      console.error(e)
    }
  }, [key, value])

  return [value, setValue]
}
