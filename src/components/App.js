// Core
import Constants from '../constants'
import Logger from '../classes/logger'
import ReportBuilder from '../classes/reportbuilder'
import ApiClient from '../classes/api'
import DataFile from '../classes/datafile'
import Queue from '../classes/queue'
import Ago from '../classes/ago'
import pkg from '../../package.json'
import Requester from '../classes/requester'
import Portfolio from '../classes/portfolio'


import {
  UUID,
  GoToUrl,
  clone,
  formatNumber,
  padNumber,
  promiseDelay,
  getNinjaDate,
  getPercentageChange
} from '../helpers'


import {
  DoServerRequest,
  LoginWithCookie,
  GetAccountName,
  GetLeagues,
  GetCharacters,
  GetStashTabs,
  GetLeagueStashTab,
  GetCurrencyOverview,
  GetEssenceOverview,
  GetFragmentOverview,
  GetDivCardOverview,
  GetMapOverview,
  GetUniqueMapOverview,
  DoVersionCheck,
  ItemRateTypes
} from '../api'


// Third Party
import { ipcRenderer, shell, remote, clipboard } from 'electron'
import React, { Component } from 'react'
import classes from 'classnames'
import Select from 'react-select'
import Switch from 'react-flexible-switch'
import Emitter from 'tiny-emitter'
import Axios from 'axios'
import path from 'path'
import fs from 'fs'


// Stylesheets
import 'react-select/dist/react-select.css'
import '../assets/css/grid.css'
import '../assets/css/app.css'
import '../assets/css/login.css'
import '../assets/css/appnew.css'


// Create Global Object
global.CC = {
  Constants,
  DataFile,
  Ago,
  Requester,
  Tabs: {},
  Prices: {}
}


// App Environment
CC.AppVersion = pkg.version
CC.AppPlatform = process.platform === 'darwin' ? 'osx' : 'windows'


// Application folder location
const userDataPath      = remote.app.getPath('userData')
const logsDataPath      = path.join(userDataPath, 'Logs')
const portfolioFilename = path.join(userDataPath, 'Portfolios.db')
const configFilename    = path.join(userDataPath, 'Settings.db')
const cacheFilename     = path.join(userDataPath, 'Cache.db')


// Configure Logger
CC.Logger = new Logger({
  logdir: logsDataPath,
  level: 1
})


// Create Loggers
CC.Log = CC.Logger.topic('Core')
CC.ApiLog = CC.Logger.topic('API')
CC.EventLog = CC.Logger.topic('Events')


// Configure Event System
CC.Events = new Emitter()


// Files
CC.Config = new DataFile('Config', configFilename)
CC.Portfolios = new DataFile('Portfolio', portfolioFilename)


// Initialize API Client
CC.Api = new ApiClient({
  cacheFileLocation: cacheFilename
})


// Base Components
import Button from './Button'
import Input from './Input'
import PrimaryButton from './PrimaryButton'
import AccountActions from './AccountActions'

// Application Components
import AppControls from './AppControls'
import AppControlBar from './AppControlBar'
import AppHeader from './AppHeader'
import AppContent from './AppContent'
import AppSidebar from './AppSidebar'
import AppDashboard from './AppDashboard'
import AppPortfolio from './AppPortfolio'
import AppPortfolioSettings from './AppPortfolioSettings'

