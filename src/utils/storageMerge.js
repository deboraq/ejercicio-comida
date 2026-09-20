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

function mergePlainObjects(cloudObj, localObj, initial) {
  const cloud = cloudObj && typeof cloudObj === 'object' && !Array.isArray(cloudObj) ? cloudObj : initial
  const local = localObj && typeof localObj === 'object' && !Array.isArray(localObj) ? localObj : initial
  if (isStorageInitial(local, initial)) return cloud
  return { ...cloud, ...local }
}

/** Une local + nube según tipo de dato; la nube manda si el local está vacío o es el valor inicial. */
export function mergeCloudAndLocal(key, localNorm, fromCloud, initial) {
  if (Array.isArray(initial)) {
    const localArr = Array.isArray(localNorm) ? localNorm : []
    const cloudArr = Array.isArray(fromCloud) ? fromCloud : []
    if (isStorageInitial(localArr, initial) && cloudArr.length > 0) return cloudArr
    if (cloudArr.length === 0 && localArr.length > 0) return localArr
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

  if (initial !== null && typeof initial === 'object') {
    if (key === 'hidratacionDia') {
      const cloudMap = normalizarHidratacionPorDia(fromCloud)
      const localMap = normalizarHidratacionPorDia(localNorm)
      if (isStorageInitial(localMap, initial) && Object.keys(cloudMap).length > 0) return cloudMap
      return mergeHidratacionPorDia(cloudMap, localMap)
    }
    return mergePlainObjects(fromCloud, localNorm, initial)
  }

  return fromCloud ?? localNorm
}

/** No subir valores por defecto vacíos que pisen datos existentes en la nube. */
export function shouldUploadMerged(_key, resolved, fromCloud, initial, _cloudRowExists) {
  if (isStorageInitial(resolved, initial)) return false
  return JSON.stringify(resolved) !== JSON.stringify(fromCloud)
}
