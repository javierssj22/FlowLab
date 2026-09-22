# FlowLab 0.4.1 — laboratorio visual abierto

FlowLab permite construir y ejecutar diagramas de flujo de datos, observar señales y controlar un ESP32. Está pensado para Windows y Linux y funciona localmente, sin cuenta ni nube. Licencia MIT, código completo y firmware incluidos.

**Esta entrega es una primera versión funcional, no una equivalencia completa con LabVIEW.** Incluye un motor, editor e integración serie reales. No abre archivos `.vi`, no emula los controladores NI y no ofrece tiempo real determinista. El apartado de alcance al final distingue lo implementado de lo pendiente.

**Nuevo en 0.3:** 80 tipos de bloque; FFT, Waveform Stats, Unpack Int16, Bitwise Ops, DAC, PCNT, Touch, Tone, Gráfica XY y Display multímetro. Incluye cuatro ejemplos nuevos y mantiene Vector Index compatible. Consulta [la guía 0.3](docs/PAQUETE-0.3.md) para uso, familias, protocolo 3 y límites.

**Diseño de 0.4:** [especificación de metrología, instrumentación y ensayos](docs/ESPECIFICACION-0.4.md), con canales DAQ calibrados, Probe, protocolo 4, streaming y sincronización. Es una propuesta técnica; estas funciones todavía no forman parte de la versión publicada.

**Interfaz 0.4.1 implementada para Windows y Linux:** lienzo a pantalla completa, buscador flotante con Espacio, `/` o doble clic, cuatro grupos en la barra superior e inspector contextual. Proyecto, ejemplos, diagnóstico y conexión USB aparecen a pedido. Consulta [la guía de uso 0.4.1](docs/PAQUETE-0.4.1.md).

**Arquitectura base 0.2:** WebSocket, captura ADC DMA con trigger, Vector/Waveform, subdiagramas, archivos de proyecto, I²C multibyte y WebSerial directo. La explicación técnica y los límites están en [docs/ARQUITECTURA-0.2.md](docs/ARQUITECTURA-0.2.md).

*Captura histórica de la interfaz 0.3; la distribución actual usa Canvas-First.*

<img width="1533" height="696" alt="image" src="https://github.com/user-attachments/assets/b3df6344-da90-4781-8f01-ca82b9e209f8" />


## Descargas y estado de versiones

