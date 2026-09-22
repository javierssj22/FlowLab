# FlowLab 0.4.1 — diseño Canvas-First

Estado: diseño de referencia; la interfaz Canvas-First está implementada en 0.4.1. La guía de uso y alcance vigente está en [PAQUETE-0.4.1.md](PAQUETE-0.4.1.md). Este documento conserva los wireframes y la propuesta original, incluidos detalles de evolución. Base inspeccionada: `web/index.html`, `web/style.css` y `web/app.mjs` de la aplicación funcional 0.3. La especificación metrológica 0.4 es un documento de diseño; esta propuesta de interfaz no presupone que sus funciones ya estén implementadas. No modifica el runtime, el protocolo de dispositivo ni la versión de la release actual.

## 1. Objetivo y reglas de visibilidad

El estudiante debe poder responder de inmediato: «¿estoy armando o midiendo?», «¿simulo o uso la placa?» y «¿está ejecutándose?». Todo lo demás aparece al solicitarlo o cuando requiere una acción.

La barra superior contiene exactamente cuatro grupos interactivos:

1. Conmutador **Diagrama / Panel Frontal**.
2. Selector **Simulación / ESP32 Hardware**, con estado de conexión integrado.
3. Una acción principal **Ejecutar / Detener**.
4. **Proyecto ▾**.

No hay biblioteca fija, pestaña Dispositivos, monitor inferior permanente, pie de estados, panel de ejemplos fijo ni inspector vacío. La marca y versión se muestran en Acerca de; el nombre del proyecto se muestra dentro del menú Proyecto y en el título de ventana. Un asterisco en «Proyecto *» indica cambios sin guardar y su nombre accesible dice «Proyecto, cambios sin guardar».

## 2. Wireframes

### Diagrama: sin selección

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Diagrama | Panel Frontal]  [Simulación ▾]  [▶ Ejecutar]         [Proyecto ▾] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│         ┌────────────────┐                    ┌────────────────┐             │
│         │ Generador  DBL │ ───── naranja ────→ │ Gráfico    DBL │             │
│         └────────────────┘                    └────────────────┘             │
│                                                                              │
│                       lienzo + cuadrícula sutil                              │
│                                                                              │
│                                                                              │
│                           [vacío: Añadir bloque…]                            │
│                  Espacio, / o doble clic para insertar                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

La ayuda central y el botón Añadir bloque aparecen solo si el diagrama está vacío. En diagramas existentes, los atajos se descubren en Proyecto → Ayuda y en el menú contextual del fondo. No hay un quinto botón permanente en la barra.

### Diagrama: inserción en el punto de trabajo

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Diagrama | Panel Frontal]  [Simulación ▾]  [▶ Ejecutar]         [Proyecto ▾] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────┐                                                               │
│  │ Señal DBL │─────────────╮                                                  │
│  └───────────┘             ●  ┌──────────────────────────────────────┐       │
│                               │ ⌕ filtro                           × │       │
│                               ├──────────────────────────────────────┤       │
│                               │ › Filtro paso bajo      DBL → DBL  │       │
│                               │   Media móvil           DBL → DBL  │       │
│                               │   …                                 │       │
│                               ├──────────────────────────────────────┤       │
│                               │ Suaviza la señal.                    │       │
│                               │ ↑↓ Elegir   Enter Añadir   Esc Salir│       │
│                               └──────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────────────────┘
```

Los resultados se obtienen de la biblioteca realmente instalada. Un bloque propuesto en 0.4, como Notch, no se muestra como disponible hasta que exista su implementación.

### Diagrama: selección y parámetros

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Diagrama | Panel Frontal]  [Simulación ▾]  [▶ Ejecutar]         [Proyecto ▾] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                              ┌───────────────────────────┐   │
│         ┌──────────────────┐                 │ Filtro paso bajo       × │   │
│  ──────→│ Filtro       DBL  │─────→           │ Nombre  [Filtro         ]│   │
│         └──────────────────┘                 │ Constante de tiempo       │   │
│              seleccionado                    │ [0,2               ] s   │   │
│                                              │                           │   │
│                                              │ ▸ Opciones avanzadas      │   │
│                                              │                    [⋯]    │   │
│                                              └───────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

Tarjeta lateral superpuesta, no columna reservada. Cerrar no elimina la selección. La tarjeta no vuelve a aparecer por cada `render()`; se reabre al seleccionar otro bloque o pedir Propiedades. Un cable seleccionado usa una pequeña acción contextual para eliminarlo, sin abrir el inspector de parámetros.

### Panel Frontal: medir

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Diagrama | Panel Frontal] [ESP32 conectado ▾] [■ Detener]       [Proyecto ▾] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌────────────────────────── Señal de salida ────────────────────────────┐   │
│   │ V                                                                   │   │
│   │       ╭──╮     ╭──╮     ╭──╮                                        │   │
│   │  ─────╯  ╰─────╯  ╰─────╯  ╰──────                                  │   │
│   │                                                               t · s │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌────────── Voltaje ───────────┐   ┌────────── Amplitud ───────────────┐   │
│   │          1,6500 V            │   │     ───────●──────────  1,4 V     │   │
│   └─────────────────────────────┘   └───────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

No se muestran nodos, cables, búsqueda de bloques, cuadrícula de construcción ni inspector de parámetros. Los controles del experimento siguen siendo operables. Editar panel es una acción explícita en Proyecto; al activarla aparece una barra contextual corta «Editando panel · Terminar» y los tiradores de tamaño. Se sale de edición antes de ejecutar.

### Conexión de hardware, bajo demanda

```text
                     ┌────────────────────────────────────────┐
                     │ Conectar ESP32                       × │
                     │                                        │
                     │ Familia    [ESP32-S3                 ▾]│
                     │ Conexión   [Puente local              ▾]│
                     │ Puerto     [COM5 · USB Serial         ▾]│
                     │                                        │
                     │ [Actualizar puertos]       [Conectar] │
                     │                                        │
                     │ ▸ Firmware y diagnóstico              │
                     └────────────────────────────────────────┘
