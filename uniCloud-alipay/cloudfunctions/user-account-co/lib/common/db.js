const db = uniCloud.database()
const dbCmd = db.command

const userCollection = db.collection('uni-id-users')
const verifyCollection = db.collection('opendb-verify-codes')
const favoriteCollection = db.collection('favorite')
const historyCollection = db.collection('history')
const reviewCollection = db.collection('review')
const couponCollection = db.collection('coupon')
const messageCollection = db.collection('message')
const announcementCollection = db.collection('announcement')
const agentCollection = db.collection('agent')

const activationCodeCollection = db.collection('xuanshang-activation-codes')
const codeRedeemCollection = db.collection('xuanshang-code-redeems')
const userFeatureCollection = db.collection('xuanshang-user-features')
const featureCollection = db.collection('xuanshang-features')
const settingsCollection = db.collection('xuanshang-settings')
const teamCollection = db.collection('xuanshang-teams')
const teamMemberCollection = db.collection('xuanshang-team-members')
const skuCollection = db.collection('xuanshang-skus')
const orderCollection = db.collection('xuanshang-orders')
const coinCollection = db.collection('xuanshang-coins')
const coinLogCollection = db.collection('xuanshang-coin-logs')

const cusTable = db.collection('spa-cus')
const logTable = db.collection('spa-log')

module.exports = {
  db,
  dbCmd,
  userCollection,
  verifyCollection,
  favoriteCollection,
  historyCollection,
  reviewCollection,
  couponCollection,
  messageCollection,
  announcementCollection,
  agentCollection,
  activationCodeCollection,
  codeRedeemCollection,
  userFeatureCollection,
  featureCollection,
  settingsCollection,
  teamCollection,
  teamMemberCollection,
  skuCollection,
  orderCollection,
  coinCollection,
  coinLogCollection,
  cusTable,
  logTable
}
