# PROMPT — Generador Automático de Horarios de Trabajo

## Contexto del Proyecto

Necesito una aplicación web en **React** con un **motor de asignación en JavaScript** que genere automáticamente cronogramas mensuales de turnos de trabajo para un equipo de 12 técnicos divididos en 2 turnos. La app debe poder exportar el resultado a **Excel (.xlsx)** con el mismo formato del archivo adjunto de referencia.

Soy principiante en programación. Trabajo con React, Python y JavaScript.

---

## Datos Base

### Personal

**Turno Mañana (08:00 – 15:00):**
1. Teodora
2. Melania NFA
3. Sofía
4. Karina
5. Silvia
6. Alberto

**Turno Noche (15:30 – 24:00):**
1. Vicente
2. Lorenzo
3. Priscila
4. Husein
5. Juan
6. Petronila

Los turnos son fijos: cada persona siempre pertenece al mismo turno. Nadie cambia de turno.

### Tipos de Asignación Diaria

Cada día, a cada técnico se le asigna **exactamente una** de estas actividades:

| Código | Significado | Notas |
|--------|-------------|-------|
| **RAM** | Vuelo Royal Air Maroc | Requiere descanso obligatorio el día anterior |
| **PE** | Vuelo Punta Europa | NO requiere descanso el día anterior |
| **A1** | Área 1 | Trabajo regular |
| **A2** | Área 2 | Trabajo regular — tiene prioridad |
| **A3** | Área 3 | Trabajo regular — solo 1 técnico por turno |
| **L** | Libre / Descanso | Día de descanso |

---

## Reglas del Motor de Asignación (en orden de prioridad)

### PRIORIDAD 1 — Asignación RAM

- Los días de llegada de vuelos RAM son **datos de entrada** que el usuario configura cada mes (ejemplo abril 2026: días 1, 3, 5, 8, 12, 15, 19, 22, 26, 29).
- Cada día RAM se asigna **1 técnico del turno mañana** y **1 técnico del turno noche**.
- El técnico asignado a RAM **debe tener el día anterior como L (Libre)**. Es decir, si RAM cae el día 5, el día 4 ese técnico debe estar libre.
- **Excepción día 1 del mes:** si RAM cae el día 1, no hay día anterior que forzar. El descanso previo no aplica.
- La rotación RAM se asigna **por disponibilidad**: se elige al técnico que lleve más tiempo sin atender RAM (el que tenga el RAM más antiguo o nunca haya ido). Si hay empate, elegir al primero en la lista del turno.
- Se debe **distribuir equitativamente** la cantidad de RAM entre los 6 técnicos de cada turno a lo largo del mes.

### PRIORIDAD 2 — Asignación PE (Punta Europa)

- Los días de PE son **datos de entrada** que el usuario configura cada mes (ejemplo abril 2026: viernes 3, 10, 17, 24).
- Cada día PE se asigna **1 técnico del turno mañana** y **1 técnico del turno noche**.
- PE **NO requiere descanso** el día anterior (a diferencia de RAM).
- La rotación PE se asigna por disponibilidad, igual que RAM: al técnico que lleve más tiempo sin atender PE.

### PRIORIDAD 3 — Patrón de Descanso (5 trabajo → 1 libre)

- Cada técnico trabaja **5 días consecutivos** y luego descansa **1 día**.
- El patrón es estricto: nunca más de 5 días seguidos sin descanso.
- El patrón puede "romperse" solo cuando un descanso obligatorio por RAM ya fue colocado (ese L cuenta como el descanso del ciclo 5-1).
- Los descansos se **escalonan** entre los técnicos del mismo turno para que no todos descansen el mismo día. Idealmente, cada día debe haber máximo 1 persona descansando por turno (excepto cuando las restricciones de RAM lo fuerzan).
- Al final del mes, todos los técnicos deben tener **aproximadamente la misma cantidad de días libres** (típicamente 5-6 por mes de 30 días).

### PRIORIDAD 4 — Restricción de Área 3

