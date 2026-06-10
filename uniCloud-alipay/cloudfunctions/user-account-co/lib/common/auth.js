const uniID = require('uni-id-common')

async function getCurrentUid (context) {
  try {
    const clientInfo = context.getClientInfo()
    const token = context.getUniIdToken()
    if (!token) {
      return ''
    }

    const uniIdIns = uniID.createInstance({ clientInfo })
    const tokenRes = await uniIdIns.checkToken(token)
    return tokenRes && tokenRes.uid ? tokenRes.uid : ''
  } catch (error) {
    return ''
  }
}

module.exports = {
  getCurrentUid
}
