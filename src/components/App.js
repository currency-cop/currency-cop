// Core
import * as Constants from '@/constants'
import pkg from '~/package.json'
import Ago from '@/classes/ago'
import Logger from '@/classes/logger'
import ApiClient from '@/classes/api.client'
import DataFile from '@/classes/datafile'
import Requester from '@/classes/requester'
import Portfolio from '@/classes/portfolio'


// IPC Api
import {
  DoVersionCheck,
  ItemRateTypes
} from '@/classes/api.ipc'


// Third Party
import Analytics from 'electron-google-analytics'
import React from 'react'
import Emitter from 'tiny-emitter'
import path from 'path'
import slug from 'slug'


// Electron
const electron = window.require('electron')
const { remote, clipboard } = electron


// Stylesheets
import 'react-select/dist/react-select.css'
import '@/assets/css/grid.css'
import '@/assets/css/common.css'
import '@/assets/css/app.css'


// Application folder location
const userDataPath      = remote.app.getPath('userData')
const logsDataPath      = path.join(userDataPath, 'Logs')
const portfolioFilename = path.join(userDataPath, 'Portfolios.db')
const configFilename    = path.join(userDataPath, 'Settings.db')
const cacheFilename     = path.join(userDataPath, 'Cache.db')


// Create Global Object
class CC {
  static Analytics = new Analytics('UA-119160286-1')

  static Constants = Constants
  static DataFile = DataFile
  static Ago = Ago
  static Requester = Requester

  static Tabs = {}
  static Prices = {}

  static AppName = pkg.name
  static AppVersion = pkg.version
  static AppPlatform = process.platform === 'darwin' ? 'osx' : 'windows'
  static AppId = pkg.build.appId
  static AppInstallerId = pkg.build.appId

  static Logger = new Logger({
    directory: logsDataPath
  })

  static Log = CC.Logger.topic('Core')
  static ApiLog = CC.Logger.topic('API')
  static EventLog = CC.Logger.topic('Events')

  // Configure Event System
  static Events = new Emitter()

  // Datafiles
  static Config = new DataFile('Config', configFilename, CC.Logger)
  static Portfolios = new DataFile('Portfolio', portfolioFilename, CC.Logger, [])

  // API
  static Api = new ApiClient({
    cacheFileLocation: cacheFilename,
    logger: CC.Logger
  })

  // Analytics Helpers
  static screen = async (screenName) => {
    await CC.Analytics.send('screenview', {
      cd: screenName
    }, CC.cid)
  }

  static event = async (type, action, label, value) => {
    await CC.Analytics.send('event', {
      ec: type,
      ea: action,
      el: label,
      ev: value
    }, CC.cid)
  }

  static exception = async (fname, e, fatal) => {
    await CC.event(
      'exception', 
      `${fname}: ${e.message}`, 
      e.stack, 
      fatal || 0
    )
  }
}

// Make CC Class a Global
global.CC = CC

// Random Identifier for Analytics to avoid erratic reporting
CC.cid = UUID()

// UA for Mac issues
CC.Analytics.set('ua', String(window.navigator.userAgent)
  .replace(new RegExp(`${CC.AppName}\\/\\d+\\.\\d+\\.\\d+ `), '')
  .replace(/Electron\/\d+\.\d+\.\d+ /, ''))

// We don't care about personal information only errors
CC.Analytics.set('aip', 1)

// Datasource
CC.Analytics.set('ds', 'app')

// Define Application Variables
CC.Analytics.set('an', CC.AppName)
CC.Analytics.set('av', CC.AppVersion)
CC.Analytics.set('aid', CC.AppId)
CC.Analytics.set('aiid', CC.AppInstallerId)

// Base Components
import Button from './Button'

// Application Components
import AppHeader from './AppHeader'
import AppContent from './AppContent'
import AppSidebar from './AppSidebar'
import AppDashboard from './AppDashboard'
import AppPortfolio from './AppPortfolio'
import AppPortfolioSettings from './AppPortfolioSettings'

// Application Screens
import LoadingScreen from './LoadingScreen'
import LoginScreen from './LoginScreen'
import { UUID } from '../helpers';


