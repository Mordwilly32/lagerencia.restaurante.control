-- Tabla de movimientos del restaurante (ingresos/egresos)
create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tipo text not null check (tipo in ('ingreso','egreso')),
  concepto text not null,
  monto numeric(12,2) not null check (monto > 0),
  metodo_pago text,
  cliente_ip text
);

create index if not exists movimientos_created_at_idx on public.movimientos (created_at desc);

-- RLS activado y SIN políticas: nadie puede leer/escribir desde el cliente
-- con la anon key. Sólo la Edge Function (que usa la service role key)
-- puede acceder, y ésta valida la IP antes de cualquier operación.
alter table public.movimientos enable row level security;
