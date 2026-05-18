import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import { supabase, initDb } from "./src/db";
import crypto from "crypto";
import path from "path";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// ─── Constants ────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error("JWT_SECRET no está definido en las variables de entorno."); })();
const JWT_EXPIRES_IN = "8h";

// ─── Init DB ──────────────────────────────────────────────────────────────────

initDb();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeRole(input: unknown): "admin" | "professor" | "student" | string {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return raw;
  if (raw === "admin" || raw === "administrator" || raw === "administrador") return "admin";
  if (raw === "professor" || raw === "profesor" || raw === "maestro" || raw === "docente") return "professor";
  if (raw === "student" || raw === "alumno" || raw === "estudiante") return "student";
  return raw;
}

async function sendAccessTokenEmail(toEmail: string, toName: string, subjectName: string, token: string): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY ?? "";
  if (!apiKey) {
    console.error("[Brevo] BREVO_API_KEY no definida: no se puede enviar correo.");
    return false;
  }
  const safeName = String(toName || toEmail).replace(/</g, "&lt;");
  const emailData = {
    sender: { name: "BUAP Academic", email: "rojasdiego133@gmail.com" },
    to: [{ email: toEmail, name: safeName }],
    subject: `🔑 Código de acceso para: ${subjectName}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #1e3a8a; text-align: center;">¡Hola, ${safeName}!</h2>
        <p>Tu profesor te ha agregado a la clase de <strong>${subjectName}</strong> en el sistema BUAP Academic.</p>
        <p>Para desbloquear tu clase, ingresa el siguiente código en tu panel:</p>
        <div style="background-color: #eff6ff; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0; border: 2px dashed #93c5fd;">
          <h1 style="color: #2563eb; letter-spacing: 8px; margin: 0; font-size: 32px;">${token}</h1>
        </div>
      </div>
    `,
  };
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(emailData),
    });
    const txt = await res.text();
    console.log("[Brevo] Status:", res.status, "| Body:", txt);
    if (!res.ok) {
      console.error("[Brevo] Error HTTP", res.status, txt);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[Brevo] Error al enviar correo:", e);
    return false;
  }
}

async function findInscripcionForStudent(materiaId: number, emailLower: string, alumnoId: number | null) {
  if (alumnoId) {
    const { data } = await supabase
      .from("inscripciones")
      .select("id, estatus")
      .eq("materia_id", materiaId)
      .eq("alumno_id", alumnoId)
      .maybeSingle();
    return data;
  }
  const { data } = await supabase
    .from("inscripciones")
    .select("id, estatus")
    .eq("materia_id", materiaId)
    .eq("alumno_temp", emailLower)
    .maybeSingle();
  return data;
}

/**
 * Obtiene la sesión de asistencia de hoy para una materia,
 * o la crea si no existe todavía.
 */
