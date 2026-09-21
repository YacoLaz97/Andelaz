/**
 * ANDELAZ LOGISTICS - Módulo de Unidades
 * Actualizado con filtrado por empresa activa.
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

// Función auxiliar para calcular colores según días faltantes para el vencimiento
function obtenerColorFecha(fechaStr) {
  if (!fechaStr) return '#94a3b8';
  const hoy = new Date();
  const fechaVenc = new Date(fechaStr);
  const diferenciaDias = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));

  if (diferenciaDias < 0) return '#dc2626';     // Rojo (Vencido)
  if (diferenciaDias <= 7) return '#f97316';    // Naranja (< 7 días)
  if (diferenciaDias <= 30) return '#eab308';   // Amarillo (Vence este mes)
  return '#16a34a';                             // Verde (Vigente)
}

document.addEventListener('DOMContentLoaded', () => {
  obtenerEmpresaIdSesionActiva();

  const formUnidad = document.getElementById('form-unidad');
  const inputPatente = document.getElementById('patente');
  const inputTipo = document.getElementById('tipo');
  const inputModelo = document.getElementById('modelo');
  const inputAnio = document.getElementById('anio');
  const selectContratista = document.getElementById('contratista-id');
  const inputBuscar = document.getElementById('input-buscar');
  
  const tablaBody = document.getElementById('tabla-unidades-body');
  const badgeCount = document.getElementById('badge-unidades-count');

  // Inyectar selector de filtro por contratista de forma dinámica en el header de la tabla
  const headerPanel = document.querySelector('.panel-card .panel-header');
  let selectFiltroContratista = document.getElementById('filtro-contratista');
  if (headerPanel && !selectFiltroContratista) {
    const contenedorFiltros = headerPanel.querySelector('div') || headerPanel;
    const selectHtml = document.createElement('select');
    selectHtml.id = 'filtro-contratista';
    selectHtml.className = 'form-input';
    selectHtml.style.cssText = 'padding: 4px 8px; font-size: 12px; width: 180px; margin-bottom: 0; background: white;';
    selectHtml.innerHTML = '<option value="">Todos los contratistas</option>';
    
    // Insertarlo antes del input de búsqueda o junto a él
    if (inputBuscar) {
      inputBuscar.parentNode.insertBefore(selectHtml, inputBuscar);
    } else {
      contenedorFiltros.appendChild(selectHtml);
    }
    selectFiltroContratista = selectHtml;
  }

  // Modales
  const modalEditar = document.getElementById('modal-editar');
  const btnCloseEditar = document.getElementById('btn-close-editar');
  const btnCancelarEditar = document.getElementById('btn-cancelar-editar');
  const formEditar = document.getElementById('form-editar');
  
  const editId = document.getElementById('edit-id');
  const editPatente = document.getElementById('edit-patente');
  const editTipo = document.getElementById('edit-tipo');
  const editModelo = document.getElementById('edit-modelo');
  const editAnio = document.getElementById('edit-anio');
  const editContratista = document.getElementById('edit-contratista-id');
  const editCedula = document.getElementById('edit-cedula');
  const editSeguro = document.getElementById('edit-seguro');
  const editVtv = document.getElementById('edit-vtv');
  const editActivo = document.getElementById('edit-activo');

  const fileCedula = document.getElementById('file-cedula');
  const fileSeguro = document.getElementById('file-seguro');
  const fileVtv = document.getElementById('file-vtv');

  const modalEliminar = document.getElementById('modal-confirmar-eliminar');
  const btnConfirmarEliminar = document.getElementById('btn-confirmar-eliminar');
  const btnCancelarEliminar = document.getElementById('btn-cancelar-eliminar');
  let idUnidadAEliminar = null;

  // Visor de imágenes
  const modalVisor = document.getElementById('modal-visor-imagen');
  const visorImg = document.getElementById('visor-img');
  const visorTitulo = document.getElementById('visor-titulo');
  const visorBtnDescargar = document.getElementById('visor-btn-descargar');
  const btnCloseVisor = document.getElementById('btn-close-visor');

  let todasLasUnidades = [];

  function abrirModal(modal) {
    if (modal) modal.style.display = 'flex';
  }

  function cerrarModal(modal) {
    if (modal) modal.style.display = 'none';
  }

  if (btnCloseVisor) {
    btnCloseVisor.onclick = () => cerrarModal(modalVisor);
  }

  function mostrarAlerta(titulo, mensaje, esExito = false, callback = null) {
    const modalAlerta = document.getElementById("modal-alerta");
    const tituloEl = document.getElementById("alerta-titulo");
    const mensajeEl = document.getElementById("alerta-mensaje");
    const btnAceptar = document.getElementById("alerta-btn-aceptar");

    if (!modalAlerta) {
      alert(`${titulo}: ${mensaje}`);
      if (callback) callback();
      return;
    }

    tituloEl.innerText = titulo;
    tituloEl.style.color = esExito ? "#16a34a" : "#dc2626";
    mensajeEl.innerText = mensaje;
    abrirModal(modalAlerta);

    btnAceptar.onclick = () => {
      cerrarModal(modalAlerta);
      if (callback) callback();
    };
  }

  async function cargarSelectContratistas() {
    const selects = [selectContratista, editContratista, selectFiltroContratista];
    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    
    let query = _supabase
      .from('contratistas')
      .select('id, razon_social')
      .order('razon_social', { ascending: true });

    if (empresaIdActual) query = query.eq('empresa_id', empresaIdActual);

    const { data, error } = await query;

    if (error) {
      console.error("Error al cargar contratistas:", error.message);
      return;
    }

    selects.forEach(sel => {
      if (!sel) return;
      const esFiltro = sel.id === 'filtro-contratista';
      sel.innerHTML = esFiltro ? '<option value="">Todos los contratistas</option>' : '<option value="">Seleccione un contratista...</option>';
      
      (data || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.razon_social;
        sel.appendChild(opt);
      });
    });
  }

  async function cargarUnidades() {
    if (!tablaBody) return;

    tablaBody.innerHTML = '<tr><td colspan="8" class="empty-table-msg">Cargando unidades...</td></tr>';
    const empresaIdActual = obtenerEmpresaIdSesionActiva();

    let query = _supabase
      .from('unidades')
      .select('*, contratistas(razon_social)')
      .order('patente', { ascending: true });

    if (empresaIdActual) query = query.eq('empresa_id', empresaIdActual);

    const { data: unidades, error } = await query;

    if (error) {
      console.error("Error cargando unidades:", error.message);
      tablaBody.innerHTML = '<tr><td colspan="8" class="empty-table-msg" style="color:red;">Error al cargar unidades.</td></tr>';
      return;
    }

    todasLasUnidades = unidades || [];
    aplicarFiltros();
  }

  function renderizarTabla(lista) {
    if (badgeCount) badgeCount.innerText = `${lista.length} reg.`;

    if (lista.length === 0) {
      tablaBody.innerHTML = '<tr><td colspan="8" class="empty-table-msg">No se encontraron unidades registradas.</td></tr>';
      return;
    }

    tablaBody.innerHTML = '';
    lista.forEach(u => {
      const nombreContratista = u.contratistas ? u.contratistas.razon_social : 'Sin asignar';
      const estadoActivo = u.activo !== false; 
      const colorEstado = estadoActivo ? '#16a34a' : '#dc2626';
      const textoEstado = estadoActivo ? 'Activo' : 'Inactivo';

      const renderDocBadge = (fecha, url, label) => {
        if (!fecha && !url) return '<span style="color:#94a3b8;">N/D</span>';
        const colorFecha = obtenerColorFecha(fecha);
        let html = `<div style="display: inline-block; background: ${colorFecha}; color: #000000; font-weight: 600; padding: 2px 8px; border-radius: 12px; font-size: 11px;">${fecha || 'S/F'}</div>`;
        
        if (url) {
          html += `<br><a href="#" class="ver-doc" data-url="${url}" data-titulo="${label} - ${u.patente}" style="color:var(--primary-blue); font-size:11px; text-decoration:underline;">Ver Img</a>`;
        } else {
          html += `<br><span style="color:#cbd5e1; font-size:10px;">Sin img</span>`;
        }
        return html;
      };

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight: 600; color: var(--primary-blue);">${u.patente || '-'}</div>
        </td>
        <td>${u.tipo ? u.tipo.toUpperCase() : '-'} (${u.modelo || '-'} - ${u.anio || '-'})</td>
        <td style="font-weight: 500;">${nombreContratista}</td>
        <td>${renderDocBadge(u.vencimiento_cedula, u.foto_cedula, 'Cédula')}</td>
        <td>${renderDocBadge(u.vencimiento_seguro, u.foto_seguro, 'Seguro')}</td>
        <td>${renderDocBadge(u.vencimiento_vtv_rto, u.foto_vtv_rto, 'VTV')}</td>
        <td>
          <span style="background: ${colorEstado}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; display: inline-block;">${textoEstado}</span>
        </td>
        <td style="text-align: right;">
          <button type="button" class="btn-editar-accion" data-id="${u.id}" style="background: #2563eb; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; margin-right: 4px;">Editar</button>
          <button type="button" class="btn-eliminar-accion" data-id="${u.id}" style="background: #dc2626; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">Eliminar</button>
        </td>
      `;
      tablaBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-editar-accion').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        await abrirModalEdicion(id);
      };
    });

    document.querySelectorAll('.btn-eliminar-accion').forEach(btn => {
      btn.onclick = () => {
        idUnidadAEliminar = btn.getAttribute('data-id');
        abrirModal(modalEliminar);
      };
    });

    document.querySelectorAll('.ver-doc').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        const url = link.getAttribute('data-url');
        const titulo = link.getAttribute('data-titulo');
        visorTitulo.innerText = titulo;
        visorImg.src = url;
        visorBtnDescargar.href = url;
        abrirModal(modalVisor);
      };
    });
  }

  function aplicarFiltros() {
    const query = inputBuscar ? inputBuscar.value.toLowerCase().trim() : '';
    const contratistaIdFiltro = selectFiltroContratista ? selectFiltroContratista.value : '';

    const filtradas = todasLasUnidades.filter(u => {
      const patente = (u.patente || '').toLowerCase();
      const tipo = (u.tipo || '').toLowerCase();
      const modelo = (u.modelo || '').toLowerCase();
      const contratista = (u.contratistas?.razon_social || '').toLowerCase();

      const cumpleTexto = patente.includes(query) || tipo.includes(query) || modelo.includes(query) || contratista.includes(query);
      const cumpleContratista = !contratistaIdFiltro || (u.contratista_id && u.contratista_id.toString() === contratistaIdFiltro);

      return cumpleTexto && cumpleContratista;
    });

    renderizarTabla(filtradas);
  }

  if (inputBuscar) {
    inputBuscar.oninput = () => aplicarFiltros();
  }

  if (selectFiltroContratista) {
    selectFiltroContratista.onchange = () => aplicarFiltros();
  }

  if (formUnidad) {
    formUnidad.onsubmit = async (e) => {
      e.preventDefault();
      const patenteIngresada = inputPatente.value.trim().toUpperCase();
      const empresaIdActual = obtenerEmpresaIdSesionActiva();

      let queryExiste = _supabase
        .from('unidades')
        .select('id')
        .eq('patente', patenteIngresada);
      
      if (empresaIdActual) queryExiste = queryExiste.eq('empresa_id', empresaIdActual);

      const { data: existe } = await queryExiste.maybeSingle();

      if (existe) {
        mostrarAlerta("Patente Duplicada", `La patente "${patenteIngresada}" ya se encuentra registrada en el sistema.`, false);
        return;
      }

      const nuevaUnidad = {
        patente: patenteIngresada,
        tipo: inputTipo.value.trim(),
        modelo: inputModelo.value.trim() || null,
        anio: inputAnio.value ? parseInt(inputAnio.value) : null,
        contratista_id: selectContratista.value ? parseInt(selectContratista.value) : null,
        vencimiento_cedula: document.getElementById('vencimiento-cedula')?.value || null,
        vencimiento_seguro: document.getElementById('vencimiento-seguro')?.value || null,
        vencimiento_vtv_rto: document.getElementById('vencimiento-vtv')?.value || null,
        activo: true
      };

      if (empresaIdActual) nuevaUnidad.empresa_id = empresaIdActual;

      const { error } = await _supabase.from('unidades').insert([nuevaUnidad]);

      if (error) {
        mostrarAlerta("Error al Guardar", error.message, false);
      } else {
        mostrarAlerta("¡Éxito!", "Unidad registrada correctamente. Ya puedes cargar sus imágenes desde el botón Editar.", true, () => {
          formUnidad.reset();
          cargarUnidades();
        });
      }
    };
  }

  async function abrirModalEdicion(id) {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    let query = _supabase
      .from('unidades')
      .select('*')
      .eq('id', id);

    if (empresaIdActual) query = query.eq('empresa_id', empresaIdActual);

    const { data, error } = await query.single();

    if (error || !data) {
      mostrarAlerta("Error", "No se pudo cargar la unidad para editar.", false);
      return;
    }

    editId.value = data.id;
    editPatente.value = data.patente || '';
    editTipo.value = data.tipo || '';
    editModelo.value = data.modelo || '';
    editAnio.value = data.anio || '';
    editContratista.value = data.contratista_id || '';
    editCedula.value = data.vencimiento_cedula || '';
    editSeguro.value = data.vencimiento_seguro || '';
    editVtv.value = data.vencimiento_vtv_rto || '';
    if (editActivo) editActivo.value = data.activo !== false ? 'true' : 'false';

    if (fileCedula) fileCedula.value = '';
    if (fileSeguro) fileSeguro.value = '';
    if (fileVtv) fileVtv.value = '';

    abrirModal(modalEditar);
  }

  async function subirArchivoSiExiste(fileInput, patente, nombreCampo) {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return null;
    const file = fileInput.files[0];
    const fileExt = file.name.split('.').pop();
    
    const fileName = `${patente}_${nombreCampo}.${fileExt}`;
    const filePath = `unidades/${fileName}`;

    const { error: uploadError } = await _supabase.storage
      .from('documentos-unidades')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error(`Error al subir ${nombreCampo}:`, uploadError.message);
      throw new Error(`Error en storage (${nombreCampo}): ${uploadError.message}`);
    }

    const { data } = _supabase.storage
      .from('documentos-unidades')
      .getPublicUrl(filePath);

    return data ? data.publicUrl : null;
  }

  if (formEditar) {
    formEditar.onsubmit = async (e) => {
      e.preventDefault();

      const id = editId.value;
      const patenteActual = editPatente.value.trim().toUpperCase();
      const empresaIdActual = obtenerEmpresaIdSesionActiva();

      let queryDuplicada = _supabase
        .from('unidades')
        .select('id')
        .eq('patente', patenteActual)
        .neq('id', id);

      if (empresaIdActual) queryDuplicada = queryDuplicada.eq('empresa_id', empresaIdActual);

      const { data: duplicada } = await queryDuplicada.maybeSingle();

      if (duplicada) {
        mostrarAlerta("Patente Duplicada", `La patente "${patenteActual}" ya pertenece a otro vehículo registrado.`, false);
        return;
      }

      try {
        let urlCedula = null;
        let urlSeguro = null;
        let urlVtv = null;

        if (fileCedula && fileCedula.files.length > 0) {
          urlCedula = await subirArchivoSiExiste(fileCedula, patenteActual, 'cedula');
        }
        if (fileSeguro && fileSeguro.files.length > 0) {
          urlSeguro = await subirArchivoSiExiste(fileSeguro, patenteActual, 'seguro');
        }
        if (fileVtv && fileVtv.files.length > 0) {
          urlVtv = await subirArchivoSiExiste(fileVtv, patenteActual, 'vtv');
        }

        const datosActualizados = {
          patente: patenteActual,
          tipo: editTipo.value.trim(),
          modelo: editModelo.value.trim() || null,
          anio: editAnio.value ? parseInt(editAnio.value) : null,
          contratista_id: editContratista.value ? parseInt(editContratista.value) : null,
          vencimiento_cedula: editCedula.value || null,
          vencimiento_seguro: editSeguro.value || null,
          vencimiento_vtv_rto: editVtv.value || null,
          activo: editActivo ? editActivo.value === 'true' : true
        };

        if (urlCedula) datosActualizados.foto_cedula = urlCedula;
        if (urlSeguro) datosActualizados.foto_seguro = urlSeguro;
        if (urlVtv) datosActualizados.foto_vtv_rto = urlVtv;

        let queryUpdate = _supabase.from('unidades').update(datosActualizados).eq('id', id);
        if (empresaIdActual) queryUpdate = queryUpdate.eq('empresa_id', empresaIdActual);

        const { error } = await queryUpdate;

        if (error) {
          throw new Error("No se pudo actualizar en la base de datos: " + error.message);
        }

        cerrarModal(modalEditar);
        mostrarAlerta("¡Éxito!", "Unidad e imágenes actualizadas correctamente.", true, () => {
          cargarUnidades();
        });

      } catch (err) {
        console.error("Fallo general al guardar:", err.message);
        mostrarAlerta("Error al Subir", err.message, false);
      }
    };
  }

  if (btnCloseEditar) btnCloseEditar.onclick = () => cerrarModal(modalEditar);
  if (btnCancelarEditar) btnCancelarEditar.onclick = () => cerrarModal(modalEditar);
  if (btnCancelarEliminar) btnCancelarEliminar.onclick = () => {
    cerrarModal(modalEliminar);
    idUnidadAEliminar = null;
  };

  if (btnConfirmarEliminar) {
    btnConfirmarEliminar.onclick = async () => {
      if (!idUnidadAEliminar) return;
      const empresaIdActual = obtenerEmpresaIdSesionActiva();

      let queryDelete = _supabase.from('unidades').delete().eq('id', idUnidadAEliminar);
      if (empresaIdActual) queryDelete = queryDelete.eq('empresa_id', empresaIdActual);

      const { error } = await queryDelete;
      cerrarModal(modalEliminar);

      if (error) {
        mostrarAlerta("Error", "No se pudo eliminar: " + error.message, false);
      } else {
        mostrarAlerta("Eliminado", "La unidad ha sido borrada correctamente.", true, () => {
          cargarUnidades();
        });
      }
      idUnidadAEliminar = null;
    };
  }

  cargarSelectContratistas();
  cargarUnidades();
});