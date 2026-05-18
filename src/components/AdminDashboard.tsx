import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, BookOpen, PlusCircle, Search } from 'lucide-react';

export default function AdminDashboard() {
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });

  // --- ESTADOS PARA EL REGISTRO MANUAL ---
  const [manualSubject, setManualSubject] = useState({
    nrc: '',
    name: '',
    schedule: '',
    classroom: '',
    professorName: '' 
  });
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });

  // Función helper para mandar los headers con el token
  const authedHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMessage({ text: 'Procesando y agrupando archivo CSV...', type: '' });

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').map(line => line.replace('\r', '')).filter(line => line.trim() !== '');
        
        // LÓGICA DE AGRUPACIÓN POR NRC
        const subjectsMap = new Map();

        lines.slice(1).forEach(line => {
          const columns = line.split(','); 
          const nrc = columns[0]?.trim();
          
          if (!nrc) return; // Saltamos líneas vacías

          const name = columns[2]?.trim() || 'Sin Nombre';
          const scheduleStr = `${columns[4]?.trim() || ''} ${columns[5]?.trim() || ''}`.trim();
          const professorName = columns[6]?.trim() || '';
          const classroom = columns[7]?.trim() || '';

          if (subjectsMap.has(nrc)) {
            // Si el NRC ya existe, concatenamos los nuevos horarios y salones
            const existingSubject = subjectsMap.get(nrc);
            
            if (scheduleStr) {
              existingSubject.schedule += ` / ${scheduleStr}`;
            }
            // Agregamos el salón solo si es diferente
            if (classroom && !existingSubject.classroom.includes(classroom)) {
              existingSubject.classroom += ` / ${classroom}`;
            }
          } else {
            // Si es la primera vez que vemos este NRC, lo guardamos
            subjectsMap.set(nrc, {
              nrc,
              name,
              schedule: scheduleStr,
              professorName,
              classroom
            });
          }
        });

        // Convertimos el mapa de nuevo a un arreglo para enviarlo al servidor
        const subjects = Array.from(subjectsMap.values());
        console.log("Materias agrupadas listas para enviar:", subjects);

        // AQUÍ SE AGREGA EL TOKEN AL FETCH
        const response = await fetch('/api/admin/subjects/bulk', {
          method: 'POST',
          headers: authedHeaders(),
          body: JSON.stringify({ subjects })
        });

        const data = await response.json();

        if (data.success) {
          setMessage({ text: `¡Se procesaron y asignaron ${subjects.length} materias únicas con éxito!`, type: 'success' });
        } else {
          setMessage({ text: data.message || 'Hubo un problema al subir las materias.', type: 'error' });
        }
      } catch (error) {
        setMessage({ text: 'Error al leer el archivo. Verifica que sea un CSV válido y separado por comas.', type: 'error' });
      } finally {
        setIsUploading(false);
        event.target.value = '';
      }
    };

    reader.onerror = () => {
      setMessage({ text: 'Error de lectura física del archivo.', type: 'error' });
      setIsUploading(false);
    };

    reader.readAsText(file);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingManual(true);
    setManualMessage({ text: '', type: '' });

    try {
      // AQUÍ SE AGREGA EL TOKEN AL FETCH
      const response = await fetch('/api/admin/subjects', {
        method: 'POST',
        headers: authedHeaders(),
        body: JSON.stringify(manualSubject)
      });

      const data = await response.json();

      if (data.success) {
        setManualMessage({ 
          text: data.linked 
            ? '¡Materia registrada y profesor vinculado exitosamente!' 
            : '¡Materia registrada! (Profesor guardado en espera de registro)', 
          type: 'success' 
        });
        setManualSubject({ nrc: '', name: '', schedule: '', classroom: '', professorName: '' });
      } else {
        setManualMessage({ text: data.message || 'Error al registrar la materia.', type: 'error' });
      }
    } catch (error) {
      setManualMessage({ text: 'Error de conexión con el servidor.', type: 'error' });
    } finally {
      setIsSubmittingManual(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">Panel de Administración</h1>
        <p className="text-slate-600">Gestiona las materias y profesores de la institución.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tarjeta de Carga Masiva */}
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

        {/* Tarjeta de Información */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-xl shadow-md text-white h-full">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen size={24} className="text-blue-200" />
              <h2 className="text-xl font-semibold">¿Cómo funciona la asignación?</h2>
            </div>
            <p className="text-blue-100 text-sm leading-relaxed mb-4">
              <strong>Agrupación Inteligente:</strong> El sistema detecta si una materia (NRC) tiene varios días/horarios en diferentes filas del Excel y los agrupa en un solo registro automáticamente.
            </p>
            <p className="text-blue-100 text-sm leading-relaxed mb-4">
              <strong>Búsqueda Inteligente:</strong> Al registrar una materia, el sistema buscará al profesor en la base de datos por nombre o apellido. Si no lo encuentra, guardará la materia "en espera" y se la asignará en cuanto se registre en la plataforma.
            </p>
          </div>
        </div>
      </div>

      {/* Formulario de Registro Manual */}
      <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-blue-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
            <PlusCircle size={24} />
          </div>
          <h2 className="text-xl font-semibold text-slate-800">Registro Manual de Materia</h2>
        </div>

        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NRC</label>
              <input
                type="text"
                required
                value={manualSubject.nrc}
                onChange={(e) => setManualSubject({ ...manualSubject, nrc: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej. 12345"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Materia</label>
              <input
                type="text"
                required
                value={manualSubject.name}
                onChange={(e) => setManualSubject({ ...manualSubject, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej. Modelos de Desarrollo Web"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Salón</label>
              <input
                type="text"
                required
                value={manualSubject.classroom}
                onChange={(e) => setManualSubject({ ...manualSubject, classroom: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej. CCO1 102"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Horario y Días</label>
              <input
                type="text"
                required
                value={manualSubject.schedule}
                onChange={(e) => setManualSubject({ ...manualSubject, schedule: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej. L 09:00-09:59 / M 09:00-10:59 / V 09:00-10:59"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                Profesor a asignar <Search className="w-3 h-3 text-slate-400" />
              </label>
              <input
                type="text"
                required
                value={manualSubject.professorName}
                onChange={(e) => setManualSubject({ ...manualSubject, professorName: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="(Búsqueda inteligente)"
              />
              <p className="text-xs text-slate-500 mt-1">El sistema buscará coincidencias. Si no existe, lo dejará en espera.</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex-1 mr-4">
              {manualMessage.text && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  manualMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {manualMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <p className="text-sm font-medium">{manualMessage.text}</p>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmittingManual}
              className="bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 flex-shrink-0"
            >
              {isSubmittingManual ? 'Guardando...' : 'Registrar Materia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}