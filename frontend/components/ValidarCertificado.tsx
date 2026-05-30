import { useState } from 'react';
import { certificadoService } from '../services/certificadoService';

interface ValidacionResultado {
  es_valido: boolean;
  mensaje: string;
  fecha_validacion?: string;
}

export default function ValidarCertificado() {
  const [certificadoId, setCertificadoId] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ValidacionResultado | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResultado(null);

    try {
      const data = await certificadoService.validarCertificado(certificadoId, clienteEmail);
      setResultado({
        es_valido: data.valido,
        mensaje: data.mensaje,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Validar Certificado
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="certificadoId" className="block text-sm font-medium text-gray-700 mb-1">
            ID del Certificado
          </label>
          <input
            type="text"
            id="certificadoId"
            value={certificadoId}
            onChange={(e) => setCertificadoId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ingrese el ID del certificado"
            required
          />
        </div>
        
        <div>
          <label htmlFor="clienteEmail" className="block text-sm font-medium text-gray-700 mb-1">
            Email del Cliente
          </label>
          <input
            type="email"
            id="clienteEmail"
            value={clienteEmail}
            onChange={(e) => setClienteEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ingrese el email del cliente"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Validando...' : 'Validar Certificado'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {resultado && (
        <div className={`mt-4 p-3 rounded-md ${
          resultado.es_valido 
            ? 'bg-green-100 border border-green-400 text-green-700' 
            : 'bg-yellow-100 border border-yellow-400 text-yellow-700'
        }`}>
          <p className="font-medium">{resultado.mensaje}</p>
          {resultado.fecha_validacion && (
            <p className="text-sm mt-1">
              Fecha de validación: {new Date(resultado.fecha_validacion).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}