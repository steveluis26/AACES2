'use client';

import { useState } from 'react';
import { certificadosService, ValidacionResponse } from '../services/certificados';

interface ValidacionCertificadoProps {
  onClose?: () => void;
}

export default function ValidacionCertificado({ onClose }: ValidacionCertificadoProps) {
  const [numeroCertificado, setNumeroCertificado] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ValidacionResponse | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numeroCertificado.trim()) {
      setError('Por favor ingrese un número de certificado');
      return;
    }

    setLoading(true);
    setError('');
    setResultado(null);

    try {
      const response = await certificadosService.validarCertificado(numeroCertificado);
      setResultado(response);
    } catch (err: any) {
      setError(err.message || 'Error al validar el certificado');
    } finally {
      setLoading(false);
    }
  };

  const limpiarFormulario = () => {
    setNumeroCertificado('');
    setResultado(null);
    setError('');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Validar Certificado</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="numero-certificado" className="block text-sm font-medium text-gray-700 mb-2">
            Número de Certificado
          </label>
          <input
            type="text"
            id="numero-certificado"
            value={numeroCertificado}
            onChange={(e) => setNumeroCertificado(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ingrese el número de certificado"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !numeroCertificado.trim()}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Validando...' : 'Validar Certificado'}
          </button>
          
          <button
            type="button"
            onClick={limpiarFormulario}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Limpiar
          </button>
        </div>
      </form>

      {resultado && (
        <div className={`mt-6 p-4 rounded-lg border-2 ${
          resultado.valido 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center mb-2">
            <div className={`w-4 h-4 rounded-full mr-2 ${
              resultado.valido ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <h3 className="font-semibold">
              {resultado.valido ? 'Certificado Válido' : 'Certificado Inválido'}
            </h3>
          </div>
          
          <p className="mb-3">{resultado.mensaje}</p>
          
          {resultado.certificado && (
            <div className="bg-white p-3 rounded border mt-3">
              <h4 className="font-semibold mb-2">Detalles del Certificado:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">Número:</span> {resultado.certificado.numero_certificado}
                </div>
                <div>
                  <span className="font-medium">Cliente:</span> {resultado.certificado.nombre_cliente}
                </div>
                <div>
                  <span className="font-medium">Producto:</span> {resultado.certificado.producto}
                </div>
                <div>
                  <span className="font-medium">Estado:</span> {resultado.certificado.estado}
                </div>
                <div>
                  <span className="font-medium">Fecha Emisión:</span> {new Date(resultado.certificado.fecha_emision).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-medium">Fecha Vencimiento:</span> {new Date(resultado.certificado.fecha_vencimiento).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}