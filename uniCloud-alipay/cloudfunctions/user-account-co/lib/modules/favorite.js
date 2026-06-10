const { getCurrentUid } = require('../common/auth')
const { favoriteCollection } = require('../common/db')

module.exports = {
  async getFavoriteStatus (context, params = {}) {
    const { agentId } = params
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

    const { data } = await favoriteCollection.where({
      userId: uid,
      agentId
    }).limit(1).get()

    return {
      errCode: 0,
      errMsg: '',
      isFavorited: !!(data && data.length),
      favoriteId: data && data[0] ? data[0]._id : ''
    }
  },

  async toggleFavorite (context, params = {}) {
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

    const { data } = await favoriteCollection.where({
      userId: uid,
      agentId
    }).limit(1).get()

    const currentRecord = data && data[0]
    if (currentRecord) {
      await favoriteCollection.doc(currentRecord._id).remove()
      return {
        errCode: 0,
        errMsg: '',
        isFavorited: false
      }
    }

    const cleanSnapshot = {}
    Object.keys(agentSnapshot || {}).forEach((key) => {
      const value = agentSnapshot[key]
      if (value !== undefined && value !== null && value !== '') {
        cleanSnapshot[key] = value
      }
    })

    await favoriteCollection.add({
      userId: uid,
      agentId,
      agentSnapshot: cleanSnapshot
    })

    return {
      errCode: 0,
      errMsg: '',
      isFavorited: true
    }
  }
}
