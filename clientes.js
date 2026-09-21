// Configuración de Supabase
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

let clientesLocales = [];
let idParaEliminar = null;

// Elementos del DOM
const form = document.getElementById('cliente-form');
const inputId = document.getElementById('cliente-id');
const inputRazonSocial = document.getElementById('razon_social');
const inputCuit = document.getElementById('cuit');
const inputPrefijo = document.getElementById('prefijo');
const inputColorPicker = document.getElementById('color_picker');
const inputColorHex = document.getElementById('color_hex');
const colorPreviewBadge = document.getElementById('color_preview_badge');
const btnCancel = document.getElementById('btn-cancel');
const btnSave = document.getElementById('btn-save');
const formTitle = document.getElementById('form-title');
const tablaBody = document.getElementById('tabla-clientes-body');

// Modales y Buscador
const modal = document.getElementById('modal-cliente');
const modalDelete = document.getElementById('modal-confirm-delete');
const btnOpenModal = document.getElementById('btn-open-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const inputSearch = document.getElementById('input-search');

const btnDeleteAccept = document.getElementById('btn-confirm-delete-accept');
const btnDeleteCancel = document.getElementById('btn-confirm-delete-cancel');

// Modal Form
btnOpenModal.addEventListener('click', () => { resetFormulario(); abrirModal(); });
btnCloseModal.addEventListener('click', cerrarModal);
btnCancel.addEventListener('click', cerrarModal);

function abrirModal() { modal.classList.add('active'); }
function cerrarModal() { modal.classList.remove('active'); resetFormulario(); }

// Modal Confirm Delete
btnDeleteCancel.addEventListener('click', () => {
  idParaEliminar = null;
  modalDelete.classList.remove('active');
});

btnDeleteAccept.addEventListener('click', async () => {
  if (idParaEliminar) {
    const empresaIdActual = obtenerEmpresaIdSesionActiva();
    let query = _supabase.from('clientes').delete().eq('id', idParaEliminar);
    if (empresaIdActual) query = query.eq('empresa_id', empresaIdActual);

    const { error } = await query;
    idParaEliminar = null;
    modalDelete.classList.remove('active');
    if (!error) cargarClientes();
  }
});

// Sync Color Picker
inputColorPicker.addEventListener('input', (e) => {
  inputColorHex.value = e.target.value;
  actualizarPreviewColor(e.target.value);
});

inputColorHex.addEventListener('input', (e) => {
  let val = e.target.value;
  if (val.startsWith('#') && val.length === 7) {
    inputColorPicker.value = val;
    actualizarPreviewColor(val);
  }
});

function actualizarPreviewColor(hex) {
  colorPreviewBadge.style.backgroundColor = hex;
  colorPreviewBadge.style.color = calcularColorTexto(hex);
}

function calcularColorTexto(hexColor) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return ((r * 299 + g * 587 + b * 114) / 1000) > 128 ? '#000000' : '#ffffff';
}

async function cargarClientes() {
  tablaBody.innerHTML = '<tr><td colspan="6" class="empty-table-msg">Cargando clientes de Supabase...</td></tr>';
  
  const empresaIdActual = obtenerEmpresaIdSesionActiva();
  let query = _supabase.from('clientes').select('*').order('id', { ascending: false });
  if (empresaIdActual) query = query.eq('empresa_id', empresaIdActual);

  const { data, error } = await query;

  if (error) {
    tablaBody.innerHTML = `<tr><td colspan="6" class="empty-table-msg" style="color: #ef4444;">Error: ${error.message}</td></tr>`;
    return;
  }

  clientesLocales = data || [];
  renderizarTabla(clientesLocales);
}

