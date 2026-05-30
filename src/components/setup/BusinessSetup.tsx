import React, { useState } from 'react'
import { Store, Utensils, GraduationCap, Stethoscope, ArrowRight } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

interface BusinessFormData {
  name: string
  sector: 'retail' | 'restaurant' | 'school' | 'medical'
  address: string
  phone: string
  email: string
  taxId: string
}

const BusinessSetup: React.FC = () => {
  const { setCurrentBusiness } = useAppStore()
  const [step, setStep] = useState<'sector' | 'details'>('sector')
  const [formData, setFormData] = useState<BusinessFormData>({
    name: '',
    sector: 'retail',
    address: '',
    phone: '',
    email: '',
    taxId: ''
  })

  const sectors = [
    {
      id: 'retail' as const,
      name: 'Tienda Minorista',
      description: 'Para tiendas, supermercados y comercios',
      icon: Store,
      color: 'bg-blue-500'
    },
    {
      id: 'restaurant' as const,
      name: 'Restaurante',
      description: 'Para restaurantes, cafeterías y food trucks',
      icon: Utensils,
      color: 'bg-orange-500'
    },
    {
      id: 'school' as const,
      name: 'Escuela',
      description: 'Para escuelas, institutos y academias',
      icon: GraduationCap,
      color: 'bg-green-500'
    },
    {
      id: 'medical' as const,
      name: 'Consultorio Médico',
      description: 'Para consultorios, clínicas y hospitales',
      icon: Stethoscope,
      color: 'bg-red-500'
    }
  ]

  const handleSectorSelect = (sector: BusinessFormData['sector']) => {
    setFormData({ ...formData, sector })
    setStep('details')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const businessConfig = {
      id: `business-${Date.now()}`,
      name: formData.name,
      sector: formData.sector,
      address: formData.address,
      phone: formData.phone,
      email: formData.email,
      taxId: formData.taxId,
      currency: 'USD',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
    
    setCurrentBusiness(businessConfig)
  }

  if (step === 'sector') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Bienvenido a SPV</h1>
            <p className="text-xl text-gray-600">Selecciona el tipo de negocio para comenzar</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sectors.map((sector) => {
              const Icon = sector.icon
              return (
                <button
                  key={sector.id}
                  onClick={() => handleSectorSelect(sector.id)}
                  className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 text-left group"
                >
                  <div className="flex items-start space-x-4">
                    <div className={`${sector.color} rounded-lg p-3 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{sector.name}</h3>
                      <p className="text-gray-600 mb-4">{sector.description}</p>
                      <div className="flex items-center text-blue-600 group-hover:text-blue-700">
                        <span className="text-sm font-medium">Seleccionar</span>
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="text-center mt-8">
            <p className="text-gray-500">
              ¿No encuentras tu tipo de negocio? 
              <button className="text-blue-600 hover:text-blue-700 font-medium ml-1">
                Contáctanos
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Configurar {sectors.find(s => s.id === formData.sector)?.name}</h2>
            <p className="text-gray-600">Ingresa los datos de tu negocio</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Negocio
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Mi Negocio S.A. de C.V."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dirección
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Calle Principal #123, Ciudad"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+1 555 123 4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="contacto@negocio.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                RFC / NIT / Tax ID
              </label>
              <input
                type="text"
                required
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="XAXX010101000"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors"
            >
              Comenzar a Usar SPV
            </button>
          </form>

          <button
            onClick={() => setStep('sector')}
            className="w-full mt-4 text-gray-600 hover:text-gray-800 text-sm font-medium"
          >
            ← Cambiar tipo de negocio
          </button>
        </div>
      </div>
    </div>
  )
}

export default BusinessSetup