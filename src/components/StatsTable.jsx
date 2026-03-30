import { COLORS } from '../engine/constants'

const CODES = ['RAM', 'PE', 'A1', 'A2', 'A3', 'L']

export default function StatsTable({ stats, morningShift, nightShift }) {
  if (!stats || Object.keys(stats).length === 0) return null

  const renderShiftStats = (label, shift) => {
    // Check balance
    const ramCounts = shift.map(n => stats[n]?.RAM || 0)
    const lCounts = shift.map(n => stats[n]?.L || 0)
    const ramDiff = Math.max(...ramCounts) - Math.min(...ramCounts)
    const lDiff = Math.max(...lCounts) - Math.min(...lCounts)

    return (
      <>
        <tr>
          <td colSpan={CODES.length + 2} className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5">
            {label}
          </td>
        </tr>
        {shift.map(name => {
          const s = stats[name] || {}
          return (
            <tr key={name} className="hover:bg-gray-50">
              <td className="border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-800">{name}</td>
              {CODES.map(code => (
                <td
                  key={code}
                  className="border border-gray-200 px-2 py-1.5 text-center text-sm font-semibold"
                  style={{ color: COLORS[code].bg }}
                >
                  {s[code] || 0}
                </td>
              ))}
              <td className="border border-gray-200 px-2 py-1.5 text-center text-sm font-bold text-gray-700">
                {CODES.reduce((sum, c) => sum + (s[c] || 0), 0)}
              </td>
            </tr>
          )
        })}
        {(ramDiff > 1 || lDiff > 1) && (
          <tr>
            <td colSpan={CODES.length + 2} className="text-xs px-3 py-1">
              {ramDiff > 1 && <span className="text-amber-600 mr-3">RAM desbalance: {ramDiff}</span>}
              {lDiff > 1 && <span className="text-amber-600">Libres desbalance: {lDiff}</span>}
            </td>
          </tr>
        )}
      </>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
      <div className="p-4 pb-2">
        <h3 className="text-sm font-bold text-gray-700">Resumen Estadístico</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600">Técnico</th>
              {CODES.map(code => (
                <th
                  key={code}
                  className="border border-gray-200 px-2 py-2 text-center text-xs font-bold"
                  style={{ color: COLORS[code].bg }}
                >
                  {code}
                </th>
              ))}
              <th className="border border-gray-200 px-2 py-2 text-center text-xs font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {renderShiftStats('TURNO MAÑANA', morningShift)}
            {renderShiftStats('TURNO NOCHE', nightShift)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
