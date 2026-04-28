import { ASSIGNMENTS, NO_A3_WEEKDAYS } from './constants'

/**
 * Motor de asignación automática de horarios.
 *
 * @param {number} year
 * @param {number} month - 0-indexed (0=Enero)
 * @param {number[]} ramDays - días del mes con vuelo RAM (1-based)
 * @param {string[]} morningShift - nombres turno mañana
 * @param {string[]} nightShift - nombres turno noche
 * @param {{ lastRam?: Object, ramRotation?: Object }} options
 * @returns {{ grid: Object, warnings: Array, lastRamByShift: Object }}
 */
export function generateSchedule(year, month, ramDays, morningShift, nightShift, options = {}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // grid[name][dayIndex] = assignment code (0-indexed day)
  const grid = {}
  const allStaff = [...morningShift, ...nightShift]
  allStaff.forEach(name => {
    grid[name] = new Array(daysInMonth).fill(null)
  })

  // Area counters for equitable rotation
  const areaCounts = {}
  allStaff.forEach(name => {
    areaCounts[name] = { A1: 0, A2: 0, A3: 0 }
  })

  // Helper: get weekday for a day (1-based)
  function getWeekday(day) {
    return new Date(year, month, day).getDay()
  }

  // Helper: check if day has no A3
  function isNoA3Day(day) {
    return NO_A3_WEEKDAYS.includes(getWeekday(day))
  }

  // Helper: count how many in a shift rest on a given day index
  const MAX_REST_PER_SHIFT = 2
  function countResting(shift, dayIdx) {
    return shift.filter(n => grid[n][dayIdx] === ASSIGNMENTS.L).length
  }

  function sortByCount(names, area) {
    return [...names].sort((a, b) => {
      const diff = areaCounts[a][area] - areaCounts[b][area]
      if (diff !== 0) return diff
      return names.indexOf(a) - names.indexOf(b)
    })
  }

  function placeRest(name, shift, dayIdx) {
    if (dayIdx < 0 || dayIdx >= daysInMonth) return false
    if (grid[name][dayIdx] !== null) return false
    if (countResting(shift, dayIdx) >= MAX_REST_PER_SHIFT) return false
    grid[name][dayIdx] = ASSIGNMENTS.L
    return true
  }

  function findRestSpot(name, shift, targetIdx) {
    const candidates = []

    for (let offset = 0; offset <= 5; offset++) {
      candidates.push(targetIdx - offset)
      if (offset > 0) candidates.push(targetIdx + offset)
    }

    return candidates.find(dayIdx => placeRest(name, shift, dayIdx))
  }

  function enforceMaxConsecutiveWork(name, shift) {
    let changed = false
    let consecutive = 0

    for (let d = 0; d < daysInMonth; d++) {
      if (grid[name][d] === ASSIGNMENTS.L) {
        consecutive = 0
        continue
      }

      consecutive++

      if (consecutive > 5) {
        let placed = false
        for (let search = d; search >= d - 5; search--) {
          if (placeRest(name, shift, search)) {
            placed = true
            changed = true
            break
          }
        }

        if (!placed) {
          for (let search = d + 1; search < daysInMonth; search++) {
            if (placeRest(name, shift, search)) {
              placed = true
              changed = true
              break
            }
          }
        }

        consecutive = 0
      }
    }

    return changed
  }

  function hasTooLongWorkStreak(name) {
    let consecutive = 0

    for (let d = 0; d < daysInMonth; d++) {
      if (grid[name][d] === ASSIGNMENTS.L) {
        consecutive = 0
      } else {
        consecutive++
        if (consecutive > 5) return true
      }
    }

    return false
  }

  function isRamRest(name, dayIdx) {
    return dayIdx + 1 < daysInMonth && grid[name][dayIdx + 1] === ASSIGNMENTS.RAM
  }

  function balanceRestDays(shift) {
    let changed = true

    while (changed) {
      changed = false
      const sortedByRest = [...shift].sort((a, b) => {
        const diff = grid[b].filter(v => v === ASSIGNMENTS.L).length - grid[a].filter(v => v === ASSIGNMENTS.L).length
        if (diff !== 0) return diff
        return shift.indexOf(a) - shift.indexOf(b)
      })
      const maxRest = grid[sortedByRest[0]].filter(v => v === ASSIGNMENTS.L).length
      const minRest = grid[sortedByRest[sortedByRest.length - 1]].filter(v => v === ASSIGNMENTS.L).length

      if (maxRest - minRest <= 1) return

      for (const name of sortedByRest) {
        if (grid[name].filter(v => v === ASSIGNMENTS.L).length <= minRest + 1) continue

        for (let d = daysInMonth - 1; d >= 0; d--) {
          if (grid[name][d] !== ASSIGNMENTS.L || isRamRest(name, d)) continue

          grid[name][d] = null
          if (!hasTooLongWorkStreak(name)) {
            changed = true
            break
          }
          grid[name][d] = ASSIGNMENTS.L
        }

        if (changed) break
      }

      if (changed) continue

      const lowestRest = [...shift].sort((a, b) => {
        const diff = grid[a].filter(v => v === ASSIGNMENTS.L).length - grid[b].filter(v => v === ASSIGNMENTS.L).length
        if (diff !== 0) return diff
        return shift.indexOf(a) - shift.indexOf(b)
      })

      for (const name of lowestRest) {
        if (grid[name].filter(v => v === ASSIGNMENTS.L).length > minRest) continue

        for (let d = 0; d < daysInMonth; d++) {
          if (placeRest(name, shift, d)) {
            changed = true
            break
          }
        }

        if (changed) break
      }
    }
  }

  function normalizeRamRotation(shift, configuredOrder = []) {
    const namesInShift = new Set(shift)
    const rotation = configuredOrder.filter(name => namesInShift.has(name))

    for (const name of shift) {
      if (!rotation.includes(name)) rotation.push(name)
    }

    return rotation
  }

  function sortByRamRotation(candidates, rotation, lastName) {
    const cursor = rotation.indexOf(lastName)

    return [...candidates].sort((a, b) => {
      const aIndex = rotation.indexOf(a)
      const bIndex = rotation.indexOf(b)
      const aDistance = aIndex === -1 ? Infinity : cursor === -1 ? aIndex : (aIndex - cursor - 1 + rotation.length) % rotation.length
      const bDistance = bIndex === -1 ? Infinity : cursor === -1 ? bIndex : (bIndex - cursor - 1 + rotation.length) % rotation.length

      if (aDistance !== bDistance) return aDistance - bDistance
      return candidates.indexOf(a) - candidates.indexOf(b)
    })
  }

  const ramShiftConfigs = [
    {
      key: 'morning',
      staff: morningShift,
      rotation: normalizeRamRotation(morningShift, options.ramRotation?.morning),
      lastRamName: options.lastRam?.morning || null,
    },
    {
      key: 'night',
      staff: nightShift,
      rotation: normalizeRamRotation(nightShift, options.ramRotation?.night),
      lastRamName: options.lastRam?.night || null,
    },
  ]

  // ====== PASO 1: Colocar RAM ======
  const sortedRamDays = [...ramDays].sort((a, b) => a - b)

  for (const day of sortedRamDays) {
    const dayIdx = day - 1
    const prevIdx = day > 1 ? day - 2 : null

    for (const shiftConfig of ramShiftConfigs) {
      const { staff: shift, rotation } = shiftConfig
      // Find candidates: available on RAM day AND on previous day (for L)
      // Also check that placing L on prevIdx won't exceed max rest per shift
      const candidates = shift.filter(name => {
        if (grid[name][dayIdx] !== null) return false
        if (prevIdx !== null) {
          if (grid[name][prevIdx] !== null && grid[name][prevIdx] !== ASSIGNMENTS.L) return false
          // If prev day already has max resting and this person isn't already resting there, skip
          if (grid[name][prevIdx] !== ASSIGNMENTS.L && countResting(shift, prevIdx) >= MAX_REST_PER_SHIFT) return false
        }
        return true
      })

      const sortedCandidates = sortByRamRotation(candidates, rotation, shiftConfig.lastRamName)

      if (sortedCandidates.length > 0) {
        const chosen = sortedCandidates[0]
        grid[chosen][dayIdx] = ASSIGNMENTS.RAM
        shiftConfig.lastRamName = chosen

        // Force L on previous day
        if (prevIdx !== null) {
          grid[chosen][prevIdx] = ASSIGNMENTS.L
        }
      }
    }
  }

  // ====== PASO 2: Colocar descansos (patrón 5-1) ======
  for (const shift of [morningShift, nightShift]) {
    const targetL = Math.round(daysInMonth / 6)

    // Stagger the initial cycle. People may be mid-cycle at the start of the
    // month, so the first rest day is spread across days 1-6.
    for (let personIdx = 0; personIdx < shift.length; personIdx++) {
      const name = shift[personIdx]
      const firstRestIdx = (personIdx + 5) % 6

      for (let d = firstRestIdx; d < daysInMonth; d += 6) {
        if (grid[name][d] === null && countResting(shift, d) < MAX_REST_PER_SHIFT) {
          grid[name][d] = ASSIGNMENTS.L
        }
      }
    }

    for (let personIdx = 0; personIdx < shift.length; personIdx++) {
      const name = shift[personIdx]
      let currentL = grid[name].filter(v => v === ASSIGNMENTS.L).length

      if (currentL < targetL) {
        const firstRestIdx = (personIdx + 5) % 6
        for (let d = firstRestIdx; d < daysInMonth && currentL < targetL; d += 6) {
          if (grid[name][d] !== ASSIGNMENTS.L && findRestSpot(name, shift, d) !== undefined) {
            currentL++
          }
        }
      }
    }

    let repaired = true
    while (repaired) {
      repaired = false
      for (const name of shift) {
        repaired = enforceMaxConsecutiveWork(name, shift) || repaired
      }
    }

    balanceRestDays(shift)
  }

  // ====== PASO 3: Llenar áreas ======
  for (let d = 0; d < daysInMonth; d++) {
    const day = d + 1
    const noA3 = isNoA3Day(day)

    for (const shift of [morningShift, nightShift]) {
      // Get available workers (not L or RAM)
      const available = shift.filter(name => grid[name][d] === null)

      if (available.length === 0) continue

      const assignArea = (name, area) => {
        grid[name][d] = ASSIGNMENTS[area]
        areaCounts[name][area]++
        available.splice(available.indexOf(name), 1)
      }

      // A2 has priority: keep at least one person there whenever possible.
      if (available.length === 1) {
        assignArea(available[0], 'A2')
        continue
      }

      const hasA3Capacity = shift === morningShift && !noA3 && available.length >= 3
      if (hasA3Capacity) {
        assignArea(sortByCount(available, 'A3')[0], 'A3')
      }

      const a1Target = Math.min(2, Math.max(0, available.length - 1))
      const a1Candidates = sortByCount(available, 'A1').slice(0, a1Target)

      for (const chosen of a1Candidates) {
        assignArea(chosen, 'A1')
      }

      for (const name of [...available]) {
        assignArea(name, 'A2')
      }
    }
  }

  // ====== PASO 4: Validar ======
  const warnings = validate(grid, daysInMonth, ramDays, morningShift, nightShift, getWeekday)
  const lastRamByShift = {
    morning: ramShiftConfigs.find(config => config.key === 'morning')?.lastRamName || null,
    night: ramShiftConfigs.find(config => config.key === 'night')?.lastRamName || null,
  }

  return { grid, warnings, daysInMonth, lastRamByShift }
}

