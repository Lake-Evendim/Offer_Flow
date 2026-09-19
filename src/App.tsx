import { type ChangeEvent, type DragEvent, type FormEvent, type PointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity, ArrowDown, ArrowRight, ArrowUp, BarChart3, BriefcaseBusiness, Building2,
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDashed, Clock3, Download,
  ExternalLink, FileText, Filter, Flag, GripVertical, Import, KanbanSquare, LayoutDashboard,
  MapPin, Menu, PencilLine, Plus, RotateCcw, Search, Settings2,
  Sparkles, Target, Trash2, TrendingUp, Upload, UserRound, X,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  addDays, addMonths, addWeeks, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  parseISO, startOfMonth, startOfWeek, subMonths, subWeeks,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { AppData, Application, PipelineTemplate, Stage, StageKind, ViewKey } from './types'
import { loadData, resetData, saveData } from './storage'
import {
  average, escapeCsv, fullDate, getPipeline, getStage, isActive, kindLabels, priorityLabels,
  normalizeHistory, relativeDue, shortDate, uid,
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
  overview: { title: '', description: '' },
  applications: { title: '投递记录', description: '按公司、岗位和流程阶段管理每一次机会。' },
  board: { title: '流程看板', description: '按企业流程查看进展，拖动卡片即可更新阶段。' },
  schedule: { title: '日程计划', description: '集中查看笔试、面试与待办，不错过关键节点。' },
  analytics: { title: '数据分析', description: '找到渠道、流程和节奏中的真正瓶颈。' },
  pipelines: { title: '流程配置', description: '为不同企业类型建立独立、可跳转的招聘流程。' },
}

const selectableKindOptions = Object.entries(kindLabels).filter(([kind]) => kind !== 'prospect')
const aggregateBoardStages: Stage[] = [
  { id: 'all-applied', name: '已投递', kind: 'applied', color: '#315f55' },
  { id: 'all-assessment', name: '测评 / 笔试', kind: 'assessment', color: '#9a6b32' },
  { id: 'all-interview', name: '面试', kind: 'interview', color: '#426b9a' },
  { id: 'all-offer', name: 'Offer', kind: 'offer', color: '#31715a' },
  { id: 'all-closed', name: '已结束', kind: 'closed', color: '#9a5555' },
]
const boardStageColors: Record<StageKind, string> = {
  prospect: '#78837D',
  applied: '#4C8898',
  assessment: '#B97932',
  interview: '#5C6FAE',
  offer: '#1E9F72',
  closed: '#748087',
}
const boardStageColor = (stage: Stage) => boardStageColors[stage.kind] ?? stage.color
const stageColorPresets = [
  '#315f55', '#4b8272', '#3e6f7a', '#4f7897', '#426b9a',
  '#5967a6', '#6f6aa6', '#835f9a', '#9a5f73', '#a05d65',
  '#9a5555', '#a56f52', '#9a6b32', '#73804b', '#66717d',
]
const calendarEventColors = ['#e58b3f', '#4e83d1', '#c45f82', '#42a38d', '#8b70c8', '#d05e52', '#77a84b', '#3694ad']
const commonApplicationTerms = {
  company: ['字节跳动', '腾讯', '阿里巴巴', '美团', '华为', '小米', '京东', '百度', '拼多多', '网易游戏', '快手', '蚂蚁集团'],
  role: ['前端开发工程师', '后端开发工程师', '软件开发工程师', '算法工程师', '数据分析师', '产品经理', '产品策划培训生', '用户研究专员', '金融科技岗', '管理培训生'],
  department: ['飞书', '抖音电商', '商业化', '微信事业群', '云与智慧产业', '阿里云', '淘天集团', '到店事业群', '总行信息技术部'],
  city: ['北京', '上海', '深圳', '杭州', '广州', '成都', '南京', '武汉', '西安'],
  channel: ['招聘官网', '内推', 'BOSS直聘', '牛客网', '实习僧', '校园宣讲会', '双选会', 'LinkedIn'],
  nextAction: ['完成在线测评', '准备技术面试', '准备业务一面', '准备群面', '准备项目深挖', '复盘面试', '跟进 HR', '补充申请材料'],
  contact: ['HR', '内推人', '招聘专员', '面试官', '校招负责人'],
}

function companyEventColor(company: string) {
  const hash = [...company].reduce((total, character) => total + character.charCodeAt(0), 0)
  return calendarEventColors[hash % calendarEventColors.length]
}

function stableVisualHash(seed: string) {
  return [...seed].reduce((value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619), 2166136261) >>> 0
}

function offerAuroraStyle(seed: string) {
  let hash = stableVisualHash(seed)
  const next = () => {
    hash += 0x6D2B79F5
    let value = hash
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  const style = {
    '--offer-aurora-hue': `${Math.round(next() * 36 - 18)}deg`,
    '--offer-aurora-x': `${(next() * 12 - 6).toFixed(2)}%`,
    '--offer-aurora-y': `${(next() * 10 - 5).toFixed(2)}%`,
    '--offer-aurora-scale-y': (0.9 + next() * 0.2).toFixed(3),
    '--offer-aurora-opacity': (0.46 + next() * 0.16).toFixed(3),
    '--offer-aurora-saturation': (1.18 + next() * 0.2).toFixed(3),
    '--offer-aurora-brightness': (0.98 + next() * 0.12).toFixed(3),
    '--offer-band-a-y': `${(4 + next() * 13).toFixed(2)}%`,
    '--offer-band-b-y': `${(25 + next() * 16).toFixed(2)}%`,
    '--offer-band-c-y': `${(43 + next() * 13).toFixed(2)}%`,
    '--offer-band-a-scale': (0.86 + next() * 0.22).toFixed(3),
    '--offer-band-b-scale': (0.82 + next() * 0.25).toFixed(3),
    '--offer-aurora-delay': `${(-next() * 18).toFixed(2)}s`,
    '--offer-aurora-drift': `${(next() * 8 - 4).toFixed(2)}%`,
    '--offer-aurora-lift': `${(next() * 6 - 3).toFixed(2)}%`,
  } as React.CSSProperties
  return style
}

type MeteorVisual = {
  id: number
  top: number
  length: number
  duration: number
  angle: number
  visibleY: number
  exitY: number
  travelY: number
}

function OfferMeteor({ seed }: { seed: string }) {
  const [meteor, setMeteor] = useState<MeteorVisual | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let timer = 0
    let cancelled = false
    let sequence = 0

    const schedule = (initial = false) => {
      const delay = initial ? 2600 + stableVisualHash(seed) % 5200 : 14000 + Math.random() * 20000
      timer = window.setTimeout(() => {
        if (cancelled) return
        const travelX = 470
        const travelY = 52 + Math.random() * 58
        const duration = 1440 + Math.random() * 520
        sequence += 1
        setMeteor({
          id: sequence,
          top: -10 + Math.random() * 39,
          length: 36 + Math.random() * 22,
          duration,
          angle: Math.atan2(travelY, travelX) * 180 / Math.PI,
          visibleY: travelY * .23,
          exitY: travelY * .80,
          travelY,
        })
        timer = window.setTimeout(() => {
          if (cancelled) return
          setMeteor(null)
          schedule()
        }, duration + 80)
      }, delay)
    }

    schedule(true)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [seed])

  if (!meteor) return null
  return <i
    key={meteor.id}
    className="offer-meteor"
    style={{
      '--offer-meteor-top': `${meteor.top.toFixed(2)}%`,
      '--offer-meteor-angle': `${meteor.angle.toFixed(2)}deg`,
      '--offer-meteor-length': `${meteor.length.toFixed(1)}px`,
      '--offer-meteor-duration': `${meteor.duration.toFixed(0)}ms`,
      '--offer-meteor-visible-y': `${meteor.visibleY.toFixed(1)}px`,
      '--offer-meteor-exit-y': `${meteor.exitY.toFixed(1)}px`,
      '--offer-meteor-travel-y': `${meteor.travelY.toFixed(1)}px`,
    } as React.CSSProperties}
  />
}

type OfferStar = {
  id: number
  x: number
  y: number
  size: number
  opacity: number
  tone: 'mint' | 'ice' | 'violet'
  bright: boolean
}

function offerStarField(seed: string, count = 21): OfferStar[] {
  let hash = stableVisualHash(`${seed}-stars`)
  const next = () => {
    hash += 0x6D2B79F5
    let value = hash
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  const stars: OfferStar[] = []

  for (let index = 0; index < count; index += 1) {
    let x = 38 + next() * 58
    let y = 5 + next() * 68
    let attempts = 0
    while (attempts < 18 && stars.some((star) => {
      const distanceX = star.x - x
      const distanceY = (star.y - y) * .78
      return Math.hypot(distanceX, distanceY) < 5.6
    })) {
      x = 38 + next() * 58
      y = 5 + next() * 68
      attempts += 1
    }

    const brightness = next()
    stars.push({
      id: index,
      x,
      y,
      size: brightness > .89 ? 1.7 + next() * .55 : .55 + next() * .85,
      opacity: .25 + next() * .58,
      tone: next() > .82 ? 'violet' : next() > .58 ? 'mint' : 'ice',
      bright: brightness > .89,
    })
  }

  return stars
}

function OfferAuroraScene({ detail = false, meteorSeed }: { detail?: boolean; meteorSeed?: string }) {
  if (detail) {
    const seed = meteorSeed ?? 'detail'
    const sceneId = `offer-aurora-${stableVisualHash(seed)}`
    const stars = offerStarField(seed)
    return (
      <span className="offer-detail-scene" aria-hidden="true">
        <span className="offer-detail-stars">
          {stars.map((star) => <i
            className={`offer-detail-star star-${star.tone} ${star.bright ? 'star-bright' : ''}`}
            key={star.id}
            style={{
              '--offer-star-x': `${star.x.toFixed(2)}%`,
              '--offer-star-y': `${star.y.toFixed(2)}%`,
              '--offer-star-size': `${star.size.toFixed(2)}px`,
              '--offer-star-opacity': star.opacity.toFixed(2),
            } as React.CSSProperties}
          />)}
        </span>
        <svg className="offer-detail-ribbons" viewBox="0 0 800 160" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`${sceneId}-gradient`} x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#3BE3A5" stopOpacity="0" />
              <stop offset="0.18" stopColor="#4EE6B7" stopOpacity="0.82" />
              <stop offset="0.43" stopColor="#61D7E4" stopOpacity="0.72" />
              <stop offset="0.68" stopColor="#78A8F5" stopOpacity="0.64" />
              <stop offset="0.86" stopColor="#AC83F0" stopOpacity="0.52" />
              <stop offset="1" stopColor="#B884EF" stopOpacity="0" />
            </linearGradient>
            <filter id={`${sceneId}-soft`} x="-18%" y="-80%" width="136%" height="260%">
              <feGaussianBlur stdDeviation="12" />
            </filter>
            <filter id={`${sceneId}-glow`} x="-14%" y="-55%" width="128%" height="210%">
              <feGaussianBlur stdDeviation="4.5" />
            </filter>
          </defs>
          <path className="offer-detail-ribbon offer-detail-ribbon-wash" d="M-45 77 C92 17 184 112 326 53 S564 18 845 70" stroke={`url(#${sceneId}-gradient)`} filter={`url(#${sceneId}-soft)`} />
          <path className="offer-detail-ribbon offer-detail-ribbon-body" d="M-40 72 C96 20 188 105 329 49 S568 15 840 67" stroke={`url(#${sceneId}-gradient)`} filter={`url(#${sceneId}-glow)`} />
          <path className="offer-detail-ribbon offer-detail-ribbon-echo" d="M-70 102 C112 51 220 131 390 76 S657 45 866 91" stroke={`url(#${sceneId}-gradient)`} filter={`url(#${sceneId}-glow)`} />
        </svg>
        <i className="offer-detail-horizon" />
      </span>
    )
  }
  return (
    <span className="offer-folded-scene" aria-hidden="true">
      <i className="offer-aurora-band offer-aurora-band-a" />
      <i className="offer-aurora-band offer-aurora-band-b" />
      <i className="offer-aurora-band offer-aurora-band-c" />
      {meteorSeed && <OfferMeteor seed={meteorSeed} />}
    </span>
  )
}

function offerAuroraVariant(seed: string) {
  return stableVisualHash(seed) % 4
}

function useOfferAuroraMotion() {
  useEffect(() => {
    const root = document.documentElement
    const propertyNames = [
      '--offer-flow-x', '--offer-flow-y', '--offer-flow-angle', '--offer-flow-scale-x', '--offer-flow-scale-y',
      '--offer-bg-a-x', '--offer-bg-a-y', '--offer-bg-b-x', '--offer-bg-b-y',
      '--offer-detail-x-a', '--offer-detail-y-a', '--offer-detail-angle-a',
      '--offer-detail-x-b', '--offer-detail-y-b', '--offer-detail-angle-b',
    ]
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let animationFrame = 0
    let previousFrame = 0

    const update = (time: number) => {
      const seconds = time / 1000
      const foldX = -4 + Math.sin(seconds * .083) * 13 + Math.sin(seconds * .031 + 1.7) * 5
      const foldY = 1 + Math.cos(seconds * .061 + .4) * 7 + Math.sin(seconds * .027) * 3
      const foldAngle = Math.sin(seconds * .043) * 7 + Math.sin(seconds * .071 + 2.1) * 2.5
      root.style.setProperty('--offer-flow-x', `${foldX.toFixed(3)}%`)
      root.style.setProperty('--offer-flow-y', `${foldY.toFixed(3)}%`)
      root.style.setProperty('--offer-flow-angle', `${foldAngle.toFixed(3)}deg`)
      root.style.setProperty('--offer-flow-scale-x', (1.02 + Math.sin(seconds * .037 + .8) * .09).toFixed(4))
      root.style.setProperty('--offer-flow-scale-y', (.92 + Math.cos(seconds * .049 + 1.4) * .10).toFixed(4))
      root.style.setProperty('--offer-bg-a-x', `${(48 + Math.sin(seconds * .029) * 31).toFixed(2)}%`)
      root.style.setProperty('--offer-bg-a-y', `${(48 + Math.cos(seconds * .041) * 28).toFixed(2)}%`)
      root.style.setProperty('--offer-bg-b-x', `${(52 + Math.sin(seconds * .023 + 2.2) * 34).toFixed(2)}%`)
      root.style.setProperty('--offer-bg-b-y', `${(52 + Math.cos(seconds * .035 + .7) * 30).toFixed(2)}%`)

      root.style.setProperty('--offer-detail-x-a', `${(Math.sin(seconds * .047 + .6) * 13 + Math.sin(seconds * .019) * 4).toFixed(3)}%`)
      root.style.setProperty('--offer-detail-y-a', `${(Math.cos(seconds * .039 + 1.1) * 5 + Math.sin(seconds * .023) * 2).toFixed(3)}%`)
      root.style.setProperty('--offer-detail-angle-a', `${(Math.sin(seconds * .031 + .4) * 3.4).toFixed(3)}deg`)
      root.style.setProperty('--offer-detail-x-b', `${(Math.cos(seconds * .041 + 2.3) * 11 + Math.sin(seconds * .017 + 1.2) * 5).toFixed(3)}%`)
      root.style.setProperty('--offer-detail-y-b', `${(Math.sin(seconds * .053 + .2) * 4 + Math.cos(seconds * .021 + 1.8) * 3).toFixed(3)}%`)
      root.style.setProperty('--offer-detail-angle-b', `${(Math.cos(seconds * .027 + 1.5) * 3.8).toFixed(3)}deg`)
    }

    update(0)
    if (!reducedMotion) {
      const tick = (time: number) => {
        if (document.visibilityState === 'visible' && time - previousFrame >= 33) {
          previousFrame = time
          update(time)
        }
        animationFrame = window.requestAnimationFrame(tick)
      }
      animationFrame = window.requestAnimationFrame(tick)
    }

    return () => {
      window.cancelAnimationFrame(animationFrame)
      propertyNames.forEach((propertyName) => root.style.removeProperty(propertyName))
    }
  }, [])
}

function useSidebarAuroraCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const layers = [
      { color: [66, 232, 168], center: .040, spread: .34, xScale: 2.10, speed: .090, phase: .7, opacity: .82 },
      { color: [64, 186, 220], center: .068, spread: .27, xScale: 1.98, speed: .082, phase: 7.2, opacity: .62 },
      { color: [126, 103, 228], center: .018, spread: .21, xScale: 2.24, speed: .074, phase: 13.6, opacity: .42 },
    ]
    const fieldCanvas = document.createElement('canvas')
    const fieldContext = fieldCanvas.getContext('2d')
    if (!fieldContext) return
    let width = 1
    let height = 1
    let fieldWidth = 1
    let fieldHeight = 1
    let fieldPixels = fieldContext.createImageData(1, 1)
    let animationFrame = 0
    let previousRender = 0

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      fieldWidth = Math.max(96, Math.ceil(width / 2.7))
      fieldHeight = Math.max(108, Math.ceil(height / 2))
      fieldCanvas.width = fieldWidth
      fieldCanvas.height = fieldHeight
      fieldPixels = fieldContext.createImageData(fieldWidth, fieldHeight)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      previousRender = 0
    }

    const smoothstep = (edge0: number, edge1: number, value: number) => {
      const amount = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
      return amount * amount * (3 - 2 * amount)
    }

    const hash = (x: number, y: number, seed: number) => {
      const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123
      return value - Math.floor(value)
    }

    const noise = (x: number, y: number, seed: number) => {
      const x0 = Math.floor(x)
      const y0 = Math.floor(y)
      const tx = x - x0
      const ty = y - y0
      const sx = tx * tx * (3 - 2 * tx)
      const sy = ty * ty * (3 - 2 * ty)
      const top = hash(x0, y0, seed) * (1 - sx) + hash(x0 + 1, y0, seed) * sx
      const bottom = hash(x0, y0 + 1, seed) * (1 - sx) + hash(x0 + 1, y0 + 1, seed) * sx
      return top * (1 - sy) + bottom * sy
    }

    const fbm = (x: number, y: number, seed: number) => (
      noise(x, y, seed) * .57
      + noise(x * 2.03, y * 2.03, seed + 9.7) * .28
      + noise(x * 4.07, y * 4.07, seed + 21.3) * .15
    )

    const renderField = (seconds: number) => {
      const data = fieldPixels.data
      for (let pixelY = 0; pixelY < fieldHeight; pixelY += 1) {
        const y = pixelY / Math.max(1, fieldHeight - 1)
        const topFade = smoothstep(.006, .074, y)
        const bottomFade = 1 - smoothstep(.50, .88, y)

        for (let pixelX = 0; pixelX < fieldWidth; pixelX += 1) {
          const x = pixelX / Math.max(1, fieldWidth - 1)
          let red = 0
          let green = 0
          let blue = 0
          let totalDensity = 0
          const sharedAdvectedX = x * 2.10 - seconds * .082
          const sharedWarp = fbm(
            sharedAdvectedX * .78 + y * .13,
            seconds * .055 - y * .09,
            .7,
          )
          const sharedShear = Math.sin(y * 4.15 + seconds * .19 + .7)
            * (.018 + y * .16 + y * y * .12)
          const flowX = sharedAdvectedX + sharedShear
            + (fbm(sharedAdvectedX * .66, y * .86 - seconds * .034, 45.9) - .5) * y * .22
          const sharedFoldField = fbm(
            flowX * 1.50 + sharedWarp * .94 + 4.7,
            y * .35 + seconds * .034,
            16.1,
          )
          const primaryFoldWave = .5 + .5 * Math.sin(
            flowX * 8.35
            + sharedWarp * 3.05
            + sharedFoldField * 1.38
            + y * 3.35
            - seconds * .095,
          )
          const sharedCurtainFold = .018 + Math.pow(primaryFoldWave, 2.18) * .982
          const secondaryFlow = .77 + .23 * Math.sin(
            flowX * 13.6
            + sharedWarp * 2.1
            + y * 2.4
            - seconds * .095,
          )
          const sharedLengthNoise = fbm(
            flowX * .92 + 9.1,
            seconds * .041,
            31.8,
          )
          const sharedLengthPulse = .78
            + Math.sin(seconds * .34 + sharedAdvectedX * 2.20 + .7) * .17
            + Math.sin(seconds * .16 + sharedAdvectedX * .92 + 2.1) * .08

          layers.forEach((layer) => {
            const advectedX = x * layer.xScale - seconds * layer.speed
            const shearStrength = .025 + y * y * .078
            const shearedX = advectedX
              + Math.sin(y * 4.1 + seconds * .19 + layer.phase) * shearStrength
              + (fbm(advectedX * .62, y * .82 - seconds * .034, layer.phase + 45.2) - .5)
                * y * .11
            const broadWarp = fbm(
              shearedX * .74 + layer.phase,
              seconds * .058 + y * .055 + layer.phase * .07,
              layer.phase,
            )
            const foldField = fbm(
              shearedX * 1.58 + broadWarp * 1.02 + y * .18 + 4.7,
              y * .34 + seconds * .032 + layer.phase * .13,
              layer.phase + 15.4,
            )
            const layerLengthNoise = fbm(
              shearedX * .94 + y * .08 + 9.1,
              seconds * .041 + layer.phase * .19,
              layer.phase + 31.8,
            )
            const front = layer.center
              + (broadWarp - .5) * .13
              + Math.sin(shearedX * 2.8 + seconds * .035 + layer.phase) * .018
            const tailLength = layer.spread
              * (.46 + sharedLengthNoise * .72)
              * sharedLengthPulse
              * (.94 + layerLengthNoise * .12)
            const distance = y - front
            const normalizedDistance = Math.max(0, distance) / tailLength
            const verticalDensity = distance < 0
              ? Math.exp(-Math.pow(-distance / (tailLength * .18), 2)) * .08
              : (1 - Math.exp(-normalizedDistance * 7.5))
                * Math.exp(-Math.pow(normalizedDistance, 1.38))
            const softValley = .14 + smoothstep(.25, .72, foldField) * .86
            const curtainFold = sharedCurtainFold
              * secondaryFlow
              * (.54 + softValley * .46)
            const headGlow = Math.exp(-Math.pow(distance / (tailLength * .16), 2))
              * smoothstep(.48, .74, foldField) * .055
            const brightnessPulse = .82 + .18 * Math.sin(
              seconds * .30
              + sharedAdvectedX * 2.60
              + y * 1.20
              + layer.phase * .17,
            )
            const lowerFlow = .90 + .10 * Math.sin(
              shearedX * 5.3
              - seconds * .15
              + normalizedDistance * 2.7
              + layer.phase,
            )
            const density = (verticalDensity * curtainFold + headGlow)
              * brightnessPulse * lowerFlow
              * topFade * bottomFade * layer.opacity

            red += layer.color[0] * density
            green += layer.color[1] * density
            blue += layer.color[2] * density
            totalDensity += density
          })

          const offset = (pixelY * fieldWidth + pixelX) * 4
          if (totalDensity < .012) {
            data[offset] = 0
            data[offset + 1] = 0
            data[offset + 2] = 0
            data[offset + 3] = 0
            continue
          }

          data[offset] = Math.min(255, red / totalDensity * 1.06)
          data[offset + 1] = Math.min(255, green / totalDensity * 1.06)
          data[offset + 2] = Math.min(255, blue / totalDensity * 1.06)
          data[offset + 3] = Math.min(218, (1 - Math.exp(-totalDensity * 1.10)) * 255)
        }
      }
      fieldContext.putImageData(fieldPixels, 0, 0)
    }

    const draw = (time: number) => {
      if (!reducedMotion && previousRender && time - previousRender < 33) {
        animationFrame = window.requestAnimationFrame(draw)
        return
      }
      previousRender = time
      const seconds = time / 1000
      renderField(seconds)
      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'source-over'

      context.save()
      context.globalAlpha = .26
      context.filter = 'blur(4px)'
      context.drawImage(fieldCanvas, -6, -3, width + 12, height + 6)
      context.restore()

      context.save()
      context.globalAlpha = .95
      context.filter = 'blur(.65px)'
      context.drawImage(fieldCanvas, 0, 0, width, height)
      context.restore()

      context.save()
      context.globalAlpha = .20
      context.filter = 'blur(.12px)'
      context.drawImage(fieldCanvas, 0, 0, width, height)
      context.restore()

      context.globalCompositeOperation = 'source-over'
      context.filter = 'none'
      if (!reducedMotion) animationFrame = window.requestAnimationFrame(draw)
    }

    const resizeObserver = new ResizeObserver(() => {
      resize()
      if (reducedMotion) draw(0)
    })
    resizeObserver.observe(canvas)
    resize()
    draw(0)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
    }
  }, [canvasRef])
}

