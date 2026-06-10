import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type Locale = 'zh' | 'en'

const messages: Record<string, Record<Locale, string>> = {
  // 导航
  'nav.overview': { zh: '基地总览', en: 'Overview' },
  'nav.users': { zh: '航船用户', en: 'Users' },
  'nav.formations': { zh: '任务编队', en: 'Formations' },
  'nav.traces': { zh: '航迹中心', en: 'Traces' },
  'nav.directives': { zh: '指令日志', en: 'Directives' },
  'nav.mirrors': { zh: '镜像档案', en: 'Mirrors' },
  'nav.system': { zh: '系统监控', en: 'System' },
  'nav.admins': { zh: '管理员权限', en: 'Admins' },
  'nav.audit': { zh: '审计日志', en: 'Audit' },

  // 通用
  'common.search': { zh: '搜索', en: 'Search' },
  'common.refresh': { zh: '刷新', en: 'Refresh' },
  'common.cancel': { zh: '取消', en: 'Cancel' },
  'common.confirm': { zh: '确认', en: 'Confirm' },
  'common.save': { zh: '保存', en: 'Save' },
  'common.delete': { zh: '删除', en: 'Delete' },
  'common.enable': { zh: '启用', en: 'Enable' },
  'common.disable': { zh: '禁用', en: 'Disable' },
  'common.detail': { zh: '详情', en: 'Detail' },
  'common.actions': { zh: '操作', en: 'Actions' },
  'common.status': { zh: '状态', en: 'Status' },
  'common.loading': { zh: '正在接入数据...', en: 'Loading...' },
  'common.noData': { zh: '未检索到匹配航迹', en: 'No matching records' },
  'common.noDataDesc': { zh: '尝试调整筛选条件或搜索关键词', en: 'Try adjusting filters or keywords' },
  'common.total': { zh: '共', en: 'Total' },
  'common.items': { zh: '条', en: 'items' },
  'common.selected': { zh: '已选', en: 'Selected' },

  // Dashboard
  'dashboard.title': { zh: '基地态势总览', en: 'Base Situation Overview' },
  'dashboard.baseOk': { zh: '基地运行正常', en: 'Base Operating Normal' },
  'dashboard.baseWarn': { zh: '基地运行注意', en: 'Base Attention Required' },
  'dashboard.baseError': { zh: '基地运行异常', en: 'Base Error Detected' },
  'dashboard.lastSync': { zh: '上次同步', en: 'Last Sync' },
  'dashboard.nextSync': { zh: '下次同步', en: 'Next Sync' },
  'dashboard.situation': { zh: '基地态势', en: 'Situation' },
  'dashboard.health': { zh: '系统健康', en: 'Health' },
  'dashboard.trends': { zh: '趋势分析', en: 'Trends' },
  'dashboard.events': { zh: '实时事件', en: 'Live Events' },
  'dashboard.noEvents': { zh: '暂无近期事件', en: 'No recent events' },

  // 用户
  'users.title': { zh: '航船用户', en: 'Vessel Users' },
  'users.search': { zh: '搜索用户 ID / 本舰呼号', en: 'Search user ID / callsign' },
  'users.batchEnable': { zh: '批量启用', en: 'Batch Enable' },
  'users.batchDisable': { zh: '批量禁用', en: 'Batch Disable' },
  'users.batchDelete': { zh: '批量删除', en: 'Batch Delete' },

  // 登录
  'login.title': { zh: '管理员接入终端', en: 'Admin Access Terminal' },
  'login.username': { zh: '账号', en: 'Username' },
  'login.password': { zh: '密码', en: 'Password' },
  'login.submit': { zh: '接入基地总控台', en: 'Access Command Base' },
  'login.checking': { zh: '正在校验基地权限...', en: 'Verifying access...' },
  'login.error': { zh: '接入失败，请检查账号或权限', en: 'Access denied, check credentials' },

  // 系统
  'system.ok': { zh: '正常', en: 'OK' },
  'system.warn': { zh: '注意', en: 'Warning' },
  'system.error': { zh: '异常', en: 'Error' },
  'system.healthTitle': { zh: '系统健康', en: 'System Health' },

  // 设置
  'settings.language': { zh: '语言', en: 'Language' },
  'settings.theme': { zh: '主题', en: 'Theme' },
  'settings.dark': { zh: '深色', en: 'Dark' },
  'settings.light': { zh: '浅色', en: 'Light' },

  // 编队
  'formations.title': { zh: '任务编队', en: 'Formations' },
  'formations.search': { zh: '搜索编队码', en: 'Search formation code' },
  'formations.running': { zh: '运行中', en: 'Running' },
  'formations.sealed': { zh: '已封存', en: 'Sealed' },
  'formations.pulseFlow': { zh: '脉冲流向', en: 'Pulse Flow' },
  'formations.segmentWrite': { zh: '航段写入', en: 'Segment Write' },
  'formations.owner': { zh: '编队主控', en: 'Owner' },
  'formations.members': { zh: '成员数', en: 'Members' },
  'formations.protocol': { zh: '记录协议', en: 'Protocol' },
  'formations.createdAt': { zh: '创建时间', en: 'Created' },
  'formations.lastActive': { zh: '最后活动', en: 'Last Active' },

  // 指令
  'directives.title': { zh: '指令日志', en: 'Directive Logs' },
  'directives.search': { zh: '搜索用户 ID', en: 'Search user ID' },
  'directives.source': { zh: '生成来源', en: 'Source' },
  'directives.mainEngine': { zh: '主引擎', en: 'Main Engine' },
  'directives.backup': { zh: '备用指令', en: 'Backup' },
  'directives.duration': { zh: '耗时', en: 'Duration' },
  'directives.success': { zh: '成功', en: 'Success' },
  'directives.failed': { zh: '失败', en: 'Failed' },

  // 镜像
  'mirrors.title': { zh: '镜像档案', en: 'Mirror Archives' },
  'mirrors.mbti': { zh: '协议类型', en: 'Protocol Type' },
  'mirrors.confidence': { zh: '一致率', en: 'Confidence' },
  'mirrors.samples': { zh: '样本数', en: 'Samples' },
  'mirrors.updated': { zh: '最近更新', en: 'Last Updated' },

  // 管理员
  'admins.title': { zh: '管理员', en: 'Admins' },
  'admins.create': { zh: '新增管理员', en: 'Create Admin' },
  'admins.username': { zh: '用户名', en: 'Username' },
  'admins.password': { zh: '密码', en: 'Password' },
  'admins.role': { zh: '角色', en: 'Role' },
  'admins.roles': { zh: '角色分布', en: 'Role Distribution' },
  'admins.statusDist': { zh: '状态分布', en: 'Status Distribution' },

  // 审计
  'audit.title': { zh: '审计日志', en: 'Audit Log' },
  'audit.actionType': { zh: '操作类型', en: 'Action Type' },
  'audit.targetType': { zh: '目标类型', en: 'Target Type' },
  'audit.targetId': { zh: '目标 ID', en: 'Target ID' },
  'audit.result': { zh: '结果', en: 'Result' },
  'audit.success': { zh: '成功', en: 'Success' },
  'audit.failed': { zh: '失败', en: 'Failed' },
  'audit.actionDist': { zh: '操作类型分布', en: 'Action Distribution' },

  // 航迹
  'traces.title': { zh: '航迹中心', en: 'Trace Center' },
  'traces.sealedTrend': { zh: '封存航程趋势', en: 'Sealed Trend' },
  'traces.activeRank': { zh: '活跃排行', en: 'Active Ranking' },
  'traces.topUsers': { zh: '高活跃航船', en: 'Top Users' },
  'traces.topFormations': { zh: '高活跃编队', en: 'Top Formations' },

  // 系统
  'system.title': { zh: '系统监控', en: 'System Monitor' },
  'system.healthMatrix': { zh: '系统健康矩阵', en: 'Health Matrix' },
  'system.slowRequests': { zh: '接口耗时排行', en: 'Slow Requests' },
  'system.errorRank': { zh: '错误接口排行', en: 'Error Ranking' },
  'system.sentinel': { zh: '限流控制台', en: 'Sentinel Console' },
  'system.openConsole': { zh: '打开控制台', en: 'Open Console' },

  // 用户详情
  'user.title': { zh: '航船档案', en: 'Vessel Profile' },
  'user.identityLevel': { zh: '身份等级', en: 'Identity Level' },
  'user.experience': { zh: '航行经验', en: 'Experience' },
  'user.sealed': { zh: '封存航程', en: 'Sealed' },
  'user.registered': { zh: '注册时间', en: 'Registered' },
  'user.formations': { zh: '参与的编队', en: 'Formations' },
  'user.techInfo': { zh: '技术信息', en: 'Technical Info' },

  // 编队详情
  'formation.title': { zh: '编队详情', en: 'Formation Detail' },
  'formation.summary': { zh: '编队摘要', en: 'Summary' },
  'formation.memberSeats': { zh: '成员席位', en: 'Member Seats' },
  'formation.pulseChart': { zh: '脉冲轨迹', en: 'Pulse Chart' },
  'formation.dangerZone': { zh: '危险操作', en: 'Danger Zone' },
  'formation.forceSeal': { zh: '强制封存航程', en: 'Force Seal' },
  'formation.forceDissolve': { zh: '强制解散编队', en: 'Force Dissolve' },

  // 批量操作
  'batch.enable': { zh: '批量启用', en: 'Batch Enable' },
  'batch.disable': { zh: '批量禁用', en: 'Batch Disable' },
  'batch.delete': { zh: '批量删除', en: 'Batch Delete' },
  'batch.confirmDelete': { zh: '批量删除用户', en: 'Batch Delete Users' },
  'batch.confirmEnable': { zh: '批量启用用户', en: 'Batch Enable Users' },
  'batch.confirmDisable': { zh: '批量禁用用户', en: 'Batch Disable Users' },
  'batch.irreversible': { zh: '用户数据将被永久删除，此操作不可逆。', en: 'User data will be permanently deleted. This action is irreversible.' },

  // 分组标题
  'group.operations': { zh: '基地运营', en: 'Operations' },
  'group.data': { zh: '数据舱', en: 'Data' },
  'group.system': { zh: '运维', en: 'System' },
  'group.access': { zh: '权限审计', en: 'Access' },
}

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<Locale>((localStorage.getItem('admin_locale') as Locale) || 'zh')

  function t(key: string): string {
    return messages[key]?.[locale.value] || key
  }

  function setLocale(l: Locale) {
    locale.value = l
    localStorage.setItem('admin_locale', l)
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
  }

  const isZh = computed(() => locale.value === 'zh')

  return { locale, t, setLocale, isZh }
})
