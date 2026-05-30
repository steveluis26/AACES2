export const descargarPDF = (blob, nombreArchivo) => {
  try {
    // Crear URL del blob
    const url = window.URL.createObjectURL(blob);
    
    // Crear enlace temporal
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    
    // Añadir al documento y hacer clic
    document.body.appendChild(enlace);
    enlace.click();
    
    // Limpiar
    document.body.removeChild(enlace);
    window.URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Error al descargar PDF:', error);
    return false;
  }
};

export const abrirPDFEnNuevaPestana = (blob) => {
  try {
    // Crear URL del blob
    const url = window.URL.createObjectURL(blob);
    
    // Abrir en nueva pestaña
    window.open(url, '_blank');
    
    // Limpiar después de un tiempo
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 60000); // 1 minuto
    
    return true;
  } catch (error) {
    console.error('Error al abrir PDF:', error);
    return false;
  }
};

export const generarNombreArchivoPDF = (certificado) => {
  try {
    const fecha = new Date().toISOString().split('T')[0];
    const clienteNombre = certificado.cliente_nombre?.replace(/[^a-zA-Z0-9]/g, '_') || 'cliente';
    const numeroCertificado = certificado.numero_certificado || certificado.id;
    
    return `certificado_${clienteNombre}_${numeroCertificado}_${fecha}.pdf`;
  } catch (error) {
    console.error('Error al generar nombre de archivo:', error);
    return `certificado_${Date.now()}.pdf`;
  }
};