import React from 'react'
import { Stethoscope, Calendar, Users, Activity } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

const MedicalDashboard: React.FC = () => {
  const { currentBusiness } = useAppStore()

  const stats = [
    { label: 'Citas Hoy', value: '8', change: '+2', icon: Calendar },
    { label: 'Pacientes Activos', value: '234', change: '+5', icon: Users },
    { label: 'Consultas Mes', value: '156', change: '+12', icon: Stethoscope },
    { label: 'Ingresos', value: '$12,450', change: '+8%', icon: Activity }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-red-600 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{currentBusiness?.name}</h1>
                <p className="text-red-100 text-sm">Sistema Médico</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button className="bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded-lg font-medium">
                Nueva Cita
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
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Stethoscope className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Módulo Médico</h2>
          <p className="text-gray-600 mb-6">
            Gestión de citas, historial clínico, pacientes y recetas médicas
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="border border-gray-200 rounded-lg p-6">
              <Calendar className="w-8 h-8 text-red-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Gestión de Citas</h3>
              <p className="text-sm text-gray-600">Calendario de consultas y recordatorios automáticos</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-6">
              <Users className="w-8 h-8 text-red-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Historial Clínico</h3>
              <p className="text-sm text-gray-600">Fichas médicas digitales y antecedentes completos</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-6">
              <Activity className="w-8 h-8 text-red-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Facturación</h3>
              <p className="text-sm text-gray-600">Recetas médicas y facturación especializada</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MedicalDashboard