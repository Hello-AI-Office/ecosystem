const { userCollection, verifyCollection, dbCmd } = require('../common/db')

const SMS_SCENE_RESET_PWD = 'reset-pwd-by-sms'

module.exports = {
  async issueTestResetPwdCode (context, params = {}) {
    const { mobile } = params

    if (!mobile || !/^1\d{10}$/.test(mobile)) {
      return {
        errCode: 'user-account-co-invalid-mobile',
        errMsg: '手机号格式不正确'
      }
    }

    await verifyCollection.where({
      mobile,
      scene: SMS_SCENE_RESET_PWD,
      state: 0
    }).remove()

    await verifyCollection.add({
      mobile,
      code: '123456',
      scene: SMS_SCENE_RESET_PWD,
      state: 0,
      expired_date: Date.now() + 10 * 60 * 1000,
      created_at: Date.now()
    })

    return {
      errCode: 0,
      errMsg: '',
      code: '123456'
    }
  },

  async resetPwdByMobileForTest (context, params = {}) {
    const { mobile, code, password } = params

    if (!mobile || !/^1\d{10}$/.test(mobile)) {
      return {
        errCode: 'user-account-co-invalid-mobile',
        errMsg: '手机号格式不正确'
      }
    }

    if (!code || code !== '123456') {
      return {
        errCode: 'uni-id-mobile-verify-code-error',
        errMsg: '手机号验证码错误或已过期'
      }
    }

    if (!password || password.length < 6 || password.length > 20) {
      return {
        errCode: 'user-account-co-invalid-password',
        errMsg: '密码长度需为6-20位'
      }
    }

    const { data: verifyRecords } = await verifyCollection.where({
      mobile,
      code,
      scene: SMS_SCENE_RESET_PWD,
      state: 0,
      expired_date: dbCmd.gt(Date.now())
    }).limit(1).get()

    if (!verifyRecords.length) {
      return {
        errCode: 'uni-id-mobile-verify-code-error',
        errMsg: '手机号验证码错误或已过期'
      }
    }

    const { data: users } = await userCollection.where({ mobile }).limit(1).get()
    const user = users && users[0]
    if (!user) {
      return {
        errCode: 'uni-id-account-not-exists',
        errMsg: '账号未注册'
      }
    }

    const clientInfo = context.getClientInfo()
    const createConfig = require('uni-config-center')
    const PasswordUtils = require('../../../uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/lib/utils/password')
    const uniIdConfig = createConfig({
      pluginId: 'uni-id'
    })
    const passwordSecret = uniIdConfig.config().passwordSecret
    const {
      passwordHash,
      version
    } = new PasswordUtils({
      clientInfo,
      passwordSecret
    }).generatePasswordHash({
      password
    })

    await userCollection.doc(user._id).update({
      password: passwordHash,
      password_secret_version: version,
      valid_token_date: Date.now()
    })

    await verifyCollection.doc(verifyRecords[0]._id).update({
      state: 1
    })

    return {
      errCode: 0,
      errMsg: ''
    }
  }
}
