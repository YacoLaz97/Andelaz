// ==========================================
// 1. CONFIGURACIÓN Y CONEXIÓN SUPABASE
// ==========================================
const SUPABASE_URL = "https://zmanwspxuqwviyzpxtan.supabase.co";
const SUPABASE_KEY = "sb_publishable_geEnhhRNhJ8V7AuM_qSe6g_GEYvW_h_";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabaseClient = supabaseClient;

// Variable global para almacenar el empresa_id del usuario logueado
let empresaIdGlobal = null;

// Paleta de colores para el mapa
const PALETA_COLORES = [
  '#ef4444', '#2563eb', '#f59e0b', '#8b5cf6', '#ec4899', 
  '#06b6d4', '#10b981', '#f97316', '#6366f1', '#84cc16', '#d946ef', '#0284c7'
];

function getColorParaEntrega(nombreSub) {
  if (!nombreSub || nombreSub === 'Sin Asignar') {
    return '#94a3b8';
  }
  let hash = 0;
  for (let i = 0; i < nombreSub.length; i++) {
    hash = nombreSub.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETA_COLORES[Math.abs(hash) % PALETA_COLORES.length];
}

// ==========================================
// 2. ELEMENTOS DEL DOM Y VARIABLES GLOBALES
// ==========================================
const nombreRutaInput = document.getElementById("nombre-ruta-input");
const csvInput = document.getElementById("csv-file");
const btnProcesar = document.getElementById("btn-procesar");
const selectRutas = document.getElementById("select-rutas");
const btnEliminarRuta = document.getElementById("btn-eliminar-ruta");

const tablaBody = document.querySelector("#tabla-paquetes tbody");
const btnExportar = document.getElementById("btn-exportar");
const txtPuntosSel = document.getElementById("txt-puntos-seleccionados");
const inputNombreSub = document.getElementById("input-nombre-sub");
const btnConfirmarSub = document.getElementById("btn-confirmar-sub");
const btnCancelarSub = document.getElementById("btn-cancelar-sub");

const selectSubExistentes = document.getElementById("select-sub-existentes");
const btnCargarSub = document.getElementById("btn-cargar-sub");
const btnDesasignarSub = document.getElementById("btn-desasignar-sub");

const btnModoSumar = document.getElementById("btn-modo-sumar");
const btnModoRestar = document.getElementById("btn-modo-restar");

let paquetesRutaActual = [];
let map, markersLayer, drawnItemsGroup;
let puntosSeleccionadosIds = [];
let modoSeleccion = 'SUMAR';

// ==========================================
// 3. CONTROL DE SESIÓN Y OBTENCIÓN DE EMPRESA_ID
// ==========================================

async function validarSesionYObtenerEmpresa() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (!session) {
    window.location.replace("index.html");
    return false;
  }

  // 1. Consultar la tabla 'usuarios' según el email activo
  const { data: datosUsuario, error } = await supabaseClient
    .from("usuarios")
    .select("nombre, rol, empresa_id")
    .eq("email", session.user.email)
    .maybeSingle();

  if (error || !datosUsuario || !datosUsuario.empresa_id) {
    alert("No se pudo identificar la empresa asociada al usuario.");
    await supabaseClient.auth.signOut();
    window.location.replace("index.html");
    return false;
  }

  empresaIdGlobal = datosUsuario.empresa_id;

  // 2. Consultar la tabla 'empresas' (en plural)
  let nombreEmpresa = "Sin Empresa";
  const { data: datosEmpresa, error: errEmpresa } = await supabaseClient
    .from("empresas") // Tabla corregida a plural
    .select("*")
    .eq("id", datosUsuario.empresa_id)
    .maybeSingle();

  if (datosEmpresa) {
    // Busca el nombre según como hayas nombrado la columna (nombre, nombre_empresa o razon_social)
    nombreEmpresa = datosEmpresa.nombre || datosEmpresa.nombre_empresa || datosEmpresa.razon_social || "Sin Nombre";
  } else if (errEmpresa) {
    console.error("Error consultando la tabla empresas:", errEmpresa.message);
  }

  // 3. Renderizar los datos en la tarjeta del menú lateral
  const elEmpresa = document.getElementById("user-card-empresa");
  const elNombre = document.getElementById("user-card-nombre");
  const elRol = document.getElementById("user-card-rol");

  if (elEmpresa) elEmpresa.textContent = nombreEmpresa;
  if (elNombre) elNombre.textContent = datosUsuario.nombre || "N/A";
  if (elRol) elRol.textContent = datosUsuario.rol || "N/A";

  return true;
}

