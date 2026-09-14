import type { AppData, Application, PipelineTemplate } from './types'

const stage = (id: string, name: string, kind: PipelineTemplate['stages'][number]['kind'], color: string, extras = {}) => ({ id, name, kind, color, ...extras })

export const defaultPipelines: PipelineTemplate[] = [
  {
    id: 'internet-tech',
    name: '互联网 / 科技',
    description: '适合常见技术、产品与设计岗位，可按实际流程跳过任意阶段。',
    stages: [
      stage('it-wishlist', '待投递', 'prospect', '#7b8190'),
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
      stage('bs-wishlist', '待网申', 'prospect', '#7b8190'),
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
      stage('co-wishlist', '待投递', 'prospect', '#7b8190'),
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

export const seedApplications: Application[] = [
  {
    id: 'app-1', company: '字节跳动', role: '前端开发工程师', department: '飞书', city: '北京', channel: '招聘官网',
    priority: 'high', pipelineId: 'internet-tech', stageId: 'it-second', appliedAt: '2026-08-18', updatedAt: '2026-09-12',
    nextAction: '准备系统设计与项目深挖', nextActionAt: '2026-09-15T19:30', contact: '招聘专员 · 飞书', salary: '25–35K · 16薪',
    jobUrl: 'https://jobs.bytedance.com/campus', tags: ['前端', '核心目标'], notes: '一面反馈不错，重点补充工程化与性能优化案例。',
    history: history('h1', [['it-applied','已投递','2026-08-18'],['it-assessment','测评 / 笔试','2026-08-23','笔试通过'],['it-first','业务一面','2026-09-04','项目与基础知识'],['it-second','业务二面','2026-09-12','进入二面准备']]),
  },
  {
    id: 'app-2', company: '腾讯', role: '产品策划培训生', department: 'CSIG', city: '深圳', channel: '实习转正',
    priority: 'high', pipelineId: 'internet-tech', stageId: 'it-hr', appliedAt: '2026-08-08', updatedAt: '2026-09-10',
    nextAction: '整理薪资预期与城市偏好', nextActionAt: '2026-09-14T14:00', contact: 'HR · 企业微信', tags: ['产品', '转正'],
    history: history('h2', [['it-applied','已投递','2026-08-08'],['it-first','业务一面','2026-08-21'],['it-second','业务二面','2026-09-01'],['it-hr','HR 面','2026-09-10']]),
  },
  {
    id: 'app-3', company: '招商银行', role: '金融科技岗', department: '总行信息技术部', city: '深圳', channel: '招聘官网',
    priority: 'high', pipelineId: 'bank-state', stageId: 'bs-written', appliedAt: '2026-08-27', updatedAt: '2026-09-09',
    nextAction: '完成行测题库第三套', nextActionAt: '2026-09-16T09:00', tags: ['金融科技', '稳定'],
    history: history('h3', [['bs-applied','网申完成','2026-08-27'],['bs-review','资格审查','2026-09-03'],['bs-written','统一笔试','2026-09-09']]),
  },
  {
    id: 'app-4', company: '美团', role: '数据分析师', department: '到店事业群', city: '北京', channel: '内推',
    priority: 'medium', pipelineId: 'internet-tech', stageId: 'it-assessment', appliedAt: '2026-09-02', updatedAt: '2026-09-08',
    nextAction: '在线测评', nextActionAt: '2026-09-13T20:00', contact: '学长内推', tags: ['数据分析'],
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
    nextAction: '与 Case Partner 模拟市场规模题', nextActionAt: '2026-09-14T20:30', tags: ['咨询', 'Case'],
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
    priority: 'low', pipelineId: 'internet-tech', stageId: 'it-wishlist', appliedAt: '2026-09-12', updatedAt: '2026-09-12',
    nextAction: '针对 JD 调整项目描述', nextActionAt: '2026-09-15T10:00', tags: ['用户研究'],
    history: history('h8', [['it-wishlist','待投递','2026-09-12']]),
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
    nextAction: '确认资格审查材料', nextActionAt: '2026-09-18T18:00', tags: ['金融科技'],
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

export const seedData: AppData = { applications: seedApplications, pipelines: defaultPipelines }
