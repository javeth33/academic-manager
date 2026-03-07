import React, { useState } from 'react';
import { Upload, Plus, FileText, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  
  // Manual form state
  const [manualForm, setManualForm] = useState({
    nrc: '',
    name: '',
    schedule: '',
    classroom: '',
    professorEmail: ''
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    const subjects = [];
    // Assuming header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const [nrc, name, schedule, classroom, professorEmail] = line.split(',');
      if (nrc && name) {
        subjects.push({ nrc, name, schedule, classroom, professorEmail });
      }
    }
    return subjects;
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploadStatus('Processing...');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const subjects = parseCSV(text);
      
      try {
        const res = await fetch('/api/admin/subjects/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjects }),
        });
        const data = await res.json();
        if (data.success) {
          setUploadStatus('¡Carga exitosa!');
          setFile(null);
        } else {
          setUploadStatus('Error: ' + data.message);
        }
      } catch (err) {
        setUploadStatus('Falló la carga.');
      }
    };
    reader.readAsText(file);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualForm),
      });
      const data = await res.json();
      if (data.success) {
        alert('Materia asignada exitosamente');
        setManualForm({ nrc: '', name: '', schedule: '', classroom: '', professorEmail: '' });
      } else {
        alert('Error: ' + data.message);
      }
    } catch (err) {
      alert('Falló al asignar la materia');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-blue-900">Panel de Administrador</h1>
        <p className="text-slate-500">Gestiona horarios académicos y profesores</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
        <div className="flex border-b border-blue-50">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${
              activeTab === 'upload' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:text-blue-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              Cargar Archivo de Horarios
            </div>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${
              activeTab === 'manual' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:text-blue-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              Asignación Manual
            </div>
          </button>
        </div>

        <div className="p-8">
          {activeTab === 'upload' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <div className="border-2 border-dashed border-blue-200 rounded-2xl p-12 bg-blue-50/50 hover:bg-blue-50 transition-colors">
                <FileText className="w-16 h-16 text-blue-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Cargar Horario Académico</h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                  Sube un archivo CSV con las columnas: NRC, Nombre, Horario, Salón, Correo del Profesor
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-blue-200"
                >
                  <Upload className="w-5 h-5" />
                  Seleccionar Archivo
                </label>
                {file && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-blue-700 bg-blue-100 py-2 px-4 rounded-lg inline-flex">
                    <FileText className="w-4 h-4" />
                    {file.name}
                  </div>
                )}
              </div>
              {file && (
                <button
                  onClick={handleUpload}
                  className="mt-6 bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-medium shadow-lg shadow-green-200"
                >
                  Procesar Carga
                </button>
              )}
              {uploadStatus && (
                <p className={`mt-4 font-medium ${uploadStatus.includes('Error') ? 'text-red-500' : 'text-green-600'}`}>
                  {uploadStatus}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
              <form onSubmit={handleManualSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">NRC</label>
                    <input
                      type="text"
                      value={manualForm.nrc}
                      onChange={e => setManualForm({...manualForm, nrc: e.target.value})}
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                      placeholder="ej. 12345"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Salón</label>
                    <input
                      type="text"
                      value={manualForm.classroom}
                      onChange={e => setManualForm({...manualForm, classroom: e.target.value})}
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                      placeholder="ej. A-204"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Materia</label>
                  <input
                    type="text"
                    value={manualForm.name}
                    onChange={e => setManualForm({...manualForm, name: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                    placeholder="ej. Matemáticas Avanzadas"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Horario</label>
                  <input
                    type="text"
                    value={manualForm.schedule}
                    onChange={e => setManualForm({...manualForm, schedule: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                    placeholder="ej. Lun/Jue 10:00 - 12:00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Correo del Profesor</label>
                  <input
                    type="email"
                    value={manualForm.professorEmail}
                    onChange={e => setManualForm({...manualForm, professorEmail: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                    placeholder="profesor@escuela.com"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-200"
                >
                  Asignar Materia
                </button>
              </form>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
