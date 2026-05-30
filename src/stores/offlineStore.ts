import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PendingSync {
  id: string
  type: 'sale' | 'inventory' | 'customer' | 'appointment'
  action: 'create' | 'update' | 'delete'
  data: unknown
  timestamp: number
  synced: boolean
}

export interface OfflineState {
  isOnline: boolean
  pendingSync: PendingSync[]
  lastSync: number | null
  syncInProgress: boolean
  
  setOnlineStatus: (status: boolean) => void
  addPendingSync: (item: Omit<PendingSync, 'id' | 'timestamp' | 'synced'>) => void
  markAsSynced: (id: string) => void
  clearSyncedItems: () => void
  setSyncInProgress: (inProgress: boolean) => void
  setLastSync: (timestamp: number) => void
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set) => ({
      isOnline: true,
      pendingSync: [],
      lastSync: null,
      syncInProgress: false,
      
      setOnlineStatus: (status) => set({ isOnline: status }),
      
      addPendingSync: (item) => {
        const newItem: PendingSync = {
          ...item,
          id: `${item.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          synced: false
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
      name: 'spv-offline-storage'
    }
  )
)
