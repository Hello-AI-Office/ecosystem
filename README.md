# ecosystem
团队商业生态会员系统

## 目录结构

ecosystem/
├── src/
│   ├── api/           # 接口定义
│   ├── components/    # 公共组件
│   ├── pages/         # 页面
│   ├── static/        # 静态资源
│   ├── utils/         # 工具函数
│   ├── App.vue
│   ├── main.ts
│   ├── manifest.json  # 应用配置（AppID、权限等）
│   ├── pages.json     # 页面路由与窗口样式
│   └── uni.scss       # 全局 SCSS 变量
├── index.html
├── vite.config.ts
├── unh.config.ts
└── package.json


## 配置微信小程序 AppID

编辑 `src/manifest.json`：

```json
"mp-weixin": {
  "appid": "你的小程序AppID",
  ...
}
```

测试阶段可使用微信开发者工具的「测试号」或留空使用游客模式（部分能力受限）。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（默认微信小程序） |
| `npm run dev:mp-weixin` | 微信小程序开发 |
| `npm run dev:h5` | H5 开发 |
| `npm run build:mp-weixin` | 构建微信小程序 |
| `npm run type-check` | TypeScript 类型检查 |
| `npm run lint` | ESLint 检查 |
