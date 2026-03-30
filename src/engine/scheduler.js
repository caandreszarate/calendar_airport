import { ASSIGNMENTS, NO_A3_WEEKDAYS } from './constants'

/**
 * Motor de asignación automática de horarios.
 *
 * @param {number} year
 * @param {number} month - 0-indexed (0=Enero)
 * @param {number[]} ramDays - días del mes con vuelo RAM (1-based)
 * @param {number[]} peDays - días del mes con vuelo PE (1-based)
 * @param {string[]} morningShift - nombres turno mañana
 * @param {string[]} nightShift - nombres turno noche
 * @returns {{ grid: Object, warnings: Array }}
 */
export function generateSchedule(year, month, ramDays, peDays, morningShift, nightShift) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // grid[name][dayIndex] = assignment code (0-indexed day)
  const grid = {}
  const allStaff = [...morningShift, ...nightShift]
  allStaff.forEach(name => {
    grid[name] = new Array(daysInMonth).fill(null)
  })

  // Track last RAM/PE day per person for fair rotation
  const lastRam = {}
  const lastPe = {}
  allStaff.forEach(name => {
    lastRam[name] = -Infinity
    lastPe[name] = -Infinity
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

  // ====== PASO 1: Colocar RAM ======
  const sortedRamDays = [...ramDays].sort((a, b) => a - b)

  for (const day of sortedRamDays) {
    const dayIdx = day - 1
    const prevIdx = day > 1 ? day - 2 : null

    for (const shift of [morningShift, nightShift]) {
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

      // Sort by last RAM (oldest first), then by list order for tiebreaker
      candidates.sort((a, b) => {
        const diff = lastRam[a] - lastRam[b]
        if (diff !== 0) return diff
        return shift.indexOf(a) - shift.indexOf(b)
      })

      if (candidates.length > 0) {
        const chosen = candidates[0]
        grid[chosen][dayIdx] = ASSIGNMENTS.RAM
        lastRam[chosen] = dayIdx

        // Force L on previous day
        if (prevIdx !== null) {
          grid[chosen][prevIdx] = ASSIGNMENTS.L
        }
      }
    }
  }

  // ====== PASO 2: Colocar PE ======
  const sortedPeDays = [...peDays].sort((a, b) => a - b)

  for (const day of sortedPeDays) {
    const dayIdx = day - 1

    for (const shift of [morningShift, nightShift]) {
      const candidates = shift.filter(name => grid[name][dayIdx] === null)

      candidates.sort((a, b) => {
        const diff = lastPe[a] - lastPe[b]
        if (diff !== 0) return diff
        return shift.indexOf(a) - shift.indexOf(b)
      })

      if (candidates.length > 0) {
        const chosen = candidates[0]
        grid[chosen][dayIdx] = ASSIGNMENTS.PE
        lastPe[chosen] = dayIdx
      }
    }
  }

  // ====== PASO 3: Colocar descansos (patrón 5-1) ======
  for (const shift of [morningShift, nightShift]) {
    // Stagger rest days: each person starts their cycle offset
    for (let personIdx = 0; personIdx < shift.length; personIdx++) {
      const name = shift[personIdx]
      let consecutiveWork = 0

      // Calculate initial offset so rest days are staggered
      // Person 0 rests on day 6, person 1 on day 7, etc.
      const restOffset = personIdx

      for (let d = 0; d < daysInMonth; d++) {
        if (grid[name][d] === ASSIGNMENTS.L) {
          // Already has a rest day (from RAM), reset counter
          consecutiveWork = 0
          continue
        }

        if (grid[name][d] === ASSIGNMENTS.RAM || grid[name][d] === ASSIGNMENTS.PE) {
          consecutiveWork++
          continue
        }

        // Cell is still null — needs assignment
        consecutiveWork++

        if (consecutiveWork >= 6) {
          // Must rest now (worked 5, this would be 6th)
          // Check max rest per shift on this day
          if (countResting(shift, d) < MAX_REST_PER_SHIFT) {
            grid[name][d] = ASSIGNMENTS.L
            consecutiveWork = 0
          } else {
            // Try next available day
            for (let search = d + 1; search < daysInMonth; search++) {
              if (grid[name][search] === null && countResting(shift, search) < MAX_REST_PER_SHIFT) {
                grid[name][search] = ASSIGNMENTS.L
                consecutiveWork = 0
                break
              }
              if (grid[name][search] === ASSIGNMENTS.L) {
                consecutiveWork = 0
                break
              }
            }
          }
        }
      }
    }

    // Second pass: ensure staggered rest using offset approach
    // Count current L days per person
    const lCounts = {}
    shift.forEach(name => {
      lCounts[name] = grid[name].filter(v => v === ASSIGNMENTS.L).length
    })

    // Target ~5-6 rest days for 30-day month
    const targetL = Math.round(daysInMonth / 6)

    for (let personIdx = 0; personIdx < shift.length; personIdx++) {
      const name = shift[personIdx]
      const currentL = lCounts[name]

      if (currentL < targetL) {
        // Need more rest days — find good spots
        let consecutiveWork = 0
        for (let d = 0; d < daysInMonth; d++) {
          if (grid[name][d] === ASSIGNMENTS.L) {
            consecutiveWork = 0
            continue
          }
          consecutiveWork++

          // Place extra rest to maintain stagger pattern
          if (consecutiveWork >= 5 && grid[name][d] === null) {
            // Check if not too many people resting this day in same shift
            if (countResting(shift, d) < MAX_REST_PER_SHIFT) {
              grid[name][d] = ASSIGNMENTS.L
              consecutiveWork = 0
              lCounts[name]++
              if (lCounts[name] >= targetL) break
            }
          }
        }
      }
    }

    // Final enforcement: no more than 5 consecutive work days
    for (const name of shift) {
      let consecutive = 0
      for (let d = 0; d < daysInMonth; d++) {
        if (grid[name][d] === ASSIGNMENTS.L) {
          consecutive = 0
        } else {
          consecutive++
          if (consecutive > 5 && grid[name][d] === null) {
            if (countResting(shift, d) < MAX_REST_PER_SHIFT) {
              grid[name][d] = ASSIGNMENTS.L
              consecutive = 0
            } else {
              // Find next available day respecting max rest limit
              for (let search = d + 1; search < daysInMonth; search++) {
                if (grid[name][search] === null && countResting(shift, search) < MAX_REST_PER_SHIFT) {
                  grid[name][search] = ASSIGNMENTS.L
                  consecutive = 0
                  break
                }
                if (grid[name][search] === ASSIGNMENTS.L) {
                  consecutive = 0
                  break
                }
              }
            }
          }
        }
      }
    }
  }

  // ====== PASO 4: Llenar áreas ======
  for (let d = 0; d < daysInMonth; d++) {
    const day = d + 1
    const noA3 = isNoA3Day(day)

    for (const shift of [morningShift, nightShift]) {
      // Get available workers (not L, RAM, PE)
      const available = shift.filter(name => grid[name][d] === null)

      if (available.length === 0) continue

      // Sort by area counts for equitable distribution
      let a3Assigned = 0
      let a1Assigned = 0

      // A3 first (1 person, only on allowed days)
      if (!noA3 && available.length > 0) {
        const a3Candidates = [...available].sort((a, b) => areaCounts[a].A3 - areaCounts[b].A3)
        const chosen = a3Candidates[0]
        grid[chosen][d] = ASSIGNMENTS.A3
        areaCounts[chosen].A3++
        a3Assigned = 1
        available.splice(available.indexOf(chosen), 1)
      }

      // A1 next (2 people ideally)
      const a1Target = Math.min(2, available.length)
      const a1Candidates = [...available].sort((a, b) => areaCounts[a].A1 - areaCounts[b].A1)

      for (let i = 0; i < a1Target; i++) {
        const chosen = a1Candidates[i]
        grid[chosen][d] = ASSIGNMENTS.A1
        areaCounts[chosen].A1++
        a1Assigned++
      }

      // Remove A1 assigned from available
      const a1Names = a1Candidates.slice(0, a1Target)
      const remaining = available.filter(n => !a1Names.includes(n))

      // A2 gets the rest
      for (const name of remaining) {
        grid[name][d] = ASSIGNMENTS.A2
        areaCounts[name].A2++
      }
    }
  }

  // ====== PASO 5: Validar ======
  const warnings = validate(grid, daysInMonth, ramDays, morningShift, nightShift, getWeekday)

  return { grid, warnings, daysInMonth }
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

  // 4. More than 1 in A3 per shift per day
  for (let d = 0; d < daysInMonth; d++) {
    for (const [label, shift] of [['Mañana', morningShift], ['Noche', nightShift]]) {
      const a3Count = shift.filter(name => grid[name][d] === ASSIGNMENTS.A3).length
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
    stats[name] = { RAM: 0, PE: 0, A1: 0, A2: 0, A3: 0, L: 0 }
    for (let d = 0; d < daysInMonth; d++) {
      const val = days[d]
      if (val && stats[name][val] !== undefined) {
        stats[name][val]++
      }
    }
  }
  return stats
}
