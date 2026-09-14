import type { AppData } from './types'
import { seedData } from './seed'

const STORAGE_KEY = 'offer-flow-autumn-recruitment-v1'
const LEGACY_STORAGE_KEYS = ['zhixu-autumn-recruitment-v1', 'flowline-autumn-recruitment-v1']

export function loadData(): AppData {
  try {
    const legacyRaw = LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
    const raw = localStorage.getItem(STORAGE_KEY) ?? legacyRaw
    if (raw) {
      const parsed = JSON.parse(raw) as AppData
      localStorage.setItem(STORAGE_KEY, raw)
      return parsed
    }
  } catch {
    // Fall back to demo data if local data is malformed.
  }
  return structuredClone(seedData)
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function resetData() {
  const next = structuredClone(seedData)
  saveData(next)
  return next
}
