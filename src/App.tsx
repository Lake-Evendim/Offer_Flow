import { type ChangeEvent, type DragEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDown, ArrowRight, ArrowUp, BarChart3, Bell, BriefcaseBusiness, Building2,
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDashed, Clock3, Download,
  ExternalLink, FileText, Filter, Flag, GripVertical, Import, KanbanSquare, LayoutDashboard,
  ListFilter, MapPin, Menu, MoreHorizontal, PencilLine, Plus, RotateCcw, Search, Settings2,
  Sparkles, Target, Trash2, TrendingUp, Upload, UserRound, X,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  parseISO, startOfMonth, startOfWeek, subMonths, subWeeks,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { AppData, Application, PipelineTemplate, Stage, StageKind, ViewKey } from './types'
import { loadData, resetData, saveData } from './storage'
import {
  average, escapeCsv, fullDate, getPipeline, getStage, isActive, kindLabels, priorityLabels,
  relativeDue, shortDate, uid,
} from './utils'

const navItems: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: '工作台', icon: LayoutDashboard },
  { key: 'applications', label: '投递记录', icon: BriefcaseBusiness },
  { key: 'board', label: '流程看板', icon: KanbanSquare },
  { key: 'schedule', label: '日程计划', icon: CalendarDays },
  { key: 'analytics', label: '数据分析', icon: BarChart3 },
  { key: 'pipelines', label: '流程配置', icon: Settings2 },
]

const viewMeta: Record<ViewKey, { title: string; description: string }> = {
  overview: { title: '晚上好，祝你离理想 Offer 更近一步', description: '把注意力放在下一步，而不是散落的信息里。' },
  applications: { title: '投递记录', description: '按公司、岗位和流程阶段管理每一次机会。' },
  board: { title: '流程看板', description: '按企业流程查看进展，拖动卡片即可更新阶段。' },
  schedule: { title: '日程计划', description: '集中查看笔试、面试与待办，不错过关键节点。' },
  analytics: { title: '数据分析', description: '找到渠道、流程和节奏中的真正瓶颈。' },
  pipelines: { title: '流程配置', description: '为不同企业类型建立独立、可跳转的招聘流程。' },
}

function Logo() {
  return (
    <div className="brand-mark" aria-label="Offer Flow">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M5 22.5c4.6-1.3 7.2-4.1 8.2-8.5.8-3.6 3.3-5.7 7.4-6.3" />
        <path d="M8.2 26c6.2-.8 10.4-4.1 12.6-10 1.2-3.2 3.2-5.2 6.2-6" />
        <circle cx="7" cy="22" r="2" />
        <circle cx="21" cy="8" r="2" />
        <circle cx="26" cy="10" r="2" />
      </svg>
    </div>
  )
}

