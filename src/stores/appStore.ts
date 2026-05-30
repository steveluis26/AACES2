import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BusinessSector = 'retail' | 'restaurant' | 'school' | 'medical'

export interface BusinessConfig {
  id: string
  name: string
  sector: BusinessSector
  address: string
  phone: string
  email: string
  taxId: string
  currency: string
  timezone: string
  logo?: string
}

export interface SectorFeatures {
  inventory: boolean
  tables: boolean
  appointments: boolean
  students: boolean
  menu: boolean
  medicalRecords: boolean
  subscriptions: boolean
}

export interface AppState {
  currentBusiness: BusinessConfig | null
  isLoading: boolean
  darkMode: boolean
  language: 'es' | 'en' | 'pt'
  
  setCurrentBusiness: (business: BusinessConfig) => void
  setLoading: (loading: boolean) => void
  setDarkMode: (darkMode: boolean) => void
  setLanguage: (language: 'es' | 'en' | 'pt') => void
  getSectorFeatures: () => SectorFeatures
  getSectorName: () => string
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentBusiness: null,
      isLoading: false,
      darkMode: false,
      language: 'es',
      
      setCurrentBusiness: (business) => set({ currentBusiness: business }),
      setLoading: (loading) => set({ isLoading: loading }),
      setDarkMode: (darkMode) => set({ darkMode }),
      setLanguage: (language) => set({ language }),
      
      getSectorFeatures: () => {
        const sector = get().currentBusiness?.sector
        switch (sector) {
          case 'retail':
            return {
              inventory: true,
              tables: false,
              appointments: false,
              students: false,
              menu: false,
              medicalRecords: false,
              subscriptions: false
            }
          case 'restaurant':
            return {
              inventory: true,
              tables: true,
              appointments: false,
              students: false,
              menu: true,
              medicalRecords: false,
              subscriptions: false
            }
          case 'school':
            return {
              inventory: false,
              tables: false,
              appointments: false,
              students: true,
              menu: false,
              medicalRecords: false,
              subscriptions: true
            }
          case 'medical':
            return {
              inventory: false,
              tables: false,
              appointments: true,
              students: false,
              menu: false,
              medicalRecords: true,
              subscriptions: false
            }
          default:
            return {
              inventory: true,
              tables: false,
              appointments: false,
              students: false,
              menu: false,
              medicalRecords: false,
              subscriptions: false
            }
        }
      },
      
      getSectorName: () => {
        const sector = get().currentBusiness?.sector
        switch (sector) {
          case 'retail': return 'Tienda'
          case 'restaurant': return 'Restaurante'
          case 'school': return 'Escuela'
          case 'medical': return 'Consultorio'
          default: return 'Negocio'
        }
      }
    }),
    {
      name: 'spv-app-storage'
    }
  )
)