const express = require('express');
const https = require('https');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// OJO: Esta IP fija (192.168.0.10) está configurada temporalmente para pruebas locales en tu red. 
// Recuerda quitarla o dejarlo dinámico (por ejemplo, usando process.env) cuando lo subas a producción/host definitivo.
const IP_LOCAL_PRUEBAS = '192.168.0.10';

// Configuración de Supabase para el backend (Usando las credenciales provistas en el proyecto)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zmanwspxuqwviyzpxtan.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_geEnhhRNhJ8V7AuM_qSe6g_GEYvW_h_';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

app.use(cors({
  origin: '*', // Permitir conexiones desde Live Server (puerto 5502) y dispositivos de la red local
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para registrar en consola las peticiones de subida de fotos (útil para debuggear desde el celu)
app.use((req, res, next) => {
  if (req.url.includes('/api/subir-foto')) {
    console.log(`[PETICIÓN RECIBIDA] Método: ${req.method} | IP Cliente: ${req.ip} | Host: ${req.headers.host}`);
  }
  next();
});

app.use('/img', express.static(path.join(__dirname, 'img')));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// MÓDULO DE GESTIÓN DE ENTREGAS Y FOTOGRAFÍAS (Multer con memoria temporal)
// ==========================================
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/subir-foto', upload.single('foto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se envió ninguna imagen.' });
    }

    const empresaId = req.body.empresa_id;
    const skuPaquete = req.body.sku;

    if (!empresaId || !skuPaquete) {
      return res.status(400).json({ success: false, error: 'Faltan parámetros obligatorios: empresa_id o sku.' });
    }

    // 1. Consultar la tabla 'empresas' usando el empresa_id para obtener el nombre_empresa
    const { data: empresaData, error: empresaError } = await supabase
      .from('empresas')
      .select('nombre_empresa')
      .eq('id', empresaId)
      .single();

    if (empresaError || !empresaData) {
      console.error('Error al buscar la empresa en Supabase:', empresaError);
      return res.status(404).json({ success: false, error: 'No se encontró la empresa asociada al ID.' });
    }

    let nombreEmpresa = String(empresaData.nombre_empresa).trim();
    nombreEmpresa = nombreEmpresa.replace(/[^a-zA-Z0-9-_]/g, '_');

    let sku = String(skuPaquete).trim();
    sku = sku.replace(/[^a-zA-Z0-9-_]/g, '_');

    // 2. Construir la ruta física de las carpetas
    const dir = path.join(__dirname, 'img', 'documentacion', 'empresas', nombreEmpresa, 'entregas', sku);
    fs.mkdirSync(dir, { recursive: true });

    // 3. Guardar el archivo en disco usando el buffer de multer
    const ext = path.extname(req.file.originalname) || '.jpg';
    const nombreArchivo = `archivo_${Date.now()}${ext}`;
    const rutaCompleta = path.join(dir, nombreArchivo);

    fs.writeFileSync(rutaCompleta, req.file.buffer);

    const rutaRelativa = `img/documentacion/empresas/${nombreEmpresa}/entregas/${sku}/${nombreArchivo}`;

    res.json({ success: true, ruta: rutaRelativa });
  } catch (err) {
    console.error('Error interno al procesar la foto:', err);
    res.status(500).json({ success: false, error: 'Error al guardar la imagen en el host.' });
  }
});

// ==========================================
// MÓDULO DE GEOCODIFICACIÓN (Georef API)
// ==========================================
function consultarGeoref(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

function normalizarDireccionParaGeoref(direccionCruda) {
  if (!direccionCruda) return { calle: "", localidad: "" };
  
  let limpia = String(direccionCruda).trim();
  let partes = limpia.split(',').map(p => p.trim()).filter(p => p.length > 0);

  let calleYAltura = partes[0] || "";
  let localidad = partes[1] || "Buenos Aires";

  return { calle: calleYAltura, localidad: localidad };
}

app.get('/api/geocodificar', async (req, res) => {
  const direccion = req.query.direccion;
  if (!direccion) {
    return res.status(400).json({ success: false, error: 'Falta el parámetro dirección' });
  }

  const { calle, localidad } = normalizarDireccionParaGeoref(direccion);
  const url = `https://apis.datos.gob.ar/georef/api/direcciones?direccion=${encodeURIComponent(calle)}&departamento=${encodeURIComponent(localidad)}&max=1`;

  const resultado = await consultarGeoref(url);
  if (resultado && resultado.direcciones && resultado.direcciones.length > 0) {
    const ubicacion = resultado.direcciones[0].ubicacion;
    return res.json({ success: true, lat: ubicacion.lat, lng: ubicacion.lon });
  }

  res.status(404).json({ success: false, error: 'Dirección no encontrada' });
});

// ==========================================
// BLOQUES DE OTRAS PESTAÑAS Y FUNCIONES DEL SISTEMA
// ==========================================

app.get('/api/choferes', (req, res) => {
  res.json({ success: true, data: [] });
});

app.post('/api/choferes', (req, res) => {
  res.json({ success: true, message: 'Chofer registrado correctamente' });
});

app.get('/api/estadisticas', (req, res) => {
  res.json({ success: true, metricas: {} });
});

app.get('/api/configuracion', (req, res) => {
  res.json({ success: true, config: {} });
});

app.post('/api/configuracion', (req, res) => {
  res.json({ success: true, message: 'Configuración actualizada' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint no encontrado en el servidor' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor AndeLazRoute corriendo en http://${IP_LOCAL_PRUEBAS}:${PORT} (o http://localhost:${PORT})`);
});