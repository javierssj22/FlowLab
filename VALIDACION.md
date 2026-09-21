# Validación de FlowLab 0.3

- 50 pruebas JavaScript y 24 Python aprobadas localmente en Windows.
- FFT contrastada con DFT directa independiente, seno conocido, ganancia Hann, DC/Nyquist y dB.
- Pruebas de estadísticas, Int16, máscaras/desplazamientos, multímetro y buffer XY.
- Los cuatro ejemplos nuevos validan y simulan en las cinco familias.
- Contratos de los nuevos periféricos probados con transporte simulado; no hay una placa conectada para verificar mediciones, watchdog o señal física.
- La compilación del firmware para las cinco familias y la suite Windows/Linux se verifican mediante Actions. Los resultados 0.3 se registrarán tras ejecutarse.
- La siguiente sección conserva el registro histórico de 0.2.

# Validación de FlowLab 0.2 — 2026-09-20

## Resultado de esta revisión

- **39 pruebas JavaScript aprobadas**, cero fallos: 27 regresiones del motor original y 12 pruebas de arquitectura nueva.
- **20 pruebas Python aprobadas**, cero fallos: HTTP, serie simulada, buffers fragmentados y WebSocket real por loopback.
- Portable Windows x64 reconstruido con Python 3.14.3, pyserial 3.5, websockets 15.0.1 y PyInstaller 6.22.0.
- Arranque real del EXE en un puerto independiente: versión 0.2.0, CSP con endpoint correcto, autenticación WebSocket, consulta de estado y entrega de todos los módulos nuevos comprobados.
- Navegador: biblioteca de 70 bloques; ejemplo de captura simulada de 1024 muestras; panel waveform con escala temporal propia; módulo con integrador, entrada/salida del editor y ejecución desde el padre comprobados.
- Frontend estático servido con Node.js, sin server.py: carga completa sin errores de consola y selección automática de WebSerial comprobadas.
- No se abrió ni se programó un puerto físico durante estas pruebas. Se conservó el servidor y el trabajo de 0.1 existentes.

Comandos reproducibles desde la carpeta del fuente, después de instalar requirements.txt:

```powershell
node --test tests/*.test.mjs
python -m unittest discover -s tests -v
```

## Qué demuestran las pruebas

Los contratos rechazan números no finitos, vectores excesivos, dt inválido y bytes I²C fuera de rango. Los ejemplos nuevos se validan y simulan para los cinco perfiles. Se prueba estado independiente de subVIs, expansión de exportación escalar, firmas incompatibles, límite de profundidad, conflictos de GPIO anidados y propagación de cancelación.

Las pruebas de persistencia usan handles de archivo controlados: comprueban serialización, commit/abort y detección de cambios externos. No sustituyen pruebas del diálogo nativo y permisos de carpetas de cada navegador/Windows.

WebSocket usa sockets reales para autenticación, rechazo de origen, exclusión de otra sesión, exclusión de mutaciones HTTP, mensajes malformados y rechazo de IDs repetidos sin volver a escribir. Las pruebas del cliente usan sockets controlados para correlación, backpressure y timeout. WebSerial se prueba mediante streams/framing controlados, sin permisos USB reales.

La prueba serie recompone un lote de 4096 muestras desde fragmentos de 128 bytes, preservando el contenido y la secuencia. Esto verifica el transporte del lote; no demuestra que un ADC real lo haya generado a la frecuencia solicitada.

## Pendientes concretos

**El firmware DMA no se compiló con el toolchain de Espressif ni se ejecutó en una placa física en esta sesión.** El código apunta a Arduino-ESP32 3.3.5. No se encontró Arduino CLI instalado. Se entrega una matriz de CI para ESP32, S2, S3, C3 y C6, pero no se ejecutó remotamente. La compilación del EXE de Windows es independiente de la compilación del firmware.

Pendientes: tasa ADC efectiva y precisión temporal, trigger/pretrigger físico, overflow real, coexistencia del driver DMA/oneshot, I²C con sensores y analizador lógico, retiro USB durante captura, permisos y streams WebSerial del navegador real, y guardado nativo sobre carpetas compartidas. El procedimiento por familia está en docs/ARQUITECTURA-0.2.md.

Las tasas 20–80 kS/s son parámetros nominales solicitados, no resultados de benchmark. La simulación de ráfaga es sintética. El enlace 115200/JSON no sostiene streaming continuo a esas tasas. Los subVIs actuales tienen una entrada y una salida. La exportación autónoma se limita a bloques escalares y subVIs escalares.

---

## Registro histórico de 0.1

Lo siguiente documenta la entrega anterior; las cifras y límites actuales son los de los apartados anteriores.

# Validación de la entrega 0.1

Fecha: 20 de septiembre de 2026. Entorno: Windows 11 x64, Python 3.14.3, Node.js 24.14.0. Empaquetado: PyInstaller 6.22.0, pyserial 3.5.

## Resultados automatizados

