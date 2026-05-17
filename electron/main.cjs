const { app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')

let mainWindow = null
let apiServer = null

function resolveEnvFile() {
  if (!app.isPackaged) {
    return path.resolve(__dirname, '..', '.env')
  }

  return path.join(process.resourcesPath, '.env')
}

async function startApiServer() {
  const envFile = resolveEnvFile()
  if (fs.existsSync(envFile)) {
    process.env.CHEMLAB_ENV_FILE = envFile
  }

  process.env.LLM_PROVIDER ||= 'mimo'
  process.env.LLM_API_URL ||= 'https://token-plan-cn.xiaomimimo.com/v1'
  process.env.LLM_MODEL ||= 'mimo-v2.5'

  const serverModulePath = path.resolve(__dirname, '..', 'server', 'index.mjs')
  const { startServer } = await import(pathToFileURL(serverModulePath).href)
  const started = await startServer({ port: 0, host: '127.0.0.1' })
  apiServer = started.server
  return started.url
}

async function createMainWindow() {
  const appUrl = await startApiServer()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: 'ChemLab Pro',
    backgroundColor: '#060913',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  await mainWindow.loadURL(appUrl)
}

app.whenReady().then(createMainWindow).catch((error) => {
  dialog.showErrorBox('ChemLab Pro 启动失败', error instanceof Error ? error.message : String(error))
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow().catch((error) => {
      dialog.showErrorBox('ChemLab Pro 启动失败', error instanceof Error ? error.message : String(error))
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (apiServer) {
    apiServer.close()
    apiServer = null
  }
})
