// Archivo: src/db.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar las variables de entorno
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
// En el backend conviene usar la Service Role Key para evitar bloqueos por RLS
// (p. ej. deletes que "aparentan" funcionar pero no impactan BD).
// Si no está disponible, usamos SUPABASE_KEY como fallback.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('¡Faltan SUPABASE_URL y SUPABASE_KEY (o SUPABASE_SERVICE_ROLE_KEY) en el .env.local!');
}

// Creamos la conexión principal (el cliente) que usaremos en todo el proyecto
export const supabase = createClient(supabaseUrl, supabaseKey);

// Dejamos esta función vacía para que no rompa tu server.ts, 
// ¡porque las tablas ya las creamos manualmente en la nube!
export function initDb() {
  console.log('Conexión a Supabase inicializada correctamente 🚀');
}