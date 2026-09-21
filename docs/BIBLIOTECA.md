# Biblioteca de FlowLab

80 tipos de bloque. El exportador Arduino admite los 58 bloques escalares originales, Bitwise Ops, XY, Display multímetro y subVIs escalares; los bloques de lotes y DAC/PCNT/Touch/Tone requieren el motor conectado. Guía: [PAQUETE-0.3.md](PAQUETE-0.3.md). Los terminales IN/OUT se utilizan dentro de módulos. Los bloques ESP32 realizan operaciones de hardware solo en modo Hardware. La validación del generador no sustituye la compilación y prueba física.

## Tipos y colores

| Tipo | Color | Conexión |
|---|---|---|
| Decimal / DBL | Naranja | Entradas numéricas |
| Entero / I32 | Azul | Entradas enteras o decimales |
| Booleano / BOOL | Verde | Entradas booleanas |
| Texto / STRING | Rosa | Entradas de texto |
| Vector / DBL[] | Violeta | Entradas vectoriales |
| Waveform / Y/dt | Cian | Entradas waveform |

La posición del bloque no determina el orden de ejecución: lo determinan sus conexiones. Los ciclos necesitan memoria. Los bloques con estado se reinician en cada ejecución nueva.

## Señales

### FFT · espectro

FFT radix-2 de 16–4096 muestras. Espectro unilateral de amplitud pico; el panel usa Hz. Salida vector para Vector Index.

- Identificador: `fft`
- Entradas: `in` (Waveform · Y/dt)
- Salida: Vector · DBL[]
- Parámetros: `window` — Ventana; valor inicial: "hann"; opciones: hann, rectangular; `removeMean` — Eliminar DC; valor inicial: "yes"; opciones: yes, no; `scale` — Escala; valor inicial: "amplitude"; opciones: amplitude, dB; `reference` — Referencia dB; valor inicial: 1; rango: 1e-12 a 1000000000000.

### Waveform Stats

Estadística de todas las muestras; RMS total o componente AC, desviación poblacional y pico a pico.

- Identificador: `waveformStats`
- Entradas: `in` (Waveform · Y/dt)
- Salida: Decimal · DBL
- Parámetros: `mode` — Estadística; valor inicial: "rms"; opciones: mean, rms, acRms, stddev, min, max, peakToPeak.

## Protocolos

### Unpack Int16

Decodifica dos bytes I²C como Int16 o UInt16, con offset y endianness explícitos.

- Identificador: `unpackInt16`
- Entradas: `in` (Vector · DBL[])
- Salida: Entero · I32
- Parámetros: `offset` — Offset de byte; valor inicial: 0; rango: 0 a 30; `endian` — Orden de bytes; valor inicial: "big"; opciones: big, little; `signed` — Con signo; valor inicial: "yes"; opciones: yes, no.

### Bitwise Ops

Operaciones I32 a nivel de bits. NOT ignora b; conecta 0. Desplazamientos de 0–31 bits; SHR conserva signo.

- Identificador: `bitwise`
- Entradas: `a` (Entero · I32), `b` (Entero · I32)
- Salida: Entero · I32
- Parámetros: `op` — Operación; valor inicial: "and"; opciones: and, or, xor, not, shl, shr.

## ESP32

### ESP32 · DAC

Salida DAC nativa 8-bit: redondea y limita a 0–255. Solo ESP32/S2; STOP deshabilita el DAC y lleva GPIO a LOW.

- Identificador: `dac`
- Entradas: `in` (Decimal · DBL)
- Salida: Entero · I32
- Parámetros: `pin` — GPIO DAC; valor inicial: 25; rango: 0 a 54.

### ESP32 · PCNT tacómetro

Cuenta flancos ascendentes con PCNT durante una ventana finita y calcula Hz/RPM. No disponible en ESP32-C3; hay huecos entre ventanas.

