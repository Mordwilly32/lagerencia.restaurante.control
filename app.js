(() => {
  const CFG = window.APP_CONFIG;
  const LS_AUTH = "rc_auth_v1";
  const LS_MOVES = "rc_moves_v1";
  const LS_SESSION = "rc_session_v1";

  const $ = (sel, root=document) => root.querySelector(sel);
  const fmt = n => new Intl.NumberFormat(CFG.LOCALE||"es-SV",{style:"currency",currency:CFG.CURRENCY||"USD"}).format(n||0);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const uid = () => Math.random().toString(36).slice(2)+Date.now().toString(36);

  async function sha256(text){
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  function loadJSON(k,d){ try{return JSON.parse(localStorage.getItem(k)) ?? d}catch{return d} }
  function saveJSON(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

  async function detectIP(){
    const tries = ["https://api.ipify.org?format=json","https://api64.ipify.org?format=json","https://ipwho.is/"];
    for(const u of tries){
      try{
        const r = await fetch(u);
        const j = await r.json();
        const ip = j.ip || j.query;
        if(ip) return ip;
      }catch{}
    }
    return null;
  }

  async function renderGate(){
    const app = $("#app");
    app.innerHTML = `
      <div class="gate">
        <div class="card">
          <span class="eyebrow">Acceso restringido</span>
          <h1 class="brand">${esc(CFG.RESTAURANT_NAME)}</h1>
          <p class="muted" style="margin:0 0 18px">Panel privado de gerencia · Control de precios e ingresos.</p>
          <div style="margin:0 0 16px">
            <span class="pill">Tu IP: <b id="myip" style="color:var(--text)">detectando…</b></span>
          </div>
          <label>Código de acceso</label>
          <input id="code" type="password" placeholder="••••••••••" autocomplete="off" />
          <div style="height:10px"></div>
          <button id="enter">Entrar</button>
          <div id="msg"></div>
          <hr class="div" />
          <details>
            <summary>Administración</summary>
            <div style="margin-top:12px">
              <label>Código maestro</label>
              <input id="admin" type="password" placeholder="Solo gerencia" autocomplete="off" />
              <div style="height:8px"></div>
              <button class="danger" id="reset">Borrar IPs autorizadas</button>
              <p class="muted" style="margin-top:8px">Esto libera los 3 cupos para que se puedan registrar nuevas IPs.</p>
            </div>
          </details>
        </div>
      </div>`;

    const ip = await detectIP();
    $("#myip").textContent = ip || "no detectada";

    const auth = loadJSON(LS_AUTH, {});
    if(ip && Object.values(auth).includes(ip)){
      saveJSON(LS_SESSION, ip);
      return renderApp(ip);
    }

    $("#enter").onclick = async () => {
      const msg = $("#msg"); msg.className=""; msg.textContent="";
      const code = $("#code").value.trim();
      if(!code){ msg.className="err"; msg.textContent="Ingresa un código."; return; }
      if(!ip){ msg.className="err"; msg.textContent="No se pudo detectar tu IP."; return; }

      const hash = await sha256(code);
      const validHashes = (CFG.ACCESS_CODES_HASH||[]).map(h=>h.toLowerCase());
      if(!validHashes.includes(hash)){ msg.className="err"; msg.textContent="Código inválido."; return; }

      const store = loadJSON(LS_AUTH, {});
      if(store[hash]){
        if(store[hash] === ip){
          saveJSON(LS_SESSION, ip);
          return renderApp(ip);
        }
        msg.className="err"; msg.textContent="Este código ya está vinculado a otra IP.";
        return;
      }
      if(Object.keys(store).length >= 3){
        msg.className="err"; msg.textContent="Sin cupos disponibles (3/3 IPs ya autorizadas).";
        return;
      }
      store[hash] = ip;
      saveJSON(LS_AUTH, store);
      saveJSON(LS_SESSION, ip);
      renderApp(ip);
    };

    $("#reset").onclick = async () => {
      const msg = $("#msg"); msg.className=""; msg.textContent="";
      const a = $("#admin").value.trim();
      if(!a){ msg.className="err"; msg.textContent="Ingresa el código maestro."; return; }
      const h = await sha256(a);
      if(h !== (CFG.ADMIN_RESET_HASH||"").toLowerCase()){ msg.className="err"; msg.textContent="Código maestro incorrecto."; return; }
      localStorage.removeItem(LS_AUTH);
      localStorage.removeItem(LS_SESSION);
      msg.className="ok"; msg.textContent="Listo. IPs autorizadas eliminadas.";
      $("#admin").value="";
    };
  }

  function renderApp(ip){
    const app = $("#app");
    const cats = [...new Set((CFG.MENU||[]).map(m=>m.cat))];
    const menuHTML = cats.map(cat => `
      <div class="menu-cat">${esc(cat)}</div>
      <div class="menu-grid">
        ${(CFG.MENU||[]).filter(m=>m.cat===cat).map(m=>`
          <button type="button" class="menu-item" data-nm="${esc(m.nombre)}" data-pr="${m.precio}">
            <span class="nm">${esc(m.nombre)}</span>
            <span class="pr">${fmt(m.precio)}</span>
          </button>
        `).join("")}
      </div>`).join("");

    app.innerHTML = `
      <div class="container">
        <div class="topbar">
          <div>
            <span class="eyebrow">Panel de Gerencia</span>
            <h1 class="brand" style="margin-top:4px">${esc(CFG.RESTAURANT_NAME)}</h1>
          </div>
          <div class="row" style="flex:0 0 auto">
            <span class="pill">IP · <b style="color:var(--text)">${esc(ip)}</b></span>
            <button class="ghost" id="logout" style="width:auto">Salir</button>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi"><span>Ingresos</span><b id="kIn">$0</b></div>
          <div class="kpi"><span>Egresos</span><b id="kOut">$0</b></div>
          <div class="kpi"><span>Balance</span><b id="kBal">$0</b></div>
        </div>

        <div class="card" style="margin-bottom:18px">
          <h3>Nuevo movimiento</h3>
          <div class="row">
            <div>
              <label>Tipo</label>
              <select id="tipo">
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
              </select>
            </div>
            <div>
              <label>Concepto</label>
              <input id="concepto" placeholder="Ej. Mesa 5" />
            </div>
            <div>
              <label>Monto</label>
              <input id="monto" type="number" step="0.01" min="0" placeholder="0.00" />
            </div>
            <div>
              <label>Método de pago</label>
              <select id="metodo">
                <option>Efectivo</option><option>Tarjeta</option>
                <option>Transferencia</option><option>Otro</option>
              </select>
            </div>
          </div>
          <div style="height:12px"></div>
          <button id="add">Agregar movimiento</button>
          <div id="addMsg"></div>

          <hr class="div" />
          <span class="eyebrow">Carta — clic para sumar al monto</span>
          ${menuHTML}
        </div>

        <div class="card">
          <div class="topbar" style="margin:0 0 8px;padding:0;border:0">
            <h3 style="margin:0">Movimientos</h3>
            <div class="row" style="flex:0 0 auto">
              <button class="ghost" id="export" style="width:auto">Exportar CSV</button>
              <button class="danger" id="clearAll" style="width:auto">Borrar todo</button>
            </div>
          </div>
          <div style="overflow:auto">
            <table>
              <thead><tr>
                <th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Método</th>
                <th style="text-align:right">Monto</th><th>IP</th><th></th>
              </tr></thead>
              <tbody id="tbody"></tbody>
            </table>
          </div>
        </div>
      </div>`;

    document.querySelectorAll(".menu-item").forEach(b => b.onclick = () => {
      const nm = b.getAttribute("data-nm");
      const pr = parseFloat(b.getAttribute("data-pr"))||0;
      const c = $("#concepto");
      c.value = c.value ? `${c.value} + ${nm}` : nm;
      const m = $("#monto");
      m.value = ((parseFloat(m.value)||0) + pr).toFixed(2);
      $("#tipo").value = "ingreso";
    });

    $("#logout").onclick = () => { localStorage.removeItem(LS_SESSION); renderGate(); };
    $("#add").onclick = () => {
      const m = {
        id: uid(),
        fecha: new Date().toISOString(),
        tipo: $("#tipo").value,
        concepto: $("#concepto").value.trim().slice(0,200),
        monto: Number($("#monto").value),
        metodo: $("#metodo").value,
        ip
      };
      const msg = $("#addMsg"); msg.className=""; msg.textContent="";
      if(!m.concepto){ msg.className="err"; msg.textContent="Falta el concepto."; return; }
      if(!(m.monto>0)){ msg.className="err"; msg.textContent="Monto inválido."; return; }
      const list = loadJSON(LS_MOVES, []);
      list.unshift(m);
      saveJSON(LS_MOVES, list);
      $("#concepto").value=""; $("#monto").value="";
      msg.className="ok"; msg.textContent="Movimiento guardado.";
      renderTable();
    };
    $("#clearAll").onclick = () => {
      if(confirm("¿Borrar TODOS los movimientos? Esta acción no se puede deshacer.")){
        localStorage.removeItem(LS_MOVES); renderTable();
      }
    };
    $("#export").onclick = () => {
      const list = loadJSON(LS_MOVES, []);
      const head = ["fecha","tipo","concepto","metodo","monto","ip"];
      const rows = [head.join(",")].concat(list.map(m =>
        head.map(k => `"${String(m[k]??"").replace(/"/g,'""')}"`).join(",")
      ));
      const blob = new Blob([rows.join("\n")], {type:"text/csv;charset=utf-8"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `movimientos-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
    };

    function renderTable(){
      const list = loadJSON(LS_MOVES, []);
      let inSum=0,outSum=0;
      list.forEach(m => m.tipo==="ingreso" ? inSum+=+m.monto : outSum+=+m.monto);
      $("#kIn").textContent = fmt(inSum);
      $("#kOut").textContent = fmt(outSum);
      $("#kBal").textContent = fmt(inSum-outSum);
      $("#tbody").innerHTML = list.map(m => `
        <tr>
          <td>${new Date(m.fecha).toLocaleString(CFG.LOCALE||"es-SV")}</td>
          <td><span class="badge ${m.tipo==='ingreso'?'in':'out'}">${m.tipo}</span></td>
          <td>${esc(m.concepto)}</td>
          <td>${esc(m.metodo)}</td>
          <td style="text-align:right">${fmt(m.monto)}</td>
          <td class="muted">${esc(m.ip||"")}</td>
          <td><button class="ghost" data-del="${m.id}" style="width:auto">Borrar</button></td>
        </tr>`).join("") || `<tr><td colspan="7" class="muted">Sin movimientos todavía.</td></tr>`;
      document.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
        const id = b.getAttribute("data-del");
        const list = loadJSON(LS_MOVES, []).filter(x => x.id!==id);
        saveJSON(LS_MOVES, list); renderTable();
      });
    }
    renderTable();
  }

  renderGate();
})();