```

En WebSerial se sustituye COM por «Elegir dispositivo USB»; abre el selector del navegador desde el clic real. El flujo no debe perder activación de usuario detrás de un `await`. Firmware se expande solo cuando hace falta: versión requerida, compilar/cargar y salida del compilador. I²C y configuración de bus van en un segundo nivel avanzado dentro del diálogo.

## 3. Layout y lenguaje visual

- Barra única de 56 px, borde inferior suave. En 1366×768 quedan 712 px de altura de trabajo, aproximadamente 93 %; en 1920×1080, cerca de 95 %. No se promete 100 % mientras exista la barra.
- El workspace ocupa todo el ancho. No hay huecos de columnas cuando inspector o buscador están cerrados.
- Inspector: 304–336 px de ancho, margen 16 px, alto máximo del workspace con scroll propio. Se coloca al lado derecho y evita cubrir el bloque seleccionado; si es necesario, la tarjeta cambia de anclaje antes de desplazar el diagrama. Nunca se llama a `fit()` por abrir/cerrar parámetros.
- Spotlight: hasta 400 px de ancho, seis resultados visibles y lista desplazable. Anclaje al cursor con ajuste a bordes. Posición de inserción independiente de la posición corregida del popup.
- Panel: padding 24 px, separación 16 px, anchura de instrumento ≥260 px cuando hay espacio; gráficos prioritariamente de ancho completo. Las posiciones manuales existentes se conservan. En pantallas estrechas se muestra una composición apilada de presentación sin reescribir las coordenadas del archivo.
- Paleta visual: fondo carbón suave y superficies algo más claras, textos de alto contraste, un único acento para Ejecutar. Sin gradientes, pulsaciones de nodos ni sombras intensas. Detener conserva ubicación y ancho; cambia icono y texto, no depende solo de rojo/verde.
- Cuadrícula de puntos o líneas de 24 px, contraste bajo. Los cables mantienen los seis colores de datos de 0.3, con grosor/distinción de vector y waveform. Puertos y selección deben tener contraste no textual suficiente; los tipos también se leen por etiquetas DBL/I32/BOOL/STRING/VEC/WAVE.
- Los nodos muestran nombre, terminales y tipo; detalles largos, IDs técnicos y descripciones van al inspector. Valor en vivo solo cuando existe; se elimina el «—» repetido en todos los nodos antes de ejecutar. La leyenda completa de tipos vive en Ayuda; incompatibilidades se explican junto al puerto pertinente.
- A 640–900 px se reducen separaciones y rótulos secundarios, no el tamaño del botón Detener. Por debajo de 640 px se mantiene una sola superficie de barra, con cuatro grupos distribuidos en dos filas. Spotlight/inspector se transforman en hoja inferior. No se fuerza `body{min-width:510px}` ni scroll horizontal de toda la aplicación.
- Los targets interactivos tienen al menos 32 px; en entrada táctil, 44 px. Foco visible, etiquetas accesibles, navegación de teclado y `prefers-reduced-motion`.

## 4. Spotlight: búsqueda e inserción

### Apertura

- Espacio o `/`, únicamente en Diagrama, con foco de trabajo que no sea un campo, botón, control de instrumento, contenido editable ni un diálogo abierto; ignorar composición IME y teclas repetidas.
- Doble clic sobre fondo vacío, nunca sobre nodo, puerto, cable o instrumento. El gesto se cancela si hubo arrastre; no abre al finalizar pan.
- Menú contextual del fondo → Añadir bloque. En lienzo vacío también existe el botón con texto. Esto evita depender solo de atajos ocultos y permite uso táctil.
- Teclado: se usa la última posición del puntero dentro del canvas; si no hay posición válida, centro visible. No se usa la esquina (0,0) por defecto.
- Se abre solo si `editable()` lo permite. Durante ejecución se informa «Detén para modificar el diagrama», sin modificar conexiones ni estado.

### Búsqueda

Índice local derivado de `TYPES`/`describe`, con nombre, alias pedagógicos, grupo, descripción breve y tipos de entrada/salida. Normalizar mayúsculas y acentos. Ejemplos: «voltaje» encuentra lectura ADC e indicador; «promedio» encuentra media; «entero» encuentra constante/conversión I32. Los alias ayudan a buscar; no sugieren que un indicador mida físicamente voltaje.

Ranking estable: nombre exacto > prefijo de nombre/alias > coincidencia de palabras > descripción. Una tolerancia leve a errores puede añadirse tras el ranking exacto. Con 80 bloques no hace falta red ni un servicio de IA. Mostrar máximo seis resultados a la vez, con más resultados mediante scroll y navegación. Consulta vacía: pocos bloques de inicio y últimos usados **de la sesión**, sin recuperar historiales personales de otro alumno.

Cada fila: icono, nombre, firma corta y marca de hardware si aplica. Una descripción corta de la opción activa se muestra al pie, sin 80 tooltips simultáneos. Si hay una conexión pendiente, se priorizan entradas compatibles, pero no se ocultan las demás sin indicarlo. Enter añade el bloque; la conexión se completa manualmente salvo que el usuario haya elegido una acción explícita «Añadir y conectar a [entrada]».

### Selección y cierre

Flechas arriba/abajo cambian opción, Enter confirma una sola vez, Esc cierra; Tab sale del componente y cierra cuando el foco abandona el popup. Clic fuera cierra sin insertar. Abrir Spotlight oculta temporalmente el inspector; cerrar restaura su estado si sigue válida la selección anterior.

El buscador usa input `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, lista `role="listbox"` y opciones con IDs estables. El foco permanece en el input durante la navegación. Los resultados se anuncian de forma breve; no se leen todas las descripciones con cada pulsación.

