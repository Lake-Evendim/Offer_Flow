import type { AppData } from './types'
import { seedData } from './seed'
import { normalizeHistory } from './utils'

const STORAGE_KEY = 'offer-flow-autumn-recruitment-v1'
const LEGACY_STORAGE_KEYS = ['zhixu-autumn-recruitment-v1', 'flowline-autumn-recruitment-v1']
const CALENDAR_DENSITY_SAMPLE_KEY = 'offer-flow-calendar-density-sample-v2'
const PRESSURE_SEED_MIGRATION_KEY = 'offer-flow-pressure-seed-112-v3'

function normalizeDataHistories(data: AppData): AppData {
  return {
    ...data,
    applications: data.applications.map((application) => ({
      ...application,
      history: normalizeHistory(application.history),
    })),
  }
}

function applyCalendarDensitySample(data: AppData) {
  if (localStorage.getItem(CALENDAR_DENSITY_SAMPLE_KEY)) return data
  const sampleTimes: Record<string, string> = {
    'app-1': '2026-09-17T19:30',
    'app-2': '2026-09-17T14:00',
    'app-3': '2026-09-17T09:00',
    'app-4': '2026-09-17T20:00',
    'app-6': '2026-09-17T21:00',
    'app-10': '2026-09-17T18:00',
  }
  const isDemoDataset = Object.keys(sampleTimes).every((id) => data.applications.some((application) => application.id === id))
  if (!isDemoDataset) return data
  const next = {
    ...data,
    applications: data.applications.map((application) => sampleTimes[application.id]
      ? { ...application, nextActionAt: sampleTimes[application.id] }
      : application),
  }
  localStorage.setItem(CALENDAR_DENSITY_SAMPLE_KEY, '1')
  return next
}

export function loadData(): AppData {
  try {
    const legacyRaw = LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
    const raw = localStorage.getItem(STORAGE_KEY) ?? legacyRaw
    if (raw) {
      const parsed = JSON.parse(raw) as AppData
      const hasOriginalDemo = Array.from({ length: 12 }, (_, index) => `app-${index + 1}`)
        .every((id) => parsed.applications.some((application) => application.id === id))
      const isManagedDemo = hasOriginalDemo && (
        parsed.applications.length === 12
        || (parsed.applications.length === 112 && parsed.applications.some((application) => application.id === 'generated-app-100'))
      )
      if (isManagedDemo && !localStorage.getItem(PRESSURE_SEED_MIGRATION_KEY)) {
        const pressureSeed = normalizeDataHistories(structuredClone(seedData))
        localStorage.setItem(PRESSURE_SEED_MIGRATION_KEY, '1')
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pressureSeed))
        return pressureSeed
      }
      const stageRedirects = new Map<string, { id: string; name: string }>()
      const pipelines = parsed.pipelines.map((pipeline) => {
        const renamed = pipeline.name === '新流程模板'
          ? { ...pipeline, name: '新公司类型', description: pipeline.description === '根据目标企业调整阶段。' ? '根据这类公司的招聘特点调整阶段。' : pipeline.description }
          : pipeline
        const retainedStages = renamed.stages.filter((stage) => stage.kind !== 'prospect')
        const fallback = retainedStages[0] ?? { id: `${renamed.id}-applied`, name: '已投递', kind: 'applied' as const, color: '#315f55' }
        renamed.stages.filter((stage) => stage.kind === 'prospect').forEach((stage) => {
          stageRedirects.set(stage.id, { id: fallback.id, name: fallback.name })
        })
        return { ...renamed, stages: retainedStages.length ? retainedStages : [fallback] }
      })
      const migrated = {
        ...parsed,
        pipelines,
        applications: parsed.applications.map((application) => {
          const redirect = stageRedirects.get(application.stageId)
          return {
            ...application,
            stageId: redirect?.id ?? application.stageId,
            history: application.history.map((entry) => {
              const historyRedirect = stageRedirects.get(entry.stageId)
              return historyRedirect ? { ...entry, stageId: historyRedirect.id, stageName: historyRedirect.name } : entry
            }),
          }
        }),
      }
      const next = normalizeDataHistories(applyCalendarDensitySample(migrated))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    }
  } catch {
    // Fall back to demo data if local data is malformed.
  }
  return applyCalendarDensitySample(structuredClone(seedData))
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeDataHistories(data)))
}

export function resetData() {
  const next = structuredClone(seedData)
  saveData(next)
  return next
}
