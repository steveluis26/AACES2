import React from 'react'
import { BarChart3, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react'

const SalesReports: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2" />
          Reportes de Ventas
        </h3>
        <div className="flex items-center space-x-3">
          <select className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
            <option>Hoy</option>
            <option>Esta semana</option>
            <option>Este mes</option>
            <option>Este año</option>
          </select>
        </div>
      </div>

      <div className="text-center py-12">
        <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">Reportes y Analytics</h4>
        <p className="text-gray-500 mb-6">
          Análisis detallado de ventas, productos más vendidos y tendencias
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="border border-gray-200 rounded-lg p-4">
            <TrendingUp className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <h5 className="font-medium text-gray-900 mb-1">Ventas</h5>
            <p className="text-sm text-gray-600">Diarias, semanales y mensuales</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <ShoppingCart className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <h5 className="font-medium text-gray-900 mb-1">Productos</h5>
            <p className="text-sm text-gray-600">Más vendidos y rentabilidad</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <DollarSign className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <h5 className="font-medium text-gray-900 mb-1">Ingresos</h5>
            <p className="text-sm text-gray-600">Análisis de ganancias</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <BarChart3 className="w-6 h-6 text-orange-600 mx-auto mb-2" />
            <h5 className="font-medium text-gray-900 mb-1">Tendencias</h5>
            <p className="text-sm text-gray-600">Predicciones y patrones</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SalesReports