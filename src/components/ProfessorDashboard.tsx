import { useState, useEffect } from 'react';
import { Users, Clock, Calendar, Upload, CheckSquare, ArrowLeft, MapPin } from 'lucide-react';
import { motion } from 'motion/react';

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
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <p>Cargando materias...</p>
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
                
                {/* Visualización mejorada de Horarios en la tarjeta */}
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
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SubjectDetail({ subject, onBack }: { subject: Subject; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'attendance' | 'students'>('attendance');
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [studentFile, setStudentFile] = useState<File | null>(null);
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
      fetchSessions(); // Refresh sessions list
      setSelectedSessionId(data.sessionId);
    }
  };

  const [manualStudent, setManualStudent] = useState({ matricula: '', email: '', name: '' });

  const handleManualAdd = async () => {
    if (!manualStudent.matricula || !manualStudent.email || !manualStudent.name) {
      alert('Por favor completa todos los campos');
      return;
    }

    const res = await fetch('/api/professor/students/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId: subject.id, students: [manualStudent] }),
    });

    const data = await res.json();
    if (data.success) {
      alert('Alumno agregado exitosamente');
      setManualStudent({ matricula: '', email: '', name: '' });
      if (selectedSessionId) fetchRecords(selectedSessionId);
    } else {
      alert('Error al agregar alumno: ' + data.message);
    }
  };

const handleStudentUpload = async () => {
    if (!studentFile) return;
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').map(line => line.replace('\r', '')).filter(line => line.trim() !== '');
      const students = [];
      
      // 🌟 MAGIA: Detectar si Excel usó comas o puntos y comas
      const separator = lines[0].includes(';') ? ';' : ',';
      
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(separator);
        
        // Columnas: Matricula(0), Nombre(1), ApPaterno(2), ApMaterno(3), Carrera(4), Semestre(5), Correo(6)
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

      // 🚨 Si después de buscar no encontró correos, detenemos todo y avisamos
      if (students.length === 0) {
        alert(`No se detectaron correos en la columna 7. Revisa tu archivo CSV. Separador detectado: "${separator}"`);
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
        alert(`¡${students.length} estudiantes procesados exitosamente!`);
        setStudentFile(null);
        if (selectedSessionId) fetchRecords(selectedSessionId);
      } else {
        alert('Hubo un error al procesar la lista en el servidor.');
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
            {/* Bloque de Horarios */}
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

            {/* Bloque de Salones */}
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

      {/* Resto de la interfaz (Tokens, Asistencia, etc.) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        {/* Left Column: Actions */}
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
              <button
                onClick={generateToken}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium shadow-lg shadow-blue-200 transition-all"
              >
                Generar Token
              </button>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Importar Alumnos
            </h3>
            <div className="space-y-4">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setStudentFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
              />
              <button
                onClick={handleStudentUpload}
                disabled={!studentFile}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-medium disabled:opacity-50 transition-colors"
              >
                Cargar Lista
              </button>
              <p className="text-xs text-slate-400 text-center">CSV requerido: Matricula, Email, Nombre</p>
            </div>
          </div>

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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium transition-colors mt-2"
              >
                Agregar Alumno
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Attendance Records */}
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
                    Sesión: {new Date(s.created_at).toLocaleDateString()} - {new Date(s.created_at).toLocaleTimeString().slice(0,5)}
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
                  <th className="px-6 py-4 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allStudents.map((student) => {
                  const record = records.find(r => r.student_id === student.id);
                  const isPresent = record?.status === 'present';
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">{student.matricula || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{student.name}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isPresent ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                          {isPresent ? 'Presente' : 'Ausente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => toggleAttendance(student.id, isPresent ? 'present' : 'absent')}
                          className={`text-xs font-semibold px-4 py-1.5 rounded-lg border transition-colors ${
                            isPresent 
                              ? 'border-red-200 text-red-600 hover:bg-red-50' 
                              : 'border-green-200 text-green-600 hover:bg-green-50'
                          }`}
                        >
                          Marcar {isPresent ? 'Ausente' : 'Presente'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {allStudents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50">
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                      <p>No hay alumnos inscritos aún en esta materia.</p>
                      <p className="text-sm mt-1">Utiliza el panel izquierdo para agregar estudiantes.</p>
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