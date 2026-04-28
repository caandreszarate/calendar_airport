import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado.')
  }
}

export async function loadSetting(key) {
  requireSupabase()

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error) throw error
  return data?.value || null
}

export async function saveSetting(key, value) {
  requireSupabase()

  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })

  if (error) throw error
}

export async function loadCalendar(year, month) {
  requireSupabase()

  const { data, error } = await supabase
    .from('calendars')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function saveCalendar(calendar) {
  requireSupabase()

  const { data, error } = await supabase
    .from('calendars')
    .upsert(
      {
        ...calendar,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'year,month' },
    )
    .select()
    .single()

  if (error) throw error
  return data
}

export async function logScheduleChange(change) {
  requireSupabase()

  const { error } = await supabase
    .from('schedule_change_logs')
    .insert(change)

  if (error) throw error
}
