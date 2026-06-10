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
