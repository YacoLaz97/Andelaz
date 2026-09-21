/**
 * ANDELAZ LOGISTICS - Módulo de Choferes
 * Actualizado con validación y marcado visual de usuarios choferes ya asignados,
 * y sincronización bidireccional con el campo chofer_id en la tabla usuarios.
 */

const SUPABASE_URL = "https://zmanwspxuqwviyzpxtan.supabase.co";
const SUPABASE_KEY = "sb_publishable_geEnhhRNhJ8V7AuM_qSe6g_GEYvW_h_";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

document.addEventListener('DOMContentLoaded', async () => {
  obtenerEmpresaIdSesionActiva();
  inicializarContenedorNotificaciones();
  await cargarContratistasSelect();
  await cargarChoferes(); // Cargamos choferes primero para tener mapeados los usuarios asignados
  configurarFormularioAlta();
  configurarFiltros();
  configurarModalesEdicionYVisor();
  configurarModalReasignacion();
  configurarModalEliminacion();
});

let cacheContratistas = [];
let choferesGlobales = [];
let usuariosGlobales = [];
let idChoferAEliminar = null;
let datosReasignacionPendiente = null;

function obtenerColorFecha(fechaStr) {
  if (!fechaStr) return '#94a3b8';
  const hoy = new Date();
  const fechaVenc = new Date(fechaStr);
  const diferenciaDias = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));

  if (diferenciaDias < 0) return '#dc2626';     
  if (diferenciaDias <= 7) return '#f97316';    
  if (diferenciaDias <= 30) return '#eab308';   
  return '#16a34a';                             
}

function inicializarContenedorNotificaciones() {
  if (document.getElementById('toast-container')) return;
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 350px;
  `;
  document.body.appendChild(container);
}

function mostrarNotificacion(mensaje, tipo = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const esError = tipo === 'error';
  
  toast.style.cssText = `
    background: ${esError ? '#1e1b4b' : '#0f172a'};
    color: #ffffff;
    padding: 14px 18px;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    border-left: 4px solid ${esError ? '#dc2626' : '#3b82f6'};
    font-family: inherit;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.3s ease;
  `;

  toast.innerHTML = `
    <span style="line-height: 1.4; flex-grow: 1;">${mensaje}</span>
    <button style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px; margin-left:10px;" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

async function cargarContratistasSelect() {
  const selectContratista = document.getElementById('contratista-select');
  const editContratista = document.getElementById('edit-contratista-select');
  const filtroContratista = document.getElementById('filtro-contratista');
  const selects = [selectContratista, editContratista, filtroContratista].filter(Boolean);

  if (selects.length === 0) return;

  try {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    let query = _supabase.from('contratistas').select('id, razon_social').order('razon_social', { ascending: true });
    if (empresaIdActual) query = query.eq('empresa_id', empresaIdActual);

    const { data: contratistas, error } = await query;
    if (error) throw error;
    
    cacheContratistas = contratistas || [];
    
    [selectContratista, editContratista].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = '<option value="">Seleccione un contratista...</option>';
      cacheContratistas.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.razon_social;
        sel.appendChild(option);
      });
    });

    if (filtroContratista) {
      filtroContratista.innerHTML = '<option value="">Todos los contratistas</option>';
      cacheContratistas.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.razon_social;
        filtroContratista.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Error al cargar contratistas:', err);
  }
}

