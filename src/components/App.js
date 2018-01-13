// Core
import '../assets/css/App.css'
import Constants from '../constants'
import pkg from '../../package.json'

// Third Party
import { ipcRenderer, shell, remote, clipboard } from 'electron'
import React, { Component } from 'react'
import Emitter from 'tiny-emitter'
import Logger from '../logger'
import Axios from 'axios'
import Queue from '../queue'
import Ago from '../ago'
import path from 'path'
import fs from 'fs'

// Material UI
import { MuiThemeProvider, createMuiTheme, withTheme, withStyles } from 'material-ui/styles'
import { DialogActions, DialogContent, DialogContentText, DialogTitle } from 'material-ui/Dialog'
import { FormGroup, FormControl, FormControlLabel, FormHelperText } from 'material-ui/Form'
import { ListItem, ListItemText } from 'material-ui/List'
import { RadioGroup } from 'material-ui/Radio'
import { InputLabel } from 'material-ui/Input'
import { MenuItem } from 'material-ui/Menu'
import Tooltip from 'material-ui/Tooltip'
import Paper from 'material-ui/Paper'

import {
  AppBar, Toolbar, IconButton, MenuIcon,
  Button, Typography, Input, Grid, Snackbar,
  Menu, Checkbox, Radio, List, Dialog, TextField,
  Select, Switch
} from 'material-ui'

// Icons
import KeyboardArrowLeftIcon from 'material-ui-icons/KeyboardArrowLeft'
import CloudDownloadIcon from 'material-ui-icons/CloudDownload'
import SettingsIcon from 'material-ui-icons/Settings'

// App Environment
const AppVersion = pkg.version
const AppPlatform = process.platform === 'darwin'
  ? 'osx'
  : 'windows'

// App Theme
const theme = createMuiTheme({
  palette: {
    type: 'dark',
    primary: {
      50: '#e4e5e7',
      100: '#bdbec2',
      200: '#919399',
      300: '#646870',
      400: '#434752',
      500: '#222733',
      600: '#1e232e',
      700: '#191d27',
      800: '#141720',
      900: '#0c0e14',
      A100: '#a7d2ff',
      A200: '#74b7ff',
      A400: '#419dff',
      A700: '#288fff',
      'contrastDefaultColor': 'light',
    },
    secondary: {
      50: '#edeef0',
      100: '#d1d6da',
      200: '#b2bac1',
      300: '#939ea8',
      400: '#7c8a96',
      500: '#657583',
      600: '#5d6d7b',
      700: '#536270',
      800: '#495866',
      900: '#374553',
      A100: '#5874ff',
      A200: '#254aff',
      A400: '#0028f1',
      A700: '#0024d8',
      'contrastDefaultColor': 'light',
    },
    background: {
      paper: '#222733',
      default: '#191d27'
    }
  }
})

// Configure Event System
const events = new Emitter()

// Application folder location
const userDataPath = remote.app.getPath('userData')
const logsDataPath = path.join(userDataPath, 'Logs')
const reportsFilename = path.join(userDataPath, 'Reports.db')
const configFilename = path.join(userDataPath, 'User.db')

// Configure Logger
const logger = new Logger({
  logdir: logsDataPath,
  level: 1
})

// Create Loggers
const Log = logger.topic('Core')
const ConfigLog = logger.topic('Config')
const ApiLog = logger.topic('API')
const EventLog = logger.topic('Events')

// Capture uncaught errors
process.on('uncaughtException', function (error) {
  events.emit('notification', {
    message: 'Unexpected error occurred.',
    action: CopyLogsButton
  })

  Log.critical(`Uncaught error: ${error.message} - ${error.stack}`)
})

// Enums
let ConfigKeys = {
  ACCOUNT_COOKIE:                       'ACCOUNT_COOKIE',
  ACCOUNT_USERNAME:                     'ACCOUNT_USERNAME'
}

// Helpers
function DefaultConfig () {
  return {
    [ConfigKeys.ACCOUNT_COOKIE]:              null,
    [ConfigKeys.ACCOUNT_USERNAME]:            null,
  }
}

function UUID () {
  return Math.random().toString(36).substring(2) + (new Date()).getTime().toString(36)
}

function padNumber (i) {
  return (i < 10) ? `0${i}` : `${i}`
}

function promiseDelay (time) {
  return new Promise(function (fulfill) {
    setTimeout(fulfill, time);
  });
}

function getNinjaDate () {
  let date = new Date()
  return [
    padNumber(date.getFullYear()),
    padNumber(date.getMonth()),
    padNumber(date.getDay())
  ].join('-')
}

function clone (obj) {
  return JSON.parse(JSON.stringify(obj))
}

function getPercentageChange (a, b) {
  let change = parseFloat((((b - a) / a) * 100).toFixed(2))
  let direction = change < 0
    ? 'down'
    : change > 0
    ? 'up'
    : null
  let absChange = Math.abs(change)

  return {
    change,
    absChange,
    direction
  }
}

// Class
class DataFile {
  constructor (type, filename) {
    this.filename = filename
    this.log = logger.topic(type)
  }

  load (defaults) {
    try {
      this.log.info(`Loading file from: ${this.filename}`)
      return JSON.parse(fs.readFileSync(this.filename))
    } catch(error) {
      this.log.warn(`File could not be loaded: ${error.message}`)
      return defaults
    }
  }

  save (data) {
    try {
      this.log.info(`Saving file: ${this.filename}`)
      fs.writeFileSync(this.filename, JSON.stringify(data))
    } catch (error) {
      this.log.critical(`Could not save file: ${error.message}`)
    }
  }
}

// Global Objects
let Config = DefaultConfig()
let Reports = {}

// Files
let ConfigFile = new DataFile('Config', configFilename)
let ReportFile = new DataFile('Report', reportsFilename)

// Configuration Helpers
function getConfig (key) {
  try {
    return Config[key]
  } catch (error) {
    Log.warn(`Could not get configuration key [${key}] from config: ${error.message}`)
    return null
  }
}

// Api
function GoToUrl (url, event) {
  if (url && url.preventDefault && !url.target.href) {
    event = url
    event.preventDefault()
    shell.openExternal(event.target.parentNode.href)
  } else if (url && url.preventDefault) {
    event = url
    event.preventDefault()
    shell.openExternal(event.target.href)
  } else {
    event.preventDefault()
    shell.openExternal(url)
  }
}

function DoServerRequest (options) {
  // Prevent collision
  let uuid = UUID()
  options.onSuccess += `_${uuid}`
  options.onError += `_${uuid}`

  // Make request
  console.debug(`Making HTTP request to: ${options.url}`)
  console.debug(`Request options`, options)

  ipcRenderer.send('HTTP_REQUEST', options)

  return new Promise((resolve, reject) => {
    ipcRenderer.once(options.onSuccess, (event, response) => {
      if (response.status > 200) {
        // The request was made and the server responded with a status code
        // that is not 200
        ApiLog.warn(`${response.status} status response for [${options.url}]: ${JSON.stringify(response.data)}`)
      }

      return resolve(response)
    })

    ipcRenderer.once(options.onError, (event, error) => {
      if (error.response) {
        // The request was made and the server responded with a status code 
        // that falls out of the range of 2xx
        ApiLog.warn(`${response.status} status response for [${options.url}]: ${JSON.stringify(response.data)}`)
      } else if (error.request) {
        // The request was made but no response was received 
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of 
        // http.ClientRequest in node.js
        ApiLog.error(`Request sent to [${options.url}], no response received: ${error.message}`)
      } else {
        // Something happened in setting up the request that triggered an Error
        ApiLog.error(`Unable to make HTTP request to [${options.url}]: ${error.message}`)
      }

      return reject(error)
    })
  })
}

function LoginWithCookie (cookie) {
  return DoServerRequest({
    method: 'get',
    url: Constants.POE_LOGIN_URL,
    options: {
      headers: {
        'Cookie': `${Constants.POE_COOKIE_NAME}=${cookie}`
      },
      maxRedirects: 0
    },
    onSuccess: 'LOGIN_RESPONSE',
    onError: 'LOGIN_ERROR'
  })
}

function GetAccountName (cookie) {
  return DoServerRequest({
    method: 'get',
    url: Constants.POE_MY_ACCOUNT_URL,
    options: {
      headers: {
        'Cookie': `${Constants.POE_COOKIE_NAME}=${cookie}`
      }
    },
    onSuccess: 'MY_ACCOUNT_RESPONSE',
    onError: 'MY_ACCOUNT_ERROR'
  })
}

function GetLeagues () {
  return DoServerRequest({
    method: 'get',
    url: Constants.POE_LEAGUE_LIST_URL,
    options: {},
    onSuccess: 'LEAGUE_LIST_RESPONSE',
    onError: 'LEAGUE_LIST_ERROR'
  })
}

function GetCharacters (cookie, accountName) {
  return DoServerRequest({
    method: 'get',
    url: Constants.POE_GET_CHARACTERS_URL,
    options: {
      headers: {
        'Cookie': `${Constants.POE_COOKIE_NAME}=${cookie}`
      }
    },
    onSuccess: 'CHARACTERS_RESPONSE',
    onError: 'CHARACTERS_ERROR'
  })
}