- Identificador: `pcnt`
- Entradas: ninguna
- Salida: Decimal · DBL
- Parámetros: `pin` — GPIO de pulsos; valor inicial: 27; rango: 0 a 54; `gateMs` — Ventana · ms; valor inicial: 100; rango: 10 a 1000; `ppr` — Pulsos por vuelta; valor inicial: 1; rango: 1 a 10000; `mode` — Salida; valor inicial: "rpm"; opciones: rpm, Hz; `filterNs` — Filtro de glitches · ns (0 = sin filtro); valor inicial: 0; rango: 0 a 10000.

### ESP32 · Touch

Lectura capacitiva cruda, no un booleano ni una capacitancia calibrada. ESP32/S2/S3; la dirección del cambio depende de la familia.

- Identificador: `touch`
- Entradas: ninguna
- Salida: Decimal · DBL
- Parámetros: `pin` — GPIO táctil; valor inicial: 4; rango: 0 a 54.

### ESP32 · Tone

Tono cuadrado LEDC al 50 %. Entrada 20–20000 Hz, 0 apaga. Un Tone por grafo y sin PWM simultáneo para evitar temporizadores compartidos.

- Identificador: `tone`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `pin` — GPIO de salida; valor inicial: 25; rango: 0 a 54.

### ESP32 · ADC ráfaga DMA

Captura en DMA y luego transfiere; protocolo 2. Sin salidas activas. Tasa pendiente de caracterizar en hardware.

- Identificador: `adcBurst`
- Entradas: ninguna
- Salida: Waveform · Y/dt
- Parámetros: `pin` — GPIO ADC1; valor inicial: 34; rango: 0 a 54; `rate` — Muestreo nominal · Hz; valor inicial: 20000; rango: 20000 a 80000; `count` — Muestras; valor inicial: 1024; rango: 16 a 4096; `trigger` — Disparo; valor inicial: "immediate"; opciones: immediate, rising, falling; `level` — Nivel ADC del disparo; valor inicial: 2048; rango: 0 a 4095; `pre` — Muestras antes del disparo; valor inicial: 0; rango: 0 a 4095; `timeout` — Timeout · ms; valor inicial: 2000; rango: 100 a 5000.

### ESP32 · I²C multibyte

Escribe hasta 32 bytes y lee hasta 32 en una transacción; vector vacío permite lectura directa.

- Identificador: `i2cTransfer`
- Entradas: `tx` (Vector · DBL[])
- Salida: Vector · DBL[]
- Parámetros: `address` — Dirección decimal; valor inicial: 72; rango: 8 a 119; `readCount` — Bytes a leer; valor inicial: 2; rango: 0 a 32; `stop` — Entre escritura y lectura; valor inicial: "repeated-start"; opciones: repeated-start, stop.

### ESP32 · ADC

Lee ADC de 12 bits o milivoltios calibrados por Arduino.

- Identificador: `adc`
- Entradas: ninguna
- Salida: Entero · I32
- Parámetros: `pin` — GPIO; valor inicial: 34; rango: 0 a 54; `mode` — Lectura; valor inicial: "raw"; opciones: raw, millivolts.

### ESP32 · Entrada digital

Lee GPIO con resistencia interna opcional.

- Identificador: `digitalRead`
- Entradas: ninguna
- Salida: Booleano · BOOL
- Parámetros: `pin` — GPIO; valor inicial: 27; rango: 0 a 54; `pull` — Resistencia; valor inicial: "none"; opciones: none, up, down.

### ESP32 · Salida digital

Escribe HIGH o LOW. En simulación no toca el hardware.

- Identificador: `digitalWrite`
- Entradas: `in` (Booleano · BOOL)
- Salida: Booleano · BOOL
- Parámetros: `pin` — GPIO; valor inicial: 25; rango: 0 a 54.

### ESP32 · PWM

PWM LEDC de 8 bits; entrada limitada y redondeada a 0–255.

