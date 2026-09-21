# Protocolo FlowLab 0.3

El firmware actual anuncia protocolo **3**; añade `dac`, `touch`, `pcnt` y `tone`. Formato, rangos y compatibilidad: [PAQUETE-0.3.md](PAQUETE-0.3.md). Conserva burst e I²C multibyte del protocolo 2. El parser actual acepta 511 caracteres y 36 argumentos; los límites de protocolo 1 descritos debajo son históricos.

# Protocolo FlowLab 0.2

El firmware 0.2 anuncia protocolo **2**. Los comandos escalares siguientes se conservan por compatibilidad con 0.1. WebSocket, ráfagas y transacciones I²C nuevas están especificados en [ARQUITECTURA-0.2.md](ARQUITECTURA-0.2.md). La API HTTP antigua no se usa en el bucle del editor y queda bloqueada para mutaciones si una sesión WebSocket posee el dispositivo.

# Protocolo FlowLab 1

## Transporte

115200 baudios, 8N1, líneas terminadas en LF, caracteres ASCII para peticiones. Una petición en vuelo por conexión. El servidor utiliza un candado reentrante: compilación, carga, conexión y comandos no se superponen.

Petición: `<id> <comando> [enteros...]\n`. ID positivo, argumentos decimales; sin expresiones, nombres de archivos, shells ni comandos libres. El firmware permite hasta 159 caracteres por línea y cuatro argumentos. Descarta una línea desbordada hasta el siguiente LF. El parser rechaza argumentos incompletos/no numéricos.

Respuesta correcta:

```json
{"id": 10, "ok": true, "value": 2048}
```

Error:

```json
{"id": 10, "ok": false, "error": "Invalid ADC pin/mode or pin busy"}
```

El servidor ignora mensajes de boot y respuestas con otro ID. Espera hasta 2,5 segundos por respuesta y cierra la conexión si vence el plazo. No reintenta automáticamente escrituras. Después de abrir el puerto espera 1,8 segundos, limpia la entrada y envía `hello`.

## Comandos

| Comando | Argumentos | Respuesta `value` |
|---|---|---|
| `hello` | — | Objeto `protocol:1`, `family`, `chip`, `watchdogMs:2000` |
| `ping` | — | `millis()`; también verifica que el watchdog no esté bloqueado |
| `stop` | — | 0; baja GPIO/PWM, libera estado de pines/I²C y rearma el watchdog |
| `adc` | GPIO, modo 0=raw/1=mV | Valor ADC |
| `read` | GPIO, pull 0=ninguno/1=up/2=down | 0 o 1 |
| `write` | GPIO, 0/1 | Valor escrito |
| `pwm` | GPIO, duty 0–255, Hz 100–20000 | Duty escrito; hardware puede rechazar combinaciones no realizables |
| `i2c` | SDA, SCL | 0; configura bus a 100 kHz |
| `scan` | — | Array de direcciones que respondieron |
| `i2cread` | Dirección 8–119, registro 0–255 | Byte leído |
| `i2cwrite` | Dirección 8–119, registro 0–255, valor 0–255 | Byte escrito |

Ejemplo de conversación:

```text
1 hello
{"id":1,"ok":true,"value":{"protocol":2,"family":"esp32","chip":"ESP32-D0WDQ6","watchdogMs":2000}}
2 stop
{"id":2,"ok":true,"value":0}
3 adc 34 0
{"id":3,"ok":true,"value":2048}
4 pwm 25 128 1000
{"id":4,"ok":true,"value":128}
5 stop
{"id":5,"ok":true,"value":0}
```

Los valores son ilustrativos, no una captura de hardware real. La familia informada procede del objetivo de compilación. En modo puente el firmware conoce el perfil del chip, no el modelo comercial exacto de la placa.

## Propiedad de pines y watchdog

El primer uso de un pin establece su función hasta `stop`. Reutilizarlo en una función diferente es un error. Cambiar frecuencia PWM sin detener es un error; así se evita modificar por sorpresa temporizadores compartidos. El grafo se valida además para rechazar dos bloques sobre un mismo GPIO: distribuye una lectura mediante múltiples conexiones de salida.

Un `write` o `pwm` arma el watchdog. Cualquier comando válido actualiza el tiempo de actividad. Si transcurren más de 2000 ms sin comando válido, el firmware baja las salidas y bloquea las operaciones. `stop` libera ese bloqueo. El bucle UART procesa un número acotado de caracteres por iteración para no impedir la comprobación del watchdog. Los comandos I²C usan timeout, pero operaciones del hardware o firmware que bloqueen completamente la CPU no están cubiertas por este watchdog de software.

## API HTTP local

El servidor se enlaza exclusivamente a `127.0.0.1`. Rechaza Host y Origin ajenos; las mutaciones requieren `X-FlowLab-Token`, generado en cada arranque e insertado en el HTML de ese servidor. No se habilita CORS. Las peticiones JSON están limitadas a 64 KiB. Los archivos estáticos se resuelven solamente dentro de `web/` y hay una ruta específica para leer el sketch.

| Método / ruta | Uso |
|---|---|
| GET `/api/status` | Versión, dependencia serie, Arduino CLI, estado de conexión |
| GET `/api/ports` | Puertos enumerados por pyserial |
| GET `/api/job` | Estado y log del último trabajo Arduino CLI |
| POST `/api/connect` | `{ "port":"COM5", "board":"esp32" }` |
| POST `/api/disconnect` | `{}` |
| POST `/api/command` | `{ "command":"adc", "args":{ "pin":34,"mode":"raw" } }` |
| POST `/api/toolchain` | `{ "action":"compile"/"upload", "board":"esp32", "port":"COM5" }` |

Un solo trabajo de compilación/carga a la vez, en un hilo independiente. El proceso Arduino CLI recibe una lista de argumentos sin shell; las acciones y FQBN se seleccionan de listas permitidas. La aplicación no descarga herramientas ni carga una placa automáticamente al abrirse.

El token protege frente a solicitudes de otras páginas; no sustituye aislamiento de usuarios o procesos locales. La aplicación está diseñada para una instancia local y un operador. No es un servidor multiusuario ni está preparada para exponerse a Internet.
