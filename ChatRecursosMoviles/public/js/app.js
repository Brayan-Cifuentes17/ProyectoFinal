// ── SERVICE WORKER ──────────────────────────────────────────────────────────
var swReg;
if (navigator.serviceWorker) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      swReg = reg;
    });
  });
}

// ── ESTADO GLOBAL ────────────────────────────────────────────────────────────
var usuario    = null;   // { nombre, carrera, avatar }
var filtroActivo = 'todos';
var apuntesCache = [];   // copia local de lo que viene del servidor

// Recursos adjuntos pendientes (Persona 2 los llena desde afuera)
var adjuntos = { foto: null, audio: null, video: null, lat: null, lng: null };

// Camara (Persona 2 usa esto)
var camara = null;
if (typeof Camara !== 'undefined') {
  camara = new Camara(document.getElementById('player'));
}

// ── REFS DOM ──────────────────────────────────────────────────────────────────
var $seleccion     = $('#seleccion');
var $app           = $('#app');
var $inputNombre   = $('#inputNombre');
var $inputCarrera  = $('#inputCarrera');
var $btnEntrar     = $('#btnEntrar');
var $btnSalir      = $('#btnSalir');
var $btnDarkMode   = $('#btnDarkMode');
var $profileDot    = $('#profileDot');
var $profileNombre = $('#profileNombre');
var $inputBuscar   = $('#inputBuscar');
var $filtrosRow    = $('#filtrosRow');
var $timeline      = $('#timeline');
var $btnNuevo      = $('#btnNuevo');

// Modal
var $modal         = $('#modal');
var $btnCancelar   = $('#btnCancelar');
var $btnGuardar    = $('#btnGuardar');
var $inputTitulo   = $('#inputTitulo');
var $inputMateria  = $('#inputMateria');
var $txtContenido  = $('#txtContenido');
var $inputTags     = $('#inputTags');
var $inputFecha    = $('#inputFecha');
var $grupoFecha    = $('#grupoFecha');
var $tipoBtns      = $('.tipo-btn');
var $recursosPreview = $('#recursosPreview');
var $camaraContenedor = $('#camaraContenedor');
var $materiasList  = $('#materiasList');

// Recursos nativos (Persona 2)
var $btnUbicacion  = $('#btnUbicacion');
var $btnFoto       = $('#btnFoto');
var $btnAudio      = $('#btnAudio');
var $btnVideo      = $('#btnVideo');
var $btnTomarFoto  = $('#btnTomarFoto');
var $btnGrabarVideo   = $('#btnGrabarVideo');
var $btnDetenerVideo  = $('#btnDetenerVideo');

// ── HELPERS ───────────────────────────────────────────────────────────────────

