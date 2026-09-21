// ==========================================
// CONFIGURACIÓN DE SUPABASE Y VARIABLES GLOBALES
// ==========================================
const SUPABASE_URL = "https://zmanwspxuqwviyzpxtan.supabase.co";
const SUPABASE_KEY = "sb_publishable_geEnhhRNhJ8V7AuM_qSe6g_GEYvW_h_";

// TIEMPO DE MOSTRADO DEL CHECK VERDE EN PANTALLA (EN MILISEGUNDOS)
const TIEMPO_MOSTRAR_CHECK_MS = 1500;

let supabaseClientInstance = null;
let empresaIdUsuario = null;
let choferIdUsuarioActivo = null;

let selectDistribucionesMulti, btnCargarDistribucion;
let stepSelectorDistribucion, stepControlPaquetes, stepHojaRuta;
let btnCancelarProceso, btnIniciarReparto, contadorValidacionEl, listaPaquetesContainer;
let btnToggleCamara, listaHojaRutaContainer, btnFinalizarRepartoCompleto;
let modalGestionEntrega, btnCerrarModal, btnGuardarEstadoPaquete;

let html5QrCode = null;
let camaraActiva = false;
let paquetesCargadosGlobal = [];
let idsDistribucionSeleccionadasGlobal = [];
let modoScannerActual = "barcode";
let cooldownScanner = false;

// Variables Mapa Leaflet (Paso 3)
let mapaReparto = null;
let marcadoresMapa = [];
let paqueteEnGestion = null;
let streamFotoGestion = null; // Para la cámara de la foto de no entrega

// Puntos A y B y Recorrido
let coordsPuntoA = null;
let coordsPuntoB = null;
let marcadorA = null;
let marcadorB = null;
let modoSeleccionPunto = null;
let lineaRutaActiva = null;
let lineaVisible = true;

// Geolocalización Dispositivo (GPS Tiempo Real)
let marcadorUsuarioGPS = null;
let watchIdGPS = null;
let primerAjusteMapaUbicacion = false;

// ==========================================
// NOTIFICACIÓN CUSTOM ESTILO DASHBOARD
// ==========================================
function mostrarNotificacion(titulo, mensaje, tipo = "exito") {
  const modalNotif = document.getElementById("modal-notificacion");
  const notifTitulo = document.getElementById("notif-titulo");
  const notifMensaje = document.getElementById("notif-mensaje");
  const notifIcono = document.getElementById("notif-icono");
  const btnCerrar = document.getElementById("btn-cerrar-notif");

  if (!modalNotif) return;

  notifTitulo.textContent = titulo;
  notifMensaje.textContent = mensaje;

  notifIcono.className = "alert-icon-box " + tipo;
  if (tipo === "exito") {
    notifIcono.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
  } else if (tipo === "error") {
    notifIcono.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
  } else {
    notifIcono.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
  }

  modalNotif.classList.add("active");

  btnCerrar.onclick = () => {
    modalNotif.classList.remove("active");
  };
}

function obtenerEmpresaIdSesionActiva() {
  if (empresaIdUsuario) return empresaIdUsuario;
  
  const sesionGuardada = localStorage.getItem("andelaz_sesion");
  if (sesionGuardada) {
    try {
      const sesion = JSON.parse(sesionGuardada);
      empresaIdUsuario = sesion.empresa_id || null;
    } catch (e) {
      console.error("Error al leer la sesión de localStorage", e);
    }
  }
  
  if (!empresaIdUsuario) {
    const val = localStorage.getItem("empresa_id");
    empresaIdUsuario = val || null;
  }
  
  return empresaIdUsuario;
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  supabaseClientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.supabaseClient = supabaseClientInstance;
  
  obtenerEmpresaIdSesionActiva();

  selectDistribucionesMulti = document.getElementById("select-distribuciones-multi");
  btnCargarDistribucion = document.getElementById("btn-cargar-distribucion");
  stepSelectorDistribucion = document.getElementById("step-selector-distribucion");
  stepControlPaquetes = document.getElementById("step-control-paquetes");
  stepHojaRuta = document.getElementById("step-hoja-ruta");

  btnCancelarProceso = document.getElementById("btn-cancelar-proceso");
  btnIniciarReparto = document.getElementById("btn-iniciar-reparto");
  contadorValidacionEl = document.getElementById("contador-validacion");
  listaPaquetesContainer = document.getElementById("lista-paquetes-container");
  btnToggleCamara = document.getElementById("btn-toggle-camara");

  listaHojaRutaContainer = document.getElementById("lista-hoja-ruta-container");
  btnFinalizarRepartoCompleto = document.getElementById("btn-finalizar-reparto-completo");

  modalGestionEntrega = document.getElementById("modal-gestion-entrega");
  btnCerrarModal = document.getElementById("btn-cerrar-modal");
  btnGuardarEstadoPaquete = document.getElementById("btn-guardar-estado-paquete");

  if (btnCargarDistribucion) btnCargarDistribucion.addEventListener("click", handleCargarDistribucionesSeleccionadas);
  if (btnCancelarProceso) btnCancelarProceso.addEventListener("click", cancelarProcesoASelector);
  if (btnToggleCamara) btnToggleCamara.addEventListener("click", toggleCamaraProceso);
  if (btnIniciarReparto) btnIniciarReparto.addEventListener("click", handleIniciarReparto);
  if (btnFinalizarRepartoCompleto) btnFinalizarRepartoCompleto.addEventListener("click", finalizarRecorrido);
  if (btnCerrarModal) btnCerrarModal.addEventListener("click", cerrarModalGestion);
  if (btnGuardarEstadoPaquete) btnGuardarEstadoPaquete.addEventListener("click", guardarEstadoPaqueteBD);

  const btnValidarTodos = document.getElementById("btn-validar-todos");
  if (btnValidarTodos) btnValidarTodos.addEventListener("click", validarTodosLosPaquetes);

  const btnDesvalidarTodos = document.getElementById("btn-desvalidar-todos");
  if (btnDesvalidarTodos) btnDesvalidarTodos.addEventListener("click", deshacerTodasLasValidaciones);

  document.getElementById("btn-toggle-linea")?.addEventListener("click", toggleLineaRuta);
  document.getElementById("btn-mi-ubicacion")?.addEventListener("click", centrarEnUbicacionGPS);

  document.getElementById("btn-search-a")?.addEventListener("click", () => buscarDireccion('A'));
  document.getElementById("btn-search-b")?.addEventListener("click", () => buscarDireccion('B'));
  document.getElementById("btn-pick-a")?.addEventListener("click", () => activarModoSeleccionMapa('A'));
  document.getElementById("btn-pick-b")?.addEventListener("click", () => activarModoSeleccionMapa('B'));
  document.getElementById("btn-optimizar-ruta")?.addEventListener("click", optimizarRecorridoSegmentado);

  const btnBarcode = document.getElementById("btn-modo-barcode");
  const btnQr = document.getElementById("btn-modo-qr");
  if (btnBarcode) btnBarcode.addEventListener("click", () => cambiarModoScanner("barcode"));
  if (btnQr) btnQr.addEventListener("click", () => cambiarModoScanner("qr"));

  await obtenerIdChoferLogueadoYCargarDistribuciones();
});

