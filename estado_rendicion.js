// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = "https://zmanwspxuqwviyzpxtan.supabase.co";
const SUPABASE_KEY = "sb_publishable_geEnhhRNhJ8V7AuM_qSe6g_GEYvW_h_";

let supabase;
let empresaIdUsuario = null;
let rolUsuarioActivo = null;

// Elementos del DOM
let selectChoferFiltro, selectDistribucionFiltro, tablaEstadoReparto;
let kpiTotal, kpiEntregados, kpiPendientes;

document.addEventListener("DOMContentLoaded", async () => {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.supabaseClient = supabase; // Exponer para el cierre de sesión global si es requerido
  empresaIdUsuario = obtenerEmpresaIdSesionActiva();

  // Enlazar elementos
  selectChoferFiltro = document.getElementById("filtro-chofer-rendicion");
  selectDistribucionFiltro = document.getElementById("filtro-distribucion-rendicion");
  tablaEstadoReparto = document.querySelector("#tabla-estado-reparto tbody");
  
  kpiTotal = document.getElementById("kpi-total");
  kpiEntregados = document.getElementById("kpi-entregados");
  kpiPendientes = document.getElementById("kpi-pendientes");

  // Validaciones iniciales de seguridad y UI
  await verificarAccesoYPermisosFuncional();

  // Eventos de filtros
  if (selectChoferFiltro) {
    selectChoferFiltro.addEventListener("change", async (e) => {
      await cargarDistribucionesPorChofer(e.target.value);
    });
  }

  if (selectDistribucionFiltro) {
    selectDistribucionFiltro.addEventListener("change", async (e) => {
      await cargarEstadoPaquetesDistribucion(e.target.value);
    });
  }
});

function obtenerEmpresaIdSesionActiva() {
  const sesionGuardada = localStorage.getItem("andelaz_sesion");
  if (sesionGuardada) {
    try {
      const sesion = JSON.parse(sesionGuardada);
      return sesion.empresa_id || sesion.empresaId || sesion.id_empresa || null;
    } catch (e) {
      console.error("Error al leer la sesión", e);
    }
  }
  return localStorage.getItem("empresa_id") ? parseInt(localStorage.getItem("empresa_id")) : null;
}

async function verificarAccesoYPermisosFuncional() {
  const sesionGuardada = localStorage.getItem("andelaz_sesion");
  if (!sesionGuardada) return;

  try {
    const sesion = JSON.parse(sesionGuardada);
    const emailUsuario = sesion.email || sesion.user?.email;
    const permisosLocal = sesion.permisos || {};

    rolUsuarioActivo = (sesion.rol || "").toLowerCase().trim();
    const tienePermisoExtra = permisosLocal.ver_estado_rendicion === true;

    // Validación si el rol es admin explícito o tiene el permiso de estado y rendición en true
    const contenedorFiltroAdmin = document.getElementById("contenedor-filtro-chofer-admin");
    
    if (rolUsuarioActivo === "admin" || rolUsuarioActivo === "supervisor" || tienePermisoExtra) {
      if (contenedorFiltroAdmin) contenedorFiltroAdmin.style.display = "block";
      await cargarChoferesEmpresa();
      await cargarTodasLasDistribucionesEmpresa();
    } else {
      // Si es un chofer u operador común filtrado por su ID
      if (contenedorFiltroAdmin) contenedorFiltroAdmin.style.display = "none";
      await cargarDistribucionesChoferLogueado(sesion);
    }
  } catch (e) {
    console.error("Error al procesar permisos funcionales:", e);
  }
}

async function cargarChoferesEmpresa() {
  if (!selectChoferFiltro) return;

  const { data, error } = await supabase
    .from("choferes")
    .select("id, nombre")
    .eq("empresa_id", empresaIdUsuario);

  if (!error && data) {
    selectChoferFiltro.innerHTML = '<option value="">-- Todos los choferes --</option>';
    data.forEach(ch => {
      const opt = document.createElement("option");
      opt.value = ch.id;
      opt.textContent = ch.nombre;
      selectChoferFiltro.appendChild(opt);
    });
  }
}

async function cargarTodasLasDistribucionesEmpresa() {
  if (!selectDistribucionFiltro) return;

  const { data, error } = await supabase
    .from("distribucion")
    .select("id, id_custom, estado, chofer_id")
    .eq("empresa_id", empresaIdUsuario)
    .order("id", { ascending: false });

  if (error) {
    console.error("Error al cargar distribuciones:", error);
    return;
  }

  renderizarOpcionesDistribuciones(data || []);
}