// Validación activa al entrar o retroceder en el navegador
window.addEventListener("pageshow", async () => {
  const sesionValida = await validarSesionYObtenerEmpresa();
  if (sesionValida && selectRutas) {
    cargarListaDeRutas();
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const sesionValida = await validarSesionYObtenerEmpresa();
  if (!sesionValida) return;

  // B. CONTROL DEL BOTÓN DE CERRAR SESIÓN
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      
      // Cerrar sesión en Supabase y limpiar memoria local
      await supabaseClient.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      
      // Reemplazar la URL por index.html impidiendo volver atrás con la flecha del navegador
      window.location.replace("index.html");
    });
  }

  // C. Inicializaciones de vistas
  if (document.getElementById('map')) {
    initMap();
  }
  if (selectRutas) {
    await cargarListaDeRutas();
  }
  initCharts();

  // D. Control del menú responsive
  const btnToggleMobile = document.getElementById("btn-toggle-mobile");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  if (btnToggleMobile && sidebar && overlay) {
    btnToggleMobile.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      overlay.classList.toggle("active");
    });

    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("active");
    });
  }
});

// ==========================================
// 4. PROCESAMIENTO Y LECTURA DE ARCHIVOS
// ==========================================
if (btnProcesar) {
  btnProcesar.addEventListener("click", () => {
    const file = csvInput.files[0];
    const nombreRuta = nombreRutaInput.value.trim();

    if (!nombreRuta) return alert("Ingresá un nombre para la Hoja de Ruta.");
    if (!file) return alert("Seleccioná un archivo CSV o Excel.");

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function (results) {
          await procesarEInsertarCSV(results.data, nombreRuta);
        }
      });
    } 
    else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const reader = new FileReader();

      reader.onload = async function (e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

          await procesarEInsertarCSV(jsonData, nombreRuta);
        } catch (err) {
          alert("Error al leer el archivo Excel: " + err.message);
        }
      };

      reader.readAsArrayBuffer(file);
    } else {
      alert("Formato no soportado. Subí un archivo .csv, .xlsx o .xls");
    }
  });
}

async function procesarEInsertarCSV(rows, nombreRuta) {
  let creados = [];
  let contadorPaquete = 1;

  for (let i = 0; i < rows.length; i++) {
    let r = rows[i];
    
    let hr = r.HR || r.hr || r.Hr || '';
    let ref = r.Referencia || r.referencia || r.CK || r.ck || '';
    let dest = r.Destinatario || r.destinatario || '';
    let ciudad = r.Ciudad || r.ciudad || '';
    let cp = r.CP || r.cp || r["Codigo Postal"] || r["Código Postal"] || '';
    let prov = r.Provincia || r.provincia || '';
    let tel = r.Telefono || r.telefono || r["Teléfono"] || '';

    let lat = -34.64 + (Math.random() - 0.5) * 0.08;
    let lng = -58.56 + (Math.random() - 0.5) * 0.08;

    if (hr || ref || dest) {
      creados.push({
        nombre_ruta: nombreRuta,
        hr: hr,
        referencia: ref,
        destinatario: dest,
        ciudad: ciudad,
        codigo_postal: cp,
        provincia: prov,
        telefono: tel,
        lat: lat,
        lng: lng,
        entrega_sub: 'Sin Asignar',
        numero_paquete: contadorPaquete++,
        orden_visita: null,
        empresa_id: empresaIdGlobal // Asignación automática del empresa_id al insertar
      });
    }
  }

  if (creados.length === 0) return alert("No se encontraron registros válidos.");

  const { error } = await supabaseClient.from("paquetes").insert(creados);

  if (error) {
    alert("Error en Supabase: " + error.message);
  } else {
    alert(`Se importaron ${creados.length} entregas exitosamente.`);
    csvInput.value = "";
    nombreRutaInput.value = "";
    await cargarListaDeRutas();
    selectRutas.value = nombreRuta;
    selectRutas.dispatchEvent(new Event("change"));
  }
}