async function cargarUsuariosChoferesSelect(usuarioIdActualEnEdicion = null, choferIdEnEdicion = null) {
  const selectUsuario = document.getElementById('usuario-select');
  const editUsuario = document.getElementById('edit-usuario-select');
  const selects = [selectUsuario, editUsuario].filter(Boolean);

  if (selects.length === 0) return;

  try {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    let query = _supabase.from('usuarios').select('id, nombre, email, rol, chofer_id').eq('rol', 'chofer').order('nombre', { ascending: true });
    if (empresaIdActual) query = query.eq('empresa_id', empresaIdActual);

    const { data: usuarios, error } = await query;
    if (error) throw error;

    usuariosGlobales = usuarios || [];

    selects.forEach(sel => {
      const valorSeleccionadoPrevio = sel.value;
      sel.innerHTML = '<option value="">Sin usuario asociado...</option>';

      usuariosGlobales.forEach(u => {
        // Determinamos si el usuario ya está asignado a otro chofer distinto al que estamos editando
        const estaAsignadoAOtro = u.chofer_id && String(u.chofer_id) !== String(choferIdEnEdicion);
        
        const option = document.createElement('option');
        option.value = u.id;
        
        if (estaAsignadoAOtro) {
          option.textContent = `${u.nombre || 'Sin nombre'} (${u.email || 'Sin email'}) - [YA ASIGNADO]`;
          option.classList.add('usuario-asignado');
        } else {
          option.textContent = `${u.nombre || 'Sin nombre'} (${u.email || 'Sin email'})`;
        }

        sel.appendChild(option);
      });

      // Restaurar selección previa si aplica
      if (valorSeleccionadoPrevio) {
        sel.value = valorSeleccionadoPrevio;
      }
    });

    if (usuarioIdActualEnEdicion && editUsuario) {
      editUsuario.value = usuarioIdActualEnEdicion;
    }
  } catch (err) {
    console.error('Error al cargar usuarios choferes:', err);
  }
}

function configurarFormularioAlta() {
  const form = document.getElementById('form-chofer');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const dni = document.getElementById('dni').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const contratistaIdVal = document.getElementById('contratista-select').value;
    const usuarioIdVal = document.getElementById('usuario-select').value;
    const vencimientoLicencia = document.getElementById('vencimiento-licencia').value;
    const activoVal = document.getElementById('activo-alta').value === 'true';

    if (!contratistaIdVal) {
      mostrarNotificacion('Por favor seleccione un contratista.', 'error');
      return;
    }

    // Validación estricta: verificar si el usuario ya fue asignado a otro chofer
    if (usuarioIdVal) {
      const usuarioSeleccionado = usuariosGlobales.find(u => String(u.id) === String(usuarioIdVal));
      if (usuarioSeleccionado && usuarioSeleccionado.chofer_id) {
        mostrarNotificacion(`Error: El usuario ${usuarioSeleccionado.nombre || usuarioSeleccionado.email} ya se encuentra asignado a otro chofer.`, 'error');
        return;
      }
    }

    try {
      const empresaIdActual = obtenerEmpresaIdSesionActiva();
      let nuevoChofer = {
        nombre_apellido: nombre,
        dni,
        telefono,
        contratista_id: parseInt(contratistaIdVal, 10),
        usuario_id: usuarioIdVal ? usuarioIdVal : null,
        vencimiento_licencia: vencimientoLicencia || null,
        activo: activoVal
      };

      if (empresaIdActual) nuevoChofer.empresa_id = empresaIdActual;

      // 1. Insertar el chofer y retornar su ID generado
      const { data: choferInsertado, error: errInsert } = await _supabase.from('choferes').insert([nuevoChofer]).select().single();
      if (errInsert) throw errInsert;

      const nuevoChoferId = choferInsertado.id;

      // 2. Si se seleccionó un usuario, actualizar su campo chofer_id con la ID del nuevo chofer
      if (usuarioIdVal) {
        let qUpUser = _supabase.from('usuarios').update({ chofer_id: nuevoChoferId }).eq('id', usuarioIdVal);
        if (empresaIdActual) qUpUser = qUpUser.eq('empresa_id', empresaIdActual);
        
        const { error: errUpUser } = await qUpUser;
        if (errUpUser) throw errUpUser;
      }

      mostrarNotificacion('Chofer guardado exitosamente.');
      form.reset();
      await cargarChoferes();
    } catch (err) {
      console.error('Error al guardar chofer:', err);
      mostrarNotificacion('Hubo un error al guardar el chofer: ' + err.message, 'error');
    }
  });
}