| Entrega | Windows | Linux | Estado |
|---|---|---|---|
| 0.3 | Portable x64 con Python incluido | Aplicación Python con dependencias offline | [Release disponible](https://github.com/javierssj22/FlowLab/releases/tag/v0.3.0) |
| 0.4 | DAQ/metrología sobre arquitectura compartida | Mismo alcance previsto | [Especificación técnica](docs/ESPECIFICACION-0.4.md), pendiente de implementación |
| 0.4.1 | Portable x64 e interfaz Canvas-First | Paquete Python offline y ejecutable x86_64 | [Release](https://github.com/javierssj22/FlowLab/releases/tag/v0.4.1), interfaz implementada |

[Windows 0.4.1](https://github.com/javierssj22/FlowLab/releases/download/v0.4.1/FlowLab-0.4.1-Windows.zip) · [Linux Python 0.4.1](https://github.com/javierssj22/FlowLab/releases/download/v0.4.1/FlowLab-0.4.1-Linux.tar.gz) · [Fuentes 0.4.1](https://github.com/javierssj22/FlowLab/releases/download/v0.4.1/FlowLab-0.4.1-Source.zip) · [SHA-256](https://github.com/javierssj22/FlowLab/releases/download/v0.4.1/SHA256SUMS-0.4.1.txt).

[Linux nativo x86_64](https://github.com/javierssj22/FlowLab/releases/download/v0.4.1/FlowLab-0.4.1-Linux-x86_64-native.tar.gz): extrae el archivo y ejecuta `./FlowLab/FlowLab`. Incluye Python; conserva `_internal`. Se construye y prueba en Ubuntu 22.04. No es AppImage ni un binario ARM64.

## Inicio rápido en Linux

Necesitas Python 3.10+ con `venv`. En Debian/Ubuntu, si faltan: `sudo apt install python3 python3-venv`. Descarga el paquete Linux anterior y ejecuta desde su carpeta:

```sh
tar -xzf FlowLab-0.4.1-Linux.tar.gz
cd FlowLab
sh instalar-linux.sh
sh start.sh
```

Se abre `http://127.0.0.1:8765`; termina con `Ctrl+C` en la terminal. El instalador crea `.venv-linux` e instala las dependencias incluidas sin PyPI. Este paquete necesita el Python del sistema: no es un ELF precompilado ni una AppImage.

Para trabajar desde el repositorio, con Git instalado:

```sh
git clone https://github.com/javierssj22/FlowLab.git
cd FlowLab
sh instalar-linux.sh
sh start.sh
```

En la aplicación 0.4.1, selecciona **ESP32 Hardware** y pulsa **Conectar** para conectar el ESP32. Elige el puerto enumerado, por ejemplo `/dev/ttyUSB0` o `/dev/ttyACM0`; los nombres COM corresponden a Windows. WebSocket usa el puente Python; WebSerial es opcional si el navegador ofrece esa API. Si falta permiso USB, consulta la [guía Linux](docs/LINUX.md#esp32-por-usb); no hace falta ejecutar FlowLab como root.

Linux comparte los mismos 80 bloques, ejemplos, panel frontal y firmware de Windows. La suite de software, instalación offline y arranque HTTP/WebSocket pasaron en [Ubuntu 22.04 mediante Actions](https://github.com/javierssj22/FlowLab/actions/runs/35667894947). La interfaz 0.4.1 se comprueba en navegador; las pruebas USB físicas continúan pendientes.

La [guía Linux](docs/LINUX.md) incluye puertos alternativos, WebSerial sin Python, guardado JSON y construcción opcional de un ejecutable nativo. La interfaz minimalista 0.4.1 ya usa el mismo HTML/CSS/JavaScript en ambas plataformas.

## Inicio rápido en Windows

### Paquete portable

1. Extrae **todo** el ZIP `FlowLab-0.4.1-Windows.zip` en una carpeta con permisos de escritura.
2. Dentro de `FlowLab`, ejecuta `FlowLab.exe`. Conserva `_internal` junto al ejecutable.
3. Se abre el navegador en `http://127.0.0.1:8765`.
4. Pulsa **Ejecutar** en el ejemplo Banco de señales. Abre **Panel frontal** para ver los instrumentos.
5. Para terminar, detén el flujo y cierra la consola del programa, o pulsa `Ctrl+C` en esa consola. Cerrar solamente la pestaña no termina el servidor.

El portable incluye Python, pyserial y websockets; no necesitas instalarlos. Es un ejecutable de Windows x64 generado en Windows 11, sin firma de editor. La interfaz se presenta en el navegador del sistema, no en un motor gráfico Win32 propio. El editor se aprovecha mejor en una ventana de escritorio amplia; en ventanas pequeñas puedes desplazar y ampliar el diagrama.

### Desde el código fuente

Requisito: Python 3.10 o posterior. Haz doble clic en `INICIAR.cmd`, o ejecuta:

```powershell
python server.py
```

La simulación no requiere paquetes externos. Para usar una placa desde la versión fuente:

```powershell
python -m pip install -r requirements.txt
```

También puedes usar `INSTALAR-SERIE.cmd`. Node.js 20+ solo es necesario para pruebas y generación de archivos de desarrollo, no para ejecutar la aplicación.

Opciones del servidor:

```powershell
python server.py --port 8770
python server.py --no-browser
```

Si el puerto 8765 está ocupado, cierra la instancia anterior o usa otro puerto. Los proyectos se guardan explícitamente en archivos. Ya no se cargan ni se escriben automáticamente en localStorage. Para rescatar el trabajo de 0.1 utiliza la opción correspondiente de Guía rápida en el mismo origen donde lo creaste.

## Qué incluye

| Área | Funciones implementadas |
|---|---|
| Editor | Nodos arrastrables, conexiones SVG tipadas, zoom, desplazamiento, ajustar, organización automática, inspector, duplicar/eliminar, búsqueda |
| Proyectos | JSON versionado, abrir/guardar, guardado transaccional en archivo elegido, detección de conflictos, 80 estados de deshacer/rehacer |
| Ejecución | Orden de dependencias, ejecución continua, un paso, detención, validación previa, errores de cálculo, cancelación, memoria entre ciclos |
| Instrumentos | Panel frontal editable: mover y dimensionar instrumentos; gráficas, lectura numérica, texto, barra de rango, LED, slider e interruptor en vivo |
| Datos | Consola con 150 eventos, 600 muestras por señal, 20.000 filas CSV de registro |
| ESP32 | Perfiles ESP32/S2/S3/C3/C6, selección COM, handshake de familia/protocolo, WebSocket o WebSerial, GPIO, ADC puntual/DMA, PWM LEDC, I²C multibyte y escáner |
| Firmware | Puente USB/UART abierto, watchdog para GPIO/PWM, compilación/carga desde la interfaz con Arduino CLI instalado |
| Autonomía | Generación de sketches Arduino con los 58 tipos escalares originales y subVIs escalares, sin depender de FlowLab para ejecutarlos |
| Entrega | Fuente, portable Windows, licencia, documentación, ejemplos, pruebas y flujo de CI |

## Uso del editor

1. Sobre el diagrama, pulsa **Espacio**, **/** o haz doble clic en el fondo. Escribe el nombre del bloque y pulsa **Enter**; también puedes usar **＋ Bloque** y elegir con el mouse.
2. Arrastra su encabezado para colocarlo. Arrastra el fondo para desplazar el lienzo; la rueda cambia el zoom.
3. Haz clic en el puerto de salida de un bloque y después en una entrada de otro. Naranja = decimal (DBL); azul = entero (I32); verde = booleano; rosa = texto; violeta = vector; cian = waveform. Los tipos figuran también en los bloques. Un entero puede alimentar una entrada decimal; otras conversiones requieren bloques explícitos.
4. Una salida puede conectarse a varias entradas. Una entrada admite una fuente; al reconectarla se reemplaza la anterior.
5. Selecciona un bloque y edita sus parámetros en el inspector. Los nombres y unidades admiten texto, no código ejecutable.
6. Pulsa **Ejecutar**. El modo inicial siempre es **Simulación**. Para un circuito real, selecciona explícitamente **ESP32 · Hardware**.
7. **Detener** termina el ciclo en curso de forma controlada y envía `stop` al puente. Las salidas GPIO y PWM del puente pasan a LOW.

Atajos: `Ctrl+S` guarda un archivo; `Ctrl+Z` deshace; `Ctrl+Y` o `Ctrl+Shift+Z` rehace; `Supr` elimina la selección; `Esc` cancela conexión/selección; `Espacio` o `/` abre la búsqueda en el cursor; `↑/↓` elige un resultado y `Enter` lo inserta. Los atajos no interceptan campos de texto ni controles.

La estructura del grafo se bloquea durante ejecución. Los sliders, controles de texto e interruptores del panel frontal sí pueden modificarse en vivo. Usa **Guardar** o **Guardar copia** para conservar versiones. Los permisos de la carpeta/cuenta Windows determinan quién puede acceder a ellas. Abrir un ejemplo o crear un proyecto se puede deshacer mientras la aplicación permanece abierta.

## Bloques

La biblioteca actual tiene **80 tipos**. El catálogo completo está en `docs/BIBLIOTECA.md`. Además de los bloques iniciales, incluye potencia, raíz, valor absoluto, resto, redondeo, trigonometría, logaritmo, exponencial, mínimo/máximo, OR, XOR, conversión booleana, longitud UTF-8, pulsos, ruido reproducible, media móvil, RMS, derivada, integrador, histéresis, flancos, contador, retardo a la conexión y estadística acumulada.

Los tipos numéricos decimales usan doble precisión; los enteros se limitan a 32 bits con signo. El control de texto admite 1024 caracteres y las operaciones de texto se limitan a 4096 unidades UTF-16 en el navegador, mientras Arduino utiliza hasta 4096 bytes UTF-8: con caracteres no ASCII la capacidad máxima difiere. La longitud de texto mide bytes UTF-8 en ambos modos.

| Grupo | Bloques | Comportamiento |
|---|---|---|
| Fuentes | Constante, slider, interruptor, generador, tiempo | Generador seno/cuadrada/triángulo/diente de sierra, amplitud, offset, fase y frecuencia |
| Matemática | Suma, resta, multiplicación, división, escalar, limitar | División por cero y valores no finitos detienen la ejecución |
| Lógica | Comparador, AND, NOT, selector | Booleanos estrictos; selector con dos entradas numéricas |
| Control | Filtro, PID, memoria | Filtro de primer orden; PID con anti-windup condicional; memoria de un ciclo |
| Instrumentos | Osciloscopio, indicador, LED, registro | También retransmiten su entrada como salida |
| ESP32 | ADC, entrada digital, salida digital, PWM, I²C leer, I²C escribir | Operaciones serie reales en Hardware; modelos sintéticos en Simulación |

### Tiempo, filtros y realimentación

El período objetivo puede ser 20, 50, 100, 250, 500 o 1000 ms. Solo hay un ciclo en curso; si un ciclo demora más que el período, se muestra sobrecarga y el siguiente empieza al terminar. No se superponen peticiones de hardware. El filtro y PID reciben el tiempo real transcurrido entre ciclos; en modo paso simulado reciben el período seleccionado.

El filtro implementa `y += (1-exp(-dt/tau)) * (x-y)`, inicializado con la primera muestra. El PID utiliza `Kp*error + Ki*integral - Kd*d(medición)/dt`; no acumula integral cuando esa acumulación agrava la saturación. No incorpora autotuning, derivada filtrada ni transferencia sin saltos.

Los ciclos sin memoria son inválidos. Un bloque **Memoria de un ciclo** publica su estado anterior, luego guarda el valor nuevo al finalizar el ciclo. Todas las memorias se actualizan simultáneamente. Esto permite contadores y realimentación sin dependencia del orden visual.

Cada **Ejecutar** inicia una sesión nueva y vacía trazas y filas CSV anteriores. **Paso** conserva el estado entre pasos simulados. Un paso de hardware termina enviando `stop` y no mantiene las salidas energizadas; el próximo paso de hardware inicia de nuevo. Los registros anteriores deben exportarse antes de iniciar otra sesión.

El navegador y Windows no garantizan tiempo real. Al quedar una pestaña en segundo plano, los temporizadores pueden ralentizarse. La máxima frecuencia del generador no es una garantía de ancho de banda: respeta la frecuencia de muestreo para evitar aliasing.

## Panel frontal y CSV

El panel se construye a partir de los instrumentos y controles del diagrama. Agrega los controles e instrumentos desde el buscador del diagrama. Pulsa **Proyecto → Edición y vista → Editar panel** para arrastrar los títulos y dimensionar las tarjetas desde la esquina inferior. **Terminar edición** conserva la disposición; posición y tamaño se guardan en el proyecto y admiten deshacer. **Orden automático** restaura la distribución automática, también reversible. Las gráficas escalares muestran las últimas 600 muestras; las waveform muestran el último lote de hasta 4096 muestras con su propio dt. El botón Waveform exporta ese lote completo en JSON. **Proyecto → Datos y diagnóstico** abre el monitor y las exportaciones CSV, Waveform y Espectro JSON. No ocupa espacio mientras está cerrado.

Los bloques **Registro de datos** generan filas mientras **REC** está activo. El CSV incluye `tiempo_s,nodo,nombre,valor,unidad`, codificación UTF-8 con BOM y separador coma. Conserva las últimas 20.000 filas en total, no por bloque. Los campos de texto que podrían interpretarse como fórmulas de planilla se neutralizan. Los valores se registran en memoria; no hay escritura continua a disco ni recuperación de datos tras cerrar la pestaña.

## ESP32: instalación y primera conexión

### 1. Preparar herramientas

La comunicación con firmware ya instalado funciona directamente desde el portable. Compilar y cargar requiere [Arduino CLI oficial](https://docs.arduino.cc/arduino-cli/installation/) y el núcleo [Arduino-ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html). Puedes colocar `arduino-cli.exe` en una carpeta `tools` junto a `FlowLab.exe`, o agregarlo al PATH.

Instalación reproducible del núcleo de referencia 3.3.5:

```powershell
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32@3.3.5 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
```

Estas descargas pertenecen a Arduino/Espressif y no están incluidas en el portable. El firmware utiliza las APIs de Arduino-ESP32 3.x; no es compatible con la antigua API LEDC de 2.x. Referencias: [LEDC](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ledc.html), [ADC](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html), [I²C](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/i2c.html).

### 2. Cargar el puente

Conecta la placa mediante un cable USB de datos. En **Proyecto → Conexión y firmware**, selecciona la familia, actualiza los puertos y elige el puerto COM o `/dev/ttyUSB*` / `/dev/ttyACM*` correcto. **Compilar** verifica el firmware; **Compilar y cargar** además reemplaza el programa existente de esa placa. Se muestra el resultado de Arduino CLI en la salida del compilador. Cada operación tiene un límite de 15 minutos; la primera compilación puede ser lenta.

Alternativa manual desde la carpeta fuente:

```powershell
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/FlowLabBridge
arduino-cli upload -p COM5 --fqbn esp32:esp32:esp32 firmware/FlowLabBridge
```

Reemplaza COM5 por tu puerto. También puedes abrir `firmware/FlowLabBridge/FlowLabBridge.ino` en Arduino IDE; conserva `profiles.h` en esa misma carpeta. La descarga del sketch desde la interfaz es solo el `.ino`; el paquete entregado contiene ambos archivos.

### 3. Conectar y ejecutar

Pulsa **Conectar placa**. El servidor abre a 115200 baudios, espera el reinicio y exige un handshake con protocolo 1, 2 o 3 y familia coincidente; ráfagas e I²C multibyte requieren protocolo 2 o 3, y DAC/PCNT/Touch/Tone requieren protocolo 3. Cierra otros monitores serie que estén usando el mismo puerto.

Después abre un ejemplo ADC o PWM y selecciona **ESP32 · Hardware**. En simulación, incluso los bloques ESP32 producen o consumen datos sintéticos sin escribir en la placa. Conectar una placa por sí solo no cambia el modo de ejecución.

### Perfiles incluidos

| Perfil | FQBN genérico | ADC admitidos por el perfil | SDA/SCL de ejemplo | Salida de ejemplo |
|---|---|---|---|---|
| ESP32 | `esp32:esp32:esp32` | 32, 33, 34, 35, 36, 39 | 21 / 22 | 25 |
| ESP32-S2 | `esp32:esp32:esp32s2` | 1–10 | 8 / 9 | 5 |
| ESP32-S3 | `esp32:esp32:esp32s3` | 1, 2, 4–10 | 8 / 9 | 5 |
| ESP32-C3 | `esp32:esp32:esp32c3` | 0, 1, 3, 4 | 6 / 7 | 5 |
| ESP32-C6 | `esp32:esp32:esp32c6` | 0–6 | 6 / 7 | 5 |

Los perfiles son listas limitadas de pines del SoC, **no certificaciones de todas las placas comerciales**. La lista completa está en `boards.json`. GPIO 34–39 del ESP32 clásico son solo entrada y carecen de pull-up/down interno; flash, PSRAM o componentes de tu placa pueden ocupar otros GPIO del perfil, como 16/17 en algunos módulos. Revisa siempre el esquema de la placa. Usa 3,3 V; el firmware no proporciona aislamiento eléctrico ni adaptación de nivel.

La configuración genérica utiliza `Serial`; las placas con conversor USB-UART se conectan por ese puerto. En placas con USB nativo que no muestran el protocolo, compila manualmente con la opción adecuada de USB CDC on boot en Arduino IDE para esa placa. FlowLab 0.4.1 no expone las opciones avanzadas del menú de cada FQBN.

C2, C5, C61, H2 y P4 no tienen perfiles FlowLab en esta entrega. La [compatibilidad de Arduino-ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/getting_started.html) no equivale por sí sola a compatibilidad validada de FlowLab.

### Operaciones de hardware

- **ADC:** lectura de 12 bits o `analogReadMilliVolts`. El ejemplo 0–4095 → 0–3,3 es una escala didáctica, no una calibración del ADC. Para medición usa milivoltios y calibración adecuada a tu placa.
- **Digital:** entrada sin pull, pull-up o pull-down; salida booleana HIGH/LOW.
- **PWM:** 8 bits, entrada redondeada y limitada a 0–255. La frecuencia se configura por nodo. Si LEDC no puede asignar canal/frecuencia, el firmware informa error. No hay asignación avanzada de temporizadores.
- **I²C:** un bus a 100 kHz, dirección decimal 8–119, comandos escalares compatibles y transacciones multibyte. Lectura con repeated-start; NACK/timeout produce error. El nuevo bloque I²C multibyte escribe hasta 32 bytes y lee hasta 32; permite repeated START o STOP entre ambas fases. Utiliza un Vector numérico para TX. Los pines no pueden compartir funciones con GPIO/ADC/PWM en el mismo grafo.

### Detención y watchdog

El puente controla si deja de recibir comandos durante 2000 ms después de habilitar una salida digital/PWM. En ese caso pone esas salidas en LOW y **bloquea nuevas operaciones hasta recibir `stop`**. Al reanudarse una pestaña suspendida, el flujo informa el error y exige iniciar otra vez; no reanuda silenciosamente las salidas.

La detención no revierte comandos ya enviados a periféricos I²C ni conoce el estado seguro de un dispositivo externo. LOW tampoco es necesariamente el estado seguro de un relé activo en bajo. Es un mecanismo de software de laboratorio, no un circuito de parada de emergencia ni un sistema de control industrial certificado.

## Exportar a Arduino sin PC

En **Proyecto → Conexión y firmware → Ejecución autónoma**, exporta `FlowLabStandalone.ino`. Guárdalo dentro de una carpeta llamada `FlowLabStandalone` y ábrelo en Arduino IDE, o compílalo con Arduino CLI y el FQBN correspondiente.

El exportador valida conexiones, tipos, parámetros y GPIO. Genera código de los 58 tipos escalares originales, incluido filtro, PID y memoria, más Bitwise Ops, XY y Display multímetro; también expande subVIs escalares. Los bloques de lotes, ADC DMA, I²C multibyte y los nuevos DAC/PCNT/Touch/Tone requieren el motor conectado y no se exportan como sketch autónomo en 0.4.1. Las dependencias se resuelven antes de emitir el código. No ejecuta texto de etiquetas como código.

Los sliders, controles de texto e interruptores quedan fijados al valor exportado. Gráficas, indicadores y registros se convierten en líneas `tiempo,id,valor` por Serial. El sketch corre continuamente desde el arranque, **sin el watchdog de conexión del firmware puente**. Ante errores numéricos/I²C/PWM entra en un bucle de fallo y lleva sus salidas GPIO/PWM a LOW. Para volver al control desde FlowLab debes cargar nuevamente el firmware puente.

## Ejemplos

Los proyectos están en `examples/`, además de estar disponibles desde el inspector:

1. **Banco de señales:** generador → filtro → gráfico/indicador/registro; comparación con umbral → LED.
2. **Adquisición ADC:** ADC → escala de voltaje → gráfico/indicador/registro. Selecciona primero la familia para adaptar el pin de ejemplo.
3. **Control PWM:** slider 0–255 → PWM → indicador. La salida empieza en cero.
4. **Realimentación:** constante 1 + valor anterior → indicador y memoria. Cada paso aumenta el contador.
5. **Tipos de datos:** demostración de cables naranja, azul, verde y rosa, controles de texto y conversión entero → texto.
6. **Procesamiento:** ruido reproducible → media móvil, RMS y desviación estándar.

## Arquitectura y extensión

```text
Navegador: editor + panel + motor de datos + exportador
        │ WebSocket con token y dueño exclusivo, o WebSerial directo
Servidor Python local opcional para el enlace serie
        │ pyserial · 115200 · protocolo 2 con id de petición
Firmware FlowLabBridge en ESP32
        └─ GPIO / ADC / LEDC / Wire
```

- `web/core.mjs`: definiciones de bloques, tipos, validación, perfiles, motor y ejemplos.
- `web/app.mjs`: editor, navegación, instrumentación y coordinación de ejecución.
- `web/codegen.mjs`: generación determinista de C++ Arduino.
- `server.py`: archivos estáticos, comprobación de Host/Origin/token, serie y trabajos Arduino CLI.
- `firmware/FlowLabBridge`: puente, permisos de GPIO y watchdog.
- `scripts/sync-profiles.mjs`: sincroniza perfiles del frontend con backend y firmware.
- `docs/PROTOCOL.md`: contrato de comunicación y API local.
- `tests/`: pruebas de cálculo, grafos, exportación, validación, HTTP y puerto serie simulado.

Para añadir un bloque: declara su esquema en `TYPES`, su implementación en `Runtime.tick`, su exportación en `generateArduino` y pruebas de comportamiento. Para añadir un SoC: verifica el datasheet/esquema, agrega `BOARDS`, ejecuta `node scripts/sync-profiles.mjs`, compila el firmware y valida en una placa real. Los archivos importados no pueden instalar plugins ni ejecutar scripts arbitrarios.

## Pruebas y reconstrucción

```powershell
node --test tests/*.test.mjs
python -m unittest discover -s tests -v
node scripts/sync-profiles.mjs
node scripts/make-examples.mjs
```

Para construir el portable desde el código fuente, ejecuta `scripts/build-windows.ps1` en PowerShell. Requiere conexión a PyPI para descargar dependencias de compilación. El resultado queda en `work/dist/FlowLab`. Conserva avisos de terceros al redistribuir; el paquete entregado los incluye.

El informe `VALIDACION.md` registra lo probado en esta entrega. La compilación y prueba física del firmware se distinguen de las pruebas con un puerto simulado. Los resultados de la suite Windows/Ubuntu y de compilación ESP32 se enlazan desde `VALIDACION.md`. Las pruebas físicas de periféricos continúan pendientes.

## Alcance pendiente

No implementado en 0.4.1: compatibilidad de archivos LabVIEW, módulos con múltiples puertos o referencias externas, matrices/clusters, estructuras gráficas de bucles/casos, ejecución distribuida, drivers VISA/SCPI/DAQmx, streaming ADC continuo sin huecos, buses SPI/UART adicionales, drivers específicos de sensores, BLE, MQTT, TCP, Wi-Fi/OTA, Modbus, CAN/TWAI, depuración con breakpoints, compilación ESP-IDF directa, FPGA, instalador firmado, actualizaciones automáticas y soporte para todas las variantes ESP32.

Próximas etapas razonables: validar y caracterizar DMA/trigger en las cinco familias; ampliar conectores de subVIs; añadir frames binarios y streaming continuo; agregar drivers de instrumentos; ampliar transportes ESP32; mejorar el empaquetado y construir una matriz de pruebas eléctricas. No hay fechas ni equivalencia comercial prometidas.

## Funciones nuevas de 0.2

En **Proyecto → Ejemplos** hay ejemplos de **Ráfaga ADC**, **Subdiagrama** e **I²C multibyte**. ADC DMA solicita 20–80 kS/s, con 16–4096 muestras, disparo inmediato o por flanco y pretrigger. La tasa es nominal y pendiente de medir en placa; transferencia y captura son fases separadas. No se permiten salidas GPIO/PWM armadas durante la ráfaga.

Para usar USB directamente desde Chrome/Edge, elige **Proyecto → Conexión y firmware → Transporte → WebSerial**. La placa debe tener el firmware nuevo instalado. Con el fuente puedes ejecutar `INICIAR-WEBSERIAL.cmd`: usa Node.js como servidor estático, sin Python ni proxy serie. Abre `http://127.0.0.1:8766`. También funciona la carpeta web servida en la raíz de HTTPS.

El portable se entrega en una carpeta nueva para conservar la versión anterior. Antes de cerrar una sesión 0.1, exporta tu proyecto JSON y ábrelo en 0.4.1. No reemplaces `_internal` de un ejecutable que está en funcionamiento.
