# FlowLab 0.4.1 para Linux

Esta distribución contiene el código ejecutable mediante Python, la interfaz, el firmware ESP32, los ejemplos, las pruebas y los paquetes Python necesarios. Comparte el frontend y las funciones de Windows: 80 tipos de bloque, diagrama de bloques, panel frontal, seis tipos de datos, subVIs, FFT, XY, multímetro, WebSocket, WebSerial y protocolo 3, con compatibilidad de comandos anteriores según el firmware conectado.

**Interfaz 0.4.1 implementada:** Spotlight, barra única, inspector contextual y conexión USB bajo demanda comparten el frontend de Windows. Consulta [la guía 0.4.1](PAQUETE-0.4.1.md).

**El archivo FlowLab-0.4.1-Linux.tar.gz no es un binario nativo ni una AppImage.** Necesita Python 3.10 o posterior con `venv`. Los dos paquetes Python se incluyen como wheels independientes del sistema y de la arquitectura; no incluyen un intérprete Python. El mismo paquete fuente puede instalarse en Linux x86_64 o ARM64 con un intérprete compatible; esta entrega no certifica esas plataformas mediante ejecución física.

## Instalación rápida

En Ubuntu/Debian, si no tienes Python y venv:

```sh
sudo apt update
sudo apt install python3 python3-venv
```

En otras distribuciones instala Python 3.10+ y soporte `venv` con su gestor. Después, desde la carpeta donde descargaste el paquete:

```sh
tar -xzf FlowLab-0.4.1-Linux.tar.gz
cd FlowLab
sh instalar-linux.sh
sh start.sh
```

La instalación crea `.venv-linux` dentro de esa carpeta. Instala `pyserial==3.5` y `websockets==15.0.1` desde `vendor/wheels`, sin PyPI ni acceso a Internet, y comprueba sus hashes SHA-256. La instalación del propio Python mediante el gestor del sistema puede necesitar Internet. No se modifica el Python del sistema, no se instala un servicio y no se ejecutan cambios de permisos automáticamente.

Extrae FlowLab en una carpeta propia con permisos de escritura. Conserva el directorio completo; si lo mueves después de instalar, vuelve a crear el entorno virtual en la nueva ubicación, porque los entornos Python pueden contener rutas absolutas.

El programa abre `http://127.0.0.1:8765` en el navegador. Si no se abre automáticamente, entra manualmente. Termina con `Ctrl+C` en la terminal. Alternativas:

```sh
sh start.sh --port 8772
sh start.sh --no-browser
```

La dirección de escucha sigue limitada al equipo local. No hay que abrir puertos del router. El programa utiliza el navegador como interfaz también en Linux.

## ESP32 por USB

Conecta la placa y pulsa **Proyecto → Conexión y firmware → actualizar puertos**. Los nombres habituales son `/dev/ttyUSB0` y `/dev/ttyACM0`, en lugar de COM. Selecciona la familia y el puerto; el firmware debe coincidir con la familia.

Si aparece `Permission denied`, comprueba el propietario/grupo del dispositivo y tus grupos:

```sh
ls -l /dev/ttyUSB0
id
```

Sustituye el dispositivo por el que realmente aparece. En Debian/Ubuntu el acceso serie suele usar el grupo `dialout`. Si ese es el grupo del puerto, un administrador puede añadir tu cuenta:

```sh
sudo usermod -aG dialout "$USER"
```

