// Configuración de conexión con Supabase.
// La clave publicable (publishable / anon key) es pública por diseño: la seguridad está en las reglas de la base de datos (RLS).
// NUNCA escriba aquí la "service_role" ni la "secret key".
// Si se deja vacío, el aplicativo funciona en modo demostración (datos ficticios en el navegador).
// Las variables SUPABASE_URL / SUPABASE_ANON_KEY del repositorio, si existen, reemplazan estos valores al publicar.
window.LPSGT_CONFIG = {
  supabaseUrl: 'https://nyvtpmydrsaofjmfwdia.supabase.co',
  supabaseAnonKey: 'sb_publishable_AZOv5GLDgYDieYD3DTnneA_gTmwmATx',
};
