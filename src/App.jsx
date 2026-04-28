import { useState, useCallback, useEffect } from 'react'
import ConfigPanel from './components/ConfigPanel'
import ScheduleGrid from './components/ScheduleGrid'
import Legend from './components/Legend'
import StatsTable from './components/StatsTable'
import ValidationList from './components/ValidationList'
import { generateSchedule, computeStats } from './engine/scheduler'
import { exportToExcel } from './engine/excelExport'
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

  useEffect(() => {
    window.localStorage.setItem(RAM_CONTINUITY_STORAGE_KEY, JSON.stringify(ramContinuity))
  }, [ramContinuity])

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
      return
    }

    setConfig(nextConfig)
  }, [config.month, config.year, ramContinuity])

  const handleGenerate = useCallback(() => {
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
      setRamContinuity(prev => ({
        ...prev,
        [getMonthKey(config.year, config.month)]: result.lastRamByShift,
      }))
    }
  }, [config])

  const handleCellChange = useCallback((name, dayIdx, value) => {
    if (!schedule) return
    const newGrid = { ...schedule.grid }
    newGrid[name] = [...newGrid[name]]
    newGrid[name][dayIdx] = value || null
    setSchedule({ ...schedule, grid: newGrid })
    setStats(computeStats(newGrid, schedule.daysInMonth))
  }, [schedule])

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