function useInViewOnce<T extends Element>(threshold = 0.22) {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || visible) return
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setVisible(true)
      observer.disconnect()
    }, { threshold, rootMargin: '0px 0px -6% 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, visible])

  return [ref, visible] as const
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function Logo() {
  return (
    <div className="brand-mark" aria-label="Offer Flow">
      <img src="./offer-flow-mark.svg" alt="" aria-hidden="true" />
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
  const [applicationQuery, setApplicationQuery] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  useOfferAuroraMotion()

  useEffect(() => saveData(data), [data])
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [view])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    const overlayOpen = modal.open || selectedId !== null || sidebarOpen
    if (!overlayOpen) return

    const bodyOverflow = document.body.style.overflow
    const rootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = bodyOverflow
      document.documentElement.style.overflow = rootOverflow
    }
  }, [modal.open, selectedId, sidebarOpen])
  useEffect(() => {
    if (!modal.open && selectedId === null && !sidebarOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (modal.open) setModal({ open: false })
      else if (selectedId !== null) setSelectedId(null)
      else setSidebarOpen(false)
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [modal.open, selectedId, sidebarOpen])
  const selected = data.applications.find((item) => item.id === selectedId)

  function handleLiquidPointer(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const surfaces = [
      target.closest<HTMLElement>('.panel, .metric-card, .sidebar-create, .application-modal, .application-drawer'),
      target.closest<HTMLElement>('.kanban-column'),
    ].filter((surface, index, items): surface is HTMLElement => Boolean(surface) && items.indexOf(surface) === index)

    surfaces.forEach((surface) => {
      const bounds = surface.getBoundingClientRect()
      surface.style.setProperty('--glass-x', `${event.clientX - bounds.left}px`)
      surface.style.setProperty('--glass-y', `${event.clientY - bounds.top}px`)
    })
  }

  function updateApplication(id: string, updates: Partial<Application>, note?: string) {
    setData((current) => ({
      ...current,
      applications: current.applications.map((application) => {
        if (application.id !== id) return application
        let history = normalizeHistory(application.history)
        if (updates.stageId && updates.stageId !== application.stageId) {
          const pipeline = getPipeline(current.pipelines, application.pipelineId)
          const nextStage = pipeline.stages.find((stage) => stage.id === updates.stageId)
          if (nextStage) {
            history = normalizeHistory([...history, {
              id: uid('history'), stageId: nextStage.id, stageName: nextStage.name,
              date: new Date().toISOString(), note,
            }])
          }
        }
        return { ...application, ...updates, history, updatedAt: new Date().toISOString() }
      }),
    }))
  }

  function upsertApplication(application: Application) {
    const normalizedApplication = { ...application, history: normalizeHistory(application.history) }
    setData((current) => {
      const exists = current.applications.some((item) => item.id === normalizedApplication.id)
      return {
        ...current,
        applications: exists
          ? current.applications.map((item) => item.id === normalizedApplication.id ? normalizedApplication : item)
          : [normalizedApplication, ...current.applications],
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

  function deletePipeline(pipelineId: string) {
    const source = data.pipelines.find((pipeline) => pipeline.id === pipelineId)
    const remaining = data.pipelines.filter((pipeline) => pipeline.id !== pipelineId)
    if (!source || !remaining.length) {
      setToast('至少需保留一个公司类型')
      return
    }
    const fallback = remaining[0]
    const migrated = data.applications.filter((application) => application.pipelineId === pipelineId).length
    setData((current) => {
      const applications = current.applications.map((application) => {
        if (application.pipelineId !== pipelineId) return application
        const sourceStage = source.stages.find((stage) => stage.id === application.stageId)
        const targetStage = fallback.stages.find((stage) => stage.kind === sourceStage?.kind) ?? fallback.stages[0]
        return {
          ...application,
          pipelineId: fallback.id,
          stageId: targetStage?.id ?? '',
          updatedAt: new Date().toISOString(),
        }
      })
      return { ...current, pipelines: remaining, applications }
    })
    setToast(migrated ? `已删除公司类型，${migrated} 条投递已迁移至“${fallback.name}”` : '公司类型已删除')
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
    <div className="app-shell" onPointerMove={handleLiquidPointer}>
      <div className="ambient-layer" aria-hidden="true"><i /><i /><i /></div>
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-bottom-aurora" aria-hidden="true">
          <i className="sidebar-aurora-haze" />
          <i className="sidebar-aurora-ribbon sidebar-aurora-ribbon-primary" />
          <i className="sidebar-aurora-ribbon sidebar-aurora-ribbon-secondary" />
          <i className="sidebar-aurora-horizon" />
        </div>
        <div className="brand"><Logo /><span>Offer Flow</span></div>
        <button className="sidebar-create" onClick={() => { setModal({ open: true }); setSidebarOpen(false) }}>
          <span className="sidebar-create-icon"><Plus size={19} /></span>
          <strong>新增投递</strong>
        </button>
        <nav className="sidebar-nav">
          <p className="nav-label">工作空间</p>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.key} className={view === item.key ? 'active' : ''} onClick={() => { setView(item.key); setSidebarOpen(false) }}>
                <Icon size={18} strokeWidth={1.8} /><span>{item.label}</span>
          </button>
            )
          })}
        </nav>
      </aside>

      <main className="main-shell">
        <button className="mobile-menu mobile-menu-floating" aria-label="打开导航菜单" onClick={() => setSidebarOpen((value) => !value)}><Menu size={20} /></button>

        <div className="page-wrap">
          {view !== 'schedule' && <div className={`page-heading ${view === 'overview' ? 'overview-heading' : ''}`}>
            <div><h1>{view === 'overview' ? `${getGreeting()}，祝你离理想 Offer 更近一步` : viewMeta[view].title}</h1>{viewMeta[view].description && <p>{viewMeta[view].description}</p>}</div>
            {view === 'overview' && <div className="date-stamp"><CalendarDays size={16} /> {format(new Date(), 'M月d日 EEEE', { locale: zhCN })}</div>}
          </div>}

          {view === 'overview' && <Overview {...pageProps} setView={setView} />}
          {view === 'applications' && <Applications {...pageProps} query={applicationQuery} onQueryChange={setApplicationQuery} onAdd={() => setModal({ open: true })} />}
          {view === 'board' && <Board {...pageProps} />}
          {view === 'schedule' && <Schedule {...pageProps} />}
          {view === 'analytics' && <Analytics data={data} />}
          {view === 'pipelines' && (
            <PipelineSettings
              data={data}
              onChange={(pipelines) => setData((current) => ({ ...current, pipelines }))}
              onDeletePipeline={deletePipeline}
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
      {modal.open && <ApplicationModal pipelines={data.pipelines} applications={data.applications} application={modal.application} onClose={() => setModal({ open: false })} onSave={upsertApplication} />}
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

function Overview({ data, openApplication, setView }: PageProps & { setView: (view: ViewKey) => void }) {
  const active = data.applications.filter((item) => isActive(data.pipelines, item))
  const interviews = data.applications.filter((item) => getStage(data.pipelines, item)?.kind === 'interview')
  const offers = data.applications.filter((item) => getStage(data.pipelines, item)?.kind === 'offer')
  const upcoming = active.filter((item) => item.nextActionAt).sort((a, b) => String(a.nextActionAt).localeCompare(String(b.nextActionAt))).slice(0, 5)
  const focus = active.filter((item) => item.priority === 'high').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
  const today = new Date()
  const todayKey = format(today, 'yyyy-MM-dd')
  const weekStartKey = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEndKey = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const nextWeekKey = format(addDays(today, 7), 'yyyy-MM-dd')
  const thisWeekAdded = data.applications.filter((item) => item.appliedAt >= weekStartKey && item.appliedAt <= weekEndKey).length
  const nextSevenDayInterviews = interviews.filter((item) => {
    const date = item.nextActionAt?.slice(0, 10)
    return date && date >= todayKey && date <= nextWeekKey
  }).length
  const offerRate = Math.round(offers.length / Math.max(1, data.applications.length) * 1000) / 10
  const scheduledThisWeek = active.filter((item) => {
    const date = item.nextActionAt?.slice(0, 10)
    return date && date >= weekStartKey && date <= weekEndKey
  }).length
  const overdueTasks = active.filter((item) => item.nextActionAt && item.nextActionAt.slice(0, 10) < todayKey).length
  const todayTasks = active.filter((item) => item.nextActionAt?.slice(0, 10) === todayKey).length
  const highWithoutNextAction = active.filter((item) => item.priority === 'high' && !item.nextActionAt).length
  const averageResponseDays = average(active.map((item) => Math.max(0, differenceInCalendarDays(parseISO(item.updatedAt), parseISO(item.appliedAt)))))
  const rhythmScore = Math.max(32, Math.min(98, Math.round(100 - overdueTasks / Math.max(1, active.length) * 65 - highWithoutNextAction * 7)))
  const rhythmStatus = rhythmScore >= 85 ? '执行节奏出色' : rhythmScore >= 70 ? '执行节奏稳定' : '需要整理待办'
  const kindCounts = (['applied', 'assessment', 'interview', 'offer'] as StageKind[]).map((kind) => ({
    kind, label: kindLabels[kind], value: data.applications.filter((item) => getStage(data.pipelines, item)?.kind === kind).length,
  }))
  const maxCount = Math.max(...kindCounts.map((item) => item.value), 1)

  return (
    <div className="page-grid overview-page">
      <section className="metric-grid">
        <MetricCard label="全部投递" value={data.applications.length} delta={`本周 +${thisWeekAdded}`} icon={<BriefcaseBusiness size={19} />} />
        <MetricCard label="进行中" value={active.length} delta={`${Math.round(active.length / data.applications.length * 100)}% 活跃`} icon={<Activity size={19} />} />
        <MetricCard label="面试阶段" value={interviews.length} delta={`未来 7 天 ${nextSevenDayInterviews} 场`} icon={<UserRound size={19} />} />
        <MetricCard label="已获 Offer" value={offers.length} delta={`转化率 ${offerRate}%`} icon={<Sparkles size={19} />} accent />
      </section>

      <section className="panel agenda-panel">
        <SectionHeader eyebrow="NEXT ACTIONS" title="接下来要做" action={<button className="text-button" onClick={() => setView('schedule')}>查看日程 <ArrowRight size={14} /></button>} />
        <div className="agenda-list">
          {upcoming.map((item) => {
            const due = relativeDue(item.nextActionAt)
            return (
              <button className="agenda-item" key={item.id} onClick={() => openApplication(item.id)}>
                <div className={`agenda-date ${due.tone}`}><strong>{format(parseISO(item.nextActionAt!), 'dd')}</strong><span>{format(parseISO(item.nextActionAt!), 'MM月')}</span></div>
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
        <div className="flow-note"><TrendingUp size={17} /><div><strong>{interviews.length} 个机会正在面试阶段</strong><span>占活跃机会的 {Math.round(interviews.length / Math.max(1, active.length) * 100)}%，其中未来 7 天已安排 {nextSevenDayInterviews} 场</span></div></div>
        <div className="flow-summary" aria-label="流程健康摘要">
          <div><span>活跃机会</span><strong>{active.length}</strong></div>
          <div><span>面试阶段占比</span><strong>{Math.round(interviews.length / Math.max(1, active.length) * 100)}%</strong></div>
          <div><span>已安排下一步</span><strong>{active.filter((item) => item.nextActionAt).length}/{active.length}</strong></div>
        </div>
      </section>

      <section className="panel focus-panel">
        <SectionHeader eyebrow="FOCUS" title="重点推进" action={<span className="subtle-count">{focus.length} 个高优机会</span>} />
        <div className="focus-list">
          {focus.map((item) => {
            const stage = getStage(data.pipelines, item)
            return (
              <button className="focus-item" key={item.id} onClick={() => openApplication(item.id)}>
                <div className="focus-company"><strong>{item.company}</strong><span>{item.role}</span></div>
                <StagePill stage={stage} /><div className="focus-updated"><span>最近更新</span><strong>{shortDate(item.updatedAt)}</strong></div><ChevronRight size={17} />
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel rhythm-panel">
        <SectionHeader eyebrow="RHYTHM" title="本周节奏" />
        <div className="rhythm-score"><div className="score-ring" style={{ '--score': `${rhythmScore}%` } as React.CSSProperties}><span>{rhythmScore}</span></div><div className="score-copy"><strong>{rhythmStatus}</strong><p>{highWithoutNextAction ? `${highWithoutNextAction} 个高优机会尚未设置下一步` : '高优先级机会均已设置下一步'}，今天有 {todayTasks} 项安排。</p></div></div>
        <div className="rhythm-stats"><div><span>本周安排</span><strong>{scheduledThisWeek}</strong></div><div><span>平均推进</span><strong>{averageResponseDays.toFixed(1)} 天</strong></div></div>
      </section>
    </div>
  )
}

function MetricCard({ label, value, delta, icon, accent = false, suffix = '' }: { label: string; value: number; delta: string; icon: ReactNode; accent?: boolean; suffix?: string }) {
  return <div className={`metric-card ${accent ? 'accent' : ''}`}><div className="metric-top"><span>{label}</span><i>{icon}</i></div><div className="metric-value">{String(value).padStart(2, '0')}<small>{suffix}</small></div><div className="metric-foot"><span>{delta}</span><ArrowUp size={13} /></div></div>
}

function OverflowTooltipText({ text, as = 'span', className = '' }: { text: string; as?: 'span' | 'strong'; className?: string }) {
  const anchorRef = useRef<HTMLElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const [tooltip, setTooltip] = useState<{ top: number; left: number; width: number; placement: 'above' | 'below' } | null>(null)
  const Tag = as

  function showTooltip() {
    const anchor = anchorRef.current
    if (!anchor || anchor.scrollWidth <= anchor.clientWidth + 1) return
    const bounds = anchor.getBoundingClientRect()
    const width = Math.min(360, Math.max(190, anchor.scrollWidth + 30), window.innerWidth - 24)
    const left = Math.max(12, Math.min(bounds.left + bounds.width / 2 - width / 2, window.innerWidth - width - 12))
    const estimatedHeight = 70
    const placement = bounds.bottom + estimatedHeight + 12 > window.innerHeight ? 'above' : 'below'
    setTooltip({
      top: placement === 'above' ? bounds.top - 9 : bounds.bottom + 9,
      left,
      width,
      placement,
    })
  }

  useEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const measure = () => setIsTruncated(anchor.scrollWidth > anchor.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(anchor)
    return () => observer.disconnect()
  }, [text])

  useEffect(() => {
    if (!tooltip) return
    const close = () => setTooltip(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [tooltip])

  return <>
    <Tag ref={anchorRef as React.Ref<HTMLElement>} className={`overflow-tooltip-anchor ${className}`} tabIndex={isTruncated ? 0 : undefined} onMouseEnter={showTooltip} onMouseLeave={() => setTooltip(null)} onFocus={showTooltip} onBlur={() => setTooltip(null)}>
      {text}
    </Tag>
    {tooltip && createPortal(
      <div className={`glass-overflow-tooltip ${tooltip.placement}`} role="tooltip" style={{ top: tooltip.top, left: tooltip.left, width: tooltip.width }}>
        {text}
      </div>,
      document.body,
    )}
  </>
}

function Applications({ data, openApplication, updateApplication, query, onQueryChange, onAdd }: PageProps & { query: string; onQueryChange: (query: string) => void; onAdd: () => void }) {
  const [pipelineFilter, setPipelineFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sortMode, setSortMode] = useState('updated-desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [columnWidths, setColumnWidths] = useState(() => {
    const fallback = [164, 165, 150, 108, 192, 100, 36]
    try {
      const stored = JSON.parse(localStorage.getItem('offer-flow-table-columns-v2') ?? 'null')
      return Array.isArray(stored) && stored.length === 7 && stored.every((value) => typeof value === 'number') ? stored : fallback
    } catch {
      return fallback
    }
  })
  const resizeCleanupRef = useRef<(() => void) | null>(null)
  const columnMinimums = [134, 132, 124, 92, 142, 86, 36]

  useEffect(() => () => resizeCleanupRef.current?.(), [])
  useEffect(() => localStorage.setItem('offer-flow-table-columns-v2', JSON.stringify(columnWidths)), [columnWidths])

  function resizedColumns(base: number[], index: number, delta: number) {
    const nextIndex = index + 1
    const bounded = Math.max(columnMinimums[index] - base[index], Math.min(delta, base[nextIndex] - columnMinimums[nextIndex]))
    const next = [...base]
    next[index] = base[index] + bounded
    next[nextIndex] = base[nextIndex] - bounded
    return next
  }

  function startColumnResize(index: number, event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    resizeCleanupRef.current?.()
    const startX = event.clientX
    const startWidths = [...columnWidths]
    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const handleMove = (moveEvent: globalThis.PointerEvent) => setColumnWidths(resizedColumns(startWidths, index, moveEvent.clientX - startX))
    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', cleanup)
      document.body.style.userSelect = previousUserSelect
      document.body.style.cursor = previousCursor
      resizeCleanupRef.current = null
    }
    resizeCleanupRef.current = cleanup
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', cleanup)
  }

  function resizeHandle(index: number, label: string) {
    return <button type="button" className="column-resize-handle" aria-label={`调整${label}列宽`} title="拖动调整列宽" onPointerDown={(event) => startColumnResize(index, event)} onKeyDown={(event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      setColumnWidths((current) => resizedColumns(current, index, event.key === 'ArrowLeft' ? -8 : 8))
    }} />
  }

  function sortButton(field: 'company' | 'role' | 'stage' | 'priority' | 'next' | 'updated', label: string, defaultDirection: 'asc' | 'desc' = 'asc') {
    const active = sortMode.startsWith(`${field}-`)
    const direction = active ? sortMode.endsWith('-asc') ? 'asc' : 'desc' : defaultDirection
    return <button type="button" className={`column-sort-button ${active ? 'active' : ''}`} aria-label={`${label}${direction === 'asc' ? '升序' : '降序'}排列`} title={`按${label}排序`} onClick={() => setSortMode(active ? `${field}-${direction === 'asc' ? 'desc' : 'asc'}` : `${field}-${defaultDirection}`)}>{direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}</button>
  }

  const filtered = useMemo(() => {
    const items = data.applications.filter((item) => {
      const haystack = `${item.company} ${item.role} ${item.city} ${item.tags.join(' ')}`.toLowerCase()
      const stage = getStage(data.pipelines, item)
      return haystack.includes(query.toLowerCase())
        && (pipelineFilter === 'all' || item.pipelineId === pipelineFilter)
        && (kindFilter === 'all' || stage?.kind === kindFilter)
        && (priorityFilter === 'all' || item.priority === priorityFilter)
    })

    return items.sort((a, b) => {
      const direction = sortMode.endsWith('-asc') ? 1 : -1
      if (sortMode.startsWith('company-')) return direction * a.company.localeCompare(b.company, 'zh-CN')
      if (sortMode.startsWith('role-')) return direction * a.role.localeCompare(b.role, 'zh-CN')
      if (sortMode.startsWith('stage-')) return direction * (getStage(data.pipelines, a)?.name ?? '').localeCompare(getStage(data.pipelines, b)?.name ?? '', 'zh-CN')
      if (sortMode.startsWith('priority-')) {
        const priorityRank = { low: 1, medium: 2, high: 3 }
        return direction * (priorityRank[a.priority] - priorityRank[b.priority])
      }
      if (sortMode.startsWith('next-')) {
        const aDate = a.nextActionAt ?? (direction === 1 ? '9999' : '')
        const bDate = b.nextActionAt ?? (direction === 1 ? '9999' : '')
        return direction * aDate.localeCompare(bDate)
      }
      return direction * a.updatedAt.localeCompare(b.updatedAt)
    })
  }, [data, query, pipelineFilter, kindFilter, priorityFilter, sortMode])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = filtered.length ? (currentPage - 1) * pageSize : 0
  const pageEnd = Math.min(pageStart + pageSize, filtered.length)
  const paginated = filtered.slice(pageStart, pageEnd)
  const visiblePages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
    const anchors = Array.from(new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]))
      .filter((value) => value >= 1 && value <= totalPages)
      .sort((a, b) => a - b)
    const result: Array<number | string> = []
    anchors.forEach((value, index) => {
      const previous = anchors[index - 1]
      if (previous && value - previous > 1) result.push(`ellipsis-${previous}`)
      result.push(value)
    })
    return result
  }, [currentPage, totalPages])

  useEffect(() => setPage(1), [query, pipelineFilter, kindFilter, priorityFilter, sortMode, pageSize])
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <section className="panel table-panel">
      <div className="table-toolbar">
        <div className="toolbar-search"><Search size={16} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索公司、岗位、城市或标签" /></div>
        <div className="filters"><button className="primary-button" onClick={onAdd}><Plus size={16} /> 新增投递</button></div>
      </div>
      <div className="result-summary"><span>共 {filtered.length} 条记录</span><span>·</span><span>{filtered.filter((item) => isActive(data.pipelines, item)).length} 条进行中</span></div>
      <div className="table-scroll">
        <table>
          <colgroup>{columnWidths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
          <thead><tr>
            <th className={pipelineFilter !== 'all' ? 'filtered' : ''}><div className="column-head-controls"><GlassSelect className="column-filter-select" ariaLabel="按公司类型筛选" value={pipelineFilter} onChange={setPipelineFilter} options={[['all','公司'], ...data.pipelines.map((item) => [item.id,item.name])]} />{sortButton('company', '公司')}</div>{resizeHandle(0, '公司')}</th>
            <th><div className="column-head-controls"><span>岗位</span>{sortButton('role', '岗位')}</div>{resizeHandle(1, '岗位')}</th>
            <th className={kindFilter !== 'all' ? 'filtered' : ''}><div className="column-head-controls"><GlassSelect className="column-filter-select" ariaLabel="按阶段筛选" value={kindFilter} onChange={setKindFilter} options={[['all','当前阶段'], ...selectableKindOptions]} />{sortButton('stage', '当前阶段')}</div>{resizeHandle(2, '当前阶段')}</th>
            <th className={priorityFilter !== 'all' ? 'filtered' : ''}><div className="column-head-controls"><GlassSelect className="column-filter-select" ariaLabel="按优先级筛选" value={priorityFilter} onChange={setPriorityFilter} options={[['all','优先级'],['high','高'],['medium','中'],['low','低']]} />{sortButton('priority', '优先级', 'desc')}</div>{resizeHandle(3, '优先级')}</th>
            <th><div className="column-head-controls"><span>下一步</span>{sortButton('next', '下一步')}</div>{resizeHandle(4, '下一步')}</th>
            <th><div className="column-head-controls"><span>最近更新</span>{sortButton('updated', '最近更新', 'desc')}</div>{resizeHandle(5, '最近更新')}</th><th />
          </tr></thead>
          <tbody>
            {paginated.map((item) => {
              const pipeline = getPipeline(data.pipelines, item.pipelineId)
              const stage = getStage(data.pipelines, item)
              return (
                <tr key={item.id} onClick={() => openApplication(item.id)}>
                  <td><div className="company-cell"><OverflowTooltipText as="strong" text={item.company} /><span className={`company-type company-type-${Math.max(0, data.pipelines.findIndex((entry) => entry.id === pipeline.id)) % 5}`}>{pipeline.name}</span></div></td>
                  <td><div className="role-cell"><OverflowTooltipText as="strong" text={item.role} /><span>{item.city}</span></div></td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <GlassSelect className="stage-select" ariaLabel={`${item.company} 当前阶段`} value={item.stageId} onChange={(stageId) => updateApplication(item.id, { stageId })} options={pipeline.stages.map((option) => [option.id, option.name])} />
                  </td>
                  <td><PriorityMark priority={item.priority} withLabel /></td>
                  <td>{item.nextAction ? <div className="next-cell"><OverflowTooltipText as="strong" text={item.nextAction} /><span className={relativeDue(item.nextActionAt).tone}>{relativeDue(item.nextActionAt).text}</span></div> : <span className="empty-value">未安排</span>}</td>
                  <td><span className="updated-cell">{shortDate(item.updatedAt)}</span></td>
                  <td><button className="row-open"><ChevronRight size={17} /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!filtered.length && <div className="empty-state"><CircleDashed size={34} /><h3>没有找到匹配记录</h3><p>试试清除筛选条件，或添加一条新的投递。</p></div>}
      {!!filtered.length && <div className="table-pagination">
        <div className="pagination-summary">显示第 <strong>{pageStart + 1}</strong>–<strong>{pageEnd}</strong> 条，共 <strong>{filtered.length}</strong> 条</div>
        <div className="pagination-controls">
          <label className="page-size-control"><span>每页</span><GlassSelect ariaLabel="选择每页记录数" value={String(pageSize)} onChange={(value) => setPageSize(Number(value))} options={[["15","15 条"],["25","25 条"],["50","50 条"]]} /></label>
          <nav className="page-buttons" aria-label="投递记录分页">
            <button type="button" className="page-arrow" aria-label="上一页" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /></button>
            {visiblePages.map((item) => typeof item === 'number'
              ? <button type="button" key={item} className={item === currentPage ? 'active' : ''} aria-label={`第 ${item} 页`} aria-current={item === currentPage ? 'page' : undefined} onClick={() => setPage(item)}>{item}</button>
              : <span className="page-ellipsis" key={item}>···</span>)}
            <button type="button" className="page-arrow" aria-label="下一页" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronRight size={16} /></button>
          </nav>
        </div>
      </div>}
    </section>
  )
}

function GlassSelect({ value, onChange, options, className = '', ariaLabel }: {
  value: string
  onChange: (value: string) => void
  options: string[][]
  className?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selectedIndex = Math.max(0, options.findIndex(([key]) => key === value))
  const selectedLabel = options[selectedIndex]?.[1] ?? '请选择'

  function updateMenuPosition() {
    const bounds = rootRef.current?.getBoundingClientRect()
    if (!bounds) return
    const menuWidth = className.includes('column-filter-select')
      ? Math.max(168, bounds.width)
      : bounds.width
    const estimatedHeight = Math.min(options.length * 39 + 12, 266)
    const openAbove = bounds.bottom + estimatedHeight + 12 > window.innerHeight && bounds.top > estimatedHeight
    const desiredTop = openAbove ? bounds.top - estimatedHeight - 7 : bounds.bottom + 7
    setMenuPosition({
      top: Math.max(10, Math.min(desiredTop, window.innerHeight - estimatedHeight - 10)),
      left: Math.max(10, Math.min(bounds.left, window.innerWidth - menuWidth - 10)),
      width: menuWidth,
    })
  }

  function showMenu() {
    updateMenuPosition()
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const followAnchor = () => updateMenuPosition()
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', followAnchor)
    window.addEventListener('scroll', followAnchor, true)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', followAnchor)
      window.removeEventListener('scroll', followAnchor, true)
    }
  }, [open])

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      open ? setOpen(false) : showMenu()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex = (selectedIndex + direction + options.length) % options.length
    onChange(options[nextIndex][0])
    if (!open) showMenu()
  }

  return <div className={`glass-select ${className} ${open ? 'open' : ''}`} ref={rootRef}>
    <button type="button" className="glass-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => open ? setOpen(false) : showMenu()} onKeyDown={handleKeyDown}>
      <span>{selectedLabel}</span><ChevronDown className="glass-select-chevron" size={14} />
    </button>
    {open && createPortal(
      <div className="glass-select-menu" ref={menuRef} role="listbox" style={menuPosition} onClick={(event) => event.stopPropagation()}>
        {options.map(([key, label]) => <button type="button" role="option" aria-selected={key === value} className={`glass-select-option ${key === value ? 'selected' : ''}`} key={key} onClick={() => { onChange(key); setOpen(false) }}><span>{label}</span>{key === value && <Check size={14} />}</button>)}
      </div>,
      document.body,
    )}
  </div>
}

function GlassColorPicker({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value.toUpperCase())
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => setDraft(value.toUpperCase()), [value])
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false)
    }
    const closeOnViewportChange = () => setOpen(false)
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange, true)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closeOnViewportChange)
      window.removeEventListener('scroll', closeOnViewportChange, true)
    }
  }, [open])

  function showPicker() {
    const bounds = rootRef.current?.getBoundingClientRect()
    if (!bounds) return
    const width = 238
    const height = 238
    const openAbove = bounds.bottom + height + 12 > window.innerHeight && bounds.top > height
    setPosition({
      top: openAbove ? Math.max(10, bounds.top - height - 8) : bounds.bottom + 8,
      left: Math.max(10, Math.min(bounds.left, window.innerWidth - width - 10)),
    })
    setOpen(true)
  }

  function applyHex(next: string) {
    const normalized = next.startsWith('#') ? next : `#${next}`
    setDraft(normalized.toUpperCase())
    if (/^#[0-9A-F]{6}$/i.test(normalized)) onChange(normalized.toLowerCase())
  }

  return <div className={`glass-color-picker ${open ? 'open' : ''}`} ref={rootRef}>
    <button type="button" className="color-picker-trigger" aria-label={`选择${label}颜色，当前 ${value}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => open ? setOpen(false) : showPicker()}><i style={{ '--picker-color': value } as React.CSSProperties} /></button>
    {open && createPortal(
      <div className="glass-color-popover" ref={popoverRef} role="dialog" aria-label={`${label}颜色选择`} style={position} onClick={(event) => event.stopPropagation()}>
        <div className="color-popover-head"><div><span>阶段颜色</span><strong>{label}</strong></div><i style={{ '--picker-color': value } as React.CSSProperties} /></div>
        <div className="color-preset-grid">{stageColorPresets.map((color) => <button type="button" key={color} className={color.toLowerCase() === value.toLowerCase() ? 'selected' : ''} aria-label={color} title={color} style={{ '--picker-color': color } as React.CSSProperties} onClick={() => { onChange(color); setDraft(color.toUpperCase()); setOpen(false) }} />)}</div>
        <label className="color-hex-field"><span>HEX</span><input value={draft} maxLength={7} spellCheck={false} onChange={(event) => applyHex(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && /^#[0-9A-F]{6}$/i.test(draft)) setOpen(false) }} /></label>
      </div>,
      document.body,
    )}
  </div>
}

function Board({ data, openApplication, updateApplication }: PageProps) {
  const [pipelineId, setPipelineId] = useState('all')
  const pipeline = pipelineId === 'all' ? null : getPipeline(data.pipelines, pipelineId)
  const stages = pipeline?.stages ?? aggregateBoardStages
  const items = pipeline ? data.applications.filter((item) => item.pipelineId === pipelineId) : data.applications
  const [dragId, setDragId] = useState<string | null>(null)
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null)
  const [boardScrollWidth, setBoardScrollWidth] = useState(0)
  const topScrollRef = useRef<HTMLDivElement>(null)
  const boardScrollRef = useRef<HTMLDivElement>(null)

  const stageItemsFor = (stage: Stage) => items
    .filter((item) => pipeline ? item.stageId === stage.id : getStage(data.pipelines, item)?.kind === stage.kind)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  const expandedStage = stages.find((stage) => stage.id === expandedStageId)
  const expandedStageItems = expandedStage ? stageItemsFor(expandedStage) : []

  useEffect(() => {
    setExpandedStageId(null)
  }, [pipelineId])

  useEffect(() => {
    const scrollNode = boardScrollRef.current
    if (!scrollNode) return
    const boardNode = scrollNode.firstElementChild
    const measure = () => setBoardScrollWidth(scrollNode.scrollWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scrollNode)
    if (boardNode) observer.observe(boardNode)
    return () => observer.disconnect()
  }, [stages.length, items.length, pipelineId])

  useEffect(() => {
    if (!expandedStageId) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpandedStageId(null) }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [expandedStageId])

  function drop(event: DragEvent<HTMLDivElement>, stage: Stage) {
    event.preventDefault()
    if (dragId) {
      if (pipeline) updateApplication(dragId, { stageId: stage.id })
      else {
        const application = data.applications.find((item) => item.id === dragId)
        const target = application && getPipeline(data.pipelines, application.pipelineId).stages.find((item) => item.kind === stage.kind)
        if (target) updateApplication(dragId, { stageId: target.id })
      }
    }
    setDragId(null)
  }

  function renderKanbanCard(item: Application, draggable = true, stageColor?: string, showNextAction = true, stageKind?: StageKind) {
    if (!draggable) {
      return (
        <button
          className={`kanban-card stage-detail-card ${stageKind ? `stage-${stageKind}` : ''} ${stageKind === 'offer' ? `aurora-variant-${offerAuroraVariant(item.id)}` : ''}`}
          key={item.id}
          style={{
            '--card-stage-color': stageColor ?? '#315f55',
            ...(stageKind === 'offer' ? offerAuroraStyle(item.id) : {}),
          } as React.CSSProperties}
          onClick={() => openApplication(item.id)}
        >
          {stageKind === 'offer' && <OfferAuroraScene detail meteorSeed={item.id} />}
          <span className="stage-detail-date"><small>最近更新</small><strong>{shortDate(item.updatedAt)}</strong></span>
          <span className="stage-detail-content">
            <span className="stage-detail-title"><span><strong>{item.company}</strong><small>{item.role}</small></span><PriorityMark priority={item.priority} /></span>
            <span className="stage-detail-meta"><span><MapPin size={12} />{item.city}</span>{item.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</span>
            {showNextAction && <span className={`stage-detail-next ${item.nextAction ? relativeDue(item.nextActionAt).tone : ''}`}><Clock3 size={13} /><span>{item.nextAction || '暂未安排下一步'}</span>{item.nextActionAt && <time>{format(parseISO(item.nextActionAt), 'M月d日 HH:mm')}</time>}</span>}
          </span>
          <ChevronRight className="stage-detail-arrow" size={17} />
        </button>
      )
    }
    return (
      <button
        className={`kanban-card ${stageKind ? `stage-${stageKind}` : ''} ${stageKind === 'offer' ? `aurora-variant-${offerAuroraVariant(item.id)}` : ''} ${dragId === item.id ? 'dragging' : ''}`}
        key={item.id}
        style={{ '--card-stage-color': stageColor ?? '#315f55', ...(stageKind === 'offer' ? offerAuroraStyle(item.id) : {}) } as React.CSSProperties}
        draggable
        onDragStart={() => setDragId(item.id)}
        onDragEnd={() => setDragId(null)}
        onClick={() => openApplication(item.id)}
      >
        {stageKind === 'offer' && <OfferAuroraScene />}
        <div className="kanban-card-top"><strong>{item.company}</strong><PriorityMark priority={item.priority} /></div>
        <p>{item.role}</p>
        <div className="kanban-tags">{item.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
        <div className="kanban-card-foot"><span><MapPin size={12} />{item.city}</span><span>{shortDate(item.updatedAt)}</span></div>
        {showNextAction && item.nextAction && <div className={`kanban-action ${relativeDue(item.nextActionAt).tone}`}><Clock3 size={13} /><span>{item.nextAction}</span></div>}
      </button>
    )
  }

  return (
    <div className="board-page">
      <div className="board-toolbar panel">
        <div className="board-navigation">
          <span className="toolbar-kicker">公司类型</span>
          <nav className="glass-tabs pipeline-tabs" aria-label="选择公司类型">
            <button className={pipelineId === 'all' ? 'active' : ''} aria-pressed={pipelineId === 'all'} onClick={() => setPipelineId('all')}><span>全部</span><small>{data.applications.length}</small></button>
            {data.pipelines.map((item) => {
              const count = data.applications.filter((application) => application.pipelineId === item.id).length
              return <button key={item.id} className={pipelineId === item.id ? 'active' : ''} aria-pressed={pipelineId === item.id} onClick={() => setPipelineId(item.id)}><span>{item.name}</span><small>{count}</small></button>
            })}
          </nav>
        </div>
        <div className="board-hint"><GripVertical size={15} /> {pipeline ? '拖动卡片更新阶段；流程允许跳过任意环节' : '全部机会按归一阶段汇总，拖动时会匹配对应公司流程'}</div>
      </div>
      <div className="kanban-top-scroll" ref={topScrollRef} onScroll={(event) => { if (boardScrollRef.current && boardScrollRef.current.scrollLeft !== event.currentTarget.scrollLeft) boardScrollRef.current.scrollLeft = event.currentTarget.scrollLeft }} aria-label="流程看板横向滚动">
        <div style={{ width: boardScrollWidth }} />
      </div>
      <div className="kanban-scroll" ref={boardScrollRef} onScroll={(event) => { if (topScrollRef.current && topScrollRef.current.scrollLeft !== event.currentTarget.scrollLeft) topScrollRef.current.scrollLeft = event.currentTarget.scrollLeft }}>
        <div className="kanban-board" style={{ '--column-count': Math.min(stages.length, 8) } as React.CSSProperties}>
          {stages.map((stage) => {
            const stageItems = stageItemsFor(stage)
            const displayColor = boardStageColor(stage)
            const shouldCollapse = stageItems.length >= 2
            const visibleItems = shouldCollapse ? [] : stageItems
            const foldedPreviews = shouldCollapse ? stageItems.slice(0, 3) : []
            const stageSupportsNextAction = stage.kind !== 'offer' && stage.kind !== 'closed'
            const frontPreview = foldedPreviews.at(-1)
            const frontHasAction = stageSupportsNextAction && Boolean(frontPreview?.nextAction)
            const deckCardHeight = frontHasAction ? 205 : 164
            const deckHeight = deckCardHeight + Math.max(0, foldedPreviews.length - 1) * 65 + 4
            return (
              <div className={`kanban-column stage-column-${stage.kind}`} key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, stage)}>
                <div className="column-head"><div><i style={{ background: displayColor }} /><strong>{stage.name}</strong></div><span>{stageItems.length}</span></div>
                <div className="column-list">
                  {visibleItems.map((item) => renderKanbanCard(item, true, displayColor, stageSupportsNextAction, stage.kind))}
                  {shouldCollapse && <button
                    type="button"
                    className={`stage-card-deck stage-${stage.kind} ${frontHasAction ? '' : 'compact'}`}
                    style={{ '--deck-height': `${deckHeight}px`, '--deck-card-height': `${deckCardHeight}px`, '--deck-color': displayColor } as React.CSSProperties}
                    onClick={() => setExpandedStageId(stage.id)}
                    aria-label={`展开${stage.name}阶段的全部${stageItems.length}项机会`}
                  >
                    <span className="stage-deck-count">{stageItems.length} 个机会</span>
                    {foldedPreviews.map((item, index) => <span
                      className={`stage-card-deck-item ${stage.kind === 'offer' ? `aurora-variant-${offerAuroraVariant(item.id)}` : ''}`}
                      key={item.id}
                      style={{ '--deck-index': index, '--deck-color': displayColor, ...(stage.kind === 'offer' ? offerAuroraStyle(item.id) : {}) } as React.CSSProperties}
                    >
                      {stage.kind === 'offer' && <OfferAuroraScene meteorSeed={index === foldedPreviews.length - 1 ? item.id : undefined} />}
                      <span className="stage-deck-head"><strong>{item.company}</strong>{index === foldedPreviews.length - 1 && <ChevronRight size={15} />}</span>
                      {index === foldedPreviews.length - 1 && <>
                        <span className="stage-deck-role">{item.role}</span>
                        <span className="stage-deck-meta"><span><MapPin size={12} />{item.city}</span><span>{shortDate(item.updatedAt)}</span></span>
                        {stageSupportsNextAction && item.nextAction && <span className={`stage-deck-action ${relativeDue(item.nextActionAt).tone}`}><Clock3 size={12} /><span>{item.nextAction}</span></span>}
                        <span className="stage-deck-more"><span>{stageItems.length > 2 ? '更多机会' : '查看全部'}</span><ChevronRight size={14} /></span>
                      </>}
                    </span>)}
                  </button>}
                  {!stageItems.length && <div className="column-empty">拖动到此阶段</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {expandedStage && (
        <div className={`stage-overview-layer stage-${expandedStage.kind}`} role="presentation" onMouseDown={() => setExpandedStageId(null)}>
          <section className={`stage-overview-panel stage-${expandedStage.kind}`} role="dialog" aria-modal="true" aria-labelledby="stage-overview-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="stage-overview-head">
              <div><span className="stage-overview-kicker"><i style={{ background: boardStageColor(expandedStage) }} />阶段详情</span><h2 id="stage-overview-title">{expandedStage.name}</h2><p>{expandedStageItems.length} 个岗位机会，按更新时间由早到晚排列。</p></div>
              <button type="button" className="icon-button" aria-label="关闭阶段详情" onClick={() => setExpandedStageId(null)}><X size={18} /></button>
            </header>
            <div className="stage-overview-grid">{expandedStageItems.map((item) => renderKanbanCard(item, false, boardStageColor(expandedStage), expandedStage.kind !== 'offer' && expandedStage.kind !== 'closed', expandedStage.kind))}</div>
          </section>
        </div>
      )}
    </div>
  )
}

function Schedule({ data, openApplication }: PageProps) {
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [expandedDay, setExpandedDay] = useState<Date | null>(null)
  const [calendarMode, setCalendarMode] = useState<'week' | 'month'>('month')
  const [schedulePanel, setSchedulePanel] = useState<'day' | 'upcoming' | null>(null)
  const scheduleDockRef = useRef<HTMLElement>(null)
  const scheduleFlyoutRef = useRef<HTMLElement>(null)
  const scheduled = data.applications.filter((item) => item.nextActionAt).sort((a, b) => String(a.nextActionAt).localeCompare(String(b.nextActionAt)))
  const monthStart = startOfMonth(month)
  const visibleWeekStart = startOfWeek(selectedDay, { weekStartsOn: 1 })
  const visibleWeekEnd = endOfWeek(selectedDay, { weekStartsOn: 1 })
  const days = calendarMode === 'month'
    ? eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
    : eachDayOfInterval({ start: visibleWeekStart, end: visibleWeekEnd })
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const upcoming = scheduled.filter((item) => parseISO(item.nextActionAt!) >= todayStart).slice(0, 6)
  const selectedEvents = scheduled.filter((item) => isSameDay(parseISO(item.nextActionAt!), selectedDay))
  const expandedEvents = expandedDay ? scheduled.filter((item) => isSameDay(parseISO(item.nextActionAt!), expandedDay)) : []

  useEffect(() => {
    if (!expandedDay) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.drawer-layer, .modal-layer')) setExpandedDay(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [expandedDay])

  useEffect(() => {
    if (!schedulePanel) return
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!scheduleDockRef.current?.contains(target) && !scheduleFlyoutRef.current?.contains(target)) setSchedulePanel(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSchedulePanel(null) }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [schedulePanel])

  function changePeriod(direction: -1 | 1) {
    if (calendarMode === 'week') {
      const nextDay = direction === -1 ? subWeeks(selectedDay, 1) : addWeeks(selectedDay, 1)
      setSelectedDay(nextDay)
      setMonth(nextDay)
      return
    }
    const nextMonth = direction === -1 ? subMonths(month, 1) : addMonths(month, 1)
    setMonth(nextMonth)
    setSelectedDay(startOfMonth(nextMonth))
  }

  const calendarTitle = calendarMode === 'month'
    ? format(month, 'yyyy年 M月', { locale: zhCN })
    : `${format(visibleWeekStart, 'M月d日')} – ${format(visibleWeekEnd, 'M月d日')}`

  return (
    <div className="schedule-page">
      <div className="page-heading schedule-page-heading">
        <div><h1>{viewMeta.schedule.title}</h1><p>{viewMeta.schedule.description}</p></div>
        <aside className="schedule-dock" ref={scheduleDockRef} aria-label="日程辅助视图">
          <button type="button" className={schedulePanel === 'day' ? 'active' : ''} aria-expanded={schedulePanel === 'day'} onClick={() => setSchedulePanel((current) => current === 'day' ? null : 'day')}>
            <span className="schedule-dock-icon"><CalendarDays size={16} /></span>
            <span><strong>当日安排</strong><small>{selectedEvents.length} 项</small></span>
          </button>
          <button type="button" className={schedulePanel === 'upcoming' ? 'active' : ''} aria-expanded={schedulePanel === 'upcoming'} onClick={() => setSchedulePanel((current) => current === 'upcoming' ? null : 'upcoming')}>
            <span className="schedule-dock-icon"><Clock3 size={16} /></span>
            <span><strong>近期安排</strong><small>{upcoming.length} 项</small></span>
          </button>
        </aside>
      </div>
      <div className="schedule-layout">
      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div className="calendar-head"><button className="icon-button" aria-label={calendarMode === 'month' ? '上个月' : '上一周'} onClick={() => changePeriod(-1)}><ChevronLeft size={17} /></button><h2>{calendarTitle}</h2><button className="icon-button" aria-label={calendarMode === 'month' ? '下个月' : '下一周'} onClick={() => changePeriod(1)}><ChevronRight size={17} /></button></div>
          <div className="calendar-mode-switch" aria-label="日历展示范围">
            <button type="button" className={calendarMode === 'week' ? 'active' : ''} onClick={() => { setCalendarMode('week'); setMonth(selectedDay) }}>本周</button>
            <button type="button" className={calendarMode === 'month' ? 'active' : ''} onClick={() => { setCalendarMode('month'); setMonth(selectedDay) }}>本月</button>
          </div>
        </div>
        <div className="weekday-row">{['周一','周二','周三','周四','周五','周六','周日'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className={`calendar-grid ${calendarMode === 'week' ? 'calendar-week-view' : ''}`}>
          {days.map((day, dayIndex) => {
            const events = scheduled.filter((item) => isSameDay(parseISO(item.nextActionAt!), day))
            const weekStartIndex = Math.floor(dayIndex / 7) * 7
            const weekHasEvents = days.slice(weekStartIndex, weekStartIndex + 7).some((weekDay) => scheduled.some((item) => isSameDay(parseISO(item.nextActionAt!), weekDay)))
            return (
              <div
                key={day.toISOString()}
                className={`calendar-day ${calendarMode === 'month' && !weekHasEvents ? 'empty-week' : ''} ${calendarMode === 'month' && !isSameMonth(day, month) ? 'outside' : ''} ${isSameDay(day, new Date()) ? 'today' : ''} ${isSameDay(day, selectedDay) ? 'selected' : ''} ${events.length ? `has-events density-${Math.min(events.length, 3)}` : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${format(day, 'M月d日')}，${events.length ? `${events.length} 项安排` : '暂无安排'}`}
                onClick={() => { setSelectedDay(day); if (events.length) setExpandedDay(day) }}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedDay(day); if (events.length) setExpandedDay(day) } }}
              >
                <div className="day-head"><span className="day-number">{format(day, 'd')}</span>{events.length > 0 && <span className="day-count">{events.length} 项</span>}</div>
                <div className="day-events">{events.slice(0, events.length > 2 ? 1 : 2).map((item) => <span key={item.id}><i style={{ background: companyEventColor(item.company) }} /><b>{item.company} · {item.nextAction}</b></span>)}{events.length > 2 && <div className="day-overflow-preview"><span className="day-overflow-dots">{events.slice(1, 4).map((item) => <i key={item.id} style={{ background: companyEventColor(item.company) }} />)}</span><b>更多安排</b><em>+{events.length - 1}</em></div>}</div>
              </div>
            )
          })}
        </div>
      </section>
      {schedulePanel && (
        <section className="panel schedule-flyout" ref={scheduleFlyoutRef} aria-label={schedulePanel === 'day' ? '当日安排' : '近期安排'}>
          <button type="button" className="schedule-flyout-close" aria-label="收起日程面板" onClick={() => setSchedulePanel(null)}><X size={16} /></button>
          {schedulePanel === 'day' ? (
            <>
              <SectionHeader eyebrow="DAY VIEW" title={format(selectedDay, 'M月d日 EEEE', { locale: zhCN })} action={<span className="subtle-count">{selectedEvents.length} 项安排</span>} />
              {selectedEvents.length ? <><div className={`day-detail-list ${selectedEvents.length > 2 ? 'is-scrollable' : ''}`} aria-label={`${selectedEvents.length} 项日程，可滚动查看全部`}>{selectedEvents.map((item) => {
                const stage = getStage(data.pipelines, item)
                return <button key={item.id} onClick={() => openApplication(item.id)} style={{ '--event-color': stage?.color ?? '#557a71' } as React.CSSProperties}>
                  <time>{format(parseISO(item.nextActionAt!), 'HH:mm')}</time>
                  <div><strong>{item.nextAction}</strong><span>{item.company} · {item.role}</span></div>
                  <ChevronRight size={16} />
                </button>
              })}</div></> : <div className="day-empty"><CalendarDays size={22} /><strong>当天没有安排</strong><span>选择带有柔和色块的日期查看全部事项。</span></div>}
            </>
          ) : (
            <>
              <SectionHeader eyebrow="UPCOMING" title="近期安排" />
              <div className="timeline-agenda schedule-flyout-timeline">
                {upcoming.map((item, index) => {
                  const date = parseISO(item.nextActionAt!)
                  return (
                    <button key={item.id} onClick={() => openApplication(item.id)}>
                      <div className="timeline-line"><i className={index === 0 ? 'current' : ''} /></div>
                      <div className="timeline-date-label"><strong>{format(date, 'MM.dd')}</strong><span>{format(date, 'EEE', { locale: zhCN })}</span></div>
                      <div className="timeline-copy"><strong>{item.nextAction}</strong><span>{item.company} · {item.role}</span><small>{format(date, 'HH:mm')} · {item.city}</small></div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </section>
      )}
      {expandedDay && (
        <div className="day-modal-layer" role="presentation" onMouseDown={() => setExpandedDay(null)}>
          <section className="day-modal" role="dialog" aria-modal="true" aria-labelledby="day-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="day-modal-head">
              <div><span>当日安排</span><h2 id="day-modal-title">{format(expandedDay, 'M月d日 EEEE', { locale: zhCN })}</h2><p>{expandedEvents.length} 项待推进事项</p></div>
              <button className="icon-button" aria-label="关闭当天安排" onClick={() => setExpandedDay(null)}><X size={18} /></button>
            </div>
            <div className="day-modal-list meeting-agenda">
              {expandedEvents.map((item, index) => {
                const stage = getStage(data.pipelines, item)
                const eventDate = parseISO(item.nextActionAt!)
                const hour = Number(format(eventDate, 'H'))
                return <button className="meeting-item" key={item.id} onClick={() => openApplication(item.id)} style={{ '--event-color': stage?.color ?? '#557a71' } as React.CSSProperties}>
                  <time><strong>{format(eventDate, 'HH:mm')}</strong><small>{hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上'}</small></time>
                  <span className="meeting-axis"><i />{index < expandedEvents.length - 1 && <b />}</span>
                  <span className="meeting-card">
                    <span className="meeting-title"><strong>{item.nextAction}</strong><ChevronRight size={17} /></span>
                    <span className="meeting-company">{item.company}<small>{item.role}</small></span>
                    <span className="meeting-meta"><span>{item.city}</span><span>{stage?.name ?? '未设置阶段'}</span></span>
                  </span>
                </button>
              })}
            </div>
          </section>
        </div>
      )}
      </div>
    </div>
  )
}

type TrendRange = 'week' | 'month' | 'halfYear' | 'year'

function Analytics({ data }: { data: AppData }) {
  const [trendRange, setTrendRange] = useState<TrendRange>('month')
  const [pipelineFilter, setPipelineFilter] = useState('all')
  const [sourcePanelRef, sourcePanelVisible] = useInViewOnce<HTMLElement>()
  const [durationPanelRef, durationPanelVisible] = useInViewOnce<HTMLElement>()
  const applications = pipelineFilter === 'all' ? data.applications : data.applications.filter((item) => item.pipelineId === pipelineFilter)
  const activeCount = applications.filter((item) => isActive(data.pipelines, item)).length
  const offerCount = applications.filter((item) => getStage(data.pipelines, item)?.kind === 'offer').length
  const interviewReached = applications.filter((item) => {
    const pipeline = getPipeline(data.pipelines, item.pipelineId)
    return item.history.some((history) => pipeline.stages.find((stage) => stage.id === history.stageId)?.kind === 'interview')
  }).length

  const funnelKinds: StageKind[] = ['applied', 'assessment', 'interview', 'offer']
  const funnel = funnelKinds.map((kind) => ({
    name: kindLabels[kind], value: applications.filter((item) => {
      const pipeline = getPipeline(data.pipelines, item.pipelineId)
      return item.history.some((entry) => pipeline.stages.find((stage) => stage.id === entry.stageId)?.kind === kind)
    }).length,
  }))
  const funnelBase = funnel[0]?.value || 1

  const trendData = (() => {
    if (trendRange === 'week') {
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date()
        day.setHours(0, 0, 0, 0)
        day.setDate(day.getDate() - (6 - index))
        return { label: format(day, 'M.d'), value: applications.filter((item) => isSameDay(parseISO(item.appliedAt), day)).length }
      })
    }
    if (trendRange === 'month') {
      return Array.from({ length: 5 }, (_, index) => {
        const start = startOfWeek(subWeeks(new Date(), 4 - index), { weekStartsOn: 1 })
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        end.setHours(23, 59, 59, 999)
        return { label: format(start, 'M.d'), value: applications.filter((item) => { const date = parseISO(item.appliedAt); return date >= start && date <= end }).length }
      })
    }
    const monthCount = trendRange === 'halfYear' ? 6 : 12
    return Array.from({ length: monthCount }, (_, index) => {
      const targetMonth = subMonths(startOfMonth(new Date()), monthCount - 1 - index)
      return { label: format(targetMonth, 'yy.M'), value: applications.filter((item) => isSameMonth(parseISO(item.appliedAt), targetMonth)).length }
    })
  })()
  const trendTitle: Record<TrendRange, string> = {
    week: '近 7 天投递节奏', month: '近一个月投递节奏', halfYear: '近半年投递节奏', year: '近一年投递节奏',
  }

  const sourceMap = new Map<string, { source: string; total: number; interviews: number; offers: number }>()
  applications.forEach((item) => {
    const current = sourceMap.get(item.channel) ?? { source: item.channel, total: 0, interviews: 0, offers: 0 }
    current.total += 1
    const pipeline = getPipeline(data.pipelines, item.pipelineId)
    const kinds = item.history.map((entry) => pipeline.stages.find((stage) => stage.id === entry.stageId)?.kind)
    if (kinds.includes('interview')) current.interviews += 1
    if (kinds.includes('offer')) current.offers += 1
    sourceMap.set(item.channel, current)
  })
  const allSources = [...sourceMap.values()]
  const sources = [...allSources].sort((a, b) => b.total - a.total).slice(0, 6)
  const bestSource = [...allSources].sort((a, b) => {
    const rateDifference = b.interviews / Math.max(1, b.total) - a.interviews / Math.max(1, a.total)
    return rateDifference || b.total - a.total
  })[0]
  const bestSourceRate = bestSource ? Math.round(bestSource.interviews / Math.max(1, bestSource.total) * 100) : 0

  const durations: Record<string, number[]> = {}
  applications.forEach((item) => {
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
  const durationMax = Math.max(1, ...durationData.map((item) => item.days))
  const durationAxisMax = Math.max(3, Math.ceil(durationMax / 3) * 3)
  const durationTicks = Array.from({ length: durationAxisMax / 3 + 1 }, (_, index) => index * 3)

  return (
    <div className="analytics-page">
      <section className="panel analytics-toolbar">
        <div className="analytics-scope">
          <span className="toolbar-kicker">分析范围</span>
          <nav className="glass-tabs scope-tabs" aria-label="选择分析范围">
            {[{ id: 'all', name: '全部公司类型' }, ...data.pipelines].map((item) => <button key={item.id} className={pipelineFilter === item.id ? 'active' : ''} aria-pressed={pipelineFilter === item.id} onClick={() => setPipelineFilter(item.id)}>{item.name}</button>)}
          </nav>
        </div>
        <p>转化、渠道和周期指标会随所选流程同步更新。</p>
      </section>
      <section className="metric-grid analytics-metrics">
        <MetricCard label="投递 → 面试" value={Math.round(interviewReached / Math.max(1, applications.length) * 100)} suffix="%" delta="转化百分比" icon={<Target size={19} />} />
        <MetricCard label="活跃机会" value={activeCount} delta="需要持续跟进" icon={<Activity size={19} />} />
        <MetricCard label="平均推进周期" value={Math.round(average(durationData.map((item) => item.days)))} delta="天 / 阶段" icon={<Clock3 size={19} />} />
        <MetricCard label="Offer 转化" value={Math.round(offerCount / Math.max(1, applications.length) * 100)} suffix="%" delta={`${offerCount} 个 Offer`} icon={<Sparkles size={19} />} accent />
      </section>

      <section className="panel chart-panel trend-chart">
        <SectionHeader eyebrow="APPLICATION TREND" title={trendTitle[trendRange]} action={<div className="range-switch" aria-label="投递趋势时间范围">{([['week','一周'],['month','一月'],['halfYear','半年'],['year','一年']] as Array<[TrendRange, string]>).map(([key, label]) => <button key={key} aria-pressed={trendRange === key} className={trendRange === key ? 'active' : ''} onClick={() => setTrendRange(key)}>{label}</button>)}</div>} />
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={trendData} margin={{ top: 16, right: 8, left: -24, bottom: 0 }}>
            <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#315f55" stopOpacity={0.24}/><stop offset="100%" stopColor="#315f55" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#e8e7e1" strokeDasharray="3 4" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8c8d88', fontSize: 12 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#8c8d88', fontSize: 12 }} />
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e4e3dc', boxShadow: '0 10px 30px rgba(40,45,42,.08)' }} /><Area type="monotone" dataKey="value" name="投递" stroke="#315f55" strokeWidth={2.5} fill="url(#areaFill)" dot={{ fill: '#f8f8f4', stroke: '#315f55', strokeWidth: 2, r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="panel funnel-panel">
        <SectionHeader eyebrow="CONVERSION" title="岗位机会转化" action={<span className="subtle-count">总体到达率</span>} />
        <div className="opportunity-funnel">
          {funnel.map((item, index) => {
            const percent = Math.round(item.value / funnelBase * 100)
            return <div className="funnel-stage" key={item.name} style={{ '--stage-index': index } as React.CSSProperties}>
              <strong className="funnel-value">{item.value}</strong>
              <div className="funnel-shape" style={{ '--funnel-width': `${Math.max(22, percent)}%`, '--funnel-color': ['#3f8875', '#5f8198', '#a2785d', '#7c7195'][index] } as React.CSSProperties}>
                <span>{item.name}</span>
              </div>
              <div className="funnel-stage-meta"><strong>{percent}%</strong></div>
            </div>
          })}
        </div>
      </section>

      <section ref={sourcePanelRef} className={`panel source-panel ${sourcePanelVisible ? 'is-visible' : 'awaiting-reveal'}`}>
        <SectionHeader eyebrow="CHANNEL QUALITY" title="渠道质量" action={<span className="subtle-count">按进入面试衡量</span>} />
        <div className="source-table"><div className="source-head"><span>来源</span><span>投递</span><span>面试</span><span>Offer</span><span>面试率</span></div>{sources.map((source, index) => { const rate = source.interviews / source.total; const ratePercent = Math.round(rate * 100); const rateLightness = Math.round(76 - rate * 34); return <div className="source-row" key={source.source}><strong>{source.source}</strong><span>{source.total}</span><span>{source.interviews}</span><span>{source.offers}</span><span className="rate-cell" style={{ '--rate': `${ratePercent}%`, '--rate-color': `hsl(164 32% ${rateLightness}%)`, '--rate-track': `hsl(164 22% ${Math.min(92, rateLightness + 35)}%)`, '--rate-delay': `${160 + index * 70}ms` } as React.CSSProperties}><i /><b>{ratePercent}%</b></span></div> })}</div>
      </section>

      <section ref={durationPanelRef} className={`panel duration-panel ${durationPanelVisible ? 'is-visible' : 'awaiting-reveal'}`}>
        <SectionHeader eyebrow="STAGE DURATION" title="各阶段平均耗时" />
        {durationPanelVisible ? <ResponsiveContainer width="100%" height={250}>
          <BarChart data={durationData} margin={{ top: 28, right: 8, left: -8, bottom: 2 }}>
            <CartesianGrid vertical={false} stroke="#dce7e1" strokeDasharray="2 5" />
            <XAxis dataKey="name" axisLine={{ stroke: '#cfdcd6' }} tickLine={false} tick={{ fill: '#66766f', fontSize: 12, fontWeight: 600 }} tickMargin={10} />
            <YAxis domain={[0, durationAxisMax]} ticks={durationTicks} interval={0} allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#8a9791', fontSize: 10 }} unit="天" width={42} />
            <Tooltip cursor={{ fill: 'rgba(92,139,121,.06)' }} contentStyle={{ borderRadius: 12, border: '1px solid rgba(255,255,255,.86)', background: 'rgba(246,250,247,.88)', boxShadow: '0 12px 28px rgba(42,66,56,.10)', backdropFilter: 'blur(18px)' }} />
            <Bar dataKey="days" name="平均耗时" radius={[11, 11, 4, 4]} barSize={48} isAnimationActive animationBegin={180} animationDuration={820} animationEasing="ease-out">
              {durationData.map((item) => {
                const ratio = item.days / durationMax
                const soraPalette = ['#d8eff8', '#b9e3f3', '#a0d8ef', '#72bddb']
                const colorIndex = Math.min(soraPalette.length - 1, Math.max(0, Math.round(ratio * (soraPalette.length - 1))))
                return <Cell key={item.name} fill={soraPalette[colorIndex]} fillOpacity={0.86} stroke="#5798b4" strokeOpacity={0.58} strokeWidth={1.1} />
              })}
              <LabelList dataKey="days" position="top" fill="#3f7e99" fontSize={12} fontWeight={650} />
            </Bar>
          </BarChart>
        </ResponsiveContainer> : <div className="chart-reveal-placeholder" aria-hidden="true" />}
      </section>

      <section className="insight-panel">
        <div className="insight-icon"><Sparkles size={20} /></div><div><span>OFFER FLOW INSIGHT</span><h3>{bestSource ? `${bestSource.source}当前进入面试的效率最高` : '还没有足够数据形成渠道洞察'}</h3><p>{bestSource ? `在当前分析范围内，该渠道的面试到达率为 ${bestSourceRate}%，来自 ${bestSource.total} 份投递。${bestSource.total < 3 ? '样本仍较少，建议继续积累后再调整渠道投入。' : '可以优先复用这一渠道，同时保持其他渠道的小规模验证。'}` : '继续记录投递来源和阶段变化，系统会自动生成可行动的渠道建议。'}</p></div>{bestSource && <div className="insight-badge"><strong>{bestSourceRate}%</strong><span>面试率 · {bestSource.total} 份样本</span></div>}
      </section>
    </div>
  )
}

function ApplicationModal({ pipelines, applications, application, onClose, onSave }: {
  pipelines: PipelineTemplate[]
  applications: Application[]
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
  const dataSuggestions = {
    company: [...new Set([...applications.map((item) => item.company), ...commonApplicationTerms.company])],
    role: [...new Set([...applications.map((item) => item.role), ...commonApplicationTerms.role])],
    department: [...new Set([...applications.map((item) => item.department).filter((value): value is string => Boolean(value)), ...commonApplicationTerms.department])],
    city: [...new Set([...applications.map((item) => item.city), ...commonApplicationTerms.city])],
    channel: [...new Set([...applications.map((item) => item.channel), ...commonApplicationTerms.channel])],
    nextAction: [...new Set([...applications.map((item) => item.nextAction).filter((value): value is string => Boolean(value)), ...commonApplicationTerms.nextAction])],
    contact: [...new Set([...applications.map((item) => item.contact).filter((value): value is string => Boolean(value)), ...commonApplicationTerms.contact])],
  }

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
        <div className="modal-head"><div><span>APPLICATION</span><h2>{application ? '编辑投递记录' : '新增投递'}</h2><p>只记录会影响下一步决策的信息。</p></div><button type="button" className="icon-button" aria-label="关闭新增投递弹窗" onClick={onClose}><X size={19} /></button></div>
        <div className="form-section"><h3>基本信息</h3><div className="form-grid">
          <Field label="公司名称 *"><SmartInput required value={form.company} onChange={(value) => setField('company', value)} suggestions={dataSuggestions.company} placeholder="例如：字节跳动" /></Field>
          <Field label="岗位名称 *"><SmartInput required value={form.role} onChange={(value) => setField('role', value)} suggestions={dataSuggestions.role} placeholder="例如：前端开发工程师" /></Field>
          <Field label="业务部门"><SmartInput value={form.department} onChange={(value) => setField('department', value)} suggestions={dataSuggestions.department} placeholder="选填" /></Field>
          <Field label="城市"><SmartInput value={form.city} onChange={(value) => setField('city', value)} suggestions={dataSuggestions.city} placeholder="例如：上海" /></Field>
          <Field label="投递渠道"><SmartInput value={form.channel} onChange={(value) => setField('channel', value)} suggestions={dataSuggestions.channel} placeholder="官网 / 内推 / 宣讲会" /></Field>
          <Field label="薪资信息"><input value={form.salary} onChange={(event) => setField('salary', event.target.value)} placeholder="选填" /></Field>
        </div></div>
        <div className="form-section"><h3>流程与节奏</h3><div className="form-grid">
          <Field label="公司类型 *"><GlassSelect className="field-select" ariaLabel="公司类型" value={form.pipelineId} onChange={(pipelineId) => { const pipeline = getPipeline(pipelines, pipelineId); setForm((current) => ({ ...current, pipelineId: pipeline.id, stageId: pipeline.stages[0]?.id ?? '' })) }} options={pipelines.map((pipeline) => [pipeline.id, pipeline.name])} /></Field>
          <Field label="当前阶段 *"><GlassSelect className="field-select" ariaLabel="当前阶段" value={form.stageId} onChange={(stageId) => setField('stageId', stageId)} options={activePipeline.stages.map((stage) => [stage.id, stage.name])} /></Field>
          <Field label="优先级"><GlassSelect className="field-select" ariaLabel="优先级" value={form.priority} onChange={(priority) => setField('priority', priority)} options={[["high","高优先级"],["medium","中优先级"],["low","低优先级"]]} /></Field>
          <Field label="投递日期"><input type="date" value={form.appliedAt} onChange={(event) => setField('appliedAt', event.target.value)} /></Field>
          <Field label="下一步行动" wide><SmartInput value={form.nextAction} onChange={(value) => setField('nextAction', value)} suggestions={dataSuggestions.nextAction} placeholder="例如：准备项目深挖、完成测评" /></Field>
          <Field label="行动时间"><input type="datetime-local" value={form.nextActionAt} onChange={(event) => setField('nextActionAt', event.target.value)} /></Field>
          <Field label="联系人"><SmartInput value={form.contact} onChange={(value) => setField('contact', value)} suggestions={dataSuggestions.contact} placeholder="HR / 内推人 / 面试官" /></Field>
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

function SmartInput({ value, onChange, suggestions, placeholder, required = false }: {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const query = value.trim().toLocaleLowerCase('zh-CN')
  const matches = query
    ? [...new Set(suggestions)].filter((item) => item.toLocaleLowerCase('zh-CN').includes(query) && item !== value).slice(0, 6)
    : []

  function choose(nextValue: string) {
    onChange(nextValue)
    setOpen(false)
    setActiveIndex(0)
  }

  return <div className={`smart-input ${open && matches.length ? 'open' : ''}`}>
    <input
      required={required}
      value={value}
      autoComplete="off"
      onFocus={() => setOpen(true)}
      onChange={(event) => { onChange(event.target.value); setOpen(true); setActiveIndex(0) }}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (!matches.length) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          setActiveIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length)
        } else if (event.key === 'Enter' && open) {
          event.preventDefault()
          choose(matches[activeIndex] ?? matches[0])
        } else if (event.key === 'Escape') setOpen(false)
      }}
      placeholder={placeholder}
      aria-autocomplete="list"
      aria-expanded={open && Boolean(matches.length)}
    />
    {open && matches.length > 0 && <div className="smart-suggestions" role="listbox">
      {matches.map((item, index) => <div
        key={item}
        role="option"
        aria-selected={index === activeIndex}
        className={index === activeIndex ? 'active' : ''}
        onMouseDown={(event) => { event.preventDefault(); choose(item) }}
      ><span>{item}</span><small>常用</small></div>)}
    </div>}
  </div>
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
  const history = normalizeHistory(application.history).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`${application.company} 投递详情`}>
      <button className="drawer-backdrop" onClick={onClose} aria-label="关闭" />
      <aside className="application-drawer">
        <div className="drawer-head"><div className="drawer-company"><div><span>{pipeline.name}</span><h2>{application.company}</h2><p>{application.role} · {application.city}</p></div></div><button className="icon-button" aria-label="关闭投递详情" onClick={onClose}><X size={19} /></button></div>
        <div className="drawer-actions"><GlassSelect className="drawer-stage-select" ariaLabel="当前阶段" value={application.stageId} onChange={onStageChange} options={pipeline.stages.map((item) => [item.id, item.name])} /><button className="secondary-button" onClick={onEdit}><PencilLine size={15} /> 编辑</button>{application.jobUrl && <a className="icon-button" aria-label="打开岗位链接" href={application.jobUrl} target="_blank" rel="noreferrer"><ExternalLink size={17} /></a>}</div>

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

function PipelineSettings({ data, onChange, onDeletePipeline, onExportJson, onExportCsv, onImport, onReset }: {
  data: AppData
  onChange: (pipelines: PipelineTemplate[]) => void
  onDeletePipeline: (pipelineId: string) => void
  onExportJson: () => void
  onExportCsv: () => void
  onImport: () => void
  onReset: () => void
}) {
  const [selectedId, setSelectedId] = useState(data.pipelines[0]?.id ?? '')
  const [dragStageId, setDragStageId] = useState<string | null>(null)
  const [dragTarget, setDragTarget] = useState<{ stageId: string; position: 'before' | 'after' } | null>(null)
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

  function reorderStage(sourceId: string, targetId: string, position: 'before' | 'after') {
    if (sourceId === targetId) return
    const stages = [...selected.stages]
    const sourceIndex = stages.findIndex((stage) => stage.id === sourceId)
    if (sourceIndex < 0) return
    const [moved] = stages.splice(sourceIndex, 1)
    const targetIndex = stages.findIndex((stage) => stage.id === targetId)
    if (targetIndex < 0) return
    stages.splice(targetIndex + (position === 'after' ? 1 : 0), 0, moved)
    updateTemplate({ stages })
  }

  function dropPosition(event: DragEvent<HTMLDivElement>): 'before' | 'after' {
    const bounds = event.currentTarget.getBoundingClientRect()
    return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
  }

  function addTemplate() {
    const next: PipelineTemplate = {
      id: uid('pipeline'), name: '新公司类型', description: '根据这类公司的招聘特点调整阶段。',
      stages: [
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

  function removeTemplate() {
    if (data.pipelines.length <= 1) return
    const count = data.applications.filter((item) => item.pipelineId === selected.id).length
    const message = count
      ? `删除“${selected.name}”后，${count} 条投递将自动迁移到其他公司类型。继续吗？`
      : `确定删除“${selected.name}”吗？`
    if (!window.confirm(message)) return
    const index = data.pipelines.findIndex((pipeline) => pipeline.id === selected.id)
    const next = data.pipelines[index + 1] ?? data.pipelines[index - 1]
    onDeletePipeline(selected.id)
    setSelectedId(next?.id ?? '')
  }

  const usesByStage = new Map(selected.stages.map((stage) => [stage.id, data.applications.filter((item) => item.stageId === stage.id).length]))

  return (
    <div className="settings-layout">
      <aside className="panel template-list">
        <SectionHeader eyebrow="COMPANY TYPES" title="公司类型" action={<div className="template-list-actions"><button className="icon-button" onClick={addTemplate} title="新增公司类型"><Plus size={17} /></button><button className="icon-button delete-template-list" disabled={data.pipelines.length <= 1} onClick={removeTemplate} title="删除当前公司类型"><Trash2 size={16} /></button></div>} />
        <div>{data.pipelines.map((pipeline) => <button className={pipeline.id === selected.id ? 'active' : ''} key={pipeline.id} onClick={() => setSelectedId(pipeline.id)}><span><strong>{pipeline.name}</strong><small>{pipeline.stages.length} 个阶段 · {data.applications.filter((item) => item.pipelineId === pipeline.id).length} 条记录</small></span><ChevronRight size={16} /></button>)}</div>
        <div className="template-tip"><Sparkles size={17} /><p><strong>为什么区分公司类型？</strong>银行、互联网与咨询的招聘流程差异很大。每类公司可使用独立阶段，同时保持统一分析。</p></div>
      </aside>

      <section className="panel pipeline-editor">
        <div className="editor-head"><div><span>编辑公司类型</span><input value={selected.name} onChange={(event) => updateTemplate({ name: event.target.value })} /></div><div className="editor-actions"><button className="secondary-button" onClick={addStage}><Plus size={15} /> 添加阶段</button></div></div>
        <textarea className="template-description" value={selected.description} onChange={(event) => updateTemplate({ description: event.target.value })} />
        <div className="stage-editor-head"><span>拖动</span><span>阶段名称</span><span>归一分类</span><span>颜色</span><span>结束节点</span><span /></div>
        <div className="stage-editor-list">
          {selected.stages.map((stage, index) => (
            <div className={`stage-editor-row ${dragStageId === stage.id ? 'is-dragging' : ''} ${dragTarget?.stageId === stage.id && dragStageId !== stage.id ? `insert-${dragTarget.position}` : ''}`} key={stage.id} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragTarget({ stageId: stage.id, position: dropPosition(event) }) }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(null) }} onDrop={(event) => { event.preventDefault(); if (dragStageId) reorderStage(dragStageId, stage.id, dropPosition(event)); setDragStageId(null); setDragTarget(null) }}>
              <div className="stage-order"><button type="button" className="stage-drag-handle" draggable aria-label={`拖动${stage.name}调整顺序`} title="拖动调整顺序" onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', stage.id); setDragStageId(stage.id) }} onDragEnd={() => { setDragStageId(null); setDragTarget(null) }}><GripVertical size={16} /></button><button disabled={index === 0} onClick={() => moveStage(index, -1)} aria-label="上移"><ArrowUp size={13} /></button><button disabled={index === selected.stages.length - 1} onClick={() => moveStage(index, 1)} aria-label="下移"><ArrowDown size={13} /></button></div>
              <input value={stage.name} onChange={(event) => updateStage(stage.id, { name: event.target.value })} />
              <GlassSelect className="stage-kind-select" ariaLabel={`${stage.name}归一分类`} value={stage.kind} onChange={(kind) => updateStage(stage.id, { kind: kind as StageKind })} options={selectableKindOptions} />
              <GlassColorPicker value={stage.color} label={stage.name} onChange={(color) => updateStage(stage.id, { color })} />
              <label className="switch-label"><input type="checkbox" checked={Boolean(stage.terminal)} onChange={(event) => updateStage(stage.id, { terminal: event.target.checked })} /><i /><span>{stage.terminal ? '是' : '否'}</span></label>
              <button className="delete-stage" disabled={Boolean(usesByStage.get(stage.id))} title={usesByStage.get(stage.id) ? '仍有投递处于该阶段' : '删除阶段'} onClick={() => removeStage(stage.id)}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <div className="editor-foot"><span><Check size={15} /> 修改会实时保存，已有投递会同步使用该公司类型</span><span>{selected.stages.length} 个阶段</span></div>
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
