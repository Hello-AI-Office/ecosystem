"use strict";
const common_vendor = require("../common/vendor.js");
const api_auth = require("../api/auth.js");
const utils_auth = require("../utils/auth.js");
function usePhoneLogin(options = {}) {
  const logging = common_vendor.ref(false);
  function getLoginCode() {
    return new Promise((resolve, reject) => {
      common_vendor.index.login({
        provider: "weixin",
        success: (res) => resolve(res.code),
        fail: () => reject(new Error("获取微信登录凭证失败"))
      });
    });
  }
  async function onGetPhoneNumber(e) {
    var _a;
    const phoneCode = e.detail.code;
    if (!phoneCode)
      return;
    if (logging.value)
      return;
    logging.value = true;
    common_vendor.index.showLoading({ title: "登录中...", mask: true });
    try {
      const loginCode = await getLoginCode();
      const { token, user } = await api_auth.loginByPhone({
        loginCode,
        phoneCode,
        pid: utils_auth.getLockedPid()
      });
      utils_auth.setToken(token);
      utils_auth.setUserInfo(user);
      (_a = options.onSuccess) == null ? void 0 : _a.call(options);
    } catch (err) {
      common_vendor.index.showToast({
        title: err instanceof Error ? err.message : "登录失败，请重试",
        icon: "none"
      });
    } finally {
      common_vendor.index.hideLoading();
      logging.value = false;
    }
  }
  return { logging, onGetPhoneNumber };
}
exports.usePhoneLogin = usePhoneLogin;