- Identificador: `pwm`
- Entradas: `in` (Decimal · DBL)
- Salida: Entero · I32
- Parámetros: `pin` — GPIO; valor inicial: 26; rango: 0 a 54; `frequency` — Frecuencia · Hz; valor inicial: 1000; rango: 100 a 20000.

### ESP32 · I²C leer

Lee un registro de 8 bits del bus I²C configurado.

- Identificador: `i2cRead`
- Entradas: ninguna
- Salida: Entero · I32
- Parámetros: `address` — Dirección decimal; valor inicial: 72; rango: 8 a 119; `register` — Registro; valor inicial: 0; rango: 0 a 255.

### ESP32 · I²C escribir

Escribe un registro de 8 bits; entrada limitada a 0–255.

- Identificador: `i2cWrite`
- Entradas: `in` (Decimal · DBL)
- Salida: Entero · I32
- Parámetros: `address` — Dirección decimal; valor inicial: 72; rango: 8 a 119; `register` — Registro; valor inicial: 0; rango: 0 a 255.

## Instrumentos

### Gráfica XY

Grafica pares (x,y) en orden de adquisición, incluso X decreciente. Conserva hasta N pares; salida y.

- Identificador: `xyChart`
- Entradas: `x` (Decimal · DBL), `y` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `xUnit` — Unidad X; valor inicial: "V"; `yUnit` — Unidad Y; valor inicial: "mA"; `points` — Puntos conservados; valor inicial: 600; rango: 16 a 4096.

### Display multímetro

Indicador con prefijos SI, signo y OL fuera de rango. Muestra la magnitud recibida; no mide corriente/resistencia sin el circuito y conversión adecuados.

- Identificador: `multimeter`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `unit` — Unidad física; valor inicial: "V"; `digits` — Decimales; valor inicial: 4; rango: 0 a 6; `range` — Rango absoluto en unidad base; valor inicial: 1000; rango: 1e-12 a 1000000000000; `prefix` — Prefijo SI; valor inicial: "auto"; opciones: auto, fixed.

### Gráfico de waveform

Representa el lote completo con el eje temporal definido por dt y t0.

- Identificador: `waveformChart`
- Entradas: `in` (Waveform · Y/dt)
- Salida: Waveform · Y/dt

### Osciloscopio

Traza temporal. Conserva las últimas 600 muestras en pantalla.

- Identificador: `chart`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `unit` — Unidad; valor inicial: "V".

### Indicador numérico

Lectura numérica e indicador de rango en el panel frontal.

- Identificador: `gauge`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `unit` — Unidad; valor inicial: "V"; `min` — Mínimo; valor inicial: 0; rango: -1000000000 a 1000000000; `max` — Máximo; valor inicial: 5; rango: -1000000000 a 1000000000.

### LED de estado

Indicador booleano en el panel frontal.

- Identificador: `led`
- Entradas: `in` (Booleano · BOOL)
- Salida: Booleano · BOOL

### Indicador de texto

Muestra texto en el panel frontal.

- Identificador: `textIndicator`
- Entradas: `in` (Texto · STRING)
- Salida: Texto · STRING

### Registro de datos

Registra tiempo y valor. Exportación CSV desde la barra inferior.

- Identificador: `log`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `unit` — Unidad; valor inicial: "".

## Lotes

### Vector numérico

Arreglo de hasta 4096 números finitos.

- Identificador: `vector`
- Entradas: ninguna
- Salida: Vector · DBL[]
- Parámetros: `values` — Arreglo JSON; valor inicial: "[1,2,3,4]".

### Construir waveform

Agrega un intervalo de muestreo uniforme y origen temporal al vector.

- Identificador: `makeWaveform`
- Entradas: `in` (Vector · DBL[])
- Salida: Waveform · Y/dt
- Parámetros: `dt` — dt · segundos; valor inicial: 0.001; rango: 1e-9 a 86400; `t0` — t0 · segundos; valor inicial: 0; rango: -1000000000 a 1000000000.

