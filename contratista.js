/**
 * ANDELAZ LOGISTICS - Módulo de Contratistas
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

let contratistaSeleccionadoId = null;
let listaContratistasGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
  obtenerEmpresaIdSesionActiva();

  const formContratista = document.getElementById('form-contratista');
  const inputRazonSocial = document.getElementById('razon-social');
  const inputCuit = document.getElementById('cuit');
  const tablaBody = document.getElementById('tabla-contratistas-body');
  const badgeCount = document.getElementById('badge-count');

  // Modal Edición
  const modalEditar = document.getElementById('modal-editar');
  const formEditar = document.getElementById('form-editar-contratista');
  const editId = document.getElementById('edit-id');
  const editRazonSocial = document.getElementById('edit-razon-social');
  const editCuit = document.getElementById('edit-cuit');
  const btnCloseEditar = document.getElementById('btn-close-editar');
  const btnCancelEditar = document.getElementById('btn-cancel-editar');

  // Visor de Imágenes (Único modelo flotante para todas las fotos)
  const modalVisor = document.getElementById('modal-visor-imagen');
  const visorImg = document.getElementById('visor-img');
  const visorTitulo = document.getElementById('visor-titulo');
  const visorBtnDescargar = document.getElementById('visor-btn-descargar');
  const btnCloseVisor = document.getElementById('btn-close-visor');

  // Inyectar Buscador y Botón Deseleccionar de forma dinámica
  const cardBoxContratistas = document.querySelector('.card-box:nth-child(2)') || document.querySelector('.table-container')?.parentElement;
  if (cardBoxContratistas && !document.getElementById('input-buscar-contratista')) {
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = "display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; align-items: center; justify-content: space-between;";
    headerDiv.innerHTML = `
      <div style="display: flex; gap: 10px; flex: 1; min-width: 220px;">
        <input type="text" id="input-buscar-contratista" placeholder="🔍 Buscar por Razón Social o CUIT..." style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none;">
      </div>
      <div id="contenedor-btn-deseleccionar"></div>
    `;
    const tablaContainer = cardBoxContratistas.querySelector('div[style*="overflow-x"]');
    cardBoxContratistas.insertBefore(headerDiv, tablaContainer);

    document.getElementById('input-buscar-contratista').addEventListener('input', (e) => {
      renderizarTablaContratistas(e.target.value);
    });
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
    modalAlerta.style.display = "flex";

    btnAceptar.onclick = () => {
      modalAlerta.style.display = "none";
      if (callback) callback();
    };
  }

  // Evaluación estricta con formato de pastilla redondeada
  function evaluarVencimiento(fechaStr) {
    if (!fechaStr) return { estado: 'ok', texto: 'N/D', style: 'color: #64748b;' };

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const vencimiento = new Date(fechaStr + 'T00:00:00');
    const diferenciaDias = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));

    if (diferenciaDias < 0) {
      return { 
        estado: 'rojo', 
        texto: `${fechaStr} (VENCIDO)`, 
        style: 'background-color: #fee2e2; color: #dc2626; padding: 4px 10px; border-radius: 6px; font-weight: bold; display: inline-block;' 
      };
    } else if (diferenciaDias <= 7) {
      return { 
        estado: 'naranja', 
        texto: `${fechaStr} (${diferenciaDias}d)`, 
        style: 'background-color: #ffedd5; color: #ea580c; padding: 4px 10px; border-radius: 6px; font-weight: bold; display: inline-block;' 
      };
    } else if (diferenciaDias <= 14) {
      return { 
        estado: 'amarillo', 
        texto: `${fechaStr} (${diferenciaDias}d)`, 
        style: 'background-color: #fef9c3; color: #ca8a04; padding: 4px 10px; border-radius: 6px; font-weight: bold; display: inline-block;' 
      };
    } else {
      return { 
        estado: 'ok', 
        texto: fechaStr, 
        style: 'color: #16a34a; font-weight: 500;' 
      };
    }
  }

  async function cargarContratistas() {
    tablaBody.innerHTML = '<tr><td colspan="3" class="empty-table-msg" style="text-align: center; padding: 20px;">Cargando contratistas...</td></tr>';

    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    let query = _supabase.from('contratistas').select('*').order('razon_social', { ascending: true });
    if (empresaIdActual) query = query.eq('empresa_id', empresaIdActual);

    const { data: contratistas, error } = await query;

    if (error) {
      mostrarAlerta("Error", "No se pudo obtener la lista de contratistas: " + error.message, false);
      tablaBody.innerHTML = '<tr><td colspan="3" class="empty-table-msg" style="text-align: center; padding: 20px; color: #dc2626;">Error al cargar datos.</td></tr>';
      return;
    }

    listaContratistasGlobal = (contratistas || []).map(c => ({
      ...c,
      conteoRojo: 0,
      conteoNaranja: 0,
      conteoAmarillo: 0,
      alertasCalculadas: false
    }));

    renderizarTablaContratistas();
    calcularAlertasEnSegundoPlano();
  }

  async function calcularAlertasEnSegundoPlano() {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    for (let c of listaContratistasGlobal) {
      try {
        let qUnidades = _supabase.from('unidades').select('*').eq('contratista_id', c.id);
        if (empresaIdActual) qUnidades = qUnidades.eq('empresa_id', empresaIdActual);
        const { data: unidades } = await qUnidades;

        let qChoferes = _supabase.from('choferes').select('*').eq('contratista_id', c.id);
        if (empresaIdActual) qChoferes = qChoferes.eq('empresa_id', empresaIdActual);
        const { data: choferes } = await qChoferes;

        let r = 0, n = 0, a = 0;

        if (unidades) {
          unidades.forEach(u => {
            [u.vencimiento_cedula, u.vencimiento_seguro, u.vencimiento_vtv_rto].forEach(fec => {
              const ev = evaluarVencimiento(fec);
              if (ev.estado === 'rojo') r++;
              if (ev.estado === 'naranja') n++;
              if (ev.estado === 'amarillo') a++;
            });
          });
        }

        if (choferes) {
          choferes.forEach(ch => {
            const ev = evaluarVencimiento(ch.vencimiento_licencia || ch.vencimiento_registro);
            if (ev.estado === 'rojo') r++;
            if (ev.estado === 'naranja') n++;
            if (ev.estado === 'amarillo') a++;
          });
        }

        c.conteoRojo = r;
        c.conteoNaranja = n;
        c.conteoAmarillo = a;
        c.alertasCalculadas = true;
      } catch (err) {
        console.error("Error calculando alertas para contratista:", c.id);
      }
    }
    const inputBusqueda = document.getElementById('input-buscar-contratista');
    renderizarTablaContratistas(inputBusqueda ? inputBusqueda.value : '');
  }

  function renderizarTablaContratistas(filtro = '') {
    const textoFiltro = filtro.toLowerCase().trim();
    const filtrados = listaContratistasGlobal.filter(c => 
      c.razon_social.toLowerCase().includes(textoFiltro) || 
      (c.cuit && c.cuit.toLowerCase().includes(textoFiltro))
    );

    badgeCount.innerText = `${filtrados.length} reg.`;

    if (filtrados.length === 0) {
      tablaBody.innerHTML = '<tr><td colspan="3" class="empty-table-msg" style="text-align: center; padding: 20px; color: #64748b;">No se encontraron contratistas.</td></tr>';
      return;
    }

    const thead = document.querySelector('.data-table thead tr');
    if (thead && thead.cells.length === 3) {
      const thAlerta = document.createElement('th');
      thAlerta.innerText = "ALERTAS";
      thead.appendChild(thAlerta);
    }

    tablaBody.innerHTML = '';

    filtrados.forEach(c => {
      let htmlAlertas = '';
      if (!c.alertasCalculadas) {
        htmlAlertas = `<span style="color: #64748b; font-size: 11px;">Calculando...</span>`;
      } else {
        htmlAlertas = '<div style="display: flex; gap: 8px; align-items: center;">';
        if (c.conteoRojo > 0) {
          htmlAlertas += `<span style="display:flex; align-items:center; gap:4px;" title="Vencido"><span style="width:12px; height:12px; background-color:#dc2626; border-radius:50%; display:inline-block;"></span><strong style="color:#dc2626; font-size:12px;">${c.conteoRojo}</strong></span>`;
        }
        if (c.conteoNaranja > 0) {
          htmlAlertas += `<span style="display:flex; align-items:center; gap:4px;" title="Próximo a vencer"><span style="width:12px; height:12px; background-color:#ea580c; border-radius:50%; display:inline-block;"></span><strong style="color:#ea580c; font-size:12px;">${c.conteoNaranja}</strong></span>`;
        }
        if (c.conteoAmarillo > 0) {
          htmlAlertas += `<span style="display:flex; align-items:center; gap:4px;" title="Atención"><span style="width:12px; height:12px; background-color:#eab308; border-radius:50%; display:inline-block;"></span><strong style="color:#ca8a04; font-size:12px;">${c.conteoAmarillo}</strong></span>`;
        }
        if (c.conteoRojo === 0 && c.conteoNaranja === 0 && c.conteoAmarillo === 0) {
          htmlAlertas += `<span style="color: #16a34a; font-size: 12px; font-weight: 500;">Al día ✓</span>`;
        }
        htmlAlertas += '</div>';
      }

      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      if (contratistaSeleccionadoId === c.id) {
        tr.classList.add('selected-row');
      }

      tr.innerHTML = `
        <td style="padding: 12px; font-weight: 500; color: #1e293b;">${c.razon_social}</td>
        <td style="padding: 12px; color: #475569;">${c.cuit || '-'}</td>
        <td style="padding: 12px; display: flex; gap: 8px;" onclick="event.stopPropagation()">
          <button class="btn-edit-contratista" data-id="${c.id}" data-razon="${c.razon_social}" data-cuit="${c.cuit || ''}" style="background: #e0f2fe; color: #0284c7; border: none; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">Editar</button>
          <button class="btn-delete-contratista" data-id="${c.id}" style="background: #fee2e2; color: #dc2626; border: none; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">Eliminar</button>
        </td>
        <td style="padding: 12px;">${htmlAlertas}</td>
      `;

      tr.onclick = () => {
        document.querySelectorAll('#tabla-contratistas-body tr').forEach(row => row.classList.remove('selected-row'));
        tr.classList.add('selected-row');
        seleccionarContratista(c.id, c.razon_social);
      };

      tablaBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-edit-contratista').forEach(btn => {
      btn.onclick = (e) => {
        editId.value = e.target.getAttribute('data-id');
        editRazonSocial.value = e.target.getAttribute('data-razon');
        editCuit.value = e.target.getAttribute('data-cuit');
        modalEditar.style.display = 'flex';
      };
    });

    document.querySelectorAll('.btn-delete-contratista').forEach(btn => {
      btn.onclick = async (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm("¿Estás seguro de que deseas eliminar este contratista?")) {
          const empresaIdActual = obtenerEmpresaIdSesionActiva();
          let qDel = _supabase.from('contratistas').delete().eq('id', id);
          if (empresaIdActual) qDel = qDel.eq('empresa_id', empresaIdActual);

          const { error: delError } = await qDel;
          if (delError) {
            mostrarAlerta("Error", "No se pudo eliminar: " + delError.message, false);
          } else {
            if (contratistaSeleccionadoId === id) deseleccionarContratista();
            mostrarAlerta("Éxito", "Contratista eliminado correctamente.", true, cargarContratistas);
          }
        }
      };
    });
  }

  function seleccionarContratista(id, razonSocial) {
    contratistaSeleccionadoId = id;
    document.getElementById('contratista-seleccionado-chofer').innerText = `Contratista: ${razonSocial}`;
    document.getElementById('contratista-seleccionado-unidad').innerText = `Contratista: ${razonSocial}`;

    const contenedorBtn = document.getElementById('contenedor-btn-deseleccionar');
    if (contenedorBtn) {
      contenedorBtn.innerHTML = `
        <button id="btn-deseleccionar" style="background: #e2e8f0; color: #334155; border: none; padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 5px;">
          ✕ Deseleccionar (${razonSocial})
        </button>
      `;
      document.getElementById('btn-deseleccionar').onclick = deseleccionarContratista;
    }

    cargarChoferesAsignados(id);
    cargarUnidadesAsignadas(id);
  }

  function deseleccionarContratista() {
    contratistaSeleccionadoId = null;
    document.getElementById('contratista-seleccionado-chofer').innerText = 'Selecciona un contratista arriba';
    document.getElementById('contratista-seleccionado-unidad').innerText = 'Selecciona un contratista arriba';

    document.getElementById('tabla-choferes-asignados-body').innerHTML = '<tr><td colspan="3" class="empty-table-msg" style="text-align: center; padding: 15px; color: #64748b;">Sin seleccionar contratista.</td></tr>';
    document.getElementById('tabla-unidades-asignadas-body').innerHTML = '<tr><td colspan="3" class="empty-table-msg" style="text-align: center; padding: 15px; color: #64748b;">Sin seleccionar contratista.</td></tr>';
    
    document.getElementById('badge-choferes-count').innerText = '0 reg.';
    document.getElementById('badge-unidades-count').innerText = '0 reg.';

    document.querySelectorAll('#tabla-contratistas-body tr').forEach(row => row.classList.remove('selected-row'));

    const contenedorBtn = document.getElementById('contenedor-btn-deseleccionar');
    if (contenedorBtn) contenedorBtn.innerHTML = '';
  }

  async function cargarChoferesAsignados(contratistaId) {
    const tbody = document.getElementById('tabla-choferes-asignados-body');
    const badge = document.getElementById('badge-choferes-count');
    
    tbody.innerHTML = '<tr><td colspan="3" class="empty-table-msg" style="text-align: center; padding: 15px;">Cargando choferes...</td></tr>';

    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    let qChoferes = _supabase.from('choferes').select('*').eq('contratista_id', contratistaId);
    if (empresaIdActual) qChoferes = qChoferes.eq('empresa_id', empresaIdActual);

    const { data: choferes, error } = await qChoferes;

    if (error) {
      badge.innerText = "0 reg.";
      tbody.innerHTML = `<tr><td colspan="3" class="empty-table-msg" style="text-align: center; padding: 15px; color: #dc2626;">Error al cargar choferes: ${error.message}</td></tr>`;
      return;
    }

    const listaChoferes = choferes || [];
    badge.innerText = `${listaChoferes.length} reg.`;
    
    if (listaChoferes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-table-msg" style="text-align: center; padding: 15px; color: #64748b;">No hay choferes asignados a este contratista.</td></tr>';
      return;
    }

    let qUnidCont = _supabase.from('unidades').select('id, patente').eq('contratista_id', contratistaId);
    if (empresaIdActual) qUnidCont = qUnidCont.eq('empresa_id', empresaIdActual);
    const { data: unidadesContratista } = await qUnidCont;

    const mapaUnidades = {};
    (unidadesContratista || []).forEach(u => {
      mapaUnidades[u.id] = u.patente;
    });

    tbody.innerHTML = '';
    listaChoferes.forEach(ch => {
      const fechaVto = ch.vencimiento_licencia || ch.vencimiento_registro;
      const licenciaEval = evaluarVencimiento(fechaVto);
      const dniBusqueda = ch.dni || '';
      const nombreChofer = ch.nombre_apellido || ch.nombre || '-';
      
      let unidadAsignada = 'Sin unidad';
      if (ch.unidad_id && mapaUnidades[ch.unidad_id]) {
        unidadAsignada = mapaUnidades[ch.unidad_id];
      } else if (ch.patente_asignada) {
        unidadAsignada = ch.patente_asignada;
      } else if (ch.patente) {
        unidadAsignada = ch.patente;
      }

      const fotoRegistro = ch.foto_licencia || ch.foto_registro;
      const btnRegistroImg = fotoRegistro ? ` <button class="btn-ver-doc" data-url="${fotoRegistro}" data-titulo="Registro / Licencia - ${nombreChofer}" style="background:none; border:none; color:#0284c7; cursor:pointer; text-decoration:underline; font-size:11px;">[Img]</button>` : '';

      tbody.innerHTML += `
        <tr>
          <td style="padding: 10px; vertical-align: middle;">
            <strong>${nombreChofer}</strong><br>
            <span style="font-size: 11px; color: #64748b;">DNI: ${dniBusqueda}</span>
          </td>
          <td style="padding: 10px; vertical-align: middle;">
            <span style="${licenciaEval.style}">${licenciaEval.texto}</span>${btnRegistroImg}
          </td>
          <td style="padding: 10px; vertical-align: middle;">
            <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between;">
              <span style="font-weight: 600; color: #0284c7; font-size: 13px;">${unidadAsignada}</span>
              <a href="chofer.html?buscar=${encodeURIComponent(dniBusqueda)}" class="btn-primary-sm" style="text-decoration: none; padding: 5px 10px; font-size: 11px; background: #2563eb; color: white; border-radius: 6px; display: inline-block;">Ir a Chofer ↗</a>
            </div>
          </td>
        </tr>
      `;
    });
  }

  async function cargarUnidadesAsignadas(contratistaId) {
    const tbody = document.getElementById('tabla-unidades-asignadas-body');
    const badge = document.getElementById('badge-unidades-count');
    
    tbody.innerHTML = '<tr><td colspan="3" class="empty-table-msg" style="text-align: center; padding: 15px;">Cargando unidades...</td></tr>';

    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    let qUnidades = _supabase.from('unidades').select('*').eq('contratista_id', contratistaId).order('patente', { ascending: true });
    if (empresaIdActual) qUnidades = qUnidades.eq('empresa_id', empresaIdActual);

    const { data, error } = await qUnidades;

    if (error) {
      badge.innerText = "0 reg.";
      tbody.innerHTML = '<tr><td colspan="3" class="empty-table-msg" style="text-align: center; padding: 15px; color: #dc2626;">Error al cargar unidades.</td></tr>';
      return;
    }

    const unidades = data || [];
    badge.innerText = `${unidades.length} reg.`;

    if (unidades.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-table-msg" style="text-align: center; padding: 15px; color: #64748b;">No hay unidades asignadas a este contratista.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    unidades.forEach(u => {
      const cedula = evaluarVencimiento(u.vencimiento_cedula);
      const seguro = evaluarVencimiento(u.vencimiento_seguro);
      const vtv = evaluarVencimiento(u.vencimiento_vtv_rto);

      const btnCedula = u.foto_cedula ? ` <button class="btn-ver-doc" data-url="${u.foto_cedula}" data-titulo="Cédula - ${u.patente}" style="background:none; border:none; color:#0284c7; cursor:pointer; text-decoration:underline; font-size:10px;">[Img]</button>` : '';
      const btnSeguro = u.foto_seguro ? ` <button class="btn-ver-doc" data-url="${u.foto_seguro}" data-titulo="Seguro - ${u.patente}" style="background:none; border:none; color:#0284c7; cursor:pointer; text-decoration:underline; font-size:10px;">[Img]</button>` : '';
      const btnVtv = u.foto_vtv_rto ? ` <button class="btn-ver-doc" data-url="${u.foto_vtv_rto}" data-titulo="VTV - ${u.patente}" style="background:none; border:none; color:#0284c7; cursor:pointer; text-decoration:underline; font-size:10px;">[Img]</button>` : '';

      const tipoVehiculo = u.tipo ? u.tipo.toUpperCase() : '-';
      const modeloVehiculo = u.modelo || 'Sin modelo';
      const anioVehiculo = u.anio ? `(${u.anio})` : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding: 10px; font-weight: 600; color: #0284c7; vertical-align: middle;">${u.patente}</td>
        <td style="padding: 10px; font-size: 12px; vertical-align: middle;">
          <div style="font-weight: 600; color: #1e293b;">${tipoVehiculo}</div>
          <div style="font-size: 11px; color: #64748b;">${modeloVehiculo} ${anioVehiculo}</div>
        </td>
        <td style="padding: 10px; font-size: 11px; vertical-align: middle; line-height: 1.8;">
          <div><b>Céd:</b> <span style="${cedula.style}">${cedula.texto}</span>${btnCedula}</div>
          <div><b>Seg:</b> <span style="${seguro.style}">${seguro.texto}</span>${btnSeguro}</div>
          <div><b>VTV:</b> <span style="${vtv.style}">${vtv.texto}</span>${btnVtv}</div>
        </td>
        <td style="padding: 10px; vertical-align: middle; text-align: right;">
          <a href="unidad.html?buscar=${encodeURIComponent(u.patente)}" class="btn-primary-sm" style="text-decoration: none; padding: 5px 10px; font-size: 11px; background: #16a34a; color: white; border-radius: 6px; display: inline-block;">Ir a Unidad ↗</a>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  if (formContratista) {
    formContratista.onsubmit = async (e) => {
      e.preventDefault();
      const razonSocial = inputRazonSocial.value.trim();
      const cuit = inputCuit.value.trim();
      const empresaIdActual = obtenerEmpresaIdSesionActiva();

      let nuevoRegistro = { razon_social: razonSocial, cuit: cuit };
      if (empresaIdActual) nuevoRegistro.empresa_id = empresaIdActual;

      const { error } = await _supabase.from('contratistas').insert([nuevoRegistro]);
      if (error) {
        mostrarAlerta("Error", error.message, false);
      } else {
        mostrarAlerta("¡Éxito!", "Contratista registrado correctamente.", true, () => {
          formContratista.reset();
          cargarContratistas();
        });
      }
    };
  }

  if (formEditar) {
    formEditar.onsubmit = async (e) => {
      e.preventDefault();
      const empresaIdActual = obtenerEmpresaIdSesionActiva();
      let qUp = _supabase
        .from('contratistas')
        .update({ razon_social: editRazonSocial.value.trim(), cuit: editCuit.value.trim() })
        .eq('id', editId.value);
        
      if (empresaIdActual) qUp = qUp.eq('empresa_id', empresaIdActual);

      const { error } = await qUp;

      if (error) {
        mostrarAlerta("Error", error.message, false);
      } else {
        mostrarAlerta("¡Éxito!", "Actualizado correctamente.", true, () => {
          modalEditar.style.display = 'none';
          cargarContratistas();
        });
      }
    };
  }

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-ver-doc')) {
      const url = e.target.getAttribute('data-url');
      const titulo = e.target.getAttribute('data-titulo');
      
      visorImg.src = url;
      visorTitulo.innerText = titulo;
      visorBtnDescargar.href = url;
      modalVisor.style.display = 'flex';
    }
  });

  if (btnCloseEditar) btnCloseEditar.onclick = () => modalEditar.style.display = 'none';
  if (btnCancelEditar) btnCancelEditar.onclick = () => modalEditar.style.display = 'none';
  
  if (btnCloseVisor) btnCloseVisor.onclick = () => modalVisor.style.display = 'none';
  if (modalVisor) {
    modalVisor.onclick = (e) => {
      if (e.target === modalVisor) modalVisor.style.display = 'none';
    };
  }

  cargarContratistas();
});