import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface PendingSync {
  id: string
  type: 'sale' | 'inventory' | 'customer' | 'appointment' | 'payment'
  action: 'create' | 'update' | 'delete'
  data: any
  timestamp: number
  synced: boolean
  deviceId: string
}

export interface OfflineState {
  isOnline: boolean
  pendingSync: PendingSync[]
  lastSync: number | null
  syncInProgress: boolean
  deviceId: string
  
  setOnlineStatus: (status: boolean) => void
  addPendingSync: (item: Omit<PendingSync, 'id' | 'timestamp' | 'synced' | 'deviceId'>) => void
  markAsSynced: (id: string) => void
  clearSyncedItems: () => void
  setSyncInProgress: (inProgress: boolean) => void
  setLastSync: (timestamp: number) => void
  generateDeviceId: () => string
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      isOnline: true,
      pendingSync: [],
      lastSync: null,
      syncInProgress: false,
      deviceId: '',
      
      setOnlineStatus: (status) => set({ isOnline: status }),
      
      generateDeviceId: () => {
        const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        set({ deviceId })
        return deviceId
      },
      
      addPendingSync: (item) => {
        const state = get()
        const deviceId = state.deviceId || get().generateDeviceId()
        
        const newItem: PendingSync = {
          ...item,
          id: `${item.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          synced: false,
          deviceId
        }
        
        set((state) => ({
          pendingSync: [...state.pendingSync, newItem]
        }))
      },
      
      markAsSynced: (id) => {
        set((state) => ({
          pendingSync: state.pendingSync.map(item =>
            item.id === id ? { ...item, synced: true } : item
          )
        }))
      },
      
      clearSyncedItems: () => {
        set((state) => ({
          pendingSync: state.pendingSync.filter(item => !item.synced)
        }))
      },
      
      setSyncInProgress: (inProgress) => set({ syncInProgress: inProgress }),
      setLastSync: (timestamp) => set({ lastSync: timestamp })
    }),
    {
      name: 'spv-mobile-offline',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
)