// ==========================================
// 5. CONSULTA Y GESTIÓN DE HOJAS DE RUTA
// ==========================================
async function cargarListaDeRutas() {
  if (!empresaIdGlobal) return;

  // Filtrado estricto por la empresa del usuario logueado
  const { data, error } = await supabaseClient
    .from("paquetes")
    .select("nombre_ruta")
    .eq("empresa_id", empresaIdGlobal);

  if (error) return console.error("Error al cargar rutas:", error);

  const rutasUnicas = [...new Set(data.map(i => i.nombre_ruta))];

  selectRutas.innerHTML = '<option value="">-- Seleccionar Ruta --</option>';
  rutasUnicas.forEach(r => {
    if(r) {
      const opt = document.createElement("option");
      opt.value = r; 
      opt.textContent = r;
      selectRutas.appendChild(opt);
    }
  });
}

if (selectRutas) {
  selectRutas.addEventListener("change", async (e) => {
    const rutaSel = e.target.value;
    puntosSeleccionadosIds = [];
    if (inputNombreSub) inputNombreSub.value = "";

    if (!rutaSel) {
      paquetesRutaActual = [];
      renderTabla([]);
      if (markersLayer) markersLayer.clearLayers();
      return;
    }

    // Consulta filtrada por ruta y por empresa_id
    const { data, error } = await supabaseClient
      .from("paquetes")
      .select("*")
      .eq("nombre_ruta", rutaSel)
      .eq("empresa_id", empresaIdGlobal)
      .order("numero_paquete", { ascending: true });
    
    if (!error) {
      paquetesRutaActual = data;
      actualizarSelectorSubExistentes();
      renderTabla(data);
      renderMapaPuntos(data);
      actualizarVistaSeleccion();
    } else {
      alert("Error al cargar los paquetes: " + error.message);
    }
  });
}

if (btnEliminarRuta) {
  btnEliminarRuta.addEventListener("click", async () => {
    const rutaSel = selectRutas.value;
    if (!rutaSel) return alert("Seleccioná una ruta para eliminar.");

    if (confirm(`¿Estás seguro de eliminar la ruta completa "${rutaSel}"?`)) {
      // Borrado seguro condicionado por la ruta y el empresa_id
      const { error } = await supabaseClient
        .from("paquetes")
        .delete()
        .eq("nombre_ruta", rutaSel)
        .eq("empresa_id", empresaIdGlobal);

      if (!error) {
        alert("Ruta eliminada.");
        selectRutas.value = "";
        selectRutas.dispatchEvent(new Event("change"));
        await cargarListaDeRutas();
      } else {
        alert("Error al eliminar la ruta: " + error.message);
      }
    }
  });
}

