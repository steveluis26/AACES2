import React, { useState } from 'react'
import { ShoppingCart, Package, Users, TrendingUp, Plus, Search, BarChart3 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import QuickSale from '../pos/QuickSale'
import InventoryManager from '../inventory/InventoryManager'
import CustomerManager from '../customers/CustomerManager'
import SalesReports from '../reports/SalesReports'

type TabId = 'pos' | 'inventory' | 'customers' | 'reports'

const RetailDashboard: React.FC = () => {
  const { currentBusiness } = useAppStore()
  const [activeTab, setActiveTab] = useState<TabId>('pos')

  const stats = [
    { label: 'Ventas Hoy', value: '$1,247.50', change: '+12.5%', icon: TrendingUp },
    { label: 'Productos', value: '342', change: '+5', icon: Package },
    { label: 'Clientes', value: '89', change: '+3', icon: Users },
    { label: 'Transacciones', value: '23', change: '+8', icon: ShoppingCart }
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'pos':
        return <QuickSale />
      case 'inventory':
        return <InventoryManager />
      case 'customers':
        return <CustomerManager />
      case 'reports':
        return <SalesReports />
      default:
        return <QuickSale />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{currentBusiness?.name}</h1>
                  <p className="text-sm text-gray-500">Sistema de Punto de Venta</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Nueva Venta</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
          {([
              { id: 'pos', name: 'Punto de Venta', icon: ShoppingCart },
              { id: 'inventory', name: 'Inventario', icon: Package },
              { id: 'customers', name: 'Clientes', icon: Users },
              { id: 'reports', name: 'Reportes', icon: BarChart3 }
            ] as { id: TabId; name: string; icon: typeof ShoppingCart }[]).map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group inline-flex items-center py-2 px-1 border-b-2 font-medium text-sm
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderContent()}
      </div>
    </div>
  )
}

export default RetailDashboard
