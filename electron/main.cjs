const { app, BrowserWindow, screen } = require('electron')
const fs = require('fs')
const path = require('path')

const STRIP_HEIGHT = Number(process.env.HARBOR_HEIGHT) || 280
const shotPath = process.env.HARBOR_SHOT
const query = Object.fromEntries(new URLSearchParams(process.env.HARBOR_QUERY ?? ''))

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

app.whenReady().then(() => {
  const { workArea } = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y + workArea.height - STRIP_HEIGHT,
    width: Number(process.env.HARBOR_WIDTH) || workArea.width,
    height: STRIP_HEIGHT,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#efe6d6',
    webPreferences: { backgroundThrottling: false },
  })
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true)
  win.loadFile(path.join(__dirname, '../dist/index.html'), {
    query,
  })

  // Test switches: HARBOR_POINT="x,y" moves a real pointer there after 5 s, HARBOR_CLICK="x,y" then clicks.
  const spot = (value) => {
    const [x, y] = value.split(',').map(Number)
    return { x, y }
  }
  if (process.env.HARBOR_POINT) {
    setTimeout(() => win.webContents.sendInputEvent({ type: 'mouseMove', ...spot(process.env.HARBOR_POINT) }), 5000)
  }
  if (process.env.HARBOR_CLICK) {
    const at = { ...spot(process.env.HARBOR_CLICK), button: 'left', clickCount: 1 }
    setTimeout(() => {
      win.webContents.sendInputEvent({ type: 'mouseMove', ...at })
      win.webContents.sendInputEvent({ type: 'mouseDown', ...at })
      win.webContents.sendInputEvent({ type: 'mouseUp', ...at })
    }, 5300)
  }

  // HARBOR_DRAG="x1,y1,x2,y2" presses at the first point, drags to the second and lets go.
  if (process.env.HARBOR_DRAG) {
    const [x1, y1, x2, y2] = process.env.HARBOR_DRAG.split(',').map(Number)
    setTimeout(() => {
      const send = (event) => win.webContents.sendInputEvent(event)
      send({ type: 'mouseMove', x: x1, y: y1 })
      send({ type: 'mouseDown', x: x1, y: y1, button: 'left', clickCount: 1 })
      for (let i = 1; i <= 10; i++) {
        send({
          type: 'mouseMove', x: x1 + ((x2 - x1) * i) / 10, y: y1 + ((y2 - y1) * i) / 10,
          movementX: (x2 - x1) / 10, movementY: (y2 - y1) / 10, button: 'left', modifiers: ['leftButtonDown'],
        })
      }
      send({ type: 'mouseUp', x: x2, y: y2, button: 'left', clickCount: 1 })
    }, 5300)
  }

  if (shotPath) {
    win.webContents.on('console-message', (e) => console.log('[renderer]', e.message))
    setTimeout(async () => {
      const image = await win.webContents.capturePage()
      fs.writeFileSync(shotPath, image.toPNG())
      app.quit()
    }, Number(process.env.HARBOR_SHOT_AT ?? 7000))
  }
})

app.on('window-all-closed', () => app.quit())
