'use strict';

// Import parts of electron to use
const {app, BrowserWindow, ipcMain, dialog} = require('electron')
const {autoUpdater} = require("electron-updater")
const path = require('path')
const url = require('url')
const axios = require('axios')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

// Keep a reference for dev mode
let dev = false;
if ( process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath) ) {
  dev = true;
}

function createWindow () {
  autoUpdater.checkForUpdates()
    .catch(e => {
      console.log('No updates found...')
    })

  // Create the browser window.
  mainWindow = new BrowserWindow({
    title: 'Currency Cop',
    icon: __dirname + '/resources/icon.ico',
    backgroundColor: 'rgb(25, 25, 25)',
    width: 1024,
    height: 768,
    show: false,
    frame: false,
    webPreferences: {
      webSecurity: false,
    }
  });

  // and load the index.html of the app.
  let indexPath;
  if ( dev && process.argv.indexOf('--noDevServer') === -1 ) {
    indexPath = url.format({
      protocol: 'http:',
      host: 'localhost:8080',
      pathname: 'index.html',
      slashes: true
    });
  } else {
    indexPath = url.format({
      protocol: 'file:',
      pathname: path.join(__dirname, 'dist', 'index.html'),
      slashes: true
    });
  }
  mainWindow.loadURL( indexPath );

  // Don't show until we are ready and loaded
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Open the DevTools automatically if developing
    if ( dev ) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

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
}

// Configure autoupdater
let platform = process.platform === 'darwin'
  ? 'osx'
  : 'windows'

autoUpdater.autoDownload = false
autoUpdater.setFeedURL(`https://poe.technology/update/${platform}/${app.getVersion()}`)

// Listen
autoUpdater.on('checking-for-update', (info) => {
  console.log('checking...', info)
})

autoUpdater.on('update-available', (info) => {
  console.log(info)

  dialog.showMessageBox({
    type: 'info',
    title: 'Found Updates',
    message: 'Found updates, do you want update now?',
    buttons: ['Sure', 'No']
  }, (buttonIndex) => {
    if (buttonIndex === 0) {
      autoUpdater.downloadUpdate()
    } else {
      // updater.enabled = true
      // updater = null
    }
  })
})

autoUpdater.on('update-not-available', (info) => {
  dialog.showMessageBox({
    title: 'No Updates',
    message: 'Current version is up-to-date.'
  })
})

autoUpdater.on('error', (err) => {
  dialog.showErrorBox('Error: ', error == null ? "unknown" : (error.stack || error).toString())
})

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log(log_message)
})

autoUpdater.on('update-downloaded', (info) => {
  dialog.showMessageBox({
    title: 'Install Updates',
    message: 'Updates downloaded, application will be quit for update...'
  }, () => {
    setImmediate(() => autoUpdater.quitAndInstall())
  })
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  app.quit()
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})