function iniciales(nombre) {
  return nombre.trim().split(' ')
    .slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

function formatearFecha(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function diasRestantes(isoFecha) {
  if (!isoFecha) return null;
  var hoy  = new Date(); hoy.setHours(0,0,0,0);
  var meta = new Date(isoFecha); meta.setHours(0,0,0,0);
  return Math.round((meta - hoy) / 86400000);
}

function deadlineChip(isoFecha) {
  var dias = diasRestantes(isoFecha);
  if (dias === null) return '';
  if (dias < 0)  return '<span class="deadline deadline-alert">Vencido</span>';
  if (dias === 0) return '<span class="deadline deadline-alert">¡Hoy!</span>';
  if (dias <= 3) return '<span class="deadline deadline-alert">⏰ Faltan ' + dias + ' día' + (dias===1?'':'s') + '</span>';
  if (dias <= 7) return '<span class="deadline deadline-warn">⏰ Faltan ' + dias + ' días</span>';
  return '<span class="deadline deadline-ok">📅 ' + formatearFecha(isoFecha) + '</span>';
}

function agruparPorDia(apuntes) {
  var grupos = {};
  apuntes.forEach(function(a) {
    var key = new Date(a.fechaCreacion).toDateString();
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(a);
  });
  return grupos;
}

function labelDia(dateString) {
  var d    = new Date(dateString);
  var hoy  = new Date(); hoy.setHours(0,0,0,0);
  var ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  d.setHours(0,0,0,0);
  if (d.getTime() === hoy.getTime())  return 'Hoy';
  if (d.getTime() === ayer.getTime()) return 'Ayer';
  return d.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' });
}

function toast(msg, tipo) {
  $.mdtoast(msg, {
    interaction: true,
    interactionTimeout: 2500,
    actionText: 'OK',
    type: tipo || 'default'
  });
}

// ── PERFIL ────────────────────────────────────────────────────────────────────

// Habilitar botón Entrar solo si nombre + avatar seleccionado
function validarPerfil() {
  var nombre = $inputNombre.val().trim();
  var avatar = $('.avatar-opt.seleccionado').data('avatar');
  $btnEntrar.prop('disabled', !(nombre && avatar));
}

$inputNombre.on('input', validarPerfil);
$inputCarrera.on('input', validarPerfil);

$('.avatar-opt').on('click', function () {
  $('.avatar-opt').removeClass('seleccionado');
  $(this).addClass('seleccionado');
  validarPerfil();
});

$btnEntrar.on('click', function () {
  var nombre = $inputNombre.val().trim();
  var carrera = $inputCarrera.val().trim();
  var avatar  = $('.avatar-opt.seleccionado').data('avatar');
  if (!nombre || !avatar) return;

  usuario = { nombre: nombre, carrera: carrera, avatar: avatar };

  // Guardar en localStorage para no pedir de nuevo
  localStorage.setItem('ss_usuario', JSON.stringify(usuario));

  loginUI(true);
  getMensajes();
});

// Restaurar sesión si existe
function restaurarSesion() {
  try {
    var guardado = localStorage.getItem('ss_usuario');
    if (guardado) {
      usuario = JSON.parse(guardado);
      loginUI(true);
      getMensajes();
      return true;
    }
  } catch(e) {}
  return false;
}

function loginUI(entrando) {
  if (entrando) {
    $seleccion.addClass('oculto');
    $app.removeClass('oculto');
    $profileDot.text(iniciales(usuario.nombre));
    $profileNombre.text(usuario.nombre.split(' ')[0]);
  } else {
    $seleccion.removeClass('oculto').addClass('animated fadeIn fast');
    $app.addClass('oculto');
    apuntesCache = [];
    $timeline.empty();
    usuario = null;
  }
}

$btnSalir.on('click', function () {
  localStorage.removeItem('ss_usuario');
  loginUI(false);
});

// ── MODO OSCURO ───────────────────────────────────────────────────────────────

var darkMode = localStorage.getItem('ss_dark') === '1';

function aplicarDark() {
  if (darkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
    $btnDarkMode.html('<i class="fa fa-sun"></i>');
  } else {
    document.documentElement.removeAttribute('data-theme');
    $btnDarkMode.html('<i class="fa fa-moon"></i>');
  }
}

$btnDarkMode.on('click', function () {
  darkMode = !darkMode;
  localStorage.setItem('ss_dark', darkMode ? '1' : '0');
  aplicarDark();
});

aplicarDark();

// ── CREAR TARJETA HTML ────────────────────────────────────────────────────────

function crearApunteHTML(apunte) {
  var tipoBadge = apunte.tipo === 'evento'
    ? '<span class="badge badge-evento">Evento</span>'
    : '<span class="badge badge-apunte">Apunte</span>';

  var tags = (apunte.tags || []).map(function(t) {
    return '<span class="tag">' + t + '</span>';
  }).join('');

  var footer = '';
  if (apunte.tipo === 'evento' && apunte.fechaEntrega) {
    footer = deadlineChip(apunte.fechaEntrega);
  } else {
    footer = '<span class="card-date">' + formatearFecha(apunte.fechaCreacion) + '</span>';
  }

  // Adjuntos opcionales
  var adjuntosHTML = '';
  if (apunte.foto) {
    adjuntosHTML += '<img class="card-foto" src="' + apunte.foto + '" alt="Foto adjunta">';
  }
  if (apunte.audio) {
    adjuntosHTML += '<audio class="card-audio" controls src="' + apunte.audio + '"></audio>';
  }
  if (apunte.video) {
    adjuntosHTML += '<video class="card-video" controls src="' + apunte.video + '"></video>';
  }
  if (apunte.lat && apunte.lng) {
    adjuntosHTML += '<iframe class="card-mapa" height="180"' +
      ' src="https://www.google.com/maps/embed/v1/view?key=AIzaSyA5mjCwx1TRLuBAjwQw84WE6h5ErSe7Uj8' +
      '&center=' + apunte.lat + ',' + apunte.lng + '&zoom=16"' +
      ' allowfullscreen loading="lazy"></iframe>';
  }

  var html = '<li class="apunte-card animated fadeIn fast" data-id="' + apunte._id + '">' +
    '<div class="card-header">' +
      '<div class="card-meta">' +
        '<span class="badge badge-materia">' + apunte.materia + '</span>' +
        tipoBadge +
      '</div>' +
      '<div class="card-title">' + apunte.titulo + '</div>' +
    '</div>';

  if (apunte.contenido || adjuntosHTML) {
    html += '<div class="card-body">';
    if (apunte.contenido) {
      html += '<div class="card-content">' + apunte.contenido + '</div>';
    }
    if (adjuntosHTML) html += adjuntosHTML;
    html += '</div>';
  }

  html += '<div class="card-footer">' +
    '<div class="card-tags">' + tags + '</div>' +
    footer +
  '</div></li>';

  return html;
}

// ── RENDERIZAR TIMELINE

function renderTimeline(apuntes) {
  $timeline.empty();

  if (!apuntes.length) {
    $timeline.html(
      '<div class="empty-state">' +
        '<i class="fa fa-book-open"></i>' +
        '<p>No hay apuntes aquí todavía.<br>¡Crea el primero!</p>' +
      '</div>'
    );
    return;
  }

  var grupos = agruparPorDia(apuntes);

  Object.keys(grupos).forEach(function(key) {
    $timeline.append('<li class="section-day">' + labelDia(key) + '</li>');
    grupos[key].forEach(function(a) {
      $timeline.append(crearApunteHTML(a));
    });
  });
}

// ── GET APUNTES ────────────────────────────────────────────────────────────────

function getMensajes() {
  fetch('api')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      apuntesCache = data;
      actualizarMaterias(data);
      renderTimeline(data);
    })
    .catch(function() {
      toast('Sin conexión — mostrando datos en caché', 'warning');
    });
}

