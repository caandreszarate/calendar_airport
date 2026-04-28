import { useState, useCallback, useEffect } from 'react'
import ConfigPanel from './components/ConfigPanel'
import ScheduleGrid from './components/ScheduleGrid'
import Legend from './components/Legend'
import StatsTable from './components/StatsTable'
import ValidationList from './components/ValidationList'
import { generateSchedule, computeStats } from './engine/scheduler'
import { exportToExcel } from './engine/excelExport'
import { isSupabaseConfigured } from './lib/supabaseClient'
import {
  loadCalendar,
  loadSetting,
  logScheduleChange,
  saveCalendar,
  saveSetting,
} from './services/calendarRepository'
import {
  DEFAULT_MORNING_SHIFT,
  DEFAULT_NIGHT_SHIFT,
  DEFAULT_RAM_ROTATION,
  INITIAL_RAM_CONTINUITY,
} from './engine/constants'

const RAM_CONTINUITY_STORAGE_KEY = 'calendarAirport.ramContinuity'

function parseDays(str) {
  return str
    .split(',')
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n) && n > 0)
}

function getMonthKey(year, month) {
  return `${year}-${month}`
}

function getPreviousMonth(year, month) {
  if (month === 0) return { year: year - 1, month: 11 }
  return { year, month: month - 1 }
}

function getPreviousRamContinuity(continuity, year, month) {
  const previous = getPreviousMonth(year, month)
  return continuity[getMonthKey(previous.year, previous.month)] || { morning: '', night: '' }
}

function loadRamContinuity() {
  try {
    const stored = window.localStorage.getItem(RAM_CONTINUITY_STORAGE_KEY)
    if (!stored) return INITIAL_RAM_CONTINUITY
    return { ...INITIAL_RAM_CONTINUITY, ...JSON.parse(stored) }
  } catch {
    return INITIAL_RAM_CONTINUITY
  }
}

function formatDays(days = []) {
  return days.join(', ')
}

function buildScheduleFromRecord(record) {
  return {
    grid: record.grid || {},
    warnings: record.warnings || [],
    daysInMonth: new Date(record.year, record.month + 1, 0).getDate(),
    lastRamByShift: record.last_ram_result || { morning: null, night: null },
  }
}