// Helper Components
const CopyLogsButton = (
  <Button onClick={event => {
    let originalValue = event.target.innerText
    clipboard.writeText(logger.getCurrentLogsFile().toString())
    event.target.innerText = 'Copied!'
    setTimeout(() => event.target.innerText = originalValue, 2000)
  }}>Copy Logs</Button>
)


// Application Root
class App extends React.Component {
  state = {
    upToDate: true,
    config: null,
    reports: null,
    isLoggedIn: false,
    isLoading: false,
    isViewingReport: false,

    screen: null,
    leagues: [],
    portfolios: [],
    tabs: {},
    workers: {}
  }


  async load (skipAuthorization) {
    let {exception} = CC

    CC.Log.launch(`Loading Currency Cop v${CC.AppVersion}`)

    try {
      if (!skipAuthorization) {
        // Configuration
        this.setLoadingMessage('Loading Configuration')
        await CC.Config.load({})

        // Re-authorization Checks
        this.setLoadingMessage('Checking Authorization')
        let accountSessionId = CC.Config.get(CC.Constants.CONFIG_COOKIE)
        if (accountSessionId) {
          try {
            await this.handleLogin(accountSessionId, true)
          } catch (err) {
            return this.setLoadingMessage(false)
          }
        } else {
          return this.setLoadingMessage(false)
        }

        this.setState({
          isLoggedIn: true
        })
      }

      this.setLoadingMessage('Loading Api Cache')
      await CC.Api.cache.load({})

      this.setLoadingMessage('Fetching Leagues')
      let leagues = await CC.Api.getLeagues()
      await this.setState({ leagues })

      this.setLoadingMessage('Initialize Workers')
      await this.setupWorkers()

      this.setLoadingMessage('Gathering Prices & Tabs')
      this.getPricesForEachLeague()
      await this.getTabsForEachLeague()
      this.setupTabsJobs()

      this.setLoadingMessage('Loading Portfolios')
      let portfolios = await CC.Portfolios.load([])
      if (portfolios && portfolios.data) {
        await this.setState({
          portfolios: portfolios.data.map(settings => new Portfolio(settings))
        })
      }

      this.setLoadingMessage('Configuring Events')
      await this.setupPortfolios()

      // Application Banner Message
      this.setLoadingMessage((
        <span style={{ color: 'rgba(239, 157, 58, 1.0)', fontWeight: 'bold' }}>
          [ Currency Cop ]
        </span>
      ))

      // Remove Loading Message
      setTimeout(() => {
        this.setLoadingMessage(false)
        CC.Events.emit('/screen/dashboard')
      }, 500)

      // Check Application Version
      let versionCheck = await DoVersionCheck()
      if (versionCheck && versionCheck.data) {
        let latestVersion = versionCheck.data[0]
        if (latestVersion.name !== CC.AppVersion) {
          this.setState({
            upToDate: false,
            newVersion: latestVersion
          })
        }
      }
    } catch (err) {
      if (err.message) {
        this.setState({ error: err.message })
        this.setLoadingMessage(`🔥 This is fine: ${err.message}`)
        exception(`App.load`, err, 1)
        CC.Log.terminal(`Fatal exception`, err)
      } else {
        this.setState({ error: err })
        this.setLoadingMessage(`💩 Well shit. Something is wrong: ${err}`)
        exception(`App.load`, err, 1)
        CC.Log.terminal(`Fatal exception`, err)
      }
    }
  }


  /*
   * MISC
   */


  clearConfig () {
    CC.Config.save({})
    this.setState({
      isLoggedIn: false
    })
  }


  setLoadingMessage (message) {
    return this.setState({
      isLoading: message
    })
  }


