import {writeFileSync} from 'node:fs';
import {TYPES,DATA_TYPES} from '../web/core.mjs';
let doc='# Biblioteca de FlowLab\n\n'+Object.keys(TYPES).length+' tipos de bloque. El exportador Arduino admite los 58 bloques escalares originales y subVIs escalares; los bloques de lotes requieren el motor conectado de 0.2. Los terminales IN/OUT se utilizan dentro de módulos. Los bloques ESP32 realizan operaciones de hardware solo en modo Hardware. La validación del generador no sustituye la compilación y prueba física.\n\n';
doc+='## Tipos y colores\n\n| Tipo | Color | Conexión |\n|---|---|---|\n| Decimal / DBL | Naranja | Entradas numéricas |\n| Entero / I32 | Azul | Entradas enteras o decimales |\n| Booleano / BOOL | Verde | Entradas booleanas |\n| Texto / STRING | Rosa | Entradas de texto |\n| Vector / DBL[] | Violeta | Entradas vectoriales |\n| Waveform / Y/dt | Cian | Entradas waveform |\n\n';
doc+='La posición del bloque no determina el orden de ejecución: lo determinan sus conexiones. Los ciclos necesitan memoria. Los bloques con estado se reinician en cada ejecución nueva.\n\n';
for(const group of new Set(Object.values(TYPES).map(n=>n.group))){
  doc+=`## ${group}\n\n`;
  for(const [type,d] of Object.entries(TYPES).filter(([,d])=>d.group===group)){
    doc+=`### ${d.label}\n\n${d.description}\n\n- Identificador: \`${type}\`\n- Entradas: ${d.inputs.length?d.inputs.map(p=>`\`${p.name}\` (${DATA_TYPES[p.type].label})`).join(', '):'ninguna'}\n- Salida: ${DATA_TYPES[d.output].label}\n`;
    if(Object.keys(d.params).length){doc+='- Parámetros: '+Object.entries(d.params).map(([key,p])=>`\`${key}\` — ${p.label}; valor inicial: ${JSON.stringify(p.value)}${p.options?'; opciones: '+p.options.join(', '):p.type==='number'?`; rango: ${p.min} a ${p.max}`:''}`).join('; ')+'.\n';}
    doc+='\n';
  }
}
doc+='## Detalles de ejecución\n\nEl contador cuenta flancos, no ciclos verdaderos. El retardo TON suma dt mientras la entrada permanece verdadera; el primer ciclo verdadero cuenta como un intervalo de muestreo. Las ventanas móviles usan solo las muestras disponibles durante el arranque. RMS calcula sqrt(media(x²)). La desviación estándar es poblacional (división por N). Derivada y estadísticas no incorporan filtrado adicional.\n\nLa suma de ventanas y la integral pueden producir valores no finitos con entradas extremas: en ese caso el motor informa error y detiene el flujo. Usa escalado y límites acordes a tu señal. En Arduino las ventanas se almacenan en arrays de tamaño fijo por bloque; considera la RAM disponible al exportar grafos grandes. El exportador no calcula un presupuesto de memoria de la placa.\n';
writeFileSync(new URL('../docs/BIBLIOTECA.md',import.meta.url),doc);
