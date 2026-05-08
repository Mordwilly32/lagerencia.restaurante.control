import { useEffect, useState } from "react";
import { detectPublicIp } from "./lib/ip";
import { supabase } from "./lib/supabase";

type Movimiento = {
  id: string;
  created_at: string;
  tipo: "ingreso" | "egreso";
  concepto: string;
  monto: number;
  metodo_pago: string | null;
  cliente_ip: string | null;
};

export default function App() {
  const [ip, setIp] = useState<string>("...");
  const [verificando, setVerificando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [errorAuth, setErrorAuth] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const detectada = await detectPublicIp();
      setIp(detectada);
      // Validación REAL en el servidor: la Edge Function ve la IP por headers.
      try {
        const { data, error } = await supabase.functions.invoke("movimientos", {
          body: { action: "ping" },
        });
        if (error) throw error;
        if (data?.ok) setAutorizado(true);
        else setErrorAuth(data?.error ?? "Acceso denegado");
      } catch (e: any) {
        setErrorAuth(e?.message ?? "No se pudo verificar el acceso");
      } finally {
        setVerificando(false);
      }
    })();
  }, []);

  if (verificando) {
    return (
      <div className="center">
        <div className="lock">
          <h1>Verificando acceso…</h1>
          <p className="muted">Tu IP pública: <b>{ip}</b></p>
        </div>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="center">
        <div className="lock card">
          <h1>🔒 Acceso restringido</h1>
          <p className="muted">
            Esta aplicación solo está disponible desde IPs autorizadas por la gerencia.
          </p>
          <p className="ip-pill" style={{ display: "inline-block", marginTop: 12 }}>
            Tu IP: <b>{ip}</b>
          </p>
          {errorAuth && <div className="error">{errorAuth}</div>}
          <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
            Si necesitas acceso, comparte tu IP con el administrador para que la añada a la lista permitida.
          </p>
        </div>
      </div>
    );
  }

  return <Dashboard ip={ip} />;
}

function Dashboard({ ip }: { ip: string }) {
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tipo, setTipo] = useState<"ingreso" | "egreso">("ingreso");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const { data, error } = await supabase.functions.invoke("movimientos", {
      body: { action: "list" },
    });
    if (error) setError(error.message);
    else setMovs(data?.movimientos ?? []);
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const m = parseFloat(monto);
    if (!concepto.trim() || isNaN(m) || m <= 0) {
      setError("Concepto y monto válido son obligatorios");
      return;
    }
    const { data, error } = await supabase.functions.invoke("movimientos", {
      body: { action: "create", tipo, concepto: concepto.trim(), monto: m, metodo_pago: metodo },
    });
    if (error || !data?.ok) {
      setError(error?.message ?? data?.error ?? "Error al guardar");
      return;
    }
    setConcepto(""); setMonto("");
    cargar();
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este movimiento?")) return;
    const { data, error } = await supabase.functions.invoke("movimientos", {
      body: { action: "delete", id },
    });
    if (error || !data?.ok) { alert(error?.message ?? data?.error); return; }
    cargar();
  }

  const totalIn = movs.filter(m => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0);
  const totalOut = movs.filter(m => m.tipo === "egreso").reduce((s, m) => s + Number(m.monto), 0);
  const balance = totalIn - totalOut;

  return (
    <div className="container">
      <header className="header">
        <div className="brand">🍽️ <span>Control de Ingresos</span></div>
        <div className="ip-pill">IP: <b>{ip}</b></div>
      </header>

      <div className="grid cols-3">
        <div className="kpi"><div className="label">Ingresos totales</div><div className="value green">${totalIn.toFixed(2)}</div></div>
        <div className="kpi"><div className="label">Egresos totales</div><div className="value red">${totalOut.toFixed(2)}</div></div>
        <div className="kpi"><div className="label">Balance</div><div className="value">${balance.toFixed(2)}</div></div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Movimientos</h3>
          {cargando ? <p className="muted">Cargando…</p> : (
            <table>
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Método</th><th style={{textAlign:"right"}}>Monto</th><th></th></tr></thead>
              <tbody>
                {movs.length === 0 && <tr><td colSpan={6} className="muted" style={{textAlign:"center", padding: 20}}>Sin movimientos aún</td></tr>}
                {movs.map(m => (
                  <tr key={m.id}>
                    <td>{new Date(m.created_at).toLocaleString()}</td>
                    <td><span className={`badge ${m.tipo === "ingreso" ? "in" : "out"}`}>{m.tipo}</span></td>
                    <td>{m.concepto}</td>
                    <td>{m.metodo_pago ?? "-"}</td>
                    <td style={{textAlign:"right"}}>${Number(m.monto).toFixed(2)}</td>
                    <td><button className="ghost" onClick={() => eliminar(m.id)}>🗑️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Nuevo movimiento</h3>
          <form onSubmit={agregar} style={{ display: "grid", gap: 10 }}>
            <select value={tipo} onChange={e => setTipo(e.target.value as any)}>
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </select>
            <input placeholder="Concepto (ej: Mesa 4 - Pasta)" value={concepto} onChange={e => setConcepto(e.target.value)} maxLength={200} />
            <input placeholder="Monto" type="number" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} />
            <select value={metodo} onChange={e => setMetodo(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
              <option value="otro">Otro</option>
            </select>
            <button className="primary" type="submit">Registrar</button>
            {error && <div className="error">{error}</div>}
          </form>
        </div>
      </div>

      <p className="muted" style={{ textAlign: "center", marginTop: 24, fontSize: 12 }}>
        Todo movimiento queda registrado con la IP de origen para auditoría.
      </p>
    </div>
  );
}
