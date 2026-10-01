import { mergeStorageArrays } from '../hooks/useLocalStorage'
import { normalizarHidratacionPorDia, mergeHidratacionPorDia } from './hidratacionStorage'
import { dedupeRegistrosSync } from './storageRecordDedupe'
import { dedupeRegistrosPorPlanRef, slotKeyDesdeCheckKey } from './planRegistroSync'
import { normalizarPesoHistorial } from './pesoStorage'
import { normalizarMedidasHistorial } from './medidasStorage'
import { normalizarSuplementosPorDia } from './suplementosStorage'

export function isStorageInitial(value, initial) {
  try {
    return JSON.stringify(value) === JSON.stringify(initial)
  } catch {
    return false
  }
}

function normalizePlanMes1ChecksOnePerSlot(estado) {
  if (!estado || typeof estado !== 'object') return estado
  const checks = { ...(estado.checks || {}) }
  const pickedBySlot = new Map()
  for (const [key, val] of Object.entries(checks)) {
    if (!val) continue
    const slotKey = slotKeyDesdeCheckKey(key)
    if (!slotKey) continue
    if (!pickedBySlot.has(slotKey)) pickedBySlot.set(slotKey, key)
    else delete checks[key]
  }
  return { ...estado, checks }
}

function mergePlanMes1Estado(localObj, cloudObj, initial, preferCloud = false) {
  const cloud = cloudObj && typeof cloudObj === 'object' && !Array.isArray(cloudObj) ? cloudObj : initial
  const local = localObj && typeof localObj === 'object' && !Array.isArray(localObj) ? localObj : initial
  if (isStorageInitial(local, initial) && !isStorageInitial(cloud, initial)) {
    return normalizePlanMes1ChecksOnePerSlot(cloud)
  }
  if (isStorageInitial(cloud, initial) && !isStorageInitial(local, initial)) {
    return normalizePlanMes1ChecksOnePerSlot(local)
  }
  const primary = preferCloud ? cloud : local
  const secondary = preferCloud ? local : cloud
  const merged = {
    ...secondary,
    ...primary,
    checks: { ...(secondary.checks || {}), ...(primary.checks || {}) },
    omitidos: { ...(secondary.omitidos || {}), ...(primary.omitidos || {}) },
    extras: { ...(secondary.extras || {}), ...(primary.extras || {}) },
  }
  return normalizePlanMes1ChecksOnePerSlot(merged)
}

function mergePlainObjects(cloudObj, localObj, initial, preferCloud = false) {
  const cloud = cloudObj && typeof cloudObj === 'object' && !Array.isArray(cloudObj) ? cloudObj : initial
  const local = localObj && typeof localObj === 'object' && !Array.isArray(localObj) ? localObj : initial
  if (isStorageInitial(local, initial)) return cloud
  if (isStorageInitial(cloud, initial)) return local
  return preferCloud ? { ...local, ...cloud } : { ...cloud, ...local }
}

function mergeArraysForKey(key, localArr, cloudArr, preferCloud) {
  const cloudWins = Boolean(preferCloud)
  if (preferCloud) {
    if (key === 'pesoHistorial') {
      return normalizarPesoHistorial(mergeStorageArrays(localArr, cloudArr, 'id', cloudWins))
    }
    if (key === 'medidasHistorial') {
      return normalizarMedidasHistorial(mergeStorageArrays(localArr, cloudArr, 'id', cloudWins))
    }
    if (key === 'suplementos') {
      return normalizarSuplementosPorDia(
        mergeStorageArrays(
          normalizarSuplementosPorDia(localArr),
          normalizarSuplementosPorDia(cloudArr),
          'id',
          cloudWins,
        ),
      )
    }
    return mergeStorageArrays(localArr, cloudArr, 'id', cloudWins)
  }
  if (key === 'pesoHistorial') {
    return normalizarPesoHistorial(mergeStorageArrays(localArr, cloudArr))
  }
  if (key === 'medidasHistorial') {
    return normalizarMedidasHistorial(mergeStorageArrays(localArr, cloudArr))
  }
  if (key === 'suplementos') {
    return normalizarSuplementosPorDia(
      mergeStorageArrays(
        normalizarSuplementosPorDia(localArr),
        normalizarSuplementosPorDia(cloudArr),
      ),
    )
  }
  const merged = mergeStorageArrays(localArr, cloudArr)
  return dedupeRegistrosSync(key, merged)
}

const ARRAY_KEYS_DEDUPE = new Set(['ejercicios', 'comida', 'rutinaPesos'])

/** Une local + nube según tipo de dato; la nube manda si el local está vacío o es el valor inicial. */
export function mergeCloudAndLocal(key, localNorm, fromCloud, initial, preferCloud = false) {
  if (Array.isArray(initial)) {
    const localArr = Array.isArray(localNorm) ? localNorm : []
    const cloudArr = Array.isArray(fromCloud) ? fromCloud : []
    if (isStorageInitial(localArr, initial) && cloudArr.length > 0) {
      if (key === 'comida') return dedupeRegistrosPorPlanRef(dedupeRegistrosSync(key, cloudArr))
      return ARRAY_KEYS_DEDUPE.has(key) ? dedupeRegistrosSync(key, cloudArr) : cloudArr
    }
    if (cloudArr.length === 0 && localArr.length > 0) {
      if (key === 'comida') return dedupeRegistrosPorPlanRef(dedupeRegistrosSync(key, localArr))
      return ARRAY_KEYS_DEDUPE.has(key) ? dedupeRegistrosSync(key, localArr) : localArr
    }
    let merged = mergeArraysForKey(key, localArr, cloudArr, preferCloud)
    if (key === 'comida') {
      merged = dedupeRegistrosPorPlanRef(dedupeRegistrosSync(key, merged))
      return merged
    }
    return ARRAY_KEYS_DEDUPE.has(key) ? dedupeRegistrosSync(key, merged) : merged
  }

  if (initial !== null && typeof initial === 'object') {
    if (key === 'hidratacionDia') {
      const cloudMap = normalizarHidratacionPorDia(fromCloud)
      const localMap = normalizarHidratacionPorDia(localNorm)
      if (isStorageInitial(localMap, initial) && Object.keys(cloudMap).length > 0) return cloudMap
      if (Object.keys(cloudMap).length === 0) return localMap
      if (Object.keys(localMap).length === 0) return cloudMap
      if (preferCloud) {
        return mergeHidratacionPorDia(localMap, cloudMap, 'preferSecond')
      }
      return mergeHidratacionPorDia(cloudMap, localMap, 'preferSecond')
    }
    if (key === 'planMes1Estado') {
      return mergePlanMes1Estado(localNorm, fromCloud, initial, preferCloud)
    }
    return mergePlainObjects(fromCloud, localNorm, initial, preferCloud)
  }

  return fromCloud ?? localNorm
}

/** No subir valores por defecto vacíos que pisen datos existentes en la nube. */
export function shouldUploadMerged(_key, resolved, fromCloud, initial, _cloudRowExists) {
  if (isStorageInitial(resolved, initial)) return false
  return JSON.stringify(resolved) !== JSON.stringify(fromCloud)
}
