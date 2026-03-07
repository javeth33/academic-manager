// Archivo: src/db.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar las variables de entorno
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('¡Faltan las credenciales de Supabase en el archivo .env.local!');
}

// Creamos la conexión principal (el cliente) que usaremos en todo el proyecto
export const supabase = createClient(supabaseUrl, supabaseKey);

// Dejamos esta función vacía para que no rompa tu server.ts, 
// ¡porque las tablas ya las creamos manualmente en la nube!
export function initDb() {
  console.log('Conexión a Supabase inicializada correctamente 🚀');
}