const userModule = require('./lib/modules/user')
const favoriteModule = require('./lib/modules/favorite')
const historyModule = require('./lib/modules/history')
const agentModule = require('./lib/modules/agent')
const reviewModule = require('./lib/modules/review')
const messageModule = require('./lib/modules/message')
const passwordModule = require('./lib/modules/password')
const orderModule = require('./lib/modules/order')
const activationModule = require('./lib/modules/activation')
const teamModule = require('./lib/modules/team')
const spaStatsModule = require('./lib/modules/spa-stats')
const coinModule = require('./lib/modules/coin')

module.exports = {
  // 用户管理模块 (6个方法)
  async ensureDefaultUserRole () {
    return await userModule.ensureDefaultUserRole(this)
  },
  async updateCurrentProfile (params) {
    return await userModule.updateCurrentProfile(this, params)
  },
  async getReferralShareInfo () {
    return await userModule.getReferralShareInfo(this)
  },
  async checkPasswordSet () {
    return await userModule.checkPasswordSet(this)
  },
  async confirmCurrentMobileBySms (params) {
    return await userModule.confirmCurrentMobileBySms(this, params)
  },
  async checkWeixinBound () {
    return await userModule.checkWeixinBound(this)
  },

  // 收藏模块 (2个方法)
  async getFavoriteStatus (params) {
    return await favoriteModule.getFavoriteStatus(this, params)
  },
  async toggleFavorite (params) {
    return await favoriteModule.toggleFavorite(this, params)
  },

  // 历史模块 (2个方法)
  async upsertHistory (params) {
    return await historyModule.upsertHistory(this, params)
  },
  async getHistoryList () {
    return await historyModule.getHistoryList(this)
  },

  // 代理人档案模块 (4个方法)
  async getMyAgentProfile () {
    return await agentModule.getMyAgentProfile(this)
  },
  async saveAgentDraft (params) {
    return await agentModule.saveAgentDraft(this, params)
  },
  async submitAgentProfile (params) {
    return await agentModule.submitAgentProfile(this, params)
  },
  async getAgentProfilesForAdmin () {
    return await agentModule.getAgentProfilesForAdmin(this)
  },
  async reviewAgentProfile (params) {
    return await agentModule.reviewAgentProfile(this, params)
  },

  // 评价模块 (2个方法)
  async getAgentReviews (params) {
    return await reviewModule.getAgentReviews(this, params)
  },
  async submitReview (params) {
    return await reviewModule.submitReview(this, params)
  },

  // 消息公告模块 (6个方法)
  async seedCouponAndMessageTestData () {
    return await messageModule.seedCouponAndMessageTestData(this)
  },
  async clearCouponAndMessageTestData () {
    return await messageModule.clearCouponAndMessageTestData(this)
  },
  async publishAnnouncement (params) {
    return await messageModule.publishAnnouncement(this, params)
  },
  async getAnnouncementHistory () {
    return await messageModule.getAnnouncementHistory(this)
  },
  async publishTeamAnnouncement (params) {
    return await messageModule.publishTeamAnnouncement(this, params)
  },
  async getTeamAnnouncementHistory (params) {
    return await messageModule.getTeamAnnouncementHistory(this, params)
  },

  // 密码验证模块 (2个方法)
  async issueTestResetPwdCode (params) {
    return await passwordModule.issueTestResetPwdCode(this, params)
  },
  async resetPwdByMobileForTest (params) {
    return await passwordModule.resetPwdByMobileForTest(this, params)
  },

  // 订单模块 (6个方法)
  async listEnabledSkus () {
    return await orderModule.listEnabledSkus(this)
  },
  async createSkuOrder (params) {
    return await orderModule.createSkuOrder(this, params)
  },
  async requestVirtualPay (params) {
    return await orderModule.requestVirtualPay(this, params)
  },
  async listMyOrders (params) {
    return await orderModule.listMyOrders(this, params)
  },
  async getOrderDetail (params) {
    return await orderModule.getOrderDetail(this, params)
  },
  async cancelOrder (params) {
    return await orderModule.cancelOrder(this, params)
  },
  async adminListOrders (params) {
    return await orderModule.adminListOrders(this, params)
  },
  async adminGetOrderStats () {
    return await orderModule.adminGetOrderStats(this)
  },

  // 激活码模块 (6个方法)
  async listMyActivationCodes (params) {
    return await activationModule.listMyActivationCodes(this, params)
  },
  async redeemActivationCode (params) {
    return await activationModule.redeemActivationCode(this, params)
  },
  async getNewAgentGiftActivationCode (params) {
    return await activationModule.getNewAgentGiftActivationCode(this, params)
  },
  async findDuplicateActivationCodes (params) {
    return await activationModule.findDuplicateActivationCodes(this, params)
  },
  async cleanupDuplicateActivationCodes (params) {
    return await activationModule.cleanupDuplicateActivationCodes(this, params)
  },
  async reissueActivationCode (params) {
    return await activationModule.reissueActivationCode(this, params)
  },

  // 团队模块 (10个方法)
  async adminCreateTeam (params) {
    return await teamModule.adminCreateTeam(this, params)
  },
  async listMyTeams () {
    return await teamModule.listMyTeams(this)
  },
  async joinTeamByCode (params) {
    return await teamModule.joinTeamByCode(this, params)
  },
  async getMyTeamInfo () {
    return await teamModule.getMyTeamInfo(this)
  },
  async checkFeatureTeamAccess (params) {
    return await teamModule.checkFeatureTeamAccess(this, params)
  },
  async leaveMyTeam () {
    return await teamModule.leaveMyTeam(this)
  },
  async adminListTeamMembers (params) {
    return await teamModule.adminListTeamMembers(this, params)
  },
  async adminSetTeamLeader (params) {
    return await teamModule.adminSetTeamLeader(this, params)
  },
  async adminGetTeamFeatures (params) {
    return await teamModule.adminGetTeamFeatures(this, params)
  },
  async adminUpdateTeamFeatures (params) {
    return await teamModule.adminUpdateTeamFeatures(this, params)
  },

  // SPA统计模块 (2个方法)
  async adminGetSpaStatsForUser (params) {
    return await spaStatsModule.adminGetSpaStatsForUser(this, params)
  },
  async exportMySpaStatsExcel (params) {
    return await spaStatsModule.exportMySpaStatsExcel(this, params)
  },

  // 积分模块 (5个方法)
  async getMyCoinBalance () {
    return await coinModule.getMyCoinBalance(this)
  },
  async getMyCoinLogs (params) {
    return await coinModule.getMyCoinLogs(this, params)
  },
  async createCoinRechargeOrder (params) {
    return await coinModule.createCoinRechargeOrder(this, params)
  },
  async handleCoinRechargeSuccess (params) {
    return await coinModule.handleCoinRechargeSuccess(this, params)
  },
  async adminGrantCoins (params) {
    return await coinModule.adminGrantCoins(this, params)
  }
}