function GetLeagueStashTab (cookie, options) {
  return DoServerRequest({
    method: 'get',
    url: Constants.POE_STASH_ITEMS_URL,
    options: {
      headers: {
        'Cookie': `${Constants.POE_COOKIE_NAME}=${cookie}`
      },
      params: options
    },
    onSuccess: `STASH_TAB_RESPONSE`,
    onError: `STASH_TAB_ERROR`
  })
}

function GetCurrencyOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_CURRENCY_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'CURRENCY_RESPONSE',
    onError: 'CURRENCY_ERROR'
  })
}

function GetEssenceOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_ESSENCE_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'ESSENCE_RESPONSE',
    onError: 'ESSENCE_ERROR'
  })
}

function GetFragmentOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_FRAGMENT_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'FRAGMENT_RESPONSE',
    onError: 'FRAGMENT_ERROR'
  })
}

function GetDivCardOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_DIV_CARDS_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'DIV_CARD_RESPONSE',
    onError: 'DIV_CARD_ERROR'
  })
}

function GetMapOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_MAP_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'MAP_RESPONSE',
    onError: 'MAP_ERROR'
  })
}

function GetUniqueMapOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_UNIQUE_MAP_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'UNIQUE_MAP_RESPONSE',
    onError: 'UNIQUE_MAP_ERROR'
  })
}

function GetGemOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_GEM_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'GEM_RESPONSE',
    onError: 'GEM_ERROR'
  })
}

function GetUniqueJewelOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_UNIQUE_JEWEL_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'UNIQUE_JEWEL_RESPONSE',
    onError: 'UNIQUE_JEWEL_ERROR'
  })
}

function GetUniqueFlaskOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_UNIQUE_FLASK_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'UNIQUE_FLASK_RESPONSE',
    onError: 'UNIQUE_FLASK_ERROR'
  })
}

function GetUniqueArmourOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_UNIQUE_ARMOUR_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'UNIQUE_ARMOUR_RESPONSE',
    onError: 'UNIQUE_ARMOUR_ERROR'
  })
}

function GetUniqueAccessoryOverview (league, date) {
  return DoServerRequest({
    method: 'get',
    url: Constants.NINJA_UNIQUE_ACCESSORY_OVERVIEW_URL,
    options: {
      params: {
        league,
        date
      }
    },
    onSuccess: 'UNIQUE_ACCESSORY_RESPONSE',
    onError: 'UNIQUE_ACCESSORY_ERROR'
  })
}

function DoVersionCheck () {
  return DoServerRequest({
    method: 'get',
    url: `https://poe.technology/latest`,
    onSuccess: 'VERSION_CHECK_RESPONSE',
    onError: 'VERSION_CHECK_ERROR'
  })
}

// API Classes
class ReportBuilder {
  constructor (options) {
    this.additionalDelay = 60000
    this.cookie = options.cookie
    this.account = options.account
    this.settings = options.settings
    this.data = options.data
    this.history = options.history || []
    this.interval = null
    this.fetching = false
    this.id = UUID()
  }

  notice (message) {
    let reportName = this.settings.name

    events.emit('notification', {
      message: `[${reportName}] ${message}`
    })
  }

  enableAutoRefresh () {
    if (this.interval) {
      clearInterval(this.interval)
    }

    if (this.settings.autoRefresh) {
      Log.info(`Enabling auto-refresh for [${this.settings.name}] interval of [${this.settings.autoRefreshInterval}]`)
      this.interval = setInterval(() => {
        Log.info(`Refreshing [${this.settings.name}]`)
        return this.refresh()
      }, this.settings.autoRefreshInterval)
    }
  }

  updateSettings (settings, fetchImmediately) {
    let previous = this.settings
    this.settings = settings
    this.enableAutoRefresh()

    if (fetchImmediately) {
      this.refresh()
    }
  }

  refresh () {
    return this.fetch()
      .then(() => {
        events.emit('update_report', {
          report: this
        })
      })
  }

  buildItem (data) {
    let item = {}

    item.name = data.lineItem.currencyTypeName || data.lineItem.name
    item.lname = item.name.toLowerCase()
    item.links = data.lineItem.links || 0
    item.icon = data.lineItem.icon || data.details.icon
    item.chaosValue = data.lineItem.chaosEquivalent || data.lineItem.chaosValue
    item.orderId = data.details.poeTradeId || data.lineItem.id
    item.type = data.type
    if(item.type === "gem") {
      item.gemLevel = data.lineItem.gemLevel
      item.gemQuality = data.lineItem.gemQuality
      item.corrupted = data.lineItem.corrupted
      item.variant = data.lineItem.variant
    }
    
    if (data.lineItem.stackSize) {
      item.maxStackSize = data.lineItem.stackSize
    }

    return item
  }

  fetchTabsList () {
    return new Promise((resolve, reject) => {
      return GetLeagueStashTab(this.cookie, {
        accountName: this.account,
        tabIndex: 0,
        league: this.settings.league,
        tabs: 1
      }).then(response => {
        if (response.status === 404) {
          this.notice(`No tabs found in ${league} league. Try another one? 🤷`)
        }

        if (response.status === 403) {
          events.emit('clear_config')
          this.notice(`Session expired. You have been logged out.`)
        }

        if (!response.data || !response.data.tabs) {
          this.notice(`No tabs found in ${league} league. Try another one? 🤷`)
        } else if (response.status === 200) {
          return response
        }

        throw (null)
      }).then(response => {
        this.data.stashTabs = response.data.tabs
        return resolve()
      })
      .catch(err => {
        throw err
      })
    })
  }

  fetchTabs () {
    let queue = new Queue(1)
    let stash = this.data.stashTabs

    for (var i = 0; i < stash.length; i++) {
      let tab = this.data.stashTabs[i]

      // Ignore hideout tabs
      if (tab.hidden) 
        continue

      // Ignore non-indexed tabs
      if (this.settings.tabsToSearch.indexOf(i) < 0) 
        continue

      // Ignore tab without data
      if (tab.wasProcessed)
        if (this.settings.onlySearchTabsWithCurrency && !tab.hasCurrency)
          continue

      this.fetchTab(queue, tab)
    }

    return queue.push(() => {
      return true
    })
  }

  fetchTab (queue, tab, delay) {
    delay = delay || 1350 // 60 / 45 (rate limited)
    queue.unshift(() => new Promise((resolve, reject) => {
      return promiseDelay(delay)
        .then(() => {
          this.notice(`Fetching tab ${tab.n}...`)
        })
        .then(() => {
          return GetLeagueStashTab(this.cookie, {
            accountName: this.account,
            tabIndex: tab.i,
            league: this.settings.league,
            tabs: 0
          })
        })
        .then(response => {
          if (response.status === 429) {
            this.notice(`Ooohwee, too many requests Jerry! Gonna have to wait a minute for tab ${tab.n}!`)
            return this.fetchTab(queue, tab, delay + this.additionalDelay)
          }

          if (response.status === 403) {
            events.emit('clear_config')
            this.notice(`Session expired. You have been logged out.`)
            throw (null)
          }

          if (!response) {
            return resolve()
          }

          return response.data
        })
        .then(response => {
          tab.items = response.items
          return resolve()
        })
    }))
  }

  fetchRates () {
    return Promise.resolve()
      .then(() => this.notice('Fetching currency rates...'))
      .then(() => (this.data.rates = []))
      .then(() => this.fetchCurrencyRates())
      .then(() => this.fetchEssenceRates())
      .then(() => this.fetchFragmentRates())
      .then(() => this.fetchDivCardRates())
      .then(() => this.fetchMapRates())
      .then(() => this.fetchUniqueMapRates())
      .then(() => this.fetchUniqueJewelRates())
      .then(() => this.fetchGemRates())
      .then(() => this.fetchUniqueFlaskRates())
      .then(() => this.fetchUniqueWeaponRates())
      .then(() => this.fetchUniqueArmourRates())
      .then(() => this.fetchUniqueAccessoryRates())
  }

  fetchEssenceRates (queue) {
    let league = this.settings.league.replace('SSF ', '')

    return (queue || new Queue(1))
      .unshift(() => new Promise((resolve, reject) => {
        return GetEssenceOverview(league, getNinjaDate())
          .then(response => {
            return response.status !== 200
            ? this.fetchEssenceRates(queue)
            : this.processFetchedRates('essence', response.data)
          })
          .then(resolve)
          .catch(reject)
      }))
  }

  fetchDivCardRates (queue) {
    let league = this.settings.league.replace('SSF ', '')

    return (queue || new Queue(1))
      .unshift(() => new Promise((resolve, reject) => {
        return GetDivCardOverview(league, getNinjaDate())
          .then(response => {
            return response.status !== 200
              ? this.fetchDivCardRates(queue)
              : this.processFetchedRates('card', response.data)
          })
          .then(resolve)
          .catch(reject)
      }))
  }

