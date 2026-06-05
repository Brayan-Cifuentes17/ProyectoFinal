// routes.js — Rutas de StudySync
const express = require("express");
const router = express.Router();
const push = require("./push.js");
const fs = require("fs");
const path = require("path");

// ─── BASE DE DATOS EN MEMORIA ────────────────────────────────────────────────
// En desarrollo los apuntes viven aquí.
// Persona 3 (Offline/SW) reemplazará esto con PouchDB + sincronización.
const pathJSON = path.join(__dirname, "mensajes-db.json");
function leerArchivo() {
  try {
    const data = fs.readFileSync(pathJSON, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}
function guardarArchivo(datos) {
  fs.writeFileSync(pathJSON, JSON.stringify(datos, null, 2), "utf8");
}
let apuntes = leerArchivo();
if (apuntes.length === 0) {
  apuntes = [
    {
      _id: "2026-05-23T08:00:00.000Z",
      tipo: "apunte",
      titulo: "Introducción a PWA",
      contenido:
        "Una Progressive Web App combina lo mejor de la web y las apps nativas: instalable, offline-first y con acceso a recursos del dispositivo.",
      materia: "Electiva III",
      tags: ["#pwa", "#serviceworker"],
      fechaCreacion: "2026-05-23T08:00:00.000Z",
      fechaEntrega: null,
      foto: null,
      audio: null,
      video: null,
      lat: null,
      lng: null,
      user: "estudiante",
    },
    {
      _id: "2026-05-22T14:00:00.000Z",
      tipo: "evento",
      titulo: "Parcial de Cálculo III",
      contenido:
        "Temas: series de Taylor, integrales dobles y triples. Llevar calculadora.",
      materia: "Cálculo III",
      tags: ["#parcial", "#calculo"],
      fechaCreacion: "2026-05-22T14:00:00.000Z",
      fechaEntrega: "2026-05-30T07:00:00.000Z",
      foto: null,
      audio: null,
      video: null,
      lat: null,
      lng: null,
      user: "estudiante",
    },
  ];
  guardarArchivo(apuntes);
}

// ─── GET /api ─────────────────────────────────────────────────────────────────
// Retorna todos los apuntes. Acepta query params para filtrar:
//   ?materia=Cálculo III
//   ?tipo=evento
//   ?q=taylor          (busca en título y contenido)
router.get("/", (req, res) => {
  let resultado = [...apuntes];

  const { materia, tipo, q } = req.query;

  if (materia) {
    resultado = resultado.filter(
      (a) => a.materia.toLowerCase() === materia.toLowerCase(),
    );
  }

  if (tipo) {
    resultado = resultado.filter((a) => a.tipo === tipo);
  }

  if (q) {
    const termino = q.toLowerCase();
    resultado = resultado.filter(
      (a) =>
        a.titulo.toLowerCase().includes(termino) ||
        a.contenido.toLowerCase().includes(termino) ||
        (a.tags && a.tags.some((t) => t.toLowerCase().includes(termino))),
    );
  }

  res.json(resultado);
});

// ─── POST /api ────────────────────────────────────────────────────────────────
// Crea un nuevo apunte.
// Body esperado (todos opcionales salvo titulo, materia, tipo, user):
// {
//   tipo:          "apunte" | "evento"          — obligatorio
//   titulo:        string                        — obligatorio
//   contenido:     string
//   materia:       string                        — obligatorio
//   tags:          string[]  ej: ["#parcial"]
//   fechaEntrega:  ISO string | null
//   foto:          base64 string | null          — Persona 2 lo llena
//   audio:         base64 string | null          — Persona 2 lo llena
//   video:         base64 string | null          — Persona 2 lo llena
//   lat:           number | null                 — Persona 2 lo llena
//   lng:           number | null                 — Persona 2 lo llena
//   user:          string                        — obligatorio
// }
router.post("/", (req, res) => {
  const { titulo, materia, tipo, user } = req.body;

  if (!titulo || !materia || !tipo || !user) {
    return res.status(400).json({
      ok: false,
      error: "Faltan campos obligatorios: titulo, materia, tipo, user",
    });
  }

  const apunte = {
    _id: new Date().toISOString(),
    tipo: tipo,
    titulo: titulo,
    contenido: req.body.contenido || "",
    materia: materia,
    tags: req.body.tags || [],
    fechaCreacion: new Date().toISOString(),
    fechaEntrega: req.body.fechaEntrega || null,
    foto: req.body.foto || null,
    audio: req.body.audio || null,
    video: req.body.video || null,
    lat: req.body.lat || null,
    lng: req.body.lng || null,
    user: user,
  };

  apuntes = leerArchivo();
  apuntes.unshift(apunte);
  guardarArchivo(apuntes);

  // Persona 4 (notificaciones) llamará a push.sendPush() aquí
  // cuando el apunte sea un evento con fechaEntrega próxima.
  if (apunte.tipo === "evento" && apunte.fechaEntrega) {
    const dias = Math.round(
      (new Date(apunte.fechaEntrega) - new Date()) / 86400000,
    );
    push.sendPush({
      titulo: "Recordatorio — " + apunte.titulo,
      cuerpo: "Faltan " + dias + " dias para la entrega",
      usuario: apunte.user,
    });
  }

  res.json({ ok: true, apunte });
});

// ─── DELETE /api/:id ──────────────────────────────────────────────────────────
// Elimina un apunte por su _id
router.delete("/:id", (req, res) => {
  const id = decodeURIComponent(req.params.id);
  apuntes = leerArchivo();
  const index = apuntes.findIndex(a => a._id === id);

  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Apunte no encontrado" });
  }

  apuntes.splice(index, 1);
  guardarArchivo(apuntes);
  res.json({ ok: true });
});

// ─── PUT /api/:id ──────────────────────────────────────────────────────────────
// Edita un apunte existente por su _id
router.put('/:id', (req, res) => {
  const id = decodeURIComponent(req.params.id);
  apuntes = leerArchivo();
  const index = apuntes.findIndex(a => a._id === id);

  if (index === -1) {
    return res.status(404).json({ ok: false, error: 'Apunte no encontrado' });
  }

  const apunteActual = apuntes[index];

  const apunteActualizado = {
    _id:           apunteActual._id,
    tipo:          req.body.tipo          || apunteActual.tipo,
    titulo:        req.body.titulo        || apunteActual.titulo,
    contenido:     req.body.contenido     !== undefined ? req.body.contenido : apunteActual.contenido,
    materia:       req.body.materia       || apunteActual.materia,
    tags:          req.body.tags          || apunteActual.tags,
    fechaCreacion: apunteActual.fechaCreacion,
    fechaEntrega:  req.body.fechaEntrega  !== undefined ? req.body.fechaEntrega : apunteActual.fechaEntrega,
    foto:          req.body.foto          !== undefined ? req.body.foto  : apunteActual.foto,
    audio:         req.body.audio         !== undefined ? req.body.audio : apunteActual.audio,
    video:         req.body.video         !== undefined ? req.body.video : apunteActual.video,
    lat:           req.body.lat           !== undefined ? req.body.lat   : apunteActual.lat,
    lng:           req.body.lng           !== undefined ? req.body.lng   : apunteActual.lng,
    user:          apunteActual.user,
  };

  apuntes[index] = apunteActualizado;
  guardarArchivo(apuntes);

  res.json({ ok: true, apunte: apunteActualizado });
});

// ─── GET /api/materias ────────────────────────────────────────────────────────
// Retorna lista única de materias registradas (útil para el filtro dropdown)
router.get("/materias", (req, res) => {
  apuntes= leerArchivo();
  const materias = [...new Set(apuntes.map((a) => a.materia))];
  res.json(materias);
});

// ─── Rutas reservadas para Persona 4 (Notificaciones / Push) ─────────────────
router.post("/subscribe", (req, res) => {
  const suscripcion = req.body;
  push.addSubscription(suscripcion);
  res.json(suscripcion);
});

router.get("/key", (req, res) => {
  const key = push.getKey();
  res.send(key);
});

router.post("/push", (req, res) => {
  const post = {
    titulo: req.body.titulo,
    cuerpo: req.body.cuerpo,
    usuario: req.body.usuario,
  };
  push.sendPush(post);
  res.json(post);
});

module.exports = router;
