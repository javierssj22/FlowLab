# 0.3.0 — 2026-09-21

- Diez nuevos tipos de bloque, 80 en total; Vector Index conserva compatibilidad.
- FFT calibrada por ventana, estadísticas de waveform, Int16 y operaciones I32.
- Protocolo 3 con DAC, PCNT, Touch y Tone por capacidades de familia.
- Panel XY, multímetro y espectro con exportación JSON.
- Cuatro ejemplos, documentación y paquetes Windows/Linux actualizados.
- 50 pruebas JavaScript y 24 Python aprobadas localmente; la validación física sigue pendiente.

# Distribucion Linux de 0.2 — 2026-09-20

- Instalador local con venv, wheels universales y comprobacion SHA-256, sin acceso a PyPI.
- Lanzadores Linux para WebSocket/pyserial y frontend WebSerial.
- Scripts de compilacion nativa y empaquetado tar con permisos Unix.
- CI Windows/Ubuntu y workflow manual para binario Linux x86_64.
- Guia de permisos USB y alcance de la validacion.

# 0.2.0 — 2026-09-20

- Transporte WebSocket autenticado, sesión exclusiva y backpressure.
- WebSerial directo y lanzador estático sin Python.
- Protocolo 2: ADC continuo DMA, disparo, pretrigger y tramas I²C TX/RX.
- Vector y Waveform con dt/t0, gráfico y procesamiento por lotes; 70 tipos en total.
- SubVIs de una entrada/salida, estado por instancia y exportación escalar.
- Archivos de proyecto explícitos con escritura transaccional y detección de conflictos.
- Compatibilidad de importación de proyectos 0.1 y recuperación manual de localStorage.
- Firmware DMA pendiente de compilación y caracterización física; véase VALIDACION.md.

# Cambios

## 0.1.0 — 2026-09-20

Primera entrega: editor de bloques, runtime de flujo de datos con memoria, 58 tipos de bloque, panel frontal editable de instrumentos, CSV y proyectos JSON, cinco perfiles ESP32, puente serie, firmware abierto, integración Arduino CLI, exportador Arduino, portable Windows, ejemplos y pruebas.

Alcance y pendientes detallados en README.md. Evidencia de pruebas en VALIDACION.md.

Ampliaciones: colores por tipo (DBL/I32/BOOL/STRING), controles e indicadores de texto, conversión explícita, diseño de panel por arrastre y tamaño, 24 bloques adicionales de matemática, lógica, temporización y procesamiento.