  fetchMapRates (queue) {
    let league = this.settings.league.replace('SSF ', '')

    return (queue || new Queue(1))
      .unshift(() => new Promise((resolve, reject) => {
        return GetMapOverview(league, getNinjaDate())
          .then(response => {
            return response.status !== 200
              ? this.fetchMapRates(queue)
              : this.processFetchedRates('map', response.data)
          })
          .then(resolve)
          .catch(reject)
      }))
  }

  fetchUniqueMapRates (queue) {
    let league = this.settings.league.replace('SSF ', '')

    return (queue || new Queue(1))
      .unshift(() => new Promise((resolve, reject) => {
        return GetUniqueMapOverview(league, getNinjaDate())
          .then(response => {
            return response.status !== 200
              ? this.fetchUniqueMapRates(queue)
              : this.processFetchedRates('map_unique', response.data)
          })
          .then(resolve)
          .catch(reject)
      }))
  }

  fetchGemRates (queue) {
    let league = this.settings.league.replace('SSF ', '')

    return (queue || new Queue(1))
      .unshift(() => new Promise((resolve, reject) => {
        return GetGemOverview(league, getNinjaDate())
          .then(response => {
            return response.status !== 200
              ? this.fetchGemRates(queue)
              : this.processFetchedRates('gem', response.data)
          })
          .then(resolve)
          .catch(reject)
      }))
  }

  fetchUniqueJewelRates (queue) {
    let league = this.settings.league.replace('SSF ', '')

    return (queue || new Queue(1))
      .unshift(() => new Promise((resolve, reject) => {
        return GetUniqueJewelOverview(league, getNinjaDate())
          .then(response => {
            return response.status !== 200
              ? this.fetchUniqueJewelRates(queue)
              : this.processFetchedRates('jewel_unique', response.data)
          })
          .then(resolve)
          .catch(reject)
      }))
  }

  fetchUniqueFlaskRates (queue) {
    let league = this.settings.league.replace('SSF ', '')

    return (queue || new Queue(1))
      .unshift(() => new Promise((resolve, reject) => {
        return GetUniqueJewelOverview(league, getNinjaDate())
          .then(response => {
            return response.status !== 200
              ? this.fetchUniqueFlaskRates(queue)
              : this.processFetchedRates('flask_unique', response.data)
          })
          .then(resolve)
          .catch(reject)
      }))
  }

  fetchUniqueWeaponRates (queue) {
    let league = this.settings.league.replace('SSF ', '')

    return (queue || new Queue(1))
      .unshift(() => new Promise((resolve, reject) => {
        return GetUniqueJewelOverview(league, getNinjaDate())
          .then(response => {
            return response.status !== 200
              ? this.fetchUniqueWeaponRates(queue)
              : this.processFetchedRates('weapon_unique', response.data)
          })
          .then(resolve)
          .catch(reject)
      }))
  }

  fetchUniqueArmourRates (queue) {
    let league = this.settings.league.replace('SSF ', '')

    return (queue || new Queue(1))
      .unshift(() => new Promise((resolve, reject) => {
        return GetUniqueArmourOverview(league, getNinjaDate())
          .then(response => {
            return response.status !== 200
              ? this.fetchUniqueArmourRates(queue)
              : this.processFetchedRates('armour_unique', response.data)
          })
          .then(resolve)
          .catch(reject)
      }))
  }

  fetchUniqueAccessoryRates (queue) {
    let league = this.settings.league.replace('SSF ', '')

    return (queue || new Queue(1))
      .unshift(() => new Promise((resolve, reject) => {
        return GetUniqueArmourOverview(league, getNinjaDate())
          .then(response => {
            return response.status !== 200
              ? this.fetchUniqueAccessoryRates(queue)
              : this.processFetchedRates('accessory_unique', response.data)
          })
          .then(resolve)
          .catch(reject)
      }))
  }

  fetchFragmentRates (queue) {
    let league = this.settings.league.replace('SSF ', '')

    return (queue || new Queue(1))
      .unshift(() => new Promise((resolve, reject) => {
        return GetFragmentOverview(league, getNinjaDate())
          .then(response => {
            return response.status !== 200
              ? this.fetchFragmentRates(queue)
              : this.processFetchedRates('fragment', response.data)
          })
          .then(resolve)
          .catch(reject)
      }))
  }

  fetchCurrencyRates (queue) {
    let league = this.settings.league.replace('SSF ', '')

    return (queue || new Queue(1))
      .unshift(() => new Promise((resolve, reject) => {
        return GetCurrencyOverview(league, getNinjaDate())
          .then(response => {
            return response.status !== 200
            ? this.fetchCurrencyRates(queue)
            : this.processFetchedRates('currency', response.data)
          })
          .then(resolve)
          .catch(reject)
      }))
  }

  processFetchedRates (type, data) {
    return new Promise((resolve, reject) => {
      let rates = this.data.rates || []

      let getLineItemName = (lineItem) => {
        return data.currencyDetails
          ? lineItem.currencyTypeName
          : lineItem.name
      }

      let getLineItemLinks = (lineItem) => {
        return lineItem.links || 0
      }

      let getLineItemQuality = (lineItem) => {
        return lineItem.quality || 0
      }

      let rateExists = (type, item) => {
        let litemName = getLineItemName(item).toLowerCase()
        let gemLevel = item.gemLevel
        let gemQuality = item.gemQuality
        if(type == "gem") {
          return rates.find(value => {
            value.lname === litemName && value.gemLevel == gemLevel && value.gemQuality == gemQuality
          })
        }
        let links = getLineItemLinks(item)
        return rates.find(value => value.lname === litemName && value.links === links)
      }

      let getCurrencyDetailsItem = (itemName) => {
        return data.currencyDetails.find(value => value.name === itemName)
      }

      if (data.lines && data.lines.forEach) {
        data.lines.forEach(lineItem => {
          let exists = rateExists(type, lineItem)

          // Entry already exists
          if (exists) {
            return
          }

          let details = data.currencyDetails
            ? getCurrencyDetailsItem(lineItem.currencyTypeName)
            : {}

          rates.push(this.buildItem({
            lineItem,
            details,
            type
          }))
        })
      }

      this.data.rates = rates

      return resolve()
    })
  }

  build (type, data) {
    let tabs = this.data.stashTabs
    let items = clone(this.data.rates)

    // Helpers
    let getItemObject = (itemName, links) => {
      let litemName = itemName.toLowerCase()
      return items.find(value => {
        return value.lname === litemName && value.links === links
      })
    }

    let getGemProperties = (item) => {
      let quality = item.properties.find(property => property.name === "Quality")
      if (quality) {
        quality = parseInt(quality.values[0][0])
      } else {
        quality = 0
      } 

      let level = item.properties.find(property => property.name === "Level")
      if (level) {
        level = parseInt(level.values[0][0])
      } else {
        level = 1;
      } 

      // ninja only returns quality = 20 or 0 so we adjust the actual value to get approximate worth
      if(quality >= 16) {
        quality = 20
      } else {
        quality = 0
      }

      // ninja only return level = 0, 20, 21 so we set level 19 to level 20 and all other we set to 0
      // maybe make the check check for level 18 because it is nearly 20?
      if(level === 19) {
        level = 20
      } else if (level < 19) {
        level = 1
      }

      item.typeLine = `${item.typeLine} - ${level} - ${quality}%`

      return [level, quality, item];
    }

    // Helpers
    let getGemObject = (item) => {
      let gemName = item.typeLine.toLowerCase()
      let gemQuality
      let gemLevel
      let gemCorrupted = item.corrupted || false;
      [gemLevel, gemQuality, item] = getGemProperties(item)
      return items.find(value => {
        return value.lname === gemName && value.gemLevel === gemLevel && value.gemQuality === gemQuality && value.corrupted === gemCorrupted
      })
    }

    //TODO: add check for gem level and quality here

    let getItemLinks = (item) => 
    {
      if (item.sockets == null)
        return 0;

      var groupCount = [0, 0, 0, 0, 0];
      for (var i = 0; i < item.sockets.length; i++) {
        groupCount[item.sockets[i].group]++
      }

      var max = Math.max(groupCount[0], groupCount[1])
      this.notice(`getItemLinks ${JSON.stringify(item.sockets)} group ${JSON.stringify(groupCount)} max ${max}`)
      return max > 4 ? max : 0;
    }

    let getArmourItemObject = (itemName, links) => {
      let litemName = itemName.toLowerCase()
      return items.find(value => {
        return value.lname === litemName && value.links === links
      })
    }

    // Iterate over each tab, then each tabs items
    if (tabs && tabs.forEach) {
      tabs.forEach((tab, i) => {
        // Ignore hideout tabs
        if (tab.hidden) 
          return

        // Ignore non-indexed tabs
        if (this.settings.tabsToSearch.indexOf(i) < 0) 
          return

        // Ignore tab without data
        if (tab.wasProcessed)
          if (this.settings.onlySearchTabsWithCurrency && !tab.hasCurrency)
            return

        if (tab && tab.items && tab.items.forEach) {
          tab.items.forEach(item => {
            let reportItem

            if(!reportItem && item.category === "gems") {
              reportItem = getGemObject(item)
            }
            
            if(!reportItem) {
              reportItem = getItemObject(item.typeLine, 0)
            }
          
            // Check for "Superior" in item name
            if (!reportItem && item.typeLine.indexOf('Superior') > -1) {
              reportItem = getItemObject(item.typeLine.replace('Superior ', ''), 0)
            }

            

            // Chaos orb doesn't exist by default so we must create them.
            if (!reportItem && item.typeLine === 'Chaos Orb') {
              items.unshift({
                name: item.typeLine,
                lname: item.typeLine.toLowerCase(),
                icon: 'http://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollRare.png?scale=1&w=1&h=1',
                orderId: 1,
                type: 'currency',
                chaosValue: 1,
                stackSize: item.stackSize,
                stacks: [{
                  tab: tab.n,
                  stackSize: item.stackSize,
                  x: item.x,
                  y: item.y
                }]
              })
            }

            // Unique items look up by name, and link count
            if (!reportItem && item.frameType == 3) {
              reportItem = getItemObject(item.name.replace('<<set:MS>><<set:M>><<set:S>>', ''), getItemLinks(item))
            }

            // Skip anything else
            if (!reportItem) {
              return
            }

            // if (
            //    reportItem.type === 'card' 
            // && !!reportItem.maxStackSize
            // && reportItem.maxStackSize > 0
            // && !reportItem.stackSizeChaosValue) {
            //   reportItem.stackSizeChaosValue = reportItem.chaosValue
            //   reportItem.chaosValue = parseFloat((reportItem.chaosValue / reportItem.maxStackSize).toFixed(2))
            //   reportItem.stackSize = 0
            // }

            // Ensure stack details exist
            if (!reportItem.stackSize) {
              reportItem.stackSize = 0
            }

            if (!reportItem.stacks) {
              reportItem.stacks = []
            }

            if (isNaN(reportItem.stackSize)) {
              reportItem.stackSize = 0
            }

            reportItem.stackSize += item.stackSize || 1
            reportItem.stacks.push({
              tab: tab.n,
              stackSize: item.stackSize,
              x: item.x,
              y: item.y
            })
          })
        }
      })
    }

    return items
  }

