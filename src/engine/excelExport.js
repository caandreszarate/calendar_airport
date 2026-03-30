import * as XLSX from 'xlsx'
import { ASSIGNMENTS, COLORS, DAY_NAMES } from './constants'

const MONTHS_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
]

// Map assignment codes to hex fill colors (ARGB format for xlsx)
function getFill(code) {
  const c = COLORS[code]
  if (!c) return null
  // Remove # and add FF for alpha
  return { fgColor: { rgb: 'FF' + c.bg.slice(1).toUpperCase() } }
}

export function exportToExcel(grid, daysInMonth, year, month, morningShift, nightShift, ramDays, peDays) {
  const monthName = MONTHS_ES[month]
  const wb = XLSX.utils.book_new()

  // Build data rows
  const rows = []

  // Row 1: Title
  rows.push([`CRONOGRAMA ${monthName} ${year}`])

  // Row 2: Legend
  rows.push([`RAM = Royal Air Maroc | Días ${peDays.join(', ')}: Punta Europa`])

  // Row 3: empty
  rows.push([])

  // Row 4: Headers — TURNO | Nombre | day names...
  const headerRow = ['TURNO', 'Nombre y Apellidos']
  for (let d = 1; d <= daysInMonth; d++) {
    const wd = new Date(year, month, d).getDay()
    headerRow.push(`${DAY_NAMES[wd]}`)
  }
  headerRow.push('LIBRES')
  rows.push(headerRow)

  // Row 5: day numbers
  const dayNumRow = ['', '']
  for (let d = 1; d <= daysInMonth; d++) {
    dayNumRow.push(d)
  }
  dayNumRow.push('')
  rows.push(dayNumRow)

  // Morning shift
  morningShift.forEach((name, i) => {
    const row = [i === 0 ? 'MAÑANA' : '', name]
    const lCount = grid[name]?.filter(v => v === ASSIGNMENTS.L).length || 0
    for (let d = 0; d < daysInMonth; d++) {
      row.push(grid[name]?.[d] || '')
    }
    row.push(lCount)
    rows.push(row)
  })

  // Separator
  rows.push([])

  // Night shift
  nightShift.forEach((name, i) => {
    const row = [i === 0 ? 'NOCHE' : '', name]
    const lCount = grid[name]?.filter(v => v === ASSIGNMENTS.L).length || 0
    for (let d = 0; d < daysInMonth; d++) {
      row.push(grid[name]?.[d] || '')
    }
    row.push(lCount)
    rows.push(row)
  })

  // Empty row
  rows.push([])

  // Legend
  rows.push(['LEYENDA:'])
  rows.push(['RAM', 'Royal Air Maroc — Requiere descanso el día anterior'])
  rows.push(['PE', 'Punta Europa — NO requiere descanso previo'])
  rows.push(['A1', 'Área 1'])
  rows.push(['A2', 'Área 2 (prioridad)'])
  rows.push(['A3', 'Área 3 — solo 1 técnico por turno, NO lun/jue/sáb'])
  rows.push(['L', 'Libre / Descanso'])

  // Empty row
  rows.push([])

  // RAM assignment table
  rows.push(['ASIGNACIÓN RAM:'])
  rows.push(['Día RAM', 'Técnico Mañana', 'Descanso previo', 'Técnico Noche', 'Descanso previo'])

  for (const day of ramDays.sort((a, b) => a - b)) {
    const dayIdx = day - 1
    const morningTech = morningShift.find(n => grid[n]?.[dayIdx] === ASSIGNMENTS.RAM) || '—'
    const nightTech = nightShift.find(n => grid[n]?.[dayIdx] === ASSIGNMENTS.RAM) || '—'
    const morningRest = day > 1 ? `Día ${day - 1}` : 'N/A'
    const nightRest = day > 1 ? `Día ${day - 1}` : 'N/A'
    rows.push([day, morningTech, morningRest, nightTech, nightRest])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Set column widths
  ws['!cols'] = [
    { wch: 10 },  // TURNO
    { wch: 20 },  // Nombre
    ...Array(daysInMonth).fill({ wch: 5 }),  // Days
    { wch: 8 },  // LIBRES
  ]

  // Merge title cell
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: daysInMonth + 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: daysInMonth + 2 } },
  ]

  XLSX.utils.book_append_sheet(wb, ws, monthName)

  // Generate and download
  const filename = `Cronograma_${monthName}_${year}.xlsx`
  XLSX.writeFile(wb, filename)
}
