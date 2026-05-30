import NetInfo from '@react-native-community/netinfo'
import { useOfflineStore } from '../stores/offlineStore'
import { useAppStore } from '../stores/appStore'

export interface SyncService {
  startAutoSync: () => void
  stopAutoSync: () => void
  syncNow: () => Promise<void>
  isOnline: () => Promise<boolean>
}

class OfflineSyncService implements SyncService {
  private syncInterval: NodeJS.Timeout | null = null
  private isSyncing = false
  
  constructor() {
    this.setupNetworkListener()
  }

  private setupNetworkListener() {
    NetInfo.addEventListener(state => {
      const { setOnlineStatus } = useOfflineStore.getState()
      setOnlineStatus(state.isConnected ?? false)
      
      if (state.isConnected) {
        this.syncNow()
      }
    })
  }

  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch()
    return state.isConnected ?? false
  }

  startAutoSync() {
    if (this.syncInterval) {
      this.stopAutoSync()
    }

    // Sincronizar cada 30 segundos
    this.syncInterval = setInterval(() => {
      this.syncNow()
    }, 30000)

    // Sincronizar inmediatamente si hay conexión
    this.syncNow()
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  async syncNow(): Promise<void> {
    const { isOnline } = useOfflineStore.getState()
    
    if (!isOnline || this.isSyncing) {
      return
    }

    this.isSyncing = true
    const { setSyncInProgress, pendingSync, markAsSynced, setLastSync } = useOfflineStore.getState()
    
    setSyncInProgress(true)

    try {
      const unsyncedItems = pendingSync.filter(item => !item.synced)
      
      if (unsyncedItems.length === 0) {
        setLastSync(Date.now())
        return
      }

      // Enviar datos al servidor en lotes
      const batchSize = 10
      for (let i = 0; i < unsyncedItems.length; i += batchSize) {
        const batch = unsyncedItems.slice(i, i + batchSize)
        await this.syncBatch(batch)
        
        // Marcar como sincronizados
        batch.forEach(item => markAsSynced(item.id))
      }

      setLastSync(Date.now())
      
    } catch (error) {
      console.error('Error durante sincronización:', error)
      // En producción: notificar al usuario, reintentar con backoff exponencial
    } finally {
      this.isSyncing = false
      setSyncInProgress(false)
    }
  }

  private async syncBatch(batch: any[]): Promise<void> {
    // En producción: aquí se conectaría con Supabase
    // Por ahora simulamos sincronización exitosa
    
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('Sincronizando lote:', batch.length, 'items')
        resolve()
      }, 1000) // Simular latencia de red
    })
  }
}

export const syncService = new OfflineSyncService()

// Hook personalizado para sincronización
export const useSync = () => {
  const { isOnline, syncInProgress, lastSync } = useOfflineStore()
  
  const startSync = () => {
    syncService.startAutoSync()
  }
  
  const stopSync = () => {
    syncService.stopAutoSync()
  }
  
  const manualSync = async () => {
    await syncService.syncNow()
  }
  
  return {
    isOnline,
    syncInProgress,
    lastSync,
    startSync,
    stopSync,
    manualSync
  }
}