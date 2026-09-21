const SUPABASE_URL = "https://zmanwspxuqwviyzpxtan.supabase.co";
const SUPABASE_KEY = "sb_publishable_geEnhhRNhJ8V7AuM_qSe6g_GEYvW_h_";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let map, markersLayer, markerA = null, markerB = null;
let currentUser = null;
let paquetesSeleccionados = [];
let rutaEstaOptimizada = false;
let modoSeleccionPunto = null; // 'A' o 'B'

const selectHR = document.getElementById("select-hr");
const selectSub = document.getElementById("select-sub");
const inputInicio = document.getElementById("input-inicio");
const inputFin = document.getElementById("input-fin");

const btnBuscarInicio = document.getElementById("btn-buscar-inicio");
const btnBuscarFin = document.getElementById("btn-buscar-fin");
const btnModoMapaA = document.getElementById("btn-modo-mapa-a");
const btnModoMapaB = document.getElementById("btn-modo-mapa-b");

const btnOptimizar = document.getElementById("btn-optimizar");
const btnExportar = document.getElementById("btn-exportar");
const tablaBody = document.querySelector("#tabla-ordenada tbody");

const kpiTotal = document.getElementById("kpi-total");
const kpiEntregados = document.getElementById("kpi-entregados");
const kpiPendientes = document.getElementById("kpi-pendientes");
const kpiNoEntregados = document.getElementById("kpi-no-entregados");

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return alert("Inicia sesion en la pantalla principal primero.");
  currentUser = session.user;

  initMap();
  cargarHojasDeRuta();
}

function initMap() {
  map = L.map('map').setView([-34.64, -58.56], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);

  actualizarMarcadorAB('A', parseLatAndLng(inputInicio.value));
  actualizarMarcadorAB('B', parseLatAndLng(inputFin.value));

  map.on('click', (e) => {
    let latlng = [e.latlng.lat, e.latlng.lng];
    let latlngStr = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;

    if (modoSeleccionPunto === 'A') {
      inputInicio.value = latlngStr;
      actualizarMarcadorAB('A', latlng);
      desactivarModosSeleccion();
    } else if (modoSeleccionPunto === 'B') {
      inputFin.value = latlngStr;
      actualizarMarcadorAB('B', latlng);
      desactivarModosSeleccion();
    }
  });
}

function parseLatAndLng(str) {
  if (!str) return null;
  let parts = str.split(',').map(n => parseFloat(n.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts;
  }
  return null;
}

function actualizarMarcadorAB(tipo, latlng) {
  if (!latlng) return;

  const colorBg = tipo === 'A' ? '#2563eb' : '#ef4444';
  const iconHtml = `<div style="background:${colorBg}; color:white; border:2px solid white; border-radius:50%; width:28px; height:28px; text-align:center; line-height:24px; font-weight:bold; font-size:14px; box-shadow:0 2px 6px rgba(0,0,0,0.5);">${tipo}</div>`;
  const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [28, 28], iconAnchor: [14, 14] });

  if (tipo === 'A') {
    if (markerA) map.removeLayer(markerA);
    markerA = L.marker(latlng, { icon: icon }).addTo(map).bindPopup("<b>Punto A (Carga)</b>");
  } else {
    if (markerB) map.removeLayer(markerB);
    markerB = L.marker(latlng, { icon: icon }).addTo(map).bindPopup("<b>Punto B (Destino Final)</b>");
  }
}

