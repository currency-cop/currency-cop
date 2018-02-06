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
  DoVersionCheck
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
  Tabs: {}
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

      this.setLoadingMessage('Gathering Tabs')
      await this.getTabsForEachLeague()
      await this.setupTabsJobs()

      this.setLoadingMessage('Loading Portfolios')
      let portfolios = await CC.Portfolios.load([])
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
      }, 200)

      // Check Application Version
      let versionCheck = await DoVersionCheck()
      if (versionCheck.data.version !== CC.AppVersion) {
        this.setState({
          upToDate: false,
          newVersion: versionCheck.data.version
        })
      }
    } catch (error) {
      this.setLoadingMessage('Houston, we have a problem.')
      this.setState({
        error: error.message
      })
      CC.Log.error(`[App] Error occurred during load: ${error.message} - ${error.stack}`)
    }
  }


  clearConfig () {
    CC.Config.save({})
    this.setState({
      isLoggedIn: false
    })
  }


  createPortfolio (settings) {
    let { portfolios } = this.state
    let portfolio = new Portfolio(settings)

    console.log(settings)

    portfolio.update()
    portfolios.push(portfolio)
    return this.updatePortfolios(portfolios)
  }


  updatePortfolio (settings) {
    let { portfolios } = this.state
    let portfolio = new Portfolio(settings)

    portfolios.forEach(item => {
      if (item.id === portfolio.id) {
        item = portfolio
      }
    })
  
    return this.updatePortfolios(portfolios)
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


  setupWorkers () {
    let tabs = new Requester()
    let tab = new Requester()

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
    
    // Find tab
    tab = tabs.find(t => t.id === tab.value)

    if (!worker.has(name)) {
      worker.add({
        name,
        method: () => {
          return CC.Api.getTab({
            league: league,
            tab: tab.index,
            tabId: tab.id
          })
        }
      })

      worker.on(name, items => {
        CC.Tabs[name] = items
      })
    }

    if (typeof callable === 'function') {
      worker.on(name, callable, timeout || 0)
    }
  }


  setupPortfolios () {
    if (!this.state.isLoggedIn) {
      console.log('not logged in')
      return
    }

    let {portfolios} = this.state
    for (const portfolio of portfolios) {
      let {tabs} = portfolio
      let {league} = portfolio
      let {timeout} = portfolio

      for (const tab of tabs) {
        this.setupTabJob(league, tab, items => {
          portfolio.update(tab, items)
        }, timeout)
      }
    }
  }


  componentWillMount () {
    // View
    CC.Events.on('/screen/dashboard', () => {
      this.setState({
        screenAction: '/screen/dashboard',
        screen: null
      })
    })

    CC.Events.on('/screen/portfolio', ({ portfolioId }) => {
      CC.EventLog.info(`Viewing Portfolio ${ portfolioId }`)
      this.setState({
        screenAction: '/screen/portfolio',
        screen: (
          <AppPortfolio
            portfolio={ this.state.portfolios[portfolioId] } />
        )
      })
    })

    CC.Events.on('/screen/portfolio/create', () => {
      CC.EventLog.info(`Creating Portfolio`)
      this.setState({
        screenAction: '/screen/portfolio/create',
        screen: (
          <AppPortfolioSettings
            tabs={ this.state.tabs }
            leagues={ this.state.leagues } />
        )
      })
    })

    CC.Events.on('/screen/portfolio/update', ({ portfolioId }) => {
      CC.EventLog.info(`Updating Portfolio ${ portfolioId }`)
      this.setState({
        screenAction: '/screen/portfolio/update',
        screen: (
          <AppPortfolioSettings
            tabs={ this.state.tabs }
            leagues={ this.state.leagues }
            portfolio={ this.state.portfolios[portfolioId] } />
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
        <div className="app-viewport draggable">
          <AppControlBar 
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
        <div className="app-viewport draggable">
          <AppControlBar 
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
      <div className="app-viewport draggable">
        <div className="application">
          <AppHeader 
            newVersion={this.state.newVersion}
            upToDate={this.state.upToDate}
          />

          <AppSidebar
            config={this.state.config}
            leagues={this.state.leagues}
            portfolios={this.state.portfolios}
            portfolio={this.state.isViewingReport}
            portfolioId={this.state.isViewingReportId}
          />

          <AppContent
            screen={ this.state.screen }
          />
        </div>
      </div>
    );
  }
}


class AppSidebar extends React.Component {
  openPortfolioCreateScreen () {
    CC.Events.emit('/screen/portfolio/create')
  }

  render () {
    console.log(this.props.portfolios)
    return (
      <div className="layout-item sidebar">
        <button onClick={this.openPortfolioCreateScreen}>Add Portfolio</button>

        <AppSidebarPortfolioList
          portfolios={this.props.portfolios} />
      </div>
    )
  }
}


class AppSidebarPortfolioList extends React.Component {
  render () {
    return (
      <ul className="portfolio-list">
        { 
          this.props.portfolios.map((portfolio, index) => {
            return (
              <li key={ portfolio.name }>
                <AppSidebarPortfolioListItem
                  index={index}
                  portfolio={portfolio} />
              </li>
            )
          })
        }
      </ul>
    )
  }
}


class AppSidebarPortfolioListItem extends React.Component {
  state = {
    change: false,
    lastUpdated: null
  }

  componentWillMount () {
    console.log(this.props)
    this.setState({
      change: this.props.portfolio.getChange(),
      holdings: this.props.portfolio.getHoldings(),
      lastUpdated: this.props.portfolio.getLastUpdateTime()
    })
  }

  openPortfolio (portfolioId) {
    return (e) => {
      CC.Events.emit('/screen/portfolio', {
        portfolioId
      })
    }
  }

  render () {
    return (
      <div className="portfolio-item not-draggable" onClick={ this.openPortfolio(this.props.index) }>
        <div className="info">
          <div className="title">
            { this.props.portfolio.name }
          </div>
          <div className="last-updated">
            { this.state.lastUpdated }
          </div>
        </div>
        
        <div className="value">
          <div className="total">
            { this.state.holdings.valueFormatted } { this.state.holdings.currency }
          </div>
          <div className={`change ${ this.state.change.directionClassName }`}>
           { this.state.change.directionIndicator } { this.state.change.valueFormatted } { this.state.change.currency }
          </div>
        </div>
      </div>
    )
  }
}

class AppPortfolio extends React.Component {
  state = {
    change: false,
    lastUpdated: null
  }

  componentWillMount () {
    this.setState({
      change: this.getPortfolioChange(this.props.portfolio),
      holdings: this.getPortfolioHoldings(this.props.portfolio),
      lastUpdated: this.getPortfolioLastUpdate(this.props.portfolio)
    })
  }

  getPortfolioLastUpdate (portfolio) {
    let { history } = portfolio
    return history.length ? Ago(history[0].refreshedAt) : null
  }

  getPortfolioHoldings (portfolio) {
    let { history } = portfolio
    return {
      value: history.length ? history[0].reportTotal : 0,
      valueFormatted: formatNumber(history.length ? history[0].reportTotal : 0),
      currency: 'C'
    }
  }

  getPortfolioChange (portfolio) {
    let { history } = portfolio
    let previousHoldings = history.length ? history[1].reportTotal : 0
    let currentHoldings = history.length ? history[0].reportTotal : 0
    let percentageChange = getPercentageChange(previousHoldings, currentHoldings)

    return {
      direction: percentageChange.direction,
      directionIndicator: percentageChange.direction === 'up' ? '+' : '-',
      directionClassName: percentageChange.direction ? 'direction-' + percentageChange.direction : '',
      value: Math.abs(previousHoldings - currentHoldings),
      valueFormatted: formatNumber(Math.abs(previousHoldings - currentHoldings)),
      percentage: percentageChange,
      currency: 'C'
    }
  }

  render () {
    return (
      <div className="layout-content portfolio">
        <AppPortfolioHeader
          league={this.props.portfolio.league}
          name={this.props.portfolio.name}
          data={this.props.portfolio.history}
          lastUpdated={this.state.lastUpdated}
          holdings={this.state.holdings}
          change={this.state.change} />
      </div>
    )
  }
}


// Todo
// - Add Chart Rendering after Load
// - Remove Chart after unload
class AppPortfolioChart extends React.Component {
  render () {
    return <div id="portfolio_chart" />
  }
}


class AppPortfolioLargeStats extends React.Component {
  render () {
    return (
      <div className="portfolio-large-stats">
        <div>
          <h3>{this.props.holdings.valueFormatted} {this.props.holdings.currency}</h3>
          <h2>Holdings</h2>
        </div>

        <div className={`${this.props.profit.directionClassName}`}>
          <h3>{this.props.profit.directionIndicator} {this.props.profit.valueFormatted} {this.props.profit.currency}</h3>
          <h2>Last Gain / Loss</h2>
        </div>

        <div>
          <h3>{this.props.dayProfit} {this.props.currency}</h3>
          <h2>24H Gain / Loss</h2>
        </div>
      </div>
    )
  }
}


class AppPortfolioMeta extends React.Component {
  render () {
    return (
      <div className="portfolio-meta">
        <div className="portfolio-meta-league">{ this.props.league }</div>
        <div className="portfolio-meta-last-updated">{ this.props.lastUpdated }</div>
      </div>
    )
  }
}


class AppPortfolioHeader extends React.Component {
  render () {
    return (
      <div className="portfolio-header">
        <AppPortfolioMeta
          league={this.props.league}
          lastUpdated={this.props.lastUpdated} />

        <h1>{this.props.name}</h1>

        <AppPortfolioLargeStats
          holdings={this.props.holdings}
          profit={this.props.change} />

        <AppPortfolioChart
          data={this.props.data} />
      </div>
    )
  }
}


class AppPortfolioSettings extends React.Component {
  state = {
    settings: {
      name: '',
      league: '',
      tracking: []
    }
  }

  constructor (props) {
    super(props)

    this.handleChange = this.handleChange.bind(this)
    this.handleLeagueChange = this.handleLeagueChange.bind(this)
    this.handleTabChange = this.handleTabChange.bind(this)
    this.handleSubmit = this.handleSubmit.bind(this)
    this.generateName = this.generateName.bind(this)
  }

  generateName () {
    let a = [ 'Strong', 'Fast', 'Powerful', 'Bold', 'Quick', 'Nimble', 
              'Intense', 'Fixed', 'Long', 'Smart', 'Sweet', 'My', 'New' ]
    let b = [ 'Exile', 'Tab', 'Folio', 'Tabs', 'Scion', 'Ranger', 'Witch', 
              'Marauder', 'Shadow', 'Templar', 'Gangsta', 'Trade' ]

    let choose = (list) => list[Math.floor(Math.random() * list.length)]
    let name = `${choose(a)} ${choose(b)}`

    this.setState({
      settings: {
        ...this.state.settings,
        name
      }
    })
  }

  componentWillMount () {
    if (!this.props.portfolio) {
      this.generateName()
      this.state.settings.league = this.props.leagues[0].id
    }

    this.setState({
      settings: this.props.portfolio 
        ? this.props.portfolio.settings 
        : this.state.settings
    })
  }

  handleChange (e) {
    e.preventDefault()

    const name = e.target.name
    const value = e.target.type === 'checkbox' 
      ? e.target.checked 
      : e.target.value

    this.setState({
      settings: {
        [name]: value
      }
    })
  }

  handleLeagueChange (option) {
    let value = option ? option.value : ''

    this.setState({
      settings: {
        ...this.state.settings,
        tabs: null,
        league: value
      }
    })
  }

  handleTabChange (tabs) {
    this.setState({
      settings: {
        ...this.state.settings,
        tabs
      }
    })
  }

  handleSubmit (e) {
    e.preventDefault()

    return this.props.portfolio
      ? this.handleUpdate()
      : this.handleCreate()
  }

  handleCreate () {
    try {
      CC.Events.emit('/portfolio/create', {
        portfolio: this.state.settings
      })
      CC.Events.emit('/screen/dashboard')
    } catch (e) {
      console.log(e)
    }
  }

  handleUpdate () {

  }

  render () {
    let tabs = this.props.tabs[this.state.settings.league]

    return (
      <div className="portfolio-settings">
        <h1>Portfolio Settings</h1>

        <div className="form-group">
          <h2>Portfolio Name</h2>
          <input name="name" type="text" value={this.state.settings.name} onChange={this.handleChange} />
          <Button onClick={this.generateName}>Generate?</Button>
        </div>

        <div className="form-group">
          <h2>Portfolio League</h2>
          <Select 
            name="league"
            clearable={false}
            value={this.state.settings.league}
            onChange={this.handleLeagueChange}
            options={ this.props.leagues.map((league, index) => {
              return {
                value: league.id,
                label: league.id
              }
            })} />
        </div>

        <div className="form-group">
          <h2>Portfolio Tabs</h2>
          <Select 
            name="tabs"
            multi={true}
            value={this.state.settings.tabs}
            onChange={this.handleTabChange}
            options={tabs.map((tab, index) => {
              return {
                value: tab.id,
                label: tab.name,
                style: {
                  color: `rgb(${tab.color[0]}, ${tab.color[1]}, ${tab.color[2]})`
                }
              }
            })} />
        </div>

        <PrimaryButton onClick={this.handleSubmit}>Save</PrimaryButton>
      </div>
    )
  }
}


// Capture uncaught errors
process.on('uncaughtException', function (error) {
  CC.Log.critical(`Uncaught error: ${error.message} - ${error.stack}`)
})


// Export Application
export default App