Se congela el punto de inserción en coordenadas del mundo al abrir:

```js
function toWorld(clientX, clientY, rect, view) {
  return {
    x: (clientX - rect.left - view.x) / view.zoom,
    y: (clientY - rect.top - view.y) / view.zoom
  };
}
```

El punto corresponde a la esquina superior izquierda del nodo nuevo. Se respetan límites del mundo y se aplica un pequeño desplazamiento si coincide exactamente con otro nodo. Mover el popup para que quepa en pantalla no altera este punto. La inserción crea un solo checkpoint de undo, selecciona el nodo, cierra Spotlight y abre sus propiedades; no auto-organiza ni ajusta todo el diagrama.

## 5. Inspector y separación Armar/Medir

Regla central: `visible = diagram && nodeSelected && inspectorRequested && !overlayOpen`, o edición explícita de panel con instrumento seleccionado. Seleccionar un cable no satisface `nodeSelected`.

- Se abre al seleccionar un bloque; × lo cierra manteniendo la selección. Doble clic sobre un bloque o acción Propiedades lo reabre. Clic en fondo deselecciona y cierra.
- Nombre y parámetros habituales primero. Ayuda específica junto al campo, unidades fuera del valor editable y errores junto a ese campo. Avanzados se agrupan mediante `<details>` usando metadata por tipo; no ocultar un parámetro necesario para que el ejemplo funcione.
- Duplicar, eliminar y datos técnicos pasan al menú contextual del nodo/⋯ del inspector. Supr y Ctrl+D mantienen accesibilidad por teclado; no actúan al escribir en un campo.
- Cambios se confirman con Enter/blur y un único undo por edición. Esc cancela el valor en edición antes de cerrar el inspector. Mantener borradores locales de campo para no sobrescribirlos con renderizados de valores en vivo.
- En ejecución, parámetros de configuración están en solo lectura; slider/toggle/controles del Panel siguen operando conforme a la lógica actual. No confundir configurar el rango con mover una perilla durante una medida.
- Cambiar a Panel Frontal cierra inspector y Spotlight; conserva selección del diagrama en memoria. No abre el inspector al hacer clic en el título de un instrumento. Selección de traza/cursores futuros tampoco equivale a editar propiedades.
- Vuelta a Diagrama restaura vista/pan/zoom; puede restaurar el inspector solo si estaba abierto y su selección continúa existiendo.
- SubVI: breadcrumb contextual «Principal / Integrador» en una esquina del canvas mientras se está dentro de un módulo. Sustituye la presencia permanente de `module-back` en una toolbar. No se ejecuta un subVI aislado si el runtime actual no lo permite.

## 6. Barra superior y estados

### Ejecutar/Detener

Un solo botón `#execution-toggle` deriva del estado real del motor, sin mantener una segunda verdad de ejecución en el componente:

| Estado | Texto | Comportamiento |
|---|---|---|
| Detenido | ▶ Ejecutar | validar y ejecutar |
| Preparando | Preparando… | bloqueado hasta completar preparación o timeout actual |
| Ejecutando | ■ Detener | detener mediante la función existente |
| Deteniendo | Deteniendo… | evita doble envío; mantiene feedback visible |
| Paso en curso | Ejecutando paso… | deriva de busy; bloquea nueva ejecución |
| Error finalizado | ▶ Ejecutar | error persiste hasta corregir/descartar; no reintento automático |

El frontend 0.3 no tiene cancelación instantánea de todas las operaciones hardware. La nueva interfaz debe mostrar esa realidad: «Finalizando captura para detener» cuando corresponda. La propuesta P4 de parada prioritaria se habilitará cuando exista backend compatible.

