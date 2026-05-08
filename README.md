# 🍽️ Control de Ingresos · Restaurante

Panel privado para la gerencia de un restaurante. Permite registrar **ingresos y egresos** de cada movimiento, ver totales y mantener un historial. El acceso está restringido a una **lista blanca de IPs** validada en el servidor, y los datos se guardan en **Supabase** (no usa Lovable Cloud).

## ✨ Características

- Detección de la **IP pública** del usuario al entrar (visible en pantalla).
- **Validación real en el servidor** (Supabase Edge Function) contra una lista de IPs autorizadas.
- Almacenamiento de movimientos en Supabase con **RLS activo y sin políticas públicas** (sólo la Edge Function con `service_role` accede).
- Cada registro guarda la IP de origen para **auditoría**.
- UI oscura, simple y responsive.

## 🔐 Modelo de seguridad

- La IP que muestra el frontend es **sólo informativa** (servicio externo `ipify`).
- La autorización real se hace **en el servidor**, leyendo `x-forwarded-for` dentro de la Edge Function.
- La tabla `movimientos` tiene **RLS habilitado sin políticas**, así que la `anon key` pública **no puede leer ni escribir nada**. Toda operación pasa por la Edge Function que valida IP antes de tocar la base.
- Si la lista `ALLOWED_IPS` está vacía, **nadie pasa** (fail-closed).

> ⚠️ Una IP pública puede ser falsificada si tu hosting está mal configurado. Para mayor seguridad combina IP allowlist con autenticación Supabase (email/password) – ver sección "Mejoras".

---

## 🚀 Puesta en marcha

### 1. Crear proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) y crea un proyecto nuevo.
2. Copia **Project URL** y **anon public key** desde *Project Settings → API*.

### 2. Configurar el frontend
```bash
cp .env.example .env
# Edita .env con tus valores VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

### 3. Crear la tabla
Pega el contenido de `supabase/migrations/0001_init.sql` en el **SQL Editor** de Supabase y ejecútalo.

### 4. Desplegar la Edge Function
Instala el [Supabase CLI](https://supabase.com/docs/guides/cli) y luego:

```bash
supabase login
supabase link --project-ref TU-PROJECT-REF

# Configurar las IPs permitidas (separadas por coma, SIN espacios extra)
supabase secrets set ALLOWED_IPS="123.45.67.89,200.10.20.30"

# Desplegar la función
supabase functions deploy movimientos --no-verify-jwt
```

> Para conocer tu IP pública actual y añadirla: `curl https://api.ipify.org`

### 5. Actualizar la lista de IPs permitidas
En cualquier momento, vuelve a ejecutar:
```bash
supabase secrets set ALLOWED_IPS="ip1,ip2,ip3"
```
No necesitas redeployar la función: los secrets se aplican al instante.

---

## 📦 Subir a GitHub

```bash
git init
git add .
git commit -m "feat: control de ingresos para restaurante"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

El archivo `.env` está en `.gitignore`, así que tus claves no se subirán.

---

## 🧱 Estructura

```
.
├── src/
│   ├── App.tsx              # UI principal (gate de IP + dashboard)
│   ├── lib/
│   │   ├── supabase.ts      # Cliente público (anon)
│   │   └── ip.ts            # Detección de IP para mostrar
│   ├── styles.css
│   └── main.tsx
├── supabase/
│   ├── functions/movimientos/index.ts   # Edge Function (validación IP + CRUD)
│   └── migrations/0001_init.sql         # Tabla movimientos + RLS
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 🔧 Mejoras sugeridas
- Añadir login Supabase Auth además de la lista de IPs.
- Filtros por fecha y exportación CSV.
- Vincular cada movimiento al ítem del menú.
- Roles (cajero / gerente).

## 📄 Licencia
MIT
