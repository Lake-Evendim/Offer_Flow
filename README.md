# Offer Flow · 秋招投递管理系统

一个本地优先、轻量但完整的秋招投递管理系统。重点不是堆叠功能，而是让每条机会都有清晰的当前阶段、下一步行动和可复盘的数据。

品牌图标采用“多条机会路径汇聚为一个明确结果”的抽象构型，不依赖字母缩写或常见求职图标，在小尺寸下也保持清晰辨识度。

## 已实现

- 工作台：全部投递、活跃机会、面试阶段、Offer、近期行动与重点推进
- 投递记录：搜索、流程/阶段/优先级筛选、阶段快速更新、详情抽屉
- 流程看板：按公司类型切换视图，拖拽卡片更新阶段
- 日程计划：月历、事项密度色块、可点击的天级详情与近期行动时间线
- 数据分析：可切换一周/一月/半年/一年的投递趋势、岗位机会漏斗、流程范围筛选、渠道质量、阶段平均耗时与动态行动建议
- 灵活流程：互联网/科技、银行/国企、咨询/管培三套模板；支持新增模板、增删/排序/改名阶段、阶段归一分类和结束节点
- 自适应建模：每条投递绑定公司类型，可以跳过不适用阶段；分析层通过归一分类跨类型统计
- 完整时间线：阶段变化自动记录，详情中可回看进展
- 本地数据：浏览器 `localStorage` 持久化，支持 JSON 完整备份、JSON 导入、CSV 导出
- 响应式布局：桌面与手机端均可使用，并针对弹窗、抽屉、横向看板和滚动条进行适配

## 快速开始

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## GitHub 项目调研

实现前重点阅读了以下开源项目的 README、数据模型与核心页面源码：

- [CareerSail](https://github.com/genius916/CareerSail)：岗位池、跟进行动、进度时间线与本地工作台
- [job-tracker](https://github.com/Echo6v9o/job-tracker)：自由状态流转、列表/看板双视图、漏斗与近期提醒
- [OfferDiary](https://github.com/gmjneko/OfferDiary)：按投递绑定流程模板、阶段历史、面试日历
- [autumn-recruitment-calendar](https://github.com/qiqi068-casey/autumn-recruitment-calendar)：连续日历、事件复用与隐私优先
- [recruitment-statistics](https://github.com/24S153031/recruitment-statistics)：主流程与多轮面试拆分、Offer 对比、面试题复盘
- [JobSync](https://github.com/Gsync/jobsync)：渠道、任务、活动、简历与分析的完整数据结构
- [JobHuntBot](https://github.com/DanielPan12/JobHuntBot)：本地仪表盘、跟进队列和安全边界

从这些项目中归纳出的产品原则：

1. 固定状态枚举无法适配真实招聘流程，必须使用“流程模板 + 每条投递独立绑定”。
2. 自定义阶段仍需映射到统一分类，否则跨公司数据分析会失真。
3. 当前状态不等于完整历史；阶段变化必须留下时间线。
4. 首页最有价值的信息是“下一步做什么、什么时候做”，而不是装饰性统计。
5. 数据分析应回答渠道质量、转化瓶颈和推进耗时，而不是只展示总数。

本项目重新设计并独立实现，没有复制上述项目代码。

## 技术栈

- React 19 + TypeScript
- Vite
- Recharts
- date-fns
- lucide-react

## 数据说明

首次打开会载入演示数据。后续修改自动保存在当前浏览器。清理浏览器站点数据会删除本地记录，请定期在「流程配置 → 数据管理」中导出 JSON 备份。

## 推荐的后续工程化方向

- 接入 Supabase/PostgreSQL，实现登录与多端同步
- 增加 CSV 批量导入映射器
- 增加面试复盘与题目库，但保持为投递详情的子模块
- 增加单元测试与 Playwright 端到端测试
- 增加可选的邮件/日历只读同步，任何自动写入都应明确确认
