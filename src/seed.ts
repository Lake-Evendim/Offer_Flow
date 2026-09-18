import type { AppData, Application, PipelineTemplate } from './types'

const stage = (id: string, name: string, kind: PipelineTemplate['stages'][number]['kind'], color: string, extras = {}) => ({ id, name, kind, color, ...extras })

export const defaultPipelines: PipelineTemplate[] = [
  {
    id: 'internet-tech',
    name: '互联网 / 科技',
    description: '适合常见技术、产品与设计岗位，可按实际流程跳过任意阶段。',
    stages: [
      stage('it-applied', '已投递', 'applied', '#315f55'),
      stage('it-assessment', '测评 / 笔试', 'assessment', '#9a6b32'),
      stage('it-first', '业务一面', 'interview', '#426b9a'),
      stage('it-second', '业务二面', 'interview', '#5e5795'),
      stage('it-hr', 'HR 面', 'interview', '#9a5f73'),
      stage('it-offer', 'Offer', 'offer', '#31715a', { terminal: true, outcome: 'positive' }),
      stage('it-closed', '流程结束', 'closed', '#9a5555', { terminal: true, outcome: 'negative' }),
    ],
  },
  {
    id: 'bank-state',
    name: '银行 / 国企',
    description: '包含网申、统一笔试、资格审查与体检等长周期环节。',
    stages: [
      stage('bs-applied', '网申完成', 'applied', '#315f55'),
      stage('bs-review', '资格审查', 'assessment', '#8d7041'),
      stage('bs-written', '统一笔试', 'assessment', '#9a6b32'),
      stage('bs-interview', '面试', 'interview', '#426b9a'),
      stage('bs-medical', '体检 / 背调', 'interview', '#5e5795'),
      stage('bs-offer', '录用通知', 'offer', '#31715a', { terminal: true, outcome: 'positive' }),
      stage('bs-closed', '流程结束', 'closed', '#9a5555', { terminal: true, outcome: 'negative' }),
    ],
  },
  {
    id: 'consulting',
    name: '咨询 / 管培',
    description: '适合群面、案例面与终面组合，可自由增删环节。',
    stages: [
      stage('co-applied', '已投递', 'applied', '#315f55'),
      stage('co-ot', 'OT / 测评', 'assessment', '#9a6b32'),
      stage('co-group', '群面', 'interview', '#426b9a'),
      stage('co-case', '案例面', 'interview', '#5e5795'),
      stage('co-final', '终面', 'interview', '#9a5f73'),
      stage('co-offer', 'Offer', 'offer', '#31715a', { terminal: true, outcome: 'positive' }),
      stage('co-closed', '流程结束', 'closed', '#9a5555', { terminal: true, outcome: 'negative' }),
    ],
  },
]

const history = (prefix: string, entries: Array<[string, string, string, string?]>) =>
  entries.map(([stageId, stageName, date, note], i) => ({ id: `${prefix}-${i}`, stageId, stageName, date, note }))