  async handleLogin (sessionId, skipReload) {
    let {CONFIG_USERNAME, CONFIG_COOKIE} = CC.Constants

    if (!sessionId) {
      CC.Events.emit('/config/clear')
      CC.exception('App.handleLogin', new Error('missing session id'), 0)

      throw {
        message: 'Session identifier is required.'
      }
    }

    try {
      CC.Api = await CC.Api.authorize({ sessionId })
      CC.Config.set(CONFIG_USERNAME, CC.Api.accountName)
      CC.Config.set(CONFIG_COOKIE, CC.Api.accountSessionId)
    } catch (error) {
      CC.Events.emit('/config/clear')
      CC.exception(`App.handleLogin`, error, 1)
      throw error
    }

    if (!skipReload) {
      return this.load(true)
    }
  }


  /*
   * PORTFOLIOS
   *
   */


  setupPortfolios () {
    if (!this.state.isLoggedIn) {
      return
    }

    let {portfolios} = this.state
    for (const portfolio of portfolios) {
      this.setupPortfolioWorkerTasks(portfolio)
    }
  }


  setupPortfolioWorkerTasks (portfolio) {
    let {tabs} = portfolio
    let {league} = portfolio
    let {timeout} = portfolio
    let {portfolios} = this.state

    for (const tab of tabs) {
      let listenerId = this.setupTabJob(league, tab, items => {
        let updated = portfolio.update(tab, items)
        if (updated) {
          this.updatePortfolios(portfolios)
        }
      }, timeout)

      if (listenerId !== false) {
        portfolio.listeners.push(['tab', listenerId])
      }

      if (listenerId === false) {
        portfolio.isOld = true
      }
    }
  }


  teardownPortfolioWorkerTasks (portfolio) {
    let workers = this.state.workers
    let {listeners} = portfolio

    for (const [worker, id] of listeners) {
      workers[worker].off(id)
    }
  }

  
  getPortfolioById (id) {
    let portfolio = null
    let {portfolios} = this.state

    portfolios.forEach(p => {
      if (p.id === id) {
        portfolio = p
      }
    })

    return portfolio
  }


  updatePortfolioById (portfolio) {
    let {portfolios} = this.state

    portfolios.forEach((p, i) => {
      if (p.id === portfolio.id) {
        portfolios[i] = portfolio
      }
    })

    return this.updatePortfolios(portfolios)
  }


  createPortfolio (settings) {
    let { portfolios } = this.state
    let portfolio = new Portfolio(settings)
    portfolios.push(portfolio)
    this.setupPortfolioWorkerTasks(portfolio)
    return this.updatePortfolios(portfolios)
  }


  updatePortfolio (settings) {
    let portfolio = new Portfolio(settings)

    this.teardownPortfolioWorkerTasks(portfolio)
    this.updatePortfolioById(portfolio)
    this.setupPortfolioWorkerTasks(portfolio)

    // Force update
    portfolio.onUpdate()
  }


  deletePortfolio (portfolio) {
    let { portfolios } = this.state
  
    portfolios.forEach(function (item, index, object) {
      if (item.id === portfolio.id) {
        object.splice(index, 1);
      }
    })
  
    return this.updatePortfolios(portfolios)
  }


  updatePortfolios (portfolios) {
    CC.Portfolios.save(portfolios)
    return this.setState({
      portfolios
    })
  }

  /*
   * EACH LEAGUE
   *
   */

  async getPricesForEachLeague () {
    const { leagues } = this.state
    for (const { id: league } of leagues) {
      const prices = await Promise.all(Object.keys(ItemRateTypes).map(type => {
        this.setLoadingMessage(`Gathering Prices & Tabs (${league} - ${type})`)
        return CC.Api.getItemRates(type, league)
      }))

      CC.Prices[league] = [].concat.apply([], prices)

      this.setupPriceJob(league)
    }
  }


  async getTabsForEachLeague () {
    const { leagues } = this.state
    for (const league of leagues) {
      try {
        this.setLoadingMessage(`Gathering Prices & Tabs (${league.id} - tabs)`)
        let tabs = await CC.Api.getTabsList({ league: league.id })
        this.handleTabsList(league.id, tabs)
      } catch (e) {
        CC.ApiLog.error(`Failed to fetch tabs`, { league: league.id, reason: e.message })
        CC.exception(`App.getTabsForEachLeague`, error, 1)
      }
    }
  }


