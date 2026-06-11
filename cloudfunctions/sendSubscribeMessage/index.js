const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 发送微信订阅消息
 * 
 * @param {Object} event - 调用参数
 * @param {string} event.touser - 接收者的 openid
 * @param {string} event.templateId - 订阅消息模板 ID
 * @param {string} event.page - 点击消息后跳转的页面
 * @param {Object} event.data - 模板消息数据
 * @returns {Object} 发送结果
 */
exports.main = async (event, context) => {
  const { touser, templateId, page, data } = event
  
  if (!touser || !templateId || !data) {
    return { success: false, error: '缺少必要参数' }
  }
  
  try {
    const result = await cloud.openapi.subscribeMessage.send({
      touser,
      templateId,
      page: page || 'pages/room/room',
      data
    })
    console.log('订阅消息发送成功', { touser, templateId, msgid: result.msgid })
    return { success: true, msgid: result.msgid }
  } catch (err) {
    console.error('发送订阅消息失败', { touser, templateId, error: err })
    return { success: false, error: err.message || err }
  }
}
