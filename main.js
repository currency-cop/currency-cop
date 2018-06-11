'use strict'

// Import parts of electron to use
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer')
const path = require('path')
const url = require('url')
const axios = require('axios')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

// Temporary fix broken high-dpi scale factor on Windows (125% scaling)
// info: https://github.com/electron/electron/issues/9691
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('high-dpi-support', 'true')
  app.commandLine.appendSwitch('force-device-scale-factor', '1')
}

// Keep a reference for dev mode
let isDevMode = false
if (
  process.env['NODE_ENV'] === 'development' || 
  process.defaultApp || 
  /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || 
  /[\\/]electron[\\/]/.test(process.execPath)) {
  isDevMode = true
}

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    title: 'Currency Cop',
    icon: __dirname + '/build/icon.ico',
    backgroundColor: 'rgb(25, 25, 25)',
    minWidth: 500,
    width: 1024,
    height: 768,
    show: false,
    frame: false
  });

  if (isDevMode) {
    require('./.webpack/webpack.server')
    mainWindow.loadURL('http://localhost:3000/index.html')
  } else {
    mainWindow.loadFile('dist/index.html')
  }

  // Don't show until we are ready and loaded
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()

    if (isDevMode) {
      mainWindow.webContents.openDevTools()
    }
  })

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    mainWindow = null
  })
}

ipcMain.on('HTTP_REQUEST', (event, arg) => {
  axios[arg.method](arg.url, arg.options)
    .then(response => {
      event.sender.send(arg.onSuccess, response)
    })
    .catch(error => {
      if (error.response && error.response.status < 500) {
        return event.sender.send(arg.onSuccess, error.response)
      }

      event.sender.send(arg.onError, error)
    })
})

app.on('ready', () => {
	if (isDevMode) {
		return installExtension(REACT_DEVELOPER_TOOLS)
      .then((name) => {
        console.log(`Added Extension:  ${name}`)
        createWindow()
      })
		.catch((err) => {
      console.log('An error occurred: ', err)
    })
	}
  
  createWindow()
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
