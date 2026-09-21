# FlowLab 0.3: señales, protocolos e instrumentos

La biblioteca contiene 80 tipos: los 70 de 0.2 y diez nuevos. Vector Index conserva el identificador `vectorAt`, por lo que los proyectos anteriores siguen abriendo. Los archivos siguen usando el esquema de proyecto versión 1. El motor, el panel y los transportes son comunes a Windows y Linux.

## Señales por lotes

Conecta `ADC ráfaga DMA → FFT` y, en paralelo, `ADC ráfaga DMA → Waveform Stats → Display multímetro`. La captura se hace en la placa y la FFT se calcula en el navegador una vez recibido el lote. No se promete streaming continuo a la frecuencia del ADC.

- FFT radix-2: 16–4096 muestras, longitud potencia de dos; otras longitudes producen un error explícito. Ventana Hann periódica o rectangular, eliminación opcional de media y espectro unilateral de amplitud pico. Se corrige la ganancia coherente de la ventana; DC y Nyquist no se duplican. No es densidad espectral de potencia ni FFT compleja.
- El panel usa `f[k] = k/(N·dt)` en Hz. La salida del bloque es un vector de magnitudes; `Vector Index` selecciona un bin desde cero. El vector por sí solo no transporta las frecuencias. **Espectro JSON** exporta magnitudes, `df`, `f0`, longitud, ventana, referencia dB, `sourceDt`, `sourceT0` y marca de simulación. Selecciona la FFT deseada para exportarla; sin selección se usa la primera disponible.
- Escala dB: `20·log10(amplitud/referencia)`, con piso de −240 dB. La referencia está en la misma unidad que las muestras. Para trabajar en voltios, escala la waveform antes de FFT; no se interpreta un código ADC como voltaje.
- Waveform Stats: media, RMS total, RMS de la componente AC, desviación estándar poblacional, mínimo, máximo y pico a pico. Usa Welford para la varianza. No cambia `dt` ni el intervalo del bucle.
- La resolución `df` depende de la frecuencia **nominal** de muestreo. La exactitud física, el ruido, el aliasing y la respuesta del acondicionamiento analógico deben caracterizarse con la placa.

El ejemplo **FFT + RMS** captura 1024 muestras a 20 kSa/s nominales. En simulación aparece una señal de 1 kHz. `df=19,53125 Hz`; el bin 51 está en 996,09375 Hz. Con Hann, un tono entre bins reparte energía entre varios; el valor del bin más alto puede ser menor que la amplitud real.

## Decodificación de sensores

`I²C multibyte → Unpack Int16` convierte dos bytes desde un offset 0–30; admite big/little endian y signo opcional. UInt16 cabe dentro de la salida I32. Se rechazan bytes fraccionarios, fuera de 0–255, tramas de más de 32 bytes y offsets sin dos bytes disponibles.

Ejemplo: `[255,156]` big-endian con signo produce −100; multiplicado por 0,01 da −1. El ejemplo **Sensor Int16** utiliza una trama fija para poder ejecutarse sin placa. Sustituye esa fuente por I²C multibyte y usa dirección, registro, escala y orden de bytes indicados por la hoja de datos de tu sensor.

Bitwise Ops admite AND, OR, XOR, NOT, desplazamiento izquierdo y derecho aritmético I32. El desplazamiento exige 0–31; no se reduce silenciosamente módulo 32. NOT ignora la entrada `b`, que debe conectarse a una constante entera 0. Para campos sin signo, selecciona primero UInt16 y aplica la máscara. No existe conversión implícita DBL→I32.

## Periféricos nativos

| Familia | DAC | Touch | PCNT | Tone LEDC |
|---|---|---|---|---|
| ESP32 | GPIO 25, 26 | Sí | Sí | Sí |
| ESP32-S2 | GPIO 17, 18 | Sí | Sí | Sí |
| ESP32-S3 | No | Sí | Sí | Sí |
| ESP32-C3 | No | No | No | Sí |
| ESP32-C6 | No | No | Sí | Sí |

Los perfiles excluyen pines reservados; consulta `boards.json` y el pinout de la placa concreta. La ausencia de un periférico produce un error antes de escribir al puerto. No se sustituye DAC por PWM ni PCNT por polling.

