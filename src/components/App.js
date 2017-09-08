// Core
import '../assets/css/App.css'
import Constants from '../constants'

// Third Party
import { ipcRenderer, shell, remote } from 'electron'
import React, { Component } from 'react'
import Logger from '../logger'
import Axios from 'axios'
import Queue from '../queue'
import Ago from '../ago'
import path from 'path'
import fs from 'fs'

// Material UI
import { MuiThemeProvider, createMuiTheme, withTheme, withStyles } from 'material-ui/styles'
import { FormGroup, FormControlLabel } from 'material-ui/Form'
import Checkbox from 'material-ui/Checkbox'
import Dialog, { DialogActions, DialogContent, DialogContentText, DialogTitle } from 'material-ui/Dialog'
import List, { ListItem, ListItemText } from 'material-ui/List'
import Menu, { MenuItem } from 'material-ui/Menu'
import Radio, { RadioGroup } from 'material-ui/Radio'
import Input from 'material-ui/Input/Input'
import Grid from 'material-ui/Grid'
import Paper from 'material-ui/Paper'
import AppBar from 'material-ui/AppBar'
import Toolbar from 'material-ui/Toolbar'
import Typography from 'material-ui/Typography'
import IconButton from 'material-ui/IconButton'
import MenuIcon from 'material-ui-icons/Menu'
import Button from 'material-ui/Button'
import TextField from 'material-ui/TextField'
import Snackbar from 'material-ui/Snackbar'
import Divider from 'material-ui/Divider'

// Material UI Colors
import blueGrey from 'material-ui/colors/blueGrey'
import orange from 'material-ui/colors/orange'

// Application folder location
const userDataPath = remote.app.getPath('userData')
const logsDataPath = path.join(userDataPath, 'Logs')
const userConfigFilename = path.join(userDataPath, 'User.db')

// Configure Logger
const logger = new Logger({
  logdir: logsDataPath,
  level: 1
})

// Create Core Loggers
const Log = logger.topic('Core')
const ConfigLog = logger.topic('Config')
const ApiLog = logger.topic('API')

// Capture uncaught errors
process.on('uncaughtException', function (error) {
  Log.critical(`Uncaught error: ${error.message} - ${error.stack}`)
})

// Configuration
let ConfigKeys = {
  ACCOUNT_COOKIE:                       'ACCOUNT_COOKIE',
  ACCOUNT_LEAGUE_INDEX:                 'ACCOUNT_LEAGUE_INDEX',
  ACCOUNT_USERNAME:                     'ACCOUNT_USERNAME',
  ACCOUNT_CHARACTERS:                   'ACCOUNT_CHARACTERS',
  ACCOUNT_CHARACTER_INDEX:              'ACCOUNT_CHARACTER_INDEX',
  ACCOUNT_NET_WORTH:                    'ACCOUNT_NET_WORTH',
  ACCOUNT_STASHES:                      'ACCOUNT_STASHES',
  ACCOUNT_TABS:                         'ACCOUNT_TABS',
  ACCOUNT_LAST_UPDATE:                  'ACCOUNT_LAST_UPDATE',
  NINJA_PRICES:                         'NINJA_PRICES'
}

let DefaultConfig = function () {
  return {
    [ConfigKeys.ACCOUNT_COOKIE]:              null,
    [ConfigKeys.ACCOUNT_LEAGUE]:              null,
    [ConfigKeys.ACCOUNT_LEAGUE_INDEX]:        null,
    [ConfigKeys.ACCOUNT_USERNAME]:            null,
    [ConfigKeys.ACCOUNT_CHARACTERS]:          null,
    [ConfigKeys.ACCOUNT_CHARACTER_INDEX]:     null,
    [ConfigKeys.ACCOUNT_NET_WORTH]:           null,
    [ConfigKeys.ACCOUNT_STASHES]:             null,
    [ConfigKeys.ACCOUNT_TABS]:                null,
    [ConfigKeys.NINJA_PRICES]:                null,
    [ConfigKeys.ACCOUNT_LAST_UPDATE]:         null
  }
}

// Config
let Config = DefaultConfig()

// Helpers
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

// Configuration Helpers
function loadConfig () {
  try {
    ConfigLog.info(`Loading configuration file from: ${userConfigFilename}`)
    Config = JSON.parse(fs.readFileSync(userConfigFilename))
  } catch(error) {
    Config = DefaultConfig()
    ConfigLog.warn(`Could not load configuration file: ${error.message}`)
  }
}

function saveConfig () {
  try {
    ConfigLog.info(`Saving configuration file to: ${userConfigFilename}`)
    fs.writeFileSync(userConfigFilename, JSON.stringify(Config))
  } catch (error) {
    ConfigLog.critical(`Could not save configuration file: ${error.message}`)
  }
}

function clearConfig () {
  try {
    ConfigLog.info(`Clearing configuration file at: ${userConfigFilename}`)
    Config = JSON.parse(JSON.stringify(DefaultConfig))
    saveConfig()
  } catch (error) {
    ConfigLog.critical(`Could not clear configuration file: ${error.message}`)
  }
}

