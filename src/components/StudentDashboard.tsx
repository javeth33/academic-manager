import React, { useState, useEffect } from 'react';
import { Clock, MapPin, QrCode, CheckCircle, ArrowLeft, Percent, Trophy, BookOpen, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import StudentQR from './StudentQR';

interface StudentDashboardProps {
  user: any;
}

const SHOW_TOKEN_FLOW = true;

export default function StudentDashboard({ user }: StudentDashboardProps) {
  //  MOCK DATA
  const [subjects, setSubjects] = useState<any[]>([
    {
      id: 1,
      nrc: "49097",
      name: "Modelos de Desarrollo Web",
      professor_name: "Dr. Armando Silva",
      schedule: "Lunes y Miércoles / 11:00 - 13:00",
      classroom: "CCO-101 / LAB-3",
      evaluaciones: [
        { id: 1, nombre: 'Examen Parcial', porcentajeTotal: 40, porcentajeObtenido: 32 },
        { id: 2, nombre: 'Actividades en Clase', porcentajeTotal: 30, porcentajeObtenido: 28 },
        { id: 3, nombre: 'Proyecto Final', porcentajeTotal: 30, porcentajeObtenido: 0 }
      ]
    }
  ]);
  
  // Para controlar qué materia estamos viendo a detalle
  const [selectedSubject, setSelectedSubject] = useState<any | null>(null);
  
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false); // Cambiado a false temporalmente

  useEffect(() => {
    // fetchSubjects(); // Comentado para pruebas
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

  // Modificado para recibir el evento y detener la propagación
  const dropSubject = async (e: React.MouseEvent, subjectId: number, subjectName: string) => {
    e.stopPropagation();
    
    const confirmDrop = confirm(
      `¿Seguro que deseas darte de baja de "${subjectName}"? Esta acción no se puede deshacer.`
    );

    if (!confirmDrop) return;

    try {
      const res = await fetch("/api/student/drop-subject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: user.id,
          subjectId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage("Éxito: Te diste de baja correctamente de la materia.");
        fetchSubjects();
      } else {
        setMessage("Error: " + data.message);
      }
    } catch (err) {
      console.error(err);
      setMessage("Error: Falló la conexión al darse de baja.");
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-blue-900">Portal del Estudiante</h1>
        <p className="text-slate-500">Bienvenido, {user.name}</p>
      </header>

      {/* RENDERIZADO CONDICIONAL: Detalle o Dashboard */}
      {selectedSubject ? (
        <SubjectDetailStudent 
          subject={selectedSubject} 
          onBack={() => setSelectedSubject(null)} 
        />
      ) : (
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
                  className="w-full mt-4 bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 rounded-xl transition-all shadow-md"
                >
                  Imprimir QR
                </button>
              </div>
            </div>
          </div>

          {/* Right: Class List */}
          <div className="md:col-span-2 space-y-6">
            <h3 className="text-xl font-bold text-slate-800">Tus Clases Activas</h3>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="animate-spin w-5 h-5" /> Cargando clases...
              </div>
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
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedSubject(subject)}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-blue-50 hover:border-blue-300 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-xl font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{subject.name}</h4>
                      <p className="text-blue-600 text-sm font-medium">{subject.professor_name}</p>
                    </div>
                    <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-100">
                      NRC: {subject.nrc}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-6 text-sm text-slate-500 border-t border-slate-50 pt-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      {subject.schedule}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      {subject.classroom}
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={(e) => dropSubject(e, subject.id, subject.name)}
                      className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                    >
                      Darse de baja de la materia
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// --- SUB-COMPONENTE: VISTA DE DETALLE DEL ALUMNO ---
function SubjectDetailStudent({ subject, onBack }: { subject: any; onBack: () => void }) {
  const totalObtenido = subject.evaluaciones?.reduce((acc: number, curr: any) => acc + curr.porcentajeObtenido, 0) || 0;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a mis clases
      </button>

      {/* Card de Encabezado */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-blue-100 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-800 mb-1">{subject.name}</h2>
              <p className="text-blue-600 font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> {subject.professor_name}
              </p>
            </div>
            <div className="text-right">
              <span className="block text-sm font-bold text-slate-400 uppercase tracking-widest">Promedio Actual</span>
              <span className="text-4xl font-black text-blue-600">{totalObtenido}<span className="text-lg text-slate-300">/100</span></span>
            </div>
          </div>

          {/* Barra Global */}
          <div className="mt-6">
            <div className="flex justify-between text-xs font-bold mb-2 uppercase tracking-tighter">
              <span className="text-slate-400">Progreso de Calificación</span>
              <span className="text-blue-600">{totalObtenido}% acumulado</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${totalObtenido}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${totalObtenido >= 60 ? 'bg-green-500' : 'bg-blue-600'}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Ponderaciones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Percent className="w-5 h-5 text-blue-500" />
            Desglose de Ponderaciones
          </h3>
          
          <div className="grid grid-cols-1 gap-4">
            {subject.evaluaciones?.map((evaluacion: any) => (
              <div key={evaluacion.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-700">{evaluacion.nombre}</h4>
                  <span className="text-xs font-black text-blue-500 bg-blue-50 px-3 py-1 rounded-full uppercase">
                    Valor: {evaluacion.porcentajeTotal}%
                  </span>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="flex-grow bg-slate-50 rounded-full h-2.5 overflow-hidden border border-slate-100">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(evaluacion.porcentajeObtenido / evaluacion.porcentajeTotal) * 100}%` }}
                      className="bg-blue-500 h-full rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                    />
                  </div>
                  <div className="text-right min-w-[60px]">
                    <span className="text-lg font-bold text-slate-800">{evaluacion.porcentajeObtenido}</span>
                    <span className="text-sm text-slate-400">/{evaluacion.porcentajeTotal}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resumen Lateral */}
        <div className="space-y-6">
           <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Estatus
          </h3>
          <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-200">
            <p className="text-blue-100 text-sm mb-1 font-medium">Estado de aprobación</p>
            <h4 className="text-2xl font-bold mb-4">
              {totalObtenido >= 60 ? 'Aprobado' : 'En proceso'}
            </h4>
            <div className="bg-blue-500/30 p-4 rounded-2xl text-xs leading-relaxed border border-blue-400/30">
              Recuerda que este promedio es preliminar y se actualiza conforme el profesor sube nuevas actividades.
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}