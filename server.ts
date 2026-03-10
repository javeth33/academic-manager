import express from "express";
import { createServer as createViteServer } from "vite";
import { supabase, initDb } from "./src/db";
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import path from "path";
// Inicializamos la conexión a Supabase
initDb();
// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'rojasdiego133@gmail.com', // Escribe tu Gmail real
    pass: 'ptipiumlrclmfxkr' // Pega la contraseña de aplicación (sin espacios)
  }
});
async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

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


  // --- RUTAS DEL ADMINISTRADOR ---

// Crear materia manualmente
  app.post("/api/admin/subjects", async (req, res) => {
    const { nrc, name, schedule, classroom, professorName } = req.body;
    
    // 1. Buscamos si el profesor ya existe en el sistema por su nombre
    const { data: professor } = await supabase
      .from('usuarios')
      .select('id')
      .ilike('nombre', professorName.trim())
      .eq('rol', 'professor')
      .single();
      
    // 2. Insertamos la materia haciendo la misma validación que en la subida masiva
    const { error } = await supabase
      .from('materias')
      .insert([{ 
        nrc, 
        nombre: name, 
        horario: schedule, 
        salon: classroom, 
        profesor_id: professor ? professor.id : null,
        profesor_temp: professor ? null : professorName.trim()
      }]);

    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true });
  });