- **Los lunes, jueves y sábados NO se atiende A3.** Ningún técnico puede ser asignado a A3 esos días.
- Los demás días (domingo, martes, miércoles, viernes), se asigna exactamente **1 técnico por turno** a A3.

### PRIORIDAD 5 — Distribución de Áreas (A1, A2, A3)

Cada día, los técnicos que trabajan (no están en L, RAM, ni PE) se distribuyen en las áreas así:

- **A2 tiene prioridad** — es la que más personal necesita.
- **A1** — asignar **2 técnicos** por turno.
- **A3** — asignar **1 técnico** por turno (solo los días permitidos, ver regla anterior).
- **A2** — el resto de técnicos disponibles van a A2.

**Distribución típica por turno cada día** (de los 6 técnicos, normalmente 5 trabajan y 1 descansa):
- 2 en A1 + 2 en A2 + 1 en A3 = 5 trabajando (días con A3)
- 2 en A1 + 3 en A2 = 5 trabajando (días sin A3: lun/jue/sáb)

Cuando hay RAM o PE ese día, hay menos técnicos disponibles para áreas. Se mantiene A1=2 si es posible, si no se reduce a 1. A3 siempre es máximo 1.

### PRIORIDAD 6 — Rotación equitativa de Áreas

- A lo largo del mes, se debe **rotar** qué técnico va a qué área para que no sea siempre la misma persona en A3 o A1.
- Llevar un contador de asignaciones por área por persona y priorizar al técnico con menos asignaciones en esa área cuando haya que asignar.

---

## Parámetros de Entrada (configurables por el usuario)

El usuario debe poder configurar estos datos antes de generar el horario:

1. **Mes y Año** (ejemplo: Abril 2026)
2. **Días de vuelo RAM** (lista de números: 1, 3, 5, 8, 12, 15, 19, 22, 26, 29)
3. **Días de vuelo PE** (lista de números: 3, 10, 17, 24)
4. **Personal de cada turno** (poder agregar/quitar nombres en el futuro)

Los días sin A3 (lunes, jueves, sábados) se calculan automáticamente a partir del mes/año.

---

## Interfaz de Usuario (React)

### Pantalla Principal

1. **Panel de Configuración** (arriba):
   - Selector de mes/año
   - Campo para editar días RAM (input de números separados por coma)
   - Campo para editar días PE
   - Botón "Generar Horario"

2. **Grilla del Cronograma** (centro):
   - Tabla con scroll horizontal
   - Filas: técnicos agrupados por turno (mañana / noche), con separador visual
   - Columnas: días del mes (1-28/30/31)
   - Encabezados de columna: nombre del día (LUN, MAR, etc.) + número
   - Cada celda muestra el código de asignación (RAM, PE, A1, A2, A3, L) con color de fondo distinto
   - Columna final: contador de días libres (L) por persona
   - Resaltar visualmente los fines de semana
   - Resaltar los días sin A3

3. **Leyenda de colores** con el significado de cada código

4. **Resumen estadístico** (abajo):
   - Por cada técnico: cuántos días de RAM, PE, A1, A2, A3 y L tiene
   - Indicador visual si la distribución está desbalanceada

5. **Edición manual**: permitir hacer clic en una celda para cambiar la asignación manualmente (override del algoritmo). Mostrar un dropdown con las opciones válidas.

6. **Botón "Exportar a Excel"**: genera un archivo .xlsx con el mismo formato del archivo de referencia adjunto.

### Colores sugeridos

