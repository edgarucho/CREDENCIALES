/**
 * CEDU-LA · Backend en Google Apps Script
 * Recibe la credencial ya armada desde cliente.html y la guarda en Drive.
 *
 * CÓMO INSTALARLO
 *  1. Ve a script.google.com y crea un proyecto nuevo.
 *  2. Borra todo y pega este archivo completo.
 *  3. Implementar → Nueva implementación → tipo "Aplicación web".
 *       Ejecutar como: Yo
 *       Quién tiene acceso: Cualquier usuario
 *  4. Copia la URL que termina en /exec.
 *  5. En admin.html → botón "Conexión" → pega esa URL → Guardar → Exportar plantillas.js.
 *
 * Cada vez que cambies este código tienes que volver a implementar
 * (Implementar → Administrar implementaciones → editar → Versión: Nueva).
 */

// Carpeta donde se guarda todo. Se crea sola la primera vez.
var CARPETA_RAIZ = 'CREDENCIALES';

// true  = agrupa dentro de CREDENCIALES por escuela y documento
// false = deja todos los archivos sueltos en CREDENCIALES
var AGRUPAR_POR_ESCUELA = true;

// Guarda también un registro en una hoja de cálculo dentro de la carpeta.
var LLEVAR_REGISTRO = true;

var ZONA = 'America/Mexico_City';


/* ============================ ENTRADA ============================ */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('Petición vacía');
    var d = JSON.parse(e.postData.contents);
    if (!d.imagenes || !d.imagenes.length) throw new Error('No llegó ninguna imagen');

    var folio = nuevoFolio_();
    var destino = carpetaDestino_(d);
    var base = limpiar_(d.archivo || 'CREDENCIAL');
    var archivos = [];

    for (var i = 0; i < d.imagenes.length; i++) {
      var im = d.imagenes[i];
      var ext = im.ext || 'jpg';
      var mime = im.mime || 'image/jpeg';
      var nombre = base + '_' + limpiar_(im.nombre || ('PARTE' + (i + 1))) + '_' + folio + '.' + ext;
      // Los bytes llegan ya marcados a 300 ppp y sRGB: se guardan tal cual.
      var blob = Utilities.newBlob(Utilities.base64Decode(im.datos), mime, nombre);
      var f = destino.createFile(blob);
      archivos.push({ nombre: f.getName(), url: f.getUrl(), id: f.getId() });
    }

    if (LLEVAR_REGISTRO) {
      try { registrar_(d, folio, archivos); } catch (err) { /* el registro no debe tumbar el guardado */ }
    }

    return json_({ ok: true, folio: folio, archivos: archivos, carpeta: destino.getUrl() });

  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  return json_({ ok: true, servicio: 'CEDU-LA', hora: new Date().toISOString() });
}


/* ============================ DRIVE ============================ */

function carpetaRaiz_() {
  return subcarpeta_(DriveApp.getRootFolder(), CARPETA_RAIZ);
}

function carpetaDestino_(d) {
  var c = carpetaRaiz_();
  if (!AGRUPAR_POR_ESCUELA) return c;
  c = subcarpeta_(c, limpiarNombreCarpeta_(d.corto || d.escuela || 'SIN ESCUELA'));
  c = subcarpeta_(c, limpiarNombreCarpeta_(d.documento || 'DOCUMENTO'));
  return c;
}

function subcarpeta_(padre, nombre) {
  var it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}


/* ============================ REGISTRO ============================ */

function registrar_(d, folio, archivos) {
  var raiz = carpetaRaiz_();
  var hoja = abrirHoja_(raiz);

  // Encabezados: los datos varían según la plantilla, así que se guardan en pares.
  var fila = [
    new Date(),
    folio,
    d.corto || d.escuela || '',
    d.clave || '',
    d.documento || '',
    d.titular || '',
    archivos.map(function (a) { return a.url; }).join('\n')
  ];

  (d.datos || []).forEach(function (x) {
    fila.push(x.etiqueta + ': ' + x.valor);
  });

  hoja.appendRow(fila);
}

function abrirHoja_(raiz) {
  var nombre = 'CREDENCIALES - REGISTRO';
  var it = raiz.getFilesByName(nombre);
  var ss;
  if (it.hasNext()) {
    ss = SpreadsheetApp.open(it.next());
  } else {
    ss = SpreadsheetApp.create(nombre);
    var arch = DriveApp.getFileById(ss.getId());
    raiz.addFile(arch);
    DriveApp.getRootFolder().removeFile(arch);
    ss.getActiveSheet().appendRow(
      ['FECHA', 'FOLIO', 'ESCUELA', 'CLAVE', 'DOCUMENTO', 'TITULAR', 'ARCHIVOS', 'DATOS...']);
    ss.getActiveSheet().setFrozenRows(1);
  }
  return ss.getActiveSheet();
}


/* ============================ APOYO ============================ */

function nuevoFolio_() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { /* sigue sin bloqueo */ }
  try {
    var props = PropertiesService.getScriptProperties();
    var hoy = Utilities.formatDate(new Date(), ZONA, 'yyMMdd');
    var n = 1;
    if (props.getProperty('dia') === hoy) n = parseInt(props.getProperty('cont') || '0', 10) + 1;
    props.setProperties({ dia: hoy, cont: String(n) });
    return hoy + '-' + ('000' + n).slice(-3);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function limpiar_(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')
    .toUpperCase().slice(0, 60) || 'CREDENCIAL';
}

function limpiarNombreCarpeta_(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 60) || 'SIN NOMBRE';
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ============================ PRUEBA ============================ */
/** Ejecuta esta función una vez desde el editor para autorizar los permisos. */
function probar() {
  var c = carpetaRaiz_();
  Logger.log('Carpeta lista: ' + c.getUrl());
}
