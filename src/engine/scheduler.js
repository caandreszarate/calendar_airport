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
  const TARGET_REST_DAYS = 7

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

  function isLowWorkday(dayIdx) {
    const weekday = getWeekday(dayIdx + 1)
    return weekday === 1 || weekday === 5
  }

  function restCountFor(name) {
    return grid[name].filter(v => v === ASSIGNMENTS.L).length
  }

  function getRestAdditionOrder(shift) {
    const days = Array.from({ length: daysInMonth }, (_, idx) => idx)

    return [
      ...days.filter(dayIdx => isLowWorkday(dayIdx) && countResting(shift, dayIdx) === 0),
      ...days.filter(dayIdx => !isLowWorkday(dayIdx)),
      ...days.filter(dayIdx => isLowWorkday(dayIdx) && countResting(shift, dayIdx) > 0),
    ]
  }

  function getRestRemovalOrder() {
    const days = Array.from({ length: daysInMonth }, (_, idx) => daysInMonth - 1 - idx)

    return [
      ...days.filter(dayIdx => !isLowWorkday(dayIdx)),
      ...days.filter(dayIdx => isLowWorkday(dayIdx)),
    ]
  }

  function canRemoveRest(name, dayIdx) {
    if (grid[name][dayIdx] !== ASSIGNMENTS.L || isRamRest(name, dayIdx)) return false

    grid[name][dayIdx] = null
    const canRemove = !hasTooLongWorkStreak(name)
    grid[name][dayIdx] = ASSIGNMENTS.L

    return canRemove
  }

  function normalizeLowWorkdayRests(shift) {
    for (let d = 0; d < daysInMonth; d++) {
      if (!isLowWorkday(d)) continue

      while (countResting(shift, d) > 1) {
        const removable = shift
          .filter(name => canRemoveRest(name, d))
          .sort((a, b) => {
            const diff = restCountFor(b) - restCountFor(a)
            if (diff !== 0) return diff
            return shift.indexOf(a) - shift.indexOf(b)
          })

        if (removable.length === 0) break
        grid[removable[0]][d] = null
      }

      if (countResting(shift, d) === 0) {
        const candidates = shift
          .filter(name => grid[name][d] === null)
          .sort((a, b) => {
            const aAdjacentRest = grid[a][d - 1] === ASSIGNMENTS.L || grid[a][d + 1] === ASSIGNMENTS.L
            const bAdjacentRest = grid[b][d - 1] === ASSIGNMENTS.L || grid[b][d + 1] === ASSIGNMENTS.L
            if (aAdjacentRest !== bAdjacentRest) return Number(aAdjacentRest) - Number(bAdjacentRest)

            const diff = restCountFor(a) - restCountFor(b)
            if (diff !== 0) return diff
            return shift.indexOf(a) - shift.indexOf(b)
          })

        if (candidates.length > 0) {
          placeRest(candidates[0], shift, d)
        }
      }
    }
  }

  function getLowWorkdayTargets(name, shift) {
    const days = Array.from({ length: daysInMonth }, (_, idx) => idx)

    return days
      .filter(dayIdx => isLowWorkday(dayIdx) && grid[name][dayIdx] === null && countResting(shift, dayIdx) < MAX_REST_PER_SHIFT)
      .sort((a, b) => {
        const restDiff = countResting(shift, a) - countResting(shift, b)
        if (restDiff !== 0) return restDiff

        const aAdjacentRest = grid[name][a - 1] === ASSIGNMENTS.L || grid[name][a + 1] === ASSIGNMENTS.L
        const bAdjacentRest = grid[name][b - 1] === ASSIGNMENTS.L || grid[name][b + 1] === ASSIGNMENTS.L
        if (aAdjacentRest !== bAdjacentRest) return Number(aAdjacentRest) - Number(bAdjacentRest)

        return a - b
      })
  }

  function moveRestToLowWorkday(fromName, toName, shift) {
    for (const sourceDay of getRestRemovalOrder()) {
      if (grid[fromName][sourceDay] !== ASSIGNMENTS.L || isRamRest(fromName, sourceDay)) continue

      for (const targetDay of getLowWorkdayTargets(toName, shift)) {
        if (targetDay === sourceDay) continue

        grid[fromName][sourceDay] = null
        const sourceIsValid = !hasTooLongWorkStreak(fromName)

        if (sourceIsValid && placeRest(toName, shift, targetDay)) {
          return true
        }

        if (grid[toName][targetDay] === ASSIGNMENTS.L) {
          grid[toName][targetDay] = null
        }
        grid[fromName][sourceDay] = ASSIGNMENTS.L
      }
    }

    return false
  }

  function levelRestDaysUsingLowWorkdays(shift) {
    let changed = true

    while (changed) {
      changed = false

      const byMostRest = [...shift].sort((a, b) => {
        const diff = restCountFor(b) - restCountFor(a)
        if (diff !== 0) return diff
        return shift.indexOf(a) - shift.indexOf(b)
      })
      const byLeastRest = [...byMostRest].reverse()
      const maxRest = restCountFor(byMostRest[0])
      const minRest = restCountFor(byLeastRest[0])

      if (maxRest - minRest <= 1) return

      for (const fromName of byMostRest) {
        if (restCountFor(fromName) <= minRest + 1) continue

        for (const toName of byLeastRest) {
          if (restCountFor(toName) > minRest) continue

          if (moveRestToLowWorkday(fromName, toName, shift)) {
            changed = true
            break
          }
        }

        if (changed) break
      }
    }
  }

  function getTargetRestAdditionOrder(name, shift) {
    const days = Array.from({ length: daysInMonth }, (_, idx) => idx)

    return [
      ...days.filter(dayIdx => isLowWorkday(dayIdx) && grid[name][dayIdx] === null && countResting(shift, dayIdx) === 0),
      ...days.filter(dayIdx => isLowWorkday(dayIdx) && grid[name][dayIdx] === null && countResting(shift, dayIdx) < MAX_REST_PER_SHIFT),
      ...days.filter(dayIdx => !isLowWorkday(dayIdx) && grid[name][dayIdx] === null && countResting(shift, dayIdx) < MAX_REST_PER_SHIFT),
    ].sort((a, b) => {
      const lowDiff = Number(!isLowWorkday(a)) - Number(!isLowWorkday(b))
      if (lowDiff !== 0) return lowDiff

      const restDiff = countResting(shift, a) - countResting(shift, b)
      if (restDiff !== 0) return restDiff

      const aAdjacentRest = grid[name][a - 1] === ASSIGNMENTS.L || grid[name][a + 1] === ASSIGNMENTS.L
      const bAdjacentRest = grid[name][b - 1] === ASSIGNMENTS.L || grid[name][b + 1] === ASSIGNMENTS.L
      if (aAdjacentRest !== bAdjacentRest) return Number(aAdjacentRest) - Number(bAdjacentRest)

      return a - b
    })
  }

  function fillRestDaysToTarget(shift, targetRestDays) {
    let changed = true

    while (changed) {
      changed = false

      const lowestRest = [...shift].sort((a, b) => {
        const diff = restCountFor(a) - restCountFor(b)
        if (diff !== 0) return diff
        return shift.indexOf(a) - shift.indexOf(b)
      })

      for (const name of lowestRest) {
        if (restCountFor(name) >= targetRestDays) continue

        for (const dayIdx of getTargetRestAdditionOrder(name, shift)) {
          if (placeRest(name, shift, dayIdx)) {
            changed = true
            break
          }
        }

        if (changed) break
      }
    }
  }

  function trimRestDaysToTarget(shift, targetRestDays) {
    let changed = true

    while (changed) {
      changed = false

      const highestRest = [...shift].sort((a, b) => {
        const diff = restCountFor(b) - restCountFor(a)
        if (diff !== 0) return diff
        return shift.indexOf(a) - shift.indexOf(b)
      })

      for (const name of highestRest) {
        if (restCountFor(name) <= targetRestDays) continue

        for (const dayIdx of getRestRemovalOrder()) {
          if (!canRemoveRest(name, dayIdx)) continue

          grid[name][dayIdx] = null
          changed = true
          break
        }

        if (changed) break
      }
    }
  }

  function normalizeRestDaysToTarget(shift, targetRestDays) {
    fillRestDaysToTarget(shift, targetRestDays)
    trimRestDaysToTarget(shift, targetRestDays)
    levelRestDaysUsingLowWorkdays(shift)
    fillRestDaysToTarget(shift, targetRestDays)
  }

  function balanceRestDays(shift) {
    let changed = true

    while (changed) {
      changed = false
      const sortedByRest = [...shift].sort((a, b) => {
        const diff = restCountFor(b) - restCountFor(a)
        if (diff !== 0) return diff
        return shift.indexOf(a) - shift.indexOf(b)
      })
      const maxRest = restCountFor(sortedByRest[0])
      const minRest = restCountFor(sortedByRest[sortedByRest.length - 1])

      if (maxRest - minRest <= 1) return

      for (const name of sortedByRest) {
        if (restCountFor(name) <= minRest + 1) continue

        for (const d of getRestRemovalOrder()) {
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
        const diff = restCountFor(a) - restCountFor(b)
        if (diff !== 0) return diff
        return shift.indexOf(a) - shift.indexOf(b)
      })

      for (const name of lowestRest) {
        if (restCountFor(name) > minRest) continue

        for (const d of getRestAdditionOrder(shift)) {
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
    const targetL = TARGET_REST_DAYS

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
    levelRestDaysUsingLowWorkdays(shift)
    normalizeRestDaysToTarget(shift, targetL)
    normalizeLowWorkdayRests(shift)
    balanceRestDays(shift)
    normalizeRestDaysToTarget(shift, targetL)

    repaired = true
    while (repaired) {
      repaired = false
      for (const name of shift) {
        repaired = enforceMaxConsecutiveWork(name, shift) || repaired
      }
    }

    normalizeLowWorkdayRests(shift)
    levelRestDaysUsingLowWorkdays(shift)
    normalizeRestDaysToTarget(shift, targetL)
    balanceRestDays(shift)
    normalizeRestDaysToTarget(shift, targetL)
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

      const a1Target = Math.min(2, Math.floor(available.length / 2))
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
      if (a1Count > a2Count) {
        warnings.push({
          type: 'error',
          message: `Turno ${label} día ${d + 1}: A1 (${a1Count}) supera A2 (${a2Count})`,
        })
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
