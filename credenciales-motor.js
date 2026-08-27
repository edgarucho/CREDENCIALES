/* CEDU-LA · Motor compartido (datos + dibujo + salida a 300 ppp sRGB). */
(function (global) {
  'use strict';

  var LLAVE = 'cedula_datos_v1';
  var PPP = 300;                 // resolución fija de salida
  var ICC_SRGB_B64 = 'AAACTGxjbXMEQAAAbW50clJHQiBYWVogB+oACAAKAAAAAAAPYWNzcEFQUEwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1sY21zAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALZGVzYwAAAQgAAAA2Y3BydAAAAUAAAABMd3RwdAAAAYwAAAAUY2hhZAAAAaAAAAAsclhZWgAAAcwAAAAUYlhZWgAAAeAAAAAUZ1hZWgAAAfQAAAAUclRSQwAAAggAAAAgZ1RSQwAAAggAAAAgYlRSQwAAAggAAAAgY2hybQAAAigAAAAkbWx1YwAAAAAAAAABAAAADGVuVVMAAAAaAAAAHABzAFIARwBCACAAYgB1AGkAbAB0AC0AaQBuAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAADAAAAAcAE4AbwAgAGMAbwBwAHkAcgBpAGcAaAB0ACwAIAB1AHMAZQAgAGYAcgBlAGUAbAB5WFlaIAAAAAAAAPbWAAEAAAAA0y1zZjMyAAAAAAABDEIAAAXe///zJQAAB5MAAP2Q///7of///aIAAAPcAADAblhZWiAAAAAAAABvoAAAOPUAAAOQWFlaIAAAAAAAACSfAAAPhAAAtsNYWVogAAAAAAAAYpcAALeHAAAY2XBhcmEAAAAAAAMAAAACZmYAAPKnAAANWQAAE9AAAApbY2hybQAAAAAAAwAAAACj1wAAVHsAAEzNAACZmgAAJmYAAA9c';  // perfil sRGB IEC61966-2.1 (compacto)

  /* ---------- almacenamiento (con respaldo en memoria) ---------- */
  var memoria = null;
  function leerLocal() {
    try { var s = localStorage.getItem(LLAVE); return s ? JSON.parse(s) : null; }
    catch (e) { return memoria; }
  }
  function escribirLocal(d) {
    try { localStorage.setItem(LLAVE, JSON.stringify(d)); return true; }
    catch (e) { return false; }
  }

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- sello de tiempo: quién es más nuevo ---------- */
  function sello(d) { return Number(d && d.generado) || 0; }

  /* Carga los diseños. REGLA: manda el archivo credenciales-plantillas.js.
     El borrador de este navegador SOLO se usa si es más nuevo que el archivo
     (es decir, si editaste y todavía no has publicado). En cuanto el archivo
     trae un sello igual o mayor, el borrador se borra solo.                  */
  function cargarDatos() {
    var base = global.PLANTILLAS_BASE ? clonar(global.PLANTILLAS_BASE)
                                      : { version: 2, generado: 0, servidor: '', escuelas: [] };
    var light = leerLocal();
    var selloBase  = sello(base);
    var selloLocal = sello(light);

    // Misma sesión: respeta lo que hay en memoria solo si no quedó atrás del archivo.
    if (memoria && memoria.escuelas && memoria.escuelas.length && sello(memoria) >= selloBase) return memoria;

    // Sin borrador local -> el archivo, tal cual.
    if (!light || !light.escuelas || !light.escuelas.length) return base;

    // Borrador viejo o del mismo momento -> se tira y gana el archivo.
    if (selloLocal <= selloBase) { borrarLocal(); return base; }

    // Borrador MÁS NUEVO (cambios sin publicar): se usa, rellenando las imágenes del archivo.
    var baseById = {}; base.escuelas.forEach(function (e) { baseById[e.id] = e; });
    var out = { version: light.version || base.version, generado: selloLocal,
                servidor: light.servidor || base.servidor, escuelas: [] };

    // Escuelas editadas (localStorage), rellenando las imágenes desde el archivo
    var lightIds = {};
    light.escuelas.forEach(function (e) {
      lightIds[e.id] = true;
      var be = baseById[e.id];
      var plts = (e.plantillas || []).map(function (p) {
        var q = {}; for (var k in p) q[k] = p[k];
        if (!q.imagen && be) {
          var bp = (be.plantillas || []).filter(function (x) { return x.id === p.id; })[0];
          if (bp) q.imagen = bp.imagen;
        }
        return q;
      });
      var e2 = {}; for (var k2 in e) if (k2 !== 'plantillas') e2[k2] = e[k2];
      e2.plantillas = plts;
      out.escuelas.push(e2);
    });
    // Escuelas NUEVAS que están en el archivo pero aún no en localStorage
    base.escuelas.forEach(function (e) { if (!lightIds[e.id]) out.escuelas.push(e); });
    return out;
  }

  /* Guardar el borrador local. Las imágenes pesan mucho y no caben todas,
     así que se quitan las que se pueden recuperar del archivo (mismo id).
     Las de plantillas NUEVAS sí se conservan: el archivo todavía no las tiene
     y si no, se perderían al recargar.                                       */
  function guardarDatos(d) {
    d.generado = Date.now();          // sello: este borrador es más nuevo que el archivo
    memoria = d;

    // Qué imágenes ya viven en el archivo (esas sí se pueden tirar del borrador)
    var enArchivo = {};
    var base = global.PLANTILLAS_BASE;
    if (base && base.escuelas) {
      base.escuelas.forEach(function (e) {
        (e.plantillas || []).forEach(function (p) { if (p.imagen) enArchivo[e.id + '|' + p.id] = true; });
      });
    }

    function aligerar(quitarImagenes) {
      return {
        version: d.version, generado: d.generado, servidor: d.servidor,
        escuelas: (d.escuelas || []).map(function (e) {
          var e2 = {}; for (var k in e) if (k !== 'plantillas') e2[k] = e[k];
          e2.plantillas = (e.plantillas || []).map(function (p) {
            var p2 = {}; for (var k2 in p) if (k2 !== 'imagen') p2[k2] = p[k2];
            // Se conserva solo si es nueva (el archivo no la tiene) y cabe.
            if (!quitarImagenes && p.imagen && !enArchivo[e.id + '|' + p.id]) p2.imagen = p.imagen;
            return p2;
          });
          return e2;
        })
      };
    }

    // Intento 1: con las imágenes nuevas. Si no cabe, intento 2: sin ninguna.
    if (escribirLocal(aligerar(false))) return true;
    return escribirLocal(aligerar(true));
  }
  function borrarLocal() { try { localStorage.removeItem(LLAVE); } catch (e) {} memoria = null; }

  function uid(pre) { return (pre || 'id') + '_' + Math.random().toString(36).slice(2, 8); }

  /* ---------- imágenes ---------- */
  var cache = {};
  function cargarImagen(src) {
    if (cache[src]) return Promise.resolve(cache[src]);
    return new Promise(function (ok, mal) {
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () { cache[src] = im; ok(im); };
      im.onerror = function () { mal(new Error('No se pudo cargar la imagen')); };
      im.src = src;
    });
  }

  // PLANTILLAS: se leen tal cual, sin recomprimir ni redimensionar.
  function leerPlantilla(file) {
    return new Promise(function (ok, mal) {
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          cache[fr.result] = im;
          ok({ src: fr.result, w: im.naturalWidth, h: im.naturalHeight, peso: file.size, tipo: file.type });
        };
        im.onerror = function () { mal(new Error('Archivo de imagen inválido')); };
        im.src = fr.result;
      };
      fr.onerror = function () { mal(new Error('No se pudo leer el archivo')); };
      fr.readAsDataURL(file);
    });
  }

  // FOTOS del cliente: sí se ajustan, para que el envío no pese de más.
  function archivoAImagen(file, maxLado, calidad) {
    maxLado = maxLado || 1600; calidad = calidad || 0.9;
    return new Promise(function (ok, mal) {
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var w = im.width, h = im.height, e = Math.min(1, maxLado / Math.max(w, h));
          if (e === 1) return ok({ src: fr.result, w: w, h: h });
          var c = document.createElement('canvas');
          c.width = Math.round(w * e); c.height = Math.round(h * e);
          var x = c.getContext('2d');
          x.imageSmoothingQuality = 'high';
          x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
          x.drawImage(im, 0, 0, c.width, c.height);
          ok({ src: c.toDataURL('image/jpeg', calidad), w: c.width, h: c.height });
        };
        im.onerror = function () { mal(new Error('Archivo de imagen inválido')); };
        im.src = fr.result;
      };
      fr.onerror = function () { mal(new Error('No se pudo leer el archivo')); };
      fr.readAsDataURL(file);
    });
  }

  /* ---------- texto ---------- */
  function encogerLinea(ctx, texto, ancho, px, fuente, peso) {
    var t = px;
    for (var i = 0; i < 40; i++) {
      ctx.font = peso + ' ' + t + 'px ' + fuente;
      if (ctx.measureText(texto).width <= ancho || t <= px * 0.45) break;
      t = t * 0.94;
    }
    return t;
  }

  function envolver(ctx, texto, ancho) {
    var palabras = String(texto).split(/\s+/), lineas = [], actual = '';
    for (var i = 0; i < palabras.length; i++) {
      var palabra = palabras[i];
      // Si una sola palabra no cabe en el ancho, se parte por letras
      if (ctx.measureText(palabra).width > ancho && palabra.length > 1) {
        if (actual) { lineas.push(actual); actual = ''; }
        var trozo = '';
        for (var k = 0; k < palabra.length; k++) {
          var pr = trozo + palabra[k];
          if (ctx.measureText(pr).width > ancho && trozo) { lineas.push(trozo); trozo = palabra[k]; }
          else trozo = pr;
        }
        actual = trozo;
        continue;
      }
      var prueba = actual ? actual + ' ' + palabra : palabra;
      if (ctx.measureText(prueba).width > ancho && actual) { lineas.push(actual); actual = palabra; }
      else actual = prueba;
    }
    if (actual) lineas.push(actual);
    return lineas;
  }

  // Ajusta el texto a la caja: envuelve y achica hasta que SIEMPRE quepa (ancho y alto).
  function ajustarTexto(ctx, texto, w, h, px, fuente, peso) {
    var t = px, lineas = [texto];
    for (var i = 0; i < 80; i++) {
      ctx.font = peso + ' ' + t + 'px ' + fuente;
      lineas = envolver(ctx, texto, w);
      var altoTotal = lineas.length * t * 1.18;
      var cabeAncho = true;
      for (var k = 0; k < lineas.length; k++) {
        if (ctx.measureText(lineas[k]).width > w) { cabeAncho = false; break; }
      }
      if ((altoTotal <= h && cabeAncho) || t <= 6) break;
      t = t * 0.94;
    }
    return { t: t, lineas: lineas };
  }

  /* ---------- brillo y contraste SIN depender de ctx.filter ----------

     ctx.filter no existe en Safari anterior a 2023 y en varios navegadores
     de teléfono: lo ignoran en silencio, sin marcar error. Por eso el
     brillo y el contraste "no servían".

     Aquí se ajustan los píxeles a mano. Funciona en todos lados y, de paso,
     garantiza que la vista previa se vea EXACTAMENTE igual que lo impreso.

     Se trabaja sobre un lienzo del tamaño del recuadro (unos cientos de
     píxeles), no sobre la foto original, así que es rápido.              */
  function ajustarPixeles(ctx, w, h, brillo, contraste) {
    var b = brillo / 100, k = contraste / 100;
    if (b === 1 && k === 1) return;
    var d, a;
    try { d = ctx.getImageData(0, 0, w, h); } catch (e) { return; }
    a = d.data;
    // Tabla de 256 valores: se calcula una vez en vez de por píxel
    var tabla = new Uint8ClampedArray(256);
    for (var v = 0; v < 256; v++) tabla[v] = ((v * b) - 127.5) * k + 127.5;
    for (var i = 0; i < a.length; i += 4) {
      a[i]     = tabla[a[i]];
      a[i + 1] = tabla[a[i + 1]];
      a[i + 2] = tabla[a[i + 2]];
    }
    ctx.putImageData(d, 0, 0);
  }

  /* Dibuja la foto (o la firma) dentro de un recuadro de w x h y devuelve
     un lienzo listo para pegar. Lo usan la credencial y la vista previa,
     así que las dos se ven idénticas.                                     */
  function fotoEnCaja(campo, valor, w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    var lienzo = document.createElement('canvas');
    lienzo.width = w; lienzo.height = h;
    var c = lienzo.getContext('2d');
    var im = cache[valor.src];
    if (!im) return lienzo;

    var br = (valor.brillo == null ? 100 : valor.brillo);
    var co = (valor.contraste == null ? 100 : valor.contraste);

    if (campo.tipo === 'firma') {
      // La firma entra completa, sin recortarse
      var e = Math.min(w / im.width, h / im.height);
      var dw = im.width * e, dh = im.height * e;
      c.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
      // Solo se ajusta lo dibujado; el resto queda transparente
      ajustarPixeles(c, w, h, br, co);
      return lienzo;
    }

    var z = valor.zoom || 1;
    var ang = (valor.rot || 0) * Math.PI / 180;
    var ca = Math.abs(Math.cos(ang)), sa = Math.abs(Math.sin(ang));
    var Wp = w * ca + h * sa, Hp = w * sa + h * ca;
    var rc = Math.max(Wp / w, Hp / h);
    var ec = Math.max(w / im.width, h / im.height) * z * rc;
    var dw2 = im.width * ec, dh2 = im.height * ec;
    var pos  = (valor.pos  == null ? 50 : valor.pos)  / 100;
    var posx = (valor.posx == null ? 50 : valor.posx) / 100;
    var panx = (dw2 - w) * (0.5 - posx);
    var pany = (dh2 - h) * (0.5 - pos);

    c.save();
    c.translate(w / 2, h / 2);
    if (ang) c.rotate(ang);
    c.drawImage(im, -dw2 / 2 + panx, -dh2 / 2 + pany, dw2, dh2);
    c.restore();
    ajustarPixeles(c, w, h, br, co);
    return lienzo;
  }

  /* ---------- limpiar la firma ----------

     La firma siempre queda NEGRA y SIN FONDO, venga de donde venga:

       · Con el dedo: ya viene el trazo oscuro sobre transparente.
         Se respeta tal cual, solo se asegura que la tinta sea negra.

       · Foto o PNG que suben: lo blanco se quita (como un chroma) y lo
         oscuro se queda. Así una firma en papel queda limpia, sin la hoja.

     No hay nada que ajustar a mano: se hace solo al subirla.            */
  function limpiarFirma(src) {
    return cargarImagen(src).then(function (im) {
      var w = im.width, h = im.height;
      if (!w || !h) return src;

      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var x = c.getContext('2d');
      x.drawImage(im, 0, 0);

      var d;
      try { d = x.getImageData(0, 0, w, h); } catch (e) { return src; }
      var a = d.data;

      // Tabla: qué tan "tinta" es cada nivel de gris.
      // Claro (papel) -> se va.  Oscuro (trazo) -> se queda.
      var CLARO = 205, OSCURO = 90;
      var tinta = new Uint8ClampedArray(256);
      for (var v = 0; v < 256; v++) {
        if (v >= CLARO) tinta[v] = 0;
        else if (v <= OSCURO) tinta[v] = 255;
        else tinta[v] = Math.round(255 * (CLARO - v) / (CLARO - OSCURO));
      }

      for (var i = 0; i < a.length; i += 4) {
        var lum = (a[i] * 299 + a[i + 1] * 587 + a[i + 2] * 114) / 1000;
        // Se respeta la transparencia que ya traía (el trazo del dedo)
        var alfa = a[i + 3] / 255 * tinta[lum | 0];
        a[i] = 0; a[i + 1] = 0; a[i + 2] = 0;   // tinta negra
        a[i + 3] = alfa;
      }
      x.putImageData(d, 0, 0);
      return c.toDataURL('image/png');
    }).catch(function () { return src; });
  }

  /* ---------- dibujo de un campo ---------- */
  function dibujarCampo(ctx, campo, valor, W, H) {
    if (campo.tipo === 'corte') return;
    var x = campo.x / 100 * W, y = campo.y / 100 * H;
    var w = campo.w / 100 * W, h = campo.h / 100 * H;

    if (campo.tipo === 'foto' || campo.tipo === 'firma') {
      if (!valor || !valor.src) return;
      if (!cache[valor.src]) return;
      // Se arma en un lienzo del tamaño del recuadro (con brillo y contraste
      // ya aplicados) y se pega. Igual que la vista previa.
      ctx.drawImage(fotoEnCaja(campo, valor, w, h), x, y, w, h);
      return;
    }

    var texto = (valor == null ? '' : String(valor)).trim();
    if (!texto) return;
    if (campo.mayus) texto = texto.toUpperCase();

    var px = campo.tam / 100 * H;
    var peso = campo.peso === 700 ? '700' : '400';
    var fuente = campo.fuente || 'Arial';
    ctx.save();
    ctx.fillStyle = campo.color || '#111111';
    ctx.textBaseline = 'middle';
    ctx.textAlign = campo.align || 'left';
    var ax = campo.align === 'center' ? x + w / 2 : (campo.align === 'right' ? x + w : x);

    // TEXTO y PÁRRAFO: ambos se ajustan a la caja (envuelven y se achican, nunca se salen)
    var r = ajustarTexto(ctx, texto, w, h, px, fuente, peso);
    var t = r.t, lineas = r.lineas;
    ctx.font = peso + ' ' + t + 'px ' + fuente;
    var alto = lineas.length * t * 1.18;
    var y0 = y + (h - alto) / 2 + t * 0.59;
    for (var j = 0; j < lineas.length; j++) ctx.fillText(lineas[j], ax, y0 + j * t * 1.18);
    ctx.restore();
  }

  /* ---------- dibujo completo ----------
     La plantilla se dibuja 1:1: un píxel del archivo original es un píxel de salida.
     opts: {recorte:{x,y,w,h} en %, escala (solo para vista previa en pantalla)}          */
  function dibujar(canvas, plantilla, valores, opts) {
    opts = opts || {};
    var W = plantilla.w, H = plantilla.h;
    var r = opts.recorte;
    var anchoSalida = r ? r.w / 100 * W : W;
    var altoSalida = r ? r.h / 100 * H : H;
    var esc = opts.escala || 1;

    canvas.width = Math.round(anchoSalida * esc);
    canvas.height = Math.round(altoSalida * esc);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(esc, 0, 0, esc, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, anchoSalida, altoSalida);
    if (r) ctx.translate(-r.x / 100 * W, -r.y / 100 * H);

    var fondo = cache[plantilla.imagen];
    if (fondo) ctx.drawImage(fondo, 0, 0, W, H);

    (plantilla.campos || []).forEach(function (c) {
      dibujarCampo(ctx, c, valores ? valores[c.id] : null, W, H);
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas;
  }

  function precargar(plantilla, valores) {
    var lista = [plantilla.imagen];
    (plantilla.campos || []).forEach(function (c) {
      var v = valores ? valores[c.id] : null;
      if (v && v.src) lista.push(v.src);
    });
    return Promise.all(lista.map(function (s) {
      return cargarImagen(s).catch(function () { return null; });
    }));
  }

  /* =================================================================
     SALIDA: 300 ppp + perfil sRGB incrustado
     El canvas no guarda resolución ni perfil de color, así que los
     marcadores se escriben a mano sobre los bytes del archivo.
     ================================================================= */

  function b64aBytes(b64) {
    var bin = atob(b64), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function bytesAB64(a) {
    var s = '', trozo = 0x8000;
    for (var i = 0; i < a.length; i += trozo) {
      s += String.fromCharCode.apply(null, a.subarray(i, i + trozo));
    }
    return btoa(s);
  }
  function unir(partes) {
    var n = 0, i;
    for (i = 0; i < partes.length; i++) n += partes[i].length;
    var out = new Uint8Array(n), o = 0;
    for (i = 0; i < partes.length; i++) { out.set(partes[i], o); o += partes[i].length; }
    return out;
  }

  var ICC = null;
  function icc() { if (!ICC) ICC = b64aBytes(ICC_SRGB_B64); return ICC; }

  /* --- JPEG: densidad en APP0 (JFIF) + perfil en APP2 (ICC_PROFILE) --- */
  function marcarJPEG(b) {
    if (b[0] !== 0xFF || b[1] !== 0xD8) return b;

    var pos = 2, finApp0 = 2, tieneApp0 = false;
    if (b[pos] === 0xFF && b[pos + 1] === 0xE0) {
      var largo = (b[pos + 2] << 8) | b[pos + 3];
      tieneApp0 = true;
      finApp0 = pos + 2 + largo;
      b[pos + 11] = 1;                    // unidades: pulgadas
      b[pos + 12] = (PPP >> 8) & 0xFF;    // densidad horizontal
      b[pos + 13] = PPP & 0xFF;
      b[pos + 14] = (PPP >> 8) & 0xFF;    // densidad vertical
      b[pos + 15] = PPP & 0xFF;
    }

    var partes = [];
    partes.push(b.subarray(0, 2));
    if (!tieneApp0) {
      partes.push(new Uint8Array([
        0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01,
        (PPP >> 8) & 0xFF, PPP & 0xFF, (PPP >> 8) & 0xFF, PPP & 0xFF, 0x00, 0x00
      ]));
    } else {
      partes.push(b.subarray(2, finApp0));
    }

    var p = icc();
    var largoSeg = 2 + 12 + 2 + p.length;
    var cab = new Uint8Array(4 + 12 + 2);
    cab[0] = 0xFF; cab[1] = 0xE2;
    cab[2] = (largoSeg >> 8) & 0xFF; cab[3] = largoSeg & 0xFF;
    var id = 'ICC_PROFILE\0';
    for (var i = 0; i < 12; i++) cab[4 + i] = id.charCodeAt(i);
    cab[16] = 1; cab[17] = 1;             // segmento 1 de 1
    partes.push(cab, p, b.subarray(finApp0));
    return unir(partes);
  }

  /* --- PNG: chunks pHYs (resolución) y sRGB (espacio de color) --- */
  var TABLA = null;
  function crc32(datos) {
    if (!TABLA) {
      TABLA = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        TABLA[n] = c >>> 0;
      }
    }
    var r = 0xFFFFFFFF;
    for (var i = 0; i < datos.length; i++) r = TABLA[(r ^ datos[i]) & 0xFF] ^ (r >>> 8);
    return (r ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(tipo, datos) {
    var cuerpo = new Uint8Array(4 + datos.length);
    for (var i = 0; i < 4; i++) cuerpo[i] = tipo.charCodeAt(i);
    cuerpo.set(datos, 4);
    var c = crc32(cuerpo);
    var out = new Uint8Array(8 + datos.length + 4), v = new DataView(out.buffer);
    v.setUint32(0, datos.length);
    out.set(cuerpo, 4);
    v.setUint32(8 + datos.length, c);
    return out;
  }
  function marcarPNG(b) {
    var finIHDR = 8 + 25;                 // firma + IHDR completo
    var ppm = Math.round(PPP / 0.0254);   // píxeles por metro
    var d = new Uint8Array(9), v = new DataView(d.buffer);
    v.setUint32(0, ppm); v.setUint32(4, ppm); d[8] = 1;
    return unir([
      b.subarray(0, finIHDR),
      chunk('pHYs', d),
      chunk('sRGB', new Uint8Array([0])), // intento perceptual
      b.subarray(finIHDR)
    ]);
  }

  /**
   * Convierte el canvas en archivo listo para imprenta.
   * formato: 'jpeg' (predeterminado) o 'png' (sin pérdida, mucho más pesado).
   * Devuelve { base64, mime, ext, bytes, ppp }.
   */
  function exportar(canvas, formato, calidad) {
    formato = (formato === 'png') ? 'png' : 'jpeg';
    var mime = formato === 'png' ? 'image/png' : 'image/jpeg';
    var url = canvas.toDataURL(mime, formato === 'png' ? undefined : (calidad || 0.95));
    var b = b64aBytes(url.split(',')[1]);
    b = formato === 'png' ? marcarPNG(b) : marcarJPEG(b);
    return { base64: bytesAB64(b), mime: mime, ext: formato === 'png' ? 'png' : 'jpg', bytes: b, ppp: PPP };
  }

  /* ---------- exportar / descargar ---------- */
  function descargar(nombre, url) {
    var a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); }, 300);
  }

  /* Texto completo del archivo credenciales-plantillas.js (se usa para
     descargarlo y para publicarlo en GitHub: exactamente el mismo contenido). */
  function textoJS(datos) {
    if (!datos.generado) datos.generado = Date.now();
    return '/* CEDU-LA \u00b7 Base de plantillas generada el ' +
      new Date(datos.generado).toLocaleString('es-MX') + ' */\n' +
      'window.PLANTILLAS_BASE = ' + JSON.stringify(datos) + ';\n';
  }

  function exportarJS(datos) {
    var blob = new Blob([textoJS(datos)], { type: 'text/javascript;charset=utf-8' });
    descargar('credenciales-plantillas.js', URL.createObjectURL(blob));
  }

  /* Trae credenciales-plantillas.js del servidor SALTÁNDOSE la caché.
     Sin esto el navegador reusa la copia vieja y los cambios "no se ven". */
  function cargarArchivo(url) {
    url = url || 'credenciales-plantillas.js';
    return new Promise(function (listo) {
      var s = document.createElement('script');
      s.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'v=' + Date.now();
      s.onload  = function () { listo(global.PLANTILLAS_BASE || null); };
      s.onerror = function () { listo(null); };   // sin internet: sigue con lo que haya
      document.head.appendChild(s);
    });
  }

  function limpiarNombre(s) {
    return String(s || 'credencial').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase().slice(0, 40) || 'CREDENCIAL';
  }

  // Medidas físicas de una plantilla a 300 ppp
  function medidas(w, h) {
    return {
      pulg: [w / PPP, h / PPP],
      cm: [w / PPP * 2.54, h / PPP * 2.54],
      texto: (w / PPP * 2.54).toFixed(1) + ' × ' + (h / PPP * 2.54).toFixed(1) + ' cm'
    };
  }

  // Dibuja UNA sola foto (con encuadre, giro, brillo y contraste) en un canvas de vista previa.
  // Respeta la proporción de la caja del campo, para que se vea EXACTO como quedará.
  /* Vista previa del recuadro tal como va a quedar impreso.

     ANTES: la proporción se sacaba de campo.h / campo.w, que son PORCENTAJES
     de la plantilla. Como la plantilla no es cuadrada (1800x1200), eso daba
     un rectángulo alargado aunque el recuadro real fuera casi cuadrado.
     Por eso "no respetaba el tamaño de la fotografía".

     AHORA: se multiplica por el tamaño real de la plantilla.
     El cuarto parámetro puede ser el ancho en px (número) o un objeto
     { ancho: 300, plantilla: p } para dar la proporción correcta.       */
  function dibujarFotoPreview(canvas, campo, valor, opciones) {
    var anchoPx = null, plt = null;
    if (opciones && typeof opciones === 'object') { anchoPx = opciones.ancho; plt = opciones.plantilla; }
    else anchoPx = opciones;

    // Proporción real del recuadro dentro de la plantilla
    var pw = (plt && plt.w) ? plt.w : 1, ph = (plt && plt.h) ? plt.h : 1;
    var rel = (campo.h * ph) / (campo.w * pw);
    if (!isFinite(rel) || rel <= 0) rel = 1;

    var ancho = anchoPx || 260;
    var alto = Math.round(ancho * rel);
    canvas.width = ancho; canvas.height = alto;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, ancho, alto);
    // Fondo cuadriculado suave para ver los bordes
    ctx.fillStyle = '#f0ece4'; ctx.fillRect(0, 0, ancho, alto);
    if (!valor || !valor.src) { return; }
    if (!cache[valor.src]) { return; }
    // Exactamente el mismo dibujo que va a la credencial, solo que más chico
    ctx.drawImage(fotoEnCaja(campo, valor, ancho, alto), 0, 0);
  }

  /* Cuánto sobra de foto en cada lado, como FRACCIÓN del recuadro.
     Sirve para arrastrar: no depende del tamaño en que se esté viendo,
     así que la misma cuenta vale en la miniatura y en la credencial. */
  function holguraRel(campo, valor, plt) {
    var vacio = { x: 0, y: 0 };
    if (!valor || !valor.src) return vacio;
    var im = cache[valor.src];
    if (!im) return vacio;

    var pw = (plt && plt.w) ? plt.w : 1800, ph = (plt && plt.h) ? plt.h : 1200;
    var w = campo.w / 100 * pw, h = campo.h / 100 * ph;
    if (!w || !h) return vacio;

    var z = valor.zoom || 1;
    var ang = (valor.rot || 0) * Math.PI / 180;
    var ca = Math.abs(Math.cos(ang)), sa = Math.abs(Math.sin(ang));
    var Wp = w * ca + h * sa, Hp = w * sa + h * ca;
    var rc = Math.max(Wp / w, Hp / h);
    var ec = Math.max(w / im.width, h / im.height) * z * rc;

    return {
      x: Math.max(0, (im.width  * ec - w) / w),
      y: Math.max(0, (im.height * ec - h) / h)
    };
  }

  /* Mueve la foto dentro de su recuadro.
     dxFrac / dyFrac = cuánto se arrastró, como fracción del recuadro.
     Devuelve true si algo se movió.                                   */
  function arrastrarFoto(campo, valor, plt, dxFrac, dyFrac) {
    var g = holguraRel(campo, valor, plt);
    var movio = false;
    function tope(v) { return v < 0 ? 0 : (v > 100 ? 100 : v); }

    if (g.x > 0.002) {
      var px = (valor.posx == null ? 50 : valor.posx);
      // Arrastrar a la derecha debe mover la FOTO a la derecha, por eso el menos
      var nx = tope(px - 100 * dxFrac / g.x);
      if (nx !== px) { valor.posx = nx; movio = true; }
    }
    if (g.y > 0.002) {
      var py = (valor.pos == null ? 50 : valor.pos);
      var ny = tope(py - 100 * dyFrac / g.y);
      if (ny !== py) { valor.pos = ny; movio = true; }
    }
    return movio;
  }

  /* Cuál campo de foto cae bajo un punto del lienzo de la credencial.
     px / py van en porcentaje de la plantilla (0 a 100).              */
  function campoEnPunto(plt, px, py, valores) {
    if (!plt || !plt.campos) return null;
    var hallado = null;
    plt.campos.forEach(function (c) {
      if (c.tipo !== 'foto' && c.tipo !== 'firma') return;
      if (valores && !(valores[c.id] && valores[c.id].src)) return;   // sin foto, no se arrastra
      if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) hallado = c;
    });
    return hallado;   // el último gana: los de encima mandan
  }

  /* Cuánto se puede mover la foto en cada eje, en píxeles del recuadro.
     Si da 0, ese deslizador no tiene nada que mover: hay que acercar
     la foto primero. Se usa para no dejar controles muertos. */
  function holguraFoto(campo, valor, plt) {
    var vacio = { x: 0, y: 0 };
    if (!valor || !valor.src) return vacio;
    var im = cache[valor.src];
    if (!im) return vacio;

    var pw = (plt && plt.w) ? plt.w : 1800, ph = (plt && plt.h) ? plt.h : 1200;
    var w = campo.w / 100 * pw, h = campo.h / 100 * ph;

    var z = valor.zoom || 1;
    var ang = (valor.rot || 0) * Math.PI / 180;
    var ca = Math.abs(Math.cos(ang)), sa = Math.abs(Math.sin(ang));
    var Wp = w * ca + h * sa, Hp = w * sa + h * ca;
    var rc = Math.max(Wp / w, Hp / h);
    var ec = Math.max(w / im.width, h / im.height) * z * rc;

    return {
      x: Math.max(0, im.width  * ec - w),
      y: Math.max(0, im.height * ec - h)
    };
  }

  global.CEDULA = {
    PPP: PPP, holguraFoto: holguraFoto, limpiarFirma: limpiarFirma,
    holguraRel: holguraRel, arrastrarFoto: arrastrarFoto, campoEnPunto: campoEnPunto,
    cargarDatos: cargarDatos, guardarDatos: guardarDatos, borrarLocal: borrarLocal,
    clonar: clonar, uid: uid, cargarImagen: cargarImagen,
    leerPlantilla: leerPlantilla, archivoAImagen: archivoAImagen,
    dibujar: dibujar, precargar: precargar, exportar: exportar,
    dibujarFotoPreview: dibujarFotoPreview,
    descargar: descargar, exportarJS: exportarJS,
    textoJS: textoJS, cargarArchivo: cargarArchivo, sello: sello,
    limpiarNombre: limpiarNombre, medidas: medidas, cache: cache
  };
})(window);
