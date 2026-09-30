import { mergeStorageArrays } from '../hooks/useLocalStorage'
import { normalizarHidratacionPorDia, mergeHidratacionPorDia } from './hidratacionStorage'
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
  return mergeStorageArrays(localArr, cloudArr)
}

/** Une local + nube según tipo de dato; la nube manda si el local está vacío o es el valor inicial. */
export function mergeCloudAndLocal(key, localNorm, fromCloud, initial, preferCloud = false) {
  if (Array.isArray(initial)) {
    const localArr = Array.isArray(localNorm) ? localNorm : []
    const cloudArr = Array.isArray(fromCloud) ? fromCloud : []
    if (isStorageInitial(localArr, initial) && cloudArr.length > 0) return cloudArr
    if (cloudArr.length === 0 && localArr.length > 0) return localArr
    return mergeArraysForKey(key, localArr, cloudArr, preferCloud)
  }

  if (initial !== null && typeof initial === 'object') {
    if (key === 'hidratacionDia') {
      const cloudMap = normalizarHidratacionPorDia(fromCloud)
      const localMap = normalizarHidratacionPorDia(localNorm)
      if (isStorageInitial(localMap, initial) && Object.keys(cloudMap).length > 0) return cloudMap
      if (preferCloud && Object.keys(cloudMap).length > 0) {
        return mergeHidratacionPorDia(localMap, cloudMap)
      }
      return mergeHidratacionPorDia(cloudMap, localMap)
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