  fetch (tabs, rates) {
    let {
      autoRefreshTabs,
      autoRefreshRates
    } = this.settings

    return Promise.resolve()
      .then(() => (autoRefreshRates || rates) ? this.fetchRates() : null)
      .then(() => (autoRefreshTabs || tabs) ? this.fetchTabs() : null)
      .then(() => this.build())
      .then(report => {
        let reportTotal = 0

        if (report && report.forEach) {
          report.forEach(item => {
            if (item.stackSize) {
              reportTotal += item.stackSize * item.chaosValue
            }
          })
        }

        this.history.unshift({
          refreshedAt: Date.now(),
          refreshedTabs: tabs || autoRefreshTabs,
          refreshedRates: rates || autoRefreshRates,
          data: this.data,
          settings: this.settings,
          reportTotal,
          report
        })

        return this
      })
      .catch(error => {
        if (!error) return
        throw error
      })
  }
}

ReportBuilder.defaultSettingsObject = function () {
  return {
    name: null,
    league: null,
    autoRefresh: false,
    autoRefreshInterval: 1000 * 60 * 60, // 1 hour
    autoRefreshRates: false,
    autoRefreshTabs: true,
    onlySearchTabsWithCurrency: false,
    tabsToSearch: [],
  }
}

ReportBuilder.defaultDataObject = function () {
  return {
    stashTabs: null,
    rates: null
  }
}

// Helper Components
const CopyLogsButton = (
  <Button color="accent" dense onClick={event => {
    let originalValue = event.target.innerText
    clipboard.writeText(logger.getCurrentLogsFile().toString())
    event.target.innerText = 'Copied!'
    setTimeout(() => event.target.innerText = originalValue, 2000)
  }}>
    Copy Logs
  </Button>
)

// Character Dropdown
class CharacterDropdown extends React.Component {
  state = {
    anchorEl: undefined,
    open: false,
    selectedIndex: undefined,
  }

  button = undefined

  componentWillMount () {
    this.setState({
      selectedIndex: this.props.selectedIndex || 0
    })
  }

  handleButtonClick = event => {
    this.setState({ open: true, anchorEl: event.currentTarget })
  }

  handleMenuItemClick = (event, index) => {
    this.setState({ 
      selectedIndex: index,
      open: false 
    })

    this.props.onSelect(event, index)
  }

  handleRequestClose = () => {
    this.setState({ open: false })
  }

  render() {
    return (
      <div>
        <Button
          aria-owns={this.state.open ? 'simple-menu' : null}
          aria-haspopup="true"
          onClick={this.handleButtonClick}
        >
          {this.props.characters[this.state.selectedIndex].name}
        </Button>
        <Menu
          id="lock-menu"
          anchorEl={this.state.anchorEl}
          open={this.state.open}
          onRequestClose={this.handleRequestClose}
        >
          {this.props.characters.map((character, index) => (
            <MenuItem
              key={character.name}
              selected={index === this.state.selectedIndex}
              onClick={event => this.handleMenuItemClick(event, index)}
            >
              <div>
                <Typography type="body1" component="p">
                  {character.name}
                </Typography>
                <Typography type="body1" component="p" style={{
                  color: 'rgba(255,255,255,0.3)'
                }}>
                  {character.league} - Level {character.level} - {character.class}
                </Typography>
              </div>
            </MenuItem>
          ))}
        </Menu>
      </div>
    )
  }
}

// League Dropdown
class LeagueDropdown extends React.Component {
  state = {
    anchorEl: undefined,
    open: false,
    selectedIndex: undefined,
  }

  button = undefined

  componentWillMount () {
    let selectedIndex = this.props.selectedIndex || 4

    if (this.props.league) {
      this.props.leagues.forEach((league, index) => {
        if (league.id === this.props.league) {
          selectedIndex = index
        }
      })
    }

    this.setState({
      selectedIndex: selectedIndex
    })
  }

  handleButtonClick = event => {
    this.setState({ open: true, anchorEl: event.currentTarget })
  }

  handleMenuItemClick = (event, index) => {
    this.setState({ 
      selectedIndex: index,
      open: false 
    })

    this.props.onSelect(event, index)
  }

  handleRequestClose = () => {
    this.setState({ open: false })
  }

  render() {
    return (
      <div>
        <Typography
          component="span"
          style={{ display: 'inline-block', marginRight: 8, opacity: '0.5' }}
        >{this.props.labelText}</Typography>
        <Button
          dense
          aria-owns={this.state.open ? 'simple-menu' : null}
          aria-haspopup="true"
          onClick={this.handleButtonClick}
        >
          {this.props.leagues[this.state.selectedIndex].id}
        </Button>
        <Menu
          id="lock-menu"
          anchorEl={this.state.anchorEl}
          open={this.state.open}
          onRequestClose={this.handleRequestClose}
        >
          {this.props.leagues.map((league, index) => (
            <MenuItem
              key={league.id}
              selected={index === this.state.selectedIndex}
              onClick={event => this.handleMenuItemClick(event, index)}
            >
              {league.id}
            </MenuItem>
          ))}
        </Menu>
      </div>
    )
  }
}

// Logout Button
class LogoutButton extends React.Component {
  render () {
    return (
      <Button dense onClick={this.props.onClick}>
        {this.props.children}
      </Button>
    )
  }
}

// Account Details Button
class AccountActions extends React.Component {
  handleLogoutClick () {
    events.emit('clear_config')
  }

  render () {
    return (
      <div className="account-actions" style={{ display: 'flex' }}>
        <LogoutButton onClick={this.handleLogoutClick.bind(this)}>
          {decodeURIComponent(getConfig(ConfigKeys.ACCOUNT_USERNAME))} (logout)
        </LogoutButton>
      </div>
    )
  }
}

// Dashboard Screen
class DashboardScreen extends React.Component {
  state = {
    isSelectingReportTabs: false,
    isCreatingReport: false,
    report: false
  }

  styles = {
    loadingReports: true,
    reportsList: {}
  }

  handleCreateReportButton () {
    let report = new ReportBuilder({
      account: getConfig(ConfigKeys.ACCOUNT_USERNAME),
      cookie: getConfig(ConfigKeys.ACCOUNT_COOKIE),
      data: ReportBuilder.defaultDataObject(),
      settings: ReportBuilder.defaultSettingsObject()
    })

    report.settings.league = this.props.leagues[4].id

    this.generateDefaultReportName(report)
    this.setState({
      isCreatingReport: true,
      report
    })
  }

  generateDefaultReportName (report) {
    let nameMap = {};
    this.props.reports.forEach(function (rep) {
      nameMap[rep.settings.name] = true;
    })

    let defaultReportNumber = 0
    let defaultReportName;
    do {
      defaultReportNumber++
      defaultReportName = `${report.settings.league}-${defaultReportNumber}`
    } while (nameMap[defaultReportName])
    report.settings.name = defaultReportName
    this.setState({
      defaultReportName
    })
  }

