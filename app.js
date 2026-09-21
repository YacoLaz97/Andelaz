// ==========================================
// 1. CONFIGURACIÓN Y CLIENTE SUPABASE
// ==========================================
const SUPABASE_URL = "https://zmanwspxuqwviyzpxtan.supabase.co";
const SUPABASE_KEY = "sb_publishable_geEnhhRNhJ8V7AuM_qSe6g_GEYvW_h_";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabaseClient = supabaseClient;

// ==========================================
// 2. FUNCIÓN DE ALERTA VISUAL (TIPO CARD)
// ==========================================
function mostrarAlerta(titulo, mensaje, esExito = false, callback = null) {
  const modalAlerta = document.getElementById("modal-alerta");
  const tituloEl = document.getElementById("alerta-titulo");
  const mensajeEl = document.getElementById("alerta-mensaje");
  const btnAceptar = document.getElementById("alerta-btn-aceptar");

  if (!modalAlerta || !tituloEl || !mensajeEl || !btnAceptar) return;

  tituloEl.textContent = titulo;
  tituloEl.style.color = esExito ? "#047857" : "#b91c1c";
  mensajeEl.textContent = mensaje;
  
  modalAlerta.style.display = "flex";

  const nuevoBtn = btnAceptar.cloneNode(true);
  btnAceptar.parentNode.replaceChild(nuevoBtn, btnAceptar);

  nuevoBtn.addEventListener("click", () => {
    modalAlerta.style.display = "none";
    if (callback && typeof callback === "function") {
      callback();
    }
  });
}

// ==========================================
// 3. LÓGICA DE INICIO DE SESIÓN (INDEX)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const formLogin = document.getElementById("form-login-modal");

  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();

      const userInput = document.getElementById("login-user");
      const passInput = document.getElementById("login-pass");

      if (!userInput || !passInput) return;

      const usuarioIngresado = userInput.value.trim();
      const password = passInput.value.trim();

      try {
        // 1. Buscar usuario y consultar el estado del campo 'activo'
        const { data: datosUsuario, error: errorDb } = await supabaseClient
          .from("usuarios")
          .select("email, nombre, rol, empresa_id, activo, ver_dashboard, ver_deposito, ver_distribucion, ver_distribucion_detalle, ver_entrega, ver_estado_rendicion, ver_clientes, ver_contratista, ver_chofer, ver_unidad, ver_usuarios")
          .eq("usuario", usuarioIngresado)
          .maybeSingle();

        if (errorDb || !datosUsuario) {
          mostrarAlerta("Acceso denegado", "Credenciales inválidas o usuario inexistente.", false);
          return;
        }

        // VERIFICACIÓN DE ESTADO ACTIVO / INACTIVO
        if (datosUsuario.activo === false) {
          mostrarAlerta("Usuario Inactivo", "Tu usuario se encuentra inactivo. Contacta al administrador del sistema para restablecer tu acceso.", false);
          return;
        }

        // 2. Autenticar en Supabase usando el correo mapeado de la tabla y la contraseña
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
          email: datosUsuario.email,
          password: password
        });

        if (authError) {
          mostrarAlerta("Acceso denegado", "Credenciales inválidas o contraseña errónea.", false);
          return;
        }

        // 3. Validar si tiene al menos un permiso en TRUE
        const tienePermisos = (
          datosUsuario.ver_dashboard ||
          datosUsuario.ver_deposito ||
          datosUsuario.ver_distribucion ||
          datosUsuario.ver_distribucion_detalle ||
          datosUsuario.ver_entrega ||
          datosUsuario.ver_estado_rendicion ||
          datosUsuario.ver_clientes ||
          datosUsuario.ver_contratista ||
          datosUsuario.ver_chofer ||
          datosUsuario.ver_unidad ||
          datosUsuario.ver_usuarios
        );

        if (!tienePermisos) {
          await supabaseClient.auth.signOut();
          mostrarAlerta("Acceso denegado", "Tu usuario no tiene ningún permiso asignado en el sistema.", false);
          return;
        }

        // 4. Guardar sesión en localStorage
        const sesionData = {
          nombre: datosUsuario.nombre,
          rol: datosUsuario.rol,
          empresa_id: datosUsuario.empresa_id,
          permisos: {
            dashboard: datosUsuario.ver_dashboard,
            deposito: datosUsuario.ver_deposito,
            distribucion: datosUsuario.ver_distribucion,
            distribucion_detalle: datosUsuario.ver_distribucion_detalle,
            entrega: datosUsuario.ver_entrega,
            estado_rendicion: datosUsuario.ver_estado_rendicion,
            clientes: datosUsuario.ver_clientes,
            contratista: datosUsuario.ver_contratista,
            chofer: datosUsuario.ver_chofer,
            unidad: datosUsuario.ver_unidad,
            usuarios: datosUsuario.ver_usuarios
          },
          ultimoAcceso: Date.now()
        };
        localStorage.setItem("andelaz_sesion", JSON.stringify(sesionData));

        // 5. Redirección dinámica
        mostrarAlerta("¡Bienvenido!", "Sesión iniciada correctamente.", true, () => {
          const pantallasPermitidas = [
            { key: "ver_dashboard", url: "dashboard.html" },
            { key: "ver_deposito", url: "deposito.html" },
            { key: "ver_distribucion", url: "distribucion.html" },
            { key: "ver_distribucion_detalle", url: "distribucion_detalle.html" },
            { key: "ver_entrega", url: "reparto.html" },
            { key: "ver_estado_rendicion", url: "estado_rendicion.html" },
            { key: "ver_clientes", url: "clientes.html" },
            { key: "ver_contratista", url: "contratista.html" },
            { key: "ver_chofer", url: "chofer.html" },
            { key: "ver_unidad", url: "unidad.html" },
            { key: "ver_usuarios", url: "usuarios.html" }
          ];

          const destinoInicial = pantallasPermitidas.find(p => datosUsuario[p.key] === true);
          window.location.href = destinoInicial ? destinoInicial.url : "dashboard.html";
        });

      } catch (err) {
        mostrarAlerta("Error", "Ocurrió un error inesperado al iniciar sesión.", false);
      }
    });
  }
});