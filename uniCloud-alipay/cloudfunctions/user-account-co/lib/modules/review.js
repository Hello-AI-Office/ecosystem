const { getCurrentUid } = require('../common/auth')
const { reviewCollection, agentCollection, userCollection, dbCmd } = require('../common/db')
const { formatReviewDate, normalizeReviewDimensionScores, buildReviewSummary } = require('../common/utils')

module.exports = {
  async getAgentReviews (context, params = {}) {
    const agentId = String(params.agentId || '').trim()
    if (!agentId) {
      return {
        errCode: 'user-account-co-invalid-agent-id',
        errMsg: '代理人ID不能为空'
      }
    }

    const { data } = await reviewCollection.where({
      agentId,
      isDeleted: dbCmd.neq(true),
      approvalStatus: 'approved'
    }).orderBy('createTime', 'desc').get()

    const list = (data || []).map((item) => ({
      id: item._id,
      reviewerId: item.reviewerId || '',
      reviewerName: item.reviewerName || '匿名用户',
      createdAt: formatReviewDate(item.createTime || item.updateTime || Date.now()),
      score: Math.round((Number(item.score || 0) || 0) * 10) / 10,
      content: item.content || '',
      dimensionScores: normalizeReviewDimensionScores(item.dimensionScores)
    }))

    return {
      errCode: 0,
      errMsg: '',
      data: list,
      summary: buildReviewSummary(list)
    }
  },

  async submitReview (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const agentId = String(params.agentId || '').trim()
    const reviewerName = String(params.reviewerName || '').trim()
    const content = String(params.content || '').trim()
    const dimensionScores = normalizeReviewDimensionScores(params.dimensionScores)

    if (!agentId) {
      return {
        errCode: 'user-account-co-invalid-agent-id',
        errMsg: '代理人ID不能为空'
      }
    }

    if (!content || content.length < 2) {
      return {
        errCode: 'user-account-co-invalid-review-content',
        errMsg: '请填写评价内容'
      }
    }

    const hasAnyScore = dimensionScores.some((d) => (Number(d.score || 0) || 0) > 0)
    if (!hasAnyScore) {
      return {
        errCode: 'user-account-co-invalid-review-score',
        errMsg: '请完成评分'
      }
    }

    const { data: userList } = await userCollection.doc(uid).get()
    const user = userList && userList[0]
    if (!user) {
      return {
        errCode: 'uni-id-account-not-exists',
        errMsg: '用户不存在'
      }
    }

    const { data: agentList } = await agentCollection.doc(agentId).get()
    const agent = agentList && agentList[0]
    if (!agent || agent.isDeleted) {
      return {
        errCode: 'user-account-co-agent-not-found',
        errMsg: '代理人不存在'
      }
    }

    const score5 = Math.round((dimensionScores.reduce((sum, item) => sum + (Number(item.score || 0) || 0), 0) / Math.max(dimensionScores.length, 1)) * 10) / 10
    const now = Date.now()

    const addRes = await reviewCollection.add({
      reviewerId: uid,
      reviewerName: reviewerName || user.nickname || user.username || user.mobile || '匿名用户',
      agentId,
      agentName: agent.name || '',
      score: score5,
      content,
      dimensionScores,
      isVerified: false,
      approvalStatus: 'approved',
      helpfulCount: 0,
      isDeleted: false,
      createTime: now,
      updateTime: now
    })

    const { data: latestReviews } = await reviewCollection.where({
      agentId,
      isDeleted: dbCmd.neq(true),
      approvalStatus: 'approved'
    }).get()

    const reviewList = (latestReviews || []).map((item) => ({
      score: Math.round((Number(item.score || 0) || 0) * 10) / 10,
      dimensionScores: normalizeReviewDimensionScores(item.dimensionScores)
    }))
    const summary = buildReviewSummary(reviewList)

    await agentCollection.doc(agentId).update({
      stats: {
        ...(agent.stats || {}),
        ratingScore: summary.ratingScore,
        ratingCount: summary.ratingCount,
        topDimension: summary.topDimension,
        topScore: summary.topScore
      },
      dimensionScores: summary.dimensionScores,
      updateTime: now
    })

    return {
      errCode: 0,
      errMsg: '',
      data: {
        reviewId: addRes.id,
        score: score5,
        createdAt: formatReviewDate(now)
      },
      summary
    }
  }
}