// ==========================================
// PASO 1: FILTRADO Y CARGA DE DISTRIBUCIONES
// ==========================================
async function obtenerIdChoferLogueadoYCargarDistribuciones() {
  const empresaId = obtenerEmpresaIdSesionActiva();
  const sesionGuardada = localStorage.getItem("andelaz_sesion");
  if (!sesionGuardada) return;
  
  try {
    const sesion = JSON.parse(sesionGuardada);
    const nombreUsuario = sesion.nombre || "";

    if (!empresaId) {
      if (selectDistribucionesMulti) selectDistribucionesMulti.innerHTML = '<option value="">-- Empresa no identificada --</option>';
      return;
    }

    const { data: { user } } = await supabaseClientInstance.auth.getUser();
    const userId = user ? user.id : null;

    let queryChofer = supabaseClientInstance
      .from("choferes")
      .select("id, nombre_apellido, usuario_id")
      .eq("empresa_id", empresaId);

    if (userId) {
      queryChofer = queryChofer.or(`usuario_id.eq.${userId},nombre_apellido.ilike.%${nombreUsuario}%`);
    } else if (nombreUsuario) {
      queryChofer = queryChofer.ilike("nombre_apellido", `%${nombreUsuario}%`);
    }

    const { data: choferData, error: choferError } = await queryChofer;

    if (!choferError && choferData && choferData.length > 0) {
      choferIdUsuarioActivo = choferData[0].id;
    }

    await cargarDistribucionesAsignadasParaChofer(empresaId, choferIdUsuarioActivo);

  } catch (err) {
    console.error("Error al mapear el chofer:", err);
    if (selectDistribucionesMulti) selectDistribucionesMulti.innerHTML = '<option value="">-- Error al cargar distribuciones --</option>';
  }
}

async function cargarDistribucionesAsignadasParaChofer(empresaId, choferId) {
  if (!selectDistribucionesMulti) return;

  if (!choferId) {
    selectDistribucionesMulti.innerHTML = '<option value="">-- No hay chofer asociado a este usuario --</option>';
    return;
  }

  let { data, error } = await supabaseClientInstance
    .from("distribucion")
    .select("id, id_custom, fecha_creacion, chofer_id, unidad_id, estado, finalizado")
    .eq("empresa_id", empresaId)
    .eq("chofer_id", choferId)
    .eq("finalizado", false);

  if (error) {
    selectDistribucionesMulti.innerHTML = '<option value="">-- Error al cargar distribuciones --</option>';
    return;
  }

  selectDistribucionesMulti.innerHTML = "";

  if (!data || data.length === 0) {
    selectDistribucionesMulti.innerHTML = '<option value="">-- No hay distribuciones sin finalizar asignadas --</option>';
    return;
  }

  for (const item of data) {
    const customId = item.id_custom;
    let countPaquetes = 0;

    if (customId) {
      const { count, error: countError } = await supabaseClientInstance
        .from("deposito")
        .select("*", { count: 'exact', head: true })
        .eq("empresa_id", empresaId)
        .eq("id_asignacion_distribucion_detalle", customId);

      if (!countError && count !== null) countPaquetes = count;
    }

    const fechaFormateada = item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleString('es-AR') : 'S/Fecha';

    const opt = document.createElement("option");
    opt.value = item.id;
    opt.setAttribute("data-customid", customId || "");
    opt.textContent = `Distribución: ${customId || item.id} | Fecha: ${fechaFormateada} | Paquetes: ${countPaquetes}`;
    selectDistribucionesMulti.appendChild(opt);
  }
}

// ==========================================
// PASO 2: CONTROL DE CARGA Y ESCANEO
// ==========================================
async function handleCargarDistribucionesSeleccionadas() {
  if (!selectDistribucionesMulti) return;
  const selectedOpts = Array.from(selectDistribucionesMulti.selectedOptions);
  
  if (selectedOpts.length === 0 || selectedOpts[0].value === "") {
    mostrarNotificacion("Atención", "Por favor, selecciona al menos una distribución.", "info");
    return;
  }

  idsDistribucionSeleccionadasGlobal = selectedOpts.map(opt => ({
    id: opt.value,
    customId: opt.getAttribute("data-customid")
  }));

  const empresaId = obtenerEmpresaIdSesionActiva();
  paquetesCargadosGlobal = [];

  const customIdsList = idsDistribucionSeleccionadasGlobal.map(d => d.customId).filter(Boolean);

  const { data: paquetesData, error: paquetesError } = await supabaseClientInstance
    .from("deposito")
    .select("id, sku_original, sku_completo, cliente_id, id_asignacion_distribucion_detalle, observaciones, estado, lat, lng, posicion_hr, destinatario, telefono, alerta, intentos_vuelta")
    .eq("empresa_id", empresaId)
    .in("id_asignacion_distribucion_detalle", customIdsList);

  if (paquetesError || !paquetesData) {
    mostrarNotificacion("Error", "No se encontraron paquetes para las distribuciones seleccionadas.", "error");
    return;
  }

  const depositoIds = paquetesData.map(p => p.id);
  let mapaDetalle = {};
  if (depositoIds.length > 0) {
    const { data: detalleData } = await supabaseClientInstance
      .from("distribucion_detalle")
      .select("deposito_id, entregado, nombre, dni, motivo, foto, observaciones, sku")
      .in("deposito_id", depositoIds);

    if (detalleData) {
      detalleData.forEach(d => {
        mapaDetalle[d.deposito_id] = d;
      });
    }
  }

  const { data: clientesData } = await supabaseClientInstance.from("clientes").select("id, color_hex, razon_social").eq("empresa_id", empresaId);
  const mapaClientes = {};
  if (clientesData) clientesData.forEach(c => mapaClientes[c.id] = { nombre: c.razon_social, color: c.color_hex || "#84cc16" });

  paquetesCargadosGlobal = paquetesData.map((p, idx) => {
    const clienteInfo = mapaClientes[p.cliente_id] || { nombre: 'iFLOW', color: '#84cc16' };
    const detalle = mapaDetalle[p.id] || {};
    return {
      id: p.id,
      orden: idx + 1,
      sku_original: p.sku_original || '',
      sku_completo: p.sku_completo || p.sku_original || '',
      sku_detalle: detalle.sku || p.sku_completo || p.sku_original || '',
      cliente_nombre: clienteInfo.nombre,
      color_cliente: clienteInfo.color,
      id_asignacion: p.id_asignacion_distribucion_detalle,
      validado: false,
      estado_entrega: p.estado || 'Pendiente',
      observaciones_entrega: detalle.observaciones || p.observaciones || '',
      latitud: p.lat || null,
      longitud: p.lng || null,
      posicion_hr: p.posicion_hr || '',
      destinatario: p.destinatario || '',
      telefono: p.telefono || '',
      alerta: p.alerta || '',
      intentos_vuelta: p.intentos_vuelta || 1,
      entregado_db: detalle.entregado || '',
      nombre_recibe: detalle.nombre || '',
      dni_recibe: detalle.dni || '',
      motivo_noentrega: detalle.motivo || '',
      foto_path: detalle.foto || '',
      foto_temp_base64: null
    };
  });

  if (stepSelectorDistribucion) stepSelectorDistribucion.classList.remove("active-step");
  if (stepControlPaquetes) stepControlPaquetes.classList.add("active-step");

  renderizarListaPaquetes();
  actualizarContadorValidacion();
  ocultarVisorCamaraUI();
}