// --- RUTA MODIFICADA: Registro (Asignación retroactiva) ---
  app.post("/api/register", async (req, res) => {
    // 🎤 MICRÓFONO 1: Apenas entra la petición
    console.log("🚨 [BACKEND] Petición de registro recibida:", req.body);

    const { name, email, password, role, matricula } = req.body;

    if (!name || !email || !password || !role) {
      console.log("❌ [BACKEND] Faltan campos obligatorios");
      return res.status(400).json({ success: false, message: "Faltan campos obligatorios" });
    }

    // Insertamos el usuario
    const { data: user, error } = await supabase
      .from('usuarios')
      .insert([{ nombre: name, correo: email, contrasena: password, rol: role, matricula: matricula || null }])
      .select()
      .single();

    if (error) {
      // 🎤 MICRÓFONO 2: Si Supabase rechaza al usuario (ej. correo repetido)
      console.log("❌ [BACKEND] Error de Supabase al crear usuario:", error);
      if (error.code === '23505') return res.status(400).json({ success: false, message: "El correo ya está registrado" });
      return res.status(500).json({ success: false, message: error.message });
    }

    console.log(`✅ [BACKEND] Usuario creado en Supabase con éxito: ${user.nombre}`);

    // 🌟 MAGIA RETROACTIVA
    if (role === 'professor' && user) {
      console.log(`🕵️ Buscando materias perdidas para: "${name.trim()}"`);
      
      const { data: materiasPendientes, error: errBusqueda } = await supabase
        .from('materias')
        .select('id, profesor_temp')
        .ilike('profesor_temp', `%${name.trim()}%`); 

      console.log(`📦 Resultados de la búsqueda:`, materiasPendientes);

      if (materiasPendientes && materiasPendientes.length > 0) {
        const ids = materiasPendientes.map(m => m.id);
        const { error: errUpdate } = await supabase
          .from('materias')
          .update({ profesor_id: user.id, profesor_temp: null })
          .in('id', ids);
          
        if (errUpdate) console.log(`❌ Error al actualizar materias:`, errUpdate);
        else console.log(`🎉 ¡Materias asignadas con éxito a ${name}!`);
      } else {
        console.log(`⚠️ No se encontraron materias pendientes con ese nombre.`);
      }
    } else {
      console.log(`⚠️ No se ejecutó la búsqueda. Rol: "${role}"`);
    }

    // 🌟 MAGIA RETROACTIVA PARA ALUMNOS
    if (role === 'student' && user) {
      const emailLower = email.trim().toLowerCase();
      console.log(`🕵️ Buscando clases en espera para el correo: "${emailLower}"`);
      
      const { data: clasesPendientes } = await supabase
        .from('inscripciones')
        .select('id')
        .eq('alumno_temp', emailLower); 

      if (clasesPendientes && clasesPendientes.length > 0) {
        const ids = clasesPendientes.map(c => c.id);
        const { error: errUpdate } = await supabase
          .from('inscripciones')
          .update({ alumno_id: user.id, alumno_temp: null })
          .in('id', ids);
          
        if (errUpdate) console.log(`❌ Error al inscribir alumno:`, errUpdate);
        else console.log(`🎉 ¡Alumno ${name} auto-inscrito en sus materias!`);
      } else {
        console.log(`⚠️ No se encontraron clases pendientes para este correo.`);
      }
    }

    res.json({ 
      success: true, 
      user: { id: user.id, name: user.nombre, email: user.correo, role: user.rol } 
    });
  });

  // --- RUTA MODIFICADA: Subir materias masivamente (Admin) ---
  app.post("/api/admin/subjects/bulk", async (req, res) => {
    const { subjects } = req.body; 
    
    try {
      // 1. Obtenemos a todos los profesores actuales de golpe para no saturar la BD
      const { data: profesores } = await supabase
        .from('usuarios')
        .select('id, nombre')
        .eq('rol', 'professor');

      for (const sub of subjects) {
        const nombreExcel = sub.professorName.trim();
        
        // 2. Buscamos si el profe del Excel ya existe en nuestro sistema (ignorando mayúsculas)
        const profExistente = profesores?.find(
          p => p.nombre.toLowerCase() === nombreExcel.toLowerCase()
        );
          
        // 3. Insertamos la materia
        await supabase
          .from('materias')
          .insert([{ 
            nrc: sub.nrc, 
            nombre: sub.name, 
            horario: sub.schedule, 
            salon: sub.classroom, 
            profesor_id: profExistente ? profExistente.id : null,
            profesor_temp: profExistente ? null : nombreExcel // <- ¡ESTA ES LA LÍNEA CLAVE!
          }]);
      }
      res.json({ success: true, message: "Materias procesadas correctamente" });
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

// Subir estudiantes masivamente a una clase (Con Tokens y Correos)
  app.post("/api/professor/students/bulk", async (req, res) => {
    const { subjectId, students } = req.body; 

    console.log(`\n📥 [BACKEND] Recibiendo ${students?.length || 0} alumnos para la materia ID: ${subjectId}`);

    if (!students || students.length === 0) {
      return res.status(400).json({ success: false, message: "La lista de alumnos llegó vacía." });
    }

    try {
      // 1. Obtener el nombre de la materia para el correo
      const { data: subjectData } = await supabase
        .from('materias')
        .select('nombre')
        .eq('id', subjectId)
        .single();
      
      const subjectName = subjectData?.nombre || 'tu nueva materia';

      for (const s of students) {
        const emailExcel = s.email.trim().toLowerCase();
        console.log(`⏳ Procesando alumno: ${emailExcel}`);
        
        // Generar token único de 6 caracteres (ej. A4F9B2)
        const token = crypto.randomBytes(3).toString('hex').toUpperCase();

        const { data: user } = await supabase
          .from('usuarios')
          .select('id')
          .eq('correo', emailExcel)
          .single();

        // Inscribir a la materia guardando el token y el estatus
        const { error: insertError } = await supabase
          .from('inscripciones')
          .insert([{ 
            materia_id: subjectId, 
            alumno_id: user ? user.id : null,
            alumno_temp: user ? null : emailExcel,
            token_acceso: token,
            estatus: 'pendiente'
          }]);

        if (insertError) {
          console.log(`❌ Error Supabase con ${emailExcel}:`, insertError.message);
        } else {
          // ✉️ ENVIAR EL CORREO SI SE GUARDÓ BIEN
          try {
            await transporter.sendMail({
              from: '"BUAP Academic" <rojasdiego133@gmail.com>',
              to: emailExcel,
              subject: `🔑 Código de acceso para: ${subjectName}`,
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px;">
                  <h2 style="color: #1e3a8a; text-align: center;">¡Hola, ${s.name}!</h2>
                  <p>Tu profesor te ha agregado a la clase de <strong>${subjectName}</strong> en el sistema BUAP Academic.</p>
                  <p>Para desbloquear tu clase y ver tu horario, salón y pasar asistencia, ingresa el siguiente código de acceso en tu panel:</p>
                  
                  <div style="background-color: #eff6ff; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0; border: 2px dashed #93c5fd;">
                    <h1 style="color: #2563eb; letter-spacing: 8px; margin: 0; font-size: 32px;">${token}</h1>
                  </div>
                  
                  <p style="color: #64748b; font-size: 14px;">Si aún no tienes cuenta, regístrate con este mismo correo (${emailExcel}) en nuestra plataforma y tu materia te estará esperando.</p>
                </div>
              `
            });
            console.log(`✅ Inscrito y correo enviado a: ${emailExcel}`);
          } catch (mailError) {
            console.log(`⚠️ Alumno inscrito, pero falló el envío de correo a ${emailExcel}:`, mailError);
          }
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      console.log("🚨 [BACKEND] Error catastrófico:", error);
      res.status(500).json({ success: false, message: error.message });
    }
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
  }else {
    // 🌟 MODO PRODUCCIÓN: Servir los archivos compilados
    app.use(express.static(path.resolve("dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist", "index.html"));
    });
  }
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();