function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [view, setView] = useState<ViewKey>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ open: boolean; application?: Application }>({ open: false })
  const [toast, setToast] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => saveData(data), [data])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const selected = data.applications.find((item) => item.id === selectedId)

  function updateApplication(id: string, updates: Partial<Application>, note?: string) {
    setData((current) => ({
      ...current,
      applications: current.applications.map((application) => {
        if (application.id !== id) return application
        let history = application.history
        if (updates.stageId && updates.stageId !== application.stageId) {
          const pipeline = getPipeline(current.pipelines, application.pipelineId)
          const nextStage = pipeline.stages.find((stage) => stage.id === updates.stageId)
          if (nextStage) {
            history = [...history, {
              id: uid('history'), stageId: nextStage.id, stageName: nextStage.name,
              date: new Date().toISOString(), note,
            }]
          }
        }
        return { ...application, ...updates, history, updatedAt: new Date().toISOString() }
      }),
    }))
  }

  function upsertApplication(application: Application) {
    setData((current) => {
      const exists = current.applications.some((item) => item.id === application.id)
      return {
        ...current,
        applications: exists
          ? current.applications.map((item) => item.id === application.id ? application : item)
          : [application, ...current.applications],
      }
    })
    setToast(modal.application ? '投递记录已更新' : '已添加新的投递记录')
    setModal({ open: false })
  }

  function deleteApplication(id: string) {
    setData((current) => ({ ...current, applications: current.applications.filter((item) => item.id !== id) }))
    setSelectedId(null)
    setToast('记录已删除')
  }

  function download(content: string, fileName: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function exportJson() {
    download(JSON.stringify(data, null, 2), `Offer-Flow-完整备份-${format(new Date(), 'yyyyMMdd')}.json`, 'application/json')
    setToast('JSON 备份已导出')
  }

  function exportCsv() {
    const headers = ['公司', '岗位', '城市', '渠道', '优先级', '流程', '当前阶段', '投递日期', '下一步', '下一步时间', '标签', '备注']
    const rows = data.applications.map((item) => {
      const pipeline = getPipeline(data.pipelines, item.pipelineId)
      const stage = getStage(data.pipelines, item)
      return [item.company, item.role, item.city, item.channel, priorityLabels[item.priority], pipeline.name, stage?.name, item.appliedAt, item.nextAction, item.nextActionAt, item.tags.join(' / '), item.notes]
    })
    const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
    download(csv, `Offer-Flow-投递记录-${format(new Date(), 'yyyyMMdd')}.csv`, 'text/csv;charset=utf-8')
    setToast('CSV 已导出')
  }

  function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const next = JSON.parse(String(reader.result)) as AppData
        if (!Array.isArray(next.applications) || !Array.isArray(next.pipelines)) throw new Error('invalid')
        setData(next)
        setToast('数据已成功导入')
      } catch {
        setToast('导入失败：文件格式不正确')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const pageProps = { data, setData, openApplication: setSelectedId, updateApplication }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand"><Logo /><span>Offer Flow</span></div>
        <div className="workspace-switcher">
          <div className="workspace-avatar">秋</div>
          <div><strong>2027 秋招</strong><span>{data.applications.length} 条投递记录</span></div>
          <ChevronDown size={15} />
        </div>
        <nav className="sidebar-nav">
          <p className="nav-label">工作空间</p>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.key} className={view === item.key ? 'active' : ''} onClick={() => { setView(item.key); setSidebarOpen(false) }}>
                <Icon size={18} strokeWidth={1.8} /><span>{item.label}</span>
                {item.key === 'schedule' && <i className="nav-dot" />}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="season-progress">
            <div><span>秋招季进度</span><strong>68%</strong></div>
            <div className="mini-progress"><i style={{ width: '68%' }} /></div>
            <p>保持节奏，优先推进高价值机会</p>
          </div>
          <button className="profile-row"><span className="profile-avatar">Q</span><span><strong>我的求职空间</strong><small>数据仅保存在本机</small></span><MoreHorizontal size={17} /></button>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen((value) => !value)}><Menu size={20} /></button>
          <div className="global-search"><Search size={17} /><input placeholder="搜索公司、岗位或标签" onFocus={() => view !== 'applications' && setView('applications')} /><kbd>⌘ K</kbd></div>
          <div className="topbar-actions">
            <button className="icon-button has-badge" aria-label="提醒"><Bell size={18} /></button>
            <button className="primary-button" onClick={() => setModal({ open: true })}><Plus size={17} /> 新增投递</button>
          </div>
        </header>

        <div className="page-wrap">
          <div className="page-heading">
            <div><h1>{viewMeta[view].title}</h1><p>{viewMeta[view].description}</p></div>
            {view === 'overview' && <div className="date-stamp"><CalendarDays size={16} /> {format(new Date(), 'M月d日 EEEE', { locale: zhCN })}</div>}
          </div>

          {view === 'overview' && <Overview {...pageProps} setView={setView} />}
          {view === 'applications' && <Applications {...pageProps} onAdd={() => setModal({ open: true })} />}
          {view === 'board' && <Board {...pageProps} />}
          {view === 'schedule' && <Schedule {...pageProps} />}
          {view === 'analytics' && <Analytics data={data} />}
          {view === 'pipelines' && (
            <PipelineSettings
              data={data}
              onChange={(pipelines) => setData((current) => ({ ...current, pipelines }))}
              onExportJson={exportJson}
              onExportCsv={exportCsv}
              onImport={() => importRef.current?.click()}
              onReset={() => { setData(resetData()); setToast('已恢复演示数据') }}
            />
          )}
        </div>
      </main>

      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="关闭菜单" />}
      <input ref={importRef} className="hidden-input" type="file" accept="application/json,.json" onChange={importJson} />
      {modal.open && <ApplicationModal pipelines={data.pipelines} application={modal.application} onClose={() => setModal({ open: false })} onSave={upsertApplication} />}
      {selected && (
        <ApplicationDrawer
          application={selected}
          pipelines={data.pipelines}
          onClose={() => setSelectedId(null)}
          onStageChange={(stageId) => updateApplication(selected.id, { stageId })}
          onEdit={() => setModal({ open: true, application: selected })}
          onDelete={() => deleteApplication(selected.id)}
        />
      )}
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </div>
  )
}

type PageProps = {
  data: AppData
  setData: React.Dispatch<React.SetStateAction<AppData>>
  openApplication: (id: string) => void
  updateApplication: (id: string, updates: Partial<Application>, note?: string) => void
}

function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="section-header"><div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>
}

function StagePill({ stage }: { stage?: Stage }) {
  if (!stage) return <span className="stage-pill">未设置</span>
  return <span className="stage-pill" style={{ '--stage-color': stage.color } as React.CSSProperties}><i />{stage.name}</span>
}

function PriorityMark({ priority, withLabel = false }: { priority: Application['priority']; withLabel?: boolean }) {
  return <span className={`priority priority-${priority}`}><Flag size={13} fill="currentColor" />{withLabel && priorityLabels[priority]}</span>
}

function CompanyAvatar({ name, size = 'normal' }: { name: string; size?: 'small' | 'normal' | 'large' }) {
  const colors = ['#355f56', '#53668d', '#8a6744', '#765977', '#3d6f79', '#7a5b4a']
  const color = colors[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length]
  return <span className={`company-avatar avatar-${size}`} style={{ background: color }}>{name.slice(0, 1).toUpperCase()}</span>
}