function renderizarTabla(lista) {
  if (!lista || lista.length === 0) {
    tablaBody.innerHTML = '<tr><td colspan="6" class="empty-table-msg">No se encontraron clientes.</td></tr>';
    return;
  }

  tablaBody.innerHTML = '';
  lista.forEach(cliente => {
    const textColor = calcularColorTexto(cliente.color_hex);
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
      <td><strong>${cliente.prefijo}</strong></td>
      <td>${cliente.razon_social}</td>
      <td>${cliente.cuit}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <!-- Estética de borde redondeado suave idéntica a la referencia -->
          <span style="width: 22px; height: 22px; border-radius: 6px; background-color: ${cliente.color_hex}; border: 1px solid rgba(0,0,0,0.1); display: inline-block;"></span>
          <code>${cliente.color_hex}</code>
        </div>
      </td>
      <td>
        <!-- Etiqueta con bordes redondeados completos y tipografía destacada -->
        <span style="background-color: ${cliente.color_hex}; color: ${textColor}; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 8px; display: inline-block; letter-spacing: 0.3px;">
          ${cliente.prefijo}a123456789
        </span>
      </td>
      <td style="text-align: right;">
        <!-- Botones de Editar y Eliminar con estética moderna y unificada -->
        <button class="btn-edit-cliente" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; margin-right: 6px; transition: background 0.2s;">Editar</button>
        <button class="btn-delete-cliente" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; transition: background 0.2s;">Eliminar</button>
      </td>
    `;

    // Eventos limpios sin llamadas inline
    tr.querySelector('.btn-edit-cliente').addEventListener('click', () => {
      editarCliente(cliente);
    });

    tr.querySelector('.btn-delete-cliente').addEventListener('click', () => {
      solicitarEliminacion(cliente.id);
    });

    tablaBody.appendChild(tr);
  });
}

// Buscador en Tiempo Real
inputSearch.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  if (!query) return renderizarTabla(clientesLocales);

  const filtrados = clientesLocales.filter(c => 
    (c.prefijo || '').toLowerCase().includes(query) ||
    (c.razon_social || '').toLowerCase().includes(query) ||
    (c.cuit || '').toLowerCase().includes(query)
  );
  renderizarTabla(filtrados);
});

// Guardar / Editar
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = inputId.value;
  const razon_social = inputRazonSocial.value.trim();
  const cuit = inputCuit.value.trim();
  const prefijo = inputPrefijo.value.trim().toUpperCase();
  const color_hex = inputColorHex.value.trim();
  const empresaIdActual = obtenerEmpresaIdSesionActiva();

  if (id) {
    let queryUp = _supabase.from('clientes').update({ razon_social, cuit, prefijo, color_hex }).eq('id', id);
    if (empresaIdActual) queryUp = queryUp.eq('empresa_id', empresaIdActual);
    await queryUp;
  } else {
    let nuevoRegistro = { razon_social, cuit, prefijo, color_hex };
    if (empresaIdActual) nuevoRegistro.empresa_id = empresaIdActual;
    await _supabase.from('clientes').insert([nuevoRegistro]);
  }

  cerrarModal();
  cargarClientes();
});

function editarCliente(cliente) {
  inputId.value = cliente.id;
  inputRazonSocial.value = cliente.razon_social;
  inputCuit.value = cliente.cuit;
  inputPrefijo.value = cliente.prefijo;
  inputColorPicker.value = cliente.color_hex;
  inputColorHex.value = cliente.color_hex;
  actualizarPreviewColor(cliente.color_hex);

  formTitle.innerText = 'Editar Cliente';
  btnSave.innerText = 'Actualizar Cliente';
  abrirModal();
}

function solicitarEliminacion(id) {
  idParaEliminar = id;
  modalDelete.classList.add('active');
}

function resetFormulario() {
  inputId.value = '';
  form.reset();
  inputColorPicker.value = '#99fc90';
  inputColorHex.value = '#99fc90';
  actualizarPreviewColor('#99fc90');
  formTitle.innerText = 'Registrar Nuevo Cliente';
  btnSave.innerText = 'Guardar Cliente';
}

document.getElementById('btn-refresh').addEventListener('click', () => {
  inputSearch.value = '';
  cargarClientes();
});

document.addEventListener('DOMContentLoaded', () => {
  obtenerEmpresaIdSesionActiva();
  cargarClientes();
});