### Extraer muestras

Extrae las muestras de una waveform.

- Identificador: `waveformSamples`
- Entradas: `in` (Waveform · Y/dt)
- Salida: Vector · DBL[]

### Escalar waveform

Escala todas las muestras preservando dt, t0 y metadatos.

- Identificador: `waveformScale`
- Entradas: `in` (Waveform · Y/dt)
- Salida: Waveform · Y/dt
- Parámetros: `gain` — Ganancia; valor inicial: 1; rango: -1000000000 a 1000000000; `offset` — Offset; valor inicial: 0; rango: -1000000000 a 1000000000.

### Estadística de vector

Procesa el bloque completo; rechaza vectores vacíos.

- Identificador: `vectorStat`
- Entradas: `in` (Vector · DBL[])
- Salida: Decimal · DBL
- Parámetros: `mode` — Operación; valor inicial: "mean"; opciones: mean, rms, min, max.

### Vector Index · Índice de vector

Lee un elemento desde índice cero; falla si está fuera del vector. Compatible con proyectos 0.2.

- Identificador: `vectorAt`
- Entradas: `in` (Vector · DBL[])
- Salida: Decimal · DBL
- Parámetros: `index` — Índice; valor inicial: 0; rango: 0 a 4095.

## Módulos

### Subdiagrama

Módulo embebido con una entrada y una salida tipadas. Cada instancia conserva su propio estado.

- Identificador: `subvi`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `inputType` — Tipo de entrada; valor inicial: "number"; opciones: number, integer, boolean, string, vector, waveform; `outputType` — Tipo de salida; valor inicial: "number"; opciones: number, integer, boolean, string, vector, waveform.

### Entrada del subdiagrama

Terminal de entrada de un subdiagrama; no es una fuente independiente.

- Identificador: `subInput`
- Entradas: ninguna
- Salida: Decimal · DBL
- Parámetros: `kind` — Tipo; valor inicial: "number"; opciones: number, integer, boolean, string, vector, waveform.

### Salida del subdiagrama

Terminal único de salida del subdiagrama.

- Identificador: `subOutput`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `kind` — Tipo; valor inicial: "number"; opciones: number, integer, boolean, string, vector, waveform.

## Fuentes

### Constante

Un valor numérico fijo.

- Identificador: `constant`
- Entradas: ninguna
- Salida: Decimal · DBL
- Parámetros: `value` — Valor; valor inicial: 1; rango: -1000000000 a 1000000000.

### Control deslizante

Valor ajustable en vivo desde el panel frontal.

- Identificador: `slider`
- Entradas: ninguna
- Salida: Decimal · DBL
- Parámetros: `value` — Valor; valor inicial: 1; rango: -1000000000 a 1000000000; `min` — Mínimo; valor inicial: 0; rango: -1000000000 a 1000000000; `max` — Máximo; valor inicial: 10; rango: -1000000000 a 1000000000.

### Interruptor

Control booleano ajustable en vivo.

- Identificador: `toggle`
- Entradas: ninguna
- Salida: Booleano · BOOL
- Parámetros: `value` — Estado; valor inicial: "0"; opciones: 0, 1.

### Generador de señal

Señal calculada con el tiempo real transcurrido.

- Identificador: `signal`
- Entradas: ninguna
- Salida: Decimal · DBL
- Parámetros: `wave` — Forma; valor inicial: "sine"; opciones: sine, square, triangle, saw; `frequency` — Frecuencia · Hz; valor inicial: 0.5; rango: 0 a 1000; `amplitude` — Amplitud; valor inicial: 1; rango: 0 a 1000000000; `offset` — Offset; valor inicial: 0; rango: -1000000000 a 1000000000; `phase` — Fase · rad; valor inicial: 0; rango: -1000000000 a 1000000000.

### Tiempo

Segundos desde el inicio de la ejecución.

