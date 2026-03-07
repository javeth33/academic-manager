import express from "express";
import { createServer as createViteServer } from "vite";
import { supabase, initDb } from "./src/db";

// Inicializamos la conexión a Supabase
initDb();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- RUTAS DE AUTENTICACIÓN ---

  // Login
  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('correo', email)
      .eq('contrasena', password)
      .single();

    if (user) {
      res.json({ 
        success: true, 
        user: { id: user.id, name: user.nombre, email: user.correo, role: user.rol, matricula: user.matricula } 
      });
    } else {
      res.status(401).json({ success: false, message: "Credenciales inválidas" });
    }
  });

  // Registro
  app.post("/api/register", async (req, res) => {
    const { name, email, password, role, matricula } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: "Faltan campos obligatorios" });
    }

    const { data: user, error } = await supabase
      .from('usuarios')
      .insert([{ nombre: name, correo: email, contrasena: password, rol: role, matricula: matricula || null }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // 23505 es el código de Postgres para "Elemento duplicado"
        return res.status(400).json({ success: false, message: "El correo ya está registrado" });
      }
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({ 
      success: true, 
      user: { id: user.id, name: user.nombre, email: user.correo, role: user.rol, matricula: user.matricula } 
    });
  });

  // --- RUTAS DEL ADMINISTRADOR ---

  // Crear materia manualmente
  app.post("/api/admin/subjects", async (req, res) => {
    const { nrc, name, schedule, classroom, professorEmail } = req.body;
    
    // Buscar al profesor
    const { data: professor } = await supabase
      .from('usuarios')
      .select('id')
      .eq('correo', professorEmail)
      .eq('rol', 'professor')
      .single();
      
    if (!professor) {
      return res.status(400).json({ success: false, message: "Profesor no encontrado" });
    }

    const { error } = await supabase
      .from('materias')
      .insert([{ nrc, nombre: name, horario: schedule, salon: classroom, profesor_id: professor.id }]);

    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true });
  });

  // Subir materias masivamente (Bulk)
  app.post("/api/admin/subjects/bulk", async (req, res) => {
    const { subjects } = req.body; 
    
    try {
      for (const sub of subjects) {
        const { data: prof } = await supabase
          .from('usuarios')
          .select('id')
          .eq('correo', sub.professorEmail)
          .eq('rol', 'professor')
          .single();
          
        await supabase
          .from('materias')
          .insert([{ nrc: sub.nrc, nombre: sub.name, horario: sub.schedule, salon: sub.classroom, profesor_id: prof ? prof.id : null }]);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: "Error al procesar lote de materias" });
    }
  });

  // --- RUTAS DEL PROFESOR ---

  // Obtener materias del profesor
  app.get("/api/professor/:id/subjects", async (req, res) => {
    const { data: materias, error } = await supabase
      .from('materias')
      .select('*')
      .eq('profesor_id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });

    // Adaptar nombres para el frontend
    const subjects = materias.map(m => ({
      id: m.id, nrc: m.nrc, name: m.nombre, schedule: m.horario, classroom: m.salon, professor_id: m.profesor_id
    }));
    
    res.json({ subjects });
  });

  // Subir estudiantes masivamente a una clase
  app.post("/api/professor/students/bulk", async (req, res) => {
    const { subjectId, students } = req.body; 

    try {
      for (const s of students) {
        // Buscar si el alumno ya existe
        let { data: user } = await supabase.from('usuarios').select('id').eq('correo', s.email).single();
        
        // Si no existe, crearlo
        if (!user) {
          const { data: newUser } = await supabase
            .from('usuarios')
            .insert([{ nombre: s.name, correo: s.email, contrasena: 'student123', rol: 'student', matricula: s.matricula }])
            .select('id')
            .single();
          user = newUser;
        }

        // Inscribirlo en la materia
        if (user) {
          await supabase.from('inscripciones').upsert({ materia_id: subjectId, alumno_id: user.id });
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Generar Token de Asistencia
  app.post("/api/professor/attendance/token", async (req, res) => {
    const { subjectId } = req.body;
    const token = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

    const { data: session, error } = await supabase
      .from('sesiones_asistencia')
      .insert([{ materia_id: subjectId, token, fecha_expiracion: expiresAt }])
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, token, sessionId: session.id, expiresAt: session.fecha_expiracion });
  });

  // Obtener sesiones pasadas de una materia
  app.get("/api/professor/subject/:id/attendance", async (req, res) => {
    const { data: sesiones } = await supabase
      .from('sesiones_asistencia')
      .select('*')
      .eq('materia_id', req.params.id)
      .order('fecha_creacion', { ascending: false });

    const sessions = sesiones?.map(s => ({
      id: s.id, subject_id: s.materia_id, token: s.token, expires_at: s.fecha_expiracion, created_at: s.fecha_creacion
    })) || [];

    res.json({ sessions });
  });

  // Actualizar asistencia manualmente
  app.post("/api/professor/attendance/update", async (req, res) => {
    const { sessionId, studentId, status } = req.body;
    
    if (status === 'absent') {
      await supabase.from('registros_asistencia')
        .delete()
        .eq('sesion_id', sessionId)
        .eq('alumno_id', studentId);
    } else {
      await supabase.from('registros_asistencia')
        .upsert({ sesion_id: sessionId, alumno_id: studentId, estado: status });
    }
    res.json({ success: true });
  });

  // --- RUTAS DEL ESTUDIANTE ---

  // Obtener materias inscritas por el estudiante
  app.get("/api/student/:id/subjects", async (req, res) => {
    // Consulta avanzada: Busca las materias a través de las inscripciones
    const { data: inscripciones } = await supabase
      .from('inscripciones')
      .select(`
        materias (
          id, nrc, nombre, horario, salon, profesor_id,
          usuarios!materias_profesor_id_fkey (nombre)
        )
      `)
      .eq('alumno_id', req.params.id);

    const subjects = inscripciones?.map((i: any) => ({
      id: i.materias.id,
      nrc: i.materias.nrc,
      name: i.materias.nombre,
      schedule: i.materias.horario,
      classroom: i.materias.salon,
      professor_name: i.materias.usuarios?.nombre || 'Sin asignar'
    })) || [];

    res.json({ subjects });
  });

  // Registrar asistencia (Al ingresar el código)
  app.post("/api/student/attend", async (req, res) => {
    const { studentId, token } = req.body;
    
    // 1. Buscar la sesión por el token
    const { data: session } = await supabase
      .from('sesiones_asistencia')
      .select('*')
      .eq('token', token)
      .single();
      
    if (!session) return res.status(404).json({ success: false, message: "Código inválido" });
    
    // 2. Revisar si expiró
    if (new Date(session.fecha_expiracion) < new Date()) {
      return res.status(400).json({ success: false, message: "El código ha expirado" });
    }

    // 3. Confirmar que el alumno está en esa clase
    const { data: enrollment } = await supabase
      .from('inscripciones')
      .select('*')
      .eq('alumno_id', studentId)
      .eq('materia_id', session.materia_id)
      .single();

    if (!enrollment) return res.status(403).json({ success: false, message: "No estás inscrito en esta clase" });

    // 4. Guardar la asistencia
    const { error } = await supabase
      .from('registros_asistencia')
      .upsert({ sesion_id: session.id, alumno_id: studentId, estado: 'present' });
      
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, message: "Asistencia registrada correctamente" });
  });


  // --- MIDDLEWARE DE VITE (No tocar) ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();