  handleTabsList (league, list) {
    const {tabs} = this.state
    let current = JSON.stringify(tabs[league] || {})
    if (current != JSON.stringify(list)) {
      this.setState({
        tabs: {
          ...this.state.tabs,
          [league]: list
        }
      })
    }
  }


  /*
   * WORKERS
   *
   */


  setupWorkers () {
    let tabs = new Requester()
    let tab = new Requester()
    let prices = new Requester()

    // Setup prices worker
    tabs.evenlySpaced = true
    prices.setRateLimitByString('6:3600:60')
    prices.setCacheExpiry(0)
    prices.start()
    prices.cache = {}

    // Setup tabs worker (fetches league tabs lists)
    tabs.evenlySpaced = true
    tabs.setRateLimitByString('4:1500:240')
    tabs.setCacheExpiry(1000)
    tabs.start()

    // Setup tab worker (fetches individual tabs)
    tab.evenlySpaced = true
    tab.setRateLimitByString('39:60:60')
    tab.setCacheExpiry(240)
    tab.start()

    this.setState({
      workers: {
        prices,
        tabs,
        tab
      }
    })
  }


  setupTabsJobs () {
    let worker = this.state.workers.tabs

    for (const league in this.state.tabs) {
      worker.add({
        name: league,
        method: () => {
          return CC.Api.getTabsList({
            league: league
          })
        }
      })

      worker.on(league, (tabs) => {
        return this.handleTabsList(league, tabs)
      })
    }
  }


  setupTabJob (league, tab, callable, timeout) {
    let worker = this.state.workers.tab
    let name = `${league}-${tab.value}`

    let tabs = this.state.tabs[league]
    if (!tabs) {
      return false
    }
    
    // Find tab
    tab = tabs.find(t => t.id === tab.value)
    if (!worker.has(name)) {
      worker.add({
        name,
        method: () => {
          return CC.Api.getTab({
            league,
            tab
          })
        }
      })

      worker.on(name, items => {
        CC.Tabs[name] = items
      })
    }

    if (typeof callable === 'function') {
      return worker.on(name, callable, timeout || 0)
    }
  }


  setupPriceJob (league, callable, timeout) {
    let worker = this.state.workers.prices
    let name = `${league}-prices`
    if (!worker.has(name)) {
      worker.add({
        name,
        method: () => {
          return Promise.all(Object.keys(ItemRateTypes).map(type => {
            return CC.Api.getItemRates(type, league)
          }))
        }
      })

      worker.on(name, prices => {
        CC.Prices[league] = [].concat.apply([], prices)
      }, 300)
    }
  }


  /*
   * COMPONENT METHODS
   *
   */