  handleCreateReportCancelled () {
    this.setState({
      isCreatingReport: false,
      isSelectingReportTabs: false,
      buttonLoadingText: null
    }, () => {
      this.setState({
        report: null
      })
    })
  }

  handleCreateReportSubmit (event) {
    let report = this.state.report
    if (!report.settings.name) {
      return this.setState({
        nameError: 'Name is required!'
      })
    }
    let reports = this.props.reports
    if (reports.some(function (rep) { return rep.settings.name === report.settings.name })) {
      return this.setState({
        nameError: 'Name already exists!'
      })
    }

    this.setState({
      buttonLoadingText: 'Fetching Tabs...'
    })

    report.fetchTabsList()
      .then(() => {
        this.setState({
          buttonLoadingText: null,
          isCreatingReport: false,
          isSelectingReportTabs: true,
          report
        })
      })
      .catch(err => {
        this.setState({
          buttonLoadingText: null
        })
      })
  }

  handleSelectTabsSubmit () {
    events.emit('create_report', {
      report: this.state.report
    })

    this.handleCreateReportCancelled()
  }

  handleReportSelected (event, reportId) {
    if (!this.props.reports[reportId].history.length) {
      return
    }

    events.emit('view_report', {
      reportId
    })
  }

  handleLeagueSelected (event, index) {
    let report = this.state.report
    report.settings.league = this.props.leagues[index].id
    this.setState({
      report
    })
  }

  handleReportNameChange (event) {
    let report = this.state.report
    report.settings.name = event.target.value
    this.setState({
      report
    })
  }

  handleReportStashTabSelectAll (event) {
    let {report} = this.state

    report.data.stashTabs.forEach((tab, index) => {
      if (report.settings.tabsToSearch.indexOf(index) < 0) {
        report.settings.tabsToSearch.push(index)
      }
    })

    this.setState({
      report
    })
  }

  handleReportStashTabSelected (event, index) {
    let {report} = this.state
    let exists = report.settings.tabsToSearch.indexOf(index)

    if (exists > -1) {
      report.settings.tabsToSearch.splice(exists, 1)
    } else {
      report.settings.tabsToSearch.push(index)
    }

    this.setState({
      report
    })
  }

  renderDialogs () {
    let {report} = this.state

    return (
      <div className="dialogs">
        <Dialog
          open={this.state.isSelectingReportTabs}
          onRequestClose={this.handleCreateReportCancelled.bind(this)}
        >
          <DialogTitle>Select Report Tabs</DialogTitle>
          <DialogContent>
            <DialogContentText
              style={{marginBottom: 24}}
            >
              Selected tabs will be used determine how much worth they hold.
            </DialogContentText>

            <Grid container>
              {
                report && report.data.stashTabs
              ? report.data.stashTabs.map((tab, index) => (
                <Grid item
                  className='tab-selector'
                  key={index}
                  style={
                    report.settings.tabsToSearch.indexOf(index) > -1
                    ? {background: 'rgba(255,255,255,0.3)', margin: 5}
                    : {background: 'rgba(255,255,255,0)', margin: 5}
                  }
                  onClick={event => this.handleReportStashTabSelected(event, index)}
                >
                  <Typography component="span">
                    {tab.n}
                  </Typography>
                </Grid>
              )) : null}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={this.handleCreateReportCancelled.bind(this)} 
              style={{ opacity: '0.6' }}
              disabled={!!this.state.buttonLoadingText}
            >
              Cancel
            </Button>
            <Button 
              onClick={this.handleSelectTabsSubmit.bind(this)}
              disabled={!!this.state.buttonLoadingText}
            >
              {this.state.buttonLoadingText || 'Create Report 🎉'}
            </Button>
            <Button 
              onClick={this.handleReportStashTabSelectAll.bind(this)}
              disabled={!!this.state.buttonLoadingText}
              style={{ position: 'absolute', left: 16, bottom: 8, opacity: '0.6' }}
            >
              {this.state.buttonLoadingText || 'Select All Tabs'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={this.state.isCreatingReport} onRequestClose={this.handleCreateReportCancelled.bind(this)}>
          <DialogTitle>{"Create New Report"}</DialogTitle>
          <DialogContent>
            <DialogContentText
              style={{ marginBottom: 16 }}
            >
              Reports allow you to track and monitor your wealth in a league across multiple tabs.
            </DialogContentText>

            <div
              style={{ marginBottom: 16 }}
            >
              <Input
                error={!!this.state.nameError}
                id='name'
                placeholder='Report Name'
                defaultValue={this.state.defaultReportName}
                onChange={this.handleReportNameChange.bind(this)}
                fullWidth
                autoFocus
              />
              {this.state.nameError ? (
                <Typography style={{ fontSize: 14, marginTop: 8 }}>
                  ⚠️ {this.state.nameError}
                </Typography>
              ) : null}
            </div>

            <LeagueDropdown 
              labelText={'Report League'}
              leagues={this.props.leagues}
              onSelect={this.handleLeagueSelected.bind(this)}
            />
          </DialogContent>

          <DialogActions>
            <Button 
              onClick={this.handleCreateReportCancelled.bind(this)} 
              style={{ opacity: '0.6' }}
              disabled={!!this.state.buttonLoadingText}
            >
              Cancel
            </Button>
            <Button 
              onClick={this.handleCreateReportSubmit.bind(this)}
              disabled={!!this.state.buttonLoadingText}
            >
              {this.state.buttonLoadingText || 'Select Tabs'}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    )
  }

  renderEmptyView () {
    return (
      <Grid container
        className="draggable"
        align="center"
        justify="center"
        direction="column"
        style={{ height: 'calc(100vh - 95px)' }}
      >
        <Grid item className="not-draggable" style={{ textAlign: 'center' }}>
          <Typography type="title" component="h1" style={{ marginBottom: 8 }}>
            Hi <span style={{ color: 'rgba(229, 56, 77, 1)' }}>{getConfig(ConfigKeys.ACCOUNT_USERNAME)}</span> 🎄
          </Typography>

          <Typography type="title" component="h1" style={{ marginBottom: 8 }}>
            Looks like you aren't tracking any tabs!
          </Typography>

          <Typography component="p" style={{ opacity: '0.6' }}>
            Fortunately, it's pretty easy to get started! Show me what you got!
          </Typography>
        </Grid>

        <Grid item className="not-draggable" style={{ marginTop: 16, minWidth: 300 }}>
          <Grid container justify="center" direction="row">
            <Button raised style={{ backgroundColor: 'rgba(229, 56, 77, 1)', color: 'white' }} onClick={this.handleCreateReportButton.bind(this)}>
              Create your first report
            </Button>
          </Grid>
        </Grid>

        {this.renderDialogs()}
      </Grid>
    )
  }

  render () {
    let {report} = this.state

    if (!this.props.reports || !this.props.reports.length) {
      return this.renderEmptyView()
    }

    return (
      <Grid container>
        <Grid item>
          <Button className="btn-border" onClick={this.handleCreateReportButton.bind(this)}>Add Report</Button>
        </Grid>

        <Grid container
          className="report-list"
        >
          {this.props.reports.map((report, index) => {
            let {history} = report
            let hasChange = {
              change: 0,
              absChange: 0,
              direction: null
            }

            if (history && history.length > 1) {
              hasChange = getPercentageChange(history[1].reportTotal || 0, history[0].reportTotal || 0)
            }

            return (
              <Grid item
                key={index}
                xs
              >
                <div 
                  className="report-item"
                  onClick={event => this.handleReportSelected(event, index)}
                >
                  <div className="report-title">
                    <Typography className="report-name">
                      {report.settings.name}
                    </Typography>
                    <Typography className="report-league">
                      {report.settings.league}
                    </Typography>
                    {report.history.length ? (
                      <Typography className="report-meta">
                        {Ago(report.history[0].refreshedAt)}
                      </Typography>
                    ) : null}
                  </div>
                  {report.history.length ? (
                    <div className="report-item-meta">
                      <Typography className="amount" type="body1" component="p" style={{ fontSize: 18 }}>
                        {report.history[0].reportTotal.toFixed(2)} <span>C</span>
                      </Typography>
                      <Typography 
                        type="body1"
                        component="p"
                        className={`change ${hasChange.direction==='up'?'up':hasChange.direction==='down'?'down':''}`}
                      >
                        {hasChange.absChange !== 0
                          ? `${hasChange.direction==='up'?'+':'-'} ${hasChange.absChange}%`
                          : 'No Change'
                        }
                      </Typography>
                    </div>
                  ) : (
                    <div className="report-item-meta">
                      <Typography className="amount loading"></Typography>
                      <Typography className="change loading"></Typography>
                    </div>
                  )}
                </div>
              </Grid>
            )
          })}
        </Grid>

        {this.renderDialogs()}
      </Grid>
    )
  }
}

// Report Screen
class ReportScreen extends React.Component {
  state = {
    errorMessage: null
  }

  log = logger.topic('Currency Report')

  componentWillMount () {
    this.setState({
      settings: this.props.report.settings
    })
  }

  sendNotification (message) {
    this.log.info(message)
    return events.emit('notification', {
      message
    })
  }

  setErrorMessage (errorMessage) {
    return this.setState({
      errorMessage
    })
  }

