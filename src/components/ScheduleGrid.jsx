import { useState } from 'react'
import { ASSIGNMENTS, COLORS, DAY_NAMES, NO_A3_WEEKDAYS } from '../engine/constants'

const ASSIGNMENT_OPTIONS = Object.values(ASSIGNMENTS)

export default function ScheduleGrid({ grid, daysInMonth, year, month, morningShift, nightShift, onCellChange }) {
  const [editingCell, setEditingCell] = useState(null)

  const getWeekday = (day) => new Date(year, month, day).getDay()
  const isWeekend = (day) => [0, 6].includes(getWeekday(day))
  const isNoA3 = (day) => NO_A3_WEEKDAYS.includes(getWeekday(day))

  const handleCellClick = (name, dayIdx) => {
    setEditingCell({ name, dayIdx })
  }

  const handleSelect = (name, dayIdx, value) => {
    onCellChange(name, dayIdx, value)
    setEditingCell(null)
  }

  const countL = (name) => {
    return grid[name]?.filter(v => v === ASSIGNMENTS.L).length || 0
  }

  const renderShift = (shiftLabel, shiftTime, staff) => (
    <>
      <tr>
        <td
          rowSpan={staff.length}
          className="border border-gray-300 px-2 py-1 text-center font-bold text-sm bg-gray-100 align-middle whitespace-nowrap"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {shiftLabel}
          <br />
          <span className="text-xs font-normal text-gray-500">{shiftTime}</span>
        </td>
        {renderRow(staff[0])}
      </tr>
      {staff.slice(1).map(name => (
        <tr key={name}>
          {renderRow(name)}
        </tr>
      ))}
    </>
  )

  const renderRow = (name) => {
    if (!grid[name]) return null
    return (
      <>
        <td className="border border-gray-300 px-2 py-1 text-sm font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-white z-10">
          {name}
        </td>
        {Array.from({ length: daysInMonth }, (_, d) => {
          const val = grid[name][d]
          const color = val ? COLORS[val] : { bg: '#ffffff', text: '#9ca3af' }
          const isEditing = editingCell?.name === name && editingCell?.dayIdx === d

          return (
            <td
              key={d}
              className="border border-gray-300 text-center text-xs font-semibold cursor-pointer relative min-w-[36px]"
              style={{ backgroundColor: color.bg, color: color.text }}
              onClick={() => handleCellClick(name, d)}
            >
              {isEditing ? (
                <select
                  autoFocus
                  className="absolute inset-0 w-full h-full text-xs bg-white text-gray-800 z-20"
                  value={val || ''}
                  onChange={(e) => handleSelect(name, d, e.target.value)}
                  onBlur={() => setEditingCell(null)}
                >
                  <option value="">—</option>
                  {ASSIGNMENT_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <span className="block py-1">{val || '—'}</span>
              )}
            </td>
          )
        })}
        <td className="border border-gray-300 px-2 py-1 text-center text-sm font-bold bg-gray-50">
          {countL(name)}
        </td>
      </>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-md mb-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="border-collapse w-full text-center">
          <thead>
            <tr>
              <th className="border border-gray-300 px-2 py-1 bg-gray-200 text-xs sticky left-0 z-20">TURNO</th>
              <th className="border border-gray-300 px-2 py-1 bg-gray-200 text-xs sticky left-0 z-20">NOMBRE</th>
              {Array.from({ length: daysInMonth }, (_, d) => {
                const day = d + 1
                const wd = getWeekday(day)
                const weekend = isWeekend(day)
                const noA3 = isNoA3(day)
                return (
                  <th
                    key={d}
                    className={`border border-gray-300 px-1 py-1 text-xs min-w-[36px] ${
                      weekend ? 'bg-amber-100' : noA3 ? 'bg-red-50' : 'bg-gray-200'
                    }`}
                  >
                    <div className="leading-tight">
                      <div className={`font-bold ${weekend ? 'text-amber-700' : ''}`}>{DAY_NAMES[wd]}</div>
                      <div>{day}</div>
                    </div>
                  </th>
                )
              })}
              <th className="border border-gray-300 px-2 py-1 bg-gray-200 text-xs">L</th>
            </tr>
          </thead>
          <tbody>
            {renderShift('MAÑANA', '08:00–15:00', morningShift)}
            <tr>
              <td colSpan={daysInMonth + 3} className="h-2 bg-gray-800"></td>
            </tr>
            {renderShift('NOCHE', '15:30–24:00', nightShift)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
