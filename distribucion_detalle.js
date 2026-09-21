const SUPABASE_URL = "https://zmanwspxuqwviyzpxtan.supabase.co";
const SUPABASE_KEY = "sb_publishable_geEnhhRNhJ8V7AuM_qSe6g_GEYvW_h_";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let empresaIdUsuario = null;

function obtenerEmpresaIdSesionActiva() {
  if (empresaIdUsuario) return empresaIdUsuario;
  
  const sesionGuardada = localStorage.getItem("andelaz_sesion");
  if (sesionGuardada) {
    try {
      const sesion = JSON.parse(sesionGuardada);
      empresaIdUsuario = sesion.empresa_id || sesion.empresaId || sesion.empresa?.id || sesion.id_empresa || null;
    } catch (e) {
      console.error("Error al leer la sesión", e);
    }
  }
  
  if (!empresaIdUsuario) {
    const val = localStorage.getItem("empresa_id");
    empresaIdUsuario = val ? parseInt(val) : null;
  }
  
  return empresaIdUsuario;
}

let map;
let markersLayerGroup;
let editableLayers;
let currentMode = 'pan';
let puntosDeposito = []; 
let clientesCatalogo = {}; 
let asignacionesActuales = []; 
let paquetesAsignados = new Set(); 
let mostrarNoAsignados = true;
let drawControl;
let distribucionSeleccionadaId = null;
let currentDrawHandler = null;
let marcadoresMapaMap = {}; 

document.addEventListener('DOMContentLoaded', async () => {
  obtenerEmpresaIdSesionActiva();

  if (!window.XLSX) {
    const scriptXlsx = document.createElement('script');
    scriptXlsx.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    document.head.appendChild(scriptXlsx);
  }

  initMap();
  await cargarClientesCatalogo();
  await cargarDistribucionesActivas();
  await cargarPuntosDeposito();
  setupEventListeners();
  inyectarEstilosModalAlerta();
});

function inyectarEstilosModalAlerta() {
  if (document.getElementById('custom-modal-style')) return;
  const style = document.createElement('style');
  style.id = 'custom-modal-style';
  style.innerHTML = `
    .custom-modal-overlay {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background-color: rgba(15, 23, 42, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 99999;
      font-family: 'Poppins', sans-serif;
      animation: fadeInModal 0.2s ease-out;
    }
    .custom-modal-card {
      background: #ffffff;
      padding: 32px;
      border-radius: 20px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      width: 90%;
      max-width: 400px;
      text-align: center;
      animation: scaleUpModal 0.2s ease-out;
    }
    .custom-modal-title {
      font-size: 20px;
      font-weight: 700;
      color: #16a34a;
      margin-bottom: 12px;
    }
    .custom-modal-title.error { color: #dc2626; }
    .custom-modal-title.warning { color: #d97706; }
    .custom-modal-msg {
      font-size: 14px;
      color: #4b5563;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .custom-modal-actions {
      display: flex;
      gap: 10px;
    }
    .custom-modal-btn {
      background-color: #2563eb;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      width: 100%;
      transition: background-color 0.2s;
    }
    .custom-modal-btn:hover { background-color: #1d4ed8; }
    .custom-modal-btn.secondary {
      background-color: #e2e8f0;
      color: #334155;
    }
    .custom-modal-btn.secondary:hover { background-color: #cbd5e1; }
    .custom-modal-btn.danger {
      background-color: #dc2626;
    }
    .custom-modal-btn.danger:hover { background-color: #b91c1c; }
    #tabla-detalle-paquetes tr.clickable-row {
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    #tabla-detalle-paquetes tr.clickable-row:hover {
      background-color: #f1f5f9;
    }
    @keyframes fadeInModal { from { opacity: 0; } to { opacity: 1; }}
    @keyframes scaleUpModal { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; }}
  `;
  document.head.appendChild(style);
}

