"use strict";
require("../common/vendor.js");
function loginByPhone(params) {
  return mockLoginByPhone(params);
}
function mockLoginByPhone(params) {
  console.warn("[mock] loginByPhone 入参：", params);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        token: `mock-token-${Date.now()}`,
        user: {
          id: "u_10001",
          // mock 固定返回客户身份，真实身份由后端根据账号判定
          role: "customer",
          nickname: "微信用户_8888",
          // 模拟后端解密 phoneCode 得到的手机号
          phone: "138****8888",
          // 模拟后端完成 pid 推荐关系绑定
          pid: params.pid
        }
      });
    }, 800);
  });
}
exports.loginByPhone = loginByPhone;