function renderizarListaPaquetes() {
  if (!listaPaquetesContainer) return;
  listaPaquetesContainer.innerHTML = "";

  paquetesCargadosGlobal.forEach((pkg) => {
    const card = document.createElement("div");
    card.className = `paquete-item-card ${pkg.validado ? 'validado' : ''}`;
    card.id = `paquete-card-${pkg.id}`;

    card.innerHTML = `
      <div class="paquete-info-left" style="flex: 1; min-width: 0; padding-right: 8px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
          <span class="badge-cliente" style="background-color: ${pkg.color_cliente}; color: #fff; text-transform: uppercase; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">${pkg.cliente_nombre}</span>
          <span class="sku-texto" style="font-weight: 600; font-size: 0.85rem; color: #0f172a;">${pkg.sku_original}</span>
        </div>
        <div style="margin-top: 2px;">
          ${pkg.validado 
            ? `<span style="color: #16a34a; font-weight: 700; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 3px; line-height: 1;">
                 <i class="fa-solid fa-circle-check"></i> Validado
               </span>` 
            : `<span style="color: #64748b; font-size: 0.7rem; line-height: 1;">Pendiente</span>`
          }
        </div>
      </div>
      <div class="paquete-actions-right" style="flex-shrink: 0;">
        ${pkg.validado 
          ? `<button type="button" class="btn btn-sm" onclick="deshacerValidacionManual('${pkg.id}')" style="background: #ef4444; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.72rem; font-weight: 600;">Deshacer</button>` 
          : `<button type="button" class="btn btn-sm" onclick="marcarPaqueteValidadoManual('${pkg.id}')" style="background: #e2e8f0; color: #1e293b; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.72rem; font-weight: 600;">Validar</button>`
        }
      </div>
    `;
    listaPaquetesContainer.appendChild(card);
  });
}

function actualizarContadorValidacion() {
  const total = paquetesCargadosGlobal.length;
  const validados = paquetesCargadosGlobal.filter(p => p.validado).length;
  const textoContador = `${validados}/${total}`;

  if (contadorValidacionEl) {
    contadorValidacionEl.textContent = textoContador;
  }

  const contenedorBtn = document.getElementById("contenedor-btn-iniciar");
  if (validados === total && total > 0) {
    if (contenedorBtn) contenedorBtn.style.display = "block";
    if (btnIniciarReparto) btnIniciarReparto.style.display = "inline-block";
  } else {
    if (contenedorBtn) contenedorBtn.style.display = "none";
    if (btnIniciarReparto) btnIniciarReparto.style.display = "none";
  }
}

window.marcarPaqueteValidadoManual = function(id) {
  const pkg = paquetesCargadosGlobal.find(p => p.id == id);
  if (pkg) { pkg.validado = true; renderizarListaPaquetes(); actualizarContadorValidacion(); }
};

window.deshacerValidacionManual = function(id) {
  const pkg = paquetesCargadosGlobal.find(p => p.id == id);
  if (pkg) { pkg.validado = false; renderizarListaPaquetes(); actualizarContadorValidacion(); }
};

window.validarTodosLosPaquetes = function() {
  paquetesCargadosGlobal.forEach(p => p.validado = true);
  renderizarListaPaquetes();
  actualizarContadorValidacion();
};

window.deshacerTodasLasValidaciones = function() {
  paquetesCargadosGlobal.forEach(p => p.validado = false);
  renderizarListaPaquetes();
  actualizarContadorValidacion();
};

// ==========================================
// CÁMARA / SCANNER CON TOGGLE Y RECTÁNGULO HORIZONTAL
// ==========================================
async function toggleCamaraProceso() {
  if (camaraActiva) {
    await detenerScannerCamara();
  } else {
    await iniciarScannerCamara();
  }
}

function ocultarVisorCamaraUI() {
  const contVisor = document.getElementById("contenedor-visor-camara");
  const contModos = document.getElementById("contenedor-modos-camara");
  if (contVisor) contVisor.style.display = "none";
  if (contModos) contModos.style.display = "none";
  if (btnToggleCamara) {
    btnToggleCamara.innerHTML = '<i class="fa-solid fa-camera"></i> Abrir Cámara para Escaneo';
    btnToggleCamara.style.background = "#0f172a";
  }
  camaraActiva = false;
}

function mostrarVisorCamaraUI() {
  const contVisor = document.getElementById("contenedor-visor-camara");
  const contModos = document.getElementById("contenedor-modos-camara");
  if (contVisor) contVisor.style.display = "block";
  if (contModos) contModos.style.display = "flex";
  if (btnToggleCamara) {
    btnToggleCamara.innerHTML = '<i class="fa-solid fa-camera-rotate"></i> Ocultar / Apagar Cámara';
    btnToggleCamara.style.background = "#dc2626";
  }
  camaraActiva = true;
}

async function detenerScannerCamara() {
  if (html5QrCode) {
    try {
      if (html5QrCode.isScanning) {
        await html5QrCode.stop();
      }
      html5QrCode.clear();
    } catch (e) {
      console.warn("Error deteniendo el scanner:", e);
    }
  }
  ocultarVisorCamaraUI();
}

window.cambiarModoScanner = function(modo) {
  modoScannerActual = modo || "barcode";
  const btnBarcode = document.getElementById("btn-modo-barcode");
  const btnQr = document.getElementById("btn-modo-qr");

  if (modoScannerActual === "barcode") {
    if (btnBarcode) { btnBarcode.style.background = "#2563eb"; btnBarcode.style.color = "#fff"; }
    if (btnQr) { btnQr.style.background = "#e2e8f0"; btnQr.style.color = "#1e293b"; }
  } else {
    if (btnQr) { btnQr.style.background = "#2563eb"; btnQr.style.color = "#fff"; }
    if (btnBarcode) { btnBarcode.style.background = "#e2e8f0"; btnBarcode.style.color = "#1e293b"; }
  }

  if (camaraActiva) {
    iniciarScannerCamara();
  }
};