// Application Screens
import LoadingScreen from './LoadingScreen'
import LoginScreen from './LoginScreen'


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
    CC.Log.info(`Loading Currency Cop v${CC.AppVersion}`)

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
          } catch (error) {
            console.log(error)
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
      await this.getPricesForEachLeague()
      await this.getTabsForEachLeague()
      await this.setupTabsJobs()

      this.setLoadingMessage('Loading Portfolios')
      let portfolios = await CC.Portfolios.load([])
      console.log(portfolios)
      await this.setState({
        portfolios: portfolios.data.map(settings => new Portfolio(settings))
      })

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
      }, 200)

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
    } catch (error) {
      this.setLoadingMessage('Houston, we have a problem.')
      this.setState({
        error: error.message
      })
      CC.Log.error(`[App] Error occurred during load: ${error.message} - ${error.stack}`)
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
    if (!sessionId) {
      CC.Events.emit('/config/clear')
      throw {
        message: 'Session identifier is required.'
      }
    }

    try {
      CC.Api = await CC.Api.authorize({ sessionId })
      CC.Config.set(CC.Constants.CONFIG_USERNAME, CC.Api.accountName)
      CC.Config.set(CC.Constants.CONFIG_COOKIE, CC.Api.accountSessionId)
    } catch (error) {
      CC.Events.emit('/config/clear')
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
      console.log('not logged in')
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
        let tabs = await CC.Api.getTabsList({ league: league.id })
        this.handleTabsList(league.id, tabs)
      } catch (e) {
        CC.ApiLog.error(`Failed to fetch ${league.id} tabs - ${e.message}`)
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
    tabs.setCacheExpiry(3000)
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
    CC.Events.on('/screen/dashboard', () => {
      this.setState({
        screenAction: '/screen/dashboard',
        portfolioId: null,
        screen: (
          <AppDashboard
            portfolios={this.state.portfolios} />
        )
      })
    })

    CC.Events.on('/screen/portfolio', ({ portfolioId }) => {
      CC.EventLog.info(`Viewing Portfolio ${ portfolioId }`)

      let {portfolios} = this.state
      let portfolio = this.getPortfolioById(portfolioId)
      if (!portfolio && portfolios[portfolioId]) {
        portfolio = portfolios[portfolioId]
      }

      if (!portfolio) {
        CC.EventLog.error(`Unable to find ${ portfolioId }`)
        return
      }

      this.setState({
        screenAction: '/screen/portfolio',
        portfolioId: portfolio.id,
        screen: (
          <AppPortfolio
            portfolio={ portfolio } />
        )
      })
    })

    CC.Events.on('/screen/portfolio/create', () => {
      CC.EventLog.info(`Creating Portfolio`)
      this.setState({
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
      CC.EventLog.info(`Updating Portfolio ${ portfolioId }`)

      let portfolio = this.getPortfolioById(portfolioId)
      if (!portfolio) {
        CC.EventLog.error(`Unable to find ${ portfolioId }`)
        return
      }

      this.setState({
        screenAction: '/screen/portfolio/update',
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
      CC.EventLog.info('Updating configuration')
      this.updateConfig(event.key, event.value)
    })

    CC.Events.on('/config/clear', event => {
      CC.EventLog.info('Clearing configuration')
      this.clearConfig()
    })


    // Notifications
    CC.Events.on('/notify', event => {
      CC.EventLog.info('Global notification occurred', event.message)

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
    clearInterval(this.interval)

    CC.Events.off('/screen/portfolio/update')
    CC.Events.off('/screen/portfolio/create')
    CC.Events.off('/screen/portfolio')
    CC.Events.off('/portfolio/create')
    CC.Events.off('/portfolio/update')
    CC.Events.off('/portfolio/delete')
    CC.Events.off('/config/update')
    CC.Events.off('/config/clear')
    CC.Events.off('/notify')
  }


  render() {
    if (this.state.isLoading) {
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

    if (!CC.Api.accountSessionId) {
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

    return (
      <div className="app-viewport">
        <div className="application">
          <AppHeader 
            newVersion={this.state.newVersion}
            upToDate={this.state.upToDate}
          />

          <AppSidebar
            config={this.state.config}
            leagues={this.state.leagues}
            portfolios={this.state.portfolios}
            portfolioId={this.state.portfolioId}
          />

          <AppContent
            screen={ this.state.screen }
          />
        </div>
      </div>
    );
  }
}

// Capture uncaught errors
process.on('uncaughtException', function (error) {
  CC.Log.critical(`Uncaught error: ${error.message} - ${error.stack}`)
})


// Export Application
export default App
