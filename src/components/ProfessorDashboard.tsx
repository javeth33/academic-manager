import { useState, useEffect } from 'react';
import { Users, Clock, Calendar, Upload, CheckSquare, ArrowLeft, MapPin, Loader2, CheckCircle, AlertCircle, QrCode, X } from 'lucide-react';
import { motion } from 'motion/react';
import QRScanner from './QRScanner';

interface Subject {
  id: number;
  nrc: string;
  name: string;
  schedule: string;
  classroom: string;
}

interface ProfessorDashboardProps {
  user: any;
}

export default function ProfessorDashboard({ user }: ProfessorDashboardProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannerSubject, setScannerSubject] = useState<Subject | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);
  const playSound = (type: "success" | "error" | "warning") => {
    const soundMap = {
      success: "/public/success.mp3",
      error: "/public/error.mp3",
      warning: "/public/warning.mp3",
    };

    const audio = new Audio(soundMap[type]);
    audio.play().catch(() => { });
  };

  useEffect(() => {
    fetchSubjects();
  }, [user.id]);

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`/api/professor/${user.id}/subjects`);
      const data = await res.json();
      setSubjects(data.subjects);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
            <div className="col-span-3 text-center py-12 bg-white rounded-2xl border border-blue-100">
              <p className="text-slate-500">No hay materias asignadas aún.</p>
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
                        <span key={i} className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs border border-slate-200">
                          {time}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-slate-700 font-medium mb-1.5">
                      <MapPin className="w-4 h-4 text-blue-500" /> Salones
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      {(subject.classroom || '').split(' / ').filter(Boolean).map((room, i) => (
                        <span key={i} className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs border border-slate-200">
                          {room}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setScannerSubject(subject);
                  }}
                  className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-xl flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  Escanear QR
                </button>
              </motion.div>
            ))
          )}
        </div>
      )}
      {scannerSubject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-blue-900">Escanear QR</h2>
                <p className="text-sm text-slate-500">
                  Materia: {scannerSubject.name}
                </p>
              </div>

              <button
                onClick={() => {
                  setScannerSubject(null);
                  setLastScan(null);
                }}
                className="text-slate-500 hover:text-red-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <QRScanner
              onScan={async (matricula) => {
                try {
                  const response = await fetch("/api/attendance/validate-qr", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      matricula,
                      materia_id: scannerSubject.id,
                    }),
                  });

                  const result = await response.json();

                  if (!result.success) {
                    if (response.status === 409) {
                      playSound("warning");
                    } else {
                      playSound("error");
                    }

                    setLastScan(`❌ ${result.message}`);
                    return;
                  }

                  playSound("success");
                  setLastScan(`✅ ${result.alumno.nombre} validado`);
                  setAttendanceRefreshKey((prev) => prev + 1);
                } catch (error) {
                  console.error(error);
                  playSound("error");
                  setLastScan("❌ Error al validar el QR");
                }
              }}
            />
          </div>
        </div>
      )}

      {lastScan && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg z-50">
          Matrícula escaneada: {lastScan}
        </div>
      )}
    </div>
  );
}

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
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [attendanceStudents, setAttendanceStudents] = useState<any[]>([]);
  const fetchAttendanceList = async () => {
    try {
      const response = await fetch(`/api/professor/subject/${subject.id}/attendance-list`);
      const result = await response.json();

      if (result.success) {
        setAttendanceStudents(result.students);
      }
    } catch (error) {
      console.error("Error al cargar lista de asistencia:", error);
    }
  };
 useEffect(() => {
  fetchAttendanceList();
}, [subject.id, refreshKey]);

  // --- ESTADOS DE LA CARGA MASIVA ---
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [isUploadingList, setIsUploadingList] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });

  // --- ESTADOS DEL FORMULARIO MANUAL ---
  const [manualStudent, setManualStudent] = useState({ matricula: '', email: '', name: '' });
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });

  const [records, setRecords] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  useEffect(() => {
    fetchSessions();
  }, [subject.id]);

  useEffect(() => {
    if (selectedSessionId) {
      fetchRecords(selectedSessionId);
    }
  }, [selectedSessionId]);

  const fetchSessions = async () => {
    const res = await fetch(`/api/professor/subject/${subject.id}/attendance`);
    const data = await res.json();
    setSessions(data.sessions);
    if (data.sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(data.sessions[0].id);
    }
  };

  const fetchRecords = async (sessionId: number) => {
    const res = await fetch(`/api/professor/session/${sessionId}/records`);
    const data = await res.json();
    setRecords(data.records);
    setAllStudents(data.allStudents);
  };

  const generateToken = async () => {
    const res = await fetch('/api/professor/attendance/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId: subject.id }),
    });
    const data = await res.json();
    if (data.success) {
      setToken(data.token);
      setExpiresAt(data.expiresAt);
      fetchSessions();
      setSelectedSessionId(data.sessionId);
    }
  };

  // --- FUNCIÓN MEJORADA: AGREGAR MANUAL ---
  const handleManualAdd = async () => {
    if (!manualStudent.matricula || !manualStudent.email || !manualStudent.name) {
      setManualMessage({ text: 'Por favor completa todos los campos', type: 'error' });
      return;
    }

    setIsSubmittingManual(true);
    setManualMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/professor/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: subject.id, students: [manualStudent] }),
      });

      const data = await res.json();
      if (data.success) {
        setManualMessage({ text: 'Alumno agregado exitosamente', type: 'success' });
        setManualStudent({ matricula: '', email: '', name: '' });
        if (selectedSessionId) fetchRecords(selectedSessionId);
      } else {
        setManualMessage({ text: 'Error al agregar alumno: ' + data.message, type: 'error' });
      }
    } catch (err) {
      setManualMessage({ text: 'Error de conexión con el servidor', type: 'error' });
    } finally {
      setIsSubmittingManual(false);
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setManualMessage({ text: '', type: '' }), 3000);
    }
  };

  // --- FUNCIÓN MEJORADA: CARGA MASIVA ---
  const handleStudentUpload = async () => {
    if (!studentFile) return;

    setIsUploadingList(true);
    setUploadMessage({ text: '', type: '' });

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').map(line => line.replace('\r', '')).filter(line => line.trim() !== '');
        const students = [];

        const separator = lines[0].includes(';') ? ';' : ',';

        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(separator);

          const matricula = columns[0]?.trim();
          const nombre = columns[1]?.trim() || '';
          const apPaterno = columns[2]?.trim() || '';
          const apMaterno = columns[3]?.trim() || '';
          const correo = columns[6]?.trim();

          const fullName = `${nombre} ${apPaterno} ${apMaterno}`.trim();

          if (correo) {
            students.push({ matricula, email: correo, name: fullName });
          }
        }

        if (students.length === 0) {
          setUploadMessage({ text: `No se encontraron correos. Revisa tu archivo CSV.`, type: 'error' });
          setIsUploadingList(false);
          setStudentFile(null);
          return;
        }

        const res = await fetch('/api/professor/students/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId: subject.id, students }),
        });

        const data = await res.json();

        if (data.success) {
          setUploadMessage({ text: `¡${students.length} estudiantes procesados con éxito!`, type: 'success' });
          setStudentFile(null);
          if (selectedSessionId) fetchRecords(selectedSessionId);
        } else {
          setUploadMessage({ text: 'Hubo un error al procesar la lista en el servidor.', type: 'error' });
        }
      } catch (error) {
        setUploadMessage({ text: 'Ocurrió un error inesperado al leer el archivo.', type: 'error' });
      } finally {
        setIsUploadingList(false);
      }
    };
    reader.readAsText(studentFile);
  };

  const toggleAttendance = async (studentId: number, currentStatus: string) => {
    if (!selectedSessionId) return;
    const newStatus = currentStatus === 'present' ? 'absent' : 'present';

    await fetch('/api/professor/attendance/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: selectedSessionId, studentId, status: newStatus }),
    });

    fetchRecords(selectedSessionId);
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a mis materias
      </button>

      {/* Encabezado Principal de la Materia */}
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
                  <span key={i} className="bg-blue-800 text-blue-50 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm border border-blue-700/50">
                    {time}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
              <h3 className="text-blue-200 text-xs uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Salones Asignados
              </h3>
              <div className="flex flex-wrap gap-2">
                {(subject.classroom || '').split(' / ').filter(Boolean).map((room, i) => (
                  <span key={i} className="bg-blue-800 text-blue-50 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm border border-blue-700/50">
                    {room}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20 transform translate-x-1/3 -translate-y-1/3"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        {/* Columna Izquierda: Acciones */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Asistencia en Vivo
            </h3>
            {token ? (
              <div className="text-center py-6 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-sm text-blue-600 mb-2">Comparte este código con los alumnos</p>
                <div className="text-4xl font-mono font-bold text-blue-900 tracking-widest mb-2">
                  {token}
                </div>
                <p className="text-xs text-slate-500">
                  Expira a las {new Date(expiresAt!).toLocaleTimeString()}
                </p>
              </div>
            ) : (
              <>
                <button
                  onClick={generateToken}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium shadow-lg"
                >
                  PIN de Asistencia
                </button>

                <button
                  onClick={onScanClick}
                  className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  <QrCode className="w-5 h-5" />
                  Escanear QR
                </button>
              </>
            )}
          </div>

          {/* TARJETA MEJORADA: IMPORTAR ALUMNOS */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Importar Alumnos
            </h3>
            <div className="space-y-4">
              <input
                type="file"
                accept=".csv"
                disabled={isUploadingList}
                onChange={(e) => {
                  setStudentFile(e.target.files?.[0] || null);
                  setUploadMessage({ text: '', type: '' });
                }}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleStudentUpload}
                disabled={!studentFile || isUploadingList}
                className="w-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 py-2.5 rounded-xl font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isUploadingList ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    Procesando Archivo...
                  </>
                ) : (
                  'Cargar Lista'
                )}
              </button>

              {/* Nuevo bloque de mensajes visuales */}
              {uploadMessage.text && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl flex items-start gap-2 text-sm border ${uploadMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                >
                  {uploadMessage.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                  <p className="font-medium mt-0.5">{uploadMessage.text}</p>
                </motion.div>
              )}


            </div>
          </div>

          {/* TARJETA MEJORADA: AGREGAR MANUAL */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Agregar Alumno Manual
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Matrícula"
                value={manualStudent.matricula}
                onChange={(e) => setManualStudent({ ...manualStudent, matricula: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm"
              />
              <input
                type="text"
                placeholder="Nombre Completo"
                value={manualStudent.name}
                onChange={(e) => setManualStudent({ ...manualStudent, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm"
              />
              <input
                type="email"
                placeholder="Correo Electrónico"
                value={manualStudent.email}
                onChange={(e) => setManualStudent({ ...manualStudent, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm"
              />
              <button
                onClick={handleManualAdd}
                disabled={isSubmittingManual}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium transition-colors mt-2 flex justify-center items-center gap-2 disabled:opacity-70"
              >
                {isSubmittingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isSubmittingManual ? 'Guardando...' : 'Agregar Alumno'}
              </button>

              {/* Mensaje visual para el modo manual */}
              {manualMessage.text && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-2 mt-2 rounded-lg text-xs text-center font-medium ${manualMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                >
                  {manualMessage.text}
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Lista de Asistencia (sin cambios) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden flex flex-col h-full">
          <div className="p-6 border-b border-blue-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              Lista de Asistencia
            </h3>
            <select
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all w-full sm:w-auto"
              value={selectedSessionId || ''}
              onChange={(e) => setSelectedSessionId(Number(e.target.value))}
            >
              {sessions.length === 0 ? (
                <option value="">No hay sesiones registradas</option>
              ) : (
                sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    Sesión: {new Date(s.created_at).toLocaleDateString()} - {new Date(s.created_at).toLocaleTimeString().slice(0, 5)}
                  </option>
                ))
              )}
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
                {attendanceStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-mono text-slate-600">
                      {student.matricula || "N/A"}
                    </td>

                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {student.nombre}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${student.estado === "presente"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                          }`}
                      >
                        {student.estado === "presente" ? "✅ Presente" : "⏳ Pendiente"}
                      </span>
                    </td>
                  </tr>
                ))}

                {attendanceStudents.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                      No hay alumnos inscritos aún en esta materia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}