function validate(grid, daysInMonth, ramDays, morningShift, nightShift, getWeekday) {
  const warnings = []
  const allStaff = [...morningShift, ...nightShift]

  for (const name of allStaff) {
    // 1. More than 5 consecutive work days
    let consecutive = 0
    for (let d = 0; d < daysInMonth; d++) {
      if (grid[name][d] === ASSIGNMENTS.L) {
        consecutive = 0
      } else {
        consecutive++
        if (consecutive > 5) {
          warnings.push({
            type: 'error',
            message: `${name} trabaja más de 5 días consecutivos (día ${d + 1 - 5} al ${d + 1})`,
          })
          break
        }
      }
    }

    // 2. RAM without L the day before
    for (let d = 0; d < daysInMonth; d++) {
      if (grid[name][d] === ASSIGNMENTS.RAM && d > 0) {
        if (grid[name][d - 1] !== ASSIGNMENTS.L) {
          warnings.push({
            type: 'error',
            message: `${name} tiene RAM el día ${d + 1} sin descanso el día ${d}`,
          })
        }
      }
    }
  }

  // 3. A3 on forbidden days
  for (let d = 0; d < daysInMonth; d++) {
    const weekday = getWeekday(d + 1)
    if (NO_A3_WEEKDAYS.includes(weekday)) {
      for (const name of allStaff) {
        if (grid[name][d] === ASSIGNMENTS.A3) {
          warnings.push({
            type: 'error',
            message: `${name} tiene A3 el día ${d + 1} (${['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'][weekday]}) — día sin A3`,
          })
        }
      }
    }
  }

  // 4. A3 constraints by shift
  for (let d = 0; d < daysInMonth; d++) {
    for (const [label, shift] of [['Mañana', morningShift], ['Noche', nightShift]]) {
      const a3Count = shift.filter(name => grid[name][d] === ASSIGNMENTS.A3).length
      if (label === 'Noche' && a3Count > 0) {
        warnings.push({
          type: 'error',
          message: `Turno ${label} día ${d + 1}: A3 no aplica en turno noche`,
        })
      }
      if (a3Count > 1) {
        warnings.push({
          type: 'error',
          message: `Turno ${label} día ${d + 1}: ${a3Count} técnicos en A3 (máximo 1)`,
        })
      }
    }
  }

  // 5. Day with nobody in A1 or A2
  for (let d = 0; d < daysInMonth; d++) {
    for (const [label, shift] of [['Mañana', morningShift], ['Noche', nightShift]]) {
      const a1Count = shift.filter(name => grid[name][d] === ASSIGNMENTS.A1).length
      const a2Count = shift.filter(name => grid[name][d] === ASSIGNMENTS.A2).length
      if (a1Count === 0) {
        warnings.push({ type: 'error', message: `Turno ${label} día ${d + 1}: nadie en A1` })
      }
      if (a2Count === 0) {
        warnings.push({ type: 'error', message: `Turno ${label} día ${d + 1}: nadie en A2` })
      }
    }
  }

  // 6. More than 2 resting on same day per shift
  for (let d = 0; d < daysInMonth; d++) {
    for (const [label, shift] of [['Mañana', morningShift], ['Noche', nightShift]]) {
      const restCount = shift.filter(name => grid[name][d] === ASSIGNMENTS.L).length
      if (restCount > 2) {
        warnings.push({
          type: 'error',
          message: `Turno ${label} día ${d + 1}: ${restCount} técnicos descansando (máximo 2)`,
        })
      }
    }
  }

  // 7. Uneven rest days within shift
  for (const [label, shift] of [['Mañana', morningShift], ['Noche', nightShift]]) {
    const lCounts = shift.map(name => grid[name].filter(v => v === ASSIGNMENTS.L).length)
    const maxL = Math.max(...lCounts)
    const minL = Math.min(...lCounts)
    if (maxL - minL > 1) {
      warnings.push({
        type: 'warning',
        message: `Turno ${label}: desbalance de días libres (${minL}-${maxL})`,
      })
    }
  }

  // 8. Uneven RAM distribution within shift
  for (const [label, shift] of [['Mañana', morningShift], ['Noche', nightShift]]) {
    const ramCounts = shift.map(name => grid[name].filter(v => v === ASSIGNMENTS.RAM).length)
    const maxR = Math.max(...ramCounts)
    const minR = Math.min(...ramCounts)
    if (maxR - minR > 1) {
      warnings.push({
        type: 'warning',
        message: `Turno ${label}: distribución RAM desigual (${minR}-${maxR})`,
      })
    }
  }

  return warnings
}

/**
 * Compute stats for each person
 */
export function computeStats(grid, daysInMonth) {
  const stats = {}
  for (const [name, days] of Object.entries(grid)) {
    stats[name] = { RAM: 0, A1: 0, A2: 0, A3: 0, L: 0 }
    for (let d = 0; d < daysInMonth; d++) {
      const val = days[d]
      if (val && stats[name][val] !== undefined) {
        stats[name][val]++
      }
    }
  }
  return stats
}
