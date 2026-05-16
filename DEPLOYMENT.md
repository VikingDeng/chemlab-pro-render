# ChemLab Pro 交付与部署说明

## 现在先给对方看效果

当前本机已经启动了一个临时公网预览隧道：

- 预览地址：`https://6fd82b6ea917a2.lhr.life`
- 本机服务：`http://localhost:8787`
- 验证时间：2026-05-17 00:22（页面、GET `/api/lavoisier` 与 POST Agent 对话均已通过）

注意：这是临时隧道，依赖这台电脑保持开机、终端不要断开；适合今天/短时间演示，不适合作为正式交付地址。如果看到 `no tunnel here :(`，说明隧道已断开，需要重新启动隧道或改用 Render/Railway/VPS 正式部署。

## 推荐正式部署方式

这个项目现在是一个 Node 单服务：同一个服务提供前端页面和 `/api/lavoisier` 后端接口。

生产启动命令：

```bash
npm ci
npm run build
npm start
```

线上环境变量：

```env
NODE_ENV=production
PORT=8787
LLM_PROVIDER=mimo
LLM_API_URL=https://token-plan-cn.xiaomimimo.com/v1
LLM_MODEL=mimo-v2.5-pro
LLM_API_KEY=你的_MiMo_Key
```

### Render / Railway

仓库里已经准备好：

- `render.yaml`
- `railway.json`

导入仓库后，把 `LLM_API_KEY` 填到平台环境变量即可。不要把真实 key 提交到公开仓库。

### Docker / VPS

```bash
docker build -t chemlab-pro .
docker run --env-file .env -p 8787:8787 chemlab-pro
```

## Windows EXE

已经补了 Electron 桌面壳配置，并已在本机生成 Windows 便携版：

- `/Users/viking/Desktop/ChemLab-Pro-Windows-Portable.exe`
- `/Users/viking/Desktop/ChemLab-Pro-Windows-Portable.zip`
- `/Users/viking/Desktop/chemlab_workspace_delivery.zip`

如果需要重新生成，运行：

```bash
npm run package:win
```

在 Windows 机器或 GitHub Actions 的 `windows-latest` 上运行最稳；产物在 `release/*.exe`。

如果在国内网络下打包下载 Electron 依赖慢，运行：

```bash
npm run package:win:cn
```

如果用 GitHub Actions：

1. 把项目推到 GitHub。
2. 在仓库 `Settings -> Secrets and variables -> Actions` 添加 secret：`MIMO_API_KEY`。
3. 手动运行 workflow：`Build Windows EXE`。
4. 下载 artifact：`ChemLab-Pro-Windows-Portable`。

## 重要安全提醒

- 网页部署：MiMo key 只放服务器环境变量，前端看不到。
- EXE 交付：为了让无技术背景用户双击即用，key 会随应用一起打包/放在资源文件里；这只适合小范围可信交付，不适合大规模公开分发。