// ── FILTROS Y BÚSQUEDA ─────────────────────────────────────────────────────────

function actualizarMaterias(apuntes) {
  var materias = [...new Set(apuntes.map(function(a) { return a.materia; }))];

  // Actualizar datalist del modal
  $materiasList.empty();
  materias.forEach(function(m) {
    $materiasList.append('<option value="' + m + '">');
  });

  // Agregar chips de materias al filtro (quitar los viejos primero)
  $filtrosRow.find('.chip-materia').remove();
  materias.forEach(function(m) {
    $filtrosRow.append(
      '<button class="chip chip-materia" data-filter="materia:' + m + '">' + m + '</button>'
    );
  });
}

// Click en chips de filtro
$filtrosRow.on('click', '.chip', function () {
  $('.chip').removeClass('active');
  $(this).addClass('active');
  filtroActivo = $(this).data('filter');
  aplicarFiltros();
});

// Búsqueda en tiempo real
var buscarTimer;
$inputBuscar.on('input', function () {
  clearTimeout(buscarTimer);
  buscarTimer = setTimeout(aplicarFiltros, 280);
});

function aplicarFiltros() {
  var q    = $inputBuscar.val().trim().toLowerCase();
  var tipo = filtroActivo;

  var resultado = apuntesCache.filter(function(a) {
    // Filtro por tipo
    if (tipo === 'apunte' && a.tipo !== 'apunte') return false;
    if (tipo === 'evento' && a.tipo !== 'evento') return false;
    if (tipo.startsWith('materia:')) {
      var m = tipo.replace('materia:', '');
      if (a.materia !== m) return false;
    }

    // Búsqueda por texto
    if (q) {
      var enTitulo   = a.titulo.toLowerCase().includes(q);
      var enContenido = (a.contenido || '').toLowerCase().includes(q);
      var enMateria  = a.materia.toLowerCase().includes(q);
      var enTags     = (a.tags || []).some(function(t) { return t.toLowerCase().includes(q); });
      if (!enTitulo && !enContenido && !enMateria && !enTags) return false;
    }

    return true;
  });

  renderTimeline(resultado);
}