Cierra completamente la sesión del sistema y vuelve a entrar antes de probar. Otras distribuciones pueden usar grupos distintos; utiliza el que muestre el dispositivo. Esto concede acceso serie a la cuenta. No es necesario ejecutar FlowLab como root ni poner permisos globales `777`. Cierra otros monitores serie si el puerto está ocupado. Referencia: [permisos POSIX en pySerial](https://pyserial.readthedocs.io/en/stable/appendix.html).

Para compilar/cargar firmware, instala Arduino CLI y Arduino-ESP32 3.3.5 como se indica en README.md. El backend busca `arduino-cli` en PATH o en `tools/arduino-cli` dentro de FlowLab. El archivo de esa herramienta debe tener permiso de ejecución. Arduino CLI y el núcleo no se incluyen en este paquete; los fuentes de FlowLabBridge sí.

El firmware necesita validación física; cambiar a Linux no elimina los pendientes registrados en VALIDACION.md. El control por WebSocket funciona con firmware escalar de protocolo 1; las ráfagas e I²C multibyte requieren protocolo 2 o 3; DAC/PCNT/Touch/Tone requieren protocolo 3.

## WebSerial y archivos

Selecciona **WebSerial · USB directo** en Chrome/Chromium o Edge si tu navegador expone Web Serial. WebSocket es la alternativa para navegadores sin esa API. Los permisos del dispositivo Linux también se aplican al navegador.

Para servir exclusivamente la interfaz, sin backend Python, con Node.js 20+ instalado:

```sh
sh start-webserial.sh
```

Abre `http://127.0.0.1:8766`. La placa debe tener ya instalado el firmware; este modo no ofrece compilación/carga desde Arduino CLI.

Los proyectos se guardan en archivos elegidos por el usuario. Si el navegador no implementa File System Access API, usa importación y descarga JSON. En aulas, utiliza cuentas Linux y carpetas separadas por alumno. Se conservan los límites y la política de persistencia de [ARQUITECTURA-0.2.md](ARQUITECTURA-0.2.md); las funciones nuevas se explican en [PAQUETE-0.3.md](PAQUETE-0.3.md).

## Ejecutable nativo opcional

El paquete incluye un script para construir un ejecutable Linux con Python y dependencias incorporados:

```sh
sh scripts/build-linux.sh
```

Requiere ejecutarse en Linux, Python con venv, acceso a PyPI y herramientas del sistema requeridas por PyInstaller, como `ldd` y `objdump`/binutils. El resultado queda en `work/FlowLab-0.4.1-Linux-ARQUITECTURA-native.tar.gz` —por ejemplo `x86_64`— y se inicia mediante `./FlowLab` desde su carpeta, conservando `_internal` a su lado. El script incluye una prueba automática de arranque y autenticación WebSocket antes de crear el archivo.

También se incluye el workflow manual [Build Linux native package](https://github.com/javierssj22/FlowLab/actions/workflows/linux-package.yml) para Ubuntu 22.04/x86_64. La release 0.4.1 incluye su paquete `FlowLab-0.4.1-Linux-x86_64-native.tar.gz`, construido en Ubuntu 22.04. Extrae la carpeta y ejecuta `./FlowLab/FlowLab`; conserva `_internal`. No requiere instalar Python. El workflow también deja el paquete como artefacto de Actions.

La arquitectura y la versión de glibc del sistema de compilación afectan la compatibilidad del binario. Constrúyelo sobre la arquitectura destino y una base compatible con tus máquinas. No se genera un ELF Linux con PyInstaller ejecutado en Windows. Referencia: [distribución multiplataforma con PyInstaller](https://www.pyinstaller.org/en/stable/usage.html).

El script conserva licencias de Python, pyserial, websockets y PyInstaller. Si tu distribución no coloca la licencia de Python en las rutas habituales, indica el archivo correspondiente al intérprete con `PYTHON_LICENSE_FILE` antes de compilar; no omitas los avisos al redistribuir.

## Validación de esta entrega Linux

La [validación de 0.3 en Actions](https://github.com/javierssj22/FlowLab/actions/runs/35667894947) aprobó las pruebas de software en Ubuntu 22.04, la instalación offline y el smoke test de arranque HTTP/WebSocket bajo Linux. También compiló el firmware para las cinco familias ESP32. Consulta [VALIDACION.md](../VALIDACION.md) para el detalle.

Localmente se comprobaron contenido del tar, permisos de ejecución, finales LF, wheels y código compartido desde Windows. **Bash de Git no es Linux**; esa comprobación local es distinta de la ejecución del runner Ubuntu.

Siguen pendientes las pruebas USB físicas, la caracterización ADC/periféricos y la matriz visual de Linux del diseño 0.4.1. El smoke test del ejecutable nativo comprueba HTTP y WebSocket en Ubuntu 22.04; no certifica USB físico, escritorio gráfico Linux ni ARM64.