async function getOrCreateSession(materia_id: number, hoy: string) {
  const tokenQR = `QR-${materia_id}-${hoy}`;

  const { data: existing } = await supabase
    .from("sesiones_asistencia")
    .select("*")
    .eq("materia_id", materia_id)
    .eq("token", tokenQR)
    .maybeSingle();

  if (existing) return existing;

  const { data: nueva, error } = await supabase
    .from("sesiones_asistencia")
    .insert({
      materia_id,
      token: tokenQR,
      fecha_expiracion: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      cerrada: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Error al crear sesión: ${error.message}`);
  return nueva;
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Token de autenticación requerido." });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
    (req as any).user = { ...payload, role: normalizeRole(payload.role) };
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Token inválido o expirado." });
  }
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ success: false, message: "No tienes permiso para realizar esta acción." });
    }
    next();
  };
}

// ─── Server ───────────────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // ── Autenticación ─────────────────────────────────────────────────────────────

  // Login
  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Correo y contraseña son requeridos." });
    }

    const { data: user, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("correo", email.trim().toLowerCase())
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ success: false, message: "Credenciales inválidas." });
    }

    const passwordMatch = await bcrypt.compare(password, user.contrasena);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Credenciales inválidas." });
    }

    const roleNorm = normalizeRole(user.rol);
    const token = jwt.sign(
      { userId: user.id, role: roleNorm },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.nombre,
        email: user.correo,
        role: roleNorm,
        matricula: user.matricula,
      },
    });
  });

  // Registro
  app.post("/api/register", async (req, res) => {
    const { name, email, password, role, matricula } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: "Faltan campos obligatorios." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "El formato del correo no es válido." });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "La contraseña debe tener al menos 8 caracteres." });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const { data: user, error } = await supabase
      .from("usuarios")
      .insert([{
        nombre: name.trim(),
        correo: email.trim().toLowerCase(),
        contrasena: hashedPassword,
        rol: role,
        matricula: matricula?.trim() || null,
      }])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(400).json({ success: false, message: "El correo ya está registrado." });
      }
      return res.status(500).json({ success: false, message: "Error interno al crear el usuario." });
    }

    // Asignación retroactiva: profesores
    if (role === "professor" && user) {
      const { data: materiasPendientes } = await supabase
        .from("materias")
        .select("id")
        .ilike("profesor_temp", `%${name.trim()}%`);

      if (materiasPendientes?.length) {
        const ids = materiasPendientes.map((m) => m.id);
        await supabase
          .from("materias")
          .update({ profesor_id: user.id, profesor_temp: null })
          .in("id", ids);
      }
    }

    // Asignación retroactiva: alumnos
    if (role === "student" && user) {
      const emailLower = email.trim().toLowerCase();
      const { data: clasesPendientes } = await supabase
        .from("inscripciones")
        .select("id")
        .eq("alumno_temp", emailLower);

      if (clasesPendientes?.length) {
        const ids = clasesPendientes.map((c) => c.id);
        await supabase
          .from("inscripciones")
          .update({ alumno_id: user.id, alumno_temp: null })
          .in("id", ids);
      }
    }

    const roleNorm = normalizeRole(user.rol);
    const token = jwt.sign(
      { userId: user.id, role: roleNorm },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.nombre,
        email: user.correo,
        role: roleNorm,
        matricula: user.matricula,
      },
    });
  });

  // ── Administrador ─────────────────────────────────────────────────────────────

  // Crear materia individual
  app.post("/api/admin/subjects", authMiddleware, requireRole("admin"), async (req, res) => {
    const { nrc, name, schedule, classroom, professorName } = req.body;

    if (!nrc || !name) {
      return res.status(400).json({ success: false, message: "NRC y nombre son requeridos." });
    }

    const { data: professor } = await supabase
      .from("usuarios")
      .select("id")
      .ilike("nombre", `%${professorName?.trim() ?? ""}%`)
      .eq("rol", "professor")
      .maybeSingle();

    const { error } = await supabase.from("materias").insert([{
      nrc,
      nombre: name,
      horario: schedule,
      salon: classroom,
      profesor_id: professor ? professor.id : null,
      profesor_temp: professor ? null : professorName?.trim() ?? null,
    }]);

    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, linked: !!professor });
  });

  // Carga masiva de materias
  app.post("/api/admin/subjects/bulk", authMiddleware, requireRole("admin"), async (req, res) => {
    const { subjects } = req.body;

    if (!Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ success: false, message: "Lista de materias vacía." });
    }

    try {
      const { data: profesores } = await supabase
        .from("usuarios")
        .select("id, nombre")
        .eq("rol", "professor");

      for (const sub of subjects) {
        const nombreExcel = sub.professorName?.trim() ?? "";
        const profExistente = profesores?.find(
          (p) => p.nombre.toLowerCase() === nombreExcel.toLowerCase()
        );

        await supabase.from("materias").insert([{
          nrc: sub.nrc,
          nombre: sub.name,
          horario: sub.schedule,
          salon: sub.classroom,
          profesor_id: profExistente ? profExistente.id : null,
          profesor_temp: profExistente ? null : nombreExcel,
        }]);
      }

      return res.json({ success: true, message: "Materias procesadas correctamente." });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Error al procesar el lote de materias." });
    }
  });

  // ── Profesor ──────────────────────────────────────────────────────────────────

  // Materias del profesor
  app.get("/api/professor/:id/subjects", authMiddleware, requireRole("professor", "admin"), async (req, res) => {
    const { data: materias, error } = await supabase
      .from("materias")
      .select("*")
      .eq("profesor_id", req.params.id);

    if (error) return res.status(500).json({ success: false, message: error.message });

    return res.json({
      subjects: materias.map((m) => ({
        id: m.id,
        nrc: m.nrc,
        name: m.nombre,
        schedule: m.horario,
        classroom: m.salon,
        professor_id: m.profesor_id,
      })),
    });
  });

  // Subir alumnos (individual o masivo)
  app.post("/api/professor/students/bulk", authMiddleware, requireRole("professor", "admin"), async (req, res) => {
    const { subjectId, students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: "La lista de alumnos llegó vacía." });
    }

    try {
      const mid = Number(subjectId);
      if (!mid) {
        return res.status(400).json({ success: false, message: "subjectId inválido." });
      }

      const { data: subjectData } = await supabase
        .from("materias")
        .select("nombre")
        .eq("id", mid)
        .single();

      const subjectName = subjectData?.nombre ?? "tu nueva materia";

      const dedup = new Map<string, { email: string; name: string }>();
      for (const s of students) {
        const emailExcel = String(s.email ?? "").trim().toLowerCase();
        if (!emailExcel || dedup.has(emailExcel)) continue;
        const name = String(s.name ?? "").trim() || emailExcel;
        dedup.set(emailExcel, { email: emailExcel, name });
      }

      let mailed = 0;
      let mailFailed = 0;
      let skippedActivo = 0;
      let dbErrors = 0;

      for (const s of dedup.values()) {
        const emailExcel = s.email;
        const token = crypto.randomBytes(3).toString("hex").toUpperCase();

        const { data: user } = await supabase
          .from("usuarios")
          .select("id")
          .eq("correo", emailExcel)
          .maybeSingle();

        const alumnoId = user?.id != null ? Number(user.id) : null;
        let existing = await findInscripcionForStudent(mid, emailExcel, alumnoId);

        let readyToMail = false;

        if (existing) {
          if (existing.estatus === "activo") {
            skippedActivo++;
            continue;
          }
          const { error: updErr } = await supabase
            .from("inscripciones")
            .update({
              token_acceso: token,
              estatus: "pendiente",
              alumno_id: alumnoId,
              alumno_temp: alumnoId ? null : emailExcel,
            })
            .eq("id", existing.id);
          if (updErr) {
            console.error("[students/bulk] update inscripción:", updErr);
            dbErrors++;
            continue;
          }
          readyToMail = true;
        } else {
          const { error: insertError } = await supabase.from("inscripciones").insert([{
            materia_id: mid,
            alumno_id: alumnoId,
            alumno_temp: alumnoId ? null : emailExcel,
            token_acceso: token,
            estatus: "pendiente",
          }]);

          if (insertError) {
            if (insertError.code === "23505") {
              existing = await findInscripcionForStudent(mid, emailExcel, alumnoId);
              if (existing && existing.estatus !== "activo") {
                const { error: updErr2 } = await supabase
                  .from("inscripciones")
                  .update({
                    token_acceso: token,
                    estatus: "pendiente",
                    alumno_id: alumnoId,
                    alumno_temp: alumnoId ? null : emailExcel,
                  })
                  .eq("id", existing.id);
                if (!updErr2) readyToMail = true;
                else {
                  console.error("[students/bulk] update tras duplicado:", updErr2);
                  dbErrors++;
                }
              } else if (existing?.estatus === "activo") {
                skippedActivo++;
              } else {
                console.error("[students/bulk] insert duplicado sin fila recuperable:", insertError);
                dbErrors++;
              }
            } else {
              console.error("[students/bulk] insert:", insertError);
              dbErrors++;
            }
          } else {
            readyToMail = true;
          }
        }

        if (readyToMail) {
          const ok = await sendAccessTokenEmail(emailExcel, s.name, subjectName, token);
          if (ok) mailed++;
          else mailFailed++;
          await new Promise((r) => setTimeout(r, 150));
        }
      }

      return res.json({
        success: true,
        mailed,
        mailFailed,
        skippedActivo,
        dbErrors,
        totalInput: students.length,
        totalUnique: dedup.size,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // Sesiones de asistencia de una materia
  app.get("/api/professor/subject/:id/attendance", authMiddleware, requireRole("professor", "admin"), async (req, res) => {
    const { data: sesiones } = await supabase
      .from("sesiones_asistencia")
      .select("*")
      .eq("materia_id", req.params.id)
      .order("fecha_creacion", { ascending: false });

    return res.json({
      sessions: sesiones?.map((s) => ({
        id: s.id,
        subject_id: s.materia_id,
        token: s.token,
        expires_at: s.fecha_expiracion,
        created_at: s.fecha_creacion,
      })) ?? [],
    });
  });

  // Lista de asistencia de una materia
  app.get("/api/professor/subject/:id/attendance-list", authMiddleware, requireRole("professor", "admin"), async (req, res) => {
    try {
      const materia_id = Number(req.params.id);
      const sessionId = req.query.session_id ? Number(req.query.session_id) : null;
      const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

      const { data: inscritos } = await supabase
        .from("inscripciones")
        .select(`alumno_id, estatus, usuarios (id, nombre, matricula, correo)`)
        .eq("materia_id", materia_id)
        .neq("estatus", "baja")
        .not("alumno_id", "is", null);

      let asistenciasQuery = supabase
        .from("registros_asistencia")
        .select("*")
        .eq("materia_id", materia_id);

      asistenciasQuery = sessionId
        ? asistenciasQuery.eq("sesion_id", sessionId)
        : asistenciasQuery.eq("fecha", hoy);

      const { data: asistencias } = await asistenciasQuery;

      const lista = inscritos?.map((inscripcion: any) => {
        const alumno = inscripcion.usuarios;
        const asistencia = asistencias?.find(
          (a: any) => Number(a.alumno_id) === Number(alumno.id)
        );
        return {
          id: alumno.id,
          nombre: alumno.nombre,
          matricula: alumno.matricula,
          correo: alumno.correo,
          estatus_inscripcion: inscripcion.estatus,
          estado:
            inscripcion.estatus !== "activo"
              ? "pendiente_activar"
              : asistencia
              ? asistencia.estado
              : "pendiente",
        };
      }) ?? [];

      return res.json({ success: true, students: lista, session_id: sessionId });
    } catch {
      return res.status(500).json({ success: false, message: "Error al obtener la lista de asistencia." });
    }
  });

  // Actualizar asistencia manual
  app.post("/api/professor/attendance/update", authMiddleware, requireRole("professor", "admin"), async (req, res) => {
    const { sessionId, studentId, status } = req.body;

    if (status === "absent") {
      await supabase
        .from("registros_asistencia")
        .delete()
        .eq("sesion_id", sessionId)
        .eq("alumno_id", studentId);
    } else {
      await supabase
        .from("registros_asistencia")
        .upsert({ sesion_id: sessionId, alumno_id: studentId, estado: status });
    }

    return res.json({ success: true });
  });

  // ── Ponderaciones ─────────────────────────────────────────────────────────────

  // Obtener ponderaciones
  app.get("/api/professor/subject/:id/ponderaciones", authMiddleware, requireRole("professor", "admin"), async (req, res) => {
    const { data, error } = await supabase
      .from("ponderaciones")
      .select("*")
      .eq("materia_id", req.params.id)
      .order("created_at", { ascending: true });

    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, ponderaciones: data });
  });

  // Agregar ponderación
  app.post("/api/professor/subject/:id/ponderaciones", authMiddleware, requireRole("professor", "admin"), async (req, res) => {
    const { nombre, porcentaje } = req.body;

    if (!nombre?.trim()) {
      return res.status(400).json({ success: false, message: "El nombre es requerido." });
    }
    if (!porcentaje || porcentaje <= 0 || porcentaje > 100) {
      return res.status(400).json({ success: false, message: "El porcentaje debe ser entre 1 y 100." });
    }

    // Validar que no supere 100% total
    const { data: existing } = await supabase
      .from("ponderaciones")
      .select("porcentaje")
      .eq("materia_id", req.params.id);

    const totalActual = existing?.reduce((a, c) => a + c.porcentaje, 0) ?? 0;
    if (totalActual + Number(porcentaje) > 100) {
      return res.status(400).json({
        success: false,
        message: `No puedes superar 100%. Porcentaje disponible: ${100 - totalActual}%.`,
      });
    }

    const { data, error } = await supabase
      .from("ponderaciones")
      .insert([{ materia_id: req.params.id, nombre: nombre.trim(), porcentaje: Number(porcentaje) }])
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, ponderacion: data });
  });

  // Editar ponderación
  app.patch(
    "/api/professor/subject/:subjectId/ponderaciones/:pondId",
    authMiddleware,
    requireRole("professor", "admin"),
    async (req, res) => {
      const pondId = Number(req.params.pondId);
      const subjectId = Number(req.params.subjectId);
      const { nombre, porcentaje } = req.body;

      if (!pondId || !subjectId) {
        return res.status(400).json({ success: false, message: "Parámetros inválidos." });
      }
      if (!nombre?.trim()) {
        return res.status(400).json({ success: false, message: "El nombre es requerido." });
      }
      if (!porcentaje || porcentaje <= 0 || porcentaje > 100) {
        return res.status(400).json({ success: false, message: "El porcentaje debe ser entre 1 y 100." });
      }

      const { data: existing, error: existingErr } = await supabase
        .from("ponderaciones")
        .select("id, porcentaje")
        .eq("materia_id", subjectId);

      if (existingErr) return res.status(500).json({ success: false, message: existingErr.message });

      const current = existing?.find((p: any) => Number(p.id) === pondId);
      if (!current) {
        return res.status(404).json({ success: false, message: "Ponderación no encontrada." });
      }

      const totalSinActual =
        existing?.reduce((a: number, p: any) => (Number(p.id) === pondId ? a : a + Number(p.porcentaje ?? 0)), 0) ?? 0;

      if (totalSinActual + Number(porcentaje) > 100) {
        return res.status(400).json({
          success: false,
          message: `No puedes superar 100%. Porcentaje disponible: ${100 - totalSinActual}%.`,
        });
      }

      const { error, count } = await supabase
        .from("ponderaciones")
        .update({ nombre: nombre.trim(), porcentaje: Number(porcentaje) }, { count: "exact" })
        .eq("id", pondId)
        .eq("materia_id", subjectId);

      if (error) return res.status(500).json({ success: false, message: error.message });
      if (count === 0) {
        return res.status(403).json({
          success: false,
          message:
            "Supabase no permitió actualizar la ponderación. Revisa las políticas RLS o configura SUPABASE_SERVICE_ROLE_KEY en el backend.",
        });
      }

      const { data: updated, error: updatedErr } = await supabase
        .from("ponderaciones")
        .select("*")
        .eq("id", pondId)
        .eq("materia_id", subjectId)
        .limit(1)
        .maybeSingle();

      if (updatedErr) return res.status(500).json({ success: false, message: updatedErr.message });
      if (!updated) {
        return res.status(404).json({ success: false, message: "Ponderación no encontrada o no actualizada." });
      }
      if (updated.nombre !== nombre.trim() || Number(updated.porcentaje) !== Number(porcentaje)) {
        return res.status(500).json({
          success: false,
          message: "La ponderación no se pudo actualizar en la base de datos.",
        });
      }
      return res.json({ success: true, ponderacion: updated });
    }
  );

  // Eliminar ponderación
  app.delete(
    "/api/professor/subject/:subjectId/ponderaciones/:pondId",
    authMiddleware,
    requireRole("professor", "admin"),
    async (req, res) => {
      const pondId = Number(req.params.pondId);
      const subjectId = Number(req.params.subjectId);

      if (!pondId || !subjectId) {
        return res.status(400).json({ success: false, message: "Parámetros inválidos." });
      }

      // Si existen calificaciones asociadas, Postgres puede bloquear el delete por FK.
      // Borramos primero calificaciones de esta ponderación.
      const { error: califDelError, count: califDeletedCount } = await supabase
        .from("calificaciones")
        .delete({ count: "exact" })
        .eq("ponderacion_id", pondId);

      if (califDelError) {
        return res.status(500).json({ success: false, message: califDelError.message });
      }

      const { data: deleted, error } = await supabase
        .from("ponderaciones")
        .delete()
        .eq("id", pondId)
        .eq("materia_id", subjectId)
        .select("*");

      if (error) return res.status(500).json({ success: false, message: error.message });
      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ success: false, message: "Ponderación no encontrada o ya eliminada." });
      }
      return res.json({ success: true, deletedPonderaciones: deleted.length, deletedCalificaciones: califDeletedCount ?? 0 });
    }
  );

  // Subir o actualizar calificaciones (upsert masivo)
  app.post("/api/professor/calificaciones", authMiddleware, requireRole("professor", "admin"), async (req, res) => {
    const { calificaciones } = req.body;

    if (!Array.isArray(calificaciones) || calificaciones.length === 0) {
      return res.status(400).json({ success: false, message: "No se enviaron calificaciones." });
    }

    try {
      const { error } = await supabase
        .from("calificaciones")
        .upsert(calificaciones, { onConflict: "ponderacion_id,alumno_id" });

      if (error) throw error;

      return res.json({ success: true, message: "Calificaciones actualizadas." });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // Importar calificaciones por matrícula (para módulo de evaluación)
  
  app.post(
  "/api/professor/subject/:id/calificaciones/import",
  authMiddleware,
  requireRole("professor", "admin"),
  async (req, res) => {
    try {
      const subjectId = Number(req.params.id);
      const { rows } = req.body as {
        rows: Array<{ matricula: string; calificaciones: Record<string, number | string> }>;
      };
 
      console.log("[calificaciones-import] Iniciando importación");
      console.log("  - subjectId:", subjectId);
      console.log("  - rows recibidas:", rows.length);
      if (rows.length > 0) {
        console.log("  - Primer row:", JSON.stringify(rows[0], null, 2));
      }
 
      if (!subjectId || !Array.isArray(rows) || rows.length === 0) {
        console.error("[calificaciones-import] Parámetros inválidos");
        return res.status(400).json({ success: false, message: "No se recibieron filas para importar." });
      }
 
      // ✅ PASO 1: Obtener ponderaciones de la materia
      const { data: ponds, error: pondErr } = await supabase
        .from("ponderaciones")
        .select("id, nombre, porcentaje")
        .eq("materia_id", subjectId);
 
      if (pondErr) {
        console.error("[calificaciones-import] Error al obtener ponderaciones:", pondErr);
        return res.status(500).json({ success: false, message: pondErr.message });
      }
 
      console.log("  - Ponderaciones encontradas:", ponds?.length ?? 0);
      if (ponds?.length) {
        ponds.forEach((p: any) => console.log(`    - ${p.nombre} (ID: ${p.id})`));
      }
 
      // ✅ Función de normalización (IGUAL que en frontend)
      const normalize = (s: string) =>
        String(s ?? "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim();
 
      // ✅ PASO 2: Crear mapa de ponderaciones POR NOMBRE NORMALIZADO
      const pondMap = new Map<string, number>();
      (ponds ?? []).forEach((p: any) => {
        const nombreNorm = normalize(p.nombre);
        pondMap.set(nombreNorm, Number(p.id));
        console.log(`  - Mapeado: "${p.nombre}" → normalizado: "${nombreNorm}" → ID: ${p.id}`);
      });
 
      const upserts: any[] = [];
      const errors: Array<{ matricula: string; reason: string }> = [];
      let processedRows = 0;
      let failedRows = 0;
 
      // ✅ PASO 3: Procesar cada fila
      for (const r of rows) {
        const matricula = String(r.matricula ?? "").trim();
 
        if (!matricula) {
          console.log("[calificaciones-import] Fila sin matrícula, saltando");
          failedRows++;
          continue;
        }
 
        console.log(`\n  Procesando matrícula: ${matricula}`);
 
        // ✅ PASO 3.1: Buscar alumno por matrícula
        const { data: alumno, error: alumnoErr } = await supabase
          .from("usuarios")
          .select("id, matricula, nombre")
          .eq("matricula", matricula)
          .maybeSingle();
 
        if (alumnoErr) {
          console.error(`  ❌ Error buscando alumno: ${alumnoErr.message}`);
          errors.push({ matricula, reason: alumnoErr.message });
          failedRows++;
          continue;
        }
 
        if (!alumno) {
          console.log(`  ❌ Alumno con matrícula ${matricula} no encontrado`);
          errors.push({ matricula, reason: "Matrícula no encontrada en el sistema" });
          failedRows++;
          continue;
        }
 
        console.log(`  ✅ Alumno encontrado: ${alumno.nombre} (ID: ${alumno.id})`);
 
        // ✅ PASO 3.2: Validar inscripción
        const { data: insc, error: inscErr } = await supabase
          .from("inscripciones")
          .select("id, estatus")
          .eq("materia_id", subjectId)
          .eq("alumno_id", alumno.id)
          .eq("estatus", "activo")
          .limit(1)
          .maybeSingle();
 
        if (inscErr) {
          console.error(`  ❌ Error verificando inscripción: ${inscErr.message}`);
          errors.push({ matricula, reason: inscErr.message });
          failedRows++;
          continue;
        }
 
        if (!insc) {
          console.log(`  ❌ Alumno no inscrito en materia ${subjectId}`);
          errors.push({ matricula, reason: "El alumno no está inscrito en esta materia" });
          failedRows++;
          continue;
        }
 
        console.log(`  ✅ Inscripción válida (estado: ${insc.estatus})`);
 
        // ✅ PASO 3.3: Procesar calificaciones
        const califs = r.calificaciones ?? {};
        console.log(`  Calificaciones recibidas:`, Object.keys(califs).length);
 
        let calificacionesAgregadas = 0;
 
        for (const [pondName, scoreRaw] of Object.entries(califs)) {
          const pondNameNorm = normalize(pondName);  // ✅ Normalizar el nombre recibido
          const pondId = pondMap.get(pondNameNorm);
 
          console.log(`    - "${pondName}" → normalizado: "${pondNameNorm}"`);
 
          if (!pondId) {
            console.log(`      ❌ No encontrada en mapa (disponibles: ${Array.from(pondMap.keys()).join(", ")})`);
            continue;
          }
 
          const score = Number(scoreRaw);
          if (Number.isNaN(score)) {
            console.log(`      ❌ Puntaje inválido: ${scoreRaw}`);
            continue;
          }
 
          console.log(`      ✅ Agregada: ponderación_id=${pondId}, puntaje=${score}`);
          upserts.push({
            ponderacion_id: pondId,
            alumno_id: alumno.id,
            puntaje: score,
          });
 
          calificacionesAgregadas++;
        }
 
        if (calificacionesAgregadas > 0) {
          processedRows++;
        } else {
          console.log(`  ❌ No se agregaron calificaciones para esta matrícula`);
          failedRows++;
        }
      }
 
      console.log(`\n[calificaciones-import] Resumen:`);
      console.log(`  - Filas procesadas: ${processedRows}`);
      console.log(`  - Filas fallidas: ${failedRows}`);
      console.log(`  - Upserts a ejecutar: ${upserts.length}`);
      console.log(`  - Errores: ${errors.length}`);
 
      if (upserts.length === 0) {
        console.error("[calificaciones-import] ❌ Sin datos para importar");
        return res.status(400).json({
          success: false,
          message: "No se generaron calificaciones válidas. Verifica que los nombres de actividades coincidan exactamente con tus ponderaciones.",
          errors,
          debug: {
            pondNames: Array.from(pondMap.keys()),
            receivedNames: rows.flatMap((r) => Object.keys(r.calificaciones ?? {})),
          },
        });
      }
 
      // ✅ PASO 4: Hacer el upsert
      console.log("[calificaciones-import] Ejecutando upsert...");
      const { error: upsertErr, count } = await supabase
        .from("calificaciones")
        .upsert(upserts, { onConflict: "ponderacion_id,alumno_id" });
 
      if (upsertErr) {
        console.error("[calificaciones-import] Error en upsert:", upsertErr);
        return res.status(500).json({
          success: false,
          message: upsertErr.message,
          errors,
        });
      }
 
      console.log(`[calificaciones-import] ✅ Upsert exitoso: ${count} registros`);
 
      return res.json({
        success: true,
        imported: upserts.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (e: any) {
      console.error("[calificaciones-import] ERROR CRÍTICO:", e);
      return res.status(500).json({
        success: false,
        message: `Error interno: ${e.message}`,
        stack: process.env.NODE_ENV === "development" ? e.stack : undefined,
      });
    }
  }
);
  
  // Concentrado de calificaciones por materia (promedio redondeado)
  app.get(
    "/api/professor/subject/:id/concentrado",
    authMiddleware,
    requireRole("professor", "admin"),
    async (req, res) => {
      try {
        const subjectId = Number(req.params.id);
        if (!subjectId) return res.status(400).json({ success: false, message: "Materia inválida." });

        const { data: ponds, error: pondErr } = await supabase
          .from("ponderaciones")
          .select("id, porcentaje")
          .eq("materia_id", subjectId);
        if (pondErr) return res.status(500).json({ success: false, message: pondErr.message });

        const pondIds = (ponds ?? []).map((p: any) => Number(p.id));
        const totalEval = (ponds ?? []).reduce((a: number, p: any) => a + Number(p.porcentaje ?? 0), 0);
        const porcentajeByPonderacion = new Map<number, number>(
          (ponds ?? []).map((p: any) => [Number(p.id), Number(p.porcentaje ?? 0)])
        );

        const { data: inscritos, error: insErr } = await supabase
          .from("inscripciones")
          .select(`alumno_id, usuarios (id, nombre, matricula, correo)`)
          .eq("materia_id", subjectId)
          .eq("estatus", "activo")
          .not("alumno_id", "is", null);
        if (insErr) return res.status(500).json({ success: false, message: insErr.message });

        const alumnoIds = (inscritos ?? []).map((i: any) => Number(i.alumno_id));
        const { data: califs, error: calErr } = await supabase
          .from("calificaciones")
          .select("alumno_id, ponderacion_id, puntaje")
          .in("alumno_id", alumnoIds)
          .in("ponderacion_id", pondIds);
        if (calErr) return res.status(500).json({ success: false, message: calErr.message });

        const byAlumno = new Map<number, any[]>();
        (califs ?? []).forEach((c: any) => {
          const id = Number(c.alumno_id);
          const arr = byAlumno.get(id) ?? [];
          arr.push(c);
          byAlumno.set(id, arr);
        });

        const students = (inscritos ?? []).map((i: any) => {
          const u = i.usuarios;
          const list = byAlumno.get(Number(i.alumno_id)) ?? [];
          const promedio = list.reduce((a: number, c: any) => {
            const porcentaje = porcentajeByPonderacion.get(Number(c.ponderacion_id)) ?? 0;
            return a + Number(c.puntaje ?? 0) * (porcentaje / 100);
          }, 0);
          const rounded = Number(promedio.toFixed(2));
          return {
            id: u.id,
            nombre: u.nombre,
            matricula: u.matricula,
            correo: u.correo,
            promedio: rounded,
          };
        });

        return res.json({ success: true, totalEvaluado: totalEval, students });
      } catch (e: any) {
        console.error("[concentrado] Error:", e);
        return res.status(500).json({ success: false, message: "Error interno al obtener concentrado." });
      }
    }
  );

  // ── Asistencia QR ─────────────────────────────────────────────────────────────

  // Validar QR
  app.post("/api/attendance/validate-qr", authMiddleware, async (req, res) => {
    try {
      const { matricula, materia_id } = req.body;

      if (!matricula || !materia_id) {
        return res.status(400).json({ success: false, message: "Faltan datos para validar el QR." });
      }

      const { data: alumno } = await supabase
        .from("usuarios")
        .select("id, nombre, correo, matricula, rol")
        .eq("matricula", String(matricula).trim())
        .maybeSingle();

      if (!alumno) {
        return res.status(404).json({ success: false, message: "La matrícula no pertenece a ningún alumno." });
      }

      const { data: inscripcion } = await supabase
        .from("inscripciones")
        .select("*")
        .eq("materia_id", materia_id)
        .eq("alumno_id", alumno.id)
        .maybeSingle();

      if (!inscripcion) {
        return res.status(403).json({ success: false, message: "El alumno no está inscrito en esta materia." });
      }
      if (inscripcion.estatus !== "activo") {
        return res.status(403).json({
          success: false,
          message: "El alumno aún no ha activado esta materia.",
          type: "inactive_subject",
        });
      }

      const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
      const sesion = await getOrCreateSession(Number(materia_id), hoy);

      if (sesion.cerrada) {
        return res.status(409).json({ success: false, message: "La asistencia fue cerrada.", type: "closed" });
      }

      const { data: asistenciaExistente } = await supabase
        .from("registros_asistencia")
        .select("*")
        .eq("materia_id", Number(materia_id))
        .eq("alumno_id", Number(alumno.id))
        .eq("fecha", hoy)
        .maybeSingle();

      if (asistenciaExistente) {
        if (asistenciaExistente.estado === "no_asistio") {
          return res.status(409).json({ success: false, message: "La asistencia ya fue cerrada.", type: "closed" });
        }
        if (asistenciaExistente.estado === "presente") {
          return res.status(409).json({ success: false, message: "El alumno ya registró asistencia hoy.", type: "duplicate" });
        }
        return res.status(409).json({ success: false, message: "Ya tiene un registro para hoy.", type: "registered" });
      }

      const { error: insertError } = await supabase.from("registros_asistencia").insert({
        sesion_id: sesion.id,
        alumno_id: alumno.id,
        materia_id: Number(materia_id),
        fecha: hoy,
        estado: "presente",
      });

      if (insertError) {
        return res.status(500).json({ success: false, message: "Error al registrar la asistencia." });
      }

      return res.json({ success: true, message: "Asistencia registrada.", alumno });
    } catch (error) {
      console.error("[validate-qr] Error:", error);
      return res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
  });

  // Cerrar asistencia
  app.post("/api/attendance/close", authMiddleware, requireRole("professor", "admin"), async (req, res) => {
    try {
      const materia_id = Number(req.body.materia_id);
      const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

      const sesion = await getOrCreateSession(materia_id, hoy);

      if (sesion.cerrada) {
        return res.json({ success: true, message: "La asistencia ya estaba cerrada." });
      }

      const { data: inscritos } = await supabase
        .from("inscripciones")
        .select("alumno_id")
        .eq("materia_id", materia_id)
        .eq("estatus", "activo")
        .not("alumno_id", "is", null);

      const { data: asistenciasHoy } = await supabase
        .from("registros_asistencia")
        .select("alumno_id")
        .eq("materia_id", materia_id)
        .eq("fecha", hoy);

      const presentes = new Set(asistenciasHoy?.map((a) => Number(a.alumno_id)) ?? []);
      const pendientes = inscritos?.filter((i) => !presentes.has(Number(i.alumno_id))) ?? [];

      if (pendientes.length > 0) {
        const ausentes = pendientes.map((p) => ({
          sesion_id: sesion.id,
          alumno_id: p.alumno_id,
          materia_id,
          fecha: hoy,
          estado: "no_asistio",
        }));
        await supabase.from("registros_asistencia").insert(ausentes);
      }

      await supabase
        .from("sesiones_asistencia")
        .update({ cerrada: true, fecha_expiracion: new Date().toISOString() })
        .eq("id", sesion.id);

      return res.json({ success: true, message: "Asistencia cerrada correctamente." });
    } catch (error) {
      console.error("[close-attendance] Error:", error);
      return res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
  });

  // ── Estudiante ────────────────────────────────────────────────────────────────

  // Materias y calificaciones del alumno
  app.get("/api/student/:id/subjects", authMiddleware, requireRole("student", "admin"), async (req, res) => {
    const studentId = req.params.id;

    try {
      const { data: inscripciones } = await supabase
        .from("inscripciones")
        .select(`
          materias (
            id, nrc, nombre, horario, salon, profesor_id,
            usuarios!materias_profesor_id_fkey (nombre)
          )
        `)
        .eq("alumno_id", studentId)
        .eq("estatus", "activo");

      if (!inscripciones) return res.json({ subjects: [] });

      const subjects = [];

      for (const i of inscripciones) {
        const mat = i.materias as any;

        const { data: ponds } = await supabase
          .from("ponderaciones")
          .select("*")
          .eq("materia_id", mat.id);

        const { data: califs } = await supabase
          .from("calificaciones")
          .select("*")
          .eq("alumno_id", studentId);

        const evaluaciones =
          ponds?.map((p: any) => {
            const calificacion = califs?.find(
              (c: any) => Number(c.ponderacion_id) === Number(p.id)
            );
            return {
              id: p.id,
              nombre: p.nombre,
              porcentajeTotal: p.porcentaje,
              porcentajeObtenido: calificacion ? Number(calificacion.puntaje) : 0,
            };
          }) ?? [];

        subjects.push({
          id: mat.id,
          nrc: mat.nrc,
          name: mat.nombre,
          schedule: mat.horario,
          classroom: mat.salon,
          professor_name: mat.usuarios?.nombre ?? "Sin asignar",
          evaluaciones,
        });
      }

      return res.json({ subjects });
    } catch {
      return res.status(500).json({ success: false, message: "Error al cargar las materias del estudiante." });
    }
  });

  // Activar materia con token
  // FIX: busca por token únicamente para cubrir el caso donde el alumno
  // no existía en la BD cuando el profesor lo agregó (alumno_id = null).
  app.post("/api/student/activate-subject", authMiddleware, requireRole("student", "admin"), async (req, res) => {
    try {
      const { studentId, token } = req.body;

      if (!studentId || !token) {
        return res.status(400).json({ success: false, message: "Faltan parámetros requeridos." });
      }

      const cleanToken = String(token).trim().toUpperCase();

      // Buscar solo por token, sin filtrar por alumno_id.
      // Ojo: si por cualquier razón existieran tokens duplicados, maybeSingle()
      // sin LIMIT puede regresar data=null con error de "multiple rows".
      const { data: inscripcion, error: insError } = await supabase
        .from("inscripciones")
        .select(`id, estatus, alumno_id, alumno_temp, token_acceso, materias(nombre)`)
        // Soporta tokens antiguos guardados en minúsculas (por si existieran).
        .in("token_acceso", [cleanToken, cleanToken.toLowerCase()])
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (insError) {
        console.error("[activate-subject] Error al buscar inscripción:", insError);
        return res.status(500).json({ success: false, message: "Error interno al validar el token." });
      }

      if (!inscripcion) {
        return res.status(404).json({ success: false, message: "Token inválido o ya fue utilizado." });
      }
      if (inscripcion.estatus === "activo") {
        return res.status(409).json({ success: false, message: "Esta materia ya está activada." });
      }
      if (!(inscripcion as any).token_acceso) {
        return res.status(404).json({ success: false, message: "Token inválido o ya fue utilizado." });
      }

      // Si la inscripción no tiene alumno_id (alumno no existía cuando el
      // profesor lo agregó), asignamos su id real en este momento.
      // También anulamos el token para marcarlo como consumido y evitar reuso.
      const updateData: any = { estatus: "activo", token_acceso: null };
      if (!inscripcion.alumno_id) {
        updateData.alumno_id = Number(studentId);
        updateData.alumno_temp = null;
      }

      const { error: updError } = await supabase.from("inscripciones").update(updateData).eq("id", inscripcion.id);
      if (updError) {
        console.error("[activate-subject] Error al activar inscripción:", updError);
        return res.status(500).json({ success: false, message: "Error interno al activar la materia." });
      }

      return res.json({
        success: true,
        message: "Materia activada correctamente.",
        subject: (inscripcion as any).materias,
      });
    } catch {
      return res.status(500).json({ success: false, message: "Error interno al activar la materia." });
    }
  });

  // Darse de baja
  app.post("/api/student/drop-subject", authMiddleware, requireRole("student", "admin"), async (req, res) => {
    const { studentId, subjectId } = req.body;

    if (!studentId || !subjectId) {
      return res.status(400).json({ success: false, message: "Faltan parámetros requeridos." });
    }

    const { error } = await supabase
      .from("inscripciones")
      .update({ estatus: "baja" })
      .eq("alumno_id", Number(studentId))
      .eq("materia_id", Number(subjectId));

    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, message: "Baja registrada correctamente." });
  });

  // Registrar asistencia por token (flujo legacy)
  app.post("/api/student/attend", authMiddleware, requireRole("student"), async (req, res) => {
    const { studentId, token } = req.body;

    const { data: session } = await supabase
      .from("sesiones_asistencia")
      .select("*")
      .eq("token", token)
      .single();

    if (!session || new Date(session.fecha_expiracion) < new Date()) {
      return res.status(400).json({ success: false, message: "Código inválido o expirado." });
    }

    await supabase
      .from("registros_asistencia")
      .upsert({ sesion_id: session.id, alumno_id: studentId, estado: "presente" });

    return res.json({ success: true, message: "Asistencia registrada." });
  });

  // ── Vite middleware ───────────────────────────────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve("dist")));
    app.get("*", (_req, res) => res.sendFile(path.resolve("dist", "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] Corriendo en http://localhost:${PORT}`);
  });
}

startServer();