- RAM → Rojo (#dc2626)
- PE → Morado (#7c3aed)
- A1 → Azul (#2563eb)
- A2 → Verde (#059669)
- A3 → Naranja/Ámbar (#d97706)
- L → Gris claro (#e5e7eb)

---

## Exportación a Excel

El archivo Excel generado debe replicar la estructura del archivo de referencia (Marzo_2026.xlsx):

- **Fila 1**: Título "CRONOGRAMA [MES][AÑO]"
- **Fila 2**: Leyenda "RAM = Royal Air Maroc | Días X, Y, Z: Punta Europa"
- **Fila 4**: Encabezados: TURNO | Nombre y Apellidos | DOM | LUN | MAR | ... | LIBRES
- **Fila 5**: Números de los días (1, 2, 3, ..., 30/31)
- **Filas 6-11**: Turno Mañana (con "MAÑANA" en la columna TURNO de la primera fila)
- **Fila 12**: Separador vacío
- **Filas 13-18**: Turno Noche (con "NOCHE" en la columna TURNO de la primera fila)
- **Filas inferiores**: Leyenda de códigos
- **Tabla de asignación RAM**: listado de qué día le toca a quién con su día de descanso previo

Aplicar colores de fondo a las celdas según el tipo de asignación (mismo esquema de colores de la interfaz).

---

## Validaciones y Advertencias

El sistema debe verificar y mostrar advertencias si:

1. ❌ Algún técnico trabaja más de 5 días consecutivos sin descanso
2. ❌ Algún técnico tiene RAM sin L el día anterior
3. ❌ A3 está asignado un lunes, jueves o sábado
4. ❌ Hay más de 1 técnico en A3 por turno en un día
5. ❌ Hay un día donde no hay nadie en A1 o A2
6. ⚠️ La diferencia de días libres entre técnicos del mismo turno es mayor a 1
7. ⚠️ La distribución de RAM no es equitativa (diferencia > 1 entre técnicos)

Mostrar estas validaciones como una lista al final del cronograma, con ❌ para errores y ⚠️ para advertencias.

---

## Stack Tecnológico Sugerido

- **Frontend**: React (componente funcional con hooks)
- **Motor de asignación**: JavaScript puro (dentro del frontend para el prototipo)
- **Exportación Excel**: Librería `xlsx` (SheetJS) para generar el archivo desde el navegador
- **Estilos**: Tailwind CSS o CSS-in-JS

---

## Algoritmo — Pseudocódigo del Motor

```
ENTRADA: mes, año, díasRAM[], díasPE[], turnoMañana[], turnoNoche[]

1. Inicializar grilla vacía [personas × días]
2. Calcular díasSinA3 = todos los lunes, jueves y sábados del mes

--- PASO 1: Colocar RAM ---
Para cada díaRAM:
  Para cada turno [mañana, noche]:
    Ordenar técnicos por: último día RAM (ascendente, el más antiguo primero)
    Filtrar los que estén disponibles ese día Y el día anterior
    Elegir el primero de la lista
    Asignar RAM en ese día
    Asignar L en el día anterior (si día > 1)

--- PASO 2: Colocar PE ---
Para cada díaPE:
  Para cada turno [mañana, noche]:
    Ordenar técnicos por: último día PE (ascendente)
    Filtrar los que estén disponibles ese día
    Elegir el primero
    Asignar PE en ese día

--- PASO 3: Colocar descansos (patrón 5-1) ---
Para cada turno:
  Para cada técnico (escalonado por índice para no agrupar descansos):
    Recorrer los días del mes:
      Contar días consecutivos trabajados
      Si llega a 5 → colocar L en el siguiente día disponible
      Si ya tiene L por RAM → reiniciar contador

--- PASO 4: Llenar áreas ---
Para cada día del mes:
  Para cada turno:
    Obtener técnicos disponibles (no L, no RAM, no PE)
    Si es día sin A3:
      Asignar 2 a A1, resto a A2
    Si es día con A3:
      Asignar 1 a A3 (rotar equitativamente)
      Asignar 2 a A1 (rotar equitativamente)  
      Resto a A2

--- PASO 5: Validar ---
  Ejecutar todas las validaciones listadas arriba
  Retornar grilla + advertencias
```

---

## Archivo de Referencia

Adjunto el archivo `Marzo_2026.xlsx` como ejemplo del formato de salida esperado. Usarlo como modelo visual para la exportación Excel.