function mostrarAlertaCustom(titulo, mensaje, tipo = 'success', onConfirm = null) {
  const existing = document.getElementById('active-custom-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'active-custom-modal';
  overlay.className = 'custom-modal-overlay';

  const titleClass = tipo === 'error' ? 'error' : tipo === 'warning' ? 'warning' : '';

  let buttonsHTML = `<button class="custom-modal-btn" id="modal-ok-btn">Aceptar</button>`;
  if (onConfirm) {
    buttonsHTML = `
      <div class="custom-modal-actions">
        <button class="custom-modal-btn secondary" id="modal-cancel-btn">Cancelar</button>
        <button class="custom-modal-btn danger" id="modal-confirm-btn">Confirmar</button>
      </div>
    `;
  }

  overlay.innerHTML = `
    <div class="custom-modal-card">
      <div class="custom-modal-title ${titleClass}">${titulo}</div>
      <div class="custom-modal-msg">${mensaje}</div>
      ${buttonsHTML}
    </div>
  `;

  document.body.appendChild(overlay);

  if (onConfirm) {
    document.getElementById('modal-cancel-btn').addEventListener('click', () => overlay.remove());
    document.getElementById('modal-confirm-btn').addEventListener('click', () => {
      overlay.remove();
      onConfirm();
    });
  } else {
    document.getElementById('modal-ok-btn').addEventListener('click', () => overlay.remove());
  }
}

function initMap() {
  map = L.map('mapa-distribucion', { zoomControl: false }).setView([-34.68, -58.56], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);

  editableLayers = new L.FeatureGroup();
  map.addLayer(editableLayers);

  markersLayerGroup = L.layerGroup();
  map.addLayer(markersLayerGroup);

  setTimeout(() => map.invalidateSize(), 250);
}

async function cargarClientesCatalogo() {
  try {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    let query = supabaseClient.from('clientes').select('prefijo, color_hex');
    if (empresaIdActual) query = query.eq('empresa_id', empresaIdActual);

    const { data, error } = await query;
    if (error) throw error;
    
    clientesCatalogo = {};
    if (data) {
      data.forEach(c => {
        if (c.prefijo) clientesCatalogo[c.prefijo.trim().toUpperCase()] = c.color_hex || '#3b82f6';
      });
    }
  } catch (err) {
    console.error('Error al cargar catálogo de clientes:', err.message);
  }
}

async function cargarPuntosDeposito() {
  try {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    let query = supabaseClient
      .from('deposito')
      .select('id, lat, lng, sku_completo, sku_original, prefijo, destinatario, telefono, intentos_vuelta, orden_original, hr, id_asignacion_distribucion_detalle');
    
    if (empresaIdActual) query = query.eq('empresa_id', empresaIdActual);

    const { data, error } = await query;
    if (error) throw error;
    puntosDeposito = data || [];
    actualizarContadoresYMapa();
  } catch (err) {
    console.error('Error al cargar puntos de depósito:', err.message);
    mostrarAlertaCustom('Error', 'No se pudieron cargar los puntos del depósito: ' + err.message, 'error');
  }
}

async function cargarAsignacionesDistribucion(distribucionId) {
  try {
    if (!distribucionId) {
      asignacionesActuales = [];
      paquetesAsignados.clear();
      actualizarContadoresYMapa();
      actualizarTablaDetalle();
      return;
    }

    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    let queryDist = supabaseClient.from('distribucion').select('id_custom').eq('id', distribucionId);
    if (empresaIdActual) queryDist = queryDist.eq('empresa_id', empresaIdActual);

    const { data: distData, error: distError } = await queryDist.single();
    if (distError) throw distError;
    
    const idCustomBuscado = distData ? String(distData.id_custom || distribucionId) : String(distribucionId);

    let queryDep = supabaseClient.from('deposito').select('id').eq('id_asignacion_distribucion_detalle', idCustomBuscado);
    if (empresaIdActual) queryDep = queryDep.eq('empresa_id', empresaIdActual);

    const { data, error } = await queryDep;
    if (error) throw error;

    asignacionesActuales = data || [];
    paquetesAsignados = new Set(asignacionesActuales.map(item => item.id));

    actualizarContadoresYMapa();
    actualizarTablaDetalle();
  } catch (err) {
    console.error('Error al cargar detalle de distribución:', err.message);
  }
}

function obtenerPuntosFiltrados() {
  const inputSearch = document.getElementById('input-search-general');
  const query = inputSearch ? inputSearch.value.toLowerCase().trim() : '';
  const terms = query ? query.split(' ').filter(t => t.length > 0) : [];

  return puntosDeposito.filter(pto => {
    if (!distribucionSeleccionadaId) {
      const ptoAsignacion = pto.id_asignacion_distribucion_detalle;
      if (ptoAsignacion !== null && ptoAsignacion !== undefined && String(ptoAsignacion).trim() !== '') return false;
    } else {
      const ptoAsignacion = pto.id_asignacion_distribucion_detalle ? String(pto.id_asignacion_distribucion_detalle).trim() : '';
      if (ptoAsignacion !== '') {
        const selectElement = document.getElementById('select-distribucion-activa');
        const optionActual = selectElement ? selectElement.options[selectElement.selectedIndex] : null;
        const matchLugar = optionActual && optionActual.text.includes(ptoAsignacion);
        if (!matchLugar && ptoAsignacion !== String(distribucionSeleccionadaId)) return false;
      }
    }

    if (terms.length === 0) return true;

    const stringData = `
      ${pto.sku_completo || ''} 
      ${pto.sku_original || ''}
      ${pto.destinatario || ''} 
      ${pto.telefono || ''} 
      ${pto.prefijo || ''}
    `.toLowerCase();

    return terms.every(term => stringData.includes(term));
  });
}

function actualizarContadoresYMapa() {
  markersLayerGroup.clearLayers();
  marcadoresMapaMap = {}; 
  
  let countNoAsignados = 0;
  let countAsignados = 0;

  const selectElement = document.getElementById('select-distribucion-activa');
  const optionActual = selectElement ? selectElement.options[selectElement.selectedIndex] : null;

  puntosDeposito.forEach(pto => {
    if (!distribucionSeleccionadaId) {
      const ptoAsignacion = pto.id_asignacion_distribucion_detalle;
      if (ptoAsignacion !== null && ptoAsignacion !== undefined && String(ptoAsignacion).trim() !== '') return;
    } else {
      const ptoAsignacion = pto.id_asignacion_distribucion_detalle ? String(pto.id_asignacion_distribucion_detalle).trim() : '';
      if (ptoAsignacion !== '') {
        const esDeEsta = ptoAsignacion === String(distribucionSeleccionadaId) || (optionActual && optionActual.text.includes(ptoAsignacion));
        if (!esDeEsta) return; 
      }
    }

    if (paquetesAsignados.has(pto.id)) countAsignados++;
    else countNoAsignados++;
  });

  const puntosFiltrados = obtenerPuntosFiltrados();

  puntosFiltrados.forEach(pto => {
    if (pto.lat === null || pto.lng === null || pto.lat === undefined || pto.lng === undefined) return;

    const lat = parseFloat(pto.lat);
    const lng = parseFloat(pto.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    const esAsignadoAEsta = paquetesAsignados.has(pto.id);
    if (!esAsignadoAEsta && !mostrarNoAsignados) return;

    const prefijoKey = pto.prefijo ? pto.prefijo.trim().toUpperCase() : '';
    const clienteColor = clientesCatalogo[prefijoKey] || '#3b82f6';
    const markerColor = esAsignadoAEsta ? clienteColor : '#9ca3af';
    
    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `<div style="background-color: ${markerColor}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const marker = L.marker([lat, lng], { icon: customIcon });
    marker.ptoId = pto.id;

    const skuTexto = pto.sku_original || pto.sku_completo || 'N/A';
    const skuHtml = `<span style="background-color: ${clienteColor}; padding: 4px 10px; border-radius: 9999px; display: inline-block; font-weight: bold; color: #000000;">${skuTexto}</span>`;

    let vueltasValor = pto.intentos_vuelta !== null && pto.intentos_vuelta !== undefined ? pto.intentos_vuelta : 0;
    let vueltasHtml = vueltasValor;
    if (Number(vueltasValor) === 2) {
      vueltasHtml = `<span style="background-color: #f97316; padding: 2px 8px; border-radius: 9999px; display: inline-block; font-weight: bold; color: #000000;">2</span>`;
    }

    const posicionHrTexto = pto.orden_original !== null && pto.orden_original !== undefined ? pto.orden_original : 'N/A';

    marker.bindPopup(`
      <div style="font-size: 12px; font-family: 'Poppins', sans-serif; line-height: 1.4;">
        <strong>SKU:</strong> ${skuHtml}<br>
        <strong>Destinatario:</strong> ${pto.destinatario || 'Sin nombre'}<br>
        <strong>Teléfono:</strong> ${pto.telefono || 'N/A'}<br>
        <strong>Orden:</strong> ${posicionHrTexto}<br>
        <strong>Vueltas actuales:</strong> ${vueltasHtml}<br>
        <strong>Estado:</strong> ${esAsignadoAEsta ? '<span style="color:#16a34a; font-weight:bold;">Asignado a esta Ruta</span>' : '<span style="color:#9ca3af; font-weight:bold;">No Asignado</span>'}
      </div>
    `);

    markersLayerGroup.addLayer(marker);
    marcadoresMapaMap[pto.id] = marker; 
  });

  document.getElementById('contador-no-asignados').innerText = countNoAsignados;
  document.getElementById('contador-paquetes').innerText = countAsignados;
  actualizarTablaDetalle();
}

function actualizarEstilosBotonesHerramientas(modoActivo) {
  const btnSumar = document.getElementById('btn-tool-plus');
  const btnRestar = document.getElementById('btn-tool-minus');
  const btnPan = document.getElementById('btn-tool-pan');

  [btnSumar, btnRestar, btnPan].forEach(btn => {
    if (btn) {
      btn.style.boxShadow = 'none';
      btn.style.opacity = '0.8';
    }
  });

  const activo = document.getElementById(`btn-tool-${modoActivo === 'sumar' ? 'plus' : modoActivo === 'restar' ? 'minus' : 'pan'}`);
  if (activo) {
    activo.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.4)';
    activo.style.opacity = '1';
  }
}

function setupEventListeners() {
  const drawPluginOptions = {
    position: 'topleft',
    draw: {
      polyline: false,
      circle: false,
      marker: false,
      circlemarker: false,
      polygon: false,
      rectangle: { shapeOptions: { color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2 } }
    },
    edit: { featureGroup: editableLayers, remove: true }
  };

  drawControl = new L.Control.Draw(drawPluginOptions);
  map.addControl(drawControl);

  const drawToolbar = document.querySelector('.leaflet-draw');
  if (drawToolbar) drawToolbar.style.display = 'none';

  const selectDistribucion = document.getElementById('select-distribucion-activa');
  if (selectDistribucion) {
    selectDistribucion.addEventListener('change', async (e) => {
      distribucionSeleccionadaId = e.target.value;
      await cargarAsignacionesDistribucion(distribucionSeleccionadaId);
    });
  }

  const inputSearchGeneral = document.getElementById('input-search-general');
  const btnFiltrarGeneral = document.getElementById('btn-filtrar-general');

  if (inputSearchGeneral) inputSearchGeneral.addEventListener('input', () => actualizarContadoresYMapa());
  if (btnFiltrarGeneral) btnFiltrarGeneral.addEventListener('click', () => actualizarContadoresYMapa());

  document.getElementById('btn-tool-plus').addEventListener('click', () => {
    if (!distribucionSeleccionadaId) {
      mostrarAlertaCustom('Atención', 'Por favor, seleccione primero una ID de distribución activa.', 'warning');
      return;
    }
    currentMode = 'sumar';
    actualizarEstilosBotonesHerramientas('sumar');
    if (currentDrawHandler) currentDrawHandler.disable();
    currentDrawHandler = new L.Draw.Rectangle(map, { shapeOptions: { color: '#16a34a', fillColor: '#dcfce7', fillOpacity: 0.3 } });
    currentDrawHandler.enable();
  });

  document.getElementById('btn-tool-minus').addEventListener('click', () => {
    if (!distribucionSeleccionadaId) {
      mostrarAlertaCustom('Atención', 'Por favor, seleccione primero una ID de distribución activa.', 'warning');
      return;
    }
    currentMode = 'restar';
    actualizarEstilosBotonesHerramientas('restar');
    if (currentDrawHandler) currentDrawHandler.disable();
    currentDrawHandler = new L.Draw.Rectangle(map, { shapeOptions: { color: '#dc2626', fillColor: '#fee2e2', fillOpacity: 0.3 } });
    currentDrawHandler.enable();
  });

  document.getElementById('btn-tool-pan').addEventListener('click', () => {
    currentMode = 'pan';
    actualizarEstilosBotonesHerramientas('pan');
    if (currentDrawHandler) {
      currentDrawHandler.disable();
      currentDrawHandler = null;
    }
    editableLayers.clearLayers();
  });

  document.getElementById('btn-toggle-no-asignados').addEventListener('click', () => {
    mostrarNoAsignados = !mostrarNoAsignados;
    actualizarContadoresYMapa();
  });

  map.on(L.Draw.Event.CREATED, function (e) {
    const layer = e.layer;
    const polygonBounds = layer.getBounds();

    markersLayerGroup.eachLayer(marker => {
      if (polygonBounds.contains(marker.getLatLng())) {
        if (currentMode === 'sumar') paquetesAsignados.add(marker.ptoId);
        else if (currentMode === 'restar') paquetesAsignados.delete(marker.ptoId);
      }
    });

    actualizarContadoresYMapa();
    editableLayers.clearLayers();

    if (currentMode === 'sumar' || currentMode === 'restar') {
      setTimeout(() => { if (currentDrawHandler) currentDrawHandler.enable(); }, 100);
    }
  });

  const btnGuardar = document.getElementById('btn-guardar-asignacion');
  if (btnGuardar) btnGuardar.addEventListener('click', async () => await guardarAsignacionesEnBaseDeDatos());

  let btnExportar = document.getElementById('btn-exportar-excel');
  if (!btnExportar) {
    document.querySelectorAll('button').forEach(b => {
      if (b.innerText.toLowerCase().includes('exportar') || b.innerText.toLowerCase().includes('excel')) btnExportar = b;
    });
  }

  if (btnExportar) {
    btnExportar.id = 'btn-exportar-excel';
    btnExportar.addEventListener('click', (e) => {
      e.preventDefault();
      exportarTablaAExcel();
    });
  }

  if (btnGuardar && btnGuardar.parentNode) {
    let btnEliminarSeleccion = document.getElementById('btn-eliminar-seleccion');
    if (!btnEliminarSeleccion) {
      btnEliminarSeleccion = document.createElement('button');
      btnEliminarSeleccion.id = 'btn-eliminar-seleccion';
      btnEliminarSeleccion.className = btnGuardar.className; 
      btnEliminarSeleccion.style.backgroundColor = '#dc2626'; 
      btnEliminarSeleccion.style.color = '#ffffff';
      btnEliminarSeleccion.innerHTML = '🗑️ Eliminar Selección';
      btnGuardar.parentNode.insertBefore(btnEliminarSeleccion, btnGuardar.nextSibling);
    }

    btnEliminarSeleccion.onclick = null;
    btnEliminarSeleccion.addEventListener('click', (e) => {
      e.preventDefault();
      if (!distribucionSeleccionadaId) {
        mostrarAlertaCustom('Atención', 'Seleccione una distribución primero para eliminar su selección.', 'warning');
        return;
      }
      mostrarAlertaCustom(
        'Confirmar Eliminación',
        '¿Estás seguro de que deseas eliminar esta selección? Se restará -1 vuelta en la base de datos, se desvinculará el ID de distribución y se eliminarán los registros de la tabla de detalle.',
        'warning',
        async () => await eliminarSeleccionEnBaseDeDatos()
      );
    });
  }
}

function actualizarTablaDetalle() {
  const tbody = document.getElementById('tabla-detalle-paquetes');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (paquetesAsignados.size === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-table-msg">Seleccione una distribución activa y trace zonas en el mapa para asignar paquetes.</td></tr>`;
    return;
  }

  const puntosFiltrados = obtenerPuntosFiltrados();
  const paquetesSeleccionados = puntosFiltrados.filter(p => paquetesAsignados.has(p.id));

  if (paquetesSeleccionados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-table-msg">No hay paquetes asignados que coincidan con la búsqueda actual.</td></tr>`;
    return;
  }

  paquetesSeleccionados.forEach((pto) => {
    const prefijoKey = pto.prefijo ? pto.prefijo.trim().toUpperCase() : '';
    const clienteColor = clientesCatalogo[prefijoKey] || '#22c55e';
    const vueltasBD = pto.intentos_vuelta !== null && pto.intentos_vuelta !== undefined ? pto.intentos_vuelta : 0;
    
    let vueltasTablaHtml = vueltasBD;
    if (Number(vueltasBD) === 2) {
      vueltasTablaHtml = `<span style="background-color: #f97316; padding: 2px 8px; border-radius: 9999px; display: inline-block; font-weight: bold; color: #000000;">2</span>`;
    }

    const skuOriginalTexto = pto.sku_original || pto.sku_completo || '-';
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    
    tr.addEventListener('click', () => {
      const marker = marcadoresMapaMap[pto.id];
      if (marker) {
        map.setView(marker.getLatLng(), 16);
        marker.openPopup();
      }
    });

    tr.innerHTML = `
      <td><span style="background-color: ${clienteColor}; padding: 4px 10px; border-radius: 9999px; display: inline-block; font-weight: bold; color: #000000;">${skuOriginalTexto}</span></td>
      <td>${pto.destinatario || '-'}</td>
      <td>${pto.telefono || '-'}</td>
      <td>${pto.orden_original !== null && pto.orden_original !== undefined ? pto.orden_original : '-'}</td>
      <td>${vueltasTablaHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

function exportarTablaAExcel() {
  const puntosFiltrados = obtenerPuntosFiltrados();
  const paquetesSeleccionados = puntosFiltrados.filter(p => paquetesAsignados.has(p.id));

  if (paquetesSeleccionados.length === 0) {
    mostrarAlertaCustom('Atención', 'No hay paquetes asignados para exportar en este momento.', 'warning');
    return;
  }

  const datosExcel = paquetesSeleccionados.map(pto => ({
    "sku": pto.sku_original || pto.sku_completo || '',
    "destinatario": pto.destinatario || '',
    "telefono": pto.telefono || '',
    "orden_original": pto.orden_original !== null && pto.orden_original !== undefined ? pto.orden_original : '',
    "hr": pto.hr !== null && pto.hr !== undefined ? pto.hr : '',
    "cantidad devueltas": pto.intentos_vuelta !== null && pto.intentos_vuelta !== undefined ? pto.intentos_vuelta : 0
  }));

  try {
    if (!window.XLSX) throw new Error("La librería de Excel (SheetJS) no se ha cargado correctamente.");
    const worksheet = XLSX.utils.json_to_sheet(datosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Asignación Ruta");
    XLSX.writeFile(workbook, `Asignacion_Ruta_${distribucionSeleccionadaId || 'General'}.xlsx`);
    mostrarAlertaCustom('Éxito', 'Archivo Excel exportado correctamente.', 'success');
  } catch (err) {
    console.error('Error al exportar Excel:', err);
    mostrarAlertaCustom('Error', 'No se pudo generar el archivo Excel: ' + err.message, 'error');
  }
}

async function guardarAsignacionesEnBaseDeDatos() {
  if (!distribucionSeleccionadaId) {
    mostrarAlertaCustom('Atención', 'Seleccione una distribución antes de guardar.', 'warning');
    return;
  }

  try {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    const distribucionIdInt = parseInt(distribucionSeleccionadaId);
    
    let queryDist = supabaseClient.from('distribucion').select('id_custom').eq('id', distribucionIdInt);
    if (empresaIdActual) queryDist = queryDist.eq('empresa_id', empresaIdActual);
    
    const { data: distData, error: distError } = await queryDist.single();
    if (distError) throw distError;
    const valorAsignacionDeposito = distData && distData.id_custom ? distData.id_custom : String(distribucionIdInt);

    let queryDet = supabaseClient.from('distribucion_detalle').select('deposito_id').eq('distribucion_id', distribucionIdInt);
    if (empresaIdActual) queryDet = queryDet.eq('empresa_id', empresaIdActual);

    const { data: actualesEnDb, error: errFetchDb } = await queryDet;
    if (errFetchDb) throw errFetchDb;

    const idsPreviosDb = new Set((actualesEnDb || []).map(item => item.deposito_id));
    const idsNuevosSet = paquetesAsignados;
    const depositosDesasignados = Array.from(idsPreviosDb).filter(id => !idsNuevosSet.has(id));

    let queryDel = supabaseClient.from('distribucion_detalle').delete().eq('distribucion_id', distribucionIdInt);
    if (empresaIdActual) queryDel = queryDel.eq('empresa_id', empresaIdActual);

    const { error: errorDelete } = await queryDel;
    if (errorDelete) throw errorDelete;

    const fechaHoraActual = new Date().toISOString();
    const nuevosRegistros = [];
    const paquetesParaActualizar = [];

    Array.from(idsNuevosSet).forEach(depositoId => {
      const pto = puntosDeposito.find(p => p.id === depositoId);
      if (!pto) return;

      const prefijoKey = pto.prefijo ? pto.prefijo.trim().toUpperCase() : '';
      const colorHexAsociado = clientesCatalogo[prefijoKey] || null;
      const vueltasActuales = parseInt(pto.intentos_vuelta) || 0;
      const nuevasVueltas = vueltasActuales + 1;

      nuevosRegistros.push({
        distribucion_id: distribucionIdInt,
        deposito_id: pto.id,
        prefijo: pto.prefijo || null,
        sku: pto.sku_original || null,
        color: colorHexAsociado,
        direccion: pto.destinatario || null,
        telefono: pto.telefono || null,
        orden_hr: pto.orden_original || null,
        vueltas: nuevasVueltas,
        fecha_asignacion: fechaHoraActual,
        estado: 'asignado',
        empresa_id: empresaIdActual
      });

      paquetesParaActualizar.push({
        id: pto.id,
        intentos_vuelta: nuevasVueltas,
        id_asignacion_distribucion_detalle: valorAsignacionDeposito
      });
    });

    if (nuevosRegistros.length > 0) {
      const { error: errorInsert } = await supabaseClient.from('distribucion_detalle').insert(nuevosRegistros);
      if (errorInsert) throw errorInsert;
    }

    for (const item of paquetesParaActualizar) {
      let queryUpDep = supabaseClient.from('deposito').update({ intentos_vuelta: item.intentos_vuelta, id_asignacion_distribucion_detalle: item.id_asignacion_distribucion_detalle }).eq('id', item.id);
      if (empresaIdActual) queryUpDep = queryUpDep.eq('empresa_id', empresaIdActual);
      await queryUpDep;
    }

    for (const depositoIdRemovido of depositosDesasignados) {
      const ptoRemovido = puntosDeposito.find(p => p.id === depositoIdRemovido);
      const vueltasAnteriores = ptoRemovido ? Math.max(0, (parseInt(ptoRemovido.intentos_vuelta) || 1) - 1) : 0;
      
      let queryRem = supabaseClient.from('deposito').update({ intentos_vuelta: vueltasAnteriores, id_asignacion_distribucion_detalle: null }).eq('id', depositoIdRemovido);
      if (empresaIdActual) queryRem = queryRem.eq('empresa_id', empresaIdActual);
      await queryRem;
    }

    mostrarAlertaCustom('Éxito', '¡Asignaciones guardadas y vueltas actualizadas correctamente!', 'success');
    await cargarPuntosDeposito();
    await cargarAsignacionesDistribucion(distribucionSeleccionadaId);
  } catch (err) {
    console.error('Error al guardar asignaciones:', err.message);
    mostrarAlertaCustom('Error', 'Hubo un error al guardar las asignaciones: ' + err.message, 'error');
  }
}

async function eliminarSeleccionEnBaseDeDatos() {
  try {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    const distribucionIdInt = parseInt(distribucionSeleccionadaId);

    let queryDet = supabaseClient.from('distribucion_detalle').select('deposito_id').eq('distribucion_id', distribucionIdInt);
    if (empresaIdActual) queryDet = queryDet.eq('empresa_id', empresaIdActual);

    const { data: actualesEnDb, error: errFetchDb } = await queryDet;
    if (errFetchDb) throw errFetchDb;

    const idsAsignados = (actualesEnDb || []).map(item => item.deposito_id);

    let queryDel = supabaseClient.from('distribucion_detalle').delete().eq('distribucion_id', distribucionIdInt);
    if (empresaIdActual) queryDel = queryDel.eq('empresa_id', empresaIdActual);

    const { error: errorDelete } = await queryDel;
    if (errorDelete) throw errorDelete;

    for (const depositoId of idsAsignados) {
      const pto = puntosDeposito.find(p => p.id === depositoId);
      if (!pto) continue;
      const vueltasActuales = parseInt(pto.intentos_vuelta) || 0;
      const nuevasVueltas = Math.max(0, vueltasActuales - 1);

      let queryDepUp = supabaseClient.from('deposito').update({ intentos_vuelta: nuevasVueltas, id_asignacion_distribucion_detalle: null }).eq('id', depositoId);
      if (empresaIdActual) queryDepUp = queryDepUp.eq('empresa_id', empresaIdActual);
      await queryDepUp;
    }

    paquetesAsignados.clear();
    mostrarAlertaCustom('Éxito', 'Se eliminó la selección, se restó -1 en la base de datos, se limpió el ID en depósito y se borró el detalle.', 'success');
    await cargarPuntosDeposito();
    await cargarAsignacionesDistribucion(distribucionSeleccionadaId);
  } catch (err) {
    console.error('Error al eliminar la selección:', err.message);
    mostrarAlertaCustom('Error', 'Hubo un error al eliminar la selección: ' + err.message, 'error');
  }
}

async function cargarDistribucionesActivas() {
  try {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    let query = supabaseClient.from('distribucion').select('id, estado, id_custom, chofer_historico, patente_historica').neq('estado', 'FINALIZADA');
    if (empresaIdActual) query = query.eq('empresa_id', empresaIdActual);

    const { data, error } = await query;
    if (error) throw error;

    const select = document.getElementById('select-distribucion-activa');
    if (!select) return;

    select.innerHTML = `<option value="">Todas las IDs</option>`;
    data.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      const idVisual = item.id_custom || `#${item.id}`;
      const choferTexto = item.chofer_historico ? ` - Chofer: ${item.chofer_historico}` : '';
      const patenteTexto = item.patente_historica ? ` - Patente: ${item.patente_historica}` : '';
      option.textContent = `ID: ${idVisual}${choferTexto}${patenteTexto}`;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Error al cargar distribuciones activas:', err.message);
  }
}