async function iniciarScannerCamara() {
  mostrarVisorCamaraUI();

  if (html5QrCode) {
    try {
      if (html5QrCode.isScanning) {
        await html5QrCode.stop();
      }
      html5QrCode.clear();
    } catch (e) {}
  }

  if (!modoScannerActual) modoScannerActual = "barcode";

  html5QrCode = new Html5Qrcode("reader");

  const config = { 
    fps: 15, 
    qrbox: (viewfinderWidth, viewfinderHeight) => {
      if (modoScannerActual === "barcode") {
        return {
          width: Math.floor(viewfinderWidth * 0.85),
          height: Math.floor(viewfinderHeight * 0.35)
        };
      } else {
        const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.65);
        return { width: size, height: size };
      }
    },
    aspectRatio: 1.777778
  };

  try {
    await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, () => {});
  } catch (err) {
    console.error("Error o permiso denegado en la cámara:", err);
    ocultarVisorCamaraUI();
    mostrarNotificacion("Permiso Denegado", "No se pudo acceder a la cámara. Asegúrate de otorgar los permisos necesarios en tu navegador.", "error");
  }
}

function onScanSuccess(decodedText) {
  if (cooldownScanner) return;

  const codigoLimpio = decodedText.trim();
  const pkg = paquetesCargadosGlobal.find(p => p.sku_original === codigoLimpio || p.sku_completo === codigoLimpio);

  if (pkg && !pkg.validado) {
    cooldownScanner = true;
    pkg.validado = true;

    const overlaySuccess = document.getElementById("scan-overlay-success");
    if (overlaySuccess) {
      overlaySuccess.classList.add("active");
      setTimeout(() => {
        overlaySuccess.classList.remove("active");
        cooldownScanner = false;
      }, TIEMPO_MOSTRAR_CHECK_MS);
    } else {
      cooldownScanner = false;
    }

    renderizarListaPaquetes();
    actualizarContadorValidacion();

    setTimeout(() => {
      const elPaquete = document.getElementById(`paquete-card-${pkg.id}`);
      if (elPaquete) {
        elPaquete.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  }
}

async function cancelarProcesoASelector() {
  await detenerScannerCamara();
  detenerSeguimientoGPS();
  paquetesCargadosGlobal = [];
  if (stepControlPaquetes) stepControlPaquetes.classList.remove("active-step");
  if (stepHojaRuta) stepHojaRuta.classList.remove("active-step");
  if (stepSelectorDistribucion) stepSelectorDistribucion.classList.add("active-step");
  obtenerIdChoferLogueadoYCargarDistribuciones();
}

// ==========================================
// PASO 3: MAPA, CIRCULOS, RUTA Y HOJA DE RUTA
// ==========================================
async function handleIniciarReparto() {
  await detenerScannerCamara();

  const empresaId = obtenerEmpresaIdSesionActiva();
  const customIds = idsDistribucionSeleccionadasGlobal.map(d => d.customId);

  await supabaseClientInstance
    .from("distribucion")
    .update({ estado: "En Transito" })
    .eq("empresa_id", empresaId)
    .in("id_custom", customIds);

  if (stepControlPaquetes) stepControlPaquetes.classList.remove("active-step");
  if (stepHojaRuta) stepHojaRuta.classList.add("active-step");

  inicializarMapaReparto();
  renderizarHojaDeRuta(paquetesCargadosGlobal);
  iniciarSeguimientoGPS();
}

window.volverAControlPaquetes = function() {
  detenerSeguimientoGPS();
  if (stepHojaRuta) stepHojaRuta.classList.remove("active-step");
  if (stepControlPaquetes) stepControlPaquetes.classList.add("active-step");
  ocultarVisorCamaraUI();
};

function inicializarMapaReparto() {
  if (mapaReparto) mapaReparto.remove();

  mapaReparto = L.map("mapa-reparto").setView([-34.69, -58.56], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(mapaReparto);

  mapaReparto.on('click', (e) => {
    if (modoSeleccionPunto === 'A') {
      establecerPunto('A', e.latlng.lat, e.latlng.lng, "Punto A (Marcado en mapa)");
      desactivarModoSeleccion();
    } else if (modoSeleccionPunto === 'B') {
      establecerPunto('B', e.latlng.lat, e.latlng.lng, "Punto B (Marcado en mapa)");
      desactivarModoSeleccion();
    }
  });

  setTimeout(() => mapaReparto.invalidateSize(), 300);
  renderizarMarcadoresMapa(paquetesCargadosGlobal);
}

function crearIconoUbicacionUsuario() {
  return L.divIcon({
    className: 'custom-location-icon-wrapper',
    html: `
      <div class="user-location-marker">
        <div class="user-location-ping"></div>
        <img src="./img/web/ubicacion.png" alt="Mi Ubicación">
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -20]
  });
}

function iniciarSeguimientoGPS() {
  if (!navigator.geolocation) {
    mostrarNotificacion("Geolocalización", "Tu navegador o dispositivo no soporta geolocalización.", "error");
    return;
  }

  detenerSeguimientoGPS();
  primerAjusteMapaUbicacion = false;

  const opciones = {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 15000
  };

  watchIdGPS = navigator.geolocation.watchPosition(
    (posicion) => {
      const lat = posicion.coords.latitude;
      const lng = posicion.coords.longitude;

      if (!mapaReparto) return;

      if (marcadorUsuarioGPS) {
        marcadorUsuarioGPS.setLatLng([lat, lng]);
      } else {
        marcadorUsuarioGPS = L.marker([lat, lng], { icon: crearIconoUbicacionUsuario() })
          .addTo(mapaReparto)
          .bindPopup("<b>¡Tu Ubicación Actual!</b>");
      }

      if (!primerAjusteMapaUbicacion) {
        mapaReparto.setView([lat, lng], 15);
        primerAjusteMapaUbicacion = true;
      }
    },
    (err) => {
      console.warn("Error o permiso denegado en GPS:", err);
      if (err.code === err.PERMISSION_DENIED) {
        mostrarNotificacion("Permiso Denegado", "No se pudo acceder a la ubicación. Habilitá el permiso de GPS en tu navegador.", "error");
      }
    },
    opciones
  );
}

function detenerSeguimientoGPS() {
  if (watchIdGPS !== null) {
    navigator.geolocation.clearWatch(watchIdGPS);
    watchIdGPS = null;
  }
  if (marcadorUsuarioGPS && mapaReparto) {
    mapaReparto.removeLayer(marcadorUsuarioGPS);
    marcadorUsuarioGPS = null;
  }
}

function centrarEnUbicacionGPS() {
  if (marcadorUsuarioGPS) {
    const latlng = marcadorUsuarioGPS.getLatLng();
    mapaReparto.setView(latlng, 16);
    marcadorUsuarioGPS.openPopup();
  } else {
    mostrarNotificacion("Ubicación", "Obteniendo coordenadas GPS de tu teléfono...", "info");
    iniciarSeguimientoGPS();
  }
}

function crearIconoCirculo(numero, tipo = "parada") {
  let claseExtra = tipo === "A" ? "punto-a" : tipo === "B" ? "punto-b" : "";
  return L.divIcon({
    className: 'custom-circle-wrapper',
    html: `<div class="marker-circle-node ${claseExtra}">${numero}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function toggleLineaRuta() {
  lineaVisible = !lineaVisible;
  const btn = document.getElementById("btn-toggle-linea");
  if (lineaRutaActiva) {
    if (lineaVisible) {
      mapaReparto.addLayer(lineaRutaActiva);
      if (btn) btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Ocultar Linea';
    } else {
      mapaReparto.removeLayer(lineaRutaActiva);
      if (btn) btn.innerHTML = '<i class="fa-solid fa-eye"></i> Mostrar Linea';
    }
  }
}

async function buscarDireccion(punto) {
  const inputId = punto === 'A' ? "input-punto-a" : "input-punto-b";
  const query = document.getElementById(inputId)?.value;

  if (!query || query.trim() === "") {
    mostrarNotificacion("Atención", "Ingresá una dirección para buscar.", "info");
    return;
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      establecerPunto(punto, lat, lon, data[0].display_name);
    } else {
      mostrarNotificacion("Sin Resultados", "No se encontraron coordenadas para esa dirección.", "error");
    }
  } catch (err) {
    console.error("Error al buscar dirección:", err);
  }
}

function activarModoSeleccionMapa(punto) {
  modoSeleccionPunto = punto;
  const btnA = document.getElementById("btn-pick-a");
  const btnB = document.getElementById("btn-pick-b");

  if (punto === 'A') {
    btnA?.classList.add("active");
    btnB?.classList.remove("active");
  } else {
    btnB?.classList.add("active");
    btnA?.classList.remove("active");
  }
  mostrarNotificacion("Selección en Mapa", `Hacé clic sobre el mapa para ubicar el Punto ${punto}`, "info");
}

function desactivarModoSeleccion() {
  modoSeleccionPunto = null;
  document.getElementById("btn-pick-a")?.classList.remove("active");
  document.getElementById("btn-pick-b")?.classList.remove("active");
}

function establecerPunto(punto, lat, lng, etiqueta) {
  if (punto === 'A') {
    coordsPuntoA = [lat, lng];
    if (marcadorA) mapaReparto.removeLayer(marcadorA);
    marcadorA = L.marker([lat, lng], { icon: crearIconoCirculo('A', 'A') })
      .addTo(mapaReparto)
      .bindPopup(`<b>Inicio (A)</b><br>${etiqueta}`);
    document.getElementById("input-punto-a").value = etiqueta;
  } else {
    coordsPuntoB = [lat, lng];
    if (marcadorB) mapaReparto.removeLayer(marcadorB);
    marcadorB = L.marker([lat, lng], { icon: crearIconoCirculo('B', 'B') })
      .addTo(mapaReparto)
      .bindPopup(`<b>Fin (B)</b><br>${etiqueta}`);
    document.getElementById("input-punto-b").value = etiqueta;
  }

  mapaReparto.setView([lat, lng], 14);
}

function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function optimizarRecorridoSegmentado() {
  const metodo = document.getElementById("select-metodo-opt")?.value || "osrm";
  const conGeoloc = paquetesCargadosGlobal.filter(p => p.latitud && p.longitud);

  if (conGeoloc.length === 0) {
    mostrarNotificacion("Atención", "No hay paquetes con geolocalización para optimizar.", "info");
    return;
  }

  let ordenados = [];
  let noVisitados = [...conGeoloc];
  let actual = coordsPuntoA ? { latitud: coordsPuntoA[0], longitud: coordsPuntoA[1] } : noVisitados[0];

  if (!coordsPuntoA) {
    ordenados.push(actual);
    noVisitados = noVisitados.filter(p => p.id !== actual.id);
  }

  while (noVisitados.length > 0) {
    let masCercanoIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < noVisitados.length; i++) {
      const dist = calcularDistanciaHaversine(
        parseFloat(actual.latitud), parseFloat(actual.longitud),
        parseFloat(noVisitados[i].latitud), parseFloat(noVisitados[i].longitud)
      );
      if (dist < minDist) {
        minDist = dist;
        masCercanoIdx = i;
      }
    }

    actual = noVisitados[masCercanoIdx];
    ordenados.push(actual);
    noVisitados.splice(masCercanoIdx, 1);
  }

  ordenados.forEach((p, idx) => p.orden = idx + 1);
  paquetesCargadosGlobal = ordenados;

  renderizarHojaDeRuta(paquetesCargadosGlobal);
  renderizarMarcadoresMapa(paquetesCargadosGlobal);

  if (metodo === "osrm") {
    await trazarRutaOSRM();
  } else {
    trazarRutaVueloPajaro();
  }
}

function trazarRutaVueloPajaro() {
  if (lineaRutaActiva) mapaReparto.removeLayer(lineaRutaActiva);

  const puntosRuta = [];
  if (coordsPuntoA) puntosRuta.push(coordsPuntoA);

  paquetesCargadosGlobal.forEach(p => {
    if (p.latitud && p.longitud) puntosRuta.push([parseFloat(p.latitud), parseFloat(p.longitud)]);
  });

  if (coordsPuntoB) puntosRuta.push(coordsPuntoB);

  lineaRutaActiva = L.polyline(puntosRuta, { color: '#2563eb', weight: 4, dashArray: '6, 6' }).addTo(mapaReparto);
  if (!lineaVisible) mapaReparto.removeLayer(lineaRutaActiva);
  mapaReparto.fitBounds(lineaRutaActiva.getBounds(), { padding: [30, 30] });
}

async function trazarRutaOSRM() {
  const puntosRuta = [];
  if (coordsPuntoA) puntosRuta.push([coordsPuntoA[1], coordsPuntoA[0]]);

  paquetesCargadosGlobal.forEach(p => {
    if (p.latitud && p.longitud) puntosRuta.push([parseFloat(p.longitud), parseFloat(p.latitud)]);
  });

  if (coordsPuntoB) puntosRuta.push([coordsPuntoB[1], coordsPuntoB[0]]);

  if (puntosRuta.length < 2) return;

  const waypoints = puntosRuta.map(c => `${c[0]},${c[1]}`).join(";");
  const urlRoute = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(urlRoute);
    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      if (lineaRutaActiva) mapaReparto.removeLayer(lineaRutaActiva);

      const routeCoordinates = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      lineaRutaActiva = L.polyline(routeCoordinates, { color: '#2563eb', weight: 5, opacity: 0.8 }).addTo(mapaReparto);
      if (!lineaVisible) mapaReparto.removeLayer(lineaRutaActiva);
      mapaReparto.fitBounds(lineaRutaActiva.getBounds(), { padding: [30, 30] });
    }
  } catch (err) {
    console.error("Error al trazar ruta OSRM:", err);
  }
}

window.filtrarYBuscarPaquetes = function(textoBusqueda) {
  const query = textoBusqueda.toLowerCase().trim();
  
  const paquetesFiltrados = paquetesCargadosGlobal.filter(p => 
    p.sku_completo.toLowerCase().includes(query) ||
    p.sku_original.toLowerCase().includes(query) ||
    p.cliente_nombre.toLowerCase().includes(query) ||
    p.destinatario.toLowerCase().includes(query)
  );

  renderizarHojaDeRuta(paquetesFiltrados);
  renderizarMarcadoresMapa(paquetesFiltrados);

  if (paquetesFiltrados.length === 1 && paquetesFiltrados[0].latitud && paquetesFiltrados[0].longitud) {
    mapaReparto.setView([parseFloat(paquetesFiltrados[0].latitud), parseFloat(paquetesFiltrados[0].longitud)], 16);
  }
};

function renderizarMarcadoresMapa(listaData = paquetesCargadosGlobal) {
  marcadoresMapa.forEach(m => mapaReparto.removeLayer(m));
  marcadoresMapa = [];

  const puntosValidos = [];

  if (coordsPuntoA) puntosValidos.push(coordsPuntoA);

  listaData.forEach((pkg) => {
    if (pkg.latitud && pkg.longitud) {
      const lat = parseFloat(pkg.latitud);
      const lng = parseFloat(pkg.longitud);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        const marker = L.marker([lat, lng], { icon: crearIconoCirculo(pkg.orden) })
          .addTo(mapaReparto)
          .bindPopup(`
            <div style="font-size: 0.85rem; line-height: 1.4;">
              <b>Parada #${pkg.orden}</b><br>
              <span style="background: ${pkg.color_cliente}; color: #fff; padding: 1px 5px; border-radius: 3px; font-size: 0.7rem; font-weight: 600;">${pkg.cliente_nombre}</span><br>
              <b>SKU:</b> ${pkg.sku_original}<br>
              <b>Destinatario:</b> ${pkg.destinatario || 'S/D'}<br>
              ${pkg.alerta ? `<b style="color: #dc2626;">Alerta:</b> <span style="color: #dc2626;">${pkg.alerta}</span>` : ''}
            </div>
          `);

        marker.on('click', () => {
          enfocarPaqueteEnHojaDeRuta(pkg.id);
        });

        marcadoresMapa.push(marker);
        puntosValidos.push([lat, lng]);
      }
    }
  });

  if (coordsPuntoB) puntosValidos.push(coordsPuntoB);

  if (puntosValidos.length > 0) {
    const bounds = L.latLngBounds(puntosValidos);
    mapaReparto.fitBounds(bounds, { padding: [30, 30] });
  }
}

function enfocarPaqueteEnHojaDeRuta(idPaquete) {
  const cardEl = document.getElementById(`hoja-ruta-card-${idPaquete}`);
  if (cardEl) {
    cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    cardEl.classList.add('resaltar-paquete-flash');
    setTimeout(() => {
      cardEl.classList.remove('resaltar-paquete-flash');
    }, 2000);
  }
}

function renderizarHojaDeRuta(listaData = paquetesCargadosGlobal) {
  if (!listaHojaRutaContainer) return;
  listaHojaRutaContainer.innerHTML = "";

  const badgeTotal = document.getElementById("badge-total-hojaruta");
  if (badgeTotal) badgeTotal.textContent = `${listaData.length} Asignados`;

  listaData.forEach(pkg => {
    let backgroundCard = "#fff";
    const entregadoVal = (pkg.entregado_db || "").toLowerCase().trim();
    
    if (entregadoVal === "si") {
      backgroundCard = "rgba(22, 163, 74, 0.12)";
    } else if (entregadoVal === "no") {
      backgroundCard = "rgba(220, 38, 38, 0.12)";
    } else {
      backgroundCard = "#fff";
    }

    const card = document.createElement("div");
    card.id = `hoja-ruta-card-${pkg.id}`;
    card.style.cssText = `padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${backgroundCard}; cursor: pointer; transition: all 0.2s ease; margin-bottom: 8px;`;
    
    card.onclick = (e) => {
      if (e.target.closest('button')) return;
      if (pkg.latitud && pkg.longitud && mapaReparto) {
        mapaReparto.setView([parseFloat(pkg.latitud), parseFloat(pkg.longitud)], 17);
        enfocarPaqueteEnHojaDeRuta(pkg.id);
      } else {
        mostrarNotificacion("Aviso", "Este paquete no tiene coordenadas GPS asignadas.", "info");
      }
    };

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="badge-orden-num">${pkg.orden}</span>
          <button type="button" title="Foco en Mapa" onclick="event.stopPropagation(); if(${pkg.latitud && pkg.longitud}){ mapaReparto.setView([${pkg.latitud}, ${pkg.longitud}], 17); } else { mostrarNotificacion('Aviso', 'Sin GPS', 'info'); }" style="background: #2563eb; color: #fff; border: none; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 0.75rem;">
            <i class="fa-solid fa-crosshairs"></i>
          </button>
          <button type="button" onclick="event.stopPropagation(); abrirModalGestion('${pkg.id}')" style="background: #0f172a; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 500;">
            <i class="fa-solid fa-pen-to-square"></i> Detalle
          </button>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
        <span style="background: ${pkg.color_cliente}; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; display: inline-block;">${pkg.cliente_nombre}</span>
        <div style="font-weight: 600; font-size: 0.85rem; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pkg.sku_original}</div>
      </div>

      <div style="font-size: 0.78rem; color: #334155; margin-bottom: 2px;">orden: ${pkg.posicion_hr || '-'}</div>
      <div style="font-size: 0.78rem; color: #334155; margin-bottom: 2px;">Destinatario: <strong>${pkg.destinatario || 'S/D'}</strong></div>
      ${pkg.alerta ? `<div style="font-size: 0.75rem; color: #dc2626; font-weight: 700; margin-top: 2px;"><i class="fa-solid fa-triangle-exclamation"></i> Alerta: ${pkg.alerta}</div>` : ''}
      <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Obs: ${pkg.observaciones_entrega || 'Sin observaciones'}</div>
    `;
    listaHojaRutaContainer.appendChild(card);
  });
}

// ==========================================
// REGISTRO DE NOVEDADES Y FINALIZACIÓN (MODAL DINÁMICO CORREGIDO)
// ==========================================
window.abrirModalGestion = function(idPaquete) {
  paqueteEnGestion = paquetesCargadosGlobal.find(p => p.id == idPaquete);
  if (!paqueteEnGestion) return;

  const tituloPaquete = document.getElementById("modal-titulo-paquete");
  if (tituloPaquete) tituloPaquete.textContent = `Gestionar: ${paqueteEnGestion.sku_original}`;

  const modalBody = modalGestionEntrega.querySelector(".modal-body") || modalGestionEntrega.querySelector("div");
  if (modalBody) {
    modalGestionEntrega.innerHTML = `
      <div class="modal-content-wrapper" style="background: #fff; padding: 20px; border-radius: 8px; max-width: 450px; width: 100%; margin: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div id="modal-titulo-paquete" style="font-weight: bold; font-size: 1rem;">Gestionar: ${paqueteEnGestion.sku_original}</div>
          <button type="button" id="btn-cerrar-modal" onclick="cerrarModalGestion()" style="background: none; border: none; font-size: 1.1rem; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="margin-bottom: 10px;">
          <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 4px;">Entregado: <span style="color:red;">*</span></label>
          <select id="select-entregado-sino" class="form-control" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px;" onchange="actualizarCamposDinamicosGestion()">
            <option value="" disabled selected>-- Seleccione --</option>
            <option value="Si">Si</option>
            <option value="No">No</option>
          </select>
        </div>
        <div id="campos-dinamicos-gestion"></div>
        <div style="margin-top: 15px; display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" class="btn" onclick="cerrarModalGestion()" style="background: #e2e8f0; color: #1e293b; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">Cancelar</button>
          <button type="button" id="btn-guardar-estado-paquete" class="btn" onclick="guardarEstadoPaqueteBD()" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600;"><i class="fa-solid fa-floppy-disk"></i> Guardar Detalle</button>
        </div>
      </div>
    `;
  }

  const selectSiNo = document.getElementById("select-entregado-sino");
  if (selectSiNo) {
    selectSiNo.value = "";
    selectSiNo.onchange = actualizarCamposDinamicosGestion;
  }

  const contenedorDinamico = document.getElementById("campos-dinamicos-gestion");
  if (contenedorDinamico) contenedorDinamico.innerHTML = "";

  if (modalGestionEntrega) modalGestionEntrega.classList.add("active");
};

window.actualizarCamposDinamicosGestion = function() {
  const selectSiNo = document.getElementById("select-entregado-sino");
  const contenedorDinamico = document.getElementById("campos-dinamicos-gestion");
  if (!selectSiNo || !contenedorDinamico) return;

  const valor = selectSiNo.value;
  const intentos = paqueteEnGestion ? (paqueteEnGestion.intentos_vuelta || 1) : 1;

  if (valor === "Si") {
    contenedorDinamico.innerHTML = `
      <div style="margin-bottom: 8px;">
        <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 2px;">Nombre del que recibe: <span style="color:red;">*</span></label>
        <input type="text" id="input-nombre-recibe" class="form-control" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px;" value="${paqueteEnGestion.nombre_recibe || ''}" placeholder="Nombre completo" required>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 2px;">DNI del que recibe: <span style="color:red;">*</span></label>
        <input type="text" id="input-dni-recibe" class="form-control" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px;" value="${paqueteEnGestion.dni_recibe || ''}" placeholder="Número de DNI" required>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 2px;">Observación: <span style="color:#64748b; font-weight:400;">(Opcional)</span></label>
        <textarea id="textarea-obs-entrega" class="form-control" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px;" placeholder="Ej: Recibe familiar...">${paqueteEnGestion.observaciones_entrega || ''}</textarea>
      </div>
    `;
  } else if (valor === "No") {
    let opcionesMotivoHtml = '';
    if (intentos === 1) {
      opcionesMotivoHtml = `
        <option value="" disabled selected>-- Seleccione motivo --</option>
        <option value="No recibe">No recibe</option>
        <option value="No cel">No cel</option>
        <option value="No geo">No geo</option>
      `;
    } else {
      opcionesMotivoHtml = `
        <option value="" disabled selected>-- Seleccione motivo --</option>
        <option value="No recibe">No recibe</option>
      `;
    }

    const motivoActual = paqueteEnGestion.motivo_noentrega || "";

    contenedorDinamico.innerHTML = `
      <div style="margin-bottom: 8px;">
        <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 2px;">Motivo: <span style="color:red;">*</span></label>
        <select id="select-motivo-noentrega" class="form-control" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px;" required>
          ${opcionesMotivoHtml}
        </select>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 2px;">Foto de evidencia: <span style="color:red;">*</span></label>
        <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px;">
          <button type="button" class="btn btn-sm" onclick="abrirCamaraFotoGestion()" style="background: #2563eb; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;"><i class="fa-solid fa-camera"></i> Tomar Foto</button>
          <span id="label-foto-estado" style="font-size: 0.75rem; color: #64748b;">${paqueteEnGestion.foto_path || paqueteEnGestion.foto_temp_base64 ? 'Foto cargada' : 'Sin foto (Obligatoria)'}</span>
        </div>
        <video id="video-gestion-foto" autoplay playsinline style="width: 100%; max-height: 180px; background: #000; border-radius: 4px; display: none; margin-bottom: 4px;"></video>
        <canvas id="canvas-gestion-foto" style="display: none;"></canvas>
        <div id="preview-foto-container" style="margin-top: 4px;">
          ${paqueteEnGestion.foto_temp_base64 ? `<img src="${paqueteEnGestion.foto_temp_base64}" style="max-height: 100px; border-radius: 4px;" alt="Foto evidencia">` : (paqueteEnGestion.foto_path ? `<img src="${paqueteEnGestion.foto_path}" style="max-height: 100px; border-radius: 4px;" alt="Foto evidencia">` : '')}
        </div>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 2px;">Observación: <span style="color:#64748b; font-weight:400;">(Opcional)</span></label>
        <textarea id="textarea-obs-entrega" class="form-control" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px;" placeholder="Detalle adicional...">${paqueteEnGestion.observaciones_entrega || ''}</textarea>
      </div>
    `;

    if (motivoActual) {
      const selMotivo = document.getElementById("select-motivo-noentrega");
      if (selMotivo) selMotivo.value = motivoActual;
    }
  } else {
    contenedorDinamico.innerHTML = "";
  }
};

window.abrirCamaraFotoGestion = async function() {
  const videoEl = document.getElementById("video-gestion-foto");
  if (!videoEl) return;

  videoEl.style.display = "block";
  try {
    streamFotoGestion = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    videoEl.srcObject = streamFotoGestion;

    let btnCapturar = document.getElementById("btn-capturar-foto");
    if (!btnCapturar) {
      btnCapturar = document.createElement("button");
      btnCapturar.id = "btn-capturar-foto";
      btnCapturar.type = "button";
      btnCapturar.className = "btn btn-sm";
      btnCapturar.style.cssText = "background: #16a34a; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; margin-top: 4px; display: block;";
      btnCapturar.innerHTML = '<i class="fa-solid fa-circle-dot"></i> Capturar Foto';
      btnCapturar.onclick = capturarFotoDesdeVideo;
      videoEl.parentNode.insertBefore(btnCapturar, videoEl.nextSibling);
    }
  } catch (err) {
    console.error("Error al acceder a la cámara para foto:", err);
    mostrarNotificacion("Cámara", "No se pudo acceder a la cámara para tomar la foto.", "error");
  }
};

window.capturarFotoDesdeVideo = function() {
  const videoEl = document.getElementById("video-gestion-foto");
  const canvasEl = document.getElementById("canvas-gestion-foto");
  const previewContainer = document.getElementById("preview-foto-container");
  const labelEstado = document.getElementById("label-foto-estado");

  if (!videoEl || !canvasEl) return;

  canvasEl.width = videoEl.videoWidth || 640;
  canvasEl.height = videoEl.videoHeight || 480;
  const ctx = canvasEl.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

  const dataUrl = canvasEl.toDataURL("image/jpeg", 0.85);
  paqueteEnGestion.foto_temp_base64 = dataUrl;

  if (previewContainer) {
    previewContainer.innerHTML = `<img src="${dataUrl}" style="max-height: 100px; border-radius: 4px;" alt="Captura">`;
  }
  if (labelEstado) {
    labelEstado.textContent = "Foto capturada con éxito";
  }

  if (streamFotoGestion) {
    streamFotoGestion.getTracks().forEach(track => track.stop());
    streamFotoGestion = null;
  }
  videoEl.style.display = "none";
  const btnCapturar = document.getElementById("btn-capturar-foto");
  if (btnCapturar) btnCapturar.remove();
};

function cerrarModalGestion() {
  if (streamFotoGestion) {
    streamFotoGestion.getTracks().forEach(track => track.stop());
    streamFotoGestion = null;
  }
  if (modalGestionEntrega) modalGestionEntrega.classList.remove("active");
  paqueteEnGestion = null;
}

async function guardarEstadoPaqueteBD() {
  if (!paqueteEnGestion) return;

  const selectSiNo = document.getElementById("select-entregado-sino");
  const entregadoValor = selectSiNo ? selectSiNo.value : "";

  if (!entregadoValor) {
    mostrarNotificacion("Atención", "Debe seleccionar si fue entregado (Si o No).", "info");
    return;
  }

  const obsInput = document.getElementById("textarea-obs-entrega")?.value || "";
  const empresaId = obtenerEmpresaIdSesionActiva();
  const ahoraIso = new Date().toISOString();

  let datosActualizarDetalle = {
    entregado: entregadoValor,
    f_h_presentacion: ahoraIso,
    observaciones: obsInput,
    sku: paqueteEnGestion.sku_detalle || paqueteEnGestion.sku_completo || paqueteEnGestion.sku_original
  };

  let estadoDeposito = "Pendiente";
  let finalizadoDeposito = false;

  if (entregadoValor === "Si") {
    const nombreRecibe = document.getElementById("input-nombre-recibe")?.value.trim() || "";
    const dniRecibe = document.getElementById("input-dni-recibe")?.value.trim() || "";

    if (!nombreRecibe || !dniRecibe) {
      mostrarNotificacion("Atención", "Los campos Nombre y DNI del que recibe son obligatorios.", "info");
      return;
    }

    paqueteEnGestion.nombre_recibe = nombreRecibe;
    paqueteEnGestion.dni_recibe = dniRecibe;
    paqueteEnGestion.observaciones_entrega = obsInput;
    paqueteEnGestion.estado_entrega = "Si";

    datosActualizarDetalle.nombre = nombreRecibe;
    datosActualizarDetalle.dni = dniRecibe;

    estadoDeposito = "Entregado";
    finalizadoDeposito = true;

  } else {
    const motivoSelect = document.getElementById("select-motivo-noentrega")?.value || "";

    if (!motivoSelect) {
      mostrarNotificacion("Atención", "Debe seleccionar un motivo de no entrega.", "info");
      return;
    }

    if (!paqueteEnGestion.foto_temp_base64 && !paqueteEnGestion.foto_path) {
      mostrarNotificacion("Atención", "La foto de evidencia es obligatoria cuando no se entrega.", "info");
      return;
    }

    paqueteEnGestion.motivo_noentrega = motivoSelect;
    paqueteEnGestion.observaciones_entrega = obsInput;
    paqueteEnGestion.estado_entrega = "No";

    datosActualizarDetalle.motivo = motivoSelect;

    estadoDeposito = `No Entregado (${motivoSelect})`;
    finalizadoDeposito = true;

    if (paqueteEnGestion.foto_temp_base64) {
      try {
        const base64Data = paqueteEnGestion.foto_temp_base64.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });

        const formData = new FormData();
        formData.append('foto', blob, `foto_${Date.now()}.jpg`);
        formData.append('empresa_id', empresaId);
        formData.append('sku', paqueteEnGestion.sku_detalle || paqueteEnGestion.sku_completo || paqueteEnGestion.sku_original);

        const responseUpload = await fetch('http://localhost:3000/api/subir-foto', {
          method: 'POST',
          body: formData
        });

        const resultadoUpload = await responseUpload.json();

        if (resultadoUpload.success) {
          datosActualizarDetalle.foto = resultadoUpload.ruta;
          paqueteEnGestion.foto_path = resultadoUpload.ruta;
        } else {
          console.error("Error al subir foto al servidor:", resultadoUpload.error);
          mostrarNotificacion("Advertencia", "El estado se guardó, pero hubo un problema al guardar la foto en el host.", "info");
        }
      } catch (err) {
        console.error("Error de red al enviar la foto al servidor:", err);
        mostrarNotificacion("Advertencia", "El estado se guardó, pero no se pudo conectar con el servidor local para guardar la foto.", "info");
      }
    }
  }

  paqueteEnGestion.entregado_db = entregadoValor;

  const { error: errorDeposito } = await supabaseClientInstance
    .from("deposito")
    .update({ 
      estado: estadoDeposito, 
      finalizado: finalizadoDeposito,
      observaciones: obsInput 
    })
    .eq("id", paqueteEnGestion.id)
    .eq("empresa_id", empresaId);

  if (errorDeposito) {
    mostrarNotificacion("Error", "No se pudo actualizar el estado del paquete en depósito.", "error");
    return;
  }

  const { error: errorDetalle } = await supabaseClientInstance
    .from("distribucion_detalle")
    .update(datosActualizarDetalle)
    .eq("deposito_id", paqueteEnGestion.id);

  if (errorDetalle) {
    mostrarNotificacion("Error", "No se pudo actualizar los detalles de distribución.", "error");
    return;
  }

  cerrarModalGestion();
  renderizarHojaDeRuta(paquetesCargadosGlobal);
  renderizarMarcadoresMapa(paquetesCargadosGlobal);
  mostrarNotificacion("¡Éxito!", "Estado y datos de entrega guardados correctamente.", "exito");
}

async function finalizarRecorrido() {
  const pendientes = paquetesCargadosGlobal.filter(p => !p.entregado_db || p.entregado_db === '');
  if (pendientes.length > 0) {
    mostrarNotificacion("Atención", "Debes registrar el estado de entrega (Si o No) de cada paquete antes de finalizar el recorrido.", "info");
    return;
  }

  const empresaId = obtenerEmpresaIdSesionActiva();
  const customIds = idsDistribucionSeleccionadasGlobal.map(d => d.customId);

  const { error } = await supabaseClientInstance
    .from("distribucion")
    .update({ finalizado: true, estado: "Finalizado" })
    .eq("empresa_id", empresaId)
    .in("id_custom", customIds);

  if (error) {
    mostrarNotificacion("Error", "Error al intentar finalizar la distribución.", "error");
    return;
  }

  mostrarNotificacion("¡Éxito!", "Recorrido finalizado exitosamente.", "exito");
  cancelarProcesoASelector();
}