export default function App() {
  const now = new Date()
  const [ramContinuity, setRamContinuity] = useState(loadRamContinuity)
  const initialPreviousRam = getPreviousRamContinuity(ramContinuity, now.getFullYear(), now.getMonth())

  const [config, setConfig] = useState({
    month: now.getMonth(),
    year: now.getFullYear(),
    ramDaysStr: '1, 3, 5, 8, 12, 15, 19, 22, 26, 29',
    peDaysStr: '3, 10, 17, 24',
    morningShift: [...DEFAULT_MORNING_SHIFT],
    nightShift: [...DEFAULT_NIGHT_SHIFT],
    morningRamOrder: [...DEFAULT_RAM_ROTATION.morning],
    nightRamOrder: [...DEFAULT_RAM_ROTATION.night],
    lastMorningRam: initialPreviousRam.morning,
    lastNightRam: initialPreviousRam.night,
  })

  const [schedule, setSchedule] = useState(null)
  const [stats, setStats] = useState(null)
  const [calendarRecordId, setCalendarRecordId] = useState(null)
  const [syncStatus, setSyncStatus] = useState(
    isSupabaseConfigured ? 'Conectando con Supabase...' : 'Modo local: configura Supabase para sincronizar',
  )

  const persistCalendar = useCallback(async (grid, warnings, lastRamByShift, recordConfig = config) => {
    if (!isSupabaseConfigured) return null

    const ramDays = parseDays(recordConfig.ramDaysStr)
    const peDays = parseDays(recordConfig.peDaysStr)
    const morning = recordConfig.morningShift.filter(n => n.trim())
    const night = recordConfig.nightShift.filter(n => n.trim())

    const saved = await saveCalendar({
      year: recordConfig.year,
      month: recordConfig.month,
      status: 'draft',
      ram_days: ramDays,
      pe_days: peDays,
      morning_shift: morning,
      night_shift: night,
      ram_rotation: {
        morning: recordConfig.morningRamOrder,
        night: recordConfig.nightRamOrder,
      },
      last_ram_input: {
        morning: recordConfig.lastMorningRam,
        night: recordConfig.lastNightRam,
      },
      last_ram_result: lastRamByShift || { morning: null, night: null },
      grid,
      warnings,
    })

    setCalendarRecordId(saved.id)
    return saved
  }, [config])

  useEffect(() => {
    window.localStorage.setItem(RAM_CONTINUITY_STORAGE_KEY, JSON.stringify(ramContinuity))
  }, [ramContinuity])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let cancelled = false

    async function loadCloudState() {
      try {
        const remoteContinuity = await loadSetting('ram_continuity')
        if (cancelled) return

        if (remoteContinuity) {
          const merged = { ...INITIAL_RAM_CONTINUITY, ...remoteContinuity }
          setRamContinuity(merged)
          const previousRam = getPreviousRamContinuity(merged, config.year, config.month)
          setConfig(prev => ({
            ...prev,
            lastMorningRam: previousRam.morning,
            lastNightRam: previousRam.night,
          }))
        }

        const saved = await loadCalendar(config.year, config.month)
        if (cancelled) return

        if (saved) {
          const savedSchedule = buildScheduleFromRecord(saved)
          setConfig(prev => ({
            ...prev,
            ramDaysStr: formatDays(saved.ram_days),
            peDaysStr: formatDays(saved.pe_days),
            morningShift: saved.morning_shift?.length ? saved.morning_shift : prev.morningShift,
            nightShift: saved.night_shift?.length ? saved.night_shift : prev.nightShift,
            morningRamOrder: saved.ram_rotation?.morning || prev.morningRamOrder,
            nightRamOrder: saved.ram_rotation?.night || prev.nightRamOrder,
            lastMorningRam: saved.last_ram_input?.morning || prev.lastMorningRam,
            lastNightRam: saved.last_ram_input?.night || prev.lastNightRam,
          }))
          setSchedule(savedSchedule)
          setStats(computeStats(savedSchedule.grid, savedSchedule.daysInMonth))
          setCalendarRecordId(saved.id)
          setSyncStatus('Calendario cargado desde Supabase')
        } else {
          setSyncStatus('Supabase conectado: sin calendario guardado para este mes')
        }
      } catch (error) {
        setSyncStatus(`Error Supabase: ${error.message}`)
      }
    }

    loadCloudState()

    return () => {
      cancelled = true
    }
  }, [])

  const loadSavedCalendarForMonth = useCallback(async (year, month) => {
    if (!isSupabaseConfigured) return

    try {
      setSyncStatus('Buscando calendario guardado...')
      const saved = await loadCalendar(year, month)

      if (!saved) {
        setCalendarRecordId(null)
        setSyncStatus('Supabase conectado: sin calendario guardado para este mes')
        return
      }

      const savedSchedule = buildScheduleFromRecord(saved)
      setConfig(prev => ({
        ...prev,
        ramDaysStr: formatDays(saved.ram_days),
        peDaysStr: formatDays(saved.pe_days),
        morningShift: saved.morning_shift?.length ? saved.morning_shift : prev.morningShift,
        nightShift: saved.night_shift?.length ? saved.night_shift : prev.nightShift,
        morningRamOrder: saved.ram_rotation?.morning || prev.morningRamOrder,
        nightRamOrder: saved.ram_rotation?.night || prev.nightRamOrder,
        lastMorningRam: saved.last_ram_input?.morning || prev.lastMorningRam,
        lastNightRam: saved.last_ram_input?.night || prev.lastNightRam,
      }))
      setSchedule(savedSchedule)
      setStats(computeStats(savedSchedule.grid, savedSchedule.daysInMonth))
      setCalendarRecordId(saved.id)
      setSyncStatus('Calendario cargado desde Supabase')
    } catch (error) {
      setSyncStatus(`Error Supabase: ${error.message}`)
    }
  }, [])

  const handleConfigChange = useCallback((nextConfig) => {
    const monthChanged = nextConfig.month !== config.month || nextConfig.year !== config.year

    if (monthChanged) {
      const previousRam = getPreviousRamContinuity(ramContinuity, nextConfig.year, nextConfig.month)
      setConfig({
        ...nextConfig,
        lastMorningRam: previousRam.morning,
        lastNightRam: previousRam.night,
      })
      setSchedule(null)
      setStats(null)
      setCalendarRecordId(null)
      loadSavedCalendarForMonth(nextConfig.year, nextConfig.month)
      return
    }

    setConfig(nextConfig)
  }, [config.month, config.year, loadSavedCalendarForMonth, ramContinuity])

  const handleGenerate = useCallback(async () => {
    const ramDays = parseDays(config.ramDaysStr)
    const peDays = parseDays(config.peDaysStr)
    const morning = config.morningShift.filter(n => n.trim())
    const night = config.nightShift.filter(n => n.trim())

    if (morning.length === 0 || night.length === 0) {
      alert('Debes tener al menos un técnico en cada turno.')
      return
    }

    const result = generateSchedule(config.year, config.month, ramDays, peDays, morning, night, {
      lastRam: {
        morning: config.lastMorningRam,
        night: config.lastNightRam,
      },
      ramRotation: {
        morning: config.morningRamOrder,
        night: config.nightRamOrder,
      },
    })
    setSchedule(result)
    setStats(computeStats(result.grid, result.daysInMonth))

    if (result.lastRamByShift.morning || result.lastRamByShift.night) {
      const nextContinuity = {
        ...ramContinuity,
        [getMonthKey(config.year, config.month)]: result.lastRamByShift,
      }
      setRamContinuity(nextContinuity)

      if (isSupabaseConfigured) {
        try {
          setSyncStatus('Guardando calendario en Supabase...')
          const saved = await persistCalendar(result.grid, result.warnings, result.lastRamByShift)
          await saveSetting('ram_continuity', nextContinuity)
          setSyncStatus(saved ? 'Calendario guardado en Supabase' : 'Calendario generado')
        } catch (error) {
          setSyncStatus(`Error al guardar: ${error.message}`)
        }
      }
    }
  }, [config, persistCalendar, ramContinuity])

  const handleCellChange = useCallback(async (name, dayIdx, value) => {
    if (!schedule) return
    const previousValue = schedule.grid[name][dayIdx]
    const newGrid = { ...schedule.grid }
    newGrid[name] = [...newGrid[name]]
    newGrid[name][dayIdx] = value || null
    setSchedule({ ...schedule, grid: newGrid })
    setStats(computeStats(newGrid, schedule.daysInMonth))

    if (isSupabaseConfigured) {
      try {
        setSyncStatus('Guardando cambio...')
        const saved = await persistCalendar(newGrid, schedule.warnings, schedule.lastRamByShift)
        await logScheduleChange({
          calendar_id: saved?.id || calendarRecordId,
          year: config.year,
          month: config.month,
          technician: name,
          day: dayIdx + 1,
          previous_assignment: previousValue,
          new_assignment: value || null,
          changed_by: 'Campo',
        })
        setSyncStatus('Cambio guardado en Supabase')
      } catch (error) {
        setSyncStatus(`Error al guardar cambio: ${error.message}`)
      }
    }
  }, [calendarRecordId, config.month, config.year, persistCalendar, schedule])

  const handleExport = useCallback(() => {
    if (!schedule) return
    const ramDays = parseDays(config.ramDaysStr)
    const peDays = parseDays(config.peDaysStr)
    const morning = config.morningShift.filter(n => n.trim())
    const night = config.nightShift.filter(n => n.trim())
    exportToExcel(schedule.grid, schedule.daysInMonth, config.year, config.month, morning, night, ramDays, peDays)
  }, [schedule, config])

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white px-6 py-4 shadow-lg">
        <h1 className="text-xl font-bold">Generador de Horarios de Trabajo</h1>
        <p className="text-blue-200 text-sm">Cronograma mensual de turnos - Aeropuerto</p>
      </header>

      <main className="max-w-[98vw] mx-auto px-4 py-6">
        <ConfigPanel config={config} onConfigChange={handleConfigChange} onGenerate={handleGenerate} />

        <div className="mb-4 text-xs text-gray-600">
          {syncStatus}
        </div>

        {schedule && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">
                Cronograma {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][config.month]} {config.year}
              </h2>
              <button
                onClick={handleExport}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm cursor-pointer"
              >
                Exportar a Excel
              </button>
            </div>

            <Legend />

            <ScheduleGrid
              grid={schedule.grid}
              daysInMonth={schedule.daysInMonth}
              year={config.year}
              month={config.month}
              morningShift={config.morningShift.filter(n => n.trim())}
              nightShift={config.nightShift.filter(n => n.trim())}
              onCellChange={handleCellChange}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StatsTable
                stats={stats}
                morningShift={config.morningShift.filter(n => n.trim())}
                nightShift={config.nightShift.filter(n => n.trim())}
              />
              <ValidationList warnings={schedule.warnings} />
            </div>
          </>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-4">
        Generador de Horarios v1.0
      </footer>
    </div>
  )
}