Cambiar Diagrama/Panel está permitido mientras corre el flujo. Cambiar Simulación/Hardware, abrir otro proyecto o modificar estructura requiere detener; el control se deshabilita con explicación accesible. Abrir Proyecto sigue permitido para Guardar, Exportar datos o consultar ayuda.

### Entorno y conexión

El segundo grupo integra selector y estado, sin añadir otro indicador fijo en la barra:

```text
Simulación ▾
ESP32 · Conectado ▾
ESP32 · Conectar ▾
ESP32 · Error ▾
```

En estado Hardware sin conexión/error, clic sobre el indicador/acción «Conectar/Revisar» dentro del mismo grupo abre el diálogo. Elegir Hardware solo cambia el entorno y expone la acción necesaria; no abre automáticamente el modal. Pulsar Ejecutar sin conexión produce un aviso breve junto al selector con acción Conectar, nunca cae silenciosamente a simulación ni ejecuta una secuencia automática al cerrar el diálogo.

Con conexión sana, el selector permite cambiar de entorno cuando está detenido; no abre el modal de COM. La acción «Cambiar placa/Desconectar» está en su desplegable y requiere estar detenido. Cambiar placa desconecta, informa estado y pasa a «Conectar», desde donde el usuario abre el diálogo. La revisión de firmware puede abrirse también desde una necesidad explícita detectada (versión incompatible); no se interrumpe una simulación por ausencia de pyserial o Arduino CLI.

El modal se cierra al conectar correctamente. El botón Ejecutar sigue esperando un clic explícito. Cancelar conserva el entorno seleccionado y estado desconectado, sin perder el proyecto. El modal captura foco, Esc cierra si no hay una operación de escritura en curso y al cerrar devuelve foco al selector/acción que lo abrió. Una compilación puede continuar mostrando progreso; la carga en curso mantiene sus restricciones actuales y no finge cancelarla al cerrar una ventana.

### Información que debe seguir visible

La reducción de texto no oculta lo que modifica la interpretación de una medida. Simulación permanece escrita en la barra; además una lectura retenida conserva procedencia y estado «Última captura · detenida» o «Sin conexión». Si el entorno cambia, no se relabelan lecturas simuladas como hardware. Una desconexión conserva o limpia datos según política explícita, pero siempre marca su antigüedad.

Errores de validación tienen una banda compacta con primera causa y «Ver bloque»; múltiples causas se muestran bajo demanda. Errores de ejecución/conexión persisten hasta resolver o descartar. Toast `role="status"` para confirmaciones no críticas; errores que necesitan acción no desaparecen solos a los 6,5 s. No se muestra un contador de logs creciente si todo funciona bien.

## 7. Destino de los controles actuales

| Control/texto actual | Cambio 0.4.1 |
|---|---|
| Biblioteca fija y contador «80» | Spotlight; el número total puede aparecer en Acerca de |
| Inspector vacío «Todo empieza…» | eliminar superficie vacía |
| Ejemplos a la derecha | Proyecto → Ejemplos, galería corta con propósito y miniatura |
| Nombre editable y estado guardado en barra | Proyecto; asterisco discreto de cambios sin guardar |
| Nuevo/Abrir/Guardar/Guardar copia | Proyecto; Ctrl+O/Ctrl+S y accesos explícitos |
| Undo/redo fijos | Proyecto → Edición y atajos; menú contextual relevante |
| Paso y período de ciclo | Proyecto → Ejecución avanzada; aclarar que ciclo no es frecuencia ADC |
| Pestaña Dispositivos | eliminar; conexión bajo demanda desde entorno |
| COM/transporte/familia | diálogo de conexión, campos dependientes del transporte |
| Compilar/cargar/log compilador | sección Firmware y diagnóstico del diálogo |
| SDA/SCL/scan I²C | configuración avanzada del dispositivo |
| Exportar Arduino | Proyecto → Exportar; conservar validación de bloques compatibles |
| Monitor inferior y resumen min/max permanentes | eliminar del layout inicial; gráfico explícito en Panel, o ventana opcional de inspección solicitada |
| REC/CSV/Waveform/Espectro JSON | Proyecto → Datos; agrupados según datos disponibles |
| Limpiar historial | Proyecto → Datos, con alcance claro; no elimina el proyecto |
| Consola y contador | Proyecto → Diagnóstico; error con acción abre detalles relevantes |
| Zoom +/−, porcentaje, Ajustar, Organizar | menú contextual del canvas y Proyecto → Vista; atajos F para ajustar y zoom con rueda |
| Leyenda de colores siempre visible | Ayuda y mensaje contextual de conexión |
| Estado «Diagrama válido», contador nodos/cables | Diagnóstico; solo fallos relevantes aparecen junto a la acción |
| Tiempo de ciclo/placa repetidos en footer | Diagnóstico y selector de entorno; eliminar footer |
| Editar panel / orden automático / instrucciones | Proyecto → Panel; barra contextual solo durante edición |
| Frases decorativas y OPEN SOURCE/MIT repetidos | eliminar del workspace; conservar en Acerca de y documentación |
| Recuperar localStorage 0.1 | Proyecto → Compatibilidad dentro de configuración avanzada |

