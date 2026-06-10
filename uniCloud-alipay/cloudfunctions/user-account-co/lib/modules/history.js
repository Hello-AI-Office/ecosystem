const { getCurrentUid } = require('../common/auth')
const { historyCollection, dbCmd } = require('../common/db')

module.exports = {
  async upsertHistory (context, params = {}) {
    const { agentId, agentSnapshot = {} } = params
    if (!agentId) {
      return {
        errCode: 'user-account-co-invalid-agent-id',
        errMsg: '代理人ID不能为空'
      }
    }

    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const cleanSnapshot = {}
    Object.keys(agentSnapshot || {}).forEach((key) => {
      const value = agentSnapshot[key]
      if (value !== undefined && value !== null && value !== '') {
        cleanSnapshot[key] = value
      }
    })

    const { data } = await historyCollection.where({
      userId: uid,
      agentId
    }).limit(1).get()

    const currentRecord = data && data[0]
    if (currentRecord) {
      await historyCollection.doc(currentRecord._id).update({
        agentSnapshot: cleanSnapshot,
        viewedAt: Date.now(),
        viewCount: dbCmd.inc(1)
      })
      return {
        errCode: 0,
        errMsg: '',
        updated: true
      }
    }

    await historyCollection.add({
      userId: uid,
      agentId,
      agentSnapshot: cleanSnapshot,
      viewedAt: Date.now(),
      viewCount: 1
    })

    return {
      errCode: 0,
      errMsg: '',
      updated: false
    }
  },

  async getHistoryList (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const { data } = await historyCollection.where({
      userId: uid
    }).orderBy('viewedAt', 'desc').get()

    return {
      errCode: 0,
      errMsg: '',
      data: data || []
    }
  }
}