// ==========================================
// 6. MAPA INTERACTIVO Y DIBUJO DE ZONAS
// ==========================================
function initMap() {
  if (map) return;

  map = L.map('map').setView([-34.64, -58.56], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  drawnItemsGroup = L.layerGroup().addTo(map);

  map.pm.addControls({
    position: 'topleft',
    drawCircleMarker: false,
    drawPolyline: false,
    drawMarker: false,
    drawCircle: false,
    drawRectangle: true,
    drawPolygon: true,
    editMode: false,
    dragMode: false,
    cutPolygon: false,
    removalMode: true
  });

  map.on('pm:create', (e) => {
    const layer = e.layer;
    procesarPoligonoSeleccion(layer);
    map.removeLayer(layer);
  });
}

if (btnModoSumar) {
  btnModoSumar.addEventListener("click", () => {
    modoSeleccion = 'SUMAR';
    btnModoSumar.classList.add("active");
    btnModoRestar.classList.remove("active");
  });
}

if (btnModoRestar) {
  btnModoRestar.addEventListener("click", () => {
    modoSeleccion = 'RESTAR';
    btnModoRestar.classList.add("active");
    btnModoSumar.classList.remove("active");
  });
}

function renderMapaPuntos(paquetes) {
  if (!markersLayer) return;
  markersLayer.clearLayers();
  let bounds = [];

  paquetes.forEach(p => {
    if (p.lat && p.lng) {
      let esSeleccionado = puntosSeleccionadosIds.includes(p.id);
      
      let colorFill = esSeleccionado ? '#ffffff' : getColorParaEntrega(p.entrega_sub);
      let colorBorde = esSeleccionado ? '#f97316' : '#1e293b';

      let marker = L.circleMarker([p.lat, p.lng], {
        radius: esSeleccionado ? 10 : 7,
        color: colorBorde,
        weight: esSeleccionado ? 3 : 1.5,
        fillColor: colorFill,
        fillOpacity: 0.95
      }).bindPopup(`<b>CK: ${p.referencia || 'Sin Ref'}</b><br>N° Paquete: <b>${p.numero_paquete || '-'}</b><br>${p.destinatario || ''}<br>Entrega: <b>${p.entrega_sub}</b>`);

      marker.id_db = p.id;
      markersLayer.addLayer(marker);
      bounds.push([p.lat, p.lng]);
    }
  });

  if (bounds.length > 0 && puntosSeleccionadosIds.length === 0) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}

function puntoEnPoligono(latlng, polyCoordinates) {
  let x = latlng.lng, y = latlng.lat;
  let inside = false;
  for (let i = 0, j = polyCoordinates.length - 1; i < polyCoordinates.length; j = i++) {
    let xi = polyCoordinates[i].lng, yi = polyCoordinates[i].lat;
    let xj = polyCoordinates[j].lng, yj = polyCoordinates[j].lat;
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function procesarPoligonoSeleccion(layer) {
  let encerradosEnEsteDibujo = [];

  markersLayer.eachLayer(m => {
    let latlng = m.getLatLng();

    if (layer instanceof L.Rectangle) {
      if (layer.getBounds().contains(latlng)) {
        encerradosEnEsteDibujo.push(m.id_db);
      }
    } else if (layer instanceof L.Polygon) {
      let latlngs = layer.getLatLngs()[0];
      if (puntoEnPoligono(latlng, latlngs)) {
        encerradosEnEsteDibujo.push(m.id_db);
      }
    }
  });

  if (modoSeleccion === 'SUMAR') {
    puntosSeleccionadosIds = [...new Set([...puntosSeleccionadosIds, ...encerradosEnEsteDibujo])];
  } else if (modoSeleccion === 'RESTAR') {
    puntosSeleccionadosIds = puntosSeleccionadosIds.filter(id => !encerradosEnEsteDibujo.includes(id));
  }

  actualizarVistaSeleccion();
}

// ==========================================
// 7. ASIGNACIÓN Y EDICIÓN DE ZONAS
// ==========================================
function actualizarVistaSeleccion() {
  if (txtPuntosSel) {
    txtPuntosSel.textContent = `Puntos seleccionados: ${puntosSeleccionadosIds.length}`;
  }
  renderMapaPuntos(paquetesRutaActual);
}

function actualizarSelectorSubExistentes() {
  if (!selectSubExistentes) return;
  const subsExistentes = [...new Set(paquetesRutaActual.map(p => p.entrega_sub).filter(s => s !== 'Sin Asignar'))];
  
  selectSubExistentes.innerHTML = '<option value="">-- Crear Nueva Entrega --</option>';
  subsExistentes.forEach(sub => {
    const opt = document.createElement("option");
    opt.value = sub;
    opt.textContent = `Entrega: ${sub}`;
    selectSubExistentes.appendChild(opt);
  });
}

if (btnCargarSub) {
  btnCargarSub.addEventListener("click", () => {
    const subSel = selectSubExistentes.value;
    if (!subSel) return alert("Seleccioná una entrega de la lista desplegable.");

    puntosSeleccionadosIds = paquetesRutaActual.filter(p => p.entrega_sub === subSel).map(p => p.id);
    inputNombreSub.value = subSel;
    actualizarVistaSeleccion();
  });
}

if (btnDesasignarSub) {
  btnDesasignarSub.addEventListener("click", async () => {
    const subSel = selectSubExistentes.value;
    if (!subSel) return alert("Seleccioná una entrega existente para desasignar.");

    if (confirm(`¿Querés desasignar la entrega "${subSel}"?`)) {
      const { error } = await supabaseClient
        .from("paquetes")
        .update({ entrega_sub: 'Sin Asignar', orden_visita: null })
        .eq("nombre_ruta", selectRutas.value)
        .eq("entrega_sub", subSel)
        .eq("empresa_id", empresaIdGlobal);

      if (!error) {
        alert(`Entrega "${subSel}" desasignada.`);
        puntosSeleccionadosIds = [];
        inputNombreSub.value = "";
        selectRutas.dispatchEvent(new Event("change"));
      } else {
        alert("Error al desasignar: " + error.message);
      }
    }
  });
}

if (btnConfirmarSub) {
  btnConfirmarSub.addEventListener("click", async () => {
    let nombreSub = inputNombreSub.value.trim() || selectSubExistentes.value || "1";
    const subEditando = selectSubExistentes.value;

    if (puntosSeleccionadosIds.length === 0 && !subEditando) {
      return alert("No hay puntos seleccionados en el mapa.");
    }

    try {
      if (subEditando) {
        const idsOriginales = paquetesRutaActual
          .filter(p => p.entrega_sub === subEditando)
          .map(p => p.id);

        const idsQuitados = idsOriginales.filter(id => !puntosSeleccionadosIds.includes(id));

        if (idsQuitados.length > 0) {
          await supabaseClient
            .from("paquetes")
            .update({ entrega_sub: 'Sin Asignar', orden_visita: null })
            .in("id", idsQuitados)
            .eq("empresa_id", empresaIdGlobal);
        }
      }

      if (puntosSeleccionadosIds.length > 0) {
        await supabaseClient
          .from("paquetes")
          .update({ entrega_sub: nombreSub })
          .in("id", puntosSeleccionadosIds)
          .eq("empresa_id", empresaIdGlobal);
      }

      alert(`Asignación guardada para "${nombreSub}".`);
      inputNombreSub.value = "";
      selectSubExistentes.value = "";
      puntosSeleccionadosIds = [];
      selectRutas.dispatchEvent(new Event("change"));

    } catch (error) {
      alert("Error al actualizar: " + error.message);
    }
  });
}

if (btnCancelarSub) {
  btnCancelarSub.addEventListener("click", () => {
    puntosSeleccionadosIds = [];
    inputNombreSub.value = "";
    selectSubExistentes.value = "";
    actualizarVistaSeleccion();
  });
}

// ==========================================
// 8. TABLA Y EXPORTACIÓN A EXCEL
// ==========================================
function renderTabla(datos) {
  if (!tablaBody) return;
  tablaBody.innerHTML = "";
  if (datos.length === 0) {
    tablaBody.innerHTML = '<tr><td colspan="6" class="text-center py-3 text-muted">No hay paquetes en esta ruta.</td></tr>';
    return;
  }

  datos.forEach(p => {
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>Paquete ${p.numero_paquete || '-'}</b></td>
      <td>${p.hr || '-'}</td>
      <td>${p.referencia || '-'}</td>
      <td>${p.destinatario || '-'}</td>
      <td>${p.telefono || '-'}</td>
      <td><strong>${p.entrega_sub}</strong></td>
    `;
    tablaBody.appendChild(tr);
  });
}

if (btnExportar) {
  btnExportar.addEventListener("click", () => {
    if (paquetesRutaActual.length === 0) return alert("Seleccioná una ruta con paquetes para exportar.");

    const wb = XLSX.utils.book_new();
    const subEntregas = [...new Set(paquetesRutaActual.map(p => p.entrega_sub))];

    subEntregas.forEach(sub => {
      const datosSub = paquetesRutaActual
        .filter(p => p.entrega_sub === sub)
        .map(p => ({
          "N° Paquete CSV": p.numero_paquete ? `Paquete ${p.numero_paquete}` : '-',
          "HR": p.hr,
          "Referencia (CK)": p.referencia,
          "Destinatario": p.destinatario,
          "Ciudad": p.ciudad,
          "Código Postal": p.codigo_postal,
          "Teléfono": p.telefono,
          "Sub-Entrega": p.entrega_sub
        }));

      const ws = XLSX.utils.json_to_sheet(datosSub);
      let sheetName = sub.replace(/[:\\/?*\[\]]/g, "_").substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `${selectRutas.value}_Zonificado.xlsx`);
  });
}

// ==========================================
// 9. INICIALIZACIÓN DE GRÁFICOS (CHART.JS)
// ==========================================
function initCharts() {
  const ctxEstados = document.getElementById('chartEstados')?.getContext('2d');
  if (ctxEstados) {
    new Chart(ctxEstados, {
      type: 'doughnut',
      data: {
        labels: ['Entregados', 'En tránsito', 'Rechazados'],
        datasets: [{
          data: [1180, 45, 15],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  const ctxZonas = document.getElementById('chartZonas')?.getContext('2d');
  if (ctxZonas) {
    new Chart(ctxZonas, {
      type: 'bar',
      data: {
        labels: ['Norte', 'Sur', 'Oeste', 'CABA'],
        datasets: [{
          label: 'Envíos Completados',
          data: [350, 420, 290, 180],
          backgroundColor: '#2563eb',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}