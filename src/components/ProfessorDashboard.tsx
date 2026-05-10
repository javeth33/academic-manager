import { useState, useEffect } from 'react';
import { Users, Clock, Calendar, Upload, CheckSquare, ArrowLeft, MapPin, Loader2, CheckCircle, AlertCircle, QrCode, X, Percent } from 'lucide-react';
import { motion } from 'motion/react';
import QRScanner from './QRScanner';
import * as XLSX from 'xlsx';

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

const SHOW_TOKEN_FLOW = false;

export default function ProfessorDashboard({ user }: ProfessorDashboardProps) {
  // MOCK DATA
  const [subjects, setSubjects] = useState<Subject[]>([
    {
      id: 1,
      nrc: "12345",
      name: "Desarrollo Web Fullstack",
      schedule: "Lunes y Miércoles / 10:00 - 12:00",
      classroom: "CCO-101 / LAB-2"
    }
  ]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [scannerSubject, setScannerSubject] = useState<Subject | null>(null);
  const [lastScan, setLastScan] = useState<{
    text: string;
    type: "success" | "error" | "warning" | "closed";
  } | null>(null);
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
    // fetchSubjects(); // Comentado para pruebas
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
      
      {/* Modal QR Scanner */}
      {scannerSubject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-blue-900">Escanear QR</h2>
                <p className="text-sm text-slate-500">Materia: {scannerSubject.name}</p>
              </div>
              <button
                onClick={() => { setScannerSubject(null); setLastScan(null); }}
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
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ matricula, materia_id: scannerSubject.id }),
                  });

                  const result = await response.json();

                  if (!result.success) {
                    if (result.type === "closed") {
                      playSound("error");
                      setLastScan({ text: `🔒 ${result.message}`, type: "closed" });
                      return;
                    }
                    if (response.status === 409) {
                      playSound("warning");
                      setLastScan({ text: `⚠️ ${result.message}`, type: "warning" });
                      return;
                    }

                    playSound("error");
                    setLastScan({ text: `❌ ${result.message}`, type: "error" });
                    return;
                  }

                  playSound("success");
                  setLastScan({ text: `✅ ${result.alumno.nombre} validado`, type: "success" });
                  setAttendanceRefreshKey((prev) => prev + 1);
                } catch (error) {
                  console.error(error);
                  playSound("error");
                  setLastScan({ text: "❌ Error al validar el QR", type: "error" });
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Toast Notificación */}
      {lastScan && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={`fixed bottom-6 right-6 text-white px-5 py-3 rounded-xl shadow-lg z-50 max-w-sm flex items-center gap-2 ${
            lastScan.type === "success" ? "bg-green-600"
            : lastScan.type === "warning" ? "bg-yellow-600"
            : lastScan.type === "closed" ? "bg-slate-800"
            : "bg-red-600"
            }`}
        >
          <span>{lastScan.text}</span>
        </motion.div>
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
  const [activeTab, setActiveTab] = useState<'asistencia' | 'alumnos' | 'evaluacion'>('asistencia');
  const [ponderaciones, setPonderaciones] = useState([
    { id: 1, nombre: 'Examen Parcial', porcentaje: 40 },
    { id: 2, nombre: 'Tareas', porcentaje: 30 },
    { id: 3, nombre: 'Proyecto Final', porcentaje: 30 },
  ]);

  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [attendanceStudents, setAttendanceStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  
  // NUEVOS ESTADOS DE CARGA Y VISTA PREVIA
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [previewStudents, setPreviewStudents] = useState<any[]>([]);
  const [isUploadingList, setIsUploadingList] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });

  const [manualStudent, setManualStudent] = useState({ matricula: '', email: '', name: '' });
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });

  const [records, setRecords] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);

  const fetchAttendanceList = async (sessionId?: number | null) => {
    try {
      const url = sessionId
        ? `/api/professor/subject/${subject.id}/attendance-list?session_id=${sessionId}`
        : `/api/professor/subject/${subject.id}/attendance-list`;

      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setAttendanceStudents(result.students);
      }
    } catch (error) {
      console.error("Error al cargar lista de asistencia:", error);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      fetchAttendanceList(selectedSessionId);
    } else {
      fetchAttendanceList();
    }
  }, [subject.id, refreshKey, selectedSessionId]);

  const closeAttendance = async () => {
    const confirmClose = confirm("¿Seguro que quieres cerrar la asistencia? Solo los alumnos activos que no pasaron lista cambiarán a No asistió.");
    if (!confirmClose) return;

    const response = await fetch("/api/attendance/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materia_id: subject.id }),
    });

    const result = await response.json();

    if (result.success) {
      alert("Asistencia cerrada correctamente.");
      fetchAttendanceList(selectedSessionId);
    } else {
      alert(result.message || "Error al cerrar asistencia.");
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [subject.id]);

  useEffect(() => {
    if (selectedSessionId) fetchRecords(selectedSessionId);
  }, [selectedSessionId]);

  const fetchSessions = async () => {
    const res = await fetch(`/api/professor/subject/${subject.id}/attendance`);
    const data = await res.json();
    setSessions(data.sessions || []);
    setSelectedSessionId(null);
    fetchAttendanceList();
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
        fetchAttendanceList();
        if (selectedSessionId) fetchRecords(selectedSessionId);
      } else {
        setManualMessage({ text: 'Error al agregar alumno: ' + data.message, type: 'error' });
      }
    } catch (err) {
      setManualMessage({ text: 'Error de conexión con el servidor', type: 'error' });
    } finally {
      setIsSubmittingManual(false);
      setTimeout(() => setManualMessage({ text: '', type: '' }), 3000);
    }
  };

  // FUNCION: Leer y previsualizar
  const handleFilePreview = () => {
    if (!studentFile) return;
    setUploadMessage({ text: '', type: '' });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });

        const students = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          // Ajustes según estructura BUAP
          const nombre = row[0] ? String(row[0]).trim() : '';      // Columna A: Nombre
          const apellidos = row[1] ? String(row[1]).trim() : '';   // Columna B: Apellidos
          const matricula = row[2] ? String(row[2]).trim() : '';   // Columna C: Número de ID
          const correo = row[3] ? String(row[3]).trim() : '';      // Columna D: Correo

          const fullName = `${nombre} ${apellidos}`.trim();

          // Validamos que exista matrícula, correo y que NO sea la fila de encabezados
          if (correo && matricula && matricula !== 'Número de ID') {
            students.push({ matricula, email: correo, name: fullName });
          }
        }

        if (students.length === 0) {
          setUploadMessage({ text: `No se encontraron datos válidos. Revisa el Excel.`, type: 'error' });
          return;
        }

        setPreviewStudents(students);
      } catch (error) {
        console.error(error);
        setUploadMessage({ text: 'Ocurrió un error al procesar el archivo Excel.', type: 'error' });
      }
    };
    reader.readAsBinaryString(studentFile);
  };

  // FUNCION: Enviar a base de datos
  const confirmAndUpload = async () => {
    if (previewStudents.length === 0) return;
    
    setIsUploadingList(true);
    setUploadMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/professor/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: subject.id, students: previewStudents }),
      });

      const data = await res.json();

      if (data.success) {
        setUploadMessage({ text: `¡${previewStudents.length} estudiantes importados con éxito!`, type: 'success' });
        setPreviewStudents([]); 
        setStudentFile(null); 
        fetchAttendanceList();
        if (selectedSessionId) fetchRecords(selectedSessionId);
      } else {
        setUploadMessage({ text: 'Hubo un error al procesar la lista en el servidor.', type: 'error' });
      }
    } catch (error) {
      setUploadMessage({ text: 'Error de conexión con el servidor.', type: 'error' });
    } finally {
      setIsUploadingList(false);
    }
  };

  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const historySessions = sessions.filter((session) => {
    const sessionDateKey = new Date(session.created_at).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    return sessionDateKey !== todayKey;
  });

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

      {/* TABS DE NAVEGACIÓN */}
      <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-blue-100 w-fit">
        <button
          onClick={() => setActiveTab('asistencia')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'asistencia' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
          }`}
        >
          Asistencia
        </button>
        <button
          onClick={() => setActiveTab('alumnos')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'alumnos' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
          }`}
        >
          Gestión de Alumnos
        </button>
        <button
          onClick={() => setActiveTab('evaluacion')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'evaluacion' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
          }`}
        >
          Evaluación y Ponderaciones
        </button>
      </div>

      {/* ---------------- PESTAÑA 1: ASISTENCIA ---------------- */}
      {activeTab === 'asistencia' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Asistencia en Vivo
              </h3>
              {SHOW_TOKEN_FLOW && token && (
                <div className="text-center py-6 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-sm text-blue-600 mb-2">Comparte este código con los alumnos</p>
                  <div className="text-4xl font-mono font-bold text-blue-900 tracking-widest mb-2">{token}</div>
                  <p className="text-xs text-slate-500">Expira a las {new Date(expiresAt!).toLocaleTimeString()}</p>
                </div>
              )}
              {SHOW_TOKEN_FLOW && !token && (
                <button onClick={generateToken} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium shadow-lg">
                  PIN de Asistencia
                </button>
              )}
              <button onClick={onScanClick} className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md">
                <QrCode className="w-5 h-5" />
                Escanear QR
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-blue-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-blue-600" />
                Lista de Asistencia
                <button onClick={closeAttendance} className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl ml-2">
                  Cerrar asistencia
                </button>
              </h3>
              <select
                className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all w-full sm:w-auto"
                value={selectedSessionId || ""}
                onChange={(e) => {
                  const value = e.target.value ? Number(e.target.value) : null;
                  setSelectedSessionId(value);
                  fetchAttendanceList(value);
                }}
              >
                <option value="">Asistencia de hoy</option>
                {historySessions.map((s) => {
                  const fecha = new Date(s.created_at);
                  return (
                    <option key={s.id} value={s.id}>
                      Asistencia del {fecha.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })} -{" "}
                      {fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })}
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
                  {attendanceStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">{student.matricula || "N/A"}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{student.nombre}</td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            student.estado === "presente" ? "bg-green-50 text-green-700 border border-green-200"
                            : student.estado === "no_asistio" ? "bg-red-50 text-red-700 border border-red-200"
                            : student.estado === "pendiente_activar" ? "bg-slate-50 text-slate-700 border border-slate-200"
                            : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                          }`}
                        >
                          {student.estado === "presente" ? "Presente"
                            : student.estado === "no_asistio" ? "No asistió"
                            : student.estado === "pendiente_activar" ? "Pendiente de activar"
                            : "Pendiente"}
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
        </motion.div>
      )}

      {/* ---------------- PESTAÑA 2: GESTIÓN DE ALUMNOS ---------------- */}
      {activeTab === 'alumnos' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 h-fit">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Agregar Alumno Manual
            </h3>
            <div className="space-y-4">
              <input type="text" placeholder="Matrícula" value={manualStudent.matricula} onChange={(e) => setManualStudent({ ...manualStudent, matricula: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm" />
              <input type="text" placeholder="Nombre Completo" value={manualStudent.name} onChange={(e) => setManualStudent({ ...manualStudent, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm" />
              <input type="email" placeholder="Correo Electrónico" value={manualStudent.email} onChange={(e) => setManualStudent({ ...manualStudent, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm" />
              <button onClick={handleManualAdd} disabled={isSubmittingManual} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors flex justify-center items-center gap-2 disabled:opacity-70 shadow-md">
                {isSubmittingManual ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {isSubmittingManual ? 'Guardando...' : 'Agregar Alumno'}
              </button>
              {manualMessage.text && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${manualMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {manualMessage.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                  {manualMessage.text}
                </motion.div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 h-fit">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Importar Alumnos desde CSV/Excel
            </h3>
            
            {previewStudents.length > 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                    {previewStudents.length} alumnos detectados
                  </span>
                </div>
                
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl scrollbar-thin scrollbar-thumb-slate-300">
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
                  <button onClick={() => { setPreviewStudents([]); setStudentFile(null); }} className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-medium transition-colors text-sm" disabled={isUploadingList}>
                    Cancelar
                  </button>
                  <button onClick={confirmAndUpload} disabled={isUploadingList} className="w-2/3 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm shadow-md">
                    {isUploadingList ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {isUploadingList ? 'Guardando...' : 'Confirmar y Subir'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 mb-6">
                  Sube el archivo de Excel descargado de autoservicios para cargar la lista.
                </p>
                <div className="border-2 border-dashed border-blue-200 rounded-2xl p-8 text-center bg-blue-50/50 hover:bg-blue-50 transition-colors">
                  <input
                    type="file"
                    accept=".csv, .xlsx"
                    onChange={(e) => {
                      setStudentFile(e.target.files?.[0] || null);
                      setUploadMessage({ text: '', type: '' });
                    }}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 transition-colors cursor-pointer mx-auto"
                  />
                </div>
                <button onClick={handleFilePreview} disabled={!studentFile} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md">
                  Previsualizar Lista
                </button>
              </div>
            )}

            {uploadMessage.text && !previewStudents.length && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 p-3 rounded-xl flex items-start gap-2 text-sm border ${uploadMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {uploadMessage.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                <p className="font-medium mt-0.5">{uploadMessage.text}</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* ---------------- PESTAÑA 3: EVALUACIÓN Y PONDERACIONES ---------------- */}
      {activeTab === 'evaluacion' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Percent className="w-5 h-5 text-blue-600" />
              Ponderaciones
            </h3>
            <p className="text-sm text-slate-500 mb-6">Define los porcentajes de evaluación para esta materia.</p>
            
            <div className="space-y-3 mb-6">
              {ponderaciones.map(pond => (
                <div key={pond.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                  <span className="text-sm font-semibold text-slate-700">{pond.nombre}</span>
                  <span className="text-sm font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-lg">{pond.porcentaje}%</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-base font-bold text-slate-600">Total Evaluado:</span>
              <span className="text-lg font-black text-green-600">
                {ponderaciones.reduce((acc, curr) => acc + curr.porcentaje, 0)}%
              </span>
            </div>

            <button className="w-full mt-6 border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400 font-semibold py-2.5 rounded-xl transition-all">
              + Agregar Ponderación
            </button>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              Gestión de Actividades
            </h3>
            <p className="text-sm text-slate-500 mb-6">Selecciona una ponderación y carga las actividades o calificaciones correspondientes a tus alumnos.</p>
            
            <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="text-lg font-semibold text-slate-800 mb-2">Aún no hay actividades</h4>
              <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
                Aquí podrás subir las plantillas de Excel con las calificaciones de tus alumnos o crear actividades individuales.
              </p>
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-md">
                Importar Actividades
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}