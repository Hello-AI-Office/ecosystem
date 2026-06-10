const { getCurrentUid } = require('../common/auth')
const { teamCollection, teamMemberCollection, userCollection, dbCmd, db } = require('../common/db')

module.exports = {
  async adminCreateTeam (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const { data: users } = await userCollection.where({ _id: uid }).field({ role: true }).limit(1).get()
    const roles = (users && users[0] && Array.isArray(users[0].role)) ? users[0].role : []
    const isAdmin = roles.includes('admin')

    if (!isAdmin) {
      return {
        errCode: 'permission-denied',
        errMsg: '无权限'
      }
    }

    const name = String(params.name || '').trim()
    const status = String(params.status || 'enabled')
    const remark = String(params.remark || '').trim()
    const leaderUserId = String(params.leaderUserId || '').trim()

    if (!name) {
      return {
        errCode: 'invalid-params',
        errMsg: '团队名称不能为空'
      }
    }

    if (!leaderUserId) {
      return {
        errCode: 'invalid-params',
        errMsg: '请选择团队长'
      }
    }

    const nameExists = await teamCollection.where({ 
      name, 
      status: dbCmd.neq('archived') 
    }).limit(1).get()

    if (nameExists?.data && nameExists.data.length > 0) {
      return {
        errCode: 'team-name-exists',
        errMsg: '团队名称已存在'
      }
    }

    const userInTeam = await teamMemberCollection.where({
      userId: leaderUserId,
      status: 'joined'
    }).limit(1).get()

    if (userInTeam?.data && userInTeam.data.length > 0) {
      return {
        errCode: 'user-already-in-team',
        errMsg: '该用户已加入其他团队'
      }
    }

    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const genCode = () => {
      let out = ''
      for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
      return out
    }

    let teamCode = genCode()
    for (let i = 0; i < 5; i++) {
      const exists = await teamCollection.where({ teamCode }).limit(1).get()
      const has = (exists?.data || []).length > 0
      if (!has) break
      teamCode = genCode()
    }

    const now = Date.now()

    const teamRes = await teamCollection.add({
      name,
      status,
      remark: remark || undefined,
      teamCode,
      leaderUserId,
      createTime: now,
      updateTime: now
    })

    const teamId = String(
      teamRes.id || 
      teamRes._id || 
      teamRes.result?.id || 
      teamRes.result?._id ||
      teamRes.inserted?.id ||
      ''
    ).trim()

    if (!teamId) {
      return {
        errCode: 'create-team-failed',
        errMsg: '团队ID获取失败'
      }
    }

    await teamMemberCollection.add({
      userId: leaderUserId,
      teamId,
      role: 'leader',
      status: 'joined',
      joinTime: now,
      updateTime: now
    })

    try {
      await db.collection('message').add({
        userId: leaderUserId,
        type: 'system',
        title: '您已成为团队长',
        content: `恭喜！您已被设置为「${name}」的团队长。您可以通过"我的团队"页面管理团队成员和配置团队技能。团队码：${teamCode}`,
        linkUrl: '/pages/my/team',
        isRead: false,
        createTime: now
      })
    } catch (msgError) {
      console.error('发送消息失败:', msgError)
    }

    return {
      errCode: 0,
      errMsg: '创建成功',
      data: {
        teamId,
        teamCode
      }
    }
  },

  async listMyTeams (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const links = await teamMemberCollection.where({
      userId: uid,
      status: 'joined'
    }).orderBy('joinTime', 'desc').limit(200).get()

    const teamIds = (links?.data || []).map(x => String(x?.teamId || '').trim()).filter(Boolean)
    if (!teamIds.length) {
      return {
        errCode: 0,
        errMsg: '',
        data: []
      }
    }

    const teamsRes = await teamCollection.where({
      _id: dbCmd.in(teamIds)
    }).field({
      name: true,
      status: true,
      remark: true,
      teamCode: true,
      createTime: true
    }).limit(200).get()

    const teams = (teamsRes?.data || []).map(t => ({
      _id: t._id,
      name: t.name,
      status: t.status,
      remark: t.remark,
      teamCode: t.teamCode,
      createTime: t.createTime
    }))

    const map = new Map(teams.map(t => [String(t._id), t]))
    const sorted = teamIds.map(id => map.get(String(id))).filter(Boolean)

    return {
      errCode: 0,
      errMsg: '',
      data: sorted
    }
  },

  async joinTeamByCode (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const teamCode = String(params.teamCode || '').trim().toUpperCase()
    if (!teamCode || teamCode.length < 4) {
      return {
        errCode: 'user-account-co-invalid-team-code',
        errMsg: '团队码格式不正确'
      }
    }

    const teamRes = await teamCollection.where({
      teamCode,
      status: 'enabled'
    }).limit(1).get()

    const team = teamRes?.data && teamRes.data[0]
    if (!team) {
      return {
        errCode: 'user-account-co-team-not-found',
        errMsg: '团队不存在或已停用'
      }
    }

    const existRes = await teamMemberCollection.where({
      userId: uid,
      teamId: team._id,
      status: 'joined'
    }).limit(1).get()

    if (existRes?.data && existRes.data.length) {
      return {
        errCode: 0,
        errMsg: '你已加入该团队',
        data: { teamId: team._id }
      }
    }

    const now = Date.now()

    await teamMemberCollection.add({
      userId: uid,
      teamId: team._id,
      status: 'joined',
      joinTime: now,
      updateTime: now
    })

    return {
      errCode: 0,
      errMsg: '加入成功',
      data: { teamId: team._id }
    }
  },

  async getMyTeamInfo (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const memberRes = await teamMemberCollection.where({
      userId: uid,
      status: 'joined'
    }).orderBy('joinTime', 'desc').limit(1).get()

    const membership = memberRes?.data && memberRes.data[0]
    if (!membership) {
      return {
        errCode: 0,
        errMsg: '',
        data: null
      }
    }

    const teamRes = await teamCollection.doc(membership.teamId).get()
    const team = teamRes?.data && teamRes.data[0]

    if (!team || team.status === 'archived') {
      return {
        errCode: 0,
        errMsg: '',
        data: null
      }
    }

    const countRes = await teamMemberCollection.where({
      teamId: team._id,
      status: 'joined'
    }).count()

    const memberCount = countRes?.total || 0
    const features = Array.isArray(team.availableFeatures) ? team.availableFeatures : []
    const featurePricing = team.featurePricing || {}

    return {
      errCode: 0,
      errMsg: '',
      data: {
        team: {
          _id: team._id,
          name: team.name,
          teamCode: team.teamCode,
          status: team.status,
          availableFeatures: features,
          featurePricing: featurePricing,
          leaderCanSetPrice: team.leaderCanSetPrice === true
        },
        membership: {
          _id: membership._id,
          role: membership.role || 'member',
          joinTime: membership.joinTime
        },
        memberCount,
        featureCount: features.length
      }
    }
  },

  async checkFeatureTeamAccess (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const featureCode = String(params.featureCode || '').trim()
    if (!featureCode) {
      return {
        errCode: 'invalid-feature-code',
        errMsg: '技能代码不能为空'
      }
    }

    const memberRes = await teamMemberCollection.where({
      userId: uid,
      status: 'joined'
    }).limit(1).get()

    const membership = memberRes?.data && memberRes.data[0]
    if (!membership) {
      return {
        errCode: 0,
        errMsg: '',
        hasAccess: false,
        reason: 'not_in_any_team'
      }
    }

    const teamRes = await teamCollection.doc(membership.teamId).get()
    const team = teamRes?.data && teamRes.data[0]

    if (!team || team.status === 'archived') {
      return {
        errCode: 0,
        errMsg: '',
        hasAccess: false,
        reason: 'not_in_any_team'
      }
    }

    const features = Array.isArray(team.availableFeatures) ? team.availableFeatures : []
    const hasFeature = features.includes(featureCode)

    return {
      errCode: 0,
      errMsg: '',
      hasAccess: hasFeature,
      reason: hasFeature ? '' : 'team_no_permission',
      teamId: team._id,
      teamName: team.name
    }
  },

  async leaveMyTeam (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const memberRes = await teamMemberCollection.where({
      userId: uid,
      status: 'joined'
    }).limit(1).get()

    const membership = memberRes?.data && memberRes.data[0]
    if (!membership) {
      return {
        errCode: 'user-account-co-not-in-team',
        errMsg: '你还未加入团队'
      }
    }

    await teamMemberCollection.doc(membership._id).update({
      status: 'left'
    })

    return {
      errCode: 0,
      errMsg: '已退出团队'
    }
  },

  async adminListTeamMembers (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const teamId = String(params.teamId || '').trim()
    if (!teamId) {
      return {
        errCode: 'admin-invalid-team-id',
        errMsg: '团队ID不能为空'
      }
    }

    const { data: users } = await userCollection.where({
      _id: uid
    }).field({ role: true }).limit(1).get()

    const roles = (users && users[0] && Array.isArray(users[0].role)) ? users[0].role : []
    const isAdmin = roles.includes('admin')

    if (!isAdmin) {
      const membershipRes = await teamMemberCollection.where({
        userId: uid,
        teamId,
        status: 'joined',
        role: 'leader'
      }).limit(1).get()

      const isLeader = membershipRes?.data && membershipRes.data.length > 0

      if (!isLeader) {
        return {
          errCode: 'permission-denied',
          errMsg: '无权限'
        }
      }
    }

    const links = await teamMemberCollection.where({
      teamId,
      status: 'joined'
    }).orderBy('joinTime', 'asc').limit(500).get()

    const linkData = links?.data || []
    if (!linkData.length) {
      return { errCode: 0, errMsg: '', data: [] }
    }

    const userIds = linkData.map(x => String(x?.userId || '').trim()).filter(Boolean)
    const linkMap = new Map(linkData.map(link => [String(link.userId), link]))

    const uRes = await userCollection.where({ _id: dbCmd.in(userIds) }).field({
      _id: true,
      nickname: true,
      username: true,
      mobile: true
    }).limit(500).get()

    const uMap = new Map((uRes?.data || []).map(u => [String(u._id), u]))

    const maskMobile = (m) => {
      const s = String(m || '').trim()
      if (s.length < 7) return s
      return `${s.slice(0,3)}****${s.slice(-4)}`
    }

    const out = userIds.map(id => {
      const u = uMap.get(String(id)) || {}
      const link = linkMap.get(String(id)) || {}
      const nickname = String(u.nickname || '').trim()
      const mobile = String(u.mobile || '').trim()
      const displayName = nickname || (mobile ? maskMobile(mobile) : String(id).slice(0, 6))
      return {
        userId: id,
        displayName,
        nickname,
        mobileMasked: mobile ? maskMobile(mobile) : '',
        role: String(link.role || 'member')
      }
    })

    return { errCode: 0, errMsg: '', data: out }
  },

  async adminSetTeamLeader (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const teamId = String(params.teamId || '').trim()
    const leaderUserId = String(params.leaderUserId || '').trim()

    if (!teamId || !leaderUserId) {
      return {
        errCode: 'admin-invalid-params',
        errMsg: '参数不完整'
      }
    }

    const { data: users } = await userCollection.where({ _id: uid }).field({ role: true }).limit(1).get()
    const roles = (users && users[0] && Array.isArray(users[0].role)) ? users[0].role : []
    const isAdmin = roles.includes('admin')

    if (!isAdmin) {
      return {
        errCode: 'permission-denied',
        errMsg: '无权限'
      }
    }

    await teamMemberCollection.where({
      teamId,
      status: 'joined'
    }).update({
      role: 'member'
    })

    await teamMemberCollection.where({
      teamId,
      userId: leaderUserId,
      status: 'joined'
    }).update({
      role: 'leader'
    })

    await teamCollection.doc(teamId).update({
      leaderUserId,
      updateTime: Date.now()
    })

    return {
      errCode: 0,
      errMsg: '设置成功'
    }
  },

  async adminGetTeamFeatures (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const teamId = String(params.teamId || '').trim()
    if (!teamId) {
      return {
        errCode: 'admin-invalid-team-id',
        errMsg: '团队ID不能为空'
      }
    }

    const { data: users } = await userCollection.where({ _id: uid }).field({ role: true }).limit(1).get()
    const roles = (users && users[0] && Array.isArray(users[0].role)) ? users[0].role : []
    const isAdmin = roles.includes('admin')

    let isLeader = false
    let isMember = false

    if (!isAdmin) {
      const membershipRes = await teamMemberCollection.where({
        userId: uid,
        teamId,
        status: 'joined'
      }).limit(1).get()

      const membership = membershipRes?.data && membershipRes.data[0]
      
      if (membership) {
        isMember = true
        isLeader = membership.role === 'leader'
      }
    }

    const teamRes = await teamCollection.doc(teamId).get()
    const team = teamRes?.data && teamRes.data[0]

    if (!team) {
      return {
        errCode: 'team-not-found',
        errMsg: '团队不存在'
      }
    }

    return {
      errCode: 0,
      errMsg: '',
      data: {
        availableFeatures: Array.isArray(team.availableFeatures) ? team.availableFeatures : [],
        featurePricing: team.featurePricing || {},
        canEdit: isAdmin || isLeader,
        isAdmin,
        isLeader,
        isMember
      }
    }
  },

  async adminUpdateTeamFeatures (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const teamId = String(params.teamId || '').trim()
    if (!teamId) {
      return {
        errCode: 'admin-invalid-team-id',
        errMsg: '团队ID不能为空'
      }
    }

    const { data: users } = await userCollection.where({ _id: uid }).field({ role: true }).limit(1).get()
    const roles = (users && users[0] && Array.isArray(users[0].role)) ? users[0].role : []
    const isAdmin = roles.includes('admin')

    if (!isAdmin) {
      const membershipRes = await teamMemberCollection.where({
        userId: uid,
        teamId,
        status: 'joined',
        role: 'leader'
      }).limit(1).get()

      const isLeader = membershipRes?.data && membershipRes.data.length > 0

      if (!isLeader) {
        return {
          errCode: 'permission-denied',
          errMsg: '无权限'
        }
      }
    }

    const availableFeatures = Array.isArray(params.availableFeatures) ? params.availableFeatures : []
    const featurePricing = params.featurePricing || {}

    const updateData = {
      availableFeatures,
      updateTime: Date.now()
    }

    if (Object.keys(featurePricing).length > 0) {
      updateData.featurePricing = featurePricing
    }

    await teamCollection.doc(teamId).update(updateData)

    return {
      errCode: 0,
      errMsg: '保存成功'
    }
  }
}