  updateSettings (key, value) {
    if (!value && key) return this.setState({
      settings: key
    })

    this.setState({
      settings: {
        ...this.state.settings,
        [key]: value
      }
    })
  }

  calculateChaosValue (item) {
    return (item.stackSize || 0) * item.chaosValue
  }

  compareValueDescending (a, b) {
    return this.calculateChaosValue(b) - this.calculateChaosValue(a)
  }

  sortItemsByWorth (items) {
    return items.sort((a, b) => {
      return this.compareValueDescending(a, b)
    })
  }

  goToDashboard () {
    events.emit('stop_viewing_report', null)
  }

  showSettingsDialog () {
    this.setState({
      isEditingReportSettings: true,
      originalSettings: clone(this.props.report.settings),
      settings: clone(this.props.report.settings)
    })
  }

  handleReportSettingsCancelled () {
    this.setState({
      isEditingReportSettings: false,
      originalSettings: clone(this.props.report.settings),
      settings: clone(this.props.report.settings),
      errors: null
    })
  }

  validateField (field, value) {
    if (typeof value === 'string' && !value) {
      return 'Field cannot be empty!'
    }

    return false
  }

  handleChange (field) {
    return (event, checked) => {
      let {settings} = this.state
      let value, error = null

      if (typeof checked !== 'boolean') {
        value = event.target.value
        error = this.validateField(field, value)
      } else {
        value = checked
      }

      settings[field] = value

      this.setState({
        settings,
        errors: {
          ...this.state.errors,
          [field]: error
        }
      })
    }
  }

  handleReportStashTabSelected (event, index) {
    let {settings} = this.state
    let exists = settings.tabsToSearch.indexOf(index)

    if (exists > -1) {
      settings.tabsToSearch.splice(exists, 1)
    } else {
      settings.tabsToSearch.push(index)
    }

    this.setState({
      settings
    })
  }

  handleReportSettingsSave () {
    let {originalSettings, settings} = this.state
    let refreshOnSave = false

    // Clear the report history
    if (originalSettings.tabsToSearch.sort().toString() !== settings.tabsToSearch.sort().toString()) {
      this.props.report.history = []
      refreshOnSave = true
    }

    this.props.report.updateSettings(this.state.settings, refreshOnSave)

    if (!refreshOnSave) {
      events.emit('update_report', {
        report: this.props.report
      })

      this.handleReportSettingsCancelled()
    } else {
      this.goToDashboard()
    }
  }

  refreshTabsList () {
    let {report} = this.props
    report.fetchTabsList()
      .then(() => {
        events.emit('update_report', {
          report: this.props.report
        })
      })
  }

  deleteReport () {
    events.emit('delete_report', {
      report: this.props.report
    })
    this.goToDashboard()
  }