async function cargarChoferes() {
  const tbody = document.getElementById('tabla-choferes-body');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" class="empty-table-msg">Cargando choferes...</td></tr>`;

  try {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    let query = _supabase.from('choferes').select('*');
    if (empresaIdActual) query = query.eq('empresa_id', empresaIdActual);

    const { data: choferes, error: errChoferes } = await query;
    if (errChoferes) throw errChoferes;
    
    choferesGlobales = (choferes || []).sort((a, b) => a.id - b.id);

    if (cacheContratistas.length === 0) {
      let qCont = _supabase.from('contratistas').select('id, razon_social');
      if (empresaIdActual) qCont = qCont.eq('empresa_id', empresaIdActual);
      const { data: contratistasData } = await qCont;
      cacheContratistas = contratistasData || [];
    }

    // Actualizamos la lista de usuarios y sus estados de asignación en los selects
    await cargarUsuariosChoferesSelect();
    aplicarFiltrosYRenderizar();

  } catch (err) {
    console.error('Error general al cargar choferes:', err);
    tbody.innerHTML = `<tr><td colspan="8" class="empty-table-msg" style="color:red;">Error al cargar datos: ${err.message}</td></tr>`;
  }
}

async function aplicarFiltrosYRenderizar() {
  const textoBusqueda = (document.getElementById('input-buscar')?.value || '').toLowerCase().trim();
  const contratistaFiltroId = document.getElementById('filtro-contratista')?.value || '';

  let choferesFiltrados = choferesGlobales.filter(ch => {
    const cumpleTexto = 
      (ch.nombre_apellido || '').toLowerCase().includes(textoBusqueda) ||
      (ch.dni || '').toLowerCase().includes(textoBusqueda) ||
      (ch.telefono || '').toLowerCase().includes(textoBusqueda);

    const cumpleContratista = contratistaFiltroId === '' || String(ch.contratista_id) === String(contratistaFiltroId);

    return cumpleTexto && cumpleContratista;
  });

  const badgeCount = document.getElementById('badge-choferes-count');
  if (badgeCount) badgeCount.textContent = `${choferesFiltrados.length} reg.`;

  let unidades = [];
  const empresaIdActual = obtenerEmpresaIdSesionActiva();
  let qUnidades = _supabase.from('unidades').select('id, patente, tipo, modelo, contratista_id');
  if (empresaIdActual) qUnidades = qUnidades.eq('empresa_id', empresaIdActual);

  const { data: unidadesData, error: errUnidades } = await qUnidades;
  if (!errUnidades) {
    unidades = unidadesData || [];
  }

  renderizarTablaChoferes(choferesFiltrados, unidades);
}

