// Detecta la IP pública del visitante usando un servicio externo gratuito.
// Se usa SOLO para mostrarla en pantalla. La validación real se hace en
// el servidor (Edge Function) leyendo la IP de los headers de la request.
export async function detectPublicIp(): Promise<string> {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const j = await r.json();
    return j.ip as string;
  } catch {
    try {
      const r = await fetch("https://ipv4.icanhazip.com");
      return (await r.text()).trim();
    } catch {
      return "desconocida";
    }
  }
}
