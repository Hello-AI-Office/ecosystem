const { getCurrentUid } = require('../common/auth')
const { agentCollection, userCollection, messageCollection, dbCmd } = require('../common/db')
const { toInt, uniqRoleList } = require('../common/utils')
const { issueNewAgentGiftActivationCode } = require('./activation')

module.exports = {
  async getMyAgentProfile (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const { data } = await agentCollection.where({
      'claimerInfo.userId': uid,
      isDeleted: dbCmd.neq(true)
    }).limit(1).get()

    return {
      errCode: 0,
      errMsg: '',
      data: data && data[0] ? data[0] : null
    }
  },

  async saveAgentDraft (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
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

    const payload = {
      name: (params.name || '').trim(),
      company: (params.company || '').trim(),
      phone: (params.phone || '').trim(),
      wechat: (params.wechat || '').trim(),
      province: (params.province || '').trim(),
      city: (params.city || '').trim(),
      district: (params.district || '').trim(),
      yearsOfExperience: toInt(params.yearsOfExperience),
      totalPolicies: toInt(params.totalPolicies),
      totalClaims: toInt(params.totalClaims),
      totalClaimAmount: toInt(params.totalClaimAmount),
      totalPremiums: toInt(params.totalPremiums),
      intro: (params.intro || '').trim(),
      personalAdvantage: (params.personalAdvantage || '').trim(),
      specialties: Array.isArray(params.specialties) ? params.specialties.filter(Boolean) : [],
      valueAddedServices: Array.isArray(params.valueAddedServices) ? params.valueAddedServices.filter(Boolean) : [],
      socialLinks: {
        douyinQr: (params.douyinQr || '').trim(),
        xiaohongshuQr: (params.xiaohongshuQr || '').trim(),
        videoChannelQr: (params.videoChannelQr || '').trim()
      },
      images: {
        personalPhoto: (params.personalPhoto || '').trim(),
        teamPhoto: (params.teamPhoto || '').trim(),
        gallery: Array.isArray(params.gallery) ? params.gallery.filter(Boolean) : []
      }
    }

    const now = Date.now()
    const { data } = await agentCollection.where({
      'claimerInfo.userId': uid,
      isDeleted: dbCmd.neq(true)
    }).limit(1).get()

    const current = data && data[0]
    const saveData = {
      ...payload,
      profileStatus: 'draft',
      isCertified: false,
      isDeleted: false,
      claimStatus: current?.claimStatus || 'claimed',
      claimerInfo: {
        userId: uid,
        realName: user.nickname || user.username || '',
        phone: user.mobile || payload.phone,
        appliedAt: current?.claimerInfo?.appliedAt || now
      },
      stats: current?.stats || {
        ratingScore: 0,
        ratingCount: 0,
        topDimension: '',
        topScore: 0
      },
      dimensionScores: current?.dimensionScores || [],
      updateTime: now
    }

    let agentId = ''
    const isFirstCreate = !(current && current._id)
    if (!isFirstCreate) {
      agentId = current._id
      await agentCollection.doc(current._id).update(saveData)
    } else {
      const addRes = await agentCollection.add({
        ...saveData,
        createTime: now
      })
      agentId = addRes.id
    }

    return {
      errCode: 0,
      errMsg: '',
      data: {
        agentId,
        profileStatus: 'draft',
        isCertified: false
      }
    }
  },

  async submitAgentProfile (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
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

    const payload = {
      name: (params.name || '').trim(),
      company: (params.company || '').trim(),
      phone: (params.phone || '').trim(),
      wechat: (params.wechat || '').trim(),
      province: (params.province || '').trim(),
      city: (params.city || '').trim(),
      district: (params.district || '').trim(),
      yearsOfExperience: toInt(params.yearsOfExperience),
      totalPolicies: toInt(params.totalPolicies),
      totalClaims: toInt(params.totalClaims),
      totalClaimAmount: toInt(params.totalClaimAmount),
      totalPremiums: toInt(params.totalPremiums),
      intro: (params.intro || '').trim(),
      personalAdvantage: (params.personalAdvantage || '').trim(),
      specialties: Array.isArray(params.specialties) ? params.specialties.filter(Boolean) : [],
      valueAddedServices: Array.isArray(params.valueAddedServices) ? params.valueAddedServices.filter(Boolean) : [],
      socialLinks: {
        douyinQr: (params.douyinQr || '').trim(),
        xiaohongshuQr: (params.xiaohongshuQr || '').trim(),
        videoChannelQr: (params.videoChannelQr || '').trim()
      },
      images: {
        personalPhoto: (params.personalPhoto || '').trim(),
        teamPhoto: (params.teamPhoto || '').trim(),
        gallery: Array.isArray(params.gallery) ? params.gallery.filter(Boolean) : []
      }
    }

    if (!payload.name || !payload.company || !payload.phone || !payload.province || !payload.city) {
      return {
        errCode: 'user-account-co-invalid-agent-profile',
        errMsg: '请先填写完整基础信息'
      }
    }

    const now = Date.now()
    const { data } = await agentCollection.where({
      'claimerInfo.userId': uid,
      isDeleted: dbCmd.neq(true)
    }).limit(1).get()

    const current = data && data[0]
    const saveData = {
      ...payload,
      profileStatus: 'pending',
      isCertified: false,
      isDeleted: false,
      claimStatus: 'claimed',
      claimerInfo: {
        userId: uid,
        realName: user.nickname || user.username || '',
        phone: user.mobile || payload.phone,
        appliedAt: current?.claimerInfo?.appliedAt || now
      },
      stats: current?.stats || {
        ratingScore: 0,
        ratingCount: 0,
        topDimension: '',
        topScore: 0
      },
      dimensionScores: current?.dimensionScores || [],
      updateTime: now
    }

    let agentId = ''
    const isFirstCreate = !(current && current._id)
    if (!isFirstCreate) {
      agentId = current._id
      await agentCollection.doc(current._id).update(saveData)
    } else {
      const addRes = await agentCollection.add({
        ...saveData,
        createTime: now
      })
      agentId = addRes.id

      try {
        await issueNewAgentGiftActivationCode({ uid, agentId })
      } catch (_) {}
    }

    const nextRoles = uniqRoleList([...(user.role || []), 'agent'])
    await userCollection.doc(uid).update({
      role: nextRoles
    })

    await messageCollection.add({
      userId: uid,
      type: 'approval',
      title: '代理人档案已提交',
      content: '你的代理人档案已提交成功，等待管理员审核后将显示认证标识。',
      isRead: false,
      createTime: now
    })

    return {
      errCode: 0,
      errMsg: '',
      data: {
        agentId,
        role: nextRoles,
        profileStatus: 'pending',
        isCertified: false
      }
    }
  },

  async getAgentProfilesForAdmin (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const { data: userList } = await userCollection.doc(uid).get()
    const user = userList && userList[0]
    if (!user || !(user.role || []).includes('admin')) {
      return {
        errCode: 'user-account-co-no-admin-permission',
        errMsg: '仅管理员可操作'
      }
    }

    const { data } = await agentCollection.where({
      isDeleted: dbCmd.neq(true),
      profileStatus: 'pending'
    }).orderBy('updateTime', 'desc').get()
    return {
      errCode: 0,
      errMsg: '',
      data: data || []
    }
  },

  async reviewAgentProfile (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const { data: userList } = await userCollection.doc(uid).get()
    const user = userList && userList[0]
    if (!user || !(user.role || []).includes('admin')) {
      return {
        errCode: 'user-account-co-no-admin-permission',
        errMsg: '仅管理员可操作'
      }
    }

    const agentId = params.agentId || ''
    const approved = !!params.approved
    const reason = (params.reason || '').trim()
    if (!agentId) {
      return {
        errCode: 'user-account-co-invalid-agent-id',
        errMsg: '代理人ID不能为空'
      }
    }

    const { data } = await agentCollection.doc(agentId).get()
    const agent = data && data[0]
    if (!agent) {
      return {
        errCode: 'user-account-co-agent-not-found',
        errMsg: '代理人档案不存在'
      }
    }

    const reviewTime = Date.now()
    await agentCollection.doc(agentId).update({
      profileStatus: approved ? 'active' : 'draft',
      isCertified: approved,
      certificationInfo: approved ? {
        certifiedAt: reviewTime,
        certifiedBy: uid,
        reason: reason || '管理员审核通过'
      } : {
        certifiedBy: uid,
        reason: reason || '管理员驳回，请完善后重新提交'
      },
      updateTime: reviewTime
    })

    if (approved) {
      await agentCollection.doc(agentId).update({
        'claimerInfo.verifiedAt': reviewTime
      })
    }

    const applicantUid = agent?.claimerInfo?.userId
    if (applicantUid) {
      await messageCollection.add({
        userId: applicantUid,
        type: 'approval',
        title: approved ? '代理人认证审核通过' : '代理人档案审核未通过',
        content: approved
          ? '你的代理人档案已审核通过，认证标识已生效。'
          : '你的代理人档案未通过审核' + (reason ? `：${reason}` : '，请完善后重新提交。'),
        isRead: false,
        createTime: reviewTime
      })
    }

    return {
      errCode: 0,
      errMsg: '',
      data: {
        agentId,
        approved
      }
    }
  }
}