- Identificador: `time`
- Entradas: ninguna
- Salida: Decimal · DBL

### Constante entera

Entero con signo de 32 bits. Puede alimentar entradas decimales.

- Identificador: `integer`
- Entradas: ninguna
- Salida: Entero · I32
- Parámetros: `value` — Valor entero; valor inicial: 1; rango: -2147483648 a 2147483647.

### Control de texto

Cadena de texto editable en vivo desde el panel frontal.

- Identificador: `text`
- Entradas: ninguna
- Salida: Texto · STRING
- Parámetros: `value` — Texto; valor inicial: "Hola, ESP32".

### Reloj de pulsos

Señal booleana periódica; el período de muestreo debe resolver sus flancos.

- Identificador: `pulse`
- Entradas: ninguna
- Salida: Booleano · BOOL
- Parámetros: `period` — Período · s; valor inicial: 1; rango: 0.02 a 86400; `duty` — Ciclo activo · %; valor inicial: 50; rango: 0 a 100; `phase` — Desfase · s; valor inicial: 0; rango: 0 a 86400.

### Ruido uniforme

PRNG xorshift32 reproducible en simulación y Arduino. No criptográfico.

- Identificador: `random`
- Entradas: ninguna
- Salida: Decimal · DBL
- Parámetros: `min` — Mínimo; valor inicial: -1; rango: -1000000000 a 1000000000; `max` — Máximo; valor inicial: 1; rango: -1000000000 a 1000000000; `seed` — Semilla; valor inicial: 12345; rango: 1 a 4294967295.

## Matemática

### Suma

a + b

- Identificador: `add`
- Entradas: `a` (Decimal · DBL), `b` (Decimal · DBL)
- Salida: Decimal · DBL

### Resta

a − b

- Identificador: `subtract`
- Entradas: `a` (Decimal · DBL), `b` (Decimal · DBL)
- Salida: Decimal · DBL

### Multiplicación

a × b

- Identificador: `multiply`
- Entradas: `a` (Decimal · DBL), `b` (Decimal · DBL)
- Salida: Decimal · DBL

### División

a / b. La división por cero detiene el flujo.

- Identificador: `divide`
- Entradas: `a` (Decimal · DBL), `b` (Decimal · DBL)
- Salida: Decimal · DBL

### Escalar rango

Transformación lineal entre dos rangos; no limita valores.

- Identificador: `map`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `inMin` — Entrada mínima; valor inicial: 0; rango: -1000000000 a 1000000000; `inMax` — Entrada máxima; valor inicial: 4095; rango: -1000000000 a 1000000000; `outMin` — Salida mínima; valor inicial: 0; rango: -1000000000 a 1000000000; `outMax` — Salida máxima; valor inicial: 3.3; rango: -1000000000 a 1000000000.

### Limitar

Satura la entrada al intervalo indicado.

- Identificador: `clamp`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `min` — Mínimo; valor inicial: 0; rango: -1000000000 a 1000000000; `max` — Máximo; valor inicial: 1; rango: -1000000000 a 1000000000.

### Valor absoluto

Magnitud absoluta de una entrada numérica.

- Identificador: `abs`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL

### Potencia

Base elevada al exponente. Los resultados no finitos detienen el flujo.

- Identificador: `power`
- Entradas: `base` (Decimal · DBL), `exponent` (Decimal · DBL)
- Salida: Decimal · DBL

### Raíz cuadrada

Raíz cuadrada; requiere entrada no negativa.

- Identificador: `sqrt`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL

### Resto

Resto con signo de a; rechaza divisor cero.

- Identificador: `modulo`
- Entradas: `a` (Decimal · DBL), `b` (Decimal · DBL)
- Salida: Decimal · DBL

### Redondear

Redondeo al más próximo (empates hacia +∞), piso, techo o truncamiento.

- Identificador: `round`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `mode` — Método; valor inicial: "nearest"; opciones: nearest, floor, ceil, trunc.