- **27 pruebas JavaScript aprobadas**, ejecutadas mediante `node --test tests/core.test.mjs`.
- **13 pruebas Python aprobadas**, ejecutadas mediante `python -m unittest discover -s tests -v`.
- Validación de sintaxis de los módulos JavaScript y del servidor Python aprobada.
- Los seis proyectos de ejemplo se ejecutan en simulación bajo los cinco perfiles de placa.
- Cada uno de los 58 tipos de bloque tiene cobertura de ejecución y de generación de código. Esta cobertura del generador comprueba validación/emisión, no compilación de C++.
- Comprobados: aritmética, división por cero, overflow, filtro, PID con anti-windup, realimentación, actualización simultánea de memorias, cancelación, tipos incompatibles, entradas duplicadas/faltantes, esquema, importación/exportación y neutralización de fórmulas CSV.
- Comprobados con mocks de serie: serialización de comandos, validación de pines, límites, handshake de familia, errores del firmware, timeout y cierre de conexión.
- Comprobados sobre HTTP real en un puerto local efímero: HTML/token, MIME de módulos, rutas públicas, bloqueo de rutas fuera de `web/`, Host/Origin no permitidos y autorización de mutaciones.

## Pruebas de interfaz realizadas

En el navegador integrado se verificaron:

- Arranque, carga de la biblioteca y del diagrama predeterminado.
- Ejecución continua de señales; gráfica, indicador y registro actualizados.
- Avance por pasos, incluido contador de realimentación con resultado 2 tras dos pasos.
- Panel frontal y slider PWM: valor 255 aplicado al indicador simulado.
- Creación de un proyecto, inserción de constante e indicador, conexión por puertos.
- La validación cambia de entrada faltante a diagrama válido al conectar.
- Deshacer y rehacer la conexión recuperan ambos estados.
- Crear un proyecto nuevo después de usar instrumentos no produce excepciones.
- Vista Dispositivos y mensaje de desconexión.
- Distribución de escritorio a 1440 × 900 y vista compacta del navegador integrado.
- Sin errores ni advertencias de JavaScript en las comprobaciones finales realizadas.

Durante las pruebas se corrigió una referencia a un indicador eliminado al reiniciar el proyecto y se elevó el zoom mínimo de ajuste para mantener los nodos utilizables en ventanas pequeñas.

## Ejecutable Windows

El portable se generó localmente y se inició sin invocar Python externo. El endpoint `/api/status` devolvió `version: 0.1.0`, `serialInstalled: true` y `arduinoCli: false`. La enumeración real devolvió cero puertos serie disponibles. Los recursos de la interfaz y el firmware están incluidos en el directorio `_internal`.

## Pendiente de validar

- **No se compiló el firmware con Arduino CLI en este entorno**, donde la herramienta y el núcleo Espressif no están instalados.
- **No se cargó ni probó ninguna placa física.** No se verificaron niveles eléctricos, precisión ADC, PWM, I²C ni tiempos reales de watchdog en hardware.
- No se ejecutó el workflow remoto de GitHub Actions ni se publicó un repositorio.
- No se probó la distribución en Windows 10, equipos ARM, Linux o macOS. El código del servidor es portable, pero solo se entrega un binario Windows x64.
- No se realizó certificación, evaluación industrial ni comparación de rendimiento con LabVIEW.

La implementación del firmware utiliza APIs oficiales de Arduino-ESP32 3.x. El workflow incluido define compilación de puente y ejemplo autónomo para las cinco familias; debe ejecutarse y complementarse con pruebas físicas antes de declarar esas rutas validadas en hardware.

## Ampliación del panel y biblioteca

- 40 pruebas automatizadas en total: 27 JavaScript y 13 Python.
- Tipos decimal, entero, booleano y texto, con colores distintos; conversión implícita exclusivamente entero → decimal.
- Cobertura numérica de nuevas funciones, ventanas RMS/media, saturación del integrador, dt de derivada, histéresis, contador, temporizador, estadística poblacional y ruido reproducible.
- Se comprobó visualmente que el diagrama de tipos dibuja cables con cuatro colores diferentes, muestra texto y convierte el entero 42 a texto.
- Se identificó y corrigió la pérdida de posición al dimensionar un instrumento después de moverlo.
- En una instancia de prueba separada se movió un osciloscopio a (20, 15), se dimensionó a 708 × 278 y se comprobó que esos cuatro valores persistían tras recargar.
- El ejemplo Procesamiento ejecutó ruido, media móvil, RMS y estadística en la interfaz sin errores de validación.
- El exportador promueve las entradas enteras a double antes de operar: 7 / 2 produce 3,5 y no división entera. Prueba de regresión incluida.

## Distribucion Linux añadida

Se volvieron a ejecutar las 39 pruebas JavaScript y 20 pruebas Python: todas aprobadas en Windows. Se verificó una instalación offline en un entorno limpio usando exclusivamente los dos wheels incluidos y sus hashes, la sintaxis de cada script shell mediante Bash de Git, la copia de licencias y el smoke test de arranque HTTP/WebSocket con puerto dinámico. El empaquetador comprueba contenido, permisos Unix 755 de los lanzadores y ausencia de CRLF en scripts shell.

No hay WSL instalado ni kernel Linux disponible en este equipo. El tar Linux es una distribución Python con dependencias incluidas; no se presenta como binario ELF probado. Se entrega CI para validar Ubuntu y construir el binario nativo en Linux. Consulta docs/LINUX.md.
