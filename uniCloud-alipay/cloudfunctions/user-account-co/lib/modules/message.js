const { getCurrentUid } = require('../common/auth')
const { messageCollection, couponCollection, announcementCollection, userCollection, teamCollection, teamMemberCollection } = require('../common/db')
const { daysFromNow } = require('../common/utils')

module.exports = {
  async seedCouponAndMessageTestData (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    await couponCollection.where({ userId: uid }).remove()
    await messageCollection.where({ userId: uid }).remove()

    await couponCollection.add([
      {
        userId: uid,
        title: '首单立减券',
        description: '用于首次咨询或首次服务下单时直接抵扣',
        type: 'cash',
        value: 50,
        minSpend: 199,
        applicableScope: { type: 'all' },
        validFrom: Date.now(),
        validTo: daysFromNow(15),
        status: 'active',
        source: { type: 'register', description: '注册欢迎礼' }
      },
      {
        userId: uid,
        title: '服务体验券',
        description: '可用于平台指定咨询服务一次',
        type: 'service',
        value: 1,
        applicableScope: { type: 'service', serviceType: '保险咨询' },
        validFrom: Date.now(),
        validTo: daysFromNow(30),
        status: 'active',
        source: { type: 'promotion', description: '春季活动发放' }
      },
      {
        userId: uid,
        title: '推荐奖励折扣券',
        description: '推荐成功后可享受咨询服务折扣',
        type: 'discount',
        value: 85,
        minSpend: 299,
        applicableScope: { type: 'all' },
        validFrom: daysFromNow(-10),
        validTo: daysFromNow(10),
        status: 'used',
        source: { type: 'recommend', description: '推荐奖励' },
        usage: {
          usedAt: daysFromNow(-2),
          usedFor: '家庭保障咨询'
        }
      },
      {
        userId: uid,
        title: '限时礼券',
        description: '活动期间领取，已过有效期',
        type: 'gift',
        value: 1,
        applicableScope: { type: 'all' },
        validFrom: daysFromNow(-20),
        validTo: daysFromNow(-1),
        status: 'expired',
        source: { type: 'system', description: '系统补偿礼包' }
      }
    ])

    await messageCollection.add([
      {
        userId: uid,
        type: 'system',
        title: '欢迎来到选赏',
        content: '你的账号已经创建成功，后续平台通知、奖励发放都会在这里提醒你。',
        isRead: false,
        createTime: Date.now() - 1000 * 60 * 20
      },
      {
        userId: uid,
        type: 'coupon',
        title: '你收到一张首单立减券',
        content: '注册欢迎礼已发放到你的卡包，可前往卡包页面查看并使用。',
        linkUrl: '/pages/coupon/list',
        isRead: false,
        createTime: Date.now() - 1000 * 60 * 50
      },
      {
        userId: uid,
        type: 'recommendation',
        title: '推荐奖励已到账',
        content: '你推荐的代理人信息已通过审核，对应奖励券已发放，请查收。',
        linkUrl: '/pages/coupon/list',
        isRead: true,
        readAt: Date.now() - 1000 * 60 * 60,
        createTime: Date.now() - 1000 * 60 * 90
      },
      {
        userId: uid,
        type: 'approval',
        title: '推荐审批结果通知',
        content: '你提交的一条代理人推荐已审核通过，感谢你的参与。',
        isRead: true,
        readAt: Date.now() - 1000 * 60 * 60 * 6,
        createTime: Date.now() - 1000 * 60 * 60 * 8
      },
      {
        userId: uid,
        type: 'announcement',
        title: '平台公告：服务升级提醒',
        content: '本周将上线更多代理人档案完善能力，欢迎持续体验。',
        isRead: false,
        createTime: Date.now() - 1000 * 60 * 60 * 18
      }
    ])

    return {
      errCode: 0,
      errMsg: '',
      couponCount: 4,
      messageCount: 5
    }
  },

  async clearCouponAndMessageTestData (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    await couponCollection.where({ userId: uid }).remove()
    await messageCollection.where({ userId: uid }).remove()

    return {
      errCode: 0,
      errMsg: ''
    }
  },

  async publishAnnouncement (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const { data: userList } = await userCollection.doc(uid).get()
    const currentUser = userList && userList[0]
    if (!currentUser || !(currentUser.role || []).includes('admin')) {
      return {
        errCode: 'user-account-co-no-admin-permission',
        errMsg: '仅管理员可操作'
      }
    }

    const title = (params.title || '').trim()
    const content = (params.content || '').trim()
    const linkUrl = (params.linkUrl || '').trim()

    if (!title) {
      return {
        errCode: 'user-account-co-invalid-announcement-title',
        errMsg: '公告标题不能为空'
      }
    }

    if (!content) {
      return {
        errCode: 'user-account-co-invalid-announcement-content',
        errMsg: '公告内容不能为空'
      }
    }

    const { data: users } = await userCollection.get()
    const now = Date.now()
    const targetUsers = (users || [])
      .filter(item => item && item._id)
      .map(item => ({ _id: item._id }))

    const announcementRes = await announcementCollection.add({
      title,
      content,
      type: 'system',
      targetRoles: [],
      targetUsers: [],
      isPublished: true,
      publishAt: now,
      publisherId: uid,
      publisherName: currentUser.nickname || currentUser.username || '管理员',
      priority: 0,
      isPinned: false,
      linkUrl: linkUrl || '',
      isDeleted: false,
      createTime: now,
      updateTime: now
    })

    const announcementId = announcementRes.id

    if (!targetUsers.length) {
      return {
        errCode: 0,
        errMsg: '',
        sentCount: 0,
        announcementId
      }
    }

    await Promise.all(targetUsers.map(user => messageCollection.add({
      userId: user._id,
      type: 'announcement',
      title,
      content,
      relatedData: {
        announcementId
      },
      linkUrl: linkUrl || undefined,
      isRead: false,
      createTime: now,
      updateTime: now,
      senderId: uid,
      senderName: currentUser.nickname || currentUser.username || '管理员'
    })))

    return {
      errCode: 0,
      errMsg: '',
      sentCount: targetUsers.length,
      announcementId
    }
  },

  async getAnnouncementHistory (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const { data: userList } = await userCollection.doc(uid).get()
    const currentUser = userList && userList[0]
    if (!currentUser || !(currentUser.role || []).includes('admin')) {
      return {
        errCode: 'user-account-co-no-admin-permission',
        errMsg: '仅管理员可操作'
      }
    }

    const { data } = await announcementCollection.where({
      isDeleted: false
    }).orderBy('publishAt', 'desc').get()

    return {
      errCode: 0,
      errMsg: '',
      data: data || []
    }
  },

  async publishTeamAnnouncement (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const teamId = String(params.teamId || '').trim()
    const title = String(params.title || '').trim()
    const content = String(params.content || '').trim()
    const linkUrl = String(params.linkUrl || '').trim()

    if (!teamId) {
      return {
        errCode: 'invalid-team-id',
        errMsg: '团队ID不能为空'
      }
    }

    if (!title) {
      return {
        errCode: 'invalid-title',
        errMsg: '公告标题不能为空'
      }
    }

    if (!content) {
      return {
        errCode: 'invalid-content',
        errMsg: '公告内容不能为空'
      }
    }

    const { data: userList } = await userCollection.doc(uid).get()
    const currentUser = userList && userList[0]
    if (!currentUser) {
      return {
        errCode: 'user-not-found',
        errMsg: '用户不存在'
      }
    }

    const isAdmin = (currentUser.role || []).includes('admin')

    const { data: teams } = await teamCollection.doc(teamId).get()
    const team = teams && teams[0]
    
    if (!team) {
      return {
        errCode: 'team-not-found',
        errMsg: '团队不存在'
      }
    }

    if (!isAdmin) {
      const { data: memberships } = await teamMemberCollection.where({
        userId: uid,
        teamId,
        status: 'joined',
        role: 'leader'
      }).limit(1).get()

      const isLeader = memberships && memberships.length > 0

      if (!isLeader) {
        return {
          errCode: 'permission-denied',
          errMsg: '仅团队长或管理员可发送团队公告'
        }
      }
    }

    const { data: members } = await teamMemberCollection.where({
      teamId,
      status: 'joined'
    }).get()

    const targetUserIds = (members || []).map(m => m.userId).filter(Boolean)

    if (!targetUserIds.length) {
      return {
        errCode: 0,
        errMsg: '',
        sentCount: 0
      }
    }

    const now = Date.now()

    const announcementRes = await announcementCollection.add({
      title,
      content,
      type: 'team',
      targetTeamId: teamId,
      targetTeamName: team.name,
      isPublished: true,
      publishAt: now,
      publisherId: uid,
      publisherName: currentUser.nickname || currentUser.username || '管理员',
      priority: 0,
      isPinned: false,
      linkUrl: linkUrl || '',
      isDeleted: false,
      createTime: now,
      updateTime: now
    })

    const announcementId = announcementRes.id

    await Promise.all(targetUserIds.map(userId => messageCollection.add({
      userId,
      type: 'team_announcement',
      title: `【${team.name}】${title}`,
      content,
      relatedData: {
        announcementId,
        teamId,
        teamName: team.name
      },
      linkUrl: linkUrl || undefined,
      isRead: false,
      createTime: now,
      updateTime: now,
      senderId: uid,
      senderName: currentUser.nickname || currentUser.username || '团队长'
    })))

    return {
      errCode: 0,
      errMsg: '',
      sentCount: targetUserIds.length,
      announcementId
    }
  },

  async getTeamAnnouncementHistory (context, params = {}) {
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
        errCode: 'invalid-team-id',
        errMsg: '团队ID不能为空'
      }
    }

    const { data: userList } = await userCollection.doc(uid).get()
    const currentUser = userList && userList[0]
    if (!currentUser) {
      return {
        errCode: 'user-not-found',
        errMsg: '用户不存在'
      }
    }

    const isAdmin = (currentUser.role || []).includes('admin')

    if (!isAdmin) {
      const db = require('uniCloud').database()
      const teamMemberCollection = db.collection('xuanshang-team-members')
      
      const { data: memberships } = await teamMemberCollection.where({
        userId: uid,
        teamId,
        status: 'joined',
        role: 'leader'
      }).limit(1).get()

      const isLeader = memberships && memberships.length > 0

      if (!isLeader) {
        return {
          errCode: 'permission-denied',
          errMsg: '仅团队长或管理员可查看团队公告历史'
        }
      }
    }

    const { data } = await announcementCollection.where({
      targetTeamId: teamId,
      isDeleted: false
    }).orderBy('publishAt', 'desc').limit(50).get()

    return {
      errCode: 0,
      errMsg: '',
      data: data || []
    }
  }
}
