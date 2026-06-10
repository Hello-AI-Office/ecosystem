const { getCurrentUid } = require('../common/auth')
const { db, dbCmd, activationCodeCollection, codeRedeemCollection, userFeatureCollection, featureCollection, settingsCollection, messageCollection } = require('../common/db')
const { toInt, generateUniqueActivationCode } = require('../common/utils')

const NEW_AGENT_GIFT_SETTINGS_KEY = 'newAgentGiftActivationCode'

async function getNewAgentGiftConfig () {
  const res = await settingsCollection.where({ key: NEW_AGENT_GIFT_SETTINGS_KEY }).limit(1).get()
  const doc = res?.data && res.data[0]
  const v = doc?.value || {}
  return {
    enabled: v?.enabled !== false,
    featureCode: String(v?.featureCode || '').trim(),
    entitlementDays: Math.max(1, Math.min(3650, toInt(v?.entitlementDays || 30))),
    remark: String(v?.remark || '').trim()
  }
}

async function issueNewAgentGiftActivationCode ({ uid, agentId }) {
  const cfg = await getNewAgentGiftConfig()
  if (!cfg.enabled) return null
  if (!cfg.featureCode) return null

  const now = Date.now()

  const exists = await activationCodeCollection.where({
    createdBy: uid,
    sourceType: 'admin',
    sourceId: String(agentId || ''),
    status: 'active'
  }).limit(1).get()

  if (exists?.data && exists.data.length) {
    return exists.data[0]
  }

  const codeStr = await generateUniqueActivationCode(activationCodeCollection, 16)

  const addRes = await activationCodeCollection.add({
    code: codeStr,
    featureCodes: [cfg.featureCode],
    status: 'active',
    entitlementDays: cfg.entitlementDays,
    maxUses: 1,
    usedCount: 0,
    sourceType: 'admin',
    sourceId: String(agentId || ''),
    createdBy: uid,
    remark: `新代理人赠送：${cfg.featureCode} ${cfg.entitlementDays}天` + (cfg.remark ? `；${cfg.remark}` : ''),
    createTime: now,
    updateTime: now
  })

  if (codeStr) {
    await messageCollection.add({
      userId: uid,
      type: 'system',
      title: '新代理人欢迎礼已发放',
      content: `已为你发放技能激活码：${codeStr}。前往【技能】页点击"激活解锁"输入即可开通。`,
      linkUrl: '/pages/agent/skill/skill',
      isRead: false,
      createTime: now,
      updateTime: now
    })
  }

  return { _id: addRes?.id, code: codeStr, featureCodes: [cfg.featureCode], entitlementDays: cfg.entitlementDays }
}