async function cargarDistribucionesPorChofer(choferId) {
  if (!selectDistribucionFiltro) return;

  let query = supabase
    .from("distribucion")
    .select("id, id_custom, estado, chofer_id")
    .eq("empresa_id", empresaIdUsuario);

  if (choferId) {
    query = query.eq("chofer_id", choferId);
  }

  const { data, error } = await query.order("id", { ascending: false });

  if (!error) {
    renderizarOpcionesDistribuciones(data || []);
  }
}

async function cargarDistribucionesChoferLogueado(sesion) {
  if (!selectDistribucionFiltro) return;
  
  // Mapear o buscar el chofer asociado al email de sesión actual
  const email = sesion.email || sesion.user?.email;
  let choferId = null;

  if (email) {
    const { data: choferData } = await supabase
      .from("choferes")
      .select("id")
      .eq("empresa_id", empresaIdUsuario)
      .eq("email", email)
      .single();
      
    if (choferData) choferId = choferData.id;
  }

  let query = supabase
    .from("distribucion")
    .select("id, id_custom, estado, chofer_id")
    .eq("empresa_id", empresaIdUsuario);

  if (choferId) {
    query = query.eq("chofer_id", choferId);
  }

  const { data, error } = await query.order("id", { ascending: false });

  if (!error) {
    renderizarOpcionesDistribuciones(data || []);
  }
}

function renderizarOpcionesDistribuciones(lista) {
  selectDistribucionFiltro.innerHTML = '<option value="">-- Seleccione una distribución --</option>';
  if (lista.length === 0) {
    selectDistribucionFiltro.innerHTML = '<option value="">-- No hay distribuciones disponibles --</option>';
    limpiarTablaYMetricas();
    return;
  }

  lista.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = `ID: ${item.id} | Ref: ${item.id_custom || 'S/N'} - [Estado: ${item.estado || 'activo'}]`;
    selectDistribucionFiltro.appendChild(opt);
  });
}

async function cargarEstadoPaquetesDistribucion(distribucionId) {
  if (!distribucionId) {
    limpiarTablaYMetricas();
    return;
  }

  // Consultar todos los paquetes asociados a la distribución dentro de la empresa
  const { data: paquetes, error } = await supabase
    .from("deposito")
    .select("*")
    .eq("empresa_id", empresaIdUsuario)
    .eq("distribucion_id", distribucionId);

  if (error) {
    console.error("Error al consultar paquetes de la distribución:", error);
    alert("Hubo un error al obtener los datos del reparto.");
    return;
  }

  renderizarTablaYMetricas(paquetes || []);
}

function renderizarTablaYMetricas(paquetes) {
  tablaEstadoReparto.innerHTML = "";

  const total = paquetes.length;
  const entregados = paquetes.filter(p => p.estado === "entregado" || p.estado === "finalizado" || p.estado === "rendido").length;
  const pendientes = total - entregados;

  // Actualizar KPIs visuales
  if (kpiTotal) kpiTotal.textContent = total;
  if (kpiEntregados) kpiEntregados.textContent = entregados;
  if (kpiPendientes) kpiPendientes.textContent = pendientes;

  if (total === 0) {
    tablaEstadoReparto.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: #64748b;">No se encontraron registros de paquetes para esta distribución.</td></tr>`;
    return;
  }

  paquetes.forEach((pkg, index) => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #e2e8f0";
    
    // Color dinámico para la etiqueta de estado
    let badgeColor = "#f59e0b"; // pendiente por defecto
    if (pkg.estado === "entregado" || pkg.estado === "rendido") badgeColor = "#10b981";
    if (pkg.estado === "cancelado" || pkg.estado === "no_entregado") badgeColor = "#ef4444";

    tr.innerHTML = `
      <td style="padding: 12px;">${index + 1}</td>
      <td style="padding: 12px; font-weight: 500; color: #1e293b;">${pkg.destinatario || pkg.cliente || 'Sin nombre'}</td>
      <td style="padding: 12px; color: #475569;">${pkg.direccion || 'Sin dirección especificada'}</td>
      <td style="padding: 12px;">
        <span style="background: ${badgeColor}; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; text-transform: uppercase;">
          ${pkg.estado || 'Pendiente'}
        </span>
      </td>
      <td style="padding: 12px; color: #64748b; font-size: 0.9rem;">${pkg.observaciones || pkg.detalle || '-'}</td>
    `;
    tablaEstadoReparto.appendChild(tr);
  });
}

function limpiarTablaYMetricas() {
  if (kpiTotal) kpiTotal.textContent = "0";
  if (kpiEntregados) kpiEntregados.textContent = "0";
  if (kpiPendientes) kpiPendientes.textContent = "0";
  if (tablaEstadoReparto) {
    tablaEstadoReparto.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: #64748b;">Seleccione una distribución para ver el detalle completo.</td></tr>`;
  }
}