// ==========================================
// DEPOSITO.JS - AndeLazRoute Logistics
// ==========================================

const SUPABASE_URL = "https://zmanwspxuqwviyzpxtan.supabase.co";
const SUPABASE_KEY = "sb_publishable_geEnhhRNhJ8V7AuM_qSe6g_GEYvW_h_";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let clientesCache = [];
let depositoCache = [];
let empresaIdUsuarioActual = null; // Variable para almacenar la empresa_id del usuario logueado

let datosLoteMemoria = {
  clienteObj: null,
  loteCargaId: null,
  exitososFase1: [],
  pendientesFase2: []
};

document.addEventListener('DOMContentLoaded', async () => {
  const tablaInBody = document.getElementById('tabla-in-body');
  const tablaStockBody = document.getElementById('tabla-stock-body');
  const badgeInCount = document.getElementById('badge-in-count');
  const badgeStockCount = document.getElementById('badge-stock-count');

  const selectFilterInCliente = document.getElementById('select-filter-in-cliente');
  const selectFilterStockCliente = document.getElementById('select-filter-stock-cliente');
  const inputSearchIn = document.getElementById('input-search-in');
  const inputSearchStock = document.getElementById('input-search-stock');

  const modalUpload = document.getElementById('modal-upload');
  const modalDeleteLote = document.getElementById('modal-delete-lote');
  const btnOpenUpload = document.getElementById('btn-open-upload');
  const btnCloseUpload = document.getElementById('btn-close-upload');
  const btnCancelUpload = document.getElementById('btn-cancel-upload');

  const btnOpenDeleteLote = document.getElementById('btn-open-delete-lote');
  const btnCloseDeleteLote = document.getElementById('btn-close-delete-lote');
  const btnCancelDeleteLote = document.getElementById('btn-cancel-delete-lote');
  const selectLoteDelete = document.getElementById('select-lote-delete');
  const btnConfirmDeleteLote = document.getElementById('btn-confirm-delete-lote');

  const btnRefreshStock = document.getElementById('btn-refresh-stock');

  // Elementos del formulario de carga
  const uploadForm = document.getElementById('upload-form');
  const uploadFileInput = document.getElementById('upload-file-input');
  const uploadClienteSelect = document.getElementById('upload-cliente-select');
  const uploadProgressContainer = document.getElementById('upload-progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const progressPercent = document.getElementById('progress-percent');
  const btnProcessUpload = document.getElementById('btn-process-upload');
  const btnReintentarGeo = document.getElementById('btn-reintentar-geo');
  const btnCancelCorreccion = document.getElementById('btn-cancel-correccion');

  // 1. Obtener la empresa_id del usuario logueado en Supabase
  async function inicializarSesionEmpresa() {
    try {
      const { data: { user }, error: authError } = await _supabase.auth.getUser();
      if (authError || !user) {
        console.warn("No hay usuario autenticado activamente.");
        return;
      }

      // Consultar la tabla usuarios para obtener su empresa_id
      const { data: usuarioData, error: userError } = await _supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single();

      if (userError || !usuarioData) {
        // Intentar buscar por email si el id no coincide directamente con la tabla usuarios
        const { data: usuarioEmailData, error: emailError } = await _supabase
          .from('usuarios')
          .select('empresa_id')
          .eq('email', user.email)
          .single();

        if (!emailError && usuarioEmailData) {
          empresaIdUsuarioActual = usuarioEmailData.empresa_id;
        }
      } else {
        empresaIdUsuarioActual = usuarioData.empresa_id;
      }
    } catch (e) {
      console.error("Error al resolver la empresa del usuario:", e);
    }
  }

  await inicializarSesionEmpresa();

  function formatearDireccionVisual(direccion) {
    if (!direccion) return '-';
    return direccion.trim();
  }

  function mostrarAlerta(titulo, mensaje, esExito = false, callback = null) {
    const modalAlerta = document.getElementById("modal-alerta");
    const tituloEl = document.getElementById("alerta-titulo");
    const mensajeEl = document.getElementById("alerta-mensaje");
    const btnAceptar = document.getElementById("alerta-btn-aceptar");

    if (!modalAlerta) {
      alert(`${titulo}:\n${mensaje}`);
      if (callback) callback();
      return;
    }

    tituloEl.innerText = titulo;
    tituloEl.style.color = esExito ? "#16a34a" : "#dc2626";
    mensajeEl.style.whiteSpace = "pre-line";
    mensajeEl.innerText = mensaje;

    btnAceptar.onclick = () => {
      modalAlerta.classList.remove("active");
      if (callback) callback();
    };

    modalAlerta.classList.add("active");
  }

  async function cargarClientes() {
    let queryBuilder = _supabase.from('clientes').select('*').order('razon_social');
    
    // Filtrar clientes por empresa_id si está definido
    if (empresaIdUsuarioActual) {
      queryBuilder = queryBuilder.eq('empresa_id', empresaIdUsuarioActual);
    }

    const { data, error } = await queryBuilder;
    if (error) return;

    clientesCache = data || [];

    let htmlOptions = '<option value="">Todos los Clientes</option>';
    let htmlUploadOptions = '<option value="">-- Seleccionar Cliente --</option>';

    clientesCache.forEach(c => {
      htmlOptions += `<option value="${c.id}">${c.razon_social} (${c.prefijo})</option>`;
      htmlUploadOptions += `<option value="${c.id}">${c.razon_social} (${c.prefijo})</option>`;
    });

    if (selectFilterInCliente) selectFilterInCliente.innerHTML = htmlOptions;
    if (selectFilterStockCliente) selectFilterStockCliente.innerHTML = htmlOptions;
    if (uploadClienteSelect) uploadClienteSelect.innerHTML = htmlUploadOptions;
  }

  async function cargarDeposito() {
    if (tablaStockBody) tablaStockBody.innerHTML = '<tr><td colspan="7" class="empty-table-msg">Cargando paquetes...</td></tr>';

    let queryBuilder = _supabase
      .from('deposito')
      .select('*')
      .order('fecha_ingreso', { ascending: false });

    // Filtrar paquetes de depósito por empresa_id
    if (empresaIdUsuarioActual) {
      queryBuilder = queryBuilder.eq('empresa_id', empresaIdUsuarioActual);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      mostrarAlerta("Error", "No se pudieron obtener los paquetes: " + error.message, false);
      return;
    }

    depositoCache = data || [];
    renderizarVistas();
  }

  function renderizarVistas() {
    renderizarIn();
    renderizarStock();
  }

  function renderizarIn() {
    if (!tablaInBody) return;

    const clienteFiltroId = selectFilterInCliente.value;
    const query = inputSearchIn.value.toLowerCase().trim();
    const terms = query ? query.split('&').map(t => t.trim()).filter(t => t.length > 0) : [];

    // DEPÓSITO IN: Muestra todos los paquetes sin restricciones de estado o finalización
    let lista = depositoCache.filter(item => {
      let matchCliente = clienteFiltroId ? String(item.cliente_id) === String(clienteFiltroId) : true;
      if (!matchCliente) return false;

      if (terms.length === 0) return true;

      const fechaStr = item.fecha_ingreso ? new Date(item.fecha_ingreso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '';
      const stringData = `${item.sku_completo || ''} ${item.posicion_hr || ''} ${item.referencia || ''} ${item.destinatario || ''} ${item.telefono || ''} ${fechaStr}`.toLowerCase();

      return terms.every(term => stringData.includes(term));
    });

    if (badgeInCount) badgeInCount.innerText = `${lista.length} reg.`;

    if (lista.length === 0) {
      tablaInBody.innerHTML = '<tr><td colspan="6" class="empty-table-msg">No hay registros en IN.</td></tr>';
      return;
    }

    tablaInBody.innerHTML = '';
    lista.forEach(item => {
      const tr = document.createElement('tr');
      const fecha = item.fecha_ingreso ? new Date(item.fecha_ingreso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
      const badgeHTML = getClienteBadgeHTML(item.cliente_id, item.sku_completo);
      const direccionVisual = formatearDireccionVisual(item.destinatario);

      tr.innerHTML = `
        <td style="overflow: visible; padding: 5px 8px;">${badgeHTML}</td>
        <td style="padding: 5px 4px;">${item.posicion_hr || '-'}</td>
        <td style="max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 5px 8px;" title="${item.destinatario || ''}">${direccionVisual}</td>
        <td style="padding: 5px 8px;">${item.telefono || '-'}</td>
        <td style="font-size: 11px; white-space: nowrap; padding: 5px 8px;">${fecha}</td>
        <td style="text-align: center; white-space: nowrap; padding: 5px 8px;">
          <button class="btn-action-edit" data-id="${item.id}" title="Editar registro" style="padding: 3px 6px;"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-action-delete" data-id="${item.id}" title="Eliminar registro" style="padding: 3px 6px;"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      tablaInBody.appendChild(tr);
    });

    tablaInBody.querySelectorAll('.btn-action-edit').forEach(btn => {
      btn.onclick = () => abrirModalEditar(btn.getAttribute('data-id'));
    });

    tablaInBody.querySelectorAll('.btn-action-delete').forEach(btn => {
      btn.onclick = () => abrirModalEliminarItem(btn.getAttribute('data-id'));
    });
  }

  function renderizarStock() {
    if (!tablaStockBody) return;

    const clienteFiltroId = selectFilterStockCliente.value;
    const query = inputSearchStock.value.toLowerCase().trim();
    const terms = query ? query.split('&').map(t => t.trim()).filter(t => t.length > 0) : [];

    // DEPÓSITO STOCK: Solo muestra los que NO están finalizados (finalizado === false o null)
    let lista = depositoCache.filter(item => {
      let matchCliente = clienteFiltroId ? String(item.cliente_id) === String(clienteFiltroId) : true;
      if (!matchCliente) return false;

      // Condición de stock activo: finalizado debe ser falso o no estar marcado como true
      const estaFinalizado = item.finalizado === true || String(item.finalizado) === 'true';
      if (estaFinalizado) return false;

      if (terms.length === 0) return true;

      const estadoActual = (item.estado || 'Deposito').trim();
      const fechaStr = item.fecha_ingreso ? new Date(item.fecha_ingreso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '';
      const stringData = `${item.sku_completo || ''} ${item.posicion_hr || ''} ${item.referencia || ''} ${item.destinatario || ''} ${item.telefono || ''} ${estadoActual} ${fechaStr}`.toLowerCase();

      return terms.every(term => stringData.includes(term));
    });

    if (badgeStockCount) badgeStockCount.innerText = `${lista.length} paquetes`;

    if (lista.length === 0) {
      tablaStockBody.innerHTML = '<tr><td colspan="7" class="empty-table-msg">Sin resultados en stock de depósito.</td></tr>';
      return;
    }

    tablaStockBody.innerHTML = '';
    lista.forEach(item => {
      const tr = document.createElement('tr');
      const fecha = item.fecha_ingreso ? new Date(item.fecha_ingreso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
      const badgeHTML = getClienteBadgeHTML(item.cliente_id, item.sku_completo);
      const direccionVisual = formatearDireccionVisual(item.destinatario);
      const estadoActual = item.estado || 'Deposito';

      tr.innerHTML = `
        <td style="overflow: visible; padding: 5px 8px;">${badgeHTML}</td>
        <td style="padding: 5px 6px;">${item.posicion_hr || '-'}</td>
        <td style="max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 5px 8px;" title="${item.destinatario || ''}">${direccionVisual}</td>
        <td style="padding: 5px 8px;">${item.telefono || '-'}</td>
        <td style="text-align: center; padding: 5px 8px;">${item.intentos_vuelta ?? 0}</td>
        <td style="padding: 5px 8px;"><span class="status-badge" style="background-color: #dcfce7; color: #15803d; font-weight: 600; padding: 2px 8px; border-radius: 12px; display: inline-block; font-size: 11px;">${estadoActual}</span></td>
        <td style="padding: 5px 8px;">${fecha}</td>
      `;
      tablaStockBody.appendChild(tr);
    });
  }

  if (uploadForm) {
    uploadForm.onsubmit = async (e) => {
      e.preventDefault();
      const clienteId = uploadClienteSelect.value;
      const file = uploadFileInput.files[0];

      if (!clienteId || !file) {
        mostrarAlerta("Atención", "Selecciona un cliente y un archivo válido.", false);
        return;
      }

      const clienteObj = clientesCache.find(c => String(c.id) === String(clienteId));
      if (!clienteObj) {
        mostrarAlerta("Error", "No se encontró el cliente seleccionado.", false);
        return;
      }

      btnProcessUpload.disabled = true;
      uploadProgressContainer.style.display = 'block';
      progressText.innerText = "Leyendo archivo...";
      progressBar.style.width = "10%";
      progressPercent.innerText = "10%";

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const rowsJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

          if (rowsJson.length === 0) {
            mostrarAlerta("Atención", "El archivo está vacío o no contiene registros válidos.", false);
            resetUploadUI();
            return;
          }

          function obtenerValorColumna(row, posiblesNombres) {
            const keys = Object.keys(row);
            for (let nombrePosible of posiblesNombres) {
              const encontrada = keys.find(k => 
                k.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 
                nombrePosible.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              );
              if (encontrada !== undefined) {
                return String(row[encontrada]).trim();
              }
            }
            return "";
          }

          const direccionesCrudas = [];
          const filasMapeadas = [];

          rowsJson.forEach((row, index) => {
            const destinatario = obtenerValorColumna(row, ['destinatario', 'direccion', 'domicilio', 'calle', 'dirección']);
            
            if (destinatario) {
              const ordenOriginal = index + 1;
              const skuOriginal = obtenerValorColumna(row, ['referencia', 'sku', 'id', 'codigo', 'código', 'nro', 'tracking']) || `REF-${Date.now()}-${index}`;
              const hrDato = obtenerValorColumna(row, ['hr', 'hojaruta', 'hoja_ruta', 'ruta']) || '';
              const telefono = obtenerValorColumna(row, ['telefono', 'teléfono', 'celular', 'contacto', 'phone']) || null;
              
              const posicionHrFinal = hrDato ? `${ordenOriginal}HR${hrDato}` : `${ordenOriginal}HR`;

              direccionesCrudas.push(destinatario);
              filasMapeadas.push({
                destinatarioOriginal: destinatario,
                skuOriginal: skuOriginal,
                hr: hrDato,
                ordenOriginal: ordenOriginal,
                posicionHr: posicionHrFinal,
                telefono: telefono
              });
            }
          });

          if (direccionesCrudas.length === 0) {
            mostrarAlerta("Atención", "No se encontró una columna válida de 'Destinatario' o 'Dirección' en el archivo.", false);
            resetUploadUI();
            return;
          }

          progressText.innerText = "Geolocalizando con servidor Node...";
          progressBar.style.width = "40%";
          progressPercent.innerText = "40%";

          const response = await fetch('http://localhost:3000/api/geocodificar-lote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ direcciones: direccionesCrudas })
          });

          if (!response.ok) {
            throw new Error("No se pudo conectar con el servidor de geolocalización.");
          }

          const resultadoJson = await response.json();
          const resultadosGeo = resultadoJson.resultados;

          // Nombre del lote con el nombre del archivo limpio
          const nombreArchivoLimpio = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
          const loteCargaId = `LOTE-${nombreArchivoLimpio}-${Date.now()}`;
          
          const exitosos = [];
          const nullsParaFase2 = [];

          resultadosGeo.forEach((resGeo, index) => {
            const filaInfo = filasMapeadas[index];
            const skuCompleto = `${clienteObj.prefijo}${filaInfo.skuOriginal}`;

            const registroItem = {
              cliente_id: clienteObj.id,
              prefijo: clienteObj.prefijo,
              lote_carga_id: loteCargaId,
              sku_original: filaInfo.skuOriginal,
              sku_completo: skuCompleto,
              referencia: filaInfo.skuOriginal,
              hr: filaInfo.hr,
              orden_original: filaInfo.ordenOriginal,
              posicion_hr: filaInfo.posicionHr,
              destinatario: filaInfo.destinatarioOriginal,
              telefono: filaInfo.telefono,
              lat: resGeo.lat,
              lng: resGeo.lng,
              estado: 'Deposito',
              intentos_vuelta: 0,
              finalizado: false,
              empresa_id: empresaIdUsuarioActual // Inyección del empresa_id del usuario
            };

            if (resGeo.lat !== null && resGeo.lng !== null) {
              exitosos.push(registroItem);
            } else {
              nullsParaFase2.push(registroItem);
            }
          });

          if (nullsParaFase2.length === 0) {
            progressText.innerText = "Guardando en Supabase...";
            progressBar.style.width = "80%";
            progressPercent.innerText = "80%";

            const { error: insertError } = await _supabase
              .from('deposito')
              .upsert(exitosos, { onConflict: 'sku_completo' });

            if (insertError) throw new Error(insertError.message);

            progressBar.style.width = "100%";
            progressPercent.innerText = "100%";

            setTimeout(() => {
              modalUpload.classList.remove('active');
              resetUploadUI();
              cargarDeposito();
              mostrarAlerta("Éxito", `Se procesaron e importaron ${exitosos.length} paquetes correctamente.`, true);
            }, 600);

          } else {
            datosLoteMemoria = {
              clienteObj: clienteObj,
              loteCargaId: loteCargaId,
              exitososFase1: exitosos,
              pendientesFase2: nullsParaFase2
            };

            document.getElementById('upload-card-1').style.display = 'none';
            document.getElementById('upload-card-2').style.display = 'block';
            renderizarTablaCorreccionNulos();
          }

        } catch (err) {
            mostrarAlerta("Error de Proceso", err.message || "Ocurrió un error al procesar el archivo.", false);
            resetUploadUI();
        }
      };

      reader.readAsArrayBuffer(file);
    };
  }

  function renderizarTablaCorreccionNulos() {
    const tbody = document.getElementById('tabla-correccion-body');
    tbody.innerHTML = '';

    const totalEncontrados = datosLoteMemoria.exitososFase1.length;
    const totalErrores = datosLoteMemoria.pendientesFase2.length;

    const headerCard2 = document.querySelector('#upload-card-2 .modal-header');
    if (headerCard2) {
      const clienteColor = datosLoteMemoria.clienteObj.color_hex || '#0284c7';

      headerCard2.innerHTML = `
        <h2 style="color: ${clienteColor};"><i class="fa-solid fa-triangle-exclamation"></i> Direcciones No Encontradas</h2>
        <p>Se procesaron <b style="color: #16a34a;">${totalEncontrados} correctos</b> y se detectaron <b style="color: #dc2626;">${totalErrores} registros sin geolocalización</b>. Edita los destinatarios y reintenta.</p>
      `;
    }

    datosLoteMemoria.pendientesFase2.forEach((item, idx) => {
      const tr = document.createElement('tr');
      const clienteColor = datosLoteMemoria.clienteObj.color_hex || '#64748b';
      const textColor = calcularColorTexto(clienteColor);

      tr.innerHTML = `
        <td><span class="badge-cliente" style="background-color: ${clienteColor}; color: ${textColor}; padding: 4px 8px; border-radius: 6px; font-weight: 600; display: inline-block;">${item.sku_completo}</span></td>
        <td>
          <input type="text" class="form-input input-destinatario-correccion" data-index="${idx}" value="${item.destinatario}" style="width: 100%; padding: 6px;" />
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  if (btnReintentarGeo) {
    btnReintentarGeo.onclick = async () => {
      const inputs = document.querySelectorAll('.input-destinatario-correccion');
      inputs.forEach(input => {
        const idx = input.getAttribute('data-index');
        datosLoteMemoria.pendientesFase2[idx].destinatario = input.value.trim();
      });

      btnReintentarGeo.disabled = true;
      btnReintentarGeo.innerText = "Reintentando geolocalización...";

      const nuevasDirecciones = datosLoteMemoria.pendientesFase2.map(i => i.destinatario);

      try {
        const response = await fetch('http://localhost:3000/api/geocodificar-lote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direcciones: nuevasDirecciones })
        });

        if (!response.ok) throw new Error("Error en el servidor de geolocalización.");
        const resultadoJson = await response.json();
        const resultadosGeo2 = resultadoJson.resultados;

        const rescatados = [];
        const erroresDefinitivos = [];

        resultadosGeo2.forEach((resGeo, index) => {
          let item = datosLoteMemoria.pendientesFase2[index];
          item.lat = resGeo.lat;
          item.lng = resGeo.lng;
          item.finalizado = false;

          if (resGeo.lat !== null && resGeo.lng !== null) {
            rescatados.push(item);
          } else {
            if (!item.destinatario.startsWith('X -')) {
              item.destinatario = `X - ${item.destinatario}`;
            }
            erroresDefinitivos.push(item);
          }
        });

        const todosLosRegistros = [
          ...datosLoteMemoria.exitososFase1,
          ...rescatados,
          ...erroresDefinitivos
        ];

        const { error: insertError } = await _supabase
          .from('deposito')
          .upsert(todosLosRegistros, { onConflict: 'sku_completo' });

        if (insertError) throw new Error(insertError.message);

        modalUpload.classList.remove('active');
        resetUploadUI();
        cargarDeposito();

        mostrarAlerta("Proceso Finalizado", 
          `• Exitosos (1era instancia): ${datosLoteMemoria.exitososFase1.length}\n` +
          `• Rescatados (2da instancia): ${rescatados.length}\n` +
          `• Errores definitivos (con marca X -): ${erroresDefinitivos.length}`, 
          true
        );

      } catch (err) {
        mostrarAlerta("Error", err.message || "No se pudo completar el reintento.", false);
        btnReintentarGeo.disabled = false;
        btnReintentarGeo.innerText = "Reintentar Geolocalización y Volcar";
      }
    };
  }

  if (btnCancelCorreccion) {
    btnCancelCorreccion.onclick = () => {
      modalUpload.classList.remove('active');
      resetUploadUI();
    };
  }

  function resetUploadUI() {
    btnProcessUpload.disabled = false;
    if (btnReintentarGeo) {
      btnReintentarGeo.disabled = false;
      btnReintentarGeo.innerText = "Reintentar Geolocalización y Volcar";
    }
    uploadProgressContainer.style.display = 'none';
    progressBar.style.width = "0%";
    progressPercent.innerText = "0%";
    if (document.getElementById('upload-card-1')) document.getElementById('upload-card-1').style.display = 'block';
    if (document.getElementById('upload-card-2')) document.getElementById('upload-card-2').style.display = 'none';
    if (uploadForm) uploadForm.reset();
  }

  function abrirModalEditar(idRegistro) {
    const item = depositoCache.find(d => String(d.id) === String(idRegistro));
    if (!item) return;

    let modalEdit = document.getElementById('modal-editar-registro');
    if (!modalEdit) {
      modalEdit = document.createElement('div');
      modalEdit.id = 'modal-editar-registro';
      modalEdit.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center;
        align-items: center; z-index: 99999;
      `;
      document.body.appendChild(modalEdit);
    }

    modalEdit.innerHTML = `
      <div class="modal-content" style="background: #fff; padding: 24px; border-radius: 12px; width: 450px; max-width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 18px; color: #1e293b;">Editar Registro (${item.sku_completo})</h3>
          <button id="btn-close-edit-modal" type="button" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b;">&times;</button>
        </div>
        <div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 4px;">Destinatario / Dirección:</label>
            <input type="text" id="edit-destinatario-input" value="${item.destinatario || ''}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 4px;">Teléfono:</label>
            <input type="text" id="edit-telefono-input" value="${item.telefono || ''}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
            <div>
              <label style="display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 4px;">Latitud (Lat):</label>
              <input type="number" step="any" id="edit-lat-input" value="${item.lat !== null && item.lat !== undefined ? item.lat : ''}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" placeholder="Ej: -34.6037" />
            </div>
            <div>
              <label style="display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 4px;">Longitud (Lng):</label>
              <input type="number" step="any" id="edit-lng-input" value="${item.lng !== null && item.lng !== undefined ? item.lng : ''}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" placeholder="Ej: -58.3816" />
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button id="btn-geo-save-edit" type="button" style="padding: 10px; border-radius: 8px; background: #0284c7; color: #fff; font-weight: 600; border: none; cursor: pointer; text-align: center;"><i class="fa-solid fa-map-location-dot"></i> Generar Geolocalización y Guardar</button>
            <button id="btn-save-sin-geo" type="button" style="padding: 10px; border-radius: 8px; background: #16a34a; color: #fff; font-weight: 600; border: none; cursor: pointer; text-align: center;"><i class="fa-solid fa-floppy-disk"></i> Guardar sin Geolocalizar</button>
            <button id="btn-cancel-edit" type="button" style="padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; color: #1e293b; font-weight: 600; cursor: pointer; text-align: center;">Cancelar</button>
          </div>
        </div>
      </div>
    `;

    const cerrar = () => modalEdit.remove();
    modalEdit.querySelector('#btn-close-edit-modal').onclick = cerrar;
    modalEdit.querySelector('#btn-cancel-edit').onclick = cerrar;

    const ejecutarGuardadoEnSupabase = async (latFinal, lngFinal, btnElement, textoOriginal) => {
      const nuevoDestinatario = modalEdit.querySelector('#edit-destinatario-input').value.trim();
      const nuevoTelefono = modalEdit.querySelector('#edit-telefono-input').value.trim();

      btnElement.disabled = true;
      btnElement.innerText = "Guardando...";

      const { error } = await _supabase
        .from('deposito')
        .update({
          destinatario: nuevoDestinatario,
          telefono: nuevoTelefono,
          lat: latFinal === '' || latFinal === null ? null : parseFloat(latFinal),
          lng: lngFinal === '' || lngFinal === null ? null : parseFloat(lngFinal)
        })
        .eq('id', idRegistro);

      if (error) {
        mostrarAlerta("Error", "No se pudo actualizar el registro: " + error.message, false);
        btnElement.disabled = false;
        btnElement.innerText = textoOriginal;
      } else {
        cerrar();
        mostrarAlerta("Éxito", "Registro actualizado correctamente.", true, () => {
          cargarDeposito();
        });
      }
    };

    const btnGeoSave = modalEdit.querySelector('#btn-geo-save-edit');
    btnGeoSave.onclick = async () => {
      const nuevoDestinatario = modalEdit.querySelector('#edit-destinatario-input').value.trim();
      if (!nuevoDestinatario) {
        mostrarAlerta("Atención", "El campo destinatario/dirección no puede estar vacío.", false);
        return;
      }

      btnGeoSave.disabled = true;
      btnGeoSave.innerText = "Geolocalizando...";

      try {
        const response = await fetch('http://localhost:3000/api/geocodificar-lote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direcciones: [nuevoDestinatario] })
        });

        if (!response.ok) throw new Error("Error al conectar con el servicio de geolocalización.");
        const resultadoJson = await response.json();
        
        let latObtenida = null;
        let lngObtenida = null;

        if (resultadoJson.resultados && resultadoJson.resultados.length > 0) {
          latObtenida = resultadoJson.resultados[0].lat;
          lngObtenida = resultadoJson.resultados[0].lng;
        }

        if (latObtenida === null && !nuevoDestinatario.startsWith('X -')) {
          modalEdit.querySelector('#edit-destinatario-input').value = `X - ${nuevoDestinatario}`;
        }

        await ejecutarGuardadoEnSupabase(latObtenida, lngObtenida, btnGeoSave, '<i class="fa-solid fa-map-location-dot"></i> Generar Geolocalización y Guardar');

      } catch (err) {
        mostrarAlerta("Error", err.message || "No se pudo geolocalizar la dirección.", false);
        btnGeoSave.disabled = false;
        btnGeoSave.innerHTML = '<i class="fa-solid fa-map-location-dot"></i> Generar Geolocalización y Guardar';
      }
    };

    const btnSaveSinGeo = modalEdit.querySelector('#btn-save-sin-geo');
    btnSaveSinGeo.onclick = () => {
      const nuevoDestinatario = modalEdit.querySelector('#edit-destinatario-input').value.trim();
      if (!nuevoDestinatario) {
        mostrarAlerta("Atención", "El campo destinatario/dirección no puede estar vacío.", false);
        return;
      }

      const latManual = modalEdit.querySelector('#edit-lat-input').value.trim();
      const lngManual = modalEdit.querySelector('#edit-lng-input').value.trim();

      ejecutarGuardadoEnSupabase(latManual, lngManual, btnSaveSinGeo, '<i class="fa-solid fa-floppy-disk"></i> Guardar sin Geolocalizar');
    };

    modalEdit.style.display = 'flex';
  }

  function abrirModalEliminarItem(idRegistro) {
    let modalDel = document.getElementById('modal-confirm-eliminar-item');
    if (!modalDel) {
      modalDel = document.createElement('div');
      modalDel.id = 'modal-confirm-eliminar-item';
      modalDel.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center;
        align-items: center; z-index: 99999;
      `;
      document.body.appendChild(modalDel);
    }

    modalDel.innerHTML = `
      <div class="modal-content" style="background: #fff; padding: 32px 24px; border-radius: 16px; width: 380px; max-width: 90%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
        <div style="font-size: 36px; color: #f59e0b; margin-bottom: 12px;">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h3 style="margin: 0 0 8px 0; font-size: 20px; color: #1e293b; font-weight: 700;">¿Confirmar eliminación?</h3>
        <p style="font-size: 14px; color: #64748b; margin-bottom: 24px; line-height: 1.4;">
          Esta acción eliminará el registro del sistema de forma permanente.
        </p>
        <div style="display: flex; justify-content: center; gap: 12px;">
          <button id="btn-cancel-del-item" type="button" style="padding: 10px 20px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b; font-weight: 600; cursor: pointer;">Cancelar</button>
          <button id="btn-confirm-del-item" type="button" style="padding: 10px 20px; border-radius: 8px; background: #ef4444; color: #fff; font-weight: 600; border: none; cursor: pointer;">Sí, Eliminar</button>
        </div>
      </div>
    `;

    const cerrar = () => modalDel.remove();
    modalDel.querySelector('#btn-cancel-del-item').onclick = cerrar;

    modalDel.querySelector('#btn-confirm-del-item').onclick = async () => {
      const { error } = await _supabase.from('deposito').delete().eq('id', idRegistro);
      cerrar();
      if (error) {
        mostrarAlerta("Error", "No se pudo eliminar el registro: " + error.message, false);
      } else {
        mostrarAlerta("Éxito", "Registro eliminado correctamente.", true, () => {
          cargarDeposito();
        });
      }
    };

    modalDel.style.display = 'flex';
  }

  function getClienteBadgeHTML(clienteId, skuCompleto) {
    const cliente = clientesCache.find(c => String(c.id) === String(clienteId));
    if (!cliente) return `<code>${skuCompleto}</code>`;

    const textColor = calcularColorTexto(cliente.color_hex);
    return `<span class="badge-cliente" style="background-color: ${cliente.color_hex}; color: ${textColor};">${skuCompleto}</span>`;
  }

  function calcularColorTexto(hexColor) {
    if (!hexColor) return '#000000';
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return ((r * 299 + g * 587 + b * 114) / 1000) > 128 ? '#000000' : '#ffffff';
  }

  if (btnOpenUpload) btnOpenUpload.onclick = () => modalUpload.classList.add('active');
  if (btnCloseUpload) btnCloseUpload.onclick = () => { modalUpload.classList.remove('active'); resetUploadUI(); }
  if (btnCancelUpload) btnCancelUpload.onclick = () => { modalUpload.classList.remove('active'); resetUploadUI(); }

  if (btnOpenDeleteLote) {
    btnOpenDeleteLote.onclick = () => {
      cargarLotesSelect();
      modalDeleteLote.classList.add('active');
    };
  }
  if (btnCloseDeleteLote) btnCloseDeleteLote.onclick = () => modalDeleteLote.classList.remove('active');
  if (btnCancelDeleteLote) btnCancelDeleteLote.onclick = () => modalDeleteLote.classList.remove('active');

  async function cargarLotesSelect() {
    selectLoteDelete.innerHTML = '<option value="">Cargando lotes...</option>';
    
    let queryBuilder = _supabase.from('deposito').select('lote_carga_id, fecha_ingreso');
    if (empresaIdUsuarioActual) {
      queryBuilder = queryBuilder.eq('empresa_id', empresaIdUsuarioActual);
    }

    const { data, error } = await queryBuilder;
    if (error || !data) {
      selectLoteDelete.innerHTML = '<option value="">Error al cargar lotes</option>';
      return;
    }

    const lotesMap = new Map();
    data.forEach(item => {
      if (item.lote_carga_id && !lotesMap.has(item.lote_carga_id)) {
        lotesMap.set(item.lote_carga_id, item.fecha_ingreso);
      }
    });

    if (lotesMap.size === 0) {
      selectLoteDelete.innerHTML = '<option value="">No hay lotes para eliminar</option>';
      return;
    }

    let options = '<option value="">-- Seleccionar Lote --</option>';
    lotesMap.forEach((fecha, lote) => {
      const fechaStr = fecha ? new Date(fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '';
      options += `<option value="${lote}">${lote} (${fechaStr})</option>`;
    });

    selectLoteDelete.innerHTML = options;
  }

  if (btnConfirmDeleteLote) {
    btnConfirmDeleteLote.onclick = () => {
      const loteId = selectLoteDelete.value;
      if (!loteId) {
        mostrarAlerta("Atención", "Selecciona un lote para eliminar.", false);
        return;
      }

      modalDeleteLote.classList.remove('active');

      let modalConfirmacionLote = document.getElementById('modal-confirm-lote-superpuesto');
      if (!modalConfirmacionLote) {
        modalConfirmacionLote = document.createElement('div');
        modalConfirmacionLote.id = 'modal-confirm-lote-superpuesto';
        modalConfirmacionLote.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(6px);
          display: flex; justify-content: center; align-items: center; z-index: 3000;
        `;
        document.body.appendChild(modalConfirmacionLote);
      }

      modalConfirmacionLote.innerHTML = `
        <div class="modal-card" style="max-width: 400px; text-align: center; background: #fff; padding: 30px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);">
          <div style="font-size: 36px; color: #ef4444; margin-bottom: 12px;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #0f172a; font-weight: 700;">¿Está seguro que quiere eliminarla?</h3>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 24px;">
            Se eliminará por completo el lote <b>${loteId}</b> y todas sus cargas asociadas del depósito.
          </p>
          <div style="display: flex; justify-content: center; gap: 10px;">
            <button id="btn-no-eliminar-lote" type="button" class="btn-ghost-sm" style="padding: 8px 16px;">No</button>
            <button id="btn-si-eliminar-lote" type="button" class="btn-primary-sm" style="padding: 8px 20px; background-color: #ef4444;">Sí, eliminar</button>
          </div>
        </div>
      `;

      const cerrarConfirmacion = () => {
        modalConfirmacionLote.remove();
      };

      modalConfirmacionLote.querySelector('#btn-no-eliminar-lote').onclick = () => {
        cerrarConfirmacion();
        modalDeleteLote.classList.add('active');
      };

      modalConfirmacionLote.querySelector('#btn-si-eliminar-lote').onclick = async () => {
        const btnSi = modalConfirmacionLote.querySelector('#btn-si-eliminar-lote');
        btnSi.disabled = true;
        btnSi.innerText = "Eliminando...";

        let deleteQuery = _supabase.from('deposito').delete().eq('lote_carga_id', loteId);
        if (empresaIdUsuarioActual) {
          deleteQuery = deleteQuery.eq('empresa_id', empresaIdUsuarioActual);
        }

        const { error } = await deleteQuery;

        cerrarConfirmacion();

        if (error) {
          mostrarAlerta("Error", "No se pudo eliminar el lote: " + error.message, false);
        } else {
          mostrarAlerta("Éxito", "Lote y paquetes eliminados correctamente.", true, () => {
            cargarDeposito();
          });
        }
      };

      modalConfirmacionLote.style.display = 'flex';
    };
  }

  if (selectFilterInCliente) selectFilterInCliente.onchange = renderizarIn;
  if (inputSearchIn) inputSearchIn.oninput = renderizarIn;

  if (selectFilterStockCliente) selectFilterStockCliente.onchange = renderizarStock;
  if (inputSearchStock) inputSearchStock.oninput = renderizarStock;

  if (btnRefreshStock) btnRefreshStock.onclick = cargarDeposito;

  cargarClientes().then(cargarDeposito);
});