"use strict";
const common_vendor = require("../../common/vendor.js");
const composables_usePhoneLogin = require("../../composables/usePhoneLogin.js");
const utils_auth = require("../../utils/auth.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const loggedIn = common_vendor.ref(false);
    const user = common_vendor.ref(null);
    const ROLE_LABEL = {
      merchant: "商户",
      customer: "客户",
      agent: "代理人"
    };
    const { logging, onGetPhoneNumber } = composables_usePhoneLogin.usePhoneLogin({
      onSuccess: refreshAuthState
    });
    common_vendor.onShow(() => {
      refreshAuthState();
    });
    function refreshAuthState() {
      loggedIn.value = utils_auth.isLoggedIn();
      user.value = utils_auth.getUserInfo();
    }
    function handleLogout() {
      common_vendor.index.showModal({
        title: "提示",
        content: "确定退出登录吗？",
        success: (res) => {
          if (res.confirm) {
            utils_auth.clearAuth();
            refreshAuthState();
          }
        }
      });
    }
    return (_ctx, _cache) => {
      var _a, _b, _c, _d;
      return common_vendor.e({
        a: !loggedIn.value
      }, !loggedIn.value ? {
        b: common_vendor.unref(logging),
        c: common_vendor.o(
          //@ts-ignore
          (...args) => common_vendor.unref(onGetPhoneNumber) && common_vendor.unref(onGetPhoneNumber)(...args),
          "43"
        )
      } : {
        d: common_vendor.t(((_b = (_a = user.value) == null ? void 0 : _a.nickname) == null ? void 0 : _b.slice(0, 1)) ?? "U"),
        e: common_vendor.t((_c = user.value) == null ? void 0 : _c.nickname),
        f: common_vendor.t(user.value ? ROLE_LABEL[user.value.role] : ""),
        g: common_vendor.t((_d = user.value) == null ? void 0 : _d.phone),
        h: common_vendor.o(handleLogout, "ac")
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-9023ef44"]]);
wx.createPage(MiniProgramPage);