**DAC:** redondea y limita a 0–255. La salida indica el código escrito, no una tensión medida. STOP y watchdog deshabilitan el DAC y dejan GPIO en LOW. Requiere circuito adecuado a la carga.

**PCNT:** cuenta flancos ascendentes durante 10–1000 ms con el driver nativo ESP-IDF. Hay acumulación de desbordamientos con watch points en ambos límites. Devuelve Hz usando la duración medida por `esp_timer`; RPM se calcula como `Hz·60/pulsosPorVuelta`. El filtro opcional se expresa en ns; el driver puede rechazar un valor que no cabe en el hardware. Se libera contador/canal tras cada ventana, incluso ante error. Existen huecos entre ventanas y resolución de aproximadamente `1/ventana` Hz; no es un registro continuo ni un medidor de período para velocidades muy bajas. Las ventanas de varios bloques se ejecutan secuencialmente.

**Touch:** entrega cuentas crudas. En ESP32 normalmente bajan al tocar; en S2/S3 suben. No es capacitancia calibrada. Usa una línea base y un bloque Histéresis para detectar contacto; el umbral se ajusta al electrodo real.

**Tone:** onda cuadrada LEDC al 50 %, frecuencia solicitada de 20–20000 Hz, 0 apaga. La salida es la frecuencia devuelta por el driver. Algunas combinaciones de reloj/frecuencia pueden ser rechazadas. Se admite un Tone por grafo, sin PWM simultáneo para evitar compartir temporizadores. STOP/watchdog detiene y libera LEDC. Para cargas de audio usa la etapa de salida apropiada.

El ejemplo **Periféricos** se adapta a la familia elegida e inicia las salidas DAC/Tone en cero. Selecciona la familia antes de cargar el ejemplo. En simulación PCNT/Touch son señales sintéticas, no modelos eléctricos.

## Panel frontal

- Gráfica XY recibe dos entradas DBL y conserva 16–4096 pares. Une los puntos en orden de adquisición, incluso cuando X retrocede; ambos ejes se autoescalan. Las unidades X/Y son configurables. La salida del bloque es Y para continuar el flujo. El ejemplo **Curva XY** dibuja una elipse de Lissajous; las medidas de curvas I–V requieren adquisición y conversión apropiadas.
- Display multímetro ofrece 0–6 decimales, unidad, prefijos SI automáticos o fijos y `OL` si `|valor|` supera el rango configurado. Es un indicador: no añade medición física de amperios u ohmios al ESP32.
- Ambos instrumentos permiten movimiento y tamaño desde **Editar panel**, con posiciones guardadas en el proyecto. La FFT también aparece como instrumento en el panel frontal.

## Firmware y compatibilidad

Carga el nuevo `firmware/FlowLabBridge` con Arduino-ESP32 **3.3.5** antes de usar DAC/PCNT/Touch/Tone. `hello` anuncia protocolo **3**. El servidor y WebSerial conservan soporte de comandos anteriores en protocolos 1/2; los cuatro comandos nuevos se rechazan si la placa no anuncia 3.

Formato ASCII con ID y LF, respuestas JSON:

| Comando | Argumentos | `value` |
|---|---|---|
| `dac` | pin, código 0–255 | código escrito |
| `touch` | pin | cuentas sin signo |
| `pcnt` | pin, ventana ms 10–1000, filtro ns 0–10000 | Hz, número decimal |
| `tone` | pin, frecuencia 0 o 20–20000 | frecuencia aplicada; 0 apagado |

Ejemplos: `10 dac 25 128`, `11 touch 4`, `12 pcnt 27 100 0`, `13 tone 26 440`, `14 stop`. Los comandos no compatibles y conflictos se rechazan también dentro del firmware. Los nuevos comandos no se reintentan automáticamente. STOP espera a que finalice una operación finita en curso.

La exportación autónoma admite Bitwise Ops, Display multímetro y XY (sus valores se imprimen por serie). FFT, datos por lotes y los cuatro periféricos nuevos requieren el motor conectado: el exportador lo explica y no genera un sketch incompleto. Los controles exportados quedan fijos, igual que en 0.2.

Referencias de implementación: [DAC de Arduino-ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/dac.html), [Touch](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/touch.html), [LEDC](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ledc.html), [PCNT de ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/v5.5.1/esp32/api-reference/peripherals/pcnt.html). Compilar no sustituye la caracterización física; ver `VALIDACION.md`.
