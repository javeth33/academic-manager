import { useState, useEffect } from 'react';
import { Users, Clock, Calendar, Upload, CheckSquare, ArrowLeft } from 'lucide-react';
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
                className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 cursor-pointer hover:shadow-md transition-all group"
                onClick={() => setSelectedSubject(subject)}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
                    NRC: {subject.nrc}
                  </span>
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                    <Calendar className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{subject.name}</h3>
                <div className="space-y-2 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {subject.schedule}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Salón: {subject.classroom}
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
      const lines = text.split('\n');
      const students = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [matricula, email, name] = line.split(',');
        if (email && name) students.push({ matricula, email, name });
      }

      const res = await fetch('/api/professor/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: subject.id, students }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Estudiantes cargados exitosamente');
        setStudentFile(null);
        if (selectedSessionId) fetchRecords(selectedSessionId);
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
        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a Materias
      </button>

      <div className="bg-blue-900 text-white p-8 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2">{subject.name}</h2>
          <div className="flex gap-6 text-blue-200">
            <span>NRC: {subject.nrc}</span>
            <span>{subject.schedule}</span>
            <span>Salón: {subject.classroom}</span>
          </div>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20 transform translate-x-1/3 -translate-y-1/3"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Actions */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Asistencia en Vivo
            </h3>
            {token ? (
              <div className="text-center py-6 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-sm text-blue-600 mb-2">Comparte este token con los alumnos</p>
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
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <button
                onClick={handleStudentUpload}
                disabled={!studentFile}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                Cargar Lista
              </button>
              <p className="text-xs text-slate-400">CSV: Matricula, Email, Nombre</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Agregar Alumno Manualmente
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Matrícula"
                value={manualStudent.matricula}
                onChange={(e) => setManualStudent({ ...manualStudent, matricula: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Nombre Completo"
                value={manualStudent.name}
                onChange={(e) => setManualStudent({ ...manualStudent, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder="Correo Electrónico"
                value={manualStudent.email}
                onChange={(e) => setManualStudent({ ...manualStudent, email: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleManualAdd}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Agregar Alumno
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Attendance Records */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
          <div className="p-6 border-b border-blue-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              Lista de Asistencia
            </h3>
            <select 
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-sm outline-none focus:border-blue-500"
              value={selectedSessionId || ''}
              onChange={(e) => setSelectedSessionId(Number(e.target.value))}
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {new Date(s.created_at).toLocaleDateString()} - {new Date(s.created_at).toLocaleTimeString()}
                </option>
              ))}
            </select>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-6 py-3 font-medium">Matrícula</th>
                  <th className="px-6 py-3 font-medium">Nombre</th>
                  <th className="px-6 py-3 font-medium text-center">Estado</th>
                  <th className="px-6 py-3 font-medium text-right">Acción</th>
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
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {isPresent ? 'Presente' : 'Ausente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => toggleAttendance(student.id, isPresent ? 'present' : 'absent')}
                          className={`text-xs font-medium px-3 py-1 rounded-lg border transition-colors ${
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
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                      No hay alumnos inscritos aún. Sube una lista para comenzar.
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
