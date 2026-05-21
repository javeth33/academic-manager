import React, { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, QrCode, CheckCircle, ArrowLeft, Percent, Trophy, BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import StudentQR from './StudentQR';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedbackMsg {
  text: string;
  type: 'success' | 'error' | '';
}

interface StudentDashboardProps {
  user: any;
}

// ─── Config ───────────────────────────────────────────────────────────────────
// Si necesitas desactivar el flujo de token, cámbialo aquí o en una variable de entorno.
const SHOW_TOKEN_FLOW = true;

// ─── StudentDashboard ─────────────────────────────────────────────────────────

export default function StudentDashboard({ user }: StudentDashboardProps) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<any | null>(null);
  const [token, setToken] = useState('');
  const [message, setMessage] = useState<FeedbackMsg>({ text: '', type: '' });
  const [loading, setLoading] = useState(true);

  const [actividadesDesglose, setActividadesDesglose] = useState<any[]>([]);
  const [loadingActividades, setLoadingActividades] = useState(false);

  const fetchActividadesDetalle = useCallback(async (subjectId: number) => {
    setLoadingActividades(true);
    try {
      const res = await fetch(`/api/student/${user.id}/subject/${subjectId}/calificaciones-detalle`, {
        headers: authedHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setActividadesDesglose(data.desglose);
      }
    } catch (err) {
      console.error('Error al cargar actividades:', err);
    } finally {
      setLoadingActividades(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (selectedSubject) {
      fetchActividadesDetalle(selectedSubject.id);
    } else {
      setActividadesDesglose([]);
    }
  }, [selectedSubject, fetchActividadesDetalle]);

  const authedHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/student/${user.id}/subjects`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Error al cargar materias');
      const data = await res.json();
      setSubjects(data.subjects || []);
    } catch (err) {
      console.error('[StudentDashboard] fetchSubjects:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  // Auto-dismiss message
  useEffect(() => {
    if (!message.text) return;
    const t = setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const activateSubject = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanToken = token.trim().toUpperCase();
    if (!cleanToken) {
      setMessage({ text: 'Ingresa el token que recibiste por correo.', type: 'error' });
      return;
    }
    if (cleanToken.length !== 6) {
      setMessage({ text: 'El token debe tener exactamente 6 caracteres.', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/student/activate-subject', {
        method: 'POST',
        headers: authedHeaders(),
        body: JSON.stringify({ studentId: user.id, token: cleanToken }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ text: 'Materia activada correctamente.', type: 'success' });
        setToken('');
        fetchSubjects();
      } else {
        setMessage({ text: data.message || 'Token inválido.', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Error de conexión al activar la materia.', type: 'error' });
    }
  };

  const dropSubject = async (e: React.MouseEvent, subjectId: number, subjectName: string) => {
    e.stopPropagation();

    // Custom inline confirm using a native confirm only as fallback —
    // ideally reemplazar con un modal propio si se requiere en el futuro.
    if (!window.confirm(`¿Seguro que deseas darte de baja de "${subjectName}"? Esta acción no se puede deshacer.`)) return;

    try {
      const res = await fetch('/api/student/drop-subject', {
        method: 'POST',
        headers: authedHeaders(),
        body: JSON.stringify({ studentId: user.id, subjectId }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ text: 'Te diste de baja correctamente de la materia.', type: 'success' });
        fetchSubjects();
      } else {
        setMessage({ text: data.message || 'No se pudo completar la baja.', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Error de conexión al darse de baja.', type: 'error' });
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-blue-900">Portal del Estudiante</h1>
        <p className="text-slate-500">Bienvenido, {user.name}</p>
      </header>

      <AnimatePresence mode="wait">
        {selectedSubject ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SubjectDetailStudent 
              subject={selectedSubject} 
              onBack={() => setSelectedSubject(null)} 
              actividadesDesglose={actividadesDesglose}
              loadingActividades={loadingActividades}
            />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {/* Left column */}
            <div className="md:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-lg shadow-blue-100 border border-blue-100 sticky top-8 space-y-6">

                {SHOW_TOKEN_FLOW && (
                  <div>
                    <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                      <CheckCircle className="w-6 h-6 text-blue-500" /> Activar materia
                    </h3>
                    <p className="text-sm text-slate-500 mb-6">
                      Ingresa el token que recibiste por correo para activar tu materia.
                    </p>
                    <form onSubmit={activateSubject} noValidate className="space-y-4">
                      <input
                        type="text"
                        value={token}
                        onChange={(e) => setToken(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        placeholder="TOKEN"
                        maxLength={6}
                        className="w-full text-center text-2xl font-mono tracking-widest p-3 rounded-xl border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none uppercase"
                      />
                      <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all"
                      >
                        Activar materia
                      </button>
                    </form>
                    <AnimatePresence>
                      {message.text && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 font-medium ${
                            message.type === 'success'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {message.type === 'success'
                            ? <CheckCircle className="w-4 h-4 shrink-0" />
                            : <AlertCircle className="w-4 h-4 shrink-0" />
                          }
                          {message.text}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* QR panel */}
                <div>
                  <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <QrCode className="w-6 h-6 text-blue-500" /> Ver mi código QR
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

            {/* Right column */}
            <div className="md:col-span-2 space-y-6">
              <h3 className="text-xl font-bold text-slate-800">Tus Clases Activas</h3>

              {loading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-500 bg-white rounded-2xl border border-blue-50 shadow-sm">
                  <Loader2 className="animate-spin w-6 h-6 text-blue-600" /> Cargando clases...
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
                        <Clock className="w-4 h-4 text-blue-500" /> {subject.schedule}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-500" /> {subject.classroom}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SubjectDetailStudent ─────────────────────────────────────────────────────

function SubjectDetailStudent({ 
  subject, 
  onBack, 
  actividadesDesglose, 
  loadingActividades 
}: { 
  subject: any; 
  onBack: () => void;
  actividadesDesglose: any[];
  loadingActividades: boolean;
}) {
  // Lógica matemática para calcular el promedio ponderado exacto desde las actividades de Teams
  let acumuladoPonderado = 0;
  let hasAnyGrade = false;

  actividadesDesglose.forEach((pond) => {
    const calificadas = pond.actividades.filter((a: any) => a.puntaje !== null);
    if (calificadas.length > 0) {
      hasAnyGrade = true;
      const sumaPuntajes = calificadas.reduce((acc: number, act: any) => acc + Number(act.puntaje), 0);
      const promedioDePonderacion = sumaPuntajes / calificadas.length;
      
      // Sumamos al acumulado global (escala 0-100)
      acumuladoPonderado += promedioDePonderacion * (Number(pond.porcentaje) / 100);
    }
  });

  // Convertimos de escala 100% a base 10 (ej. 87.5% pasa a ser 8.75) para el estándar académico
  const promedioActualBase10 = acumuladoPonderado / 10;
  const promedioRedondeado = Number(promedioActualBase10.toFixed(2));
  const promedioPct = Math.min(100, Math.max(0, promedioActualBase10 * 10));

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium mb-2"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a mis clases
      </button>

      {/* Header card */}
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
              {hasAnyGrade ? (
                <span className="text-4xl font-black text-blue-600">
                  {promedioRedondeado}<span className="text-lg text-slate-300">/10</span>
                </span>
              ) : (
                <span className="text-lg font-semibold text-slate-300">Sin calificaciones</span>
              )}
            </div>
          </div>

          {hasAnyGrade && (
            <div className="mt-6">
              <div className="flex justify-between text-xs font-bold mb-2 uppercase tracking-tighter">
                <span className="text-slate-400">Progreso de Calificación</span>
                <span className="text-blue-600">{promedioRedondeado} promedio</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${promedioPct}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${promedioRedondeado >= 6 ? 'bg-green-500' : 'bg-blue-600'}`}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Evaluaciones con Desglose de Actividades */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Percent className="w-5 h-5 text-blue-500" /> Desglose de Ponderaciones y Actividades
          </h3>

          {loadingActividades ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-100 flex items-center justify-center gap-2 text-slate-400 text-sm shadow-sm">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              Cargando desglose de actividades...
            </div>
          ) : actividadesDesglose.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400">
              El profesor aún no ha asignado ponderaciones ni actividades para esta materia.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {actividadesDesglose.map((pond) => (
                <div key={pond.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  {/* Fila de la Ponderación Principal */}
                  <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                    <h4 className="font-bold text-slate-700">{pond.nombre}</h4>
                    <span className="text-xs font-black text-blue-500 bg-blue-50 px-3 py-1 rounded-full uppercase">
                      Valor: {pond.porcentaje}%
                    </span>
                  </div>

                  {/* Lista de Actividades bajo esta ponderación */}
                  <div className="space-y-2">
                    {pond.actividades.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">Sin actividades registradas en este criterio.</p>
                    ) : (
                      pond.actividades.map((act: any) => (
                        <div key={act.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                          <span className="text-sm text-slate-600 font-medium">
                            {act.nombre}
                          </span>
                          <span className={`text-sm font-bold ${
                            act.puntaje === null ? 'text-slate-400 italic bg-slate-200/50 px-2 py-1 rounded-md' 
                            : act.puntaje < 60 ? 'text-red-600' 
                            : 'text-slate-800'
                          }`}>
                            {act.puntaje === null ? 'Pendiente' : `${Number(act.puntaje).toFixed(0)}/100`}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Estatus */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" /> Estatus
          </h3>
          <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-200">
            <p className="text-blue-100 text-sm mb-1 font-medium">Estado de aprobación</p>
            <h4 className="text-2xl font-bold mb-4">
              {!hasAnyGrade
                ? 'Sin datos aún'
                : promedioRedondeado >= 6
                ? 'Aprobado'
                : 'En proceso'}
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