const baseApplications: Application[] = [
  {
    id: 'app-1', company: '字节跳动', role: '前端开发工程师', department: '飞书', city: '北京', channel: '招聘官网',
    priority: 'high', pipelineId: 'internet-tech', stageId: 'it-second', appliedAt: '2026-08-18', updatedAt: '2026-09-12',
    nextAction: '准备系统设计与项目深挖', nextActionAt: '2026-09-17T19:30', contact: '招聘专员 · 飞书', salary: '25–35K · 16薪',
    jobUrl: 'https://jobs.bytedance.com/campus', tags: ['前端', '核心目标'], notes: '一面反馈不错，重点补充工程化与性能优化案例。',
    history: history('h1', [['it-applied','已投递','2026-08-18'],['it-assessment','测评 / 笔试','2026-08-23','笔试通过'],['it-first','业务一面','2026-09-04','项目与基础知识'],['it-second','业务二面','2026-09-12','进入二面准备']]),
  },
  {
    id: 'app-2', company: '腾讯', role: '产品策划培训生', department: 'CSIG', city: '深圳', channel: '实习转正',
    priority: 'high', pipelineId: 'internet-tech', stageId: 'it-hr', appliedAt: '2026-08-08', updatedAt: '2026-09-10',
    nextAction: '整理薪资预期与城市偏好', nextActionAt: '2026-09-17T14:00', contact: 'HR · 企业微信', tags: ['产品', '转正'],
    history: history('h2', [['it-applied','已投递','2026-08-08'],['it-first','业务一面','2026-08-21'],['it-second','业务二面','2026-09-01'],['it-hr','HR 面','2026-09-10']]),
  },
  {
    id: 'app-3', company: '招商银行', role: '金融科技岗', department: '总行信息技术部', city: '深圳', channel: '招聘官网',
    priority: 'high', pipelineId: 'bank-state', stageId: 'bs-written', appliedAt: '2026-08-27', updatedAt: '2026-09-09',
    nextAction: '完成行测题库第三套', nextActionAt: '2026-09-17T09:00', tags: ['金融科技', '稳定'],
    history: history('h3', [['bs-applied','网申完成','2026-08-27'],['bs-review','资格审查','2026-09-03'],['bs-written','统一笔试','2026-09-09']]),
  },
  {
    id: 'app-4', company: '美团', role: '数据分析师', department: '到店事业群', city: '北京', channel: '内推',
    priority: 'medium', pipelineId: 'internet-tech', stageId: 'it-assessment', appliedAt: '2026-09-02', updatedAt: '2026-09-08',
    nextAction: '在线测评', nextActionAt: '2026-09-17T20:00', contact: '学长内推', tags: ['数据分析'],
    history: history('h4', [['it-applied','已投递','2026-09-02'],['it-assessment','测评 / 笔试','2026-09-08']]),
  },
  {
    id: 'app-5', company: '华为', role: '软件开发工程师', department: '云计算', city: '杭州', channel: '招聘官网',
    priority: 'medium', pipelineId: 'internet-tech', stageId: 'it-first', appliedAt: '2026-08-25', updatedAt: '2026-09-11',
    nextAction: '技术面试', nextActionAt: '2026-09-17T15:30', tags: ['后端', '云计算'],
    history: history('h5', [['it-applied','已投递','2026-08-25'],['it-assessment','测评 / 笔试','2026-09-02'],['it-first','业务一面','2026-09-11']]),
  },
  {
    id: 'app-6', company: '麦肯锡', role: 'Business Analyst', department: 'Greater China', city: '上海', channel: '招聘官网',
    priority: 'medium', pipelineId: 'consulting', stageId: 'co-case', appliedAt: '2026-08-10', updatedAt: '2026-09-07',
    nextAction: '与 Case Partner 模拟市场规模题', nextActionAt: '2026-09-17T21:00', tags: ['咨询', 'Case'],
    history: history('h6', [['co-applied','已投递','2026-08-10'],['co-ot','OT / 测评','2026-08-18'],['co-group','群面','2026-08-29'],['co-case','案例面','2026-09-07']]),
  },
  {
    id: 'app-7', company: '网易游戏', role: '游戏交互设计师', department: '雷火', city: '杭州', channel: '牛客',
    priority: 'low', pipelineId: 'internet-tech', stageId: 'it-closed', appliedAt: '2026-08-14', updatedAt: '2026-09-02',
    tags: ['设计', '游戏'], notes: '作品集方向不匹配，保留复盘。',
    history: history('h7', [['it-applied','已投递','2026-08-14'],['it-assessment','测评 / 笔试','2026-08-20'],['it-first','业务一面','2026-08-27'],['it-closed','流程结束','2026-09-02','未通过']]),
  },
  {
    id: 'app-8', company: '小米', role: '用户研究专员', department: '手机部', city: '北京', channel: 'Boss直聘',
    priority: 'low', pipelineId: 'internet-tech', stageId: 'it-applied', appliedAt: '2026-09-12', updatedAt: '2026-09-12',
    nextAction: '针对 JD 调整项目描述', nextActionAt: '2026-09-15T10:00', tags: ['用户研究'],
    history: history('h8', [['it-applied','已投递','2026-09-12']]),
  },
  {
    id: 'app-9', company: '阿里巴巴', role: '客户端开发工程师', department: '淘天集团', city: '杭州', channel: '内推',
    priority: 'high', pipelineId: 'internet-tech', stageId: 'it-offer', appliedAt: '2026-07-29', updatedAt: '2026-09-05',
    tags: ['客户端', 'Offer'], salary: '意向书待沟通',
    history: history('h9', [['it-applied','已投递','2026-07-29'],['it-assessment','测评 / 笔试','2026-08-04'],['it-first','业务一面','2026-08-12'],['it-second','业务二面','2026-08-20'],['it-hr','HR 面','2026-08-28'],['it-offer','Offer','2026-09-05','收到意向书']]),
  },
  {
    id: 'app-10', company: '国家开发银行', role: '信息科技岗', department: '总行', city: '北京', channel: '招聘官网',
    priority: 'medium', pipelineId: 'bank-state', stageId: 'bs-review', appliedAt: '2026-09-06', updatedAt: '2026-09-10',
    nextAction: '确认资格审查材料', nextActionAt: '2026-09-17T18:00', tags: ['金融科技'],
    history: history('h10', [['bs-applied','网申完成','2026-09-06'],['bs-review','资格审查','2026-09-10']]),
  },
  {
    id: 'app-11', company: '贝恩', role: 'Associate Consultant', department: '北京办公室', city: '北京', channel: '宣讲会',
    priority: 'medium', pipelineId: 'consulting', stageId: 'co-group', appliedAt: '2026-08-22', updatedAt: '2026-09-06',
    nextAction: '群面复盘并补充框架', nextActionAt: '2026-09-13T22:00', tags: ['咨询'],
    history: history('h11', [['co-applied','已投递','2026-08-22'],['co-ot','OT / 测评','2026-08-28'],['co-group','群面','2026-09-06']]),
  },
  {
    id: 'app-12', company: '拼多多', role: '服务端研发工程师', department: '多多买菜', city: '上海', channel: '牛客',
    priority: 'low', pipelineId: 'internet-tech', stageId: 'it-closed', appliedAt: '2026-08-05', updatedAt: '2026-08-24',
    tags: ['后端'],
    history: history('h12', [['it-applied','已投递','2026-08-05'],['it-assessment','测评 / 笔试','2026-08-12'],['it-closed','流程结束','2026-08-24','笔试未通过']]),
  },
]