El menú Proyecto usa secciones cortas: archivo, ejemplos, datos, opciones contextuales y ayuda. Abrir una sección avanzada muestra un diálogo con encabezado y volver/cerrar; se evita una cadena de submenús hover. Un menú único de 30 comandos sería otra forma de saturación.

## 8. Cambios concretos en HTML

1. Sustituir `.topbar`, `.toolbar` y `.tabs` por un único `<header>`; mover ahí el conmutador de vista. Conservar `#file-input` oculto fuera del menú, porque su selección debe funcionar aunque el menú cierre.
2. Eliminar `<aside class="library">`, `.library-footer`, `.inspector-bottom`, el listado fijo `.examples`, `.canvas-label` y `<footer class="statusbar">` del shell.
3. Convertir `#devices-view` en `<dialog id="hardware-dialog">`, con conexión primero y `<details>` para firmware/bus/diagnóstico. Quitar `data-tab="devices"`.
4. Crear Spotlight, menú Proyecto y región de avisos como overlays. Inspector fuera del flujo de columnas con atributo `hidden` inicial.
5. Conservar `#viewport`, `#world`, `#wires`, `#nodes`, `#panel-view` y `#instruments`; son la base funcional que ya dibuja y ejecuta.
6. Mover monitor/consola a una superficie opcional si se conserva la inspección de señales. No dejar un canvas oculto recibiendo renders en cada tick como sustituto del refactor.

Esqueleto objetivo (nombres de IDs nuevos son parte de la propuesta):

```html
<header class="workspace-bar" aria-label="Controles de trabajo">
  <div role="group" aria-label="Vista">
    <button data-tab="diagram" aria-pressed="true">Diagrama</button>
    <button data-tab="panel" aria-pressed="false">Panel Frontal</button>
  </div>
  <div id="environment-control"><!-- selector y conexión integrados --></div>
  <button id="execution-toggle" class="primary">▶ Ejecutar</button>
  <button id="project-menu-trigger" aria-expanded="false"
          aria-controls="project-menu">Proyecto ▾</button>
</header>

<main id="workspace">
  <section id="diagram-view" aria-label="Armar el diagrama">
    <div id="viewport" tabindex="0">
      <div id="world"><svg id="wires"></svg><div id="nodes"></div></div>
    </div>
  </section>
  <section id="panel-view" aria-label="Medir en el panel frontal" hidden>
    <div id="instruments" class="instrument-grid"></div>
  </section>
  <aside id="inspector" aria-label="Propiedades del bloque" hidden></aside>
</main>

<section id="spotlight" aria-label="Añadir bloque" hidden>
  <input id="block-query" role="combobox" aria-label="Buscar bloque"
         aria-autocomplete="list" aria-expanded="false"
         aria-controls="block-results" autocomplete="off">
  <ul id="block-results" role="listbox" aria-label="Bloques"></ul>
</section>
<div id="project-menu" hidden><!-- botones y secciones navegables --></div>
<dialog id="hardware-dialog" aria-labelledby="hardware-title"></dialog>
<div id="action-notice" role="status" hidden></div>
<input id="file-input" type="file" accept=".json,.flowlab" hidden>
```

Proyecto puede implementarse como disclosure con botones HTML y orden Tab natural, sin `role="menu"` si no se implementa por completo su patrón de teclado. El diálogo nativo se abre mediante `showModal()`; Spotlight es un popup no modal con foco gestionado, no un diálogo que oscurece todo el lienzo.

## 9. Cambios concretos en CSS

Reescribir reglas del shell, no añadir otra capa de overrides al final del actual CSS minificado. Separar tokens, shell, canvas, bloques, instrumentos, overlays y responsive. Eliminar columnas 224/252 px, alturas calculadas descontando tres barras/monitor y breakpoints que vuelven a introducir la biblioteca.

