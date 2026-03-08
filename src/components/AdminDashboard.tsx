import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, BookOpen, Users } from 'lucide-react';

export default function AdminDashboard() {
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });

  // Función principal que lee el archivo y lo envía al backend
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMessage({ text: 'Procesando archivo CSV...', type: '' });

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        
        // 1. Separamos por líneas y limpiamos caracteres extraños (como retornos de carro de Windows)
        const lines = text.split('\n').map(line => line.replace('\r', '')).filter(line => line.trim() !== '');
        
        // 2. Saltamos la línea 0 (los encabezados) y mapeamos el resto
        // Columnas esperadas: NRC(0), Clave(1), Materia(2), Secc(3), Días(4), Hora(5), Profesor(6), Salón(7)
        const subjects = lines.slice(1).map(line => {
          const columns = line.split(','); 
          console.log("Fila de Excel:", columns);
          
          return {
            nrc: columns[0]?.trim() || '',
            // Ignoramos Clave(1) y Secc(3) porque no están en nuestra base de datos
            name: columns[2]?.trim() || 'Sin Nombre',
            // Juntamos Días y Hora
            schedule: `${columns[4]?.trim() || ''} ${columns[5]?.trim() || ''}`.trim(),
            professorName: columns[6]?.trim() || '',
            classroom: columns[7]?.trim() || ''
          };
        });

        // 3. Enviamos los datos al servidor (a la ruta que modificamos en server.ts)
        const response = await fetch('/api/admin/subjects/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjects })
        });

        const data = await response.json();

        if (data.success) {
          setMessage({ text: '¡Materias procesadas y asignadas con éxito!', type: 'success' });
        } else {
          setMessage({ text: data.message || 'Hubo un problema al subir las materias.', type: 'error' });
        }
      } catch (error) {
        console.error("Error procesando el archivo:", error);
        setMessage({ text: 'Error al leer el archivo. Verifica que sea un CSV válido y separado por comas.', type: 'error' });
      } finally {
        setIsUploading(false);
        // Reseteamos el input para que permita subir el mismo archivo si hubo un error y se corrigió
        event.target.value = '';
      }
    };

    reader.onerror = () => {
      setMessage({ text: 'Error de lectura física del archivo.', type: 'error' });
      setIsUploading(false);
    };

    // Iniciamos la lectura como texto
    reader.readAsText(file);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">Panel de Administración</h1>
        <p className="text-slate-600">Gestiona las materias y profesores de la institución.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tarjeta de subida de CSV */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <Upload size={24} />
            </div>
            <h2 className="text-xl font-semibold text-slate-800">Carga Masiva de Materias</h2>
          </div>
          
          <p className="text-sm text-slate-600 mb-6">
            Sube un archivo <span className="font-semibold">.CSV</span> con la planeación académica. 
            Las columnas deben estar en este orden exacto: <br/>
            <code className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-700 mt-2 block">
              NRC, Clave, Materia, Secc, Días, Hora, Profesor, Salón
            </code>
          </p>

          <div className="relative">
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isUploading ? 'border-slate-300 bg-slate-50' : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50 bg-white'}
            `}>
              <Upload className={`mx-auto mb-3 ${isUploading ? 'text-slate-400' : 'text-blue-500'}`} size={32} />
              <p className="font-medium text-slate-700">
                {isUploading ? 'Procesando archivo...' : 'Haz clic o arrastra tu archivo CSV aquí'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Solo archivos .csv separados por comas</p>
            </div>
          </div>

          {/* Mensajes de feedback */}
          {message.text && (
            <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 
              message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {message.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5" size={18} /> : 
               message.type === 'error' ? <AlertCircle className="shrink-0 mt-0.5" size={18} /> : null}
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}
        </div>

        {/* Tarjeta de Estadísticas / Info (Opcional, para que el panel se vea profesional) */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-xl shadow-md text-white">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen size={24} className="text-blue-200" />
              <h2 className="text-xl font-semibold">¿Cómo funciona la asignación?</h2>
            </div>
            <p className="text-blue-100 text-sm leading-relaxed">
              El sistema comparará automáticamente el nombre del profesor en el archivo con los usuarios registrados. 
              Si el profesor aún no tiene cuenta, el sistema guardará su materia "en espera" y se la asignará automáticamente en cuanto se registre.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}