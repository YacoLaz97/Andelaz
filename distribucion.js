const SUPABASE_URL = "https://zmanwspxuqwviyzpxtan.supabase.co";
const SUPABASE_KEY = "sb_publishable_geEnhhRNhJ8V7AuM_qSe6g_GEYvW_h_";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let empresaIdUsuario = null;

// Helper para validar si un string es un UUID válido
const esUuidValido = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

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
    empresaIdUsuario = localStorage.getItem("empresa_id");
  }
  
  // Si es un UUID no debemos hacer parseInt, de lo contrario lo rompería recortándolo
  if (empresaIdUsuario && !esUuidValido(empresaIdUsuario)) {
    return parseInt(empresaIdUsuario);
  }
  
  return empresaIdUsuario || null;
}

document.addEventListener("DOMContentLoaded", async () => {
  obtenerEmpresaIdSesionActiva();

  const btnOpenModal = document.getElementById("btn-open-modal-dist");
  const modalDistribucion = document.getElementById("modal-distribucion");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnCancelDist = document.getElementById("btn-cancel-dist");
  
  const selectContratistaModal = document.getElementById("select-contratista-filtro");
  const selectChoferAlta = document.getElementById("select-chofer-alta");
  const formDistribucion = document.getElementById("form-distribucion");
  const tablaAltaBody = document.getElementById("tabla-alta-body");
  const inputIdAutomatico = document.getElementById("input-id-automatico");
  const inputSearchAlta = document.getElementById("input-search-alta");
  
  const modalTitleDist = document.getElementById("modal-title-dist");
  const btnSubmitDist = document.getElementById("btn-submit-dist");

  const barraAcciones = inputSearchAlta ? inputSearchAlta.closest("div") || inputSearchAlta.parentElement : document.querySelector(".card-header");

  const modalAlerta = document.getElementById("modal-alerta");
  const alertaTitulo = document.getElementById("alerta-titulo");
  const alertaMensaje = document.getElementById("alerta-mensaje");
  const alertaBtnAceptar = document.getElementById("alerta-btn-aceptar");

  const modalDelete = document.getElementById("modal-confirm-delete");
  const btnDeleteAccept = document.getElementById("btn-confirm-delete-accept");
  const btnDeleteCancel = document.getElementById("btn-confirm-delete-cancel");

  let todasLasDistribuciones = [];
  let idRegistroEnEdicion = null;
  let idParaEliminar = null;

  if (barraAcciones) {
    barraAcciones.style.cssText = "display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 12px 20px;";
  }

  if (inputSearchAlta) {
    inputSearchAlta.style.cssText = "width: 180px; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 14px; background: #fff;";
  }

  let contenedorFiltros = document.getElementById("contenedor-filtros-dinamico");
  if (!contenedorFiltros && barraAcciones) {
    contenedorFiltros = document.createElement("div");
    contenedorFiltros.id = "contenedor-filtros-dinamico";
    contenedorFiltros.style.cssText = "display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-left: auto;";
    
    contenedorFiltros.innerHTML = `
      <select id="filtro-contratista-tabla" class="input-custom" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 14px; background: #fff;">
        <option value="">Todos los contratistas</option>
      </select>
      <select id="filtro-orden-fecha" class="input-custom" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 14px; background: #fff;">
        <option value="desc">Fecha descendente</option>
        <option value="asc">Fecha ascendente</option>
      </select>
    `;

    if (inputSearchAlta) {
      barraAcciones.insertBefore(contenedorFiltros, inputSearchAlta);
    } else {
      barraAcciones.appendChild(contenedorFiltros);
    }
  }

  const filtroContratistaTabla = document.getElementById("filtro-contratista-tabla");
  const filtroOrdenFecha = document.getElementById("filtro-orden-fecha");

  const tablaHeadRow = document.querySelector(".card-body table thead tr") || document.querySelector("table thead tr");
  if (tablaHeadRow) {
    tablaHeadRow.innerHTML = `
      <th>ID AUTOMÁTICO</th>
      <th>FECHA</th>
      <th>CHOFER ASIGNADO</th>
      <th>CONTRATISTA</th>
      <th>ALERTAS DOCUMENTARIAS (VENCIMIENTOS)</th>
      <th style="text-align: right;">ACCIONES</th>
    `;
  }

  await cargarContratistasFiltro();
  await cargarDistribuciones();

  if (btnOpenModal) {
    btnOpenModal.addEventListener("click", async () => {
      idRegistroEnEdicion = null;
      if (formDistribucion) formDistribucion.reset();
      
      if (modalTitleDist) modalTitleDist.innerText = "Nueva Distribución";
      if (btnSubmitDist) btnSubmitDist.innerText = "Crear Distribución";

      if (modalDistribucion) modalDistribucion.classList.add("active");
      
      await cargarContratistasModal();
      await cargarChoferesModal();
      
      try {
        const empresaIdActual = obtenerEmpresaIdSesionActiva();
        let queryCount = supabaseClient.from("distribucion").select("*", { count: "exact", head: true });
        if (empresaIdActual) queryCount = queryCount.eq("empresa_id", empresaIdActual);

        const { count, error } = await queryCount;
        
        if (!error && inputIdAutomatico) {
          const siguienteNumero = (count || 0) + 1;
          inputIdAutomatico.value = `AZ${siguienteNumero}`;
        }
      } catch (err) {
        console.error("Error al calcular el ID automático:", err);
        if (inputIdAutomatico) inputIdAutomatico.value = "AZ1";
      }
    });
  }

  if (selectContratistaModal) {
    selectContratistaModal.addEventListener("change", (e) => {
      const contratistaId = e.target.value;
      cargarChoferesModal(contratistaId);
    });
  }

  [btnCloseModal, btnCancelDist].forEach(btn => {
    if (btn) {
      btn.addEventListener("click", () => {
        if (modalDistribucion) modalDistribucion.classList.remove("active");
      });
    }
  });

  if (filtroContratistaTabla) {
    filtroContratistaTabla.addEventListener("change", () => aplicarFiltrosYOrden());
  }

  if (filtroOrdenFecha) {
    filtroOrdenFecha.addEventListener("change", () => aplicarFiltrosYOrden());
  }

  if (inputSearchAlta) {
    inputSearchAlta.addEventListener("input", () => aplicarFiltrosYOrden());
  }

  if (btnDeleteCancel) {
    btnDeleteCancel.addEventListener("click", () => {
      idParaEliminar = null;
      if (modalDelete) modalDelete.classList.remove("active");
    });
  }

  if (btnDeleteAccept) {
    btnDeleteAccept.addEventListener("click", async () => {
      if (idParaEliminar) {
        try {
          const empresaIdActual = obtenerEmpresaIdSesionActiva();
          let queryDel = supabaseClient.from("distribucion").delete().eq("id", parseInt(idParaEliminar));
          if (empresaIdActual) queryDel = queryDel.eq("empresa_id", empresaIdActual);

          const { error } = await queryDel;
          if (error) throw error;
          
          idParaEliminar = null;
          if (modalDelete) modalDelete.classList.remove("active");
          mostrarAlerta("¡Éxito!", "Distribución eliminada correctamente.", true, () => {
            cargarDistribuciones();
          });
        } catch (err) {
          console.error("Error al eliminar la distribución:", err);
          if (modalDelete) modalDelete.classList.remove("active");
          mostrarAlerta("¡Error!", "No se pudo eliminar el registro.", false);
        }
      }
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === modalDelete) {
      idParaEliminar = null;
      modalDelete.classList.remove("active");
    }
  });

  if (formDistribucion) {
    formDistribucion.addEventListener("submit", async (e) => {
      e.preventDefault();
      const choferId = selectChoferAlta ? selectChoferAlta.value : null;
      const codigoPersonalizado = inputIdAutomatico ? inputIdAutomatico.value : null;

      if (!choferId) {
        mostrarAlerta("¡Atención!", "Por favor, seleccione un chofer.", false);
        return;
      }

      try {
        const empresaIdActual = obtenerEmpresaIdSesionActiva();

        const { data: choferData, error: choferError } = await supabaseClient
          .from("choferes")
          .select("id, nombre_apellido, patente_asignada, unidad_id, empresa_id, contratista_id, usuario_id")
          .eq("id", parseInt(choferId))
          .single();

        if (choferError) throw choferError;

        let nombreChoferHist = choferData ? choferData.nombre_apellido : null;
        let patenteHist = choferData ? choferData.patente_asignada : null;
        let unidadIdEncontrado = choferData ? choferData.unidad_id : null;
        let empresaIdEncontrado = choferData ? choferData.empresa_id : empresaIdActual;
        let contratistaIdEncontrado = choferData ? choferData.contratista_id : null;
        let usuarioIdChofer = choferData ? choferData.usuario_id : null;

        if (!unidadIdEncontrado && patenteHist) {
          const { data: unidadData } = await supabaseClient
            .from("unidades")
            .select("id")
            .eq("patente", patenteHist)
            .maybeSingle();

          if (unidadData) {
            unidadIdEncontrado = unidadData.id;
          }
        }

        // Mantener empresa_id como UUID si viene en ese formato
        const empresaIdFinal = empresaIdEncontrado || empresaIdActual || null;

        const payload = {
          chofer_id: parseInt(choferId),
          chofer_historico: nombreChoferHist,
          unidad_id: unidadIdEncontrado ? parseInt(unidadIdEncontrado) : null,
          patente_historica: patenteHist,
          empresa_id: empresaIdFinal,
          contratista_id: contratistaIdEncontrado ? parseInt(contratistaIdEncontrado) : null,
          usuario_id: esUuidValido(usuarioIdChofer) ? usuarioIdChofer : null,
          finalizado: false,
          estado: "activo"
        };

        if (codigoPersonalizado && !idRegistroEnEdicion) {
          payload.id_custom = codigoPersonalizado;
        }

        if (idRegistroEnEdicion) {
          const idNumerico = parseInt(idRegistroEnEdicion);
          
          let queryUp = supabaseClient.from("distribucion").update(payload).eq("id", idNumerico);
          
          if (empresaIdFinal) {
            queryUp = queryUp.eq("empresa_id", empresaIdFinal);
          }

          const { error } = await queryUp;
          if (error) {
            console.error("Detalle del error de Supabase (Update):", error);
            throw error;
          }
          mostrarAlerta("¡Éxito!", "Distribución actualizada correctamente.", true);
        } else {
          const { error } = await supabaseClient.from("distribucion").insert([payload]);
          if (error) {
            console.error("Detalle del error de Supabase (Insert):", error);
            throw error;
          }
          mostrarAlerta("¡Éxito!", "Distribución creada correctamente.", true);
        }

        modalDistribucion.classList.remove("active");
        formDistribucion.reset();
        idRegistroEnEdicion = null;
        cargarDistribuciones();
      } catch (err) {
        console.error("Error al guardar la distribución:", err);
        mostrarAlerta("¡Error!", "Hubo un error al procesar la distribución.", false);
      }
    });
  }

  function mostrarAlerta(titulo, mensaje, esExito = false, callback = null) {
    if (!modalAlerta || !alertaTitulo || !alertaMensaje || !alertaBtnAceptar) {
      alert(`${titulo}: ${mensaje}`);
      if (callback) callback();
      return;
    }

    alertaTitulo.innerText = titulo;
    alertaTitulo.style.color = esExito ? "#16a34a" : "#dc2626";
    alertaMensaje.innerText = mensaje;

    alertaBtnAceptar.onclick = () => {
      modalAlerta.classList.remove("active");
      if (callback) callback();
    };

    modalAlerta.classList.add("active");
  }

  async function cargarContratistasFiltro() {
    try {
      const empresaIdActual = obtenerEmpresaIdSesionActiva();
      let query = supabaseClient.from("contratistas").select("id, razon_social");
      if (empresaIdActual) query = query.eq("empresa_id", empresaIdActual);

      const { data, error } = await query;
      if (error) throw error;

      if (filtroContratistaTabla) {
        filtroContratistaTabla.innerHTML = '<option value="">Todos los contratistas</option>';
        if (data) {
          data.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.razon_social;
            filtroContratistaTabla.appendChild(opt);
          });
        }
      }
    } catch (err) {
      console.error("Error al cargar contratistas para filtro:", err);
    }
  }

  async function cargarContratistasModal() {
    try {
      const empresaIdActual = obtenerEmpresaIdSesionActiva();
      let query = supabaseClient.from("contratistas").select("id, razon_social");
      if (empresaIdActual) query = query.eq("empresa_id", empresaIdActual);

      const { data, error } = await query;
      if (error) throw error;

      const selectModal = document.getElementById("select-contratista-modal") || selectContratistaModal;
      if (selectModal) {
        selectModal.innerHTML = '<option value="">Todos los contratistas</option>';
        if (data && data.length > 0) {
          data.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.razon_social;
            selectModal.appendChild(opt);
          });
        }
      }
    } catch (err) {
      console.error("Error al cargar contratistas en modal:", err);
    }
  }

  async function cargarChoferesModal(contratistaId = "") {
    try {
      const empresaIdActual = obtenerEmpresaIdSesionActiva();
      let query = supabaseClient.from("choferes").select("id, nombre_apellido, contratista_id, patente_asignada, unidad_id, empresa_id");
      
      if (empresaIdActual) {
        query = query.eq("empresa_id", empresaIdActual);
      }
      if (contratistaId) {
        query = query.eq("contratista_id", parseInt(contratistaId));
      }

      const { data, error } = await query;
      if (error) throw error;

      if (selectChoferAlta) {
        selectChoferAlta.innerHTML = '<option value="">Seleccione chofer...</option>';
        if (data) {
          data.forEach(ch => {
            const opt = document.createElement("option");
            opt.value = ch.id;
            const patenteTexto = ch.patente_asignada ? ` - Patente: ${ch.patente_asignada}` : "";
            opt.textContent = `${ch.nombre_apellido}${patenteTexto}`;
            selectChoferAlta.appendChild(opt);
          });
        }
      }
    } catch (err) {
      console.error("Error al cargar choferes:", err);
    }
  }

  async function cargarDistribuciones() {
    try {
      const empresaIdActual = obtenerEmpresaIdSesionActiva();
      let queryDist = supabaseClient.from("distribucion").select("*");
      if (empresaIdActual) queryDist = queryDist.eq("empresa_id", empresaIdActual);

      const { data: distribuciones, error: errDist } = await queryDist;
      if (errDist) throw errDist;

      if (!distribuciones || distribuciones.length === 0) {
        todasLasDistribuciones = [];
        aplicarFiltrosYOrden();
        return;
      }

      const registrosEnriquecidos = await Promise.all(distribuciones.map(async (item) => {
        let choferData = null;
        let unidadData = null;
        let contratistaData = null;

        if (item.chofer_id) {
          const { data: ch } = await supabaseClient
            .from("choferes")
            .select("id, nombre_apellido, patente_asignada, contratista_id, unidad_id, vencimiento_licencia")
            .eq("id", item.chofer_id)
            .maybeSingle();
          choferData = ch;
        }

        const idContratistaConsulta = item.contratista_id || (choferData ? choferData.contratista_id : null);
        if (idContratistaConsulta) {
          const { data: co } = await supabaseClient
            .from("contratistas")
            .select("id, razon_social")
            .eq("id", idContratistaConsulta)
            .maybeSingle();
          contratistaData = co;
        }

        const idUnidadConsulta = item.unidad_id || (choferData ? choferData.unidad_id : null);
        if (idUnidadConsulta) {
          const { data: un } = await supabaseClient
            .from("unidades")
            .select("id, patente, vencimiento_cedula, vencimiento_seguro, vencimiento_vtv_rto")
            .eq("id", idUnidadConsulta)
            .maybeSingle();
          unidadData = un;
        }

        return {
          ...item,
          choferes: choferData ? { ...choferData, contratistas: contratistaData } : null,
          unidades: unidadData,
          contratista_objeto: contratistaData
        };
      }));

      todasLasDistribuciones = registrosEnriquecidos;
      aplicarFiltrosYOrden();
    } catch (err) {
      console.error("Error al cargar la tabla de distribuciones:", err);
      if (tablaAltaBody) {
        tablaAltaBody.innerHTML = `<tr><td colspan="6" class="empty-table-msg">Error al cargar registros. Verifique la conexión o estructura.</td></tr>`;
      }
    }
  }

  function evaluarVencimiento(fechaStr) {
    if (!fechaStr) return { estado: 'ok' };
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vencimiento = new Date(fechaStr + 'T00:00:00');
    const diferenciaDias = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));

    if (diferenciaDias < 0) return { estado: 'rojo' };
    if (diferenciaDias <= 7) return { estado: 'naranja' };
    if (diferenciaDias <= 14) return { estado: 'amarillo' };
    return { estado: 'ok' };
  }

  function calcularAlertasRegistro(item) {
    let rojos = 0, naranjas = 0, amarillos = 0;

    if (item.choferes) {
      const fecChofer = item.choferes.vencimiento_licencia;
      const evChofer = evaluarVencimiento(fecChofer);
      if (evChofer.estado === 'rojo') rojos++;
      if (evChofer.estado === 'naranja') naranjas++;
      if (evChofer.estado === 'amarillo') amarillos++;
    }

    if (item.unidades) {
      const fechasUnidad = [
        item.unidades.vencimiento_cedula,
        item.unidades.vencimiento_seguro,
        item.unidades.vencimiento_vtv_rto
      ];
      fechasUnidad.forEach(fecha => {
        const evUnidad = evaluarVencimiento(fecha);
        if (evUnidad.estado === 'rojo') rojos++;
        if (evUnidad.estado === 'naranja') naranjas++;
        if (evUnidad.estado === 'amarillo') amarillos++;
      });
    }

    return { rojos, naranjas, amarillos };
  }

  function aplicarFiltrosYOrden() {
    let resultado = [...todasLasDistribuciones];

    const textoBusqueda = inputSearchAlta ? inputSearchAlta.value.toLowerCase() : "";
    if (textoBusqueda) {
      resultado = resultado.filter(item => {
        const idStr = `#${item.id}`.toLowerCase();
        const idCustomStr = (item.id_custom || "").toLowerCase();
        const chofer = item.chofer_historico || item.choferes?.nombre_apellido?.toLowerCase() || "";
        const patente = (item.patente_historica || item.unidades?.patente || item.choferes?.patente_asignada || "").toLowerCase();
        const contratista = (item.contratista_objeto?.razon_social || item.choferes?.contratistas?.razon_social || "").toLowerCase();
        return idStr.includes(textoBusqueda) || idCustomStr.includes(textoBusqueda) || chofer.includes(textoBusqueda) || patente.includes(textoBusqueda) || contratista.includes(textoBusqueda);
      });
    }

    const contratistaFiltroId = filtroContratistaTabla ? filtroContratistaTabla.value : "";
    if (contratistaFiltroId) {
      resultado = resultado.filter(item => (item.contratista_id == contratistaFiltroId) || (item.choferes?.contratista_id == contratistaFiltroId));
    }

    const orden = filtroOrdenFecha ? filtroOrdenFecha.value : "desc";
    resultado.sort((a, b) => {
      const fechaA = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
      const fechaB = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
      return orden === "asc" ? fechaA - fechaB : fechaB - fechaA;
    });

    renderizarTabla(resultado);
  }

  function renderizarTabla(lista) {
    if (!tablaAltaBody) return;

    if (lista.length === 0) {
      tablaAltaBody.innerHTML = `<tr><td colspan="6" class="empty-table-msg">No hay distribuciones registradas.</td></tr>`;
      return;
    }

    tablaAltaBody.innerHTML = "";
    lista.forEach((item) => {
      const tr = document.createElement("tr");
      
      const fechaFormateada = item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleDateString() : "-";
      const choferNombre = item.chofer_historico || item.choferes?.nombre_apellido || "Chofer no asignado";
      const patenteMostrada = item.patente_historica || item.unidades?.patente || item.choferes?.patente_asignada || "Sin patente";
      const contratistaNombre = item.contratista_objeto?.razon_social || item.choferes?.contratistas?.razon_social || "-";
      const idVisual = item.id_custom || `#${item.id}`;

      const { rojos, naranjas, amarillos } = calcularAlertasRegistro(item);
      let htmlAlertas = '<div style="display: flex; gap: 8px; align-items: center;">';

      if (rojos > 0) {
        htmlAlertas += `<span style="display:flex; align-items:center; gap:4px;" title="Vencido"><span style="width:12px; height:12px; background-color:#dc2626; border-radius:50%; display:inline-block;"></span><strong style="color:#dc2626; font-size:12px;">${rojos}</strong></span>`;
      }
      if (naranjas > 0) {
        htmlAlertas += `<span style="display:flex; align-items:center; gap:4px;" title="Próximo a vencer"><span style="width:12px; height:12px; background-color:#ea580c; border-radius:50%; display:inline-block;"></span><strong style="color:#ea580c; font-size:12px;">${naranjas}</strong></span>`;
      }
      if (amarillos > 0) {
        htmlAlertas += `<span style="display:flex; align-items:center; gap:4px;" title="Atención"><span style="width:12px; height:12px; background-color:#eab308; border-radius:50%; display:inline-block;"></span><strong style="color:#ca8a04; font-size:12px;">${amarillos}</strong></span>`;
      }
      if (rojos === 0 && naranjas === 0 && amarillos === 0) {
        htmlAlertas += `<span style="color: #16a34a; font-size: 12px; font-weight: 500;">Al día ✓</span>`;
      }
      htmlAlertas += '</div>';

      tr.innerHTML = `
        <td><strong>${idVisual}</strong></td>
        <td>${fechaFormateada}</td>
        <td>${choferNombre} <br><small style="color: #0284c7; font-weight:600;">Patente: ${patenteMostrada}</small></td>
        <td><strong>${contratistaNombre}</strong></td>
        <td>${htmlAlertas}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn-ghost-sm btn-editar" data-id="${item.id}" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; margin-right: 6px;">Editar</button>
          <button class="btn-ghost-sm btn-eliminar" data-id="${item.id}" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer;">Eliminar</button>
        </td>
      `;
      tablaAltaBody.appendChild(tr);
    });

    document.querySelectorAll(".btn-editar").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        const registro = todasLasDistribuciones.find(d => d.id == id);
        if (!registro) return;

        idRegistroEnEdicion = registro.id;

        if (modalTitleDist) modalTitleDist.innerText = "Editar Distribución";
        if (btnSubmitDist) btnSubmitDist.innerText = "Guardar";

        if (modalDistribucion) modalDistribucion.classList.add("active");
        
        await cargarContratistasModal();
        await cargarChoferesModal();

        if (inputIdAutomatico) inputIdAutomatico.value = registro.id_custom || `AZ${registro.id}`;
        if (selectChoferAlta) selectChoferAlta.value = registro.chofer_id || "";
      });
    });

    document.querySelectorAll(".btn-eliminar").forEach(btn => {
      btn.addEventListener("click", (e) => {
        idParaEliminar = e.currentTarget.getAttribute("data-id");
        if (modalDelete) modalDelete.classList.remove("active");
      });
    });
  }
});