```css
:root {
  --bar-height: 56px;
  --surface: #181d24;
  --canvas: #12171d;
  --border: #303945;
  --text: #edf1f5;
}

[hidden] { display: none !important; }
body {
  margin: 0;
  min-width: 0;
  height: 100dvh;
  display: grid;
  grid-template-rows: var(--bar-height) minmax(0, 1fr);
  overflow: hidden;
}
.workspace-bar {
  display: grid;
  grid-template-columns: auto auto auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
}
#project-menu-trigger { justify-self: end; }
#workspace { position: relative; min-width: 0; min-height: 0; }
#diagram-view, #panel-view { position: absolute; inset: 0; }
#viewport { position: absolute; inset: 0; overflow: hidden; }
#panel-view { overflow: auto; padding: 24px; }
#inspector {
  position: absolute;
  inset: 16px 16px auto auto;
  width: min(320px, calc(100% - 32px));
  max-height: calc(100% - 32px);
  overflow: auto;
  z-index: 20;
}
#spotlight {
  position: fixed;
  width: min(400px, calc(100vw - 24px));
  max-height: min(430px, calc(100dvh - 80px));
  overflow: auto;
  z-index: 40;
}
.instrument-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 16px;
}
:focus-visible { outline: 2px solid #94beff; outline-offset: 3px; }
@media (max-width: 640px) {
  :root { --bar-height: 96px; }
  .workspace-bar { grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
  #inspector { inset: auto 12px 12px; width: auto; max-height: 55%; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

Este fragmento define geometría, no una hoja completa lista para sustituir todos los estilos. Deben conservarse estilos funcionales de puertos/cables y revisar contraste de texto, líneas y foco en ambos fondos. El atributo hidden manda sobre reglas como `.view{display:flex}`; ocultar con opacidad dejaría controles enfocables y no satisface el diseño.

## 10. Cambios concretos en JavaScript

### Separación de responsabilidades

Mantener core y código de adquisición; extraer del `app.mjs` los componentes de presentación:

```text
web/ui/workspace-shell.mjs   → vista, overlays, selección y restauración de foco
web/ui/block-search.mjs      → índice, ranking y teclado de Spotlight
web/ui/project-menu.mjs      → rutas de archivo, ejemplos, datos y ajustes
web/ui/inspector.mjs         → formularios, borradores y metadatos de parámetros
web/ui/hardware-dialog.mjs   → conexión/firmware, dependiente de capacidades
```

Estado de UI separado del proyecto y del estado real de ejecución:

```js
const ui = {
  view: 'diagram',
  selectedNodeId: null,
  selectedEdgeIndex: null,
  inspectorRequested: false,
  overlay: null, // spotlight | project | hardware | examples | diagnostics
  insertionPoint: null,
  pointerInCanvas: null,
  panelEditing: false
};
```

Vista/overlay/puntero no se añaden al undo del proyecto. La selección debe tener una sola fuente de verdad: migrar `selected`/`selectedEdge` a este estado o adaptarlos, sin conservar dos variables que puedan divergir. `running`, `busy`, conexión y operación pertenecen al motor/servicio existente, no se copian como booleanos independientes en cada widget.

### Funciones actuales que cambian

| Código actual | Sustitución requerida |
|---|---|
| `renderPalette()` y `#search.oninput` | `openSpotlight`, índice de búsqueda y render de opciones; se ejecuta al abrir/buscar |
| `addNode(type)` centrado en viewport | `addNode(type, worldPoint)` con punto congelado y mismo undo/validación/pin default |
| `renderInspector()` con estado vacío | retornar oculto si no hay bloque o no corresponde a la vista; sin markup pedagógico vacío |
| `render()` que redibuja toda la UI | separar render de estructura, selección, parámetros y valores; no destruir foco del formulario |
| `setTab()` sobre tres vistas | solo diagram/panel; modal hardware como overlay independiente |
| `#mode.onchange → setTab('devices')` | actualizar entorno/indicador; diálogo solo desde acción de conexión |
| `action('run')` y `action('stop')` | `execution-toggle` deriva el estado y llama las funciones existentes |
| `renderPanel()` y click en título | abrir inspector solo durante edición explícita de panel |
| `fit()` con reservas de cabecera internas | calcular con rectángulo real y padding de 24 px; retirar offset fijo de 104 px |
| `updateControls()` | matriz de disponibilidad para botón único y acciones del menú |
| `updateLive()` / ResizeObserver de monitor | actualizar únicamente instrumentos visibles; monitor opcional tiene su propio ciclo |
| `log()` que toca contador/console siempre | store acotado de logs; render solo al abrir diagnóstico; aviso separado para error activo |
| `refreshHardware()` inicial | descubrimiento pasivo sin cambiar de vista ni generar avisos en simulación |
| shortcuts globales | controlador con exclusión de inputs, controles, diálogo, IME y captura de atajos según contexto |

Al retirar IDs se debe auditar **cada** `$()` y binding `action()`: `run`, `stop`, `search`, `palette`, `type-count`, `node-count`, `monitor-chart`, `last-value`, `min-value`, `max-value`, `sample-count`, `run-dot`, `run-state`, `timing`, `board-footer`, `validation-state`, `console-toggle` y controles movidos. No basta con eliminar HTML: hoy su ausencia rompería inicialización y ticks. Los IDs conservados para opciones avanzadas deben tener un único nodo DOM; no duplicar botones ocultos como proxy del nuevo diseño.

### Atajos y gesto de inserción

```js
function isEditingTarget(target) {
  return target instanceof Element && Boolean(target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), ' +
    'button, [role="button"], [role="slider"], [role="combobox"]'
  ));
}

function onWorkspaceKeydown(event) {
  if (event.defaultPrevented || event.isComposing || event.repeat) return;
  if (ui.view !== 'diagram' || ui.overlay || isEditingTarget(event.target)) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === 'Space' && event.shiftKey) return;
  if (event.code !== 'Space' && event.key !== '/') return;
  if (!editable()) return;
  event.preventDefault();
  openSpotlight(ui.pointerInCanvas ?? visibleCanvasCenter());
}
```

La acción explícita «Añadir bloque» sigue siendo necesaria cuando el foco está en un botón; Espacio debe seguir activando ese botón de acuerdo con el navegador. El doble clic filtra `.node`, `.port`, `.wire` y cualquier control. El menú contextual usa el punto del evento, no la última posición de búsqueda. El manejador global de Esc respeta primero el componente con foco; no borra una selección del diagrama cuando se está cancelando un diálogo.

