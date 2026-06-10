function generateInviteCode () {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

function generateActivationCodeRaw (len = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

async function generateUniqueActivationCode (activationCodeCollection, len = 16, maxRetries = 10) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateActivationCodeRaw(len)
    
    const existing = await activationCodeCollection.where({ code }).limit(1).get()
    
    if (!existing?.data || existing.data.length === 0) {
      return code
    }
  }
  
  throw new Error('无法生成唯一激活码，请重试')
}

function daysFromNow (days) {
  return Date.now() + days * 24 * 60 * 60 * 1000
}

function uniqRoleList (roles = []) {
  return Array.from(new Set((Array.isArray(roles) ? roles : []).filter(Boolean)))
}

function toInt (value) {
  return Number(value || 0) || 0
}

function formatReviewDate (value) {
  const date = new Date(value || Date.now())
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function normalizeReviewDimensionScores (dimensionScores = []) {
  return (Array.isArray(dimensionScores) ? dimensionScores : [])
    .map(item => {
      const key = String(item?.key || '').trim()
      const label = String(item?.label || '').trim()
      const scoreRaw = Number(item?.score)
      const score = Number.isFinite(scoreRaw) ? scoreRaw : 0
      const normalized = Math.max(0, Math.min(5, Math.round(score * 10) / 10))
      return {
        key,
        label,
        score: normalized
      }
    })
    .filter(item => item.key && item.label)
}

function buildReviewSummary (reviewList = []) {
  const approvedReviews = (Array.isArray(reviewList) ? reviewList : []).filter(Boolean)
  const ratingCount = approvedReviews.length
  if (!ratingCount) {
    return {
      ratingScore: 0,
      ratingCount: 0,
      topDimension: '',
      topScore: 0,
      dimensionScores: []
    }
  }

  const ratingScore = Math.round((approvedReviews.reduce((sum, item) => sum + (Number(item.score || 0) || 0), 0) / ratingCount) * 10) / 10
  const dimensionMap = {}

  approvedReviews.forEach((review) => {
    normalizeReviewDimensionScores(review.dimensionScores).forEach((dimension) => {
      if (!dimensionMap[dimension.key]) {
        dimensionMap[dimension.key] = {
          key: dimension.key,
          label: dimension.label,
          total: 0,
          count: 0
        }
      }
      dimensionMap[dimension.key].total += dimension.score
      dimensionMap[dimension.key].count += 1
    })
  })

  const dimensionScores = Object.values(dimensionMap).map((item) => ({
    key: item.key,
    label: item.label,
    score: Math.round((item.total / Math.max(item.count, 1)) * 10) / 10,
    count: item.count
  }))

  const top = [...dimensionScores].sort((a, b) => b.score - a.score)[0]

  return {
    ratingScore,
    ratingCount,
    topDimension: top?.label || '',
    topScore: top?.score || 0,
    dimensionScores
  }
}

module.exports = {
  generateInviteCode,
  generateActivationCode: generateActivationCodeRaw,
  generateUniqueActivationCode,
  daysFromNow,
  uniqRoleList,
  toInt,
  formatReviewDate,
  normalizeReviewDimensionScores,
  buildReviewSummary
}