const companyPool = [
  { company: '百度', department: '智能云事业群', pipelineId: 'internet-tech' },
  { company: '京东科技', department: '数据智能部', pipelineId: 'internet-tech' },
  { company: '蚂蚁集团', department: '数字科技事业群', pipelineId: 'internet-tech' },
  { company: '哔哩哔哩', department: '主站产品中心', pipelineId: 'internet-tech' },
  { company: '快手', department: '商业化技术部', pipelineId: 'internet-tech' },
  { company: '小红书', department: '社区产品部', pipelineId: 'internet-tech' },
  { company: '得物 App', department: '交易平台中心', pipelineId: 'internet-tech' },
  { company: '上海人工智能实验室', department: '大模型工程中心', pipelineId: 'internet-tech' },
  { company: '中国工商银行', department: '金融科技部', pipelineId: 'bank-state' },
  { company: '中国建设银行', department: '总行数字化工厂', pipelineId: 'bank-state' },
  { company: '中国农业银行', department: '研发中心', pipelineId: 'bank-state' },
  { company: '中国银行', department: '信息科技运营中心', pipelineId: 'bank-state' },
  { company: '中国移动', department: '数字化产品中心', pipelineId: 'bank-state' },
  { company: '中国航天科技集团', department: '软件总体部', pipelineId: 'bank-state' },
  { company: '国家电网有限公司', department: '互联网部', pipelineId: 'bank-state' },
  { company: '中信证券', department: '数字发展中心', pipelineId: 'bank-state' },
  { company: '波士顿咨询', department: 'DigitalBCG', pipelineId: 'consulting' },
  { company: '德勤咨询', department: '战略与运营', pipelineId: 'consulting' },
  { company: '普华永道思略特', department: '消费者市场团队', pipelineId: 'consulting' },
  { company: '罗兰贝格', department: '汽车与工业品团队', pipelineId: 'consulting' },
  { company: '埃森哲', department: 'Song 数字体验', pipelineId: 'consulting' },
  { company: '字节跳动商业化与增长产品团队', department: '商业产品与技术', pipelineId: 'internet-tech' },
] as const

const rolesByPipeline: Record<string, string[]> = {
  'internet-tech': [
    '前端开发工程师', '后端研发工程师', '数据产品经理', '商业分析师', '用户体验设计师',
    '机器学习平台研发工程师', '国际化电商策略产品经理', '数据治理与商业智能分析师',
  ],
  'bank-state': [
    '金融科技岗', '信息科技管培生', '数字化运营岗', '软件研发工程师',
    '数据分析与风险管理岗', '总行管理培训生（科技方向）',
  ],
  consulting: [
    'Associate Consultant', 'Business Analyst', '数字化战略咨询顾问', '管理咨询实习生',
    '消费者洞察与增长战略顾问', '组织与人才转型咨询顾问',
  ],
}

