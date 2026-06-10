const uniID = require('uni-id-common')
const { getCurrentUid } = require('../common/auth')
const { userCollection, verifyCollection, dbCmd } = require('../common/db')
const { uniqRoleList, generateInviteCode } = require('../common/utils')

const SMS_SCENE_BIND_MOBILE = 'bind-mobile-by-sms'

module.exports = {
  async ensureDefaultUserRole (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const { data } = await userCollection.doc(uid).get()
    const user = data && data[0]
    if (!user) {
      return {
        errCode: 'uni-id-account-not-exists',
        errMsg: '用户不存在'
      }
    }

    const roles = uniqRoleList(user.role || [])
    if (!roles.length) {
      roles.push('user')
      await userCollection.doc(uid).update({
        role: roles
      })
    }

    return {
      errCode: 0,
      errMsg: '',
      data: {
        uid,
        role: roles
      }
    }
  },

  async updateCurrentProfile (context, params = {}) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const nickname = String(params.nickname || '').trim()
    if (!nickname) {
      return {
        errCode: 'user-account-co-invalid-nickname',
        errMsg: '昵称不能为空'
      }
    }

    await userCollection.doc(uid).update({
      nickname
    })

    return {
      errCode: 0,
      errMsg: '',
      data: {
        nickname
      }
    }
  },

  async getReferralShareInfo (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const { data } = await userCollection.doc(uid).get()
    const user = data && data[0]
    if (!user) {
      return {
        errCode: 'uni-id-account-not-exists',
        errMsg: '用户不存在'
      }
    }

    let inviteCode = user.my_invite_code || ''
    if (!inviteCode) {
      inviteCode = generateInviteCode()
      for (let i = 0; i < 8; i++) {
        const { total } = await userCollection.where({ my_invite_code: inviteCode }).count()
        if (!total) {
          break
        }
        inviteCode = generateInviteCode()
      }

      await userCollection.doc(uid).update({
        my_invite_code: inviteCode
      })
    }

    return {
      errCode: 0,
      errMsg: '',
      uid,
      inviteCode,
      nickname: user.nickname || user.username || user.mobile || '好友'
    }
  },

  async checkPasswordSet (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const { data: users } = await userCollection.doc(uid).field({
      password: true
    }).get()

    const user = users && users[0]
    if (!user) {
      return {
        errCode: 'uni-id-account-not-exists',
        errMsg: '用户不存在'
      }
    }

    const hasPassword = !!(user.password && String(user.password).trim())

    return {
      errCode: 0,
      errMsg: '',
      hasPassword
    }
  },

  async confirmCurrentMobileBySms (context, params = {}) {
    const { mobile, code } = params

    if (!mobile || !/^1\d{10}$/.test(mobile)) {
      return {
        errCode: 'user-account-co-invalid-mobile',
        errMsg: '手机号格式不正确'
      }
    }

    if (!code || !/^\d{6}$/.test(code)) {
      return {
        errCode: 'user-account-co-invalid-code',
        errMsg: '验证码格式不正确'
      }
    }

    const clientInfo = context.getClientInfo()
    const token = context.getUniIdToken()
    if (!token) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const uniIdIns = uniID.createInstance({ clientInfo })
    const tokenRes = await uniIdIns.checkToken(token)
    if (!tokenRes || !tokenRes.uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const uid = tokenRes.uid
    const { data: users } = await userCollection.doc(uid).get()
    const user = users && users[0]
    if (!user) {
      return {
        errCode: 'uni-id-account-not-exists',
        errMsg: '用户不存在'
      }
    }

    if (user.mobile && user.mobile !== mobile) {
      return {
        errCode: 'user-account-co-mobile-mismatch',
        errMsg: '当前账号已绑定其他手机号'
      }
    }

    const { data: codeRecords } = await verifyCollection.where({
      mobile,
      scene: SMS_SCENE_BIND_MOBILE,
      code,
      state: 0,
      expired_date: dbCmd.gt(Date.now())
    }).limit(1).get()

    if (!codeRecords.length) {
      return {
        errCode: 'uni-id-mobile-verify-code-error',
        errMsg: '验证码错误或已过期'
      }
    }

    await verifyCollection.doc(codeRecords[0]._id).update({
      state: 1
    })

    await userCollection.doc(uid).update({
      mobile_confirmed: 1,
      mobile
    })

    return {
      errCode: 0,
      errMsg: '手机号验证成功',
      mobile,
      mobile_confirmed: 1
    }
  },

  async checkWeixinBound (context) {
    const uid = await getCurrentUid(context)
    if (!uid) {
      return {
        errCode: 'uni-id-check-token-failed',
        errMsg: '登录状态失效，请重新登录'
      }
    }

    const { data: users } = await userCollection.doc(uid).field({
      wx_openid: true
    }).get()

    const user = users && users[0]
    if (!user) {
      return {
        errCode: 'uni-id-account-not-exists',
        errMsg: '用户不存在'
      }
    }

    const wxOpenid = user.wx_openid
    let isBound = false

    if (wxOpenid && typeof wxOpenid === 'object') {
      isBound = !!(wxOpenid.mp || wxOpenid['mp-weixin'] || wxOpenid['mp-weixin-oa'])
    } else if (typeof wxOpenid === 'string' && wxOpenid.trim()) {
      isBound = true
    }

    return {
      errCode: 0,
      errMsg: '',
      isBound
    }
  }
}
