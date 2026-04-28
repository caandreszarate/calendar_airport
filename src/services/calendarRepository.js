import { isSupabaseConfigured, supabaseRequest } from '../lib/supabaseClient'

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado.')
  }
}

function encodeFilter(value) {
  return encodeURIComponent(value)
}

export async function loadSetting(key) {
  requireSupabase()

  const rows = await supabaseRequest(`app_settings?select=value&key=eq.${encodeFilter(key)}`)
  return rows?.[0]?.value || null
}

export async function saveSetting(key, value) {
  requireSupabase()

  await supabaseRequest('app_settings?on_conflict=key', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      key,
      value,
      updated_at: new Date().toISOString(),
    }),
  })
}

export async function loadCalendar(year, month) {
  requireSupabase()

  const rows = await supabaseRequest(`calendars?select=*&year=eq.${year}&month=eq.${month}`)
  return rows?.[0] || null
}

export async function saveCalendar(calendar) {
  requireSupabase()

  const rows = await supabaseRequest('calendars?on_conflict=year,month', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      ...calendar,
      updated_at: new Date().toISOString(),
    }),
  })

  return rows?.[0] || null
}

export async function logScheduleChange(change) {
  requireSupabase()

  await supabaseRequest('schedule_change_logs', {
    method: 'POST',
    headers: {
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(change),
  })
}
