#Modelo de Datos — StudySync

Este archivo define la estructura de un **apunte** en StudySync.
**Todos los compañeros deben respetar este modelo** para que el sistema funcione.

---

## Objeto `apunte`

```json
{
  "_id":           "2026-05-23T10:00:00.000Z",
  "tipo":          "apunte",
  "titulo":        "Derivadas parciales",
  "contenido":     "Texto del apunte...",
  "materia":       "Cálculo III",
  "tags":          ["#parcial", "#matemáticas"],
  "fechaCreacion": "2026-05-23T10:00:00.000Z",
  "fechaEntrega":  null,
  "foto":          null,
  "audio":         null,
  "video":         null,
  "lat":           null,
  "lng":           null,
  "user":          "juan"
}
```

---

## Descripción de campos

| Campo          | Tipo            | Obligatorio | Descripción |
|----------------|-----------------|-------------|-------------|
| `_id`          | string ISO date | ✅           | Generado automáticamente con `new Date().toISOString()` |
| `tipo`         | `"apunte"` \| `"evento"` | ✅ | Determina cómo se renderiza la tarjeta |
| `titulo`       | string          | ✅           | Título del apunte o evento |
| `contenido`    | string          | ❌           | Cuerpo del apunte |
| `materia`      | string          | ✅           | Nombre de la materia (ej: "Cálculo III") |
| `tags`         | string[]        | ❌           | Etiquetas con `#` (ej: `["#parcial", "#quiz"]`) |
| `fechaCreacion`| string ISO date | ✅           | Se genera automáticamente al crear |
| `fechaEntrega` | string ISO date \| null | ❌ | Solo para `tipo: "evento"`. Usado por Persona 4 para notificaciones |
| `foto`         | string base64 \| null | ❌  | **Persona 2** lo llena con `camara.tomarFoto()` |
| `audio`        | string base64 \| null | ❌  | **Persona 2** lo llena con la grabación de micrófono |
| `video`        | string base64 \| null | ❌  | **Persona 2** lo llena con `camara.detenerGrabacion()` |
| `lat`          | number \| null  | ❌           | **Persona 2** lo llena con `navigator.geolocation` |
| `lng`          | number \| null  | ❌           | **Persona 2** lo llena con `navigator.geolocation` |
| `user`         | string          | ✅           | Nombre del estudiante seleccionado en el perfil |

---

## Rutas de la API

| Método   | Ruta              | Descripción |
|----------|-------------------|-------------|
| `GET`    | `/api`            | Obtener todos los apuntes |
| `GET`    | `/api?materia=X`  | Filtrar por materia |
| `GET`    | `/api?tipo=evento`| Filtrar por tipo |
| `GET`    | `/api?q=texto`    | Buscar por palabra clave |
| `GET`    | `/api/materias`   | Lista de materias únicas |
| `POST`   | `/api`            | Crear nuevo apunte |
| `DELETE` | `/api/:id`        | Eliminar apunte por `_id` |
| `POST`   | `/api/subscribe`  | (Persona 4) Suscripción push |
| `GET`    | `/api/key`        | (Persona 4) VAPID public key |
| `POST`   | `/api/push`       | (Persona 4) Enviar push manual |

---

## Notas para cada compañero

### Persona 2 — Recursos Nativos
- Tu función de foto debe retornar un **string base64** (igual que `camara.tomarFoto()` ya lo hace).
- Tu función de audio debe retornar un **string base64** (usar `FileReader.readAsDataURL`).
- Tu función de video ya retorna base64 en `camara.detenerGrabacion()` — no cambies eso.
- La geolocalización debe entregarnos `{ lat: number, lng: number }`.
- Tú no envías al servidor, solo entregas los datos. **Persona 1** arma el objeto y hace el POST.

### Persona 3 — Offline / Service Worker
- Usa `_id` generado con `new Date().toISOString()` al guardar en PouchDB (igual que en `sw-db.js`).
- El objeto completo que guardas en PouchDB es este mismo modelo.
- El endpoint POST `/api` ya acepta el objeto completo.
- El Background Sync debe hacer POST a `/api` con el objeto guardado en PouchDB.

### Persona 4 — Notificaciones / Backend
- El campo `fechaEntrega` (ISO string) es el que usas para calcular cuándo disparar la notificación de recordatorio.
- Las rutas `/api/subscribe`, `/api/key` y `/api/push` están reservadas en `routes.js` — solo añade el código.
- Copia la lógica de `push.js` del repo base, el modelo es compatible.

---

## Ejemplo de POST para crear un apunte

```javascript
fetch('/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tipo:         'evento',
    titulo:       'Parcial de Cálculo',
    contenido:    'Series de Taylor, integrales dobles',
    materia:      'Cálculo III',
    tags:         ['#parcial'],
    fechaEntrega: '2026-05-30T07:00:00.000Z',
    user:         'juan'
  })
});
```
