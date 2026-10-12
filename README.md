# study-tracker

Guarda en el navegador cada respuesta de una app de estudio y muestra cuánto has
mejorado por semana, por mes y por tema.

- **Sin dependencias, sin build, sin servidor.** Tres archivos que se cargan con `<script>` y `<link>`.
- **No pierde nada.** Cada respuesta se guarda en el momento en que se responde. Da igual si terminas la prueba, la dejas a medias o cierras la pestaña.
- **Independiente del contenido.** No sabe nada de GCP ni de AWS: solo recibe un id de pregunta, un tema y si acertaste.
- **Varias apps en el mismo dominio.** Cada app usa su propio `appId`, así que varias apps publicadas en `tuusuario.github.io` no se mezclan.
- **Los datos son tuyos.** Puedes exportarlos e importarlos en JSON para hacer respaldos o pasarlos a otro dispositivo.

## Uso rápido

```html
<link rel="stylesheet" href="study-tracker.css">
<script src="study-tracker.js"></script>
<script src="study-tracker-view.js"></script>
<script>
  var tracker = StudyTracker.create({ appId: 'aws-saa-c03' });

  // Al empezar una prueba
  var session = tracker.startSession({ planned: 20 });

  // Cada vez que el usuario responde (se guarda al instante)
  tracker.recordAnswer(session, {
    question: 'q-017',      // id estable de la pregunta
    topic: 'networking',    // dominio o tema
    correct: false,
    response: [2]           // opcional: lo que eligió, para revisarlo después
  });

  // Al terminar (o al salir antes)
  tracker.endSession(session, 'completed'); // o 'stopped'

  // Pantalla de progreso lista para usar
  StudyTrackerView.render(document.getElementById('progreso'), tracker, {
    topics: [
      { id: 'networking', label: 'Redes', total: 40 },
      { id: 'storage', label: 'Almacenamiento', total: 35 }
    ],
    getQuestion: function (id) { /* opcional: para ver el detalle de cada prueba */ }
  });
</script>
```

También funciona con `require('./study-tracker.js')` en Node (por ejemplo, en tests).

## Qué mide

| Métrica | Qué significa |
|---|---|
| **Dominio estimado** | De las preguntas que has visto, el porcentaje que acertaste **la última vez** que las respondiste. Repetir una pregunta fácil no lo infla, y corregir un error sí lo sube. Su cambio en el periodo compara el valor de hoy con el que tenías al empezar la semana o el mes. |
| **Acierto del periodo** | Porcentaje de respuestas correctas en la semana o el mes, comparado con el periodo anterior. |
| **Preguntas vistas** | Cuántas preguntas distintas has respondido sobre el total del banco (cobertura). |

Las semanas van de lunes a domingo, en la hora local del usuario.

## API

### `StudyTracker.create({ appId, storage?, now? })`

- `appId` (obligatorio): identificador de la app. Se guarda en `localStorage` con la clave `study-tracker:<appId>`.
- `storage`: cualquier objeto con `getItem`, `setItem` y `removeItem`. Por defecto usa `localStorage` y, si no está disponible (modo privado), usa la memoria.
- `now`: función que devuelve la hora actual en ms. Sirve para los tests.

### Escribir

| Método | Qué hace |
|---|---|
| `startSession({ planned?, meta? })` | Abre una sesión y devuelve su id. `meta` admite lo que quieras (filtros usados, modo…). |
| `recordAnswer(sessionId, { question, topic, correct, response? })` | Guarda una respuesta al instante. |
| `endSession(sessionId, reason?)` | Cierra la sesión (`'completed'`, `'stopped'` u otro texto). Una sesión sin cerrar conserva igualmente sus respuestas. |
| `importData(jsonOObjeto, 'merge' \| 'replace')` | Importa un respaldo. `merge` no duplica respuestas. Devuelve cuántas añadió. |
| `clear()` | Borra todos los datos de esta app. |

### Leer

| Método | Devuelve |
|---|---|
| `getSessions()` | Sesiones con al menos una respuesta, de la más reciente a la más antigua, con `answered`, `correct`, `pct` y `byTopic`. |
| `getAnswers({ session?, topic?, question?, from?, to? })` | Respuestas filtradas. |
| `periodStats('day' \| 'week' \| 'month', { limit? })` | Acierto por periodo, incluidos los periodos vacíos (`pct: null`) para que los huecos se vean. |
| `mastery({ topics?, until? })` | Dominio estimado global y por tema. `topics` es `{ idTema: totalPreguntas }` para calcular la cobertura. |
| `progress('week' \| 'month', { topics? })` | Todo lo necesario para responder “¿he mejorado?”: dominio y acierto actuales, y su cambio, global y por tema. |
| `questionStats()` | Por pregunta: intentos, aciertos y si la última vez fue correcta. Sirve para armar pruebas con “solo las falladas” o “solo las nuevas”. |
| `exportData()` | Copia completa de los datos. |
| `onChange(fn)` | Llama a `fn` cada vez que cambian los datos, también desde otra pestaña. Devuelve una función para dejar de escuchar. |
| `isPersistent()` | `false` si el navegador no permite guardar (los datos se perderán al cerrar). |

### `StudyTrackerView.render(contenedor, tracker, opciones)`

Pinta la pantalla de progreso: indicadores, tabla por tema, un gráfico de acierto
por tema (semana o mes), historial de pruebas y botones para exportar, importar y borrar.
Devuelve `{ refresh, destroy }`. Llama a `destroy()` antes de reutilizar el contenedor.

| Opción | Uso |
|---|---|
| `topics` | `[{ id, label, total }]`, en el orden en que quieres verlos. |
| `getQuestion(id)` | Opcional. Devuelve `{ text, options, correct }` para mostrar el detalle de cada prueba del historial. |
| `period` | `'week'` (por defecto) o `'month'`. |
| `locale` | Idioma de las fechas. Por defecto `'es'`. |
| `texts` | Sustituye cualquier texto de `StudyTrackerView.texts` (por ejemplo, para traducir la vista). |
| `fileName` | Nombre del archivo al exportar. |

Los colores se adaptan con variables CSS: `--st-surface-custom`, `--st-text-custom`,
`--st-muted-custom`, `--st-line-custom`, `--st-grid-custom` y `--st-accent-custom`.
Incluye modo oscuro.

## Formato de los datos

```json
{
  "schema": 1,
  "appId": "gcp-genai-leader",
  "sessions": [
    { "id": "m1x2…", "startedAt": 1760000000000, "endedAt": 1760000600000,
      "reason": "completed", "planned": 20, "meta": { "domain": 0 } }
  ],
  "answers": [
    { "session": "m1x2…", "question": "d1-07", "topic": "1",
      "correct": true, "response": [0], "at": 1760000030000 }
  ]
}
```

`schema` permite migrar datos antiguos si el formato cambia: la función `migrate()`
del código es el único lugar donde hay que hacerlo. Las respuestas se guardan como
lista plana para que sea fácil analizarlas fuera (hoja de cálculo, pandas, etc.).

`localStorage` admite unos 5 MB por dominio. Cada respuesta ocupa unos 120 bytes,
así que caben del orden de 40.000 respuestas.

## Tests

```bash
npm test   # usa el runner integrado de Node 18+, sin instalar nada
```

## Licencia

MIT. Ver [LICENSE](LICENSE).
