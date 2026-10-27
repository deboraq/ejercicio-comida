import { mergeStorageArrays } from '../hooks/useLocalStorage'
import {
  INICIO_ACCESOS_FAVORITOS_INITIAL,
  normalizeInicioAccesosFavoritos,
} from './inicioAccesosFavoritos'
import { normalizarHidratacionPorDia, mergeHidratacionPorDia } from './hidratacionStorage'
import { dedupeRegistrosSync } from './storageRecordDedupe'
import { dedupeRegistrosPorPlanRef, slotKeyDesdeCheckKey } from './planRegistroSync'
import { normalizarPlanPropioEnStorage } from './planPropio.js'
import { migrarEstadoLegacyAMes1, normalizarEstadoMultiplan } from './planEstadoStorage.js'
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

function mergePlanMes1EstadoByPlanId(localRoot, cloudRoot, preferCloud = false) {
  const local = normalizarEstadoMultiplan(localRoot)
  const cloud = normalizarEstadoMultiplan(cloudRoot)
  const ids = new Set([...Object.keys(local.byPlanId), ...Object.keys(cloud.byPlanId)])
  const byPlanId = {}
  for (const id of ids) {
    const l = local.byPlanId[id] || { checks: {}, omitidos: {}, extras: {} }
    const c = cloud.byPlanId[id] || { checks: {}, omitidos: {}, extras: {} }
    const primary = preferCloud ? c : l
    const secondary = preferCloud ? l : c
    byPlanId[id] = normalizePlanMes1ChecksOnePerSlot({
      checks: { ...(secondary.checks || {}), ...(primary.checks || {}) },
      omitidos: { ...(secondary.omitidos || {}), ...(primary.omitidos || {}) },
      extras: { ...(secondary.extras || {}), ...(primary.extras || {}) },
    })
  }
  return migrarEstadoLegacyAMes1({ version: 2, byPlanId }, [])
}

function mergePlanMes1Estado(localObj, cloudObj, initial, preferCloud = false) {
  const localNorm = normalizarEstadoMultiplan(localObj)
  const cloudNorm = normalizarEstadoMultiplan(cloudObj)
  const localEmpty =
    Object.keys(localNorm.byPlanId).length === 0
    || Object.values(localNorm.byPlanId).every(
      (s) => !Object.keys(s?.checks || {}).length && !Object.keys(s?.omitidos || {}).length,
    )
  const cloudEmpty =
    Object.keys(cloudNorm.byPlanId).length === 0
    || Object.values(cloudNorm.byPlanId).every(
      (s) => !Object.keys(s?.checks || {}).length && !Object.keys(s?.omitidos || {}).length,
    )
  if (localEmpty && !cloudEmpty) return mergePlanMes1EstadoByPlanId(localNorm, cloudNorm, true)
  if (cloudEmpty && !localEmpty) return mergePlanMes1EstadoByPlanId(localNorm, cloudNorm, false)
  if (isStorageInitial(localObj, initial) && !isStorageInitial(cloudObj, initial)) {
    return mergePlanMes1EstadoByPlanId(localNorm, cloudNorm, true)
  }
  if (isStorageInitial(cloudObj, initial) && !isStorageInitial(localObj, initial)) {
    return mergePlanMes1EstadoByPlanId(localNorm, cloudNorm, false)
  }
  return mergePlanMes1EstadoByPlanId(localNorm, cloudNorm, preferCloud)
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

function mergeInicioAccesosFavoritos(localNorm, fromCloud) {
  const local = normalizeInicioAccesosFavoritos(localNorm)
  const cloud = normalizeInicioAccesosFavoritos(fromCloud)
  if (local.customized) return local
  if (cloud.customized) return cloud
  return { ...INICIO_ACCESOS_FAVORITOS_INITIAL }
}

/** Une local + nube según tipo de dato; la nube manda si el local está vacío o es el valor inicial. */
export function mergeCloudAndLocal(key, localNorm, fromCloud, initial, preferCloud = false) {
  if (key === 'inicioAccesosFavoritos') {
    return mergeInicioAccesosFavoritos(localNorm, fromCloud)
  }

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
    if (key === 'planPropio') {
      const local = normalizarPlanPropioEnStorage(localNorm)
      const cloud = normalizarPlanPropioEnStorage(fromCloud)
      return mergePlainObjects(cloud, local, normalizarPlanPropioEnStorage(initial), preferCloud)
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
