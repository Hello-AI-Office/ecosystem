"use strict";
const common_vendor = require("../../common/vendor.js");
const composables_usePhoneLogin = require("../../composables/usePhoneLogin.js");
const utils_auth = require("../../utils/auth.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const { logging, onGetPhoneNumber } = composables_usePhoneLogin.usePhoneLogin({
      // 登录成功后直达首页（tabBar 页）
      onSuccess: () => common_vendor.index.switchTab({ url: "/pages/home/index" })
    });
    common_vendor.onLoad((query) => {
      utils_auth.lockPid(query == null ? void 0 : query.pid);
    });
    return (_ctx, _cache) => {
      return {
        a: common_vendor.unref(logging),
        b: common_vendor.o(
          //@ts-ignore
          (...args) => common_vendor.unref(onGetPhoneNumber) && common_vendor.unref(onGetPhoneNumber)(...args),
          "68"
        )
      };
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-45258083"]]);
wx.createPage(MiniProgramPage);