module.exports = {
  issueNewAgentGiftActivationCode,

  async findDuplicateActivationCodes (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const aggregateRes = await activationCodeCollection.aggregate()
      .group({
        _id: '$code',
        count: dbCmd.aggregate.sum(1),
        ids: dbCmd.aggregate.push('$_id'),
        statuses: dbCmd.aggregate.push('$status'),
        createTimes: dbCmd.aggregate.push('$createTime'),
        createdBys: dbCmd.aggregate.push('$createdBy')
      })
      .match({
        count: dbCmd.gt(1)
      })
      .end()

    const duplicates = (aggregateRes?.data || []).map((item) => ({
      code: item._id,
      count: item.count,
      ids: item.ids,
      statuses: item.statuses,
      createTimes: item.createTimes,
      createdBys: item.createdBys
    }))

    return {
      errCode: 0,
      errMsg: '',
      data: {
        duplicates,
        totalDuplicateCodes: duplicates.length,
        totalDuplicateRecords: duplicates.reduce((sum, d) => sum + d.count, 0)
      }
    }
  },

  async cleanupDuplicateActivationCodes (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const code = String(params.code || '').trim().toUpperCase()
    if (!code) {
      return {
        errCode: 'user-account-co-invalid-code',
        errMsg: '请提供激活码'
      }
    }

    const allCodes = await activationCodeCollection.where({ code }).get()
    
    if (!allCodes?.data || allCodes.data.length <= 1) {
      return {
        errCode: 'user-account-co-no-duplicate',
        errMsg: '该激活码没有重复记录'
      }
    }

    const sortedCodes = allCodes.data.sort((a, b) => {
      if (a.usedCount !== b.usedCount) {
        return (b.usedCount || 0) - (a.usedCount || 0)
      }
      return (a.createTime || 0) - (b.createTime || 0)
    })

    const keepRecord = sortedCodes[0]
    const deleteRecords = sortedCodes.slice(1)

    const deletedIds = []
    for (const record of deleteRecords) {
      if (record.usedCount > 0) {
        await activationCodeCollection.doc(record._id).update({
          status: 'deleted',
          updateTime: Date.now()
        })
      } else {
        await activationCodeCollection.doc(record._id).remove()
      }
      deletedIds.push(record._id)
    }

    return {
      errCode: 0,
      errMsg: '清理成功',
      data: {
        code,
        keptId: keepRecord._id,
        deletedIds,
        deletedCount: deletedIds.length
      }
    }
  },

  async reissueActivationCode (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const oldCodeId = String(params.codeId || '').trim()
    if (!oldCodeId) {
      return {
        errCode: 'user-account-co-invalid-code-id',
        errMsg: '请提供原激活码ID'
      }
    }

    const oldCodeRes = await activationCodeCollection.doc(oldCodeId).get()
    const oldCode = oldCodeRes?.data && oldCodeRes.data[0]
    
    if (!oldCode) {
      return {
        errCode: 'user-account-co-code-not-found',
        errMsg: '原激活码不存在'
      }
    }

    if (oldCode.createdBy !== uid) {
      return {
        errCode: 'user-account-co-unauthorized',
        errMsg: '无权操作该激活码'
      }
    }

    const now = Date.now()
    const newCodeStr = await generateUniqueActivationCode(activationCodeCollection, 16)

    const newCodeData = {
      code: newCodeStr,
      featureCodes: oldCode.featureCodes,
      status: 'active',
      entitlementDays: oldCode.entitlementDays,
      maxUses: oldCode.maxUses,
      usedCount: 0,
      sourceType: oldCode.sourceType,
      sourceId: oldCode.sourceId,
      createdBy: uid,
      remark: `补发（原：${oldCode.code}）` + (oldCode.remark ? ` ${oldCode.remark}` : ''),
      createTime: now,
      updateTime: now
    }

    if (oldCode.expireTime) {
      newCodeData.expireTime = oldCode.expireTime
    }
    if (oldCode.teamId) {
      newCodeData.teamId = oldCode.teamId
    }

    const addRes = await activationCodeCollection.add(newCodeData)

    await activationCodeCollection.doc(oldCodeId).update({
      status: 'replaced',
      remark: (oldCode.remark || '') + ` [已补发新码：${newCodeStr}]`,
      updateTime: now
    })

    await messageCollection.add({
      userId: uid,
      type: 'system',
      title: '激活码已补发',
      content: `原激活码 ${oldCode.code} 已作废，新激活码为：${newCodeStr}`,
      linkUrl: '/pages/agent/skill/skill',
      isRead: false,
      createTime: now,
      updateTime: now
    })

    return {
      errCode: 0,
      errMsg: '补发成功',
      data: {
        oldCode: oldCode.code,
        oldCodeId,
        newCode: newCodeStr,
        newCodeId: addRes?.id,
        featureCodes: oldCode.featureCodes,
        entitlementDays: oldCode.entitlementDays
      }
    }
  },

  async listMyActivationCodes (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const res = await activationCodeCollection.where({
      createdBy: uid,
      sourceType: dbCmd.in(['purchase', 'admin'])
    }).orderBy('createTime', 'desc').limit(200).get()

    return {
      errCode: 0,
      errMsg: '',
      data: (res?.data || []).map((x) => ({
        _id: x._id,
        code: x.code,
        status: x.status,
        usedCount: x.usedCount,
        maxUses: x.maxUses,
        entitlementDays: x.entitlementDays,
        featureCodes: x.featureCodes,
        expireTime: x.expireTime,
        sourceId: x.sourceId,
        createTime: x.createTime
      }))
    }
  },

  async redeemActivationCode (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const code = String(params.code || '').trim().toUpperCase()
    if (!code || code.length < 6) {
      return {
        errCode: 'user-account-co-invalid-activation-code',
        errMsg: '激活码格式不正确'
      }
    }

    const clientInfo = (() => {
      try {
        return context.getClientInfo ? context.getClientInfo() : {}
      } catch (e) {
        return {}
      }
    })()

    const now = Date.now()

    const codeDocRes = await activationCodeCollection.where({
      code,
      status: 'active'
    }).limit(1).get()

    const codeDoc = codeDocRes?.data && codeDocRes.data[0]
    if (!codeDoc) {
      return {
        errCode: 'user-account-co-activation-code-not-found',
        errMsg: '激活码不存在或已停用'
      }
    }

    if (codeDoc.expireTime && Number(codeDoc.expireTime) <= now) {
      return {
        errCode: 'user-account-co-activation-code-expired',
        errMsg: '激活码已过期'
      }
    }

    const maxUses = toInt(codeDoc.maxUses || 1)
    const usedCount = toInt(codeDoc.usedCount || 0)
    if (usedCount >= Math.max(1, maxUses)) {
      return {
        errCode: 'user-account-co-activation-code-used',
        errMsg: '激活码已被使用'
      }
    }

    const redeemed = await codeRedeemCollection.where({
      codeId: String(codeDoc._id || ''),
      userId: uid
    }).limit(1).get()

    if (redeemed?.data && redeemed.data.length) {
      return {
        errCode: 'user-account-co-activation-code-already-redeemed',
        errMsg: '你已兑换过该激活码'
      }
    }

    const featureCodes = (Array.isArray(codeDoc.featureCodes) ? codeDoc.featureCodes : [])
      .map(x => String(x || '').trim())
      .filter(Boolean)

    if (!featureCodes.length) {
      return {
        errCode: 'user-account-co-activation-code-empty',
        errMsg: '该激活码未配置技能'
      }
    }

    const featuresRes = await featureCollection.where({
      code: dbCmd.in(featureCodes),
      status: 'enabled'
    }).get()
    
    const features = featuresRes?.data || []
    const requiresTeamFeatures = features.filter(f => f.requiresTeam === true)
    
    if (requiresTeamFeatures.length > 0) {
      const teamMemberRes = await db.collection('xuanshang-team-members').where({
        userId: uid,
        status: 'joined'
      }).limit(1).get()
      
      if (!teamMemberRes?.data || !teamMemberRes.data.length) {
        const featureNames = requiresTeamFeatures.map(f => f.name).join('、')
        return {
          errCode: 'user-account-co-activation-code-requires-team',
          errMsg: `该激活码包含团队技能（${featureNames}），需要先加入团队才能使用。请联系团队长或管理员获取团队码。`
        }
      }
    }

    const entitlementDays = Math.max(1, Math.min(3650, toInt(codeDoc.entitlementDays || 30)))
    const daysMs = entitlementDays * 24 * 60 * 60 * 1000

    const calcNextExpireTime = (currentExpireTime) => {
      const cur = currentExpireTime && (currentExpireTime.getTime ? currentExpireTime.getTime() : Number(currentExpireTime))
      const base = cur && cur > now ? cur : now
      return new Date(base + daysMs)
    }

    let finalExpireTime = 0

    const transaction = await db.startTransaction()
    try {
      const ac = transaction.collection('xuanshang-activation-codes')
      const uf = transaction.collection('xuanshang-user-features')
      const rr = transaction.collection('xuanshang-code-redeems')

      const locked = await ac.where({
        _id: codeDoc._id,
        status: 'active'
      }).limit(1).get()

      const lockedDoc = locked?.data && locked.data[0]
      if (!lockedDoc) {
        throw new Error('激活码不可用')
      }

      const lockedUsedCount = toInt(lockedDoc.usedCount || 0)
      if (lockedUsedCount >= Math.max(1, maxUses)) {
        throw new Error('激活码已被使用')
      }

      const redeemExist = await rr.where({
        codeId: String(codeDoc._id || ''),
        userId: uid
      }).limit(1).get()
      if (redeemExist?.data && redeemExist.data.length) {
        throw new Error('你已兑换过该激活码')
      }

      const nowTs = Date.now()

      const upserts = featureCodes.map(async (fc) => {
        const curRes = await uf.where({
          userId: uid,
          featureCode: fc
        }).limit(1).get()

        const curDoc = curRes?.data && curRes.data[0]
        const nextExpireTime = calcNextExpireTime(curDoc?.expireTime)

        if (curDoc && curDoc._id) {
          await uf.doc(curDoc._id).update({
            status: 'granted',
            expireTime: nextExpireTime,
            updateTime: nowTs,
            sourceType: 'redeem',
            sourceId: String(codeDoc._id || ''),
            teamId: codeDoc.teamId || undefined,
            grantBy: undefined
          })
        } else {
          await uf.add({
            userId: uid,
            featureCode: fc,
            status: 'granted',
            expireTime: nextExpireTime,
            grantTime: nowTs,
            updateTime: nowTs,
            sourceType: 'redeem',
            sourceId: String(codeDoc._id || ''),
            teamId: codeDoc.teamId || undefined,
            grantBy: undefined
          })
        }

        return nextExpireTime
      })

      const expireTimes = await Promise.all(upserts)
      finalExpireTime = Math.max(...expireTimes.map((x) => (x && x.getTime ? x.getTime() : Number(x || 0) || 0)))

      if (!finalExpireTime) {
        throw new Error('权益写入失败')
      }

      await rr.add({
        codeId: String(codeDoc._id || ''),
        code,
        userId: uid,
        teamId: codeDoc.teamId || undefined,
        grantedFeatureCodes: featureCodes,
        sourceType: String(codeDoc.sourceType || 'admin'),
        sourceId: codeDoc.sourceId || undefined,
        clientPlatform: String(clientInfo?.platform || ''),
        clientAppId: String(clientInfo?.appId || ''),
        remark: undefined,
        redeemTime: nowTs
      })

      await ac.doc(codeDoc._id).update({
        usedCount: dbCmd.inc(1),
        updateTime: nowTs
      })

      await transaction.commit()
    } catch (e) {
      try {
        await transaction.rollback()
      } catch (_) {}

      return {
        errCode: 'user-account-co-redeem-activation-code-failed',
        errMsg: e?.message || '激活失败'
      }
    }

    return {
      errCode: 0,
      errMsg: '激活成功',
      data: {
        featureCodes,
        expireTime: finalExpireTime
      }
    }
  },

  async getNewAgentGiftActivationCode (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const res = await activationCodeCollection.where({
      createdBy: uid,
      sourceType: 'admin'
    }).orderBy('createTime', 'desc').limit(1).get()

    const doc = res?.data && res.data[0]
    if (!doc) {
      return { errCode: 0, errMsg: '', data: null }
    }

    return {
      errCode: 0,
      errMsg: '',
      data: {
        _id: doc._id,
        code: doc.code,
        entitlementDays: doc.entitlementDays,
        featureCodes: doc.featureCodes,
        createTime: doc.createTime
      }
    }
  }
}