function renderizarTablaChoferes(choferes, unidades) {
  const tbody = document.getElementById('tabla-choferes-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (choferes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-table-msg">No hay choferes registrados.</td></tr>`;
    return;
  }

  choferes.forEach(ch => {
    const unidadesContratista = unidades.filter(u => u.contratista_id === ch.contratista_id);

    let optionsHtml = `<option value="">Sin Unidad Asignada</option>`;
    unidadesContratista.forEach(u => {
      const selected = (String(ch.unidad_id) === String(u.id)) ? 'selected' : '';
      optionsHtml += `<option value="${u.id}" ${selected}>${u.patente} (${u.tipo || 'Vehículo'} - ${u.modelo || 'Sin modelo'})</option>`;
    });

    const contratistaEncontrado = cacheContratistas.find(c => c.id == ch.contratista_id);
    const nombreContratista = contratistaEncontrado ? contratistaEncontrado.razon_social : 'Sin Asignar';

    const colorLicencia = obtenerColorFecha(ch.vencimiento_licencia);
    const estadoActivo = ch.activo !== false; 
    const colorEstado = estadoActivo ? '#16a34a' : '#dc2626';
    const textoEstado = estadoActivo ? 'Activo' : 'Inactivo';

    const renderDocBadge = (fecha, url, label) => {
      if (!fecha && !url) return '<span style="color:#94a3b8;">N/D</span>';
      let html = `<div style="display: inline-block; background: ${colorLicencia}; color: #000000; font-weight: 600; padding: 2px 8px; border-radius: 12px; font-size: 11px;">${fecha || 'S/F'}</div>`;
      if (url) {
        html += `<br><a href="#" class="ver-doc" data-url="${url}" data-titulo="${label} - ${ch.nombre_apellido}" style="color:var(--primary-blue); font-size:11px; text-decoration:underline;">Ver Img</a>`;
      } else {
        html += `<br><span style="color:#cbd5e1; font-size:10px;">Sin img</span>`;
      }
      return html;
    };

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ch.nombre_apellido || '-'}</td>
      <td>${ch.dni || '-'}</td>
      <td>${ch.telefono || '-'}</td>
      <td>${nombreContratista}</td>
      <td>
        <div style="display: flex; gap: 6px; align-items: center;">
          <select id="select-unidad-${ch.id}" class="form-input" style="padding: 4px 8px; font-size: 12px; margin-bottom: 0;">
            ${optionsHtml}
          </select>
          <button class="btn-primary-sm" onclick="guardarUnidadChofer(${ch.id})" style="padding: 4px 10px; font-size: 11px; white-space: nowrap;">Guardar</button>
        </div>
      </td>
      <td>${renderDocBadge(ch.vencimiento_licencia, ch.foto_cedula, 'Licencia / Cédula')}</td>
      <td><span style="background: ${colorEstado}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;">${textoEstado}</span></td>
      <td style="text-align: right;">
        <button class="btn-primary-sm btn-editar-chofer" data-id="${ch.id}" style="padding: 5px 10px; font-size: 11px; background: #2563eb; margin-right: 4px;">Editar</button>
        <button class="btn-primary-sm" onclick="confirmarEliminarChofer(${ch.id})" style="padding: 5px 10px; font-size: 11px; background: #dc2626;">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.ver-doc').forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      const url = link.getAttribute('data-url');
      const titulo = link.getAttribute('data-titulo');
      const visorImg = document.getElementById('visor-img');
      const visorTitulo = document.getElementById('visor-titulo');
      const visorBtnDescargar = document.getElementById('visor-btn-descargar');
      const modalVisor = document.getElementById('modal-visor-imagen');

      if (visorTitulo) visorTitulo.innerText = titulo;
      if (visorImg) visorImg.src = url;
      if (visorBtnDescargar) visorBtnDescargar.href = url;
      if (modalVisor) modalVisor.style.display = 'flex';
    };
  });

  document.querySelectorAll('.btn-editar-chofer').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      await abrirModalEdicion(id);
    };
  });
}

async function guardarUnidadChofer(choferId) {
  const selectElement = document.getElementById(`select-unidad-${choferId}`);
  if (!selectElement) return;

  const nuevaUnidadId = selectElement.value ? parseInt(selectElement.value, 10) : null;
  const empresaIdActual = obtenerEmpresaIdSesionActiva();

  try {
    if (!nuevaUnidadId) {
      let qUp = _supabase.from('choferes').update({ unidad_id: null, patente_asignada: null }).eq('id', choferId);
      if (empresaIdActual) qUp = qUp.eq('empresa_id', empresaIdActual);

      const { error: errUpdate } = await qUp;
      if (errUpdate) throw errUpdate;
      mostrarNotificacion('Unidad desasignada exitosamente.');
      cargarChoferes();
      return;
    }

    let qUnidad = _supabase.from('unidades').select('id, patente').eq('id', nuevaUnidadId);
    if (empresaIdActual) qUnidad = qUnidad.eq('empresa_id', empresaIdActual);
    
    const { data: unidadData, error: errUnidad } = await qUnidad.single();
    if (errUnidad || !unidadData) throw new Error('No se pudo obtener la información de la unidad.');

    const patenteSeleccionada = unidadData.patente;

    const choferConUnidad = choferesGlobales.find(ch => String(ch.unidad_id) === String(nuevaUnidadId) && String(ch.id) !== String(choferId));

    if (choferConUnidad) {
      datosReasignacionPendiente = { 
        choferIdNuevo: choferId, 
        choferIdAnterior: choferConUnidad.id, 
        unidadId: nuevaUnidadId,
        patente: patenteSeleccionada
      };
      
      const mensajeEl = document.getElementById('modal-reasignar-mensaje');
      if (mensajeEl) {
        mensajeEl.innerHTML = `Esta unidad ya la tiene asignada el chofer <b>${choferConUnidad.nombre_apellido}</b>.<br><br>¿Deseas reasignarla? Al chofer anterior se le borrarán los datos de unidad y patente.`;
      }
      
      const modalReasignar = document.getElementById('modal-confirmar-reasignar');
      if (modalReasignar) {
        modalReasignar.style.display = 'flex';
      }
      return;
    }

    await ejecutarCambioUnidad(choferId, nuevaUnidadId, patenteSeleccionada);

  } catch (err) {
    console.error('Error al actualizar unidad:', err);
    mostrarNotificacion('Hubo un error al actualizar la unidad: ' + err.message, 'error');
  }
}

