import React from 'react'
import { ChefHat, Utensils, Clock, Users } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

const RestaurantDashboard: React.FC = () => {
  const { currentBusiness } = useAppStore()

  const stats = [
    { label: 'Mesas Activas', value: '8/12', change: '+2', icon: Users },
    { label: 'Órdenes Pendientes', value: '5', change: '-1', icon: Clock },
    { label: 'Ventas Hoy', value: '$2,340', change: '+15%', icon: ChefHat },
    { label: 'Platillos Vendidos', value: '47', change: '+12', icon: Utensils }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-orange-600 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{currentBusiness?.name}</h1>
                <p className="text-orange-100 text-sm">Sistema de Restaurante</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button className="bg-orange-500 hover:bg-orange-400 text-white px-4 py-2 rounded-lg font-medium">
                Nueva Orden
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div key={index} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-sm text-green-600">{stat.change}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-lg shadow p-8 text-center">
          <ChefHat className="w-16 h-16 text-orange-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Módulo de Restaurante</h2>
          <p className="text-gray-600 mb-6">
            Gestión de mesas, menú digital, comandas y cocina integrada
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="border border-gray-200 rounded-lg p-6">
              <Users className="w-8 h-8 text-orange-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Control de Mesas</h3>
              <p className="text-sm text-gray-600">Visualización y gestión del estado de mesas en tiempo real</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-6">
              <Utensils className="w-8 h-8 text-orange-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Menú Digital</h3>
              <p className="text-sm text-gray-600">Catálogo de platillos con precios y descripciones</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-6">
              <Clock className="w-8 h-8 text-orange-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Gestión de Órdenes</h3>
              <p className="text-sm text-gray-600">Seguimiento de comandas desde cocina hasta entrega</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RestaurantDashboard