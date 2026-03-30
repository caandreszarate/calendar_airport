import { COLORS } from '../engine/constants'

const ITEMS = [
  { code: 'RAM', label: 'Royal Air Maroc' },
  { code: 'PE', label: 'Punta Europa' },
  { code: 'A1', label: 'Área 1' },
  { code: 'A2', label: 'Área 2 (prioridad)' },
  { code: 'A3', label: 'Área 3' },
  { code: 'L', label: 'Libre / Descanso' },
]

export default function Legend() {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 mb-6">
      <h3 className="text-sm font-bold text-gray-700 mb-2">Leyenda</h3>
      <div className="flex flex-wrap gap-3">
        {ITEMS.map(({ code, label }) => (
          <div key={code} className="flex items-center gap-1.5">
            <span
              className="inline-block w-8 h-6 rounded text-center text-xs font-bold leading-6"
              style={{ backgroundColor: COLORS[code].bg, color: COLORS[code].text }}
            >
              {code}
            </span>
            <span className="text-xs text-gray-600">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-4">
          <span className="inline-block w-8 h-6 rounded bg-amber-100 border border-amber-300"></span>
          <span className="text-xs text-gray-600">Fin de semana</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-8 h-6 rounded bg-red-50 border border-red-200"></span>
          <span className="text-xs text-gray-600">Sin A3 (Lun/Jue/Sáb)</span>
        </div>
      </div>
    </div>
  )
}
