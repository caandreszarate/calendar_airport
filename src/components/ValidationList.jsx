export default function ValidationList({ warnings }) {
  if (!warnings || warnings.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <p className="text-green-700 text-sm font-medium">
          Todas las validaciones pasaron correctamente.
        </p>
      </div>
    )
  }

  const errors = warnings.filter(w => w.type === 'error')
  const warns = warnings.filter(w => w.type === 'warning')

  return (
    <div className="bg-white rounded-xl shadow-md p-4 mb-6">
      <h3 className="text-sm font-bold text-gray-700 mb-3">Validaciones</h3>

      {errors.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold text-red-600 mb-1">Errores ({errors.length})</h4>
          <ul className="space-y-1">
            {errors.map((w, i) => (
              <li key={i} className="text-sm text-red-700 bg-red-50 px-3 py-1.5 rounded">
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warns.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-amber-600 mb-1">Advertencias ({warns.length})</h4>
          <ul className="space-y-1">
            {warns.map((w, i) => (
              <li key={i} className="text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded">
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