function Overview({ data, openApplication, setView }: PageProps & { setView: (view: ViewKey) => void }) {
  const active = data.applications.filter((item) => isActive(data.pipelines, item))
  const interviews = data.applications.filter((item) => getStage(data.pipelines, item)?.kind === 'interview')
  const offers = data.applications.filter((item) => getStage(data.pipelines, item)?.kind === 'offer')
  const upcoming = active.filter((item) => item.nextActionAt).sort((a, b) => String(a.nextActionAt).localeCompare(String(b.nextActionAt))).slice(0, 5)
  const focus = active.filter((item) => item.priority === 'high').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
  const kindCounts = (['prospect', 'applied', 'assessment', 'interview', 'offer'] as StageKind[]).map((kind) => ({
    kind, label: kindLabels[kind], value: data.applications.filter((item) => getStage(data.pipelines, item)?.kind === kind).length,
  }))
  const maxCount = Math.max(...kindCounts.map((item) => item.value), 1)

  return (
    <div className="page-grid overview-page">
      <section className="metric-grid">
        <MetricCard label="全部投递" value={data.applications.length} delta="本周 +4" icon={<BriefcaseBusiness size={19} />} />
        <MetricCard label="进行中" value={active.length} delta={`${Math.round(active.length / data.applications.length * 100)}% 活跃`} icon={<Activity size={19} />} />
        <MetricCard label="面试阶段" value={interviews.length} delta="未来 7 天 4 场" icon={<UserRound size={19} />} />
        <MetricCard label="已获 Offer" value={offers.length} delta="转化率 8.3%" icon={<Sparkles size={19} />} accent />
      </section>

      <section className="panel agenda-panel">
        <SectionHeader eyebrow="NEXT ACTIONS" title="接下来要做" action={<button className="text-button" onClick={() => setView('schedule')}>查看日程 <ArrowRight size={14} /></button>} />
        <div className="agenda-list">
          {upcoming.map((item) => {
            const due = relativeDue(item.nextActionAt)
            return (
              <button className="agenda-item" key={item.id} onClick={() => openApplication(item.id)}>
                <div className={`agenda-date ${due.tone}`}><strong>{format(parseISO(item.nextActionAt!), 'dd')}</strong><span>{format(parseISO(item.nextActionAt!), 'MM月')}</span></div>
                <CompanyAvatar name={item.company} />
                <div className="agenda-content"><strong>{item.nextAction}</strong><span>{item.company} · {item.role}</span></div>
                <div className="agenda-meta"><span className={`due-text ${due.tone}`}>{due.text}</span><small>{format(parseISO(item.nextActionAt!), 'HH:mm')}</small></div>
                <ChevronRight size={17} />
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel flow-snapshot">
        <SectionHeader eyebrow="PIPELINE" title="当前流程分布" action={<button className="text-button" onClick={() => setView('analytics')}>查看分析 <ArrowRight size={14} /></button>} />
        <div className="flow-bars">
          {kindCounts.map((item) => (
            <div className="flow-bar-row" key={item.kind}>
              <span>{item.label}</span><div><i style={{ width: `${Math.max(7, item.value / maxCount * 100)}%` }} /></div><strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="flow-note"><TrendingUp size={17} /><div><strong>面试转化正在改善</strong><span>近 14 天进入面试的比例比此前提升 12%</span></div></div>
      </section>

      <section className="panel focus-panel">
        <SectionHeader eyebrow="FOCUS" title="重点推进" action={<span className="subtle-count">{focus.length} 个高优机会</span>} />
        <div className="focus-list">
          {focus.map((item) => {
            const stage = getStage(data.pipelines, item)
            return (
              <button className="focus-item" key={item.id} onClick={() => openApplication(item.id)}>
                <CompanyAvatar name={item.company} /><div className="focus-company"><strong>{item.company}</strong><span>{item.role}</span></div>
                <StagePill stage={stage} /><div className="focus-updated"><span>最近更新</span><strong>{shortDate(item.updatedAt)}</strong></div><ChevronRight size={17} />
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel rhythm-panel">
        <SectionHeader eyebrow="RHYTHM" title="本周节奏" />
        <div className="rhythm-score"><div className="score-ring"><span>82</span><small>状态良好</small></div><div className="score-copy"><strong>执行节奏稳定</strong><p>高优先级机会都已设置下一步，仅有 1 个任务需要今天处理。</p></div></div>
        <div className="rhythm-stats"><div><span>计划完成</span><strong>7 / 9</strong></div><div><span>平均响应</span><strong>4.2 天</strong></div></div>
      </section>
    </div>
  )
}

function MetricCard({ label, value, delta, icon, accent = false, suffix = '' }: { label: string; value: number; delta: string; icon: ReactNode; accent?: boolean; suffix?: string }) {
  return <div className={`metric-card ${accent ? 'accent' : ''}`}><div className="metric-top"><span>{label}</span><i>{icon}</i></div><div className="metric-value">{String(value).padStart(2, '0')}<small>{suffix}</small></div><div className="metric-foot"><span>{delta}</span><ArrowUp size={13} /></div></div>
}

function Applications({ data, openApplication, updateApplication, onAdd }: PageProps & { onAdd: () => void }) {
  const [query, setQuery] = useState('')
  const [pipelineFilter, setPipelineFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [compact, setCompact] = useState(false)

  const filtered = useMemo(() => data.applications.filter((item) => {
    const haystack = `${item.company} ${item.role} ${item.city} ${item.tags.join(' ')}`.toLowerCase()
    const stage = getStage(data.pipelines, item)
    return haystack.includes(query.toLowerCase())
      && (pipelineFilter === 'all' || item.pipelineId === pipelineFilter)
      && (kindFilter === 'all' || stage?.kind === kindFilter)
      && (priorityFilter === 'all' || item.priority === priorityFilter)
  }), [data, query, pipelineFilter, kindFilter, priorityFilter])

  return (
    <section className="panel table-panel">
      <div className="table-toolbar">
        <div className="toolbar-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公司、岗位、城市或标签" /></div>
        <div className="filters">
          <Select value={pipelineFilter} onChange={setPipelineFilter} options={[['all','全部流程'], ...data.pipelines.map((item) => [item.id,item.name])]} />
          <Select value={kindFilter} onChange={setKindFilter} options={[['all','全部阶段'], ...Object.entries(kindLabels)]} />
          <Select value={priorityFilter} onChange={setPriorityFilter} options={[['all','全部优先级'],['high','高优先级'],['medium','中优先级'],['low','低优先级']]} />
          <button className={`icon-button ${compact ? 'selected' : ''}`} onClick={() => setCompact((value) => !value)} title="紧凑视图"><ListFilter size={17} /></button>
          <button className="primary-button" onClick={onAdd}><Plus size={16} /> 新增投递</button>
        </div>
      </div>
      <div className="result-summary"><span>共 {filtered.length} 条记录</span><span>·</span><span>{filtered.filter((item) => isActive(data.pipelines, item)).length} 条进行中</span></div>
      <div className="table-scroll">
        <table className={compact ? 'compact' : ''}>
          <thead><tr><th>公司与岗位</th><th>当前阶段</th><th>流程类型</th><th>优先级</th><th>下一步</th><th>最近更新</th><th /></tr></thead>
          <tbody>
            {filtered.map((item) => {
              const pipeline = getPipeline(data.pipelines, item.pipelineId)
              const stage = getStage(data.pipelines, item)
              return (
                <tr key={item.id} onClick={() => openApplication(item.id)}>
                  <td><div className="company-cell"><CompanyAvatar name={item.company} /><div><strong>{item.company}</strong><span>{item.role} · {item.city}</span></div></div></td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <select className="stage-select" value={item.stageId} onChange={(event) => updateApplication(item.id, { stageId: event.target.value })}>
                      {pipeline.stages.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                    </select>
                  </td>
                  <td><span className="pipeline-label">{pipeline.name}</span></td>
                  <td><PriorityMark priority={item.priority} withLabel /></td>
                  <td>{item.nextAction ? <div className="next-cell"><strong>{item.nextAction}</strong><span className={relativeDue(item.nextActionAt).tone}>{relativeDue(item.nextActionAt).text}</span></div> : <span className="empty-value">未安排</span>}</td>
                  <td><span className="updated-cell">{shortDate(item.updatedAt)}</span></td>
                  <td><button className="row-open"><ChevronRight size={17} /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!filtered.length && <div className="empty-state"><CircleDashed size={34} /><h3>没有找到匹配记录</h3><p>试试清除筛选条件，或添加一条新的投递。</p></div>}
    </section>
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="select-wrap"><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><ChevronDown size={14} /></label>
}

function Board({ data, openApplication, updateApplication }: PageProps) {
  const [pipelineId, setPipelineId] = useState(data.pipelines[0]?.id ?? '')
  const pipeline = getPipeline(data.pipelines, pipelineId)
  const items = data.applications.filter((item) => item.pipelineId === pipelineId)
  const [dragId, setDragId] = useState<string | null>(null)

  function drop(event: DragEvent<HTMLDivElement>, stageId: string) {
    event.preventDefault()
    if (dragId) updateApplication(dragId, { stageId })
    setDragId(null)
  }

  return (
    <div className="board-page">
      <div className="board-toolbar panel">
        <div><span className="toolbar-kicker">当前查看</span><Select value={pipelineId} onChange={setPipelineId} options={data.pipelines.map((item) => [item.id, item.name])} /></div>
        <div className="board-hint"><GripVertical size={15} /> 拖动卡片更新阶段；流程允许跳过任意环节</div>
      </div>
      <div className="kanban-scroll">
        <div className="kanban-board" style={{ '--column-count': Math.min(pipeline.stages.length, 8) } as React.CSSProperties}>
          {pipeline.stages.map((stage) => {
            const stageItems = items.filter((item) => item.stageId === stage.id)
            return (
              <div className="kanban-column" key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, stage.id)}>
                <div className="column-head"><div><i style={{ background: stage.color }} /><strong>{stage.name}</strong></div><span>{stageItems.length}</span></div>
                <div className="column-list">
                  {stageItems.map((item) => (
                    <button className={`kanban-card ${dragId === item.id ? 'dragging' : ''}`} key={item.id} draggable onDragStart={() => setDragId(item.id)} onClick={() => openApplication(item.id)}>
                      <div className="kanban-card-top"><CompanyAvatar name={item.company} size="small" /><PriorityMark priority={item.priority} /></div>
                      <strong>{item.company}</strong><p>{item.role}</p>
                      <div className="kanban-tags">{item.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
                      <div className="kanban-card-foot"><span><MapPin size={12} />{item.city}</span><span>{shortDate(item.updatedAt)}</span></div>
                      {item.nextAction && <div className={`kanban-action ${relativeDue(item.nextActionAt).tone}`}><Clock3 size={13} /><span>{item.nextAction}</span></div>}
                    </button>
                  ))}
                  {!stageItems.length && <div className="column-empty">拖动到此阶段</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Schedule({ data, openApplication }: PageProps) {
  const [month, setMonth] = useState(new Date())
  const scheduled = data.applications.filter((item) => item.nextActionAt).sort((a, b) => String(a.nextActionAt).localeCompare(String(b.nextActionAt)))
  const monthStart = startOfMonth(month)
  const days = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
  const upcoming = scheduled.filter((item) => parseISO(item.nextActionAt!) >= startOfWeek(new Date(), { weekStartsOn: 1 })).slice(0, 8)

  return (
    <div className="schedule-layout">
      <section className="panel calendar-panel">
        <div className="calendar-head"><button className="icon-button" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft size={17} /></button><h2>{format(month, 'yyyy年 M月', { locale: zhCN })}</h2><button className="icon-button" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={17} /></button></div>
        <div className="weekday-row">{['周一','周二','周三','周四','周五','周六','周日'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {days.map((day) => {
            const events = scheduled.filter((item) => isSameDay(parseISO(item.nextActionAt!), day))
            return (
              <div key={day.toISOString()} className={`calendar-day ${!isSameMonth(day, month) ? 'outside' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}>
                <span className="day-number">{format(day, 'd')}</span>
                <div className="day-events">{events.slice(0, 2).map((item) => <button key={item.id} onClick={() => openApplication(item.id)}><i style={{ background: getStage(data.pipelines, item)?.color }} />{item.company} · {item.nextAction}</button>)}{events.length > 2 && <small>+{events.length - 2} 项</small>}</div>
              </div>
            )
          })}
        </div>
      </section>
      <aside className="panel upcoming-panel">
        <SectionHeader eyebrow="UPCOMING" title="近期安排" />
        <div className="timeline-agenda">
          {upcoming.map((item, index) => {
            const date = parseISO(item.nextActionAt!)
            return (
              <button key={item.id} onClick={() => openApplication(item.id)}>
                <div className="timeline-line"><i className={index === 0 ? 'current' : ''} />{index < upcoming.length - 1 && <span />}</div>
                <div className="timeline-date-label"><strong>{format(date, 'MM.dd')}</strong><span>{format(date, 'EEE', { locale: zhCN })}</span></div>
                <div className="timeline-copy"><strong>{item.nextAction}</strong><span>{item.company} · {item.role}</span><small>{format(date, 'HH:mm')} · {item.city}</small></div>
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}

function Analytics({ data }: { data: AppData }) {
  const activeCount = data.applications.filter((item) => isActive(data.pipelines, item)).length
  const offerCount = data.applications.filter((item) => getStage(data.pipelines, item)?.kind === 'offer').length
  const interviewReached = data.applications.filter((item) => {
    const pipeline = getPipeline(data.pipelines, item.pipelineId)
    return item.history.some((history) => pipeline.stages.find((stage) => stage.id === history.stageId)?.kind === 'interview')
  }).length

  const funnelKinds: StageKind[] = ['applied', 'assessment', 'interview', 'offer']
  const funnel = funnelKinds.map((kind) => ({
    name: kindLabels[kind], value: data.applications.filter((item) => {
      const pipeline = getPipeline(data.pipelines, item.pipelineId)
      return item.history.some((entry) => pipeline.stages.find((stage) => stage.id === entry.stageId)?.kind === kind)
    }).length,
  }))
  const funnelBase = funnel[0]?.value || 1

  const weekly = Array.from({ length: 7 }, (_, index) => {
    const start = startOfWeek(subWeeks(new Date(), 6 - index), { weekStartsOn: 1 })
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { label: format(start, 'M.d'), value: data.applications.filter((item) => { const date = parseISO(item.appliedAt); return date >= start && date <= end }).length }
  })

  const sourceMap = new Map<string, { source: string; total: number; interviews: number; offers: number }>()
  data.applications.forEach((item) => {
    const current = sourceMap.get(item.channel) ?? { source: item.channel, total: 0, interviews: 0, offers: 0 }
    current.total += 1
    const pipeline = getPipeline(data.pipelines, item.pipelineId)
    const kinds = item.history.map((entry) => pipeline.stages.find((stage) => stage.id === entry.stageId)?.kind)
    if (kinds.includes('interview')) current.interviews += 1
    if (kinds.includes('offer')) current.offers += 1
    sourceMap.set(item.channel, current)
  })
  const sources = [...sourceMap.values()].sort((a, b) => b.total - a.total).slice(0, 6)

  const durations: Record<string, number[]> = {}
  data.applications.forEach((item) => {
    const pipeline = getPipeline(data.pipelines, item.pipelineId)
    const ordered = [...item.history].sort((a, b) => a.date.localeCompare(b.date))
    ordered.slice(0, -1).forEach((entry, index) => {
      const kind = pipeline.stages.find((stage) => stage.id === entry.stageId)?.kind
      if (!kind) return
      const days = Math.max(1, Math.round((parseISO(ordered[index + 1].date).getTime() - parseISO(entry.date).getTime()) / 86400000))
      durations[kind] = [...(durations[kind] ?? []), days]
    })
  })
  const durationData = (['applied','assessment','interview'] as StageKind[]).map((kind) => ({ name: kindLabels[kind], days: Number(average(durations[kind] ?? []).toFixed(1)) }))

  return (
    <div className="analytics-page">
      <section className="metric-grid analytics-metrics">
        <MetricCard label="投递 → 面试" value={Math.round(interviewReached / Math.max(1, data.applications.length) * 100)} suffix="%" delta="转化百分比" icon={<Target size={19} />} />
        <MetricCard label="活跃机会" value={activeCount} delta="需要持续跟进" icon={<Activity size={19} />} />
        <MetricCard label="平均推进周期" value={Math.round(average(durationData.map((item) => item.days)))} delta="天 / 阶段" icon={<Clock3 size={19} />} />
        <MetricCard label="Offer 转化" value={Math.round(offerCount / Math.max(1, data.applications.length) * 100)} suffix="%" delta={`${offerCount} 个 Offer`} icon={<Sparkles size={19} />} accent />
      </section>

      <section className="panel chart-panel trend-chart">
        <SectionHeader eyebrow="APPLICATION TREND" title="近 7 周投递节奏" action={<span className="chart-legend"><i /> 新增投递</span>} />
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={weekly} margin={{ top: 16, right: 8, left: -24, bottom: 0 }}>
            <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#315f55" stopOpacity={0.24}/><stop offset="100%" stopColor="#315f55" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#e8e7e1" strokeDasharray="3 4" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8c8d88', fontSize: 12 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#8c8d88', fontSize: 12 }} />
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e4e3dc', boxShadow: '0 10px 30px rgba(40,45,42,.08)' }} /><Area type="monotone" dataKey="value" name="投递" stroke="#315f55" strokeWidth={2.5} fill="url(#areaFill)" dot={{ fill: '#f8f8f4', stroke: '#315f55', strokeWidth: 2, r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="panel funnel-panel">
        <SectionHeader eyebrow="CONVERSION" title="招聘流程转化" />
        <div className="funnel-list">
          {funnel.map((item, index) => {
            const percent = Math.round(item.value / funnelBase * 100)
            const previous = index ? funnel[index - 1].value : item.value
            return <div className="funnel-row" key={item.name}><div><span>{item.name}</span><strong>{item.value}</strong></div><div className="funnel-track"><i style={{ width: `${Math.max(8, percent)}%` }} /></div><div className="funnel-meta"><strong>{percent}%</strong><span>{index ? `阶段转化 ${Math.round(item.value / Math.max(1, previous) * 100)}%` : '有效投递基数'}</span></div></div>
          })}
        </div>
      </section>

      <section className="panel source-panel">
        <SectionHeader eyebrow="CHANNEL QUALITY" title="渠道质量" action={<span className="subtle-count">按进入面试衡量</span>} />
        <div className="source-table"><div className="source-head"><span>来源</span><span>投递</span><span>面试</span><span>Offer</span><span>面试率</span></div>{sources.map((source) => <div className="source-row" key={source.source}><strong>{source.source}</strong><span>{source.total}</span><span>{source.interviews}</span><span>{source.offers}</span><span className="rate-cell"><i style={{ width: `${source.interviews / source.total * 100}%` }} /><b>{Math.round(source.interviews / source.total * 100)}%</b></span></div>)}</div>
      </section>

      <section className="panel duration-panel">
        <SectionHeader eyebrow="STAGE DURATION" title="各阶段平均耗时" />
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={durationData} layout="vertical" margin={{ top: 10, right: 34, left: 14, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="#e8e7e1" strokeDasharray="3 4" /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#8c8d88', fontSize: 12 }} unit="天" /><YAxis type="category" dataKey="name" width={72} axisLine={false} tickLine={false} tick={{ fill: '#555952', fontSize: 12 }} /><Tooltip cursor={{ fill: '#f4f4ef' }} contentStyle={{ borderRadius: 10, border: '1px solid #e4e3dc' }} /><Bar dataKey="days" name="平均耗时" radius={[0, 5, 5, 0]} barSize={18}>{durationData.map((_, index) => <Cell key={index} fill={['#557a71','#a67a47','#5c6f91'][index]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="insight-panel">
        <div className="insight-icon"><Sparkles size={20} /></div><div><span>OFFER FLOW INSIGHT</span><h3>内推渠道进入面试的效率最高</h3><p>目前内推样本的面试转化优于公开渠道。建议接下来一周把 2–3 家高优先级公司切换到“找人确认岗位 + 内推”的行动模式，同时保持投递总量稳定。</p></div><button>查看相关投递 <ArrowRight size={15} /></button>
      </section>
    </div>
  )
}

function ApplicationModal({ pipelines, application, onClose, onSave }: {
  pipelines: PipelineTemplate[]
  application?: Application
  onClose: () => void
  onSave: (application: Application) => void
}) {
  const initialPipeline = getPipeline(pipelines, application?.pipelineId ?? pipelines[0]?.id)
  const [form, setForm] = useState({
    company: application?.company ?? '', role: application?.role ?? '', department: application?.department ?? '',
    city: application?.city ?? '', channel: application?.channel ?? '招聘官网', salary: application?.salary ?? '',
    jobUrl: application?.jobUrl ?? '', priority: application?.priority ?? 'medium', pipelineId: application?.pipelineId ?? initialPipeline?.id ?? '',
    stageId: application?.stageId ?? initialPipeline?.stages[1]?.id ?? initialPipeline?.stages[0]?.id ?? '',
    appliedAt: application?.appliedAt?.slice(0, 10) ?? format(new Date(), 'yyyy-MM-dd'), nextAction: application?.nextAction ?? '',
    nextActionAt: application?.nextActionAt?.slice(0, 16) ?? '', contact: application?.contact ?? '',
    tags: application?.tags.join('，') ?? '', notes: application?.notes ?? '',
  })
  const activePipeline = getPipeline(pipelines, form.pipelineId)

  function setField(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.company.trim() || !form.role.trim() || !form.pipelineId || !form.stageId) return
    const now = new Date().toISOString()
    const selectedStage = activePipeline.stages.find((stage) => stage.id === form.stageId)!
    let history = application?.history ?? []
    if (!application) {
      history = [{ id: uid('history'), stageId: selectedStage.id, stageName: selectedStage.name, date: form.appliedAt }]
    } else if (application.stageId !== form.stageId) {
      history = [...history, { id: uid('history'), stageId: selectedStage.id, stageName: selectedStage.name, date: now }]
    }
    onSave({
      id: application?.id ?? uid('application'), company: form.company.trim(), role: form.role.trim(),
      department: form.department.trim(), city: form.city.trim(), channel: form.channel.trim(), salary: form.salary.trim(),
      jobUrl: form.jobUrl.trim(), priority: form.priority as Application['priority'], pipelineId: form.pipelineId,
      stageId: form.stageId, appliedAt: form.appliedAt, updatedAt: now, nextAction: form.nextAction.trim(),
      nextActionAt: form.nextActionAt || undefined, contact: form.contact.trim(), notes: form.notes.trim(),
      tags: form.tags.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean), history,
    })
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <button className="modal-backdrop" onClick={onClose} aria-label="关闭" />
      <form className="application-modal" onSubmit={submit}>
        <div className="modal-head"><div><span>APPLICATION</span><h2>{application ? '编辑投递记录' : '新增投递'}</h2><p>只记录会影响下一步决策的信息。</p></div><button type="button" className="icon-button" onClick={onClose}><X size={19} /></button></div>
        <div className="form-section"><h3>基本信息</h3><div className="form-grid">
          <Field label="公司名称 *"><input required value={form.company} onChange={(event) => setField('company', event.target.value)} placeholder="例如：字节跳动" /></Field>
          <Field label="岗位名称 *"><input required value={form.role} onChange={(event) => setField('role', event.target.value)} placeholder="例如：前端开发工程师" /></Field>
          <Field label="业务部门"><input value={form.department} onChange={(event) => setField('department', event.target.value)} placeholder="选填" /></Field>
          <Field label="城市"><input value={form.city} onChange={(event) => setField('city', event.target.value)} placeholder="例如：上海" /></Field>
          <Field label="投递渠道"><input value={form.channel} onChange={(event) => setField('channel', event.target.value)} placeholder="官网 / 内推 / 宣讲会" /></Field>
          <Field label="薪资信息"><input value={form.salary} onChange={(event) => setField('salary', event.target.value)} placeholder="选填" /></Field>
        </div></div>
        <div className="form-section"><h3>流程与节奏</h3><div className="form-grid">
          <Field label="流程模板 *"><select value={form.pipelineId} onChange={(event) => { const pipeline = getPipeline(pipelines, event.target.value); setForm((current) => ({ ...current, pipelineId: pipeline.id, stageId: pipeline.stages[0]?.id ?? '' })) }}>{pipelines.map((pipeline) => <option value={pipeline.id} key={pipeline.id}>{pipeline.name}</option>)}</select></Field>
          <Field label="当前阶段 *"><select value={form.stageId} onChange={(event) => setField('stageId', event.target.value)}>{activePipeline.stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.name}</option>)}</select></Field>
          <Field label="优先级"><select value={form.priority} onChange={(event) => setField('priority', event.target.value)}><option value="high">高优先级</option><option value="medium">中优先级</option><option value="low">低优先级</option></select></Field>
          <Field label="投递日期"><input type="date" value={form.appliedAt} onChange={(event) => setField('appliedAt', event.target.value)} /></Field>
          <Field label="下一步行动" wide><input value={form.nextAction} onChange={(event) => setField('nextAction', event.target.value)} placeholder="例如：准备项目深挖、完成测评" /></Field>
          <Field label="行动时间"><input type="datetime-local" value={form.nextActionAt} onChange={(event) => setField('nextActionAt', event.target.value)} /></Field>
          <Field label="联系人"><input value={form.contact} onChange={(event) => setField('contact', event.target.value)} placeholder="HR / 内推人 / 面试官" /></Field>
        </div></div>
        <div className="form-section"><h3>补充信息</h3><div className="form-grid">
          <Field label="岗位链接" wide><input type="url" value={form.jobUrl} onChange={(event) => setField('jobUrl', event.target.value)} placeholder="https://" /></Field>
          <Field label="标签" wide><input value={form.tags} onChange={(event) => setField('tags', event.target.value)} placeholder="使用逗号分隔，例如：前端，核心目标" /></Field>
          <Field label="备注" wide><textarea rows={3} value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="记录面试反馈、岗位偏好或需要复盘的内容" /></Field>
        </div></div>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button">{application ? '保存修改' : '添加投递'}</button></div>
      </form>
    </div>
  )
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>
}

function ApplicationDrawer({ application, pipelines, onClose, onStageChange, onEdit, onDelete }: {
  application: Application
  pipelines: PipelineTemplate[]
  onClose: () => void
  onStageChange: (stageId: string) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const pipeline = getPipeline(pipelines, application.pipelineId)
  const stage = getStage(pipelines, application)
  const history = [...application.history].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="drawer-layer">
      <button className="drawer-backdrop" onClick={onClose} aria-label="关闭" />
      <aside className="application-drawer">
        <div className="drawer-head"><div className="drawer-company"><CompanyAvatar name={application.company} size="large" /><div><span>{pipeline.name}</span><h2>{application.company}</h2><p>{application.role} · {application.city}</p></div></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
        <div className="drawer-actions"><select value={application.stageId} onChange={(event) => onStageChange(event.target.value)}>{pipeline.stages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="secondary-button" onClick={onEdit}><PencilLine size={15} /> 编辑</button>{application.jobUrl && <a className="icon-button" href={application.jobUrl} target="_blank" rel="noreferrer"><ExternalLink size={17} /></a>}</div>

        {application.nextAction && <div className="next-action-card"><div><Clock3 size={17} /><span>下一步行动</span></div><strong>{application.nextAction}</strong><p>{fullDate(application.nextActionAt)} · <span className={relativeDue(application.nextActionAt).tone}>{relativeDue(application.nextActionAt).text}</span></p></div>}

        <div className="drawer-section"><h3>流程进度</h3><div className="pipeline-mini">
          {pipeline.stages.filter((item) => !item.terminal || item.id === application.stageId).map((item, index, array) => {
            const reached = application.history.some((entry) => entry.stageId === item.id)
            const current = item.id === application.stageId
            return <div className={`mini-stage ${reached ? 'reached' : ''} ${current ? 'current' : ''}`} key={item.id}><i style={{ '--stage-color': item.color } as React.CSSProperties}>{reached && <Check size={10} />}</i><span>{item.name}</span>{index < array.length - 1 && <b />}</div>
          })}
        </div></div>

        <div className="drawer-section"><h3>关键信息</h3><div className="detail-grid">
          <DetailItem label="当前阶段"><StagePill stage={stage} /></DetailItem><DetailItem label="优先级"><PriorityMark priority={application.priority} withLabel /></DetailItem>
          <DetailItem label="投递渠道">{application.channel}</DetailItem><DetailItem label="投递日期">{shortDate(application.appliedAt)}</DetailItem>
          {application.department && <DetailItem label="业务部门">{application.department}</DetailItem>}{application.salary && <DetailItem label="薪资信息">{application.salary}</DetailItem>}
          {application.contact && <DetailItem label="联系人">{application.contact}</DetailItem>}
        </div></div>

        {application.notes && <div className="drawer-section"><h3>备注</h3><p className="note-copy">{application.notes}</p></div>}
        <div className="drawer-section history-section"><h3>进展时间线</h3><div className="history-list">{history.map((entry, index) => <div className="history-entry" key={entry.id}><div className="history-rail"><i className={index === 0 ? 'latest' : ''} />{index < history.length - 1 && <span />}</div><div><strong>{entry.stageName}</strong><time>{fullDate(entry.date.length === 10 ? `${entry.date}T09:00` : entry.date)}</time>{entry.note && <p>{entry.note}</p>}</div></div>)}</div></div>
        <div className="drawer-danger"><button onClick={onDelete}><Trash2 size={15} /> 删除这条记录</button></div>
      </aside>
    </div>
  )
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return <div className="detail-item"><span>{label}</span><div>{children}</div></div>
}

function PipelineSettings({ data, onChange, onExportJson, onExportCsv, onImport, onReset }: {
  data: AppData
  onChange: (pipelines: PipelineTemplate[]) => void
  onExportJson: () => void
  onExportCsv: () => void
  onImport: () => void
  onReset: () => void
}) {
  const [selectedId, setSelectedId] = useState(data.pipelines[0]?.id ?? '')
  const selected = getPipeline(data.pipelines, selectedId)

  function updateTemplate(updates: Partial<PipelineTemplate>) {
    onChange(data.pipelines.map((pipeline) => pipeline.id === selected.id ? { ...pipeline, ...updates } : pipeline))
  }

  function updateStage(stageId: string, updates: Partial<Stage>) {
    updateTemplate({ stages: selected.stages.map((stage) => stage.id === stageId ? { ...stage, ...updates } : stage) })
  }

  function moveStage(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= selected.stages.length) return
    const stages = [...selected.stages]
    ;[stages[index], stages[target]] = [stages[target], stages[index]]
    updateTemplate({ stages })
  }

  function addTemplate() {
    const next: PipelineTemplate = {
      id: uid('pipeline'), name: '新流程模板', description: '根据目标企业调整阶段。',
      stages: [
        { id: uid('stage'), name: '待投递', kind: 'prospect', color: '#7b8190' },
        { id: uid('stage'), name: '已投递', kind: 'applied', color: '#315f55' },
        { id: uid('stage'), name: '面试', kind: 'interview', color: '#426b9a' },
        { id: uid('stage'), name: 'Offer', kind: 'offer', color: '#31715a', terminal: true, outcome: 'positive' },
        { id: uid('stage'), name: '流程结束', kind: 'closed', color: '#9a5555', terminal: true, outcome: 'negative' },
      ],
    }
    onChange([...data.pipelines, next]); setSelectedId(next.id)
  }

  function addStage() {
    updateTemplate({ stages: [...selected.stages, { id: uid('stage'), name: '新阶段', kind: 'interview', color: '#5e6d91' }] })
  }

  function removeStage(stageId: string) {
    if (data.applications.some((item) => item.stageId === stageId)) return
    updateTemplate({ stages: selected.stages.filter((stage) => stage.id !== stageId) })
  }

  const usesByStage = new Map(selected.stages.map((stage) => [stage.id, data.applications.filter((item) => item.stageId === stage.id).length]))

  return (
    <div className="settings-layout">
      <aside className="panel template-list">
        <SectionHeader eyebrow="TEMPLATES" title="流程模板" action={<button className="icon-button" onClick={addTemplate}><Plus size={17} /></button>} />
        <div>{data.pipelines.map((pipeline) => <button className={pipeline.id === selected.id ? 'active' : ''} key={pipeline.id} onClick={() => setSelectedId(pipeline.id)}><span><strong>{pipeline.name}</strong><small>{pipeline.stages.length} 个阶段 · {data.applications.filter((item) => item.pipelineId === pipeline.id).length} 条记录</small></span><ChevronRight size={16} /></button>)}</div>
        <div className="template-tip"><Sparkles size={17} /><p><strong>为什么用模板？</strong>银行、互联网与咨询的招聘流程差异很大。每条投递绑定模板，既能保持统一分析，也允许阶段自由跳转。</p></div>
      </aside>

      <section className="panel pipeline-editor">
        <div className="editor-head"><div><span>编辑模板</span><input value={selected.name} onChange={(event) => updateTemplate({ name: event.target.value })} /></div><button className="secondary-button" onClick={addStage}><Plus size={15} /> 添加阶段</button></div>
        <textarea className="template-description" value={selected.description} onChange={(event) => updateTemplate({ description: event.target.value })} />
        <div className="stage-editor-head"><span>排序</span><span>阶段名称</span><span>归一分类</span><span>颜色</span><span>结束节点</span><span /></div>
        <div className="stage-editor-list">
          {selected.stages.map((stage, index) => (
            <div className="stage-editor-row" key={stage.id}>
              <div className="stage-order"><GripVertical size={16} /><button disabled={index === 0} onClick={() => moveStage(index, -1)}><ArrowUp size={13} /></button><button disabled={index === selected.stages.length - 1} onClick={() => moveStage(index, 1)}><ArrowDown size={13} /></button></div>
              <input value={stage.name} onChange={(event) => updateStage(stage.id, { name: event.target.value })} />
              <select value={stage.kind} onChange={(event) => updateStage(stage.id, { kind: event.target.value as StageKind })}>{Object.entries(kindLabels).map(([kind, label]) => <option value={kind} key={kind}>{label}</option>)}</select>
              <label className="color-field"><input type="color" value={stage.color} onChange={(event) => updateStage(stage.id, { color: event.target.value })} /><span>{stage.color}</span></label>
              <label className="switch-label"><input type="checkbox" checked={Boolean(stage.terminal)} onChange={(event) => updateStage(stage.id, { terminal: event.target.checked })} /><i /><span>{stage.terminal ? '是' : '否'}</span></label>
              <button className="delete-stage" disabled={Boolean(usesByStage.get(stage.id))} title={usesByStage.get(stage.id) ? '仍有投递处于该阶段' : '删除阶段'} onClick={() => removeStage(stage.id)}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <div className="editor-foot"><span><Check size={15} /> 修改会实时保存，已有投递仍保持原流程模板</span><span>{selected.stages.length} 个阶段</span></div>
      </section>

      <section className="panel data-panel">
        <SectionHeader eyebrow="DATA & PRIVACY" title="数据管理" />
        <p>所有数据默认保存在当前浏览器，不上传到任何服务器。建议定期导出 JSON 作为完整备份。</p>
        <div className="data-actions"><button className="secondary-button" onClick={onExportJson}><Download size={15} /> 导出 JSON</button><button className="secondary-button" onClick={onExportCsv}><FileText size={15} /> 导出 CSV</button><button className="secondary-button" onClick={onImport}><Upload size={15} /> 导入备份</button><button className="text-danger" onClick={onReset}><RotateCcw size={15} /> 恢复演示数据</button></div>
      </section>
    </div>
  )
}

export default App
