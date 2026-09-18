import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { Application, HistoryEntry, PipelineTemplate, Stage, StageKind } from './types'

export const kindLabels: Record<StageKind, string> = {
  prospect: '待投递',
  applied: '已投递',
  assessment: '测评 / 笔试',
  interview: '面试',
  offer: 'Offer',
  closed: '已结束',
}

export const priorityLabels = { high: '高', medium: '中', low: '低' }

export function normalizeHistory(history: HistoryEntry[]) {
  const ordered = [...history].sort((a, b) => a.date.localeCompare(b.date))
  return ordered.reduce<HistoryEntry[]>((result, entry) => {
    const previous = result.at(-1)
    if (previous?.stageId === entry.stageId) {
      if (!previous.note && entry.note) result[result.length - 1] = { ...previous, note: entry.note }
      return result
    }
    if (result.some((item) => item.id === entry.id)) return result
    result.push(entry)
    return result
  }, [])
}

export function getPipeline(pipelines: PipelineTemplate[], pipelineId: string) {
  return pipelines.find((item) => item.id === pipelineId) ?? pipelines[0]
}

export function getStage(pipelines: PipelineTemplate[], application: Application): Stage | undefined {
  return getPipeline(pipelines, application.pipelineId)?.stages.find((item) => item.id === application.stageId)
}

export function isActive(pipelines: PipelineTemplate[], application: Application) {
  const kind = getStage(pipelines, application)?.kind
  return kind !== 'offer' && kind !== 'closed'
}

export function shortDate(value?: string) {
  if (!value) return '—'
  return format(parseISO(value), 'M月d日', { locale: zhCN })
}

export function fullDate(value?: string) {
  if (!value) return '—'
  return format(parseISO(value), 'yyyy年M月d日 HH:mm', { locale: zhCN })
}

export function relativeDue(value?: string) {
  if (!value) return { text: '未安排', tone: 'muted' }
  const days = differenceInCalendarDays(parseISO(value), new Date())
  if (days < 0) return { text: `已逾期 ${Math.abs(days)} 天`, tone: 'danger' }
  if (days === 0) return { text: '今天', tone: 'danger' }
  if (days === 1) return { text: '明天', tone: 'warning' }
  if (days <= 3) return { text: `${days} 天后`, tone: 'warning' }
  return { text: shortDate(value), tone: 'muted' }
}

export function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

export function escapeCsv(value: unknown) {
  const string = String(value ?? '')
  return `"${string.replaceAll('"', '""')}"`
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