async function ejecutarCambioUnidad(choferIdNuevo, unidadId, patente, choferIdAnterior = null) {
  try {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();

    if (choferIdAnterior) {
      let qQuitar = _supabase.from('choferes').update({ unidad_id: null, patente_asignada: null }).eq('id', choferIdAnterior);
      if (empresaIdActual) qQuitar = qQuitar.eq('empresa_id', empresaIdActual);

      const { error: errQuitar } = await qQuitar;
      if (errQuitar) throw errQuitar;
    }

    let qAsignar = _supabase.from('choferes').update({ 
      unidad_id: unidadId, 
      patente_asignada: patente 
    }).eq('id', choferIdNuevo);
    
    if (empresaIdActual) qAsignar = qAsignar.eq('empresa_id', empresaIdActual);

    const { error: errAsignar } = await qAsignar;
    if (errAsignar) throw errAsignar;

    mostrarNotificacion('Unidad y patente asignadas exitosamente.');
    cargarChoferes();
  } catch (err) {
    console.error('Error en la reasignación:', err);
    mostrarNotificacion('Error al reasignar la unidad: ' + err.message, 'error');
  }
}

function configurarModalReasignacion() {
  const modalReasignar = document.getElementById('modal-confirmar-reasignar');
  const btnCancelarReasignar = document.getElementById('btn-cancelar-reasignar');
  const btnAceptarReasignar = document.getElementById('btn-aceptar-reasignar');

  if (btnCancelarReasignar && modalReasignar) {
    btnCancelarReasignar.onclick = () => {
      modalReasignar.style.display = 'none';
      datosReasignacionPendiente = null;
      cargarChoferes();
    };
  }

  if (btnAceptarReasignar && modalReasignar) {
    btnAceptarReasignar.onclick = async () => {
      if (datosReasignacionPendiente) {
        modalReasignar.style.display = 'none';
        await ejecutarCambioUnidad(
          datosReasignacionPendiente.choferIdNuevo, 
          datosReasignacionPendiente.unidadId, 
          datosReasignacionPendiente.patente,
          datosReasignacionPendiente.choferIdAnterior
        );
        datosReasignacionPendiente = null;
      }
    };
  }
}

function configurarModalEliminacion() {
  const modalEliminar = document.getElementById('modal-confirmar-eliminar');
  const btnCancelarEliminar = document.getElementById('btn-cancelar-eliminar');
  const btnAceptarEliminar = document.getElementById('btn-aceptar-eliminar');

  if (btnCancelarEliminar && modalEliminar) {
    btnCancelarEliminar.onclick = () => {
      modalEliminar.style.display = 'none';
      idChoferAEliminar = null;
    };
  }

  if (btnAceptarEliminar && modalEliminar) {
    btnAceptarEliminar.onclick = async () => {
      if (idChoferAEliminar !== null) {
        const idTemp = idChoferAEliminar;
        modalEliminar.style.display = 'none';
        idChoferAEliminar = null;
        await eliminarChoferDirecto(idTemp);
      }
    };
  }
}

