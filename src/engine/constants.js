export const ASSIGNMENTS = {
  RAM: 'RAM',
  PE: 'PE',
  A1: 'A1',
  A2: 'A2',
  A3: 'A3',
  L: 'L',
}

export const COLORS = {
  RAM: { bg: '#dc2626', text: '#ffffff' },
  PE: { bg: '#7c3aed', text: '#ffffff' },
  A1: { bg: '#2563eb', text: '#ffffff' },
  A2: { bg: '#059669', text: '#ffffff' },
  A3: { bg: '#d97706', text: '#ffffff' },
  L: { bg: '#e5e7eb', text: '#374151' },
}

export const DAY_NAMES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
export const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export const DEFAULT_MORNING_SHIFT = [
  'Teodora',
  'Melania NFA',
  'Sofía',
  'Karina',
  'Silvia',
  'Alberto',
]

export const DEFAULT_NIGHT_SHIFT = [
  'Vicente',
  'Lorenzo',
  'Priscila',
  'Husein',
  'Juan',
  'Petronila',
]

export const DEFAULT_RAM_ROTATION = {
  morning: ['Melania NFA', 'Alberto', 'Silvia', 'Teodora', 'Sofía', 'Karina'],
  night: ['Priscila', 'Juan', 'Lorenzo', 'Vicente', 'Husein', 'Petronila'],
}

export const INITIAL_RAM_CONTINUITY = {
  '2026-3': {
    morning: 'Teodora',
    night: 'Vicente',
  },
}

// Días donde NO se atiende A3: lunes (1), jueves (4), sábado (6)
export const NO_A3_WEEKDAYS = [1, 4, 6]