### Trigonometría

Funciones directas e inversas. asin/acos requieren una entrada entre −1 y 1.

- Identificador: `trig`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `fn` — Función; valor inicial: "sin"; opciones: sin, cos, tan, asin, acos, atan; `unit` — Unidad angular; valor inicial: "radians"; opciones: radians, degrees.

### Logaritmo

Logaritmo natural, decimal o binario. Requiere un valor mayor que cero.

- Identificador: `logarithm`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `base` — Base; valor inicial: "natural"; opciones: natural, 10, 2.

### Exponencial

e elevado a la entrada. Detecta desbordamiento.

- Identificador: `exponential`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL

### Mínimo / máximo

Selecciona el menor o mayor de dos números.

- Identificador: `minmax`
- Entradas: `a` (Decimal · DBL), `b` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `mode` — Operación; valor inicial: "min"; opciones: min, max.

## Lógica

### Comparador

Compara dos números y produce verdadero o falso.

- Identificador: `compare`
- Entradas: `a` (Decimal · DBL), `b` (Decimal · DBL)
- Salida: Booleano · BOOL
- Parámetros: `op` — Operador; valor inicial: ">"; opciones: >, <, >=, <=, ==, !=.

### AND

Verdadero cuando ambas entradas son verdaderas.

- Identificador: `and`
- Entradas: `a` (Booleano · BOOL), `b` (Booleano · BOOL)
- Salida: Booleano · BOOL

### NOT

Invierte una señal booleana.

- Identificador: `not`
- Entradas: `in` (Booleano · BOOL)
- Salida: Booleano · BOOL

### Selector

Selecciona yes o no según la entrada if.

- Identificador: `select`
- Entradas: `if` (Booleano · BOOL), `yes` (Decimal · DBL), `no` (Decimal · DBL)
- Salida: Decimal · DBL

### OR

Verdadero si al menos una entrada es verdadera.

- Identificador: `or`
- Entradas: `a` (Booleano · BOOL), `b` (Booleano · BOOL)
- Salida: Booleano · BOOL

### XOR

Verdadero cuando las entradas son distintas.

- Identificador: `xor`
- Entradas: `a` (Booleano · BOOL), `b` (Booleano · BOOL)
- Salida: Booleano · BOOL

## Texto y conversión

### Concatenar texto

Une dos cadenas; máximo 4096 caracteres de salida.

- Identificador: `concat`
- Entradas: `a` (Texto · STRING), `b` (Texto · STRING)
- Salida: Texto · STRING

### Número a texto

Convierte un número a texto con seis decimales.

- Identificador: `toText`
- Entradas: `in` (Decimal · DBL)
- Salida: Texto · STRING

### Convertir a entero

Trunca hacia cero y limita al rango de entero de 32 bits.

- Identificador: `toInteger`
- Entradas: `in` (Decimal · DBL)
- Salida: Entero · I32

### Booleano a número

Convierte falso a 0 y verdadero a 1.

- Identificador: `boolToNumber`
- Entradas: `in` (Booleano · BOOL)
- Salida: Entero · I32

### Longitud de texto

Cantidad de bytes UTF-8, coherente con String de Arduino.

- Identificador: `length`
- Entradas: `in` (Texto · STRING)
- Salida: Entero · I32

## Procesamiento

### Media móvil

Promedio de las últimas N muestras; durante el inicio usa las disponibles.

- Identificador: `movingAverage`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `window` — Ventana · muestras; valor inicial: 20; rango: 1 a 256.

### RMS móvil

Raíz de la media de cuadrados de las últimas N muestras.

- Identificador: `rms`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `window` — Ventana · muestras; valor inicial: 20; rango: 1 a 256.

### Derivada

Diferencia entre muestras dividida por dt; primera salida cero. Sensible al ruido.

- Identificador: `derivative`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL

### Integrador

