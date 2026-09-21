# Componentes de terceros

El código original de FlowLab está bajo MIT. No se incluye código ni recursos de National Instruments. LabVIEW es una marca de su titular; este proyecto independiente no está afiliado a NI.

El frontend no utiliza dependencias, fuentes remotas ni servicios externos. El código fuente del servidor utiliza la biblioteca estándar de Python y pyserial para el puente USB y websockets para el transporte persistente.

| Componente | Uso | Licencia / fuente |
|---|---|---|
| Python 3.14.3 | Runtime del ejecutable de Windows | PSF y licencias de componentes; https://www.python.org/doc/copyright/ |
| pyserial 3.5 | Acceso a puertos serie | BSD de 3 cláusulas; https://github.com/pyserial/pyserial |
| websockets 15.0.1 | Servidor bidireccional local | BSD de 3 cláusulas; https://github.com/python-websockets/websockets |
| PyInstaller 6.22.0 | Empaquetado y bootloader del ejecutable | GPL con excepción para distribución del programa empaquetado; https://pyinstaller.org/en/stable/license.html |
| Arduino-ESP32 3.x | Framework externo para compilar firmware | Licencias del proyecto y dependencias; https://github.com/espressif/arduino-esp32 |
| Arduino CLI | Compilador/cargador externo opcional | GPL-3.0; https://github.com/arduino/arduino-cli |

Arduino CLI y Arduino-ESP32 no se incluyen en el ejecutable. Se instalan desde sus fuentes oficiales. El paquete de Windows incluye los avisos de Python, pyserial, websockets y PyInstaller en `licenses/`. Las licencias de herramientas de compilación adicionales permanecen en sus distribuciones originales.

La distribución Linux fuente incluye wheels universales originales de pyserial 3.5 y websockets 15.0.1 en vendor/wheels, con sus licencias dentro de cada wheel. El intérprete Python de Linux pertenece al sistema y no se incluye en ese archivo.
