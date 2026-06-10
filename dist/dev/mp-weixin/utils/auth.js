"use strict";
const common_vendor = require("../common/vendor.js");
const TOKEN_KEY = "auth:token";
const USER_KEY = "auth:user";
const PID_KEY = "auth:locked-pid";
function lockPid(pid) {
  if (!pid)
    return;
  if (getLockedPid())
    return;
  common_vendor.index.setStorageSync(PID_KEY, pid);
}
function getLockedPid() {
  return common_vendor.index.getStorageSync(PID_KEY) || null;
}
function setToken(token) {
  common_vendor.index.setStorageSync(TOKEN_KEY, token);
}
function getToken() {
  return common_vendor.index.getStorageSync(TOKEN_KEY) || null;
}
function setUserInfo(user) {
  common_vendor.index.setStorageSync(USER_KEY, user);
}
function getUserInfo() {
  return common_vendor.index.getStorageSync(USER_KEY) || null;
}
function isLoggedIn() {
  return Boolean(getToken());
}
function clearAuth() {
  common_vendor.index.removeStorageSync(TOKEN_KEY);
  common_vendor.index.removeStorageSync(USER_KEY);
}
exports.clearAuth = clearAuth;
exports.getLockedPid = getLockedPid;
exports.getUserInfo = getUserInfo;
exports.isLoggedIn = isLoggedIn;
exports.lockPid = lockPid;
exports.setToken = setToken;
exports.setUserInfo = setUserInfo;
