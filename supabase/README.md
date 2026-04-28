# Supabase setup

1. Crea un proyecto en Supabase.
2. Abre `SQL Editor`.
3. Ejecuta completo el archivo `supabase/schema.sql`.
4. En `Project Settings > API`, copia:
   - Project URL
   - anon public key
5. En Vercel, agrega estas variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Redeploy del proyecto en Vercel.

La fase 1 usa políticas abiertas para que el equipo pueda consultar y guardar sin login.
Para producción con usuarios reales, el siguiente paso es agregar autenticación y roles.
