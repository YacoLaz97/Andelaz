document.addEventListener("DOMContentLoaded", () => {
  const sesionGuardada = localStorage.getItem("andelaz_sesion");

  // 1. Si no hay sesión, mandar al index
  if (!sesionGuardada) {
    window.location.href = "index.html";
    return;
  }

  const sesion = JSON.parse(sesionGuardada);

  // 2. Control de tiempo de inactividad (Ejemplo: 1 hora = 3600000 ms)
  const tiempoLimite = 60 * 60 * 1000; 
  if (Date.now() - sesion.ultimoAcceso > tiempoLimite) {
    localStorage.removeItem("andelaz_sesion");
    alert("Tu sesión ha expirado por inactividad.");
    window.location.href = "index.html";
    return;
  }

  // Actualizar marca de tiempo de actividad por cada movimiento
  sesion.ultimoAcceso = Date.now();
  localStorage.setItem("andelaz_sesion", JSON.stringify(sesion));

  // 3. Mapeo de rutas con sus permisos correspondientes en el objeto
  const permisosMap = {
    "dashboard.html": sesion.permisos.dashboard,
    "deposito.html": sesion.permisos.deposito,
    "distribucion.html": sesion.permisos.distribucion,
    "distribucion_detalle.html": sesion.permisos.distribucion_detalle,
    "entrega.html": sesion.permisos.entrega,
    "clientes.html": sesion.permisos.clientes,
    "contratista.html": sesion.permisos.contratista,
    "chofer.html": sesion.permisos.chofer,
    "unidad.html": sesion.permisos.unidad,
    "usuarios.html": sesion.permisos.usuarios
  };

  // Obtener la página actual (ej: "deposito.html")
  const pathActual = window.location.pathname.split("/").pop();

  // 4. Bloqueo de seguridad si intenta acceder a una vista sin permiso
  if (permisosMap[pathActual] === false) {
    alert("No tienes permisos para acceder a esta sección.");
    window.location.href = "dashboard.html"; // Redirigir al inicio permitido
    return;
  }

  // 5. Ocultar dinámicamente los elementos del menú lateral según permisos
  const selectorMap = {
    "dashboard.html": 'a[href="dashboard.html"]',
    "deposito.html": 'a[href="deposito.html"]',
    "distribucion.html": 'a[href="distribucion.html"]',
    "distribucion_detalle.html": 'a[href="distribucion_detalle.html"]',
    "entrega.html": 'a[href="entrega.html"]',
    "clientes.html": 'a[href="clientes.html"]',
    "contratista.html": 'a[href="contratista.html"]',
    "chofer.html": 'a[href="chofer.html"]',
    "unidad.html": 'a[href="unidad.html"]',
    "usuarios.html": 'a[href="usuarios.html"]'
  };

  for (const [pagina, tienePermiso] of Object.entries(permisosMap)) {
    if (!tienePermiso) {
      const el = document.querySelector(selectorMap[pagina]);
      if (el) {
        // Si es un submenú (como choferes o unidades), ocultamos su contenedor o ítem
        el.style.display = "none";
      }
    }
  }

  // Ocultar títulos de sección (Operaciones / Altas) si todos sus hijos están ocultos
  // (Opcional pero mantiene prolijo el sidebar)
});

// Función optimizada para el botón de Cerrar Sesión en el Sidebar
async function cerrarSesionSistema() {
  try {
    // 1. Borrar la sesión almacenada en el navegador
    localStorage.removeItem("andelaz_sesion");

    // 2. Cerrar sesión en el cliente de Supabase Auth si está disponible
    if (window.supabaseClient) {
      await window.supabaseClient.auth.signOut();
    }
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  } finally {
    // 3. Forzar redirección limpia al index obligando a ingresar credenciales nuevamente
    window.location.replace("index.html");
  }
}