  render () {
    let { settings, data, history } = this.props.report
    if (!history || !history.length) {
      return null
    }

    let currentReport = history[0]
    let items = this.sortItemsByWorth(currentReport.report)
    let updatedTime = currentReport.refreshedAt
    let hasChange = {
      change: 0,
      absChange: 0,
      direction: null
    }

    if (items.length && this.state.filter) {
      let filter = this.state.filter.toLowerCase()
      items = items.filter(item => {
        return item.lname.indexOf(filter) > -1
      })
    }

    if (history.length > 1) {
      hasChange = getPercentageChange(history[1].reportTotal || 0, history[0].reportTotal || 0)
    }

    return (
      <div className="report-screen">
        <Grid 
          container
          className="report-header"
          align="center"
          justify="flex-start"
          direction="row"
          style={{
            width: '100%',
            height: '100%',
            margin: '0',
            overflow: 'auto',
            alignContent: 'flex-start'
          }}
        >
          <Grid item md={4} sm={4} xs={4} className="report-actions" style={{ padding: '0 8px' }}>
            <IconButton onClick={this.goToDashboard}><KeyboardArrowLeftIcon /></IconButton>
          </Grid>
          <Grid item md={4} sm={4} xs={4} className="report-title" style={{ padding: '0 8px', textAlign: 'center' }}>
            <Typography>{settings.name}</Typography>
          </Grid>
          <Grid item md={4} sm={4} xs={4} className="report-meta" style={{ 
            padding: '0 8px',
            alignItems: 'center',
            justifyContent: 'flex-end',
            display: 'flex'
          }}>
            <Button 
              className="btn-border" 
              style={{marginRight: 8}}
              onClick={this.props.report.refresh.bind(this.props.report)}
            >
              Refresh
            </Button>

            <Tooltip id="tooltip-icon" label="Coming Soon" placement="bottom">
              <Button className="btn-border">History</Button>
            </Tooltip>

            <IconButton onClick={this.showSettingsDialog.bind(this)}><SettingsIcon /></IconButton>
          </Grid>

          <Grid item xs={12}>
            <Paper className="report-total paper-box" style={{ padding: 16 }}>
              <Grid
                container
                align="center"
                justify="space-between"
                direction="row"
              >
                <Grid item sm={6} xs={12}>
                  <Typography type="body1" component="p" style={{ fontSize: 48 }}>
                    <img 
                      src="http://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollRare.png?scale=1&w=1&h=1"
                      style={{ 
                        verticalAlign: 'middle',
                        marginRight: '5px',
                        top: '-1px',
                        position: 'relative'
                      }}
                    />

                    {currentReport.reportTotal.toFixed(2)}
                  </Typography>
                  <Typography 
                    type="body1"
                    component="p"
                    className={`report-total-difference ${hasChange.direction==='up'?'up':hasChange.direction==='down'?'down':''}`}
                  >
                    {hasChange.absChange !== 0
                      ? `${hasChange.direction==='up'?'+':'-'} ${hasChange.absChange}%`
                      : 'No Change'
                    }
                  </Typography>
                  <Typography type="body1" component="p" style={{ 
                    fontSize: 11, 
                    fontWeight: 400, 
                    opacity: 0.2,
                    display: 'inline-block'
                  }}>
                    Last Updated: {Ago(updatedTime)}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid 
            item
            md={6}
            sm={6}
            xs={12}
            style={{ justifyContent: 'flex-start' }}>
            <Input
              placeholder="Filter..."
              style={{ width: '100%' }}
              onKeyUp={(event) => {
                this.setState({
                  filter: event.target.value
                })
              }}
            />
          </Grid>

          <Grid item md={6} sm={6} xs={12} style={{ 
            display: 'flex',
            justifyContent: 'flex-end' 
          }} />
        </Grid>

        <Grid container className="report-items">
        {items.map(item => item.stackSize ? (
          <Grid
            item
            key={item.name}
            md={4}
            sm={6}
            xs={12}
          >
            <Paper
            className="report-screen-item paper-box" 
              style={{
                padding: 8
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <Typography type="body1" component="p">
                  <img 
                    src={item.icon}
                    width={32}
                    style={{ verticalAlign: 'middle' }}
                    title={item.name}
                  />
                  ⨯ {item.stackSize || 0}
                </Typography>

                <Typography type="body1" component="p" style={{ padding: '10px 8px 8px 0px', color: 'rgba(255,255,255,0.5)' }}>
                  1 → {item.chaosValue}c
                </Typography>

                <Typography type="body1" component="p" style={{ color: '#FFCC80' }}>
                  {item.stackSize ? (item.stackSize * item.chaosValue).toFixed(2) : 0} ⨯
                  <img 
                    src="http://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollRare.png?scale=1&w=1&h=1"
                    style={{ width: '32px', verticalAlign: 'middle' }}
                  />
                </Typography>
              </div>
            </Paper>
          </Grid>
        ): null)}
        </Grid>

        <Dialog
          open={this.state.isEditingReportSettings}
          onRequestClose={this.handleReportSettingsCancelled.bind(this)}
        >
          <DialogTitle>Edit Report Settings</DialogTitle>

          <DialogContent>
            <DialogContentText style={{marginBottom: 24}}>
              Here you will find them dank report settings.
            </DialogContentText>

            <FormControl className="report-form-control" fullWidth>
              <InputLabel htmlFor="name">Name</InputLabel>
              <Input 
                id="name" 
                value={this.state.settings.name}
                onChange={this.handleChange('name')} 
              />
            </FormControl>

            <FormControl className="report-form-control" fullWidth>
              <InputLabel htmlFor="league">League</InputLabel>
              <Select
                value={this.state.settings.league}
                onChange={this.handleChange('league')}
                input={<Input id="league" />}
              >
                {this.props.leagues.map(league => (
                  <MenuItem key={league.id} value={league.id}>{league.id}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl className="report-form-control" fullWidth>
              <FormControlLabel
                control={
                  <Switch
                    checked={this.state.settings.autoRefresh}
                    onChange={this.handleChange('autoRefresh')}
                  />
                }
                label="Enable Auto-Refresh"
              />
            </FormControl>

            <FormControl className="report-form-control" fullWidth>
              <InputLabel htmlFor="auto-refresh-interval">Auto-Refresh Interval</InputLabel>
              <Select
                value={this.state.settings.autoRefreshInterval}
                onChange={this.handleChange('autoRefreshInterval')}
                input={<Input id="auto-refresh-interval" />}
              >
                <MenuItem value={1000 * 60 * 1}>Minute</MenuItem>
                <MenuItem value={1000 * 60 * 15}>15 Minutes</MenuItem>
                <MenuItem value={1000 * 60 * 30}>30 Minutes</MenuItem>
                <MenuItem value={1000 * 60 * 60}>Hour</MenuItem>
                <MenuItem value={1000 * 60 * 60 * 2}>2 Hours</MenuItem>
                <MenuItem value={1000 * 60 * 60 * 6}>6 Hours</MenuItem>
                <MenuItem value={1000 * 60 * 60 * 24}>Day</MenuItem>
              </Select>
            </FormControl>

            <FormControl className="report-form-control" fullWidth>
              <FormControlLabel
                control={
                  <Switch
                    checked={this.state.settings.autoRefreshTabs}
                    onChange={this.handleChange('autoRefreshTabs')}
                  />
                }
                label="Refresh Tabs?"
              />
            </FormControl>

            <FormControl className="report-form-control" fullWidth>
              <FormControlLabel
                control={
                  <Switch
                    checked={this.state.settings.autoRefreshRates}
                    onChange={this.handleChange('autoRefreshRates')}
                  />
                }
                label="Refresh Item Rates?"
              />
            </FormControl>

            <FormControl className="report-form-control" fullWidth>
              <FormControlLabel
                control={
                  <Switch
                    checked={this.state.settings.onlySearchTabsWithCurrency}
                    onChange={this.handleChange('onlySearchTabsWithCurrency')}
                  />
                }
                label="Only refresh tabs currency was found in?"
              />
            </FormControl>

            <FormControl className="report-form-control report-form-tabs-list" fullWidth>
              <Typography style={{ marginBottom: 16 }}>Tabs report applies to: <span>(this will clear tab history!)</span></Typography>
              <Grid container>
                {data.stashTabs.map((tab, index) => (
                  <Grid item
                    className='tab-selector'
                    key={index}
                    style={
                      this.state.settings.tabsToSearch.indexOf(index) > -1
                      ? {background: 'rgba(255,255,255,0.3)', margin: 5}
                      : {background: 'rgba(255,255,255,0)', margin: 5}
                    }
                    onClick={event => this.handleReportStashTabSelected(event, index)}
                  >
                    <Typography component="span">
                      {tab.n}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
            </FormControl>

            <Button onClick={this.refreshTabsList.bind(this)} className="btn-border">Refresh Tabs List</Button>
          </DialogContent>

          <DialogActions>
            <Button onClick={this.deleteReport.bind(this)} style={{ opacity: '0.5' }}>Delete Report</Button>

            <Button 
              onClick={this.handleReportSettingsCancelled.bind(this)} 
              style={{ opacity: '0.5' }}
              disabled={!!this.state.buttonLoadingText}
            >
              Cancel
            </Button>
            <Button 
              onClick={this.handleReportSettingsSave.bind(this)}
              disabled={!!this.state.buttonLoadingText}
            >
              {this.state.buttonLoadingText || 'Save Settings'}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    )
  }
}

// Login Screen
class LoginScreen extends React.Component {
  state = {
    value: '',
    error: false
  }

  componentWillMount() {
    this.setState({ 
      value: this.props.value || ''
    })
  }

  componentWillUpdate(nextProps) {
    if (nextProps.value !== this.props.value) {
      // eslint-disable-next-line react/no-will-update-set-state
      this.setState({
        value: nextProps.value 
      })
    }
  }

  componentWillUnmount () {
    this.setState({
      error: null
    })
  }

  handleChange = (event, value) => {
    this.setState({ value })
  }

  handleLoginButtonClick () {
    let {value} = this.state

    if (!value) {
      return this.setState({
        error: 'Identifier is required!'
      })
    }

    if (!Constants.POE_COOKIE_REGEXP.test(value)) {
      return this.setState({
        error: `POESESSIONID must be a 32 character hexadecimal string!`
      })
    }

    // Attempt login
    this.props.onLogin(value)
  }

  render() {
    const { value, ...other } = this.props

    let thread = 'https://www.pathofexile.com/forum/view-thread/1989935/page/9#p14857124'

    return (
      <Grid container
        className="draggable"
        align="center"
        justify="center"
        direction="column"
        style={{ height: '100vh' }}
      >
        <Grid item
          className="not-draggable"
          style={{ textAlign: 'center' }}
        >
          <Typography
            type="title"
            component="h1"
          >
            Login to Path of Exile
          </Typography>

          <Typography
            type="body1"
            component="p"
            color="secondary"
            style={{ marginTop: 16 }}
          >
            👮 Need help finding your session id?&nbsp;
            <a href={thread} onClick={GoToUrl.bind(this)}>
              Click here!
            </a>
          </Typography>
        </Grid>

        <Grid item
          className="not-draggable"
          style={{ minWidth: 300, marginTop: 24, marginBottom: 32 }}
        >
          <Grid container
            justify="flex-start"
            direction="column"
          >
            <Input
              error={!!this.state.error}
              id={Constants.POE_COOKIE_NAME}
              placeholder={Constants.POE_COOKIE_NAME}
              value={this.state.value}
              onChange={event => this.setState({ 
                value: event.target.value 
              })}
              fullWidth
              autoFocus
            />

            {this.state.error ? (
              <Typography style={{ fontSize: 14, marginTop: 8 }}>
                ⚠️ {this.state.error}
              </Typography>
            ) : null}
          </Grid>
        </Grid>

        <Grid item
          className="not-draggable"
          style={{ minWidth: 300 }}
        >
          <Grid container
            justify="flex-end"
            direction="row"
          >
            <Button raised color="accent" onClick={this.handleLoginButtonClick.bind(this)}>
              Login
            </Button>
          </Grid>
        </Grid>
      </Grid>
    )
  }
}

// Loading Screen
class LoadingScreen extends React.Component {
  render () {
    return (
      <Grid 
        container
        align="center"
        justify="center"
        direction="row"
        spacing={0} 
        style={{
          height: '100%'
        }}
      >
        <Grid item>
          <Typography type="body1" component="p">
            {this.props.message}
          </Typography>
        </Grid>
      </Grid>
    )
  }
}

// AppControl Buttons
class AppControl extends React.Component {
  componentWillMount () {
    this.setState({
      window: remote.getCurrentWindow()
    })

    this.handleFullscreenButtonClick = this.handleFullscreenButtonClick.bind(this)
    this.handleMinimizeButtonClick = this.handleMinimizeButtonClick.bind(this)
    this.handleCloseButtonClick = this.handleCloseButtonClick.bind(this)
  }

  handleMinimizeButtonClick () {
    this.state.window.minimize()
  }

  handleFullscreenButtonClick () {
    let {window} = this.state

    if (process.platform === 'darwin') {
      if (!window.isFullScreen()) {
        window.setFullScreen(true)
      }

      window.setFullScreen(false)
    }

    if (!window.isMaximized()) {
      return window.maximize()
    }

    window.unmaximize()
  }

  handleCloseButtonClick () {
    this.state.window.close()
  }

  render () {
    let link = "https://poe.technology/releases"
    return (
      <div className="app-control">
        <div className="app-update">
          {!this.props.upToDate && this.props.newVersion ? (
              <Tooltip id="tooltip-icon" label={`New Version Available! v${this.props.newVersion}`} placement="bottom">
                <IconButton aria-label="New Version">
                  <a href={link} onClick={GoToUrl}>
                    <CloudDownloadIcon />
                  </a>
                </IconButton>
              </Tooltip>
            ) : null}
        </div>
        <div className="minimize-control" onClick={this.handleMinimizeButtonClick}></div>
        <div className="fullscreen-control" onClick={this.handleFullscreenButtonClick}></div>
        <div className="close-control" onClick={this.handleCloseButtonClick}></div>
      </div>
    )
  }
}

// Nav Bar Component
class AppNavBar extends React.Component {
  render () {
    return (
      <div className='draggable' style={{
        width: '100%',
        position: 'fixed',
        top: 25,
        left: 0,
        right: 0,
        padding: `0 0 5px 0`,
        width: 'auto',
        borderBottom: '1px solid hsla(0, 0%, 100%, 0.05)'
      }}>
        <AppBar position="static" style={{ backgroundColor: 'transparent', boxShadow: 'none', userSelect: 'none' }}>
          <Toolbar style={{ padding: `0 15px` }}>
            <Typography className="header-title" type="title" color="inherit" style={{ flex: 1 }}>
              <img className="header-logo" src={require('../assets/logo.png')} />
              Currency Cop
            </Typography>
            {getConfig(ConfigKeys.ACCOUNT_USERNAME) ? ( <AccountActions /> ) : null}
          </Toolbar>
        </AppBar>
      </div>
    )
  }
}

// Application Root
class App extends React.Component {
  state = {
    config: null,
    leagues: null,
    reports: null,
    isLoggedIn: false,
    isLoading: false,
    isViewingReport: false,
    upToDate: true
  }

  styles = {
    root: {
      paddingTop: theme.spacing.unit,
      paddingBottom: theme.spacing.unit,
      paddingLeft: theme.spacing.unit * 2,
      paddingRight: theme.spacing.unit * 2
    }
  }

  clearConfig () {
    Config = DefaultConfig()
    ConfigFile.save(Config)

    this.setState({
      isLoggedIn: false,
      config: Config
    })
  }

  updateConfig (key, value) {
    Config[key] = value
    ConfigFile.save(Config)
    return this.setState({
      config: {
        ...this.state.config,
        [key]: value
      },
      _updated: Date.now()
    })
  }

  createReport (report) {
    let {reports} = this.state

    reports.push(report)
    ReportFile.save(reports)

    return this.setState({
      reports
    }, () => {
      report.fetch(true, true).then(() => {
        this.updateReports(reports)
      })
    })
  }

  deleteReport (report) {
    let {reports} = this.state
    reports.forEach(function (item, index, object) {
      if (item.id === report.id) {
        object.splice(index, 1);
      }
    })
    return this.updateReports(reports)
  }

  updateReport (newReport) {
    let {reports} = this.state
    reports.forEach(report => {
      if (report.id === newReport.id) {
        report = newReport
      }
    })
    return this.updateReports(reports)
  }

  updateReports (reports) {
    ReportFile.save(reports)
    return this.setState({
      reports
    })
  }

  setLoadingMessage (message) {
    return this.setState({
      isLoading: message
    })
  }

  load () {
    return Promise.resolve()
      .then(() => {
        Log.info(`Loading Currency Cop v${AppVersion}`)
        this.setLoadingMessage('Loading Configuration')
      })
      .then(() => ConfigFile.load(DefaultConfig()))
      .then(config => {
        Config = config
        return this.setState({
          config: Config
        })
      })
      .then(() => {
        this.setLoadingMessage('Loading Reports')
      })
      .then(() => ReportFile.load([]))
      .then(reports => {
        return this.setState({
          reports: reports
        })
      })
      .then(() => {
        this.setLoadingMessage('Fetching Leagues')
      })
      .then(() => GetLeagues())
      .then(response => {
        return this.setState({
          leagues: response.data
        })
      })
      .then(() => {
        this.setLoadingMessage('Checking Session')
      })
      .then(() => this.handleLogin())
      .then(() => {
        this.setLoadingMessage('Setting up Reports')
      })
      .then(() => this.handleReports())
      .then(() => {
        this.setLoadingMessage((
          <span style={{ color: 'rgba(239, 157, 58, 1.0)', fontWeight: 'bold' }}>[ Currency Cop ]</span>
        ))
      })
      .then(() => {
        setTimeout(() => {
          this.setLoadingMessage(false)
        }, 200)
      })
      .then(() => DoVersionCheck())
      .then(resp => {
        if (resp.data.version !== AppVersion) {
          this.setState({
            upToDate: false,
            newVersion: resp.data.version
          })
        }
      })
      .catch(error => {
        this.setLoadingMessage('Houston, we have a problem.')
        Log.error(`[App] Error occurred during load: ${error.message} - ${error.stack}`)
      })
  }

  handleReports () {
    if (this.state.isLoggedIn) {
      let cookie = getConfig(ConfigKeys.ACCOUNT_COOKIE)
      let account = getConfig(ConfigKeys.ACCOUNT_USERNAME)
      let {reports} = this.state
      let changed = false

      // Create Report Object
      // Update Report Cookies
      // Create Report Id
      reports.forEach((report, index) => {
        if (report.account === account) {
          if (report.cookie !== cookie) {
            report.cookie = cookie
            changed = true
          }
        }

        if (!report.id) {
          report.id = UUID()
        }

        reports[index] = new ReportBuilder(report)
      })

      // Start Report Fetching
      reports.forEach((report, index) => {
        if (report.history.length < 1) {
          report.fetch(true, true)
            .then(() => this.updateReport(index, report))
            .then(() => report.enableAutoRefresh())
        } else {
          report.enableAutoRefresh()
        }
      })

      if (changed) {
        this.updateReports(reports)
      }
    }
  }

  handleLogin (value) {
    value = value || this.state.config[ConfigKeys.ACCOUNT_COOKIE]
    if (!value) {
      return
    }

    return LoginWithCookie(value)
      .then(response => {
        if (response.status != 302) {
          ApiLog.warn(`${response.status} status response for [LOGIN]: Expired Session ID`)
          throw ({
            snack: 'Session expired. Try re-logging into pathofexile.com to get a new Session ID.'
          })
        }

        return GetAccountName(value)
      })
      .then(response => {
        if (!response) {
          ApiLog.warn(`Empty response from [POE_ACCOUNT_NAME]: Server failed to respond?`)
          throw ({
            snack: 'Server failed to respond during login. Please re-login.'
          })
        }

        let matches = response.data.match(Constants.POE_ACCOUNT_NAME_REGEXP)
        if (!matches[1]) {
          Log.error(`Unable to find account name on [POE_ACCOUNT_NAME] request: ${response.data}`)
          throw ({
            snack: 'Failed to find account name.'
          })
        }

        let accountName = decodeURIComponent(matches[1])
        this.updateConfig(ConfigKeys.ACCOUNT_USERNAME, accountName)
        this.updateConfig(ConfigKeys.ACCOUNT_COOKIE, value)

        events.emit('notificaton', {
          message: `Logged in as: ${accountName}`
        })

        this.setState({
          isLoggedIn: true
        })
      })
      .catch(error => {
        if (error.message) {
          Log.critical(`[Login] Error occurred: ${error.message} - ${error.stack}`)
        }

        events.emit('clear_config')
        events.emit('notification', {
          message: error.snack || `Login failed... Please try again!`,
          action: CopyLogsButton
        })
      })
  }

  componentWillMount () {
    events.on('create_report', event => {
      EventLog.info(`Saving & starting report ${event.report.settings.name}`)
      this.createReport(event.report)
    })
    
    events.on('view_report', event => {
      EventLog.info(`Viewing Report ${event.reportId}`)
      this.setState({
        isViewingReportId: event.reportId,
        isViewingReport: this.state.reports[event.reportId]
      })
    })

    events.on('delete_report', event => {
      EventLog.info(`Deleting report`)
      this.deleteReport(event.report)
    })

    events.on('update_report', event => {
      EventLog.info(`Updating report`)
      this.updateReport(event.report)
    })

    events.on('stop_viewing_report', event => {
      EventLog.info(`Stopped viewing report`)
      this.setState({
        isViewingReportId: null,
        isViewingReport: null
      })
    })

    events.on('update_config', event => {
      EventLog.info('Updating configuration')
      this.updateConfig(event.key, event.value)
    })

    events.on('clear_config', event => {
      EventLog.info('Clearing configuration')
      this.clearConfig()
    })

    events.on('notification', event => {
      EventLog.info('Global notification occurred', event.message)

      this.setState({
        globalSnackMessage: event.message,
        globalSnackAction: event.action || null
      })

      setTimeout(() => {
        this.setState({
          globalSnackMessage: null,
          globalSnackAction: null
        })
      }, 5000)
    })

    // Begin fetching application data
    return this.load()
  }

  componentWillUnmount () {
    events.off('create_report')
    events.off('delete_report')
    events.off('update_report')
    events.off('view_report')
    events.off('stop_viewing_report')
    events.off('update_config')
    events.off('clear_config')
    events.off('notification')
  }

  render() {
    if (this.state.isLoading) {
      return (
        <MuiThemeProvider theme={theme}>
          <withTheme>
            <AppControl />
            <LoadingScreen message={this.state.isLoading} />
          </withTheme>
        </MuiThemeProvider>
      )
    }

    if (!this.state.isLoggedIn) {
      return (
        <MuiThemeProvider theme={theme}>
          <withTheme>
            <AppControl />
            <LoginScreen onLogin={this.handleLogin.bind(this)} />
          </withTheme>
        </MuiThemeProvider>
      )
    }

    return (
      <MuiThemeProvider theme={theme}>
        <withTheme>
          <AppControl
            upToDate={this.state.upToDate}
            newVersion={this.state.newVersion}
           />

          <AppNavBar 
            config={this.state.config}
          />

          <div style={{
              position: 'fixed',
              padding: 15,
              top: 94,
              left: 0,
              right: 0
            }}
          >
            {!this.state.isViewingReport ? (
              <DashboardScreen
                config={this.state.config}
                leagues={this.state.leagues}
                reports={this.state.reports}
              />
            ) : null}

            {this.state.isViewingReport ? (
              <ReportScreen
                config={this.state.config}
                report={this.state.isViewingReport}
                reportId={this.state.isViewingReportId}
                leagues={this.state.leagues}
              />
            ) : null}
          </div>

          <Snackbar
            open={!!this.state.globalSnackMessage}
            action={this.state.globalSnackAction}
            onRequestClose={this.handleSnackRequestClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            message={(
              <span id="global-message-id">{this.state.globalSnackMessage}</span>
            )}
          />
        </withTheme>
      </MuiThemeProvider>
    );
  }
}

export default App
