import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { asArray, mergeStorageArrays } from '../hooks/useLocalStorage'
import { resolveUserLocalStorage } from '../utils/storageKeys'
import { mergeCloudAndLocal } from '../utils/storageMerge'
import { fetchAllUserDataCloud } from '../utils/userDataCloud'

function countArrayKey(userId, key) {
  if (!userId) return 0
  const local = resolveUserLocalStorage(key, userId, [], mergeStorageArrays)
  return asArray(local).length
}

/**
 * Datos de exportación en Config: conteos rápidos al montar; carga completa solo al abrir el panel.
 */
export function useConfigExportData() {
  const { user, isConfigured } = useAuth()
  const [counts, setCounts] = useState({ comidas: 0, series: 0, actividad: 0 })
  const [bundle, setBundle] = useState(null)
  const [loadingBundle, setLoadingBundle] = useState(false)

  useEffect(() => {
    if (!user?.id) {
      setCounts({ comidas: 0, series: 0, actividad: 0 })
      setBundle(null)
      return
    }
    setCounts({
      comidas: countArrayKey(user.id, 'comida'),
      series: countArrayKey(user.id, 'rutinaPesos'),
      actividad: countArrayKey(user.id, 'ejercicios'),
    })
  }, [user?.id])

  const ensureBundle = useCallback(async () => {
    if (!user?.id || !isConfigured) return null
    if (bundle) return bundle
    setLoadingBundle(true)
    try {
      const cloudMap = await fetchAllUserDataCloud(user.id)
      const mergeArr = (key) => {
        const initial = []
        const fromLs = resolveUserLocalStorage(key, user.id, initial, mergeStorageArrays)
        const fromCloud = cloudMap[key] != null ? cloudMap[key] : null
        return mergeCloudAndLocal(key, fromLs, fromCloud, initial)
      }
      const next = {
        comidas: asArray(mergeArr('comida')),
        rutinaPesos: asArray(mergeArr('rutinaPesos')),
        rutinas: asArray(mergeArr('rutinas')),
        rutinaActivaId: mergeCloudAndLocal(
          'rutinaActivaId',
          resolveUserLocalStorage('rutinaActivaId', user.id, '', mergeStorageArrays),
          cloudMap.rutinaActivaId ?? null,
          '',
        ) || '',
        ejerciciosActividad: asArray(mergeArr('ejercicios')),
      }
      setBundle(next)
      setCounts({
        comidas: next.comidas.length,
        series: next.rutinaPesos.length,
        actividad: next.ejerciciosActividad.length,
      })
      return next
    } finally {
      setLoadingBundle(false)
    }
  }, [user?.id, isConfigured, bundle])

  return { counts, bundle, loadingBundle, ensureBundle }
}
