import { useState, useEffect, useCallback } from 'react';
import { Users, Clock, Calendar, Upload, CheckSquare, ArrowLeft, MapPin, Loader2, CheckCircle, AlertCircle, QrCode, X, Percent, Plus, Pencil, Save, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRScanner from './QRScanner';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject {
  id: number;
  nrc: string;
  name: string;
  schedule: string;
  classroom: string;
}

interface AttendanceStudent {
  id: number;
  nombre: string;
  matricula: string;
  correo: string;
  estatus_inscripcion: string;
  estado: 'presente' | 'no_asistio' | 'pendiente' | 'pendiente_activar';
}

interface Session {
  id: number;
  subject_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

interface Ponderacion {
  id: number;
  nombre: string;
  porcentaje: number;
}

interface FeedbackMsg {
  text: string;
  type: 'success' | 'error' | '';
}

interface ConfirmModal {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

// ─── Hooks & helpers ──────────────────────────────────────────────────────────

function useConfirmModal() {
  const [modal, setModal] = useState<ConfirmModal>({
    open: false, title: '', description: '', onConfirm: () => {},
  });

  const confirm = (title: string, description: string): Promise<boolean> =>
    new Promise((resolve) => {
      setModal({
        open: true, title, description,
        onConfirm: () => { setModal((m) => ({ ...m, open: false })); resolve(true); },
      });
    });

  const cancel = () => { setModal((m) => ({ ...m, open: false })); };

  return { modal, confirm, cancel };
}

function playSound(type: 'success' | 'error' | 'warning') {
  const map = { success: '/public/success.mp3', error: '/public/error.mp3', warning: '/public/warning.mp3' };
  new Audio(map[type]).play().catch(() => {});
}

// ─── ConfirmModal component ───────────────────────────────────────────────────

function ConfirmModal({ modal, onCancel }: { modal: ConfirmModal; onCancel: () => void }) {
  if (!modal.open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-100"
      >
        <h3 className="text-lg font-bold text-slate-800 mb-2">{modal.title}</h3>
        <p className="text-sm text-slate-500 mb-6">{modal.description}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={modal.onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            Confirmar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── ProfessorDashboard (root) ────────────────────────────────────────────────

interface ProfessorDashboardProps {
  user: any;
}

export default function ProfessorDashboard({ user }: ProfessorDashboardProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannerSubject, setScannerSubject] = useState<Subject | null>(null);
  const [lastScan, setLastScan] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'closed' } | null>(null);
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/professor/${user.id}/subjects`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Error al cargar materias');
      const data = await res.json();
      setSubjects(data.subjects || []);
    } catch (err) {
      console.error('[ProfessorDashboard] fetchSubjects:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!lastScan) return;
    const t = setTimeout(() => setLastScan(null), 3500);
    return () => clearTimeout(t);
  }, [lastScan]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-blue-900">Portal del Profesor</h1>
          <p className="text-slate-500">Bienvenido, {user.name}</p>
        </div>
      </header>

      {selectedSubject ? (
        <SubjectDetail
          subject={selectedSubject}
          onBack={() => setSelectedSubject(null)}
          onScanClick={() => setScannerSubject(selectedSubject)}
          refreshKey={attendanceRefreshKey}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-3 text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-slate-500 mt-2">Cargando materias...</p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="col-span-3 text-center py-12 bg-white rounded-2xl border border-blue-100 shadow-sm">
              <p className="text-slate-500 font-medium">No tienes materias asignadas aún.</p>
            </div>
          ) : (
            subjects.map((subject) => (
              <motion.div
                key={subject.id}
                whileHover={{ y: -5 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 cursor-pointer hover:shadow-md transition-all group flex flex-col"
                onClick={() => setSelectedSubject(subject)}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
                    NRC: {subject.nrc}
                  </span>
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors shrink-0">
                    <Calendar className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-4 flex-grow">{subject.name}</h3>

                <div className="space-y-3 text-sm">
                  <div>
                    <div className="flex items-center gap-2 text-slate-700 font-medium mb-1.5">
                      <Clock className="w-4 h-4 text-blue-500" /> Horarios
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      {(subject.schedule || '').split(' / ').filter(Boolean).map((time, i) => (
                        <span key={i} className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs border border-slate-200">{time}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-slate-700 font-medium mb-1.5">
                      <MapPin className="w-4 h-4 text-blue-500" /> Salones
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      {(subject.classroom || '').split(' / ').filter(Boolean).map((room, i) => (
                        <span key={i} className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs border border-slate-200">{room}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setScannerSubject(subject); }}
                  className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <QrCode className="w-4 h-4" /> Escanear QR
                </button>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ── QR Scanner Modal ── */}
      <AnimatePresence>
        {scannerSubject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-blue-900">Escanear QR</h2>
                  <p className="text-sm text-slate-500">Materia: {scannerSubject.name}</p>
                </div>
                <button
                  onClick={() => { setScannerSubject(null); setLastScan(null); }}
                  className="text-slate-500 hover:text-red-500 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <QRScanner
                onScan={async (matricula) => {
                  try {
                    const response = await fetch('/api/attendance/validate-qr', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                      },
                      body: JSON.stringify({ matricula, materia_id: scannerSubject.id }),
                    });
                    const result = await response.json();

                    if (!result.success) {
                      if (result.type === 'closed') {
                        playSound('error');
                        setLastScan({ text: `${result.message}`, type: 'closed' });
                        return;
                      }
                      if (response.status === 409) {
                        playSound('warning');
                        setLastScan({ text: ` ${result.message}`, type: 'warning' });
                        return;
                      }
                      playSound('error');
                      setLastScan({ text: ` ${result.message}`, type: 'error' });
                      return;
                    }

                    playSound('success');
                    setLastScan({ text: `${result.alumno.nombre} validado`, type: 'success' });
                    setAttendanceRefreshKey((prev) => prev + 1);
                  } catch {
                    playSound('error');
                    setLastScan({ text: ' Error al validar el QR', type: 'error' });
                  }
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {lastScan && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 text-white px-5 py-3 rounded-xl shadow-lg z-50 max-w-sm flex items-center gap-2 ${
              lastScan.type === 'success' ? 'bg-green-600'
              : lastScan.type === 'warning' ? 'bg-yellow-600'
              : lastScan.type === 'closed' ? 'bg-slate-800'
              : 'bg-red-600'
            }`}
          >
            <span>{lastScan.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SubjectDetail ────────────────────────────────────────────────────────────

function SubjectDetail({
  subject,
  onBack,
  onScanClick,
  refreshKey,
}: {
  subject: Subject;
  onBack: () => void;
  onScanClick: () => void;
  refreshKey: number;
}) {
  const [activeTab, setActiveTab] = useState<'asistencia' | 'alumnos' | 'evaluacion'>('asistencia');

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium mb-2"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a mis materias
      </button>

      {/* Header */}
      <div className="bg-blue-900 text-white p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-3xl font-bold">{subject.name}</h2>
            <span className="bg-blue-800 text-blue-100 text-sm font-bold px-4 py-2 rounded-full border border-blue-700 w-fit">
              NRC: {subject.nrc}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
              <h3 className="text-blue-200 text-xs uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Horarios de Clase
              </h3>
              <div className="flex flex-wrap gap-2">
                {(subject.schedule || '').split(' / ').filter(Boolean).map((time, i) => (
                  <span key={i} className="bg-blue-800 text-blue-50 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm border border-blue-700/50">{time}</span>
                ))}
              </div>
            </div>
            <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
              <h3 className="text-blue-200 text-xs uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Salones Asignados
              </h3>
              <div className="flex flex-wrap gap-2">
                {(subject.classroom || '').split(' / ').filter(Boolean).map((room, i) => (
                  <span key={i} className="bg-blue-800 text-blue-50 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm border border-blue-700/50">{room}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20 transform translate-x-1/3 -translate-y-1/3" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-blue-100 w-fit">
        {(['asistencia', 'alumnos', 'evaluacion'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
            }`}
          >
            {tab === 'asistencia' ? 'Asistencia' : tab === 'alumnos' ? 'Gestión de Alumnos' : 'Evaluación y Ponderaciones'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'asistencia' && (
          <motion.div key="asistencia" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AttendanceTab subject={subject} onScanClick={onScanClick} refreshKey={refreshKey} />
          </motion.div>
        )}
        {activeTab === 'alumnos' && (
          <motion.div key="alumnos" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <StudentsTab subject={subject} />
          </motion.div>
        )}
        {activeTab === 'evaluacion' && (
          <motion.div key="evaluacion" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <EvaluationTab subject={subject} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── AttendanceTab ────────────────────────────────────────────────────────────

function AttendanceTab({ subject, onScanClick, refreshKey }: { subject: Subject; onScanClick: () => void; refreshKey: number }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [attendanceStudents, setAttendanceStudents] = useState<AttendanceStudent[]>([]);
  const { modal, confirm, cancel } = useConfirmModal();

  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const historySessions = sessions.filter((s) => {
    const key = new Date(s.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    return key !== todayKey;
  });

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/professor/subject/${subject.id}/attendance`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('[AttendanceTab] fetchSessions:', err);
    }
  }, [subject.id]);

  const fetchAttendanceList = useCallback(async (sessionId: number | null) => {
    try {
      const url = sessionId
        ? `/api/professor/subject/${subject.id}/attendance-list?session_id=${sessionId}`
        : `/api/professor/subject/${subject.id}/attendance-list`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const result = await res.json();
      if (result.success) setAttendanceStudents(result.students);
    } catch (err) {
      console.error('[AttendanceTab] fetchAttendanceList:', err);
    }
  }, [subject.id]);

  // Single source of truth for attendance list
  useEffect(() => {
    fetchAttendanceList(selectedSessionId);
  }, [fetchAttendanceList, selectedSessionId, refreshKey]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const closeAttendance = async () => {
    const ok = await confirm(
      'Cerrar asistencia',
      'Los alumnos activos que no pasaron lista quedarán marcados como "No asistió". Esta acción no se puede deshacer.',
    );
    if (!ok) return;

    try {
      const response = await fetch('/api/attendance/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ materia_id: subject.id }),
      });
      const result = await response.json();
      if (result.success) fetchAttendanceList(selectedSessionId);
    } catch (err) {
      console.error('[AttendanceTab] closeAttendance:', err);
    }
  };

  const estadoLabel: Record<string, string> = {
    presente: 'Presente',
    no_asistio: 'No asistió',
    pendiente_activar: 'Pendiente de activar',
    pendiente: 'Pendiente',
  };
  const estadoClass: Record<string, string> = {
    presente: 'bg-green-50 text-green-700 border border-green-200',
    no_asistio: 'bg-red-50 text-red-700 border border-red-200',
    pendiente_activar: 'bg-slate-50 text-slate-700 border border-slate-200',
    pendiente: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  };

  return (
    <>
      <ConfirmModal modal={modal} onCancel={cancel} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" /> Asistencia en Vivo
          </h3>
          <button
            onClick={onScanClick}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md"
          >
            <QrCode className="w-5 h-5" /> Escanear QR
          </button>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-blue-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600" /> Lista de Asistencia
              <button
                onClick={closeAttendance}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl ml-2 transition-colors"
              >
                Cerrar asistencia
              </button>
            </h3>
            <select
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all w-full sm:w-auto"
              value={selectedSessionId ?? ''}
              onChange={(e) => setSelectedSessionId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Asistencia de hoy</option>
              {historySessions.map((s) => {
                const fecha = new Date(s.created_at);
                return (
                  <option key={s.id} value={s.id}>
                    {fecha.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })} -{' '}
                    {fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Matrícula</th>
                  <th className="px-6 py-4 font-semibold">Nombre</th>
                  <th className="px-6 py-4 font-semibold text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendanceStudents.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                      No hay alumnos inscritos aún en esta materia.
                    </td>
                  </tr>
                ) : (
                  attendanceStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">{student.matricula || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{student.nombre}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${estadoClass[student.estado] ?? ''}`}>
                          {estadoLabel[student.estado] ?? student.estado}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── StudentsTab ──────────────────────────────────────────────────────────────

function StudentsTab({ subject }: { subject: Subject }) {
  const [manualStudent, setManualStudent] = useState({ matricula: '', email: '', name: '' });
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState<FeedbackMsg>({ text: '', type: '' });

  const [htmlPaste, setHtmlPaste] = useState('');
  const [previewStudents, setPreviewStudents] = useState<any[]>([]);
  const [isUploadingList, setIsUploadingList] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<FeedbackMsg>({ text: '', type: '' });

  const authedHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  // ── Validations ──

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidMatricula = (m: string) => m.trim().length >= 3;

  const handleManualAdd = async () => {
    const { matricula, email, name } = manualStudent;

    if (!matricula.trim() || !email.trim() || !name.trim()) {
      setManualMessage({ text: 'Por favor completa todos los campos.', type: 'error' });
      return;
    }
    if (!isValidMatricula(matricula)) {
      setManualMessage({ text: 'La matrícula debe tener al menos 3 caracteres.', type: 'error' });
      return;
    }
    if (!isValidEmail(email)) {
      setManualMessage({ text: 'El correo electrónico no es válido.', type: 'error' });
      return;
    }

    setIsSubmittingManual(true);
    setManualMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/professor/students/bulk', {
        method: 'POST',
        headers: authedHeaders(),
        body: JSON.stringify({ subjectId: subject.id, students: [{ matricula: matricula.trim(), email: email.trim().toLowerCase(), name: name.trim() }] }),
      });
      const data = await res.json();
      if (data.success) {
        const extra =
          typeof data.mailed === 'number'
            ? ` Correo: ${data.mailed ? 'enviado' : 'no enviado'}${data.mailFailed ? ' (error Brevo)' : ''}.`
            : '';
        setManualMessage({ text: 'Alumno agregado exitosamente.' + extra, type: 'success' });
        setManualStudent({ matricula: '', email: '', name: '' });
      } else {
        setManualMessage({ text: 'Error: ' + data.message, type: 'error' });
      }
    } catch {
      setManualMessage({ text: 'Error de conexión con el servidor.', type: 'error' });
    } finally {
      setIsSubmittingManual(false);
      setTimeout(() => setManualMessage({ text: '', type: '' }), 4000);
    }
  };

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const extractMailtoFromRow = (tr: Element): string => {
    const links = tr.querySelectorAll('a[href^="mailto:"]');
    for (const a of links) {
      const href = (a as HTMLAnchorElement).getAttribute('href') ?? '';
      const m = href.match(/^mailto:([^?&]+)/i);
      if (!m?.[1]) continue;
      const addr = decodeURIComponent(m[1].trim()).toLowerCase();
      if (addr && !addr.startsWith('?') && isValidEmail(addr)) return addr;
    }
    return '';
  };

  /** Banner / autoservicios BUAP: varias tablas; la lista va en datadisplaytable con caption "Resumen de Lista de Clase". */
  const findClassListTable = (doc: Document): HTMLTableElement | null => {
    const tables = Array.from(doc.querySelectorAll('table'));
    for (const t of tables) {
      const cap = normalize(t.querySelector('caption')?.textContent ?? '');
      if (cap.includes('resumen de lista de clase')) return t;
      const sum = (t.getAttribute('summary') ?? '').toLowerCase();
      if (sum.includes('lista de alumnos inscritos')) return t;
    }
    for (const t of tables) {
      const firstRow = t.querySelector('tr');
      if (!firstRow) continue;
      const heads = Array.from(firstRow.querySelectorAll('th,td')).map((c) => normalize(c.textContent ?? ''));
      const hasNombre = heads.some((h) => h.includes('nombre de alumno'));
      const hasIdCol = heads.some((h) => h === 'id' || h.includes('numero de identificacion'));
      if (hasNombre && hasIdCol && t.querySelector('a[href^="mailto:"]')) return t;
    }
    return null;
  };

  const extractStudentsFromHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = findClassListTable(doc);
    if (!table) return [];

    const tableEl = table as HTMLTableElement;
    const rows = Array.from(tableEl.rows);
    if (rows.length < 2) return [];

    const headerRow = rows.find((tr) => tr.querySelector('th.ddheader')) ?? rows[0];
    const headerCells = Array.from(headerRow.querySelectorAll('th,td')).map((c) => normalize(c.textContent ?? ''));

    const idxMatricula = headerCells.findIndex(
      (h) => h === 'id' || h === 'numero de id' || h.includes('numero de identificacion') || /^matricula\b/.test(h),
    );
    const idxNombre = headerCells.findIndex((h) => h.includes('nombre de alumno') || /^nombre\b/.test(h));
    const idxEmail = headerCells.findIndex((h) => /correo|e-?mail|email/.test(h));

    const out: { matricula: string; email: string; name: string }[] = [];
    for (const tr of rows) {
      if (tr === headerRow) continue;
      if (!tr.querySelector('td')) continue;

      const cells = Array.from(tr.querySelectorAll('td,th')).map((c) => String(c.textContent ?? '').replace(/\s+/g, ' ').trim());
      if (cells.length === 0) continue;

      const matricula = idxMatricula >= 0 ? String(cells[idxMatricula] ?? '').trim() : '';
      let email = idxEmail >= 0 ? String(cells[idxEmail] ?? '').trim().toLowerCase() : '';
      if (!email || !isValidEmail(email)) email = extractMailtoFromRow(tr);

      const nombre = idxNombre >= 0 ? String(cells[idxNombre] ?? '').trim() : '';
      const name = nombre || matricula;

      if (matricula && isValidEmail(email) && /^\d{6,}$/.test(matricula.replace(/\D/g, ''))) {
        out.push({ matricula: matricula.replace(/\D/g, ''), email, name: name || matricula });
      }
    }
    return out;
  };

  const handleHtmlPreview = () => {
    setUploadMessage({ text: '', type: '' });
    if (!htmlPaste.trim()) return;

    try {
      const students = extractStudentsFromHtml(htmlPaste);
      if (students.length === 0) {
        setUploadMessage({ text: 'No se detectó una tabla válida. Copia/Pega la tabla HTML de autoservicios.', type: 'error' });
        return;
      }
      setPreviewStudents(students);
    } catch {
      setUploadMessage({ text: 'No se pudo procesar el HTML pegado.', type: 'error' });
    }
  };

  const confirmAndUpload = async () => {
    if (previewStudents.length === 0) return;
    setIsUploadingList(true);
    setUploadMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/professor/students/bulk', {
        method: 'POST',
        headers: authedHeaders(),
        body: JSON.stringify({ subjectId: subject.id, students: previewStudents }),
      });
      const data = await res.json();
      if (data.success) {
        const extra =
          typeof data.mailed === 'number'
            ? ` Correos enviados: ${data.mailed}.${data.mailFailed ? ` Fallidos: ${data.mailFailed}.` : ''}${data.skippedActivo ? ` Ya activos (sin correo): ${data.skippedActivo}.` : ''}`
            : '';
        setUploadMessage({ text: `¡${previewStudents.length} estudiantes procesados!${extra}`, type: 'success' });
        setPreviewStudents([]);
        setHtmlPaste('');
      } else {
        setUploadMessage({ text: 'Error al procesar la lista en el servidor.', type: 'error' });
      }
    } catch {
      setUploadMessage({ text: 'Error de conexión con el servidor.', type: 'error' });
    } finally {
      setIsUploadingList(false);
    }
  };

  const FeedbackBanner = ({ msg }: { msg: FeedbackMsg }) =>
    msg.text ? (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}
      >
        {msg.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
        {msg.text}
      </motion.div>
    ) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Manual */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 h-fit">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" /> Agregar Alumno Manual
        </h3>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Matrícula"
            value={manualStudent.matricula}
            onChange={(e) => setManualStudent({ ...manualStudent, matricula: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm"
          />
          <input
            type="text"
            placeholder="Nombre Completo"
            value={manualStudent.name}
            onChange={(e) => setManualStudent({ ...manualStudent, name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm"
          />
          <input
            type="email"
            placeholder="Correo Electrónico"
            value={manualStudent.email}
            onChange={(e) => setManualStudent({ ...manualStudent, email: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm"
          />
          <button
            onClick={handleManualAdd}
            disabled={isSubmittingManual}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors flex justify-center items-center gap-2 disabled:opacity-70 shadow-md"
          >
            {isSubmittingManual && <Loader2 className="w-5 h-5 animate-spin" />}
            {isSubmittingManual ? 'Guardando...' : 'Agregar Alumno'}
          </button>
          <FeedbackBanner msg={manualMessage} />
        </div>
      </div>

      {/* Bulk */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 h-fit">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-600" /> Importar desde HTML (autoservicios)
        </h3>

        {previewStudents.length > 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
              {previewStudents.length} alumnos detectados
            </span>
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 sticky top-0 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Matrícula</th>
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewStudents.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-xs text-slate-600">{s.matricula}</td>
                      <td className="px-4 py-2 font-medium text-slate-800">{s.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setPreviewStudents([]); setHtmlPaste(''); }}
                disabled={isUploadingList}
                className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-medium transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAndUpload}
                disabled={isUploadingList}
                className="w-2/3 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm shadow-md"
              >
                {isUploadingList ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {isUploadingList ? 'Guardando...' : 'Confirmar y Subir'}
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 mb-4">
              Copia y pega la página completa o al menos la tabla «Resumen de Lista de Clase» de autoservicios (Banner). El correo se lee de los enlaces mailto:.
            </p>
            <textarea
              value={htmlPaste}
              onChange={(e) => { setHtmlPaste(e.target.value); setUploadMessage({ text: '', type: '' }); }}
              placeholder="<table>...</table>"
              rows={7}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm font-mono"
            />
            <button
              onClick={handleHtmlPreview}
              disabled={!htmlPaste.trim()}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md"
            >
              Previsualizar Lista
            </button>
          </div>
        )}

        {uploadMessage.text && previewStudents.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 p-3 rounded-xl flex items-start gap-2 text-sm border ${
              uploadMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {uploadMessage.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <p className="font-medium mt-0.5">{uploadMessage.text}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── EvaluationTab ────────────────────────────────────────────────────────────

// ─── EvaluationTab (REPARADO) ────────────────────────────────────────────────

function EvaluationTab({ subject }: { subject: Subject }) {
  const [ponderaciones, setPonderaciones] = useState<Ponderacion[]>([]);
  const [isAddingPond, setIsAddingPond] = useState(false);
  const [newPond, setNewPond] = useState({ nombre: '', porcentaje: '' });
  const [editingPondId, setEditingPondId] = useState<number | null>(null);
  const [editPond, setEditPond] = useState({ nombre: '', porcentaje: '' });
  const [pondLoading, setPondLoading] = useState(false);
  const [deletingPondId, setDeletingPondId] = useState<number | null>(null);
  const [pondError, setPondError] = useState('');

  const totalPct = ponderaciones.reduce((a, c) => a + c.porcentaje, 0);

  const [activeEvalTab, setActiveEvalTab] = useState<'import' | 'concentrado'>('import');
  const [gradesFile, setGradesFile] = useState<File | null>(null);
  const [gradesPreview, setGradesPreview] = useState<Array<{ matricula: string; calificaciones: Record<string, number> }>>([]);
  const [gradesMessage, setGradesMessage] = useState<FeedbackMsg>({ text: '', type: '' });
  const [gradesLoading, setGradesLoading] = useState(false);
  const [concentrado, setConcentrado] = useState<any[]>([]);
  const [concentradoLoading, setConcentradoLoading] = useState(false);

  const authedHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  const fetchPonderaciones = useCallback(async () => {
    try {
      const subjectId = (subject as any).uuid || subject.id;
      const res = await fetch(`/api/professor/subject/${subject.id}/ponderaciones`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (data.success) setPonderaciones(data.ponderaciones);
    } catch (err) {
      console.error('[EvaluationTab] fetchPonderaciones:', err);
    }
  }, [subject.id]);

  useEffect(() => { fetchPonderaciones(); }, [fetchPonderaciones]);

  // ─── FUNCIÓN REPARADA: handleGradesPreview ────────────────────────────────
  
  //  FUNCIÓN REPARADA: handleGradesPreview
// Detecta correctamente archivos Excel con estructura de PESOS en una fila y ACTIVIDADES en otra

const handleGradesPreview = async () => {
  if (!gradesFile) return;
  setGradesMessage({ text: '', type: '' });

  try {
    const buf = await gradesFile.arrayBuffer();
    const workbook = XLSX.read(buf, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    // Leer con defval vacío para no perder celdas
    const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (!Array.isArray(jsonData) || jsonData.length < 2) {
      setGradesMessage({ text: 'El archivo no tiene filas suficientes.', type: 'error' });
      return;
    }

    // ─── PASO 1: Detectar fila de PESOS ────────────────────────
    // Buscar fila donde hay números decimales (0.1, 0.2, 0.3) que corresponden a ponderaciones
    let pesosRowIdx = -1;
    for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
      const row = jsonData[i] as any[];
      const pesos = row.filter(
        (cell) => typeof cell === 'number' && cell > 0 && cell < 1
      );
      // Si encuentra 3+ números que podrían ser pesos (0.1-1.0), probablemente es la fila de pesos
      if (pesos.length >= 3) {
        pesosRowIdx = i;
        break;
      }
    }

    // ─── PASO 2: Detectar fila de ACTIVIDADES ────────────────────
    // Está justo debajo de pesos o cerca del inicio
    let actividadesRowIdx = pesosRowIdx >= 0 ? pesosRowIdx + 1 : 0;

    // Validación: la fila de actividades debe tener nombres de texto
    const actividadesRow = jsonData[actividadesRowIdx] as any[];
    const textCells = actividadesRow.filter(
      (cell) => typeof cell === 'string' && cell.trim().length > 2
    );
    if (textCells.length < 3) {
      setGradesMessage({
        text: 'No se detectó fila con nombres de actividades. Estructura esperada: Fila de pesos + Fila de actividades + Datos.',
        type: 'error',
      });
      return;
    }

    // ─── PASO 3: Mapear columnas de PONDERACIONES ────────────────
    const pondMapping = new Map<number, { nombre: string; peso: number }>();

    if (pesosRowIdx >= 0) {
      const pesosRow = jsonData[pesosRowIdx] as any[];
      const actRow = jsonData[actividadesRowIdx] as any[];

      for (let col = 0; col < actRow.length; col++) {
        const peso = pesosRow[col];
        const nombre = String(actRow[col] ?? '').trim();

        if (typeof peso === 'number' && peso > 0 && peso < 1 && nombre) {
          pondMapping.set(col, { nombre, peso });
        }
      }
    }

    if (pondMapping.size === 0) {
      setGradesMessage({
        text: 'No se detectaron columnas de ponderación. Verifica que haya pesos (0.1, 0.2, etc.) en la estructura del archivo.',
        type: 'error',
      });
      return;
    }

    // ─── PASO 4: Detectar columnas de MATRÍCULA y NOMBRE ──────────
    const dataStartRow = actividadesRowIdx + 1; // Datos de alumnos comienzan aquí
    const firstDataRow = jsonData[dataStartRow] as any[];

    let idxMatricula = -1;
    let idxNombre = -1;

    // Buscar por posición típica (columna 2-3 suelen ser nombre/ID en BUAP)
    const potentialNameCols = [1, 2]; // Columnas más comunes para nombres
    const potentialIdCols = [2, 3];   // Columnas más comunes para ID

    // Estrategia 1: Buscar por contenido numérico en filas de datos
    for (let col = 0; col < 5; col++) {
      let numericCount = 0;
      for (let row = dataStartRow; row < Math.min(jsonData.length, dataStartRow + 5); row++) {
        const val = String((jsonData[row] as any[])[col] ?? '').trim();
        // Matrícula: 6+ dígitos
        if (/^\d{6,}$/.test(val)) numericCount++;
      }
      if (numericCount >= 1 && idxMatricula < 0) idxMatricula = col;
    }

    // Estrategia 2: Nombre está típicamente en columna 1 o 2
    if (idxNombre < 0) {
      for (const col of potentialNameCols) {
        const val = String((jsonData[dataStartRow] as any[])[col] ?? '').trim();
        if (val && val.length > 3 && !/^\d+$/.test(val)) {
          idxNombre = col;
          break;
        }
      }
    }

    if (idxMatricula < 0 || idxNombre < 0) {
      setGradesMessage({
        text: 'No se encontraron columnas de Matrícula o Nombre. Estructura esperada: [Nombre | Matrícula | Actividades...]',
        type: 'error',
      });
      return;
    }

    // ─── PASO 5: Extraer datos de ALUMNOS ──────────────────────────
    const preview: Array<{ matricula: string; calificaciones: Record<string, number> }> = [];

    for (let r = dataStartRow; r < jsonData.length; r++) {
      const row = jsonData[r] as any[];
      const matriculaRaw = String(row[idxMatricula] ?? '').trim().replace(/\D/g, '');

      if (!matriculaRaw || matriculaRaw.length < 5) continue;

      const calificaciones: Record<string, number> = {};

      // Iterar sobre columnas mapeadas de ponderaciones
      for (const [col, { nombre }] of pondMapping) {
        const val = row[col];
        const num = Number(val);
        if (!Number.isNaN(num) && num >= 0) {
          calificaciones[nombre] = num;
        }
      }

      // Solo agregar si tiene al menos una calificación
      if (Object.keys(calificaciones).length > 0) {
        preview.push({
          matricula: matriculaRaw,
          calificaciones,
        });
      }
    }

    if (preview.length === 0) {
      setGradesMessage({
        text: 'No se detectaron filas válidas de alumnos con calificaciones.',
        type: 'error',
      });
      return;
    }

    setGradesPreview(preview.slice(0, 200));
    const pondNames = Array.from(pondMapping.values())
      .map((p) => p.nombre)
      .join(', ');
    setGradesMessage({
      text: `Detectadas ${preview.length} filas. Ponderaciones: ${pondNames}`,
      type: 'success',
    });
  } catch (error) {
    console.error('Error en handleGradesPreview:', error);
    setGradesMessage({
      text: 'No se pudo leer el archivo. Usa .xlsx exportado desde Excel.',
      type: 'error',
    });
  }
};


  // ─────────────────────────────────────────────────────────────────────────

  const handleImportGrades = async () => {
    if (gradesPreview.length === 0) return;
    setGradesLoading(true);
    setGradesMessage({ text: '', type: '' });
    try {
      const subjectId = (subject as any).uuid || subject.id;
      const res = await fetch(`/api/professor/subject/${subject.id}/calificaciones/import`, {
        method: 'POST',
        headers: authedHeaders(),
        body: JSON.stringify({ rows: gradesPreview }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setGradesMessage({ text: data?.message || 'No se pudo importar calificaciones.', type: 'error' });
        return;
      }
      setGradesMessage({ text: `Importación OK. Registros: ${data.imported}.`, type: 'success' });
      setGradesFile(null);
      setGradesPreview([]);
    } catch {
      setGradesMessage({ text: 'Error de conexión al importar calificaciones.', type: 'error' });
    } finally {
      setGradesLoading(false);
    }
  };

  const fetchConcentrado = useCallback(async () => {
    setConcentradoLoading(true);
    try {
      const subjectId = (subject as any).uuid || subject.id;
      const res = await fetch(`/api/professor/subject/${subject.id}/concentrado`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (data.success) setConcentrado(data.students || []);
    } catch (e) {
      console.error('[EvaluationTab] concentrado:', e);
    } finally {
      setConcentradoLoading(false);
    }
  }, [subject.id]);

  useEffect(() => {
    if (activeEvalTab === 'concentrado') fetchConcentrado();
  }, [activeEvalTab, fetchConcentrado]);

  const handleSavePonderacion = async () => {
    const pct = Number(newPond.porcentaje);

    if (!newPond.nombre.trim()) { setPondError('El nombre es requerido.'); return; }
    if (!pct || pct <= 0 || pct > 100) { setPondError('El porcentaje debe ser entre 1 y 100.'); return; }
    if (totalPct + pct > 100) { setPondError(`No puedes superar 100%. Disponible: ${100 - totalPct}%.`); return; }

    setPondError('');
    setPondLoading(true);

    try {
      const subjectId = (subject as any).uuid || subject.id; 
      const res = await fetch(`/api/professor/subject/${subject.id}/ponderaciones`, {
        method: 'POST',
        headers: authedHeaders(),
        body: JSON.stringify({ nombre: newPond.nombre.trim(), porcentaje: pct }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPondError(data?.message || 'No se pudo guardar la ponderación.');
        return;
      }

      setPonderaciones((prev) => [...prev, data.ponderacion]);
      setIsAddingPond(false);
      setNewPond({ nombre: '', porcentaje: '' });
    } catch (err) {
      console.error('[EvaluationTab] handleSavePonderacion:', err);
      setPondError('Error de conexión al guardar la ponderación.');
    } finally {
      setPondLoading(false);
    }
  };

  const startEditPonderacion = (pond: Ponderacion) => {
    setPondError('');
    setIsAddingPond(false);
    setEditingPondId(pond.id);
    setEditPond({ nombre: pond.nombre, porcentaje: String(pond.porcentaje) });
  };

  const cancelEditPonderacion = () => {
    setEditingPondId(null);
    setEditPond({ nombre: '', porcentaje: '' });
    setPondError('');
  };

  const handleUpdatePonderacion = async (pondId: number) => {
    const pct = Number(editPond.porcentaje);
    const totalSinActual = ponderaciones.reduce((a, c) => (c.id === pondId ? a : a + c.porcentaje), 0);

    if (!editPond.nombre.trim()) { setPondError('El nombre es requerido.'); return; }
    if (!pct || pct <= 0 || pct > 100) { setPondError('El porcentaje debe ser entre 1 y 100.'); return; }
    if (totalSinActual + pct > 100) { setPondError(`No puedes superar 100%. Disponible: ${100 - totalSinActual}%.`); return; }

    setPondError('');
    setPondLoading(true);

    try {
      const res = await fetch(`/api/professor/subject/${subject.id}/ponderaciones/${pondId}`, {
        method: 'PATCH',
        headers: authedHeaders(),
        body: JSON.stringify({ nombre: editPond.nombre.trim(), porcentaje: pct }),
      });
      const raw = await res.text();
      const data = raw ? (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return {};
        }
      })() : {};
      if (!res.ok || !data.success) {
        setPondError(data?.message || `No se pudo actualizar la ponderación. Código: ${res.status}.`);
        return;
      }

      await fetchPonderaciones();
      cancelEditPonderacion();
      if (activeEvalTab === 'concentrado') fetchConcentrado();
    } catch (err) {
      console.error('[EvaluationTab] handleUpdatePonderacion:', err);
      setPondError('Error de conexión al actualizar la ponderación.');
    } finally {
      setPondLoading(false);
    }
  };

  const handleDeletePonderacion = async (pond: Ponderacion) => {
    const confirmed = window.confirm(
      `¿Eliminar la ponderación "${pond.nombre}"? También se borrarán las calificaciones asociadas.`
    );
    if (!confirmed) return;

    setPondError('');
    setDeletingPondId(pond.id);

    try {
      const res = await fetch(`/api/professor/subject/${subject.id}/ponderaciones/${pond.id}`, {
        method: 'DELETE',
        headers: authedHeaders(),
      });
      const raw = await res.text();
      const data = raw ? (() => {
        try {
          return JSON.parse(raw);
        } catch {
          return {};
        }
      })() : {};

      if (!res.ok || !data.success) {
        setPondError(data?.message || `No se pudo eliminar la ponderación. Código: ${res.status}.`);
        return;
      }

      await fetchPonderaciones();
      if (editingPondId === pond.id) cancelEditPonderacion();
      if (activeEvalTab === 'concentrado') fetchConcentrado();
    } catch (err) {
      console.error('[EvaluationTab] handleDeletePonderacion:', err);
      setPondError('Error de conexión al eliminar la ponderación.');
    } finally {
      setDeletingPondId(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ponderaciones panel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 h-fit">
          <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
            <Percent className="w-5 h-5 text-blue-600" /> Ponderaciones
          </h3>
          <p className="text-sm text-slate-500 mb-6">Define los porcentajes de evaluación para esta materia.</p>

          <div className="space-y-3 mb-6">
            {ponderaciones.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-4 border border-dashed border-slate-200 rounded-xl">
                No hay ponderaciones creadas.
              </p>
            ) : (
              ponderaciones.map((pond) => (
                <div key={pond.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors group">
                  {editingPondId === pond.id ? (
                    <div className="w-full space-y-3">
                      <input
                        type="text"
                        value={editPond.nombre}
                        onChange={(e) => setEditPond({ ...editPond, nombre: e.target.value })}
                        className="w-full text-sm px-3 py-2 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={editPond.porcentaje}
                          onChange={(e) => setEditPond({ ...editPond, porcentaje: e.target.value })}
                          className="w-24 text-sm px-3 py-2 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => handleUpdatePonderacion(pond.id)}
                          disabled={pondLoading || !editPond.nombre || !editPond.porcentaje}
                          title="Guardar cambios"
                          className="h-10 w-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center justify-center transition-colors"
                        >
                          {pondLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={cancelEditPonderacion}
                          title="Cancelar edición"
                          className="h-10 w-10 bg-white border border-slate-200 text-slate-500 hover:text-slate-700 rounded-lg flex items-center justify-center transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-slate-700">{pond.nombre}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-lg">{pond.porcentaje}%</span>
                        <button
                          onClick={() => startEditPonderacion(pond)}
                          title="Editar ponderación"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 rounded-lg flex items-center justify-center transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePonderacion(pond)}
                          disabled={deletingPondId === pond.id}
                          title="Eliminar ponderación"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 disabled:opacity-50 rounded-lg flex items-center justify-center transition-all"
                        >
                          {deletingPondId === pond.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
          {pondError && !isAddingPond && <p className="mb-4 text-xs text-red-600 font-medium">{pondError}</p>}

          <div className="pt-4 border-t border-slate-100 flex justify-between items-center mb-6">
            <span className="text-base font-bold text-slate-600">Total Evaluado:</span>
            <span className={`text-lg font-black ${totalPct > 100 ? 'text-red-500' : totalPct === 100 ? 'text-green-600' : 'text-slate-700'}`}>
              {totalPct}%
            </span>
          </div>

          {isAddingPond ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
              <input
                type="text"
                placeholder="Ej. Proyecto Final"
                value={newPond.nombre}
                onChange={(e) => setNewPond({ ...newPond, nombre: e.target.value })}
                className="w-full text-sm px-3 py-2 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="%"
                  min={1}
                  max={100}
                  value={newPond.porcentaje}
                  onChange={(e) => setNewPond({ ...newPond, porcentaje: e.target.value })}
                  className="w-1/3 text-sm px-3 py-2 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSavePonderacion}
                  disabled={pondLoading || !newPond.nombre || !newPond.porcentaje}
                  className="w-2/3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  {pondLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                </button>
              </div>
              {pondError && <p className="text-xs text-red-600 font-medium">{pondError}</p>}
              <button onClick={() => { setIsAddingPond(false); setPondError(''); }} className="w-full text-xs text-slate-500 hover:text-slate-700 font-medium">
                Cancelar
              </button>
            </motion.div>
          ) : (
            <button
              onClick={() => setIsAddingPond(true)}
              disabled={totalPct >= 100}
              className="w-full border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Agregar Ponderación
            </button>
          )}
        </div>

        {/* Activities panel */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-600" /> Gestión de Actividades
          </h3>
          <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-fit mb-5">
            <button
              onClick={() => setActiveEvalTab('import')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeEvalTab === 'import' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-white'}`}
            >
              Importar calificaciones
            </button>
            <button
              onClick={() => setActiveEvalTab('concentrado')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeEvalTab === 'concentrado' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-white'}`}
            >
              Concentrado
            </button>
          </div>

          {activeEvalTab === 'import' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Sube un archivo donde las columnas de actividades coincidan por nombre con tus ponderaciones. Debe incluir una columna de matrícula.
              </p>
              <div className="border-2 border-dashed border-blue-200 rounded-2xl p-6 bg-blue-50/50">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => { setGradesFile(e.target.files?.[0] || null); setGradesPreview([]); setGradesMessage({ text: '', type: '' }); }}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 transition-colors cursor-pointer"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleGradesPreview}
                  disabled={!gradesFile || ponderaciones.length === 0}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl font-medium disabled:opacity-50"
                >
                  Previsualizar
                </button>
                <button
                  onClick={handleImportGrades}
                  disabled={gradesLoading || gradesPreview.length === 0}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {gradesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Importar
                </button>
              </div>

              {gradesMessage.text && (
                <div className={`p-3 rounded-xl text-sm border ${gradesMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {gradesMessage.text}
                </div>
              )}

              {gradesPreview.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 text-xs text-slate-500">
                    Vista previa (primeras {Math.min(gradesPreview.length, 10)} filas)
                  </div>
                  <div className="p-4 space-y-2">
                    {gradesPreview.slice(0, 10).map((r, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-mono text-slate-600">{r.matricula}</span>
                        <span className="text-slate-400"> — </span>
                        <span className="text-slate-700">
                          {Object.entries(r.calificaciones).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(', ')}
                          {Object.keys(r.calificaciones).length > 4 ? '…' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Concentrado de promedios actuales (sumatoria de puntajes). Promedio redondeado a 2 decimales.
              </p>
              {concentradoLoading ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin" /> Cargando concentrado...
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Matrícula</th>
                        <th className="px-4 py-3 font-semibold">Nombre</th>
                        <th className="px-4 py-3 font-semibold text-right">Promedio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {concentrado.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Sin alumnos activos.</td></tr>
                      ) : (
                        concentrado.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.matricula}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{s.nombre}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">{Number(s.promedio).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
