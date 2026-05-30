import React from 'react'
import { GraduationCap, Users, DollarSign, Calendar } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

const SchoolDashboard: React.FC = () => {
  const { currentBusiness } = useAppStore()

  const stats = [
    { label: 'Alumnos Activos', value: '156', change: '+12', icon: Users },
    { label: 'Colegiaturas Pendientes', value: '23', change: '-5', icon: DollarSign },
    { label: 'Ingresos del Mes', value: '$45,200', change: '+8%', icon: GraduationCap },
    { label: 'Grupos', value: '8', change: '+1', icon: Calendar }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-600 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{currentBusiness?.name}</h1>
                <p className="text-green-100 text-sm">Sistema Escolar</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button className="bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-lg font-medium">
                Nueva Matrícula
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
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-lg shadow p-8 text-center">
          <GraduationCap className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Módulo Escolar</h2>
          <p className="text-gray-600 mb-6">
            Gestión de alumnos, colegiaturas, grupos y comunicación con padres
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="border border-gray-200 rounded-lg p-6">
              <Users className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Gestión de Alumnos</h3>
              <p className="text-sm text-gray-600">Matrícula, historial académico y seguimiento de pagos</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-6">
              <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Control de Pagos</h3>
              <p className="text-sm text-gray-600">Colegiaturas mensuales y generación de recibos</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-6">
              <Calendar className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Comunicación</h3>
              <p className="text-sm text-gray-600">Notificaciones a padres y lista de materiales</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SchoolDashboard