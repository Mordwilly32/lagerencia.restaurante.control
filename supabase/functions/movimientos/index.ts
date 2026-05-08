// Edge Function: movimientos
// Valida la IP del cliente (vía headers, lado servidor) contra la lista
// permitida que se configura en variables de entorno del proyecto Supabase.
//
// Variables de entorno requeridas (en Supabase > Project Settings > Edge Functions):
//   ALLOWED_IPS = "1.2.3.4,5.6.7.8"   (separadas por coma)
//   SUPABASE_URL                       (auto)
//   SUPABASE_SERVICE_ROLE_KEY          (auto)
//
// Despliegue:
//   supabase functions deploy movimientos --no-verify-jwt
//   supabase secrets set ALLOWED_IPS="1.2.3.4,5.6.7.8"

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "";
}

function isAllowed(ip: string): boolean {
  const list = (Deno.env.get("ALLOWED_IPS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return false; // por seguridad: vacío = nadie pasa
  return list.includes(ip);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

  const ip = getClientIp(req);
  if (!isAllowed(ip)) {
    return json({ ok: false, error: `IP ${ip || "desconocida"} no autorizada` }, 403);
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* body opcional */ }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const action = body.action ?? "ping";

  if (action === "ping") return json({ ok: true, ip });

  if (action === "list") {
    const { data, error } = await supabase
      .from("movimientos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, movimientos: data });
  }

  if (action === "create") {
    const tipo = body.tipo;
    const concepto = String(body.concepto ?? "").slice(0, 200);
    const monto = Number(body.monto);
    const metodo_pago = body.metodo_pago ? String(body.metodo_pago).slice(0, 50) : null;

    if (!["ingreso", "egreso"].includes(tipo)) return json({ ok: false, error: "Tipo inválido" }, 400);
    if (!concepto.trim()) return json({ ok: false, error: "Concepto requerido" }, 400);
    if (!isFinite(monto) || monto <= 0) return json({ ok: false, error: "Monto inválido" }, 400);

    const { data, error } = await supabase
      .from("movimientos")
      .insert({ tipo, concepto, monto, metodo_pago, cliente_ip: ip })
      .select()
      .single();
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, movimiento: data });
  }

  if (action === "delete") {
    const id = String(body.id ?? "");
    if (!id) return json({ ok: false, error: "id requerido" }, 400);
    const { error } = await supabase.from("movimientos").delete().eq("id", id);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ ok: false, error: "Acción desconocida" }, 400);
});