function configurarModalesEdicionYVisor() {
  const modalEditar = document.getElementById('modal-editar-chofer');
  const btnCloseEditar = document.getElementById('btn-close-editar-chofer');
  const btnCancelarEditar = document.getElementById('btn-cancelar-editar-chofer');
  const formEditar = document.getElementById('form-editar-chofer');

  const modalVisor = document.getElementById('modal-visor-imagen');
  const btnCloseVisor = document.getElementById('btn-close-visor');

  if (btnCloseEditar && modalEditar) btnCloseEditar.onclick = () => modalEditar.style.display = 'none';
  if (btnCancelarEditar && modalEditar) btnCancelarEditar.onclick = () => modalEditar.style.display = 'none';
  if (btnCloseVisor && modalVisor) modalVisor.onclick = () => modalVisor.style.display = 'none';

  if (formEditar) {
    formEditar.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-chofer-id').value;
      const nombre = document.getElementById('edit-nombre').value.trim();
      const dni = document.getElementById('edit-dni').value.trim();
      const telefono = document.getElementById('edit-telefono').value.trim();
      const contratistaId = document.getElementById('edit-contratista-select').value;
      const usuarioIdNuevo = document.getElementById('edit-usuario-select').value;
      const vencimiento = document.getElementById('edit-vencimiento-licencia').value;
      const activoVal = document.getElementById('edit-activo').value === 'true';
      const fileInput = document.getElementById('file-cedula-chofer');
      const empresaIdActual = obtenerEmpresaIdSesionActiva();

      // Validación de usuario ya asignado en edición
      if (usuarioIdNuevo) {
        const usuarioSeleccionado = usuariosGlobales.find(u => String(u.id) === String(usuarioIdNuevo));
        if (usuarioSeleccionado && usuarioSeleccionado.chofer_id && String(usuarioSeleccionado.chofer_id) !== String(id)) {
          mostrarNotificacion(`Error: El usuario ${usuarioSeleccionado.nombre || usuarioSeleccionado.email} ya está asignado a otro chofer.`, 'error');
          return;
        }
      }

      try {
        let fotoUrl = null;
        if (fileInput && fileInput.files.length > 0) {
          fotoUrl = await subirFotoCedulaChofer(fileInput, dni);
        }

        // Obtenemos el chofer antes de actualizar para saber si cambió o removió el usuario anterior
        let qChoferAntiguo = _supabase.from('choferes').select('usuario_id').eq('id', id);
        if (empresaIdActual) qChoferAntiguo = qChoferAntiguo.eq('empresa_id', empresaIdActual);
        const { data: choferAntiguoData } = await qChoferAntiguo.single();
        const usuarioIdAntiguo = choferAntiguoData ? choferAntiguoData.usuario_id : null;

        const datosActualizados = {
          nombre_apellido: nombre,
          dni,
          telefono,
          contratista_id: contratistaId ? parseInt(contratistaId, 10) : null,
          usuario_id: usuarioIdNuevo ? usuarioIdNuevo : null,
          vencimiento_licencia: vencimiento || null,
          activo: activoVal
        };

        if (fotoUrl) datosActualizados.foto_cedula = fotoUrl;

        let qUp = _supabase.from('choferes').update(datosActualizados).eq('id', id);
        if (empresaIdActual) qUp = qUp.eq('empresa_id', empresaIdActual);

        const { error } = await qUp;
        if (error) throw error;

        // Sincronización cruzada en tabla usuarios:
        // 1. Si se desvinculó el usuario anterior, limpiamos su chofer_id
        if (usuarioIdAntiguo && String(usuarioIdAntiguo) !== String(usuarioIdNuevo)) {
          let qClean = _supabase.from('usuarios').update({ chofer_id: null }).eq('id', usuarioIdAntiguo);
          if (empresaIdActual) qClean = qClean.eq('empresa_id', empresaIdActual);
          await qClean;
        }

        // 2. Si se asignó un nuevo usuario, actualizamos su chofer_id
        if (usuarioIdNuevo) {
          let qSet = _supabase.from('usuarios').update({ chofer_id: id }).eq('id', usuarioIdNuevo);
          if (empresaIdActual) qSet = qSet.eq('empresa_id', empresaIdActual);
          await qSet;
        }

        if (modalEditar) modalEditar.style.display = 'none';
        mostrarNotificacion('Chofer actualizado correctamente.');
        await cargarChoferes();
      } catch (err) {
        console.error('Error al actualizar chofer:', err);
        mostrarNotificacion('Error al actualizar: ' + err.message, 'error');
      }
    };
  }
}

