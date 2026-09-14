export type StageKind = 'prospect' | 'applied' | 'assessment' | 'interview' | 'offer' | 'closed'

export interface Stage {
  id: string
  name: string
  kind: StageKind
  color: string
  terminal?: boolean
  outcome?: 'positive' | 'negative' | 'neutral'
}

export interface PipelineTemplate {
  id: string
  name: string
  description: string
  stages: Stage[]
}

export interface HistoryEntry {
  id: string
  stageId: string
  stageName: string
  date: string
  note?: string
}

export interface Application {
  id: string
  company: string
  role: string
  department?: string
  city: string
  channel: string
  salary?: string
  jobUrl?: string
  priority: 'high' | 'medium' | 'low'
  pipelineId: string
  stageId: string
  appliedAt: string
  updatedAt: string
  nextAction?: string
  nextActionAt?: string
  contact?: string
  notes?: string
  tags: string[]
  history: HistoryEntry[]
}

export interface AppData {
  applications: Application[]
  pipelines: PipelineTemplate[]
}

export type ViewKey = 'overview' | 'applications' | 'board' | 'schedule' | 'analytics' | 'pipelines'