// ── MODAL 
var tipoSeleccionado = 'apunte';

$btnNuevo.on('click', function () {
  resetModal();
  $modal.removeClass('oculto');
});

$btnCancelar.on('click', cerrarModal);

$modal.on('click', function (e) {
  if ($(e.target).is($modal)) cerrarModal();
});

function cerrarModal() {
  $modal.addClass('oculto');
  resetModal();
}

function resetModal() {
  $inputTitulo.val('');
  $inputMateria.val('');
  $txtContenido.val('');
  $inputTags.val('');
  $inputFecha.val('');
  $grupoFecha.hide();
  $camaraContenedor.addClass('oculto');
  $recursosPreview.empty();
  adjuntos = { foto: null, audio: null, video: null, lat: null, lng: null };
  $tipoBtns.removeClass('active');
  $tipoBtns.filter('[data-tipo="apunte"]').addClass('active');
  tipoSeleccionado = 'apunte';
  $('.recurso-btn').removeClass('activo');
  if (camara) camara.apagar();
}

// Toggle tipo apunte/evento
$tipoBtns.on('click', function () {
  $tipoBtns.removeClass('active');
  $(this).addClass('active');
  tipoSeleccionado = $(this).data('tipo');
  if (tipoSeleccionado === 'evento') {
    $grupoFecha.show();
  } else {
    $grupoFecha.hide();
  }
});

// ── GUARDAR APUNTE 

$btnGuardar.on('click', function () {
  var titulo  = $inputTitulo.val().trim();
  var materia = $inputMateria.val().trim();

  if (!titulo) {
    toast('El título es obligatorio', 'warning');
    $inputTitulo.focus();
    return;
  }
  if (!materia) {
    toast('La materia es obligatoria', 'warning');
    $inputMateria.focus();
    return;
  }

  var tagsRaw = $inputTags.val().trim();
  var tags = tagsRaw
    ? tagsRaw.split(/\s+/).map(function(t) {
        return t.startsWith('#') ? t : '#' + t;
      })
    : [];

  var data = {
    tipo:         tipoSeleccionado,
    titulo:       titulo,
    contenido:    $txtContenido.val().trim(),
    materia:      materia,
    tags:         tags,
    fechaEntrega: tipoSeleccionado === 'evento' ? ($inputFecha.val() || null) : null,
    foto:         adjuntos.foto,
    audio:        adjuntos.audio,
    video:        adjuntos.video,
    lat:          adjuntos.lat,
    lng:          adjuntos.lng,
    user:         usuario.nombre
  };

  fetch('api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(function(res) { return res.json(); })
  .then(function(res) {
    if (res.ok) {
      apuntesCache.unshift(res.apunte);
      actualizarMaterias(apuntesCache);
      aplicarFiltros();
      cerrarModal();
      toast('Apunte guardado ✓', 'success');
    }
  })
  .catch(function() {
    // Sin conexión: Persona 3 (SW + PouchDB) maneja esto
    toast('Guardado sin conexión — se sincronizará después', 'warning');
    cerrarModal();
  });
});

// ── RECURSOS NATIVOS (hooks para Persona 2) 
// Persona 2 puede reemplazar estos handlers o llamar las funciones directamente.

// Foto
$btnFoto.on('click', function () {
  $camaraContenedor.toggleClass('oculto');
  if (!$camaraContenedor.hasClass('oculto') && camara) {
    camara.encender();
  }
});

$btnTomarFoto.on('click', function () {
  if (!camara) return;
  adjuntos.foto = camara.tomarFoto();
  camara.apagar();
  $camaraContenedor.addClass('oculto');
  $recursosPreview.prepend('<img src="' + adjuntos.foto + '" style="border-radius:10px;margin-bottom:6px">');
  $btnFoto.addClass('activo');
});

// Video
$btnGrabarVideo.on('click', function () {
  if (!camara) return;
  try {
    camara.iniciarGrabacion();
    $btnGrabarVideo.addClass('oculto');
    $btnDetenerVideo.removeClass('oculto');
    toast('Grabando video…');
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
});

$btnDetenerVideo.on('click', function () {
  $btnDetenerVideo.addClass('oculto');
  $btnGrabarVideo.removeClass('oculto');
  camara.detenerGrabacion().then(function(videoB64) {
    adjuntos.video = videoB64;
    camara.apagar();
    $camaraContenedor.addClass('oculto');
    $recursosPreview.prepend(
      '<video controls style="width:100%;border-radius:10px;margin-bottom:6px" src="' + videoB64 + '"></video>'
    );
    $btnVideo.addClass('activo');
    toast('Video capturado ✓', 'success');
  });
});

// Botón video abre cámara
$btnVideo.on('click', function () {
  $camaraContenedor.toggleClass('oculto');
  if (!$camaraContenedor.hasClass('oculto') && camara) {
    camara.encender();
  }
});

// Geolocalización
$btnUbicacion.on('click', function () {
  if (!navigator.geolocation) {
    toast('Tu navegador no soporta geolocalización', 'warning');
    return;
  }
  toast('Obteniendo ubicación…');
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      adjuntos.lat = pos.coords.latitude;
      adjuntos.lng = pos.coords.longitude;
      $btnUbicacion.addClass('activo');
      toast('Ubicación adjuntada ✓', 'success');
    },
    function() { toast('No se pudo obtener la ubicación', 'warning'); },
    { timeout: 10000, enableHighAccuracy: true }
  );
});

