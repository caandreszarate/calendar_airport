import { useState, useCallback } from 'react'
import ConfigPanel from './components/ConfigPanel'
import ScheduleGrid from './components/ScheduleGrid'
import Legend from './components/Legend'
import StatsTable from './components/StatsTable'
import ValidationList from './components/ValidationList'
import { generateSchedule, computeStats } from './engine/scheduler'
import { exportToExcel } from './engine/excelExport'
import { DEFAULT_MORNING_SHIFT, DEFAULT_NIGHT_SHIFT } from './engine/constants'

function parseDays(str) {
  return str
    .split(',')
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n) && n > 0)
}

export default function App() {
  const now = new Date()

  const [config, setConfig] = useState({
    month: now.getMonth(),
    year: now.getFullYear(),
    ramDaysStr: '1, 3, 5, 8, 12, 15, 19, 22, 26, 29',
    peDaysStr: '3, 10, 17, 24',
    morningShift: [...DEFAULT_MORNING_SHIFT],
    nightShift: [...DEFAULT_NIGHT_SHIFT],
  })

  const [schedule, setSchedule] = useState(null)
  const [stats, setStats] = useState(null)

  const handleGenerate = useCallback(() => {
    const ramDays = parseDays(config.ramDaysStr)
    const peDays = parseDays(config.peDaysStr)
    const morning = config.morningShift.filter(n => n.trim())
    const night = config.nightShift.filter(n => n.trim())

    if (morning.length === 0 || night.length === 0) {
      alert('Debes tener al menos un técnico en cada turno.')
      return
    }

    const result = generateSchedule(config.year, config.month, ramDays, peDays, morning, night)
    setSchedule(result)
    setStats(computeStats(result.grid, result.daysInMonth))
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
        <ConfigPanel config={config} onConfigChange={setConfig} onGenerate={handleGenerate} />

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