function setConfig (key, value) {
  try {
    ConfigLog.info(`Updating configuration key [${key}] in: ${userConfigFilename}`)
    Config[key] = value
    saveConfig()
  } catch (error) {
    ConfigLog.critical(`Could not update configuration key [${key}]: ${error.message}`)
  }
}

function getConfig (key) {
  try {
    return Config[key]
  } catch (error) {
    ConfigLog.warn(`Could not get configuration key [${key}] from config: ${error.message}`)
    return null
  }
}

// App Theme
const theme = createMuiTheme({
  palette: {
    type: 'dark',
    primary: blueGrey,
    secondary: blueGrey,
    background: {
      paper: blueGrey[700]
    }
  }
})

// Api
function GoToUrl (url, event) {
  if (url && url.preventDefault) {
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
  ApiLog.debug(`Making HTTP request to: ${options.url}`)
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
    Log.debug(`[League Dropdown] Passed League Index ${this.props.selectedIndex}`)

    this.setState({
      selectedIndex: this.props.selectedIndex || 4
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

// Login Dialog
class LoginDialog extends React.Component {
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

  handleExiting = () => {
    this.setState({
      error: null
    })
  }

  handleCancel = () => {
    this.props.onRequestClose(this.state, true)
  }

  handleOk = () => {
    if (!this.state.value) {
      return this.setState({
        error: 'Identifier is required!'
      })
    }

    if (!Constants.POE_COOKIE_REGEXP.test(this.state.value)) {
      return this.setState({
        error: `POESESSIONID must be a 32 character hexadecimal string!`
      })
    }

    this.props.onRequestClose(this.state)
  }

  handleChange = (event, value) => {
    this.setState({ value })
  }

  render() {
    const { value, ...other } = this.props

    return (
      <Dialog
        ignoreBackdropClick
        ignoreEscapeKeyUp
        onExiting={this.handleExiting}
        {...other}
      >
        <DialogTitle>Login to Path of Exile</DialogTitle>
        <DialogContent>
          <DialogContentText>
            👮 Need help finding your session id? <a href="https://www.pathofexile.com/forum/view-thread/1989935/page/9#p14857124" onClick={GoToUrl.bind(this)}>Click here!</a>
          </DialogContentText>

          <TextField
            error={!!this.state.error}
            label={this.state.error}
            id={Constants.POE_COOKIE_NAME}
            label={Constants.POE_COOKIE_NAME}
            value={this.state.value}
            style={{
              marginTop: 24
            }}
            onChange={event => this.setState({ 
              value: event.target.value 
            })}
            fullWidth
            margin="normal"
          />

          {this.state.error ? (
            <DialogContentText style={{ fontSize: 14 }}>
              ⚠️ {this.state.error}
            </DialogContentText>
          ) : null}

        </DialogContent>
        <DialogActions>
          <Button onClick={this.handleCancel} color="accent">
            Cancel
          </Button>
          <Button onClick={this.handleOk}>
            Login
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
}

// Login Button
class LoginButton extends React.Component {
  state = {
    dialogOpen: false,
    snackOpen: false,
    snackMessage: ''
  }

  toggleDialog = () => {
    this.setState({
      dialogOpen: !this.state.dialogOpen
    })
  }
  
  toggleSnack = () => {
    this.setState({
      snackOpen: !this.state.snackOpen
    })
  }

  handleSnack = snackMessage => {
    this.setState({
      snackMessage,
      snackOpen: true
    })
  }

  handleLoginButtonClick = event => {
    this.toggleDialog()
  }

  handleSnackRequestClose = () => {
    this.setState({ snackOpen: false })
  }

  handleDialogRequestClose = (state, cancelled) => {
    let {value} = state

    // Update component state
    this.setState({
      value 
    })

    // Attempt login
    if (!cancelled && value) {
      return LoginWithCookie(value)
        .then(response => {
          if (response.status != 302) {
            return this.handleSnack('Failed to log in! Expired session id? Try refreshing your session id!')
          }

          this.handleSnack('Login Successful! Fetching account...')
          setConfig(ConfigKeys.ACCOUNT_COOKIE, value)

          return GetAccountName(value)
        })
        .then(response => {
          this.toggleSnack()

          let matches = response.data.match(Constants.POE_ACCOUNT_NAME_REGEXP)
          if (!matches[1]) {
            return this.handleSnack('Failed to find account name...')
          }

          let accountName = decodeURIComponent(matches[1])
          this.handleSnack(`Logged in as: ${accountName}`)
          this.props.updateConfig(ConfigKeys.ACCOUNT_USERNAME, accountName)
          this.props.updateConfig(ConfigKeys.ACCOUNT_LEAGUE_INDEX, 4)
          this.props.updateConfig(ConfigKeys.ACCOUNT_COOKIE, value)

          return GetCharacters(
            value,
            accountName
          )
        })
        .then(response => {
          this.props.updateConfig(ConfigKeys.ACCOUNT_CHARACTERS, response.data)
        })
        .catch(error => {
          Log.critical(`[Login] Error occurred: ${error.message} - ${error.stack}`)
          return this.handleSnack(`Login failed... Please try again!`)
        })
    }

    // Attempted to login but no value passed
    if (!cancelled && !value) {
      return this.handleSnack('Cookie Session is required to login!')
    }

    this.toggleDialog()
  }

  render () {
    let props = this.props

    return (
      <div className="account-actions">
        <Button dense onClick={this.handleLoginButtonClick}>Login</Button>

        <Snackbar
          open={this.state.snackOpen}
          onRequestClose={this.handleSnackRequestClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          message={(
            <span id="login-message-id">{this.state.snackMessage}</span>
          )}
        />

        <LoginDialog
          open={this.state.dialogOpen}
          onRequestClose={this.handleDialogRequestClose}
        />
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
    this.props.clearConfig()
  }

  handleLeagueSelect (event, index) {
    let {updateConfig} = this.props
    updateConfig(ConfigKeys.ACCOUNT_LEAGUE_INDEX, index)
  }

  handleCharacterSelect (event, index) {
    let {updateConfig} = this.props
    updateConfig(ConfigKeys.ACCOUNT_CHARACTER_INDEX, index)
  }

  render () {
    let {leagues, leagueIndex, characters, config} = this.props

    return (
      <div className="account-actions" style={{ display: 'flex' }}>
        <LeagueDropdown
          leagues={leagues}
          selectedIndex={leagueIndex}
          onSelect={this.handleLeagueSelect.bind(this)}
        />
        <LogoutButton onClick={this.handleLogoutClick.bind(this)}>
          {decodeURIComponent(config[ConfigKeys.ACCOUNT_USERNAME])} (logout)
        </LogoutButton>
      </div>
    )
  }
}

// Account Component
class Account extends React.Component {
  render () {
    if (Config.ACCOUNT_COOKIE) {
      return (
        <AccountActions 
          config={this.props.config}
          leagues={this.props.leagues}
          leagueIndex={this.props.leagueIndex}
          characters={this.props.characters}
          clearConfig={this.props.clearConfig}
          updateConfig={this.props.updateConfig}
        />
      )
    }

    return (
      <LoginButton
        config={this.props.config}
        leagues={this.props.leagues}
        updateConfig={this.props.updateConfig}
      />
    )
  }
}

// Dashboard Component
class Dashboard extends React.Component {
  state = {
    loading: `Figuring out what to do...`,
    error: null,
    sortByType: true,
    sortByWorth: false,
    prices: {},
    stashes: {},
    tabs: {},
    netWorth: {},
    updated: {}
  }

  componentWillMount () {
    Log.info('[Dashboard]', 'Mounting')

    let {
      ACCOUNT_NET_WORTH, ACCOUNT_STASHES, ACCOUNT_TABS, 
      ACCOUNT_LAST_UPDATE, NINJA_PRICES
    } = ConfigKeys

    let {
      config,
      league
    } = this.props

    if (!league) {
      Log.info('[Dashboard] League index property is empty, rendering login message')
      return
    }

    this.state.interval = setInterval(() => {
      Log.info('[Dashboard] Refreshing dashboard for tab last updated')
      this.setState({
        _refresh: Math.random()
      })
    }, 60 * 1000)

    let yesterday = Date.now() - (1000*60*60*24*2)

    if (
        config[ACCOUNT_NET_WORTH]
    &&  config[ACCOUNT_STASHES]
    &&  config[ACCOUNT_TABS]
    &&  config[NINJA_PRICES]
    &&  config[ACCOUNT_LAST_UPDATE]
    &&  config[ACCOUNT_LAST_UPDATE][league]
    &&  config[ACCOUNT_LAST_UPDATE][league].prices > yesterday
    ) {
      Log.info('[Dashboard] Loading state with Configuration data')
      return this.setState({
        netWorth: config[ACCOUNT_NET_WORTH],
        stashes: config[ACCOUNT_STASHES],
        tabs: config[ACCOUNT_TABS],
        prices: config[NINJA_PRICES],
        updated: config[ACCOUNT_LAST_UPDATE],
        loading: false
      }, () => {
        Log.info('[Dashboard] Running league fetch mechanisms')
        return this.handleFetchingLeagueData(
          league,
          config
        )
      })
    }

    Log.info('[Dashboard] Running league fetch mechanisms')
    return this.handleFetchingLeagueData(
      league,
      config
    )
  }

  componentWillUpdate (nextProps) {
    if (!nextProps.league && this.state.prices && Object.keys(this.state.prices).length !== 0) {
      Log.warn('[Dashboard] Resetting state due to missing league')
      return this.setState({
        loading: `Figuring out what to do...`,
        error: null,
        prices: {},
        stashes: {},
        tabs: {},
        netWorth: {},
        updated: {}
      })
    }

    if (nextProps.league != this.props.league) {
      Log.warn('[Dashboard] Fetching league data due to league change')
      return this.handleFetchingLeagueData(
        nextProps.league,
        nextProps.config
      )
    }
  }

  processNinjaData (league, type, data) {
    return new Promise((resolve, reject) => {
      let prices = this.state.prices[league] || []
      let priceExists = (itemName) => {
        let litemName = itemName.toLowerCase()
        return prices.find(value => value.lname === litemName)
      }

      // Item {
      //   orderId: 0,
      //   name: '',
      //   lname: '',
      //   chaosValue: 0,
      //   icon: '',
      // }

      // Data is separated out, we need to combine
      if (data.currencyDetails) {
        let getCurrencyDetailsItem = (itemName) => {
          return data.currencyDetails.find(value => value.name === itemName)
        }

        if (data.lines && data.lines.forEach) {
          data.lines.forEach(lineItem => {
            let exists = priceExists(lineItem.currencyTypeName)
            if (exists) return

            let details = getCurrencyDetailsItem(lineItem.currencyTypeName)
            let item = {}

            item.name = lineItem.currencyTypeName
            item.lname = item.name.toLowerCase()
            item.icon = details.icon
            item.chaosValue = lineItem.chaosEquivalent
            item.orderId = details.poeTradeId
            item.type = type

            prices.push(item)
          })
        }

        return this.setState({
          prices: {
            ...this.state.prices,
            [league]: prices
          }
        }, () => resolve())
      }

      if (data.lines && data.lines.forEach) {
        data.lines.forEach(lineItem => {
          let exists = priceExists(lineItem.name)
          if (exists) return

          let item = {}

          item.name = lineItem.name
          item.lname = item.name.toLowerCase()
          item.icon = lineItem.icon
          item.chaosValue = lineItem.chaosValue
          item.orderId = lineItem.id
          item.type = type

          prices.push(item)
        })
      }

      return this.setState({
        prices: {
          ...this.state.prices,
          [league]: prices
        }
      }, () => resolve())
    })
  }

  fetchEssencePrices (league,  queue) {
    queue = queue || new Queue(1)

    return queue.unshift(() => new Promise((resolve, reject) => {
      return GetEssenceOverview(league, getNinjaDate())
        .then(response => {
          if (response.status !== 200) {
            return this.fetchEssencePrices(league, queue)
          }

          return this.processNinjaData(league, 'essence', response.data)
        })
        .then(() => resolve())
    }))
  }

  fetchFragmentPrices (league,  queue) {
    queue = queue || new Queue(1)

    return queue.unshift(() => new Promise((resolve, reject) => {
      return GetFragmentOverview(league, getNinjaDate())
        .then(response => {
          if (response.status !== 200) {
            return this.fetchFragmentPrices(league, queue)
          }

          return this.processNinjaData(league, 'fragment', response.data)
        })
        .then(() => resolve())
    }))
  }

  fetchCurrencyPrices (league,  queue) {
    queue = queue || new Queue(1)

    return queue.unshift(() => new Promise((resolve, reject) => {
      return GetCurrencyOverview(league, getNinjaDate())
        .then(response => {
          if (response.status !== 200) {
            return this.fetchCurrencyPrices(league, queue)
          }

          return this.processNinjaData(league, 'currency', response.data)
        })
        .then(() => resolve())
    }))
  }

  handleFetchingLeagueData (league, config) {
    let queue = new Queue(1)
    let tabs = []

    if (
       this.state.tabs
    && this.state.tabs[league]
    && this.state.stashes
    && this.state.stashes[league]
    && this.state.prices
    && this.state.prices[league]
    ) {
      Log.info('[Dashboard] Skipping API calls and processing existing tabs')
      return this.setState({
        netWorth: this.processTabs(league),
        loading: false
      })
    }

    return Promise.resolve()
      .then(() => {
        return this.setState({
          loading: 'Calculating insane economics...'
        })
      })
      .then(() => {
        return this.fetchCurrencyPrices(league)
      })
      .then(() => {
        return this.fetchFragmentPrices(league)
      })
      .then(() => {
        return this.fetchEssencePrices(league)
      })
      .then(() => {
        return this.setState({
          loading: 'Sending Chris telegrams via DNS pings...'
        })
      })
      .then(() => {
        return this.fetchLeagueStashTabs(league)
      })
      .then(response => {
        if (response.status === 200) {
          return response
        }

        if (response.status === 404) {
          throw ({
            loading: `No tabs found in ${league} league. Try another one? 🤷`
          })
        }

        if (response.status === 403) {
          document.dispatchEvent(new Event('ClearConfig'))

          throw ({
            notification: `Session has expired. Logging you out.`
          })
        }
      })
      .then(response => {
        return this.setState({
          stashes: {
            ...this.state.stashes,
            [league]: response.data.tabs
          }
        })
      })
      .then(() => {
        return this.setState({
          loading: 'Flipping through your tabs...'
        })
      })
      .then(() => {
        let stash = this.state.stashes[league]

        for (var i = 0; i < stash.length; i++) {
          let tab = stash[i]

          if (tab.hidden) {
            continue
          }

          this.handleStashTabFetching(league, queue, tab, tabs)
        }

        return queue.push(() => {
          return true
        })
      })
      .then(() => {
        return this.setState({
          tabs: {
            ...this.state.tabs,
            [league]: tabs
          },
          loading: 'Calculating Net Worth...'
        })
      })
      .then(() => {
        return this.setState({
          netWorth: this.processTabs(league),
          updated: {
            ...this.state.updated,
            [league]: {
              tabs: Date.now(),
              prices: Date.now()
            }
          },
          loading: false
        })
      })
      .then(() => {
        return this.saveData()
      })
      .catch(error => {
        if (error.notification) {
          return document.dispatchEvent(new CustomEvent('AppNotification', {
            detail: error.notification
          }))
        }

        if (error.loading) {
          return this.setState({
            loading: error.loading
          })
        }

        Log.critical(`[Dashboard] An error occurred during fetching of league data: ${error.message} - ${error.stack}`)

        this.setState({
          loading: `Error Occurred... find the log file at ${logsDataPath} and send it to "ComfyGangsta" on the forums!`,
          error: error.message
        })
      })
  }

  handleStashTabFetching (league, queue, tab, tabs, delay) {
    delay = delay || 1350 // 60 / 45 (rate limited)

    queue.unshift(() => new Promise((resolve, reject) => {
      return promiseDelay(delay)
        .then(() => {
          return this.setState({
            loading: `Fetching tab ${tab.n}...${Math.random() < 0.1 ? ' Nice.' : ''}`
          })
        })
        .then(() => {
          return this.fetchLeagueStashTab(league, tab.i)
        })
        .then(response => {
          if (response.status === 429) {
            this.setState({
              loading: `Ooohwee, too many requests Jerry! Gonna have to wait a minute for tab ${tab.n}!`
            })

            return this.handleStashTabFetching(league, queue, tab, tabs, delay + 60000)
          }

          if (response.status === 403) {
            document.dispatchEvent(new Event('ClearConfig'))

            throw ({
              notification: 'Session expired. You have been logged out.'
            })
          }

          return response.data
        })
        .then(response => {
          if (!response) {
            return resolve()
          }

          tabs[tab.i] = response.items
          return resolve()
        })
    }))
  }

  handleRefreshTabsButtonClick () {
    let league = this.props.league
    let queue = new Queue(1)
    let tabs = []

    return Promise.resolve()
      .then(() => {
        return this.setState({
          loading: 'Doing differential equations...'
        })
      })
      .then(() => {
        return this.fetchLeagueStashTabs(league)
      })
      .then(response => {
        if (response.status === 200) {
          return response
        }

        if (response.status === 404) {
          throw ({
            loading: `No tabs found in ${league} league. Try another one? 🤷`
          })
        }

        if (response.status === 403) {
          throw ({
            notification: `Session expired 🤷`
          })
        }

        throw ({

        })
      })
      .then(response => {
        return this.setState({
          stashes: {
            ...this.state.stashes,
            [league]: response.data.tabs
          }
        })
      })
      .then(() => {
        return this.setState({
          loading: 'Reading your story from ending to beginning...'
        })
      })
      .then(() => {
        let stash = this.state.stashes[league]

        for (var i = 0; i < stash.length; i++) {
          let tab = stash[i]

          if (tab.hidden) {
            continue
          }

          this.handleStashTabFetching(league, queue, tab, tabs)
        }

        return queue.push(() => {
          return true
        })
      })
      .then(() => {
        return this.setState({
          tabs: {
            ...this.state.tabs,
            [league]: tabs
          },
          loading: 'Calculating Net Worth...'
        })
      })
      .then(() => {
        return this.setState({
          netWorth: this.processTabs(league),
          updated: {
            ...this.state.updated,
            [league]: {
              ...this.state.updated[league],
              tabs: Date.now()
            }
          },
          loading: false
        })
      })
      .then(() => {
        return this.saveData()
      })
      .catch(error => {
        if (error.notification) {
          return document.dispatchEvent(new CustomEvent('AppNotification', {
            detail: error.notification
          }))
        }

        if (error.loading) {
          return this.setState({
            loading: error.loading
          })
        }

        Log.critical(`[Dashboard] An error occurred during tab refetching: ${error.message} - ${error.stack}`)
        this.setState({
          loading: `Error Occurred... find the log file at ${logsDataPath} and send it to "ComfyGangsta" on the forums!`,
          error: error.message
        })
      })
  }

  handleRefreshPricesButtonClick () {
    let {league} = this.props

    return Promise.resolve()
      .then(() => {
        return this.setState({
          prices: {
            ...this.state.prices,
            [league]: []
          }
        })
      })
      .then(() => {
        return this.fetchCurrencyPrices(league)
      })
      .then(() => {
        return this.fetchFragmentPrices(league)
      })
      .then(() => {
        return this.fetchEssencePrices(league)
      })
      .then(() => {
        return this.setState({
          netWorth: this.processTabs(league),
          updated: {
            ...this.state.updated,
            [league]: {
              ...this.state.updated[league],
              prices: Date.now()
            }
          },
        })
      })
      .then(() => {
        return this.saveData()
      })
      .catch(error => {
        Log.error(`Error occurred during prices refresh: ${error.message} - ${error.stack}`)
        // TODO: Add toast for errors
      })
  }

  fetchLeagueStashTabs (league) {
    let account = this.props.config[ConfigKeys.ACCOUNT_USERNAME]
    let cookie = this.props.config[ConfigKeys.ACCOUNT_COOKIE]

    return GetLeagueStashTab(cookie, {
      accountName: account,
      tabIndex: 0,
      league: league,
      tabs: 1
    })
  }

  fetchLeagueStashTab (league, index) {
    let account = this.props.config[ConfigKeys.ACCOUNT_USERNAME]
    let cookie = this.props.config[ConfigKeys.ACCOUNT_COOKIE]

    return GetLeagueStashTab(cookie, {
      accountName: account,
      tabIndex: index,
      league: league,
      tabs: 0
    })
  }

  fetchLeagueCurrencyPrices (league) {
    return GetCurrencyOverview(league, getNinjaDate())
  }

  getCurrencyRateDetails (item) {
    if (item === 'Chaos Orb') {
      return {
        name: 'Chaos Orb',
        icon: 'http://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollRare.png?scale=1&w=1&h=1'
      }
    }

    return this.state.netWorth.currencyDetails.find(value => {
      return value.name === item
    })
  }

  processTabs (league) {
    let tabs = this.state.tabs[league]
    let items = JSON.parse(JSON.stringify(this.state.prices[league]))
    let output = []
    let total = 0

    let getPriceDetails = (itemName) => {
      let litemName = itemName.toLowerCase()
      return items.find(value => value.lname === litemName)
    }

    // Iterate over each tab, then each tabs items
    if (tabs && tabs.forEach) {
      tabs.forEach(tab => {
        if (tab && tab.forEach) {
          tab.forEach(item => {
            let itemPrice = getPriceDetails(item.typeLine)

            // itemPrice not found, but we are looking at chaos
            if (!itemPrice && item.typeLine === 'Chaos Orb') {
              items.unshift({
                name: item.typeLine,
                lname: item.typeLine.toLowerCase(),
                icon: 'http://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollRare.png?scale=1&w=1&h=1',
                orderId: 1,
                type: 'currency',
                chaosValue: 1,
                stackSize: item.stackSize,
                stacks: [{
                  tab: item.inventoryId,
                  stackSize: item.stackSize,
                  x: item.x,
                  y: item.y
                }]
              })
            }

            // itemPrice not found, non-chaos
            if (!itemPrice) {
              return
            }

            if (!itemPrice.stackSize) {
              itemPrice.stackSize = 0
              itemPrice.stacks = []
            }

            if (isNaN(itemPrice.stackSize)) {
              itemPrice.stackSize = 0
            }

            itemPrice.stackSize += item.stackSize || 1
            itemPrice.stacks.push({
              tab: item.inventoryId,
              stackSize: item.stackSize,
              x: item.x,
              y: item.y
            })
          })
        }
      })
    }

    if (items && items.forEach) {
      items.forEach(item => {
        if (item.stackSize) {
          total += item.stackSize * item.chaosValue
        }
      })
    }

    return {
      items: items,
      chaosTotal: total
    }
  }

  saveData () {
    let {updateConfig} = this.props

    updateConfig(ConfigKeys.ACCOUNT_NET_WORTH, this.state.netWorth)
    updateConfig(ConfigKeys.ACCOUNT_STASHES, this.state.stashes)
    updateConfig(ConfigKeys.ACCOUNT_TABS, this.state.tabs)
    updateConfig(ConfigKeys.NINJA_PRICES, this.state.prices)
    updateConfig(ConfigKeys.ACCOUNT_LAST_UPDATE, this.state.updated)
  }

  handleCheckbox = name => (event, checked) => {
    this.setState({ 
      [name]: checked 
    })
  }

  calculateChaosValue (item) {
    return (item.stackSize || 0) * item.chaosValue
  }

  compareValueDescending (a, b) {
    return this.calculateChaosValue(b) - this.calculateChaosValue(a)
  }

  compareTypeAscending (a, b) {
    return a.type < b.type ? -1 : 1
  }

  compareOrderAscending(a, b) {
    return a.orderId - b.orderId
  }

  sortItems () {
    let { netWorth, sortByType, sortByWorth } = this.state
    let items = netWorth.items

    if (items && items.length) {
      if (sortByType && sortByWorth) {
        return items = items.sort((a, b) => {
          return a.type === b.type 
            ? this.compareValueDescending(a, b)
            : this.compareTypeAscending(a, b)
        })
      }

      if (sortByWorth) {
        return items = items.sort((a, b) => {
          return this.compareValueDescending(a, b)
        })
      }

      if (sortByType) {
        return items = items.sort((a, b) => {
          return a.type === b.type 
            ? this.compareOrderAscending(a, b)
            : this.compareTypeAscending(a, b)
        })
      }

      return items.sort((a, b) => {
        return this.compareOrderAscending(a, b)
      })
    }

    return items
  }

  render () {
    let message = null
    let {config, league} = this.props
    let {updated} = this.state

    if (!this.props.league) {
      message = 'Select a League!'
    }

    if (this.state.loading) {
      message = this.state.loading
    }

    if (!this.props.config[ConfigKeys.ACCOUNT_COOKIE]) {
      message = `
        <span style="font-size: 24px">👋 Welcome to Currency Cop for Path of Exile!</span>
        <br /><br />
        <span>First, login to calculate your 💸 net worth!</span>
      `
    }

    if (message) {
      return (
        <Grid 
          container
          align="center"
          justify="center"
          direction="column"
          spacing={0} 
          style={{
            height: 'calc(100% - 74px)',
            marginTop: 74
          }}
        >
        <Grid item>
          {!this.props.config[ConfigKeys.ACCOUNT_COOKIE] ? (
            <Typography 
              style={{textAlign:'center'}}
              type="body1" 
              component="p" 
              dangerouslySetInnerHTML={{__html: message}} 
            />
          ) : (
            <Typography
              type="body1" 
              component="p"
            >
              {message}
            </Typography>
          )}
          {this.state.error ? (
            <pre>
              {this.state.error.stack}
            </pre>
          ) : null}
        </Grid>
        {!this.props.config[ConfigKeys.ACCOUNT_COOKIE] ? (
        <Grid item style={{ marginTop: 24 }}>
          <LoginButton
            config={this.props.config}
            leagues={this.props.leagues}
            updateConfig={this.props.updateConfig}
          />
        </Grid>
        ) : null}
      </Grid>
      )
    }

    let items = this.sortItems()
    let updatedTime = updated[league]
      ? updated[league].tabs
      : '...'

    if (items.length && this.state.filter) {
      let filter = this.state.filter.toLowerCase()
      items = items.filter(item => {
        return item.lname.indexOf(filter) > -1
      })
    }

    return (
      <Grid 
        container
        align="center"
        justify="flex-start"
        direction="row"
        style={{
          width: '100%',
          padding: 24,
          height: 'calc(100% - 74px)',
          margin: '74px 0 0 0',
          overflow: 'auto',
          alignContent: 'flex-start'
        }}
      >

        <Grid item md={12} sm={12} xs={12} style={{ padding: '0 8px', textAlign: 'right' }}>
          <Typography type="body1" component="p" style={{ 
            fontSize: 11, 
            fontWeight: 500, 
            opacity: 0.5, 
            color: blueGrey[400] 
          }}>
            Last Tab Update: {Ago(updatedTime)}
          </Typography>
        </Grid>

        <Grid
          item
          md={12}
          sm={12}
          xs={12}
        >
          <Paper style={{ backgroundColor: blueGrey[600], padding: 16 }}>
            <Grid
              container
              align="center"
              justify="space-between"
              direction="row"
            >
              <Grid item sm={6} xs={12}>
                <Typography type="body1" component="p" style={{ fontSize: 24 }}>
                  <img 
                    src="http://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollRare.png?scale=1&w=1&h=1"
                    style={{ verticalAlign: 'middle' }}
                  />

                  ⨯ {this.state.netWorth.chaosTotal.toFixed(2)} (Total Net Worth)
                </Typography>
              </Grid>

              <Grid item sm={6} xs={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button color="accent" onClick={this.handleRefreshTabsButtonClick.bind(this)}>Refresh Tabs</Button>
                <Button color="accent" onClick={this.handleRefreshPricesButtonClick.bind(this)}>Refresh Prices</Button>
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
        <Grid 
          item
          md={6}
          sm={6}
          xs={12}
          style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={this.state.sortByType}
                  onChange={this.handleCheckbox('sortByType')}
                  value="type"
                />
              }
              label="Type"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={this.state.sortByWorth}
                  onChange={this.handleCheckbox('sortByWorth')}
                  value="worth"
                />
              }
              label="Worth"
            />
          </FormGroup>
        </Grid>

        {items.map(item => (
          <Grid
            item
            key={item.name}
            md={4}
            sm={6}
            xs={12}
          >
            <Paper
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
        ))}
      </Grid>
    )
  }
}

// Nav Bar Component
class NavBar extends React.Component {
  render () {
    const classes = this.props.classes;

    return (
      <div className={classes.root} style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: 5,
        width: 'auto',
        background: blueGrey[500],
        boxShadow: '0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12)'
      }}>
        <div className='navbar'>
          <AppBar position="static" style={{ boxShadow: 'none' }}>
            <Toolbar>
              <Typography type="title" color="inherit" className={classes.flex}>
                Currency Cop
              </Typography>

              <Account 
                config={this.props.config}
                leagues={this.props.leagues}
                leagueIndex={this.props.leagueIndex}
                characters={this.props.characters}
                clearConfig={this.props.clearConfig}
                updateConfig={this.props.updateConfig}
              />
            </Toolbar>
          </AppBar>
        </div>
      </div>
    )
  }
}

const AppNavBar = withStyles({
  root: {
    width: '100%',
  },

  flex: {
    flex: 1,
  },

  menuButton: {
    marginLeft: 12,
    marginRight: 20,
  },
})(NavBar)

// Application Root
class App extends React.Component {
  state = {
    loading: 'Calculating mobs inside Path of Exile',
    leagues: null
  }

  styles = {
    root: {
      paddingTop: theme.spacing.unit,
      paddingBottom: theme.spacing.unit,
      paddingLeft: theme.spacing.unit * 2,
      paddingRight: theme.spacing.unit * 2
    }
  }

  componentWillMount () {
    document.addEventListener('ClearConfig', event => {
      this.clearConfig()
    })

    document.addEventListener('AppNotification', event => {
      this.setState({
        globalSnackMessage: event.detail
      })

      setTimeout(() => {
        this.setState({
          globalSnackMessage: null
        })
      }, 5000)
    })

    return this.load()
  }

  componentWillUnmount () {
    document.removeEventListener('AppNotification')
  }

  setLoadingMessage (message) {
    this.setState({
      loading: message
    })
  }

  load () {
    return Promise.resolve()
      .then(() => {
        this.setLoadingMessage('Welcome back!')
        return loadConfig()
      })
      .then(() => {
        let {
          ACCOUNT_COOKIE, ACCOUNT_LEAGUE_INDEX,
          NINJA_PRICES
        } = ConfigKeys

        // Missing league index
        if (Config[ACCOUNT_COOKIE] && Config[ACCOUNT_LEAGUE_INDEX] == null) {
          Config = {}
          saveConfig()
        }

        // Coming from 1.0.0
        if (Config[NINJA_PRICES]) {
          let leagues = Object.keys(Config[NINJA_PRICES])
          if (leagues.length && Config[NINJA_PRICES][leagues[0]].lines) {
            Config = {}
            saveConfig()
          }
        }

        // Pre-1.0.4b
        // Clear configuration for localstorage
        if (localStorage.userData) {
          localStorage.removeItem('userData')
        }

        // Pre-1.0.4b
        // Clear configuration for localstorage
        if (localStorage.userConfig) {
          localStorage.removeItem('userConfig')
        }

        // Pre-1.0.5b
        // Clear configuration for localstorage
        if (localStorage[ConfigKeys.ACCOUNT_COOKIE]) {
          let keys = Object.keys(DefaultConfig())
          if (keys && keys.forEach) {
            keys.forEach(key => {
              try { localStorage.removeItem(key) } catch (e) { }
            })
          }
        }

        // Update state
        return this.setState({
          config: Config
        })
      }).then(() => {
        this.setLoadingMessage('Time to get a drink')
        return GetLeagues()
      }).then(response => {
        this.setLoadingMessage('Wouldn\'t want you to dehydrate')
        this.setState({
          leagues: response.data
        })

        return this.state.config[ConfigKeys.ACCOUNT_COOKIE]
          ? GetCharacters(
              this.state.config[ConfigKeys.ACCOUNT_COOKIE],
              this.state.config[ConfigKeys.ACCOUNT_USERNAME]
            )
          : false
      })
      .then(response => {
        if (response) {
          this.updateConfig(ConfigKeys.ACCOUNT_CHARACTERS, response.data)
        }

        document.dispatchEvent(new CustomEvent('AppNotification', {
          message: 'Testing!'
        }))

        this.setLoadingMessage('[ Currency Cop ]')

        setTimeout(() => {
          this.setState({
            loading: false
          })
        }, 200)
      })
      .catch(error => {
        this.setLoadingMessage('Houston, we have a problem.')
        Log.error(`[App] Error occurred during load: ${error.message} - ${error.stack}`)
      })
  }

  clearConfig () {
    Config = DefaultConfig()
    saveConfig()
    this.setState({
      config: Config
    })
  }

  updateConfig (key, value) {
    setConfig(key, value)
    return this.setState({
      config: {
        ...this.state.config,
        [key]: value
      },
      _updated: Date.now()
    })
  }

  render() {
    if (this.state.loading) {
      return (
        <MuiThemeProvider theme={theme}>
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
                {this.state.loading}
              </Typography>
            </Grid>
          </Grid>
        </MuiThemeProvider>
      )
    }

    // let characters = this.state.config[ConfigKeys.ACCOUNT_CHARACTERS]
    // let characterIndex = this.state.config[ConfigKeys.ACCOUNT_CHARACTER_INDEX]
    // let character = characters ? characters[characterIndex] : null

    let leagueIndex = this.state.config[ConfigKeys.ACCOUNT_LEAGUE_INDEX]
    let league = leagueIndex != null
      ? this.state.leagues[leagueIndex].id
      : null

    console.debug('[App]', 'State Config', this.state)
    console.debug('[App]', 'League Index', leagueIndex)
    console.debug('[App]', 'League', league)

    return (
      <MuiThemeProvider theme={theme}>
        <withTheme>
          <AppNavBar 
            config={this.state.config} 
            leagues={this.state.leagues}
            leagueIndex={leagueIndex}
            league={league}
            clearConfig={this.clearConfig.bind(this)}
            updateConfig={this.updateConfig.bind(this)}
          />

          <Dashboard
            config={this.state.config}
            leagues={this.state.leagues}
            league={league}
            updateConfig={this.updateConfig.bind(this)}
          />

          <Snackbar
            open={!!this.state.globalSnackMessage}
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
