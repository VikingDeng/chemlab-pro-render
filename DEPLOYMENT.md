# ChemLab Pro 交付与部署说明

## 当前推荐演示地址

- 正式预览：`https://chemlab-pro.onrender.com`
- 建议发给对方的防缓存地址：`https://chemlab-pro.onrender.com/?v=deliverable`
- 拉瓦锡接口：同源 `/api/lavoisier`
- 当前模型：`mimo-v2.5`

打开页面后默认进入「任务挑战」。非技术用户只需要点「开始推荐演示」或顶部「推荐演示」，再按界面里的下一步试剂按钮推进。

## 推荐演示流程

1. 打开线上地址。
2. 点击「开始推荐演示」。
3. 按任务面板依次加入推荐试剂，观察颜色、沉淀、气泡或分层。
4. 出现现象后完成证据链选择题。
5. 点击「问拉瓦锡」，让 AI 用短句解释现象。
6. 点击「下一关」继续。

这个流程用于交付前展示：能玩、能看见现象、能问 AI、能完成任务。

## Render 部署

本项目是单 Node 服务：同一个服务提供前端页面和 `/api/lavoisier`。

生产启动命令：

```bash
npm ci
npm run build
npm start
```

Render 环境变量：

```env
NODE_ENV=production
LLM_PROVIDER=mimo
LLM_API_URL=https://token-plan-cn.xiaomimimo.com/v1
LLM_MODEL=mimo-v2.5
LLM_API_KEY=你的_MiMo_Key
```

仓库已包含 `render.yaml`。推送到 GitHub 后 Render 会自动重新部署。

## 本地一键启动

```bash
npm install
npm run dev:full
```

生产模式本地验证：

```bash
npm run build
npm start
```

然后打开 `http://localhost:8787`。

## Windows EXE

项目已经配置 Electron。重新生成 Windows 便携版：

```bash
npm run package:win
```

国内网络下载 Electron 慢时：

```bash
npm run package:win:cn
```

产物在 `release/*.exe`。正式给非技术用户前，至少在一台真实 Windows 机器上做一次双击启动、进入任务、问拉瓦锡的冒烟测试。

## 交付注意

- 网页版：MiMo key 放在 Render 环境变量里，前端不可见。
- EXE：为了双击即用，key 会随应用资源一起交付；只适合小范围可信交付。
- 如果拉瓦锡提示远程 LLM 连接失败，不会生成假回答；请刷新或稍后重试。
