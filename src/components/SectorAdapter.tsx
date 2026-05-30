import React from 'react'
import { useAppStore } from '../stores/appStore'
import RetailDashboard from './sectors/RetailDashboard'
import RestaurantDashboard from './sectors/RestaurantDashboard'
import SchoolDashboard from './sectors/SchoolDashboard'
import MedicalDashboard from './sectors/MedicalDashboard'
import BusinessSetup from './setup/BusinessSetup'

const SectorAdapter: React.FC = () => {
  const { currentBusiness } = useAppStore()

  if (!currentBusiness) {
    return <BusinessSetup />
  }

  const renderDashboard = () => {
    switch (currentBusiness.sector) {
      case 'retail':
        return <RetailDashboard />
      case 'restaurant':
        return <RestaurantDashboard />
      case 'school':
        return <SchoolDashboard />
      case 'medical':
        return <MedicalDashboard />
      default:
        return <RetailDashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderDashboard()}
    </div>
  )
}

export default SectorAdapter