async function subirFotoCedulaChofer(fileInput, dni) {
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) return null;
  const file = fileInput.files[0];
  const fileExt = file.name.split('.').pop();
  const filePath = `choferes/${dni}_cedula.${fileExt}`;

  const { error: uploadError } = await _supabase.storage
    .from('documentos-choferes')
    .upload(filePath, file, { cacheControl: '3600', upsert: true });

  if (uploadError) throw new Error(`Error en storage: ${uploadError.message}`);

  const { data } = _supabase.storage.from('documentos-choferes').getPublicUrl(filePath);
  return data ? data.publicUrl : null;
}

async function abrirModalEdicion(id) {
  const modalEditar = document.getElementById('modal-editar-chofer');
  if (!modalEditar) return;

  try {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    let qGet = _supabase.from('choferes').select('*').eq('id', id);
    if (empresaIdActual) qGet = qGet.eq('empresa_id', empresaIdActual);

    const { data: ch, error } = await qGet.single();
    if (error || !ch) throw error || new Error('No se encontró el chofer.');

    document.getElementById('edit-chofer-id').value = ch.id;
    document.getElementById('edit-nombre').value = ch.nombre_apellido || '';
    document.getElementById('edit-dni').value = ch.dni || '';
    document.getElementById('edit-telefono').value = ch.telefono || '';
    document.getElementById('edit-contratista-select').value = ch.contratista_id || '';
    
    // Cargar select de usuarios pasando el ID del chofer actual para permitir seleccionarlo a él mismo si ya lo tenía
    await cargarUsuariosChoferesSelect(ch.usuario_id, ch.id);

    document.getElementById('edit-vencimiento-licencia').value = ch.vencimiento_licencia || '';
    document.getElementById('edit-activo').value = ch.activo !== false ? 'true' : 'false';
    
    const fileInput = document.getElementById('file-cedula-chofer');
    if (fileInput) fileInput.value = '';

    modalEditar.style.display = 'flex';
  } catch (err) {
    console.error('Error al abrir edición:', err);
    mostrarNotificacion('No se pudo cargar la información del chofer.', 'error');
  }
}

function configurarFiltros() {
  const inputBuscar = document.getElementById('input-buscar');
  const filtroContratista = document.getElementById('filtro-contratista');

  if (inputBuscar) {
    inputBuscar.addEventListener('input', () => {
      aplicarFiltrosYRenderizar();
    });
  }

  if (filtroContratista) {
    filtroContratista.addEventListener('change', () => {
      aplicarFiltrosYRenderizar();
    });
  }
}

function confirmarEliminarChofer(id) {
  idChoferAEliminar = id;
  const modalEliminar = document.getElementById('modal-confirmar-eliminar');
  if (modalEliminar) {
    modalEliminar.style.display = 'flex';
  } else {
    eliminarChoferDirecto(id);
  }
}

async function eliminarChoferDirecto(id) {
  try {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();

    // 1. Limpiar el chofer_id en la tabla usuarios de cualquier usuario vinculado a este chofer
    let qCleanUser = _supabase.from('usuarios').update({ chofer_id: null }).eq('chofer_id', id);
    if (empresaIdActual) qCleanUser = qCleanUser.eq('empresa_id', empresaIdActual);
    await qCleanUser;

    // 2. Eliminar el chofer
    let qDel = _supabase.from('choferes').delete().eq('id', id);
    if (empresaIdActual) qDel = qDel.eq('empresa_id', empresaIdActual);

    const { error } = await qDel;
    if (error) throw error;

    mostrarNotificacion('Chofer eliminado correctamente.');
    await cargarChoferes();
  } catch (err) {
    console.error('Error al eliminar:', err);
    mostrarNotificacion('No se pudo eliminar el chofer.', 'error');
  }
}