Prioridad de Esc: cancelar edición de campo → cerrar overlay → cancelar conexión pendiente → cerrar inspector → deseleccionar. Nunca detiene una medida por accidente; Detener permanece como acción explícita.

### Ejecución y foco

Un handler de la acción principal consulta el estado actual y serializa transición a preparar/parar. Deshabilita doble envío y captura errores en la misma ruta que el runtime existente. El botón mantiene su nodo DOM, dimensiones y foco durante el cambio de texto. Cambiar vista no reinicia historial, conexión ni runtime.

Al ocultar una región enfocada, mover foco al botón que la abrió o al viewport; nunca dejarlo en un elemento hidden. Avisos de error ofrecen «Ver bloque», que cambia a Diagrama, selecciona el nodo y lo lleva a una zona visible con sus propiedades abiertas. Anunciar ejecución/detención una sola vez; no usar aria-live para cada muestra del multímetro.

## 11. Compatibilidad y aceptación

Esta revisión es de presentación: no renombrar identificadores de bloques, colores de tipo, conexiones, parámetros, archivos de proyecto ni comandos de protocolo. Las posiciones manuales del panel y diagramas existentes siguen cargando. Si el desarrollo se hace antes de tener P4, la interfaz muestra solo las capacidades implementadas en 0.3; el nombre 0.4.1 del diseño no convierte la metrología propuesta en una función terminada.

Criterios de aceptación:

1. Al abrir un diagrama no hay sidebar, inspector vacío, monitor fijo ni footer. Cuatro grupos en una sola barra de escritorio; todo el rectángulo restante sirve al workspace.
2. Espacio, `/`, doble clic vacío y menú contextual abren Spotlight; Enter inserta una vez, Esc cancela sin mutación. Funciona con zoom 0,5×/1×/2×, pan, bordes y scroll; el punto de inserción no depende del desplazamiento del popup.
3. Los mismos atajos no se disparan al escribir nombre, texto o números, usar una perilla, activar un botón, estar en Panel o tener un diálogo abierto. Se prueba teclado sin ratón y composición IME.
4. Selección muestra parámetros; deselección oculta. Cerrar inspector mantiene selección y no reaparece por un tick/render. Ninguna vista vacía mantiene ancho reservado.
5. Medir muestra solo instrumentos. Click/arrastre de slider funciona sin abrir inspector. Entrar/salir de edición es explícito y no altera valores ni layouts por cambiar vista.
6. Hardware sin conexión muestra una acción clara que abre el modal solo por clic. WebSerial mantiene activación de usuario. Cancelar no cambia el proyecto y cerrar no autoejecuta.
7. Ejecutar/Detener funciona en simulación y hardware; preparaciones, captura en curso, fallos y desconexión tienen feedback fiel al backend. Detener es siempre localizable.
8. Abrir/guardar/ejemplos/exportaciones/firmware/I²C siguen accesibles, sin referencias DOM ausentes ni IDs duplicados. La suite funcional 0.3 sigue pasando.
9. Prueba visual de 1366×768, 1920×1080, viewport estrecho y zoom de navegador 200 %: foco y acción principal accesibles, textos sin solapamiento, popup dentro de área visible, datos y unidades legibles.
10. Evaluación con estudiantes: localizar Ejecutar, añadir un bloque, conectar dos bloques, modificar un parámetro, pasar a Medir y guardar un ejemplo. Registrar éxito y errores antes/después; la mejora de usabilidad debe medirse, no inferirse solo del número de botones ocultos.

Orden de aplicación: shell/topbar y reubicación de acciones → Spotlight y coordenadas → inspector contextual → panel de medición → modal hardware → pruebas de regresión, accesibilidad y tareas con estudiantes.

## 12. Aplicación del diseño en Linux

**La propuesta 0.4.1 cubre Windows y Linux con el mismo frontend.** Spotlight, inspector, barra única, instrumentos y atajos se implementan una sola vez bajo `web/`. Los lanzadores cambian por plataforma; no se crea una copia divergente de HTML/CSS/JS. Las prestaciones de P4 siguen sujetas a su implementación, independientemente del sistema operativo.

### Experiencia compartida

```text
┌────────────────────────────────────────────────────────────────────────┐
│ [Diagrama | Panel Frontal] [ESP32 · Conectar ▾] [▶ Ejecutar] [Proyecto ▾]│
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                       EL MISMO LIENZO                                   │
│                                                                        │
│              ┌──────── Conectar ESP32 ────────────────┐                 │
│              │ Familia  [ESP32-S3                  ▾] │                 │
│              │ Enlace   [Puente local              ▾] │                 │
│              │ Puerto   [/dev/ttyACM0 · USB Serial ▾] │                 │
│              │                                       │                 │
│              │ [Actualizar]               [Conectar] │                 │
│              │ ▸ Firmware y diagnóstico              │                 │
│              └───────────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────────────────┘
```

La ruta es un ejemplo de presentación, no un puerto que la aplicación deba asumir o abrir automáticamente. El selector utiliza exclusivamente los dispositivos enumerados por pyserial o elegidos por el usuario en WebSerial. No se persiste un nombre `/dev/ttyUSB0` como identidad fiable de una placa tras reconectarla.

