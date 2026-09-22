# FlowLab 0.4.1 · escritorio centrado en el experimento

Esta entrega implementa el rediseño de interfaz para Windows y Linux sobre el motor funcional 0.3. Los proyectos JSON existentes conservan su formato, sus 80 tipos de bloque, colores por tipo y protocolo 3. No hace falta volver a cargar el firmware para usar la nueva interfaz.

## Armar

La barra superior reúne Diagrama / Panel Frontal, Simulación / ESP32 Hardware, Ejecutar / Detener y Proyecto. El lienzo ocupa el espacio restante. La biblioteca permanente, monitor inferior, pie de estados y lista fija de ejemplos se retiraron.

Con el foco sobre el diagrama, pulsa Espacio o `/`, haz doble clic o clic derecho sobre el fondo, o pulsa ＋ Bloque. El buscador aparece junto al cursor. Busca por nombre, grupo, descripción o alias como «osciloscopio», «analógico entrada» o «suma». Ignora diferencias de acentos. Usa ↑/↓ y Enter, o el mouse. Esc o un clic fuera cierra sin insertar. Se muestran seis filas a la vez; el resto se recorre con teclado o desplazamiento.

La posición de inserción se calcula antes de desplazar el buscador para que quepa en la pantalla. Insertar crea un único paso de deshacer y no conecta cables automáticamente. Los atajos no interceptan escritura, controles, teclas modificadoras ni composición IME.

Al seleccionar un bloque aparece una tarjeta de parámetros. × la cierra conservando la selección; volver a pulsar el bloque la abre. Pulsar el fondo quita la selección. Una conexión seleccionada muestra su acción de eliminación. Los cables conservan sus seis colores y los terminales indican sus tipos con texto.

## Medir

Panel Frontal muestra solo instrumentos y controles. Las perillas/deslizantes, texto e interruptores siguen funcionando durante la ejecución. Tocar el título de un instrumento no abre el inspector mientras se está midiendo.

En Proyecto → Edición y vista → Editar panel se habilitan arrastre, tamaño y parámetros. Terminar edición devuelve la vista de medición. La disposición se guarda en el archivo del proyecto. Cambiar de vista conserva el estado de ejecución y la posición/zoom del diagrama.

## Proyecto, datos y hardware

- **Proyecto:** nombre, Abrir, Guardar, Guardar copia y Nuevo. Ejemplos y edición avanzada se despliegan a pedido.
- **Ejecución avanzada:** un ciclo, período objetivo y diagnóstico de validación/ciclo.
- **Datos y diagnóstico:** monitor, consola, registro y exportación CSV, Waveform JSON y Espectro JSON.
- **Conexión y firmware:** familia, transporte y puerto. Firmware, I²C y exportación Arduino están en secciones plegadas.
- **ESP32 Hardware → Conectar:** acceso directo a esa misma ventana. Cambiar el entorno no abre ventanas ni ejecuta automáticamente. Un error de conexión ofrece una acción explícita; no cambia a simulación.

El botón principal cambia de Ejecutar a Detener. La detención espera el comando/ciclo en curso antes de enviar STOP; una ráfaga o ventana PCNT puede retrasarlo. Durante esa espera no se puede editar ni reiniciar. Los errores permanecen visibles hasta cerrarlos o iniciar otra ejecución. Las lecturas del panel indican el origen y si corresponden a la última ejecución.

## Windows y Linux

El frontend es exactamente el mismo. Los cuatro grupos pasan a dos filas en ventanas estrechas; no se impone el ancho mínimo anterior de 510 px. Se conserva foco visible y se respeta la preferencia de movimiento reducido.

Windows: extrae el ZIP completo y abre `FlowLab/FlowLab.exe`. Linux x86_64: extrae el paquete nativo y ejecuta `./FlowLab/FlowLab`; incluye Python y se construye en Ubuntu 22.04. En otras arquitecturas usa el paquete Python offline y las instrucciones de [LINUX.md](LINUX.md). Los puertos Linux se enumeran como `/dev/ttyUSB*` o `/dev/ttyACM*`, según la placa. FlowLab no cambia permisos del sistema ni necesita ejecutarse como root.

WebSerial continúa disponible cuando el navegador ofrece la API y el contexto es localhost o HTTPS. La solicitud de permiso USB nace del clic Conectar placa. La compilación requiere Arduino CLI; no es requisito de simulación ni de conexión a una placa ya programada.

## Alcance

Implementación: `web/index.html`, `web/app.mjs`, `web/workspace.mjs` y `web/workspace.css`; los estilos de los instrumentos permanecen en `style.css`. No hay dos aplicaciones divergentes por sistema operativo.

La [especificación metrológica 0.4](ESPECIFICACION-0.4.md) sigue siendo un diseño: esta entrega no incorpora Probe/protocolo 4, canales DAQ universales, Bode/V-I sincronizado, cursores SVG ni streaming ADC continuo. Las ráfagas DMA existentes siguen separando captura y transferencia. El número de versión de la interfaz no certifica funciones ni exactitud metrológica que no estén implementadas. Consulta [VALIDACION.md](../VALIDACION.md) para los resultados de las pruebas y las limitaciones físicas.