// Audio — Persona 2 implementa esto con MediaRecorder
$btnAudio.on('click', function () {
  toast('Función de audio — implementada por Persona 2', 'info');
});

// ── ONLINE / OFFLINE

function estadoConexion() {
  if (navigator.onLine) {
    toast('Conectado ✓', 'success');
  } else {
    toast('Sin conexión — modo offline', 'warning');
  }
}

window.addEventListener('online',  estadoConexion);
window.addEventListener('offline', estadoConexion);
// ── EXPORTAR PDF ──────────────────────────────────────────────────────────────

$('#btnExportar').on('click', function () {
  if (!apuntesCache.length) {
    toast('No hay apuntes para exportar', 'warning');
    return;
  }

  toast('Generando PDF…');

  var { jsPDF } = window.jspdf;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  var margenIzq  = 15;
  var margenDer  = 15;
  var anchoUtil  = 210 - margenIzq - margenDer;
  var y          = 20;
  var pageHeight = 297;
  var lineH      = 6;

  // Colores
  var colorAccent  = [83, 74, 183];   // #534AB7
  var colorTitulo  = [44, 44, 42];    // #2C2C2A
  var colorMuted   = [95, 94, 90];    // #5F5E5A
  var colorHint    = [136, 135, 128]; // #888780
  var colorEvento  = [80, 19, 19];    // #501313
  var colorApunte  = [8, 80, 65];     // #085041

  function saltoSiNecesario(alto) {
    if (y + alto > pageHeight - 15) {
      doc.addPage();
      y = 20;
    }
  }

  function linea(color) {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.3);
    doc.line(margenIzq, y, 210 - margenDer, y);
    y += 4;
  }

  function textoMultilinea(texto, x, fontSize, color, maxWidth) {
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    var lineas = doc.splitTextToSize(texto, maxWidth);
    saltoSiNecesario(lineas.length * lineH + 4);
    doc.text(lineas, x, y);
    y += lineas.length * lineH;
  }

  // ── PORTADA ──
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setFontSize(32);
  doc.setTextColor(232, 228, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('StudySync', 105, 110, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(127, 119, 221);
  doc.setFont('helvetica', 'normal');
  doc.text('Mis apuntes académicos', 105, 122, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(136, 135, 128);
  doc.text(usuario.nombre, 105, 138, { align: 'center' });
  if (usuario.carrera) {
    doc.text(usuario.carrera, 105, 146, { align: 'center' });
  }

  var fechaHoy = new Date().toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  doc.text('Exportado el ' + fechaHoy, 105, 162, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(83, 74, 183);
  doc.text(apuntesCache.length + ' apunte' + (apuntesCache.length === 1 ? '' : 's'), 105, 175, { align: 'center' });

  // ── CONTENIDO ──
  doc.addPage();
  y = 20;

  // Título de sección
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(colorAccent[0], colorAccent[1], colorAccent[2]);
  doc.text('Mis Apuntes', margenIzq, y);
  y += 10;
  linea(colorAccent);

  // Iterar apuntes
  apuntesCache.forEach(function(apunte, i) {

    saltoSiNecesario(40);

    // Número y tipo
    var tipoLabel = apunte.tipo === 'evento' ? 'EVENTO' : 'APUNTE';
    var tipoColor = apunte.tipo === 'evento' ? colorEvento : colorApunte;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(tipoColor[0], tipoColor[1], tipoColor[2]);
    doc.text((i + 1) + '  •  ' + tipoLabel + '  •  ' + apunte.materia.toUpperCase(), margenIzq, y);
    y += 5;

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(colorTitulo[0], colorTitulo[1], colorTitulo[2]);
    var lineasTitulo = doc.splitTextToSize(apunte.titulo, anchoUtil);
    saltoSiNecesario(lineasTitulo.length * 7 + 4);
    doc.text(lineasTitulo, margenIzq, y);
    y += lineasTitulo.length * 7;

    // Fecha
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(colorHint[0], colorHint[1], colorHint[2]);
    doc.text(formatearFecha(apunte.fechaCreacion), margenIzq, y);
    y += 5;

    // Fecha de entrega (eventos)
    if (apunte.tipo === 'evento' && apunte.fechaEntrega) {
      var dias = diasRestantes(apunte.fechaEntrega);
      var entregaLabel = dias < 0
        ? 'Vencido'
        : dias === 0 ? '¡Entrega hoy!'
        : 'Entrega: ' + formatearFecha(apunte.fechaEntrega) + ' (faltan ' + dias + ' días)';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(dias <= 3 ? 80 : dias <= 7 ? 99 : 8,
                       dias <= 3 ? 19 : dias <= 7 ? 63 : 80,
                       dias <= 3 ? 19 : dias <= 7 ? 6  : 65);
      doc.text(' ' + entregaLabel, margenIzq, y);
      y += 5;
    }

    // Contenido
    if (apunte.contenido) {
      y += 1;
      textoMultilinea(apunte.contenido, margenIzq, 10, colorMuted, anchoUtil);
      y += 2;
    }

    // Tags
    if (apunte.tags && apunte.tags.length) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(colorAccent[0], colorAccent[1], colorAccent[2]);
      doc.text(apunte.tags.join('  '), margenIzq, y);
      y += 5;
    }

    // Nota si tiene adjuntos
    var adjuntosTexto = [];
    if (apunte.foto)  adjuntosTexto.push('foto');
    if (apunte.audio) adjuntosTexto.push('audio');
    if (apunte.video) adjuntosTexto.push('video');
    if (apunte.lat)   adjuntosTexto.push('ubicación');

    if (adjuntosTexto.length) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(colorHint[0], colorHint[1], colorHint[2]);
      doc.text('Adjuntos: ' + adjuntosTexto.join(', '), margenIzq, y);
      y += 5;
    }

    // Separador entre apuntes
    y += 3;
    linea([211, 209, 199]);
  });

  // Pie de página en cada página
  var totalPaginas = doc.getNumberOfPages();
  for (var p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colorHint[0], colorHint[1], colorHint[2]);
    if (p > 1) {
      doc.text('StudySync  •  ' + usuario.nombre, margenIzq, 290);
      doc.text('Página ' + p + ' de ' + totalPaginas, 210 - margenDer, 290, { align: 'right' });
    }
  }

  // Descargar
  var nombreArchivo = 'StudySync_' + usuario.nombre.replace(/\s+/g, '_') + '_' + new Date().toISOString().slice(0,10) + '.pdf';
  doc.save(nombreArchivo);
});
// ── INICIO 

if (!restaurarSesion()) {
  // Mostrar pantalla de selección
  $seleccion.removeClass('oculto');
}