const cities = ['北京', '上海', '深圳', '杭州', '广州', '成都', '南京', '武汉', '西安', '苏州']
const channels = ['招聘官网', '内推', 'Boss直聘', '牛客', '宣讲会', '实习转正', '学校就业网', '猎聘']
const priorities: Application['priority'][] = ['high', 'medium', 'medium', 'low']
const actionPool = [
  '根据岗位描述补充项目数据并完成简历定向修改',
  '准备业务面试并复盘过往项目中的关键决策',
  '完成在线测评与逻辑推理题',
  '联系招聘负责人确认后续流程与时间安排',
  '准备英文自我介绍、案例框架和反问问题清单',
  '整理作品集中的复杂项目，补充研究过程、取舍依据与最终业务结果',
  '参加线上面试',
  '提交补充材料',
]
const tagPool = ['核心目标', '技术', '产品', '数据', '设计', '金融科技', '咨询', '管培生', '内推', '高匹配', '需复盘']
const baseDate = new Date('2026-07-08T00:00:00Z')

const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const generatedApplications: Application[] = Array.from({ length: 100 }, (_, index) => {
  const profile = companyPool[(index * 7 + Math.floor(index / 9)) % companyPool.length]
  const pipeline = defaultPipelines.find((item) => item.id === profile.pipelineId)!
  const stageIndex = index % 10 === 9
    ? pipeline.stages.length - 1
    : index % 10 === 8
      ? pipeline.stages.length - 2
      : index % (pipeline.stages.length - 2)
  const currentStage = pipeline.stages[stageIndex]
  const updatedDate = addDays(baseDate, (index * 11) % 67)
  const historySpacing = 3 + (index % 4)
  const appliedDate = addDays(updatedDate, -stageIndex * historySpacing)
  const historyEntries = pipeline.stages.slice(0, stageIndex + 1).map((item, historyIndex) => {
    const date = addDays(appliedDate, historyIndex * historySpacing)
    return {
      id: `generated-history-${index + 1}-${historyIndex}`,
      stageId: item.id,
      stageName: item.name,
      date: isoDate(date),
      note: historyIndex === stageIndex
        ? currentStage.kind === 'offer'
          ? '已收到录用意向，等待确认入职安排'
          : currentStage.kind === 'closed'
            ? '本轮流程结束，已记录复盘要点'
            : `${item.name}进展已同步`
        : undefined,
    }
  })
  const updatedAt = historyEntries.at(-1)!.date
  const terminal = currentStage.kind === 'offer' || currentStage.kind === 'closed'
  const denseScheduleOffsets = [-3, -1, 0, 0, 0, 0, 0, 1, 1, 2, 4, 7, 12, 21]
  const scheduleOffset = denseScheduleOffsets[index % denseScheduleOffsets.length]
  const scheduleDate = addDays(new Date('2026-09-17T00:00:00Z'), scheduleOffset)
  const scheduleHour = 9 + ((index * 3) % 12)
  const rolePool = rolesByPipeline[profile.pipelineId]
  const role = rolePool[(index * 3 + Math.floor(index / 5)) % rolePool.length]
  const firstTagIndex = (index * 2) % tagPool.length

  return {
    id: `generated-app-${String(index + 1).padStart(3, '0')}`,
    company: profile.company,
    role,
    department: profile.department,
    city: cities[(index * 3) % cities.length],
    channel: channels[(index * 5) % channels.length],
    priority: priorities[index % priorities.length],
    pipelineId: profile.pipelineId,
    stageId: currentStage.id,
    appliedAt: isoDate(appliedDate),
    updatedAt,
    nextAction: terminal ? undefined : actionPool[(index * 3) % actionPool.length],
    nextActionAt: terminal
      ? undefined
      : `${isoDate(scheduleDate)}T${String(scheduleHour).padStart(2, '0')}:${index % 2 === 0 ? '00' : '30'}`,
    contact: index % 3 === 0 ? `招聘负责人 · ${profile.department}` : index % 3 === 1 ? '校招招聘专员 · 企业微信' : undefined,
    salary: currentStage.kind === 'offer' ? `${18 + (index % 18)}–${28 + (index % 22)}K · ${14 + (index % 4)}薪` : undefined,
    jobUrl: index % 4 === 0 ? `https://example.com/campus/jobs/${index + 1}` : undefined,
    tags: [
      tagPool[firstTagIndex],
      tagPool[(firstTagIndex + 3) % tagPool.length],
      ...(index % 5 === 0 ? [tagPool[(firstTagIndex + 6) % tagPool.length]] : []),
    ],
    notes: index % 6 === 0
      ? '压力测试长备注：岗位匹配度较高，需要重点准备项目中的量化结果、跨团队协作细节、失败复盘，以及为什么选择该行业和公司的完整叙事。'
      : index % 4 === 0 ? '已完成基础信息核对，等待下一阶段通知。' : undefined,
    history: historyEntries,
  }
})

export const seedApplications: Application[] = [...baseApplications, ...generatedApplications]

export const seedData: AppData = { applications: seedApplications, pipelines: defaultPipelines }
