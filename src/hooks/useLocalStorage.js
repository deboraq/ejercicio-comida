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

/** Siempre devuelve array (objetos sueltos en la nube no rompen `.filter`). */
export function asArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback
}

/** Arrays de strings/números (favoritos, nombres de categoría, etc.). */
export function isPrimitiveStorageArray(arr) {
  if (!Array.isArray(arr)) return false
  if (arr.length === 0) return true
  return typeof arr[0] !== 'object' || arr[0] === null
}

/** Une arrays de registros por `id` (local gana sobre nube en empate). */
export function mergeStorageArrays(localArr = [], cloudArr = [], idKey = 'id') {
  const local = Array.isArray(localArr) ? localArr : []
  const cloud = Array.isArray(cloudArr) ? cloudArr : []

  const hasObjectIds = (arr) => arr.some((x) => x && typeof x === 'object' && x[idKey] != null)
  if (isPrimitiveStorageArray(local) && isPrimitiveStorageArray(cloud) && !hasObjectIds(local) && !hasObjectIds(cloud)) {
    const seen = new Set()
    const merged = []
    for (const item of [...cloud, ...local]) {
      const key = String(item)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(item)
    }
    return merged
  }

  const byId = new Map()
  for (const item of cloud) {
    if (item && item[idKey] != null) byId.set(String(item[idKey]), item)
  }
  for (const item of local) {
    if (item && item[idKey] != null) byId.set(String(item[idKey]), item)
  }
  const merged = [...byId.values()]
  for (const item of [...local, ...cloud]) {
    if (!item || item[idKey] == null) merged.push(item)
  }
  return merged
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