async function buscarDireccion(inputEl, tipo) {
  let val = inputEl.value.trim();
  if (!val) return;

  let latlng = parseLatAndLng(val);
  if (latlng) {
    actualizarMarcadorAB(tipo, latlng);
    map.setView(latlng, 14);
    return;
  }

  try {
    let resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val + ", Buenos Aires, Argentina")}`);
    let data = await resp.json();
    if (data && data.length > 0) {
      let resLatlng = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      inputEl.value = `${resLatlng[0].toFixed(5)}, ${resLatlng[1].toFixed(5)}`;
      actualizarMarcadorAB(tipo, resLatlng);
      map.setView(resLatlng, 14);
    } else {
      alert("No se encontro la direccion especificada.");
    }
  } catch (err) {
    alert("Error al buscar la direccion.");
  }
}

btnBuscarInicio.addEventListener("click", () => buscarDireccion(inputInicio, 'A'));
btnBuscarFin.addEventListener("click", () => buscarDireccion(inputFin, 'B'));

btnModoMapaA.addEventListener("click", () => {
  modoSeleccionPunto = modoSeleccionPunto === 'A' ? null : 'A';
  btnModoMapaA.classList.toggle("active", modoSeleccionPunto === 'A');
  btnModoMapaB.classList.remove("active");
});

btnModoMapaB.addEventListener("click", () => {
  modoSeleccionPunto = modoSeleccionPunto === 'B' ? null : 'B';
  btnModoMapaB.classList.toggle("active", modoSeleccionPunto === 'B');
  btnModoMapaA.classList.remove("active");
});

function desactivarModosSeleccion() {
  modoSeleccionPunto = null;
  btnModoMapaA.classList.remove("active");
  btnModoMapaB.classList.remove("active");
}

async function cargarHojasDeRuta() {
  const { data } = await supabaseClient.from("paquetes").select("nombre_ruta").eq("user_id", currentUser.id);
  const rutas = [...new Set(data.map(d => d.nombre_ruta))];

  selectHR.innerHTML = '<option value="">-- Seleccionar --</option>';
  rutas.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r; opt.textContent = r;
    selectHR.appendChild(opt);
  });
}

selectHR.addEventListener("change", async () => {
  const hr = selectHR.value;
  if (!hr) return;

  const { data } = await supabaseClient.from("paquetes").select("entrega_sub").eq("user_id", currentUser.id).eq("nombre_ruta", hr);
  const subs = [...new Set(data.map(d => d.entrega_sub).filter(s => s !== 'Sin Asignar'))];

  selectSub.innerHTML = '<option value="">-- Seleccionar --</option>';
  subs.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s; opt.textContent = `Entrega: ${s}`;
    selectSub.appendChild(opt);
  });
});

selectSub.addEventListener("change", async () => {
  recargarDatosSubEntrega();
});

async function recargarDatosSubEntrega() {
  const hr = selectHR.value;
  const sub = selectSub.value;
  if (!hr || !sub) return;

  const { data } = await supabaseClient
    .from("paquetes")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("nombre_ruta", hr)
    .eq("entrega_sub", sub)
    .order("id", { ascending: true });

  paquetesSeleccionados = data.map((p, idx) => ({
    ...p,
    num_paquete_calculado: p.numero_paquete || (idx + 1)
  }));

  renderMapaYTabla(paquetesSeleccionados, rutaEstaOptimizada);
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

btnOptimizar.addEventListener("click", async () => {
  if (paquetesSeleccionados.length === 0) return alert("Selecciona una HR y una Entrega.");

  const startCoords = parseLatAndLng(inputInicio.value);
  if (!startCoords) return alert("Ingresa o marca un punto de inicio (A) valido.");

  let noVisitados = [...paquetesSeleccionados];
  let rutaOptimizada = [];
  let puntoActual = { lat: startCoords[0], lng: startCoords[1] };

  while (noVisitados.length > 0) {
    let indiceMasCercano = 0;
    let menorDistancia = Infinity;

    for (let i = 0; i < noVisitados.length; i++) {
      let d = calcularDistancia(puntoActual.lat, puntoActual.lng, noVisitados[i].lat, noVisitados[i].lng);
      if (d < menorDistancia) {
        menorDistancia = d;
        indiceMasCercano = i;
      }
    }

    let paqueteVisita = noVisitados.splice(indiceMasCercano, 1)[0];
    rutaOptimizada.push(paqueteVisita);
    puntoActual = { lat: paqueteVisita.lat, lng: paqueteVisita.lng };
  }

  for (let idx = 0; idx < rutaOptimizada.length; idx++) {
    let item = rutaOptimizada[idx];
    item.orden_visita = idx + 1;
    await supabaseClient.from("paquetes").update({ 
      orden_visita: item.orden_visita,
      numero_paquete: item.num_paquete_calculado
    }).eq("id", item.id);
  }

  paquetesSeleccionados = rutaOptimizada;
  rutaEstaOptimizada = true;
  renderMapaYTabla(paquetesSeleccionados, true);
  alert("Ruta optimizada correctamente.");
});

// EXPORTACION A EXCEL CORREGIDA
btnExportar.addEventListener("click", () => {
  if (typeof XLSX === 'undefined') {
    return alert("Error: La libreria XLSX no se cargo correctamente.");
  }

  if (paquetesSeleccionados.length === 0) {
    return alert("No hay datos para exportar. Selecciona una HR y Sub-Entrega.");
  }

  const datosExportar = paquetesSeleccionados.map(p => ({
    "Orden Visita": p.orden_visita || "-",
    "N° Paquete CSV": p.num_paquete_calculado || p.numero_paquete || "-",
    "Hoja de Ruta": p.nombre_ruta || "",
    "Sub Entrega": p.entrega_sub || "",
    "Referencia (CK)": p.referencia || "",
    "Destinatario": p.destinatario || "",
    "Ciudad": p.ciudad || "",
    "CP": p.codigo_postal || "",
    "Telefono": p.telefono || "",
    "Estado": p.estado || "Pendiente",
    "Receptor / Obs": p.nombre_receptor ? `${p.nombre_receptor} (${p.documento_receptor || 'S/D'})` : (p.observacion || '-'),
    "URL Foto": p.foto_url || "-"
  }));

  const worksheet = XLSX.utils.json_to_sheet(datosExportar);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ruta Ordenada");

  const hrNombre = selectHR.value || "Ruta";
  const subNombre = selectSub.value || "General";
  XLSX.writeFile(workbook, `Recorrido_${hrNombre}_${subNombre}.xlsx`);
});

function renderMapaYTabla(paquetes, optimizada = false) {
  markersLayer.clearLayers();
  tablaBody.innerHTML = "";
  let bounds = [];

  let total = paquetes.length;
  let entregados = 0;
  let pendientes = 0;
  let noEntregados = 0;

  paquetes.forEach((p) => {
    let estado = p.estado || 'Pendiente';
    if (estado === 'Entregado') entregados++;
    else if (estado === 'Pendiente') pendientes++;
    else noEntregados++;

    let numPqte = p.num_paquete_calculado || p.numero_paquete || '-';
    let ordenVisitaTexto = (optimizada || p.orden_visita) ? `#${p.orden_visita}` : 'Pendiente';
    let etiquetaIcono = (optimizada || p.orden_visita) ? `#${p.orden_visita}` : `${numPqte}`;

    let customIcon = L.divIcon({
      className: 'custom-number-icon',
      html: etiquetaIcono.toString(),
      iconSize: [24, 24]
    });

    let m = L.marker([p.lat, p.lng], { icon: customIcon }).bindPopup(
      `<b>Orden de Visita:</b> ${ordenVisitaTexto}<br>` +
      `<b>Paquete CSV:</b> Paquete ${numPqte}<br>` +
      `<b>CK:</b> ${p.referencia || '-'}<br>` +
      `<b>Estado:</b> ${estado}<br>` +
      `<b>Destino:</b> ${p.destinatario || ''}`
    );

    markersLayer.addLayer(m);
    bounds.push([p.lat, p.lng]);

    let claseEstado = 'st-pendiente';
    if (estado === 'Entregado') claseEstado = 'st-entregado';
    else if (estado === 'No Estaba') claseEstado = 'st-ausente';
    else if (estado === 'Rechazado') claseEstado = 'st-rechazado';

    let receptorInfo = p.nombre_receptor ? `${p.nombre_receptor} (${p.documento_receptor || 'S/D'})` : (p.observacion || '-');
    let fotoBtn = p.foto_url ? `<a href="${p.foto_url}" target="_blank" class="btn-foto">Ver Foto</a>` : '-';

    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge-orden">${ordenVisitaTexto}</span></td>
      <td><span class="badge-paquete">Paquete ${numPqte}</span></td>
      <td><b>${p.referencia || '-'}</b></td>
      <td>${p.destinatario || '-'}</td>
      <td><span class="badge-estado ${claseEstado}">${estado}</span></td>
      <td>${receptorInfo}</td>
      <td>${fotoBtn}</td>
    `;
    tablaBody.appendChild(tr);
  });

  kpiTotal.textContent = total;
  kpiEntregados.textContent = entregados;
  kpiPendientes.textContent = pendientes;
  kpiNoEntregados.textContent = noEntregados;

  if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40] });
}

init();