### Adaptaciones frontend y conexión

| Aspecto | Comportamiento previsto en Linux |
|---|---|
| Barra, canvas, panel e inspector | mismo DOM, CSS y componentes de Windows |
| Puertos | etiqueta «Puerto serie», nombres devueltos por backend; `/dev/ttyUSB*` y `/dev/ttyACM*` son habituales |
| Ruta principal | `sh start.sh`: navegador → WebSocket local → pyserial → ESP32 |
| Ruta sin Python | `sh start-webserial.sh`: interfaz estática con Node.js y WebSerial si está disponible |
| Guardado | selector nativo del navegador si existe File System Access; alternativa Abrir JSON/descargar copia |
| Atajos | Ctrl+S, Ctrl+Z, Espacio, `/`, Esc; sin usar Super/Meta como requisito de Linux |
| Ratón/trackpad | coordenadas del viewport, mismo zoom/pan; doble clic solo sobre fondo vacío |
| Escala del escritorio | medidas CSS y canvas con devicePixelRatio; comprobar 100/125/150/200 % |
| Ventanas GNOME/KDE | no depender de posiciones globales de pantalla ni de decoración del gestor de ventanas |

La selección de funciones se hace por **capacidades**, no detectando la distribución o el user-agent. Comprobar `navigator.serial` y contexto seguro para USB directo, y existencia de pickers para guardado. La ruta WebSocket no requiere que el navegador pueda abrir un puerto USB. Web Serial está documentado para Chrome de escritorio en Linux; la petición de puerto debe originarse en un gesto del usuario. [Documentación de Chrome](https://developer.chrome.com/docs/capabilities/serial).

Si el backend no está disponible y el navegador tampoco ofrece WebSerial, la simulación sigue funcionando: mostrar «Inicia el puente local para conectar una placa» únicamente al solicitar Hardware. No desplegar diagnóstico del sistema durante la clase en simulación. La ausencia de File System Access tampoco bloquea proyectos: se mantiene la importación/descarga JSON existente.

### Estados de error del diálogo

- **Sin dispositivos:** «No se detectaron puertos serie. Conecta la placa y actualiza». Diferenciarlo de acceso denegado; no presentar instrucciones de permisos si todavía no existe el puerto.
- **Permiso denegado:** conservar el dispositivo y ofrecer «Ver ayuda de permisos USB» dentro del diálogo. La guía indica comprobar propietario/grupo; en Debian/Ubuntu suele ser dialout. No ejecutar sudo, modificar grupos/udev ni relanzar el navegador como root desde FlowLab.
- **Puerto ocupado:** informar qué dispositivo falló y ofrecer Reintentar; no cerrar otros procesos ni monitores serie automáticamente.
- **Desconexión:** conservar procedencia de la última captura, marcarla como retenida y detener según el motor. Reconectar no vuelve a ejecutar el flujo.
- **Permiso del navegador cancelado:** regresar al diálogo sin añadir un error técnico a la consola ni cambiar silenciosamente de transporte.
- **Arduino CLI ausente:** mostrarlo al desplegar Firmware; no impedir simulación ni conexión a una placa con firmware ya cargado. El backend usa PATH o `tools/arduino-cli`, con permiso de ejecución.

El modal conserva orden y acciones independientemente de si se usa USB-UART o USB nativo. En WebSerial no hay un selector de rutas `/dev`: aparece el botón que invoca el picker del navegador. Los detalles Linux quedan en ayuda de diagnóstico, no en la barra ni en los instrumentos.

### Distribución y aceptación Linux

La versión ejecutable disponible sigue siendo **FlowLab 0.3** como paquete Python con wheels offline y lanzadores shell. El rediseño 0.4.1 se empaquetará con los mismos recursos `web/` tanto en Windows como en Linux cuando esté implementado. El README diferencia diseño y release; no se renombra un paquete 0.3 como 0.4.1 solo por actualizar esta documentación.

El build nativo opcional se realiza en Linux mediante `scripts/build-linux.sh`; se preservan `_internal`, licencias y documentación. Compatibilidad de arquitectura y glibc se valida por artefacto. AppImage, DEB/RPM, Flatpak y ARM64 precompilado no se anuncian como entregables existentes.

Matriz propuesta de aceptación de la UI: Ubuntu 22.04/24.04, Chromium/Chrome para WebSerial cuando la build lo exponga, Firefox para simulación/WebSocket y fallback de archivos, GNOME Wayland y una sesión KDE/X11. Estos son objetivos de prueba, no plataformas ya verificadas para 0.4.1. Añadir pruebas de distribución en CI Linux; la compatibilidad de permisos USB y los diálogos del navegador necesitan pruebas manuales con una placa.

Casos específicos: nombre de usuario/carpeta con espacios, rutas con caracteres no ASCII, distintos layouts de teclado (incluido `/` escrito con Shift), cancelación del picker, reconexión de tty, permisos insuficientes, ausencia de backend y exportación JSON de fallback. En ninguna variante deben reaparecer la biblioteca fija, el footer o el monitor permanente por un breakpoint de CSS.
