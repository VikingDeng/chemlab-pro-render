# ChemLab Pro

ChemLab Pro 是一个基于 `React + TypeScript + Vite` 构建的交互式化学实验室前端项目，用来模拟常见器材操作、加液反应、温度变化与观察记录。

## 本地开发

```bash
npm install
npm run dev:full
```

默认入口为 `/`，开发环境下可通过 `/test` 访问视觉调试页面。

项目根目录的 `.env` 已按本机 `model_gateway` 的 `mimo` 配置写入：

- `LLM_API_URL=https://token-plan-cn.xiaomimimo.com/v1`
- `LLM_MODEL=mimo-v2.5-pro`
- `LLM_API_KEY=<本地已写入，不在文档中展示>`
- `VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:8787`

`.env` 会被 `.gitignore` 忽略；如果交付压缩包必须内置密钥，请只把它放进交付包，不要提交到公开仓库。

## 可用脚本

- `npm run dev`：启动开发服务器
- `npm run dev:api`：启动拉瓦锡 API
- `npm run dev:full`：同时启动 API 与 Vite 开发服务器
- `npm run build`：执行 TypeScript 构建并产出生产包
- `npm run lint`：运行 ESLint 检查
- `npm start`：生产模式启动同源服务（`dist` 静态文件 + `/api/lavoisier`）
- `npm run preview`：仅本地预览前端构建产物

## 核心目录

- `src/App.tsx`：主实验台编排与交互逻辑
- `src/chemEngine.ts`：化学状态、试剂定义与反应规则
- `src/hooks/usePhysicsEngine.ts`：加热、蒸发、蒸馏等物理模拟
- `src/components/`：实验器材与视觉表现组件
- `server/index.mjs`：同源 API、`.env` 加载、LLM 调用与生产静态资源托管

## 交付/部署建议

推荐先走单 Node 服务：

```bash
npm ci
npm run build
npm start
```

服务默认监听 `PORT=8787`，线上部署时把 `.env` 中的 `PORT`、`LLM_API_URL`、`LLM_MODEL`、`LLM_API_KEY` 配到平台环境变量即可。前端和 API 同源部署后不需要额外 CORS 或 Vite 代理。

已补充更完整的部署与 EXE 说明：`DEPLOYMENT.md`。

当前已生成的 Windows 便携版：

- `/Users/viking/Desktop/ChemLab-Pro-Windows-Portable.exe`
- `/Users/viking/Desktop/ChemLab-Pro-Windows-Portable.zip`
