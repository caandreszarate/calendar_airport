import { useState } from 'react'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function ConfigPanel({ config, onConfigChange, onGenerate }) {
  const [showStaff, setShowStaff] = useState(false)

  const handleMonthChange = (e) => {
    onConfigChange({ ...config, month: parseInt(e.target.value) })
  }

  const handleYearChange = (e) => {
    onConfigChange({ ...config, year: parseInt(e.target.value) })
  }

  const handleRamChange = (e) => {
    onConfigChange({ ...config, ramDaysStr: e.target.value })
  }

  const handlePeChange = (e) => {
    onConfigChange({ ...config, peDaysStr: e.target.value })
  }

  const handleStaffChange = (shift, index, value) => {
    const key = shift === 'morning' ? 'morningShift' : 'nightShift'
    const updated = [...config[key]]
    updated[index] = value
    onConfigChange({ ...config, [key]: updated })
  }

  const addStaff = (shift) => {
    const key = shift === 'morning' ? 'morningShift' : 'nightShift'
    onConfigChange({ ...config, [key]: [...config[key], ''] })
  }

  const removeStaff = (shift, index) => {
    const key = shift === 'morning' ? 'morningShift' : 'nightShift'
    const updated = config[key].filter((_, i) => i !== index)
    onConfigChange({ ...config, [key]: updated })
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Configuración del Mes</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
          <select
            value={config.month}
            onChange={handleMonthChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
          <input
            type="number"
            value={config.year}
            onChange={handleYearChange}
            min={2024}
            max={2030}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Días RAM <span className="text-gray-400">(separados por coma)</span>
          </label>
          <input
            type="text"
            value={config.ramDaysStr}
            onChange={handleRamChange}
            placeholder="1, 3, 5, 8, 12, 15, 19, 22, 26, 29"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Días PE <span className="text-gray-400">(separados por coma)</span>
          </label>
          <input
            type="text"
            value={config.peDaysStr}
            onChange={handlePeChange}
            placeholder="3, 10, 17, 24"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onGenerate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          Generar Horario
        </button>

        <button
          onClick={() => setShowStaff(!showStaff)}
          className="text-sm text-gray-600 hover:text-gray-800 underline cursor-pointer"
        >
          {showStaff ? 'Ocultar personal' : 'Editar personal'}
        </button>
      </div>

      {showStaff && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
          {[
            { key: 'morning', label: 'Turno Mañana (08:00 – 15:00)', list: config.morningShift },
            { key: 'night', label: 'Turno Noche (15:30 – 24:00)', list: config.nightShift },
          ].map(({ key, label, list }) => (
            <div key={key}>
              <h3 className="font-semibold text-sm text-gray-700 mb-2">{label}</h3>
              {list.map((name, i) => (
                <div key={i} className="flex items-center gap-2 mb-1">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleStaffChange(key, i, e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => removeStaff(key, i)}
                    className="text-red-500 hover:text-red-700 text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => addStaff(key)}
                className="text-blue-600 hover:text-blue-800 text-sm mt-1 cursor-pointer"
              >
                + Agregar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
