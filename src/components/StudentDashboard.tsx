import React, { useState, useEffect } from 'react';
import { Clock, MapPin, QrCode, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';
import StudentQR from './StudentQR';


interface StudentDashboardProps {
  user: any;
}

const SHOW_TOKEN_FLOW = true;

export default function StudentDashboard({ user }: StudentDashboardProps) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubjects();
  }, [user.id]);

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`/api/student/${user.id}/subjects`);
      const data = await res.json();
      setSubjects(data.subjects);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activateSubject = async (e: React.FormEvent) => {
  e.preventDefault();
  setMessage('');

  if (!token.trim()) {
    setMessage('Error: Ingresa el token que recibiste por correo.');
    return;
  }

  try {
    const res = await fetch('/api/student/activate-subject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: user.id,
        token: token.trim().toUpperCase(),
      }),
    });

    const data = await res.json();

    if (data.success) {
      setMessage('Éxito: Materia activada correctamente.');
      setToken('');
      fetchSubjects();
    } else {
      setMessage('Error: ' + data.message);
    }
  } catch (err) {
    console.error(err);
    setMessage('Error: Falló la conexión al activar la materia.');
  }
};

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-blue-900">Portal del Estudiante</h1>
        <p className="text-slate-500">Bienvenido, {user.name}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Attendance Form */}
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-lg shadow-blue-100 border border-blue-100 sticky top-8">
            {SHOW_TOKEN_FLOW && (
              <>
                <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-blue-500" />
                  Activar materia
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  Ingresa el token que recibiste por correo para activar tu materia.
                </p>
                <form onSubmit={activateSubject} className="space-y-4">
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value.toUpperCase())}
                    placeholder="TOKEN"
                    maxLength={6}
                    className="w-full text-center text-2xl font-mono tracking-widest p-3 rounded-xl border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none uppercase"
                  />
                  <button
                    type="submit"
                    disabled={!token}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all"
                  >
                    Activar materia
                  </button>
                </form>
                {message && (
                  <div className={`mt-4 p-3 rounded-lg text-sm text-center ${message.includes('Éxito') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message}

                  </div>
                )}
                
              </>
            )}

            <div className="bg-white p-6 rounded-2xl shadow-lg shadow-blue-100 border border-blue-100 mt-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                <QrCode className="w-6 h-6 text-blue-500" />
                Ver mi código QR
              </h3>

              <p className="text-sm text-slate-500 mb-4">
                Muestra este código al profesor para registrar tu asistencia.
              </p>

              <StudentQR matricula={user.matricula} />

              <button
                onClick={() => window.print()}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl"
              >
                Imprimir QR
              </button>
            </div>
          </div>
        </div>

        {/* Right: Class List */}
        <div className="md:col-span-2 space-y-6">
          <h3 className="text-xl font-bold text-slate-800">Tus Clases</h3>
          {loading ? (
            <p>Cargando clases...</p>
          ) : subjects.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400">
              No tienes materias activas todavía. Ingresa el token que recibiste por correo para activar una materia.
            </div>
          ) : (
            subjects.map((subject) => (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-blue-50 hover:border-blue-200 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">{subject.name}</h4>
                    <p className="text-blue-600 text-sm font-medium mb-4">{subject.professor_name}</p>
                  </div>
                  <span className="bg-slate-100 text-slate-600 text-xs font-mono px-2 py-1 rounded">
                    {subject.nrc}
                  </span>
                </div>

                <div className="flex gap-6 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {subject.schedule}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {subject.classroom}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