Integral rectangular con paso real y límites de saturación.

- Identificador: `integrator`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `initial` — Estado inicial; valor inicial: 0; rango: -1000000000 a 1000000000; `min` — Límite inferior; valor inicial: -1000000; rango: -1000000000 a 1000000000; `max` — Límite superior; valor inicial: 1000000; rango: -1000000000 a 1000000000.

### Estadística acumulada

Media, mínimo, máximo o desviación estándar poblacional desde el inicio; algoritmo de Welford.

- Identificador: `runningStat`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `mode` — Estadística; valor inicial: "mean"; opciones: mean, min, max, stddev.

## Control

### Histéresis

Activa al alcanzar high; desactiva al caer hasta low; inicia apagado.

- Identificador: `hysteresis`
- Entradas: `in` (Decimal · DBL)
- Salida: Booleano · BOOL
- Parámetros: `low` — Umbral inferior; valor inicial: 1; rango: -1000000000 a 1000000000; `high` — Umbral superior; valor inicial: 2; rango: -1000000000 a 1000000000.

### Detector de flanco

Pulso de un ciclo ante transición. El estado previo inicial es falso.

- Identificador: `edge`
- Entradas: `in` (Booleano · BOOL)
- Salida: Booleano · BOOL
- Parámetros: `mode` — Flanco; valor inicial: "rising"; opciones: rising, falling, both.

### Contador de eventos

Cuenta flancos ascendentes; reset tiene prioridad. Saturación en 2147483647.

- Identificador: `counter`
- Entradas: `in` (Booleano · BOOL), `reset` (Booleano · BOOL)
- Salida: Entero · I32

### Retardo a la conexión

Requiere entrada verdadera continua durante el tiempo configurado. Falso reinicia el temporizador.

- Identificador: `onDelay`
- Entradas: `in` (Booleano · BOOL)
- Salida: Booleano · BOOL
- Parámetros: `duration` — Retardo · s; valor inicial: 1; rango: 0 a 86400.

### Filtro paso bajo

Filtro de primer orden con paso de tiempo real.

- Identificador: `filter`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `tau` — Constante de tiempo · s; valor inicial: 0.25; rango: 0.001 a 3600.

### Controlador PID

PID discreto con anti-windup condicional y derivada sobre medición.

- Identificador: `pid`
- Entradas: `set` (Decimal · DBL), `pv` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `kp` — Kp; valor inicial: 1; rango: -1000000000 a 1000000000; `ki` — Ki; valor inicial: 0; rango: -1000000000 a 1000000000; `kd` — Kd; valor inicial: 0; rango: -1000000000 a 1000000000; `min` — Salida mínima; valor inicial: 0; rango: -1000000000 a 1000000000; `max` — Salida máxima; valor inicial: 255; rango: -1000000000 a 1000000000.

### Memoria de un ciclo

Entrega el valor del ciclo anterior; permite realimentación.

- Identificador: `delay`
- Entradas: `in` (Decimal · DBL)
- Salida: Decimal · DBL
- Parámetros: `initial` — Valor inicial; valor inicial: 0; rango: -1000000000 a 1000000000.

## Detalles de ejecución

El contador cuenta flancos, no ciclos verdaderos. El retardo TON suma dt mientras la entrada permanece verdadera; el primer ciclo verdadero cuenta como un intervalo de muestreo. Las ventanas móviles usan solo las muestras disponibles durante el arranque. RMS calcula sqrt(media(x²)). La desviación estándar es poblacional (división por N). Derivada y estadísticas no incorporan filtrado adicional.

La suma de ventanas y la integral pueden producir valores no finitos con entradas extremas: en ese caso el motor informa error y detiene el flujo. Usa escalado y límites acordes a tu señal. En Arduino las ventanas se almacenan en arrays de tamaño fijo por bloque; considera la RAM disponible al exportar grafos grandes. El exportador no calcula un presupuesto de memoria de la placa.