  componentWillMount () {
    this.interval = setInterval(() => {
      this.setState({ 
        time: Date.now() 
      })
    }, 60000)

    // View
    CC.Events.on('/screen', (state) => {
      state.portfolioId = state.portfolioId || null

      // Tie exceptions to a screen for easier debugging
      CC.screen(state.screenAction)
      CC.Analytics.set('cd', state.screenAction)

      // Update
      this.setState(state)
    })

    CC.Events.on('/screen/dashboard', () => {
      CC.Events.emit('/screen', {
        screenAction: '/screen/dashboard',
        portfolioId: null,
        screen: (
          <AppDashboard
            portfolioId={this.state.portfolioId}
            config={this.state.config}
            leagues={this.state.leagues}
            portfolios={this.state.portfolios} />
        )
      })
    })

    CC.Events.on('/screen/portfolio', ({ portfolioId }) => {
      CC.EventLog.spawn(`Viewing Screen`, { screen: '/portfolio', portfolioId })

      let {portfolios} = this.state
      let portfolio = this.getPortfolioById(portfolioId)
      if (!portfolio && portfolios[portfolioId]) {
        portfolio = portfolios[portfolioId]
      }

      if (!portfolio) {
        CC.EventLog.error(`Unable to find portfolio by Id`, { portfolioId })
        CC.exception(`CC.Events.on('/screen/portfolio')`, new Error(`Unable to find portfolio by id: ${ portfolioId }`))
        return
      }

      CC.Events.emit('/screen', {
        screenAction: `/screen/portfolio/${slug(portfolio.name, {lower: true})}`,
        portfolioId: portfolio.id,
        screen: (
          <AppPortfolio
            portfolio={ portfolio } />
        )
      })
    })

    CC.Events.on('/screen/portfolio/create', () => {
      CC.EventLog.spawn(`Viewing Screen`, { screen: '/portfolio/create' })

      CC.Events.emit('/screen', {
        screenAction: '/screen/portfolio/create',
        portfolioId: null,
        screen: (
          <AppPortfolioSettings
            tabs={ this.state.tabs }
            leagues={ this.state.leagues } />
        )
      })
    })

    CC.Events.on('/screen/portfolio/update', ({ portfolioId }) => {
      CC.EventLog.spawn(`Viewing Screen`, { screen: '/portfolio/update', portfolioId })

      let portfolio = this.getPortfolioById(portfolioId)
      if (!portfolio) {
        CC.EventLog.error(`Unable to find portfolio by Id`, { portfolioId })
        CC.exception(`CC.Events.on('/screen/portfolio/update')`, new Error(`Unable to find portfolio by id: ${ portfolioId }`))
        return
      }

      CC.Events.emit('/screen', {
        screenAction: `/screen/portfolio/${slug(portfolio.name, {lower: true})}/update`,
        portfolioId: null,
        screen: (
          <AppPortfolioSettings
            tabs={ this.state.tabs }
            leagues={ this.state.leagues }
            portfolio={ portfolio } />
        )
      })
    })


    // Delete
    CC.Events.on('/portfolio/delete', ({portfolio}) => {
      this.deletePortfolio(portfolio)
    })


    // Update
    CC.Events.on('/portfolio/update', ({portfolio}) => {
      this.updatePortfolio(portfolio)
    })


    // Create
    CC.Events.on('/portfolio/create', ({portfolio}) => {
      this.createPortfolio(portfolio)
    })


    // Configuration
    CC.Events.on('/config/update', event => {
      this.updateConfig(event.key, event.value)
    })

    CC.Events.on('/config/clear', event => {
      this.clearConfig()
    })


    // Begin fetching application data
    return this.load()
  }


  componentWillUnmount () {
    clearInterval(this.interval)

    CC.Events.off('/screen')
    CC.Events.off('/screen/dashboard')
    CC.Events.off('/screen/portfolio/update')
    CC.Events.off('/screen/portfolio/create')
    CC.Events.off('/screen/portfolio')
    CC.Events.off('/portfolio/create')
    CC.Events.off('/portfolio/update')
    CC.Events.off('/portfolio/delete')
    CC.Events.off('/config/update')
    CC.Events.off('/config/clear')
  }


  render() {
    let {screen} = CC

    if (!CC.Api.accountSessionId && !CC.Config.get(CC.Constants.CONFIG_COOKIE)) {
      screen('/screen/login')
      return (
        <div className="app-viewport">
          <AppHeader 
            newVersion={this.state.newVersion}
            upToDate={this.state.upToDate}
          />
          <LoginScreen 
            onLogin={this.handleLogin.bind(this)} 
          />
        </div>
      )
    }

    if (this.state.isLoading) {
      // screen('/screen/loading')
      return (
        <div className="app-viewport">
          <AppHeader 
            newVersion={this.state.newVersion}
            upToDate={this.state.upToDate}
          />
          <LoadingScreen 
            message={this.state.isLoading}
            error={this.state.error}
          />
        </div>
      )
    }

    return (
      <div className="app-viewport">
        <div className="application">
          <AppHeader 
            newVersion={this.state.newVersion}
            upToDate={this.state.upToDate}
          />

          <AppContent
            screen={ this.state.screen }
            screenAction={ this.state.screenAction }
          />
        </div>
      </div>
    );
  }
}

// Capture uncaught errors
process.on('uncaughtException', function (error) {
  CC.Log.terminal(`Uncaught error`, error)
  CC.exception(`App.uncaughtException`, error, 1)
})

window.onerror = (...args) => {
  console.log(...args)
}

// Export Application

import { hot } from 'react-hot-loader'
export default hot(module)(App)
