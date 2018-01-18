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

import {
  p,
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

// Material UI
import Button from './Button'
import Input from './Input'
import PrimaryButton from './PrimaryButton'

// App Environment
const AppVersion = pkg.version
const AppPlatform = process.platform === 'darwin'
  ? 'osx'
  : 'windows'

// Application folder location
const userDataPath      = remote.app.getPath('userData')
const logsDataPath      = path.join(userDataPath, 'Logs')
const reportsFilename   = path.join(userDataPath, 'Portfolios.db')
const configFilename    = path.join(userDataPath, 'Settings.db')
const cacheFilename     = path.join(userDataPath, 'Cache.db')

// Configure Event System
global.events = new Emitter()

// Configure Logger
global.logger = new Logger({
  logdir: logsDataPath,
  level: 1
})

// Create Loggers
global.Log          = logger.topic('Core')
global.ApiLog       = logger.topic('API')
global.EventLog     = logger.topic('Events')
global.ConfigLog    = logger.topic('Config')

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

function DefaultConfig () {
  return {
    [ConfigKeys.ACCOUNT_COOKIE]:              null,
    [ConfigKeys.ACCOUNT_USERNAME]:            null,
  }
}

// Global Objects
let Config = DefaultConfig()
let Reports = {}

// Files
let ConfigFile  = new DataFile('Config', configFilename)
let ReportFile  = new DataFile('Portfolio', reportsFilename)

// Configuration Helpers
function getConfig (key) {
  try {
    return Config[key]
  } catch (error) {
    Log.warn(`Could not get configuration key [${key}] from config: ${error.message}`)
    return null
  }
}

// Helper Components
const CopyLogsButton = (
  <Button onClick={event => {
    let originalValue = event.target.innerText
    clipboard.writeText(logger.getCurrentLogsFile().toString())
    event.target.innerText = 'Copied!'
    setTimeout(() => event.target.innerText = originalValue, 2000)
  }}>Copy Logs</Button>
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
      <Button onClick={this.props.onClick}>
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
      <div className="account-actions">
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
            Hi <span style={{ color: 'rgba(229, 124, 57, 1.0)' }}>{getConfig(ConfigKeys.ACCOUNT_USERNAME)}</span> 🎃
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
            <Button raised style={{ backgroundColor: 'rgba(229, 124, 57, 1.0)', color: 'white' }} onClick={this.handleCreateReportButton.bind(this)}>
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
      <div className="dashboard-viewport">
        <div className="dashboard-container">
          <div className="dashboard-actions row start-xs">
            <div className="col-xs-12">
              <div className="box">
                <Button className="btn-border" onClick={this.handleCreateReportButton.bind(this)}>Add Report</Button>
              </div>
            </div>
          </div>

          <div className="dashboard-reports row start-xs">
            { this.props.reports.map((report, index) => {
              let {history, settings} = report
              let hasChange = {
                change: 0,
                absChange: 0,
                direction: null
              }

              if (history && history.length > 1) {
                hasChange = getPercentageChange(history[1].reportTotal || 0, history[0].reportTotal || 0)
              }

              let changeClass = `change ${
                hasChange.direction === 'up' 
                ? 'up' 
                : hasChange.direction === 'down' 
                ? 'down'
                : ''
              }`

              return (
                <div className="report col-xs" key={index}>
                  <div className="report-container">
                    <div className="report-item" onClick={e => this.handleReportSelected(e, index)}>
                      <div className="report-item-title">
                        <span className="report-name">{settings.name}</span>
                        <span className="report-league">{settings.league}</span>
                        <span className="report-meta">
                          { report.history.length ? Ago(report.history[0].refreshedAt) : null }
                        </span>
                      </div>

                      <div className="report-item-body">
                        { report.history.length ? (
                          <div className="report-item-meta">
                            <p className="amount">
                              {report.history[0].reportTotal.toFixed(2)} <span>C</span>
                            </p>
                            <p className={changeClass}>
                              {hasChange.absChange !== 0
                                ? `${hasChange.direction === 'up' ? '+' : '-'} ${hasChange.absChange}%`
                                : 'No Change'
                              }
                            </p>
                          </div>
                        ) : (
                          <div className="report-item-meta">
                            <p className="amount loading"></p>
                            <p className="change loading"></p>
                          </div>
                        ) }
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
        // {this.renderDialogs()}
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

  async handleLoginButtonClick () {
    let {value} = this.state
    if (!value) {
      return this.setState({
        error: 'POESESSIONID is required!'
      })
    }

    if (!Constants.POE_COOKIE_REGEXP.test(value)) {
      return this.setState({
        error: `POESESSIONID must be a 32 character hexadecimal string!`
      })
    }

    // Attempt login
    let error = await this.props.onLogin(value)
    if (error) {
      return this.setState({
        error: error.message
      })
    }
  }

  render() {
    const { value, ...other } = this.props
    let thread = 'https://www.pathofexile.com/forum/view-thread/1989935/page/9#p14857124'

    return (
      <div className="login-viewport viewport">
        <div className="viewport row middle-xs center-xs">
          <div className="login-container">
            <div className="draggable row">
              <div className="col-xs-12">
                <div className="box">
                  {this.state.error ? (
                    <p className="error" style={{ fontSize: 12 }}>⚠️ {this.state.error}</p>
                  ) : null}

                  <h2>Login</h2>
                </div>
              </div>
            </div>

            <div className="draggable row center-xs">
              <div className="col-xs-12">
                <div className="not-draggable box">
                  <div>
                    <label>Session ID</label>
                    <Input
                      id={Constants.POE_COOKIE_NAME}
                      placeholder={Constants.POE_COOKIE_NAME}
                      value={this.state.value}
                      onChange={event => this.setState({ 
                        value: event.target.value 
                      })}
                    />
                    <p>
                      👮 Need help finding your session id?&nbsp;
                      <a href={thread} onClick={GoToUrl.bind(this)}>Click here!</a>
                    </p>
                  </div>

                  <PrimaryButton style={{
                    marginTop: 8,
                    width: '100%'
                  }} onClick={this.handleLoginButtonClick.bind(this)}>
                    Login
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}


// Loading Screen
class LoadingScreen extends React.Component {
  render () {
    return (
      <div className="login-viewport viewport">
        <div className="viewport row middle-xs center-xs">
          <p>{this.props.message}</p>
        </div>
      </div>
    )
  }
}


// App Control Bar
class AppControlBar extends React.Component {
  render () {
    return (
      <div className="app-control not-draggable">
        <AppControls
          newVersion={this.props.newVersion}
          upToDate={this.props.upToDate} />
      </div>
    )
  }
}


// AppControl Buttons
class AppControls extends React.Component {
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
      <div className="app-controls not-draggable">
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
        <div className="minimize-control" onClick={this.handleMinimizeButtonClick}>&#xE738;</div>
        <div className="fullscreen-control" onClick={this.handleFullscreenButtonClick}>&#xE71A;</div>
        <div className="close-control" onClick={this.handleCloseButtonClick}>&#xE711;</div>
      </div>
    )
  }
}


// Nav Bar Component
class AppNavBar extends React.Component {
  render () {
    return (
      <header className="nav-bar row middle-xs">
        <div className="col-xs-6">
          <h1 class="brand">
            <img className="header-logo" src={require('../assets/logo.png')} />
            Currency Cop
          </h1>
        </div>

        <div className="col-xs-6 text-right">
          <div className="row end-xs">
            <div className="col-xs">
              {getConfig(ConfigKeys.ACCOUNT_USERNAME) ? ( <AccountActions /> ) : null}

              <AppControls
                newVersion={this.props.newVersion}
                upToDate={this.props.upToDate} />
            </div>
          </div>
        </div>
      </header>
    )
  }
}


// Application Root
class App extends React.Component {
  state = {
    upToDate: true,
    config: null,
    reports: null,
    isLoggedIn: false,
    isLoading: false,
    isViewingReport: false,

    client: new ApiClient({
      logger: global.logger,
      cacheFileLocation: cacheFilename
    }),

    screen: null,
    leagues: [],
    portfolios: [],
    tabs: {},
    jobs: null
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

  async load (skipAuthorization) {
    Log.info(`Loading Currency Cop v${AppVersion}`)

    try {
      if (!skipAuthorization) {
        // Configuration
        this.setLoadingMessage('Loading Configuration')
        let config = await ConfigFile.load(DefaultConfig())
        await this.setState({ config })
        Config = config

        // Re-authorization Checks
        this.setLoadingMessage('Checking Authorization')
        let abort = await this.handleLogin(this.state.config[ConfigKeys.ACCOUNT_COOKIE])
        if (abort) {
          return
        }
      }

      this.setLoadingMessage('Loading Api Cache')
      await this.state.client.cache.load({})

      this.setLoadingMessage('Fetching Leagues')
      let leagues = await this.state.client.getLeagues()
      await this.setState({ leagues })

      this.setLoadingMessage('Initialize Workers')
      await this.setupJobSystem()

      this.setLoadingMessage('Gathering Tabs')
      await this.getTabsForEachLeague()
      await this.setupTabJobs()

      this.setLoadingMessage('Loading Portfolios')
      let reports = await ReportFile.load([])
      await this.setState({ reports })

      this.setLoadingMessage('Configuring Events')
      await this.handleReports()

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
      if (versionCheck.data.version !== AppVersion) {
        this.setState({
          upToDate: false,
          newVersion: versionCheck.data.version
        })
      }
    } catch (error) {
      this.setLoadingMessage('Houston, we have a problem.')
      Log.error(`[App] Error occurred during load: ${error.message} - ${error.stack}`)
    }
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

  async handleLogin (sessionId) {
    if (!sessionId) {
      events.emit('clear_config')
      return {
        message: 'Session identifier is required.'
      }
    }

    try {
      let { client } = this.state
      client = await client.authorize({ sessionId })
      this.updateConfig(ConfigKeys.ACCOUNT_USERNAME, client.accountName)
      this.updateConfig(ConfigKeys.ACCOUNT_COOKIE, client.accountSessionId)
      this.setState({
        client
      })
    } catch (error) {
      events.emit('clear_config')
    }

    this.load(true)
    return true
  }

  getTabsForEachLeague () {
    let cookie = getConfig(ConfigKeys.ACCOUNT_COOKIE)
    let accountName = getConfig(ConfigKeys.ACCOUNT_USERNAME)
    let requests = []

    this.state.leagues.forEach(league => {
      requests.push(new Promise((resolve, reject) => {
        return this.state.client.getTabsList({
          league: league.id
        })
          .then(tabs => this.handleTabsList(league.id, tabs))
          .catch(error => {
            console.log(error)
          })
      }))
    })
  }

  // Handle incoming tab list response for a specific league
  handleTabsList (league, list) {
    let current = JSON.stringify(this.state.tabs[league] || {})
    if (current != JSON.stringify(list)) {
      this.setState({
        tabs: {
          ...this.state.tabs,
          [league]: list
        }
      })
    }
  }

  setupJobSystem () {
    let jobs = new Requester()

    jobs.evenlySpaced = true
    jobs.setRateLimitByString('40:60:60')
    jobs.setCacheExpiry(240)
    jobs.start()

    this.setState({
      jobs
    })
  }

  setupTabJobs () {
    for (const league in this.state.tabs) {
      let tabs = this.state.tabs[league]
      tabs.forEach(tab => {
        this.state.jobs.add({
          name: `${league}-${tab.id}`,
          method: () => {
            return this.state.client.getTab({
              league: league,
              tab: tab.index,
              tabId: tab.id
            })
          }
        })
      })
    }
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

    // View
    events.on('/screen/portfolio', ({ portfolioId }) => {
      EventLog.info(`Viewing Portfolio ${ portfolioId }`)
      this.setState({
        screen: (
          <AppPortfolio portfolio={ this.state.reports[portfolioId] } />
        )
      })
    })

    events.on('/screen/portfolio/create', () => {
      EventLog.info(`Creating Portfolio`)
      this.setState({
        screen: (
          <AppPortfolioSettings
            tabs={ this.state.tabs }
            leagues={ this.state.leagues } />
        )
      })
    })

    events.on('/screen/portfolio/update', ({ portfolioId }) => {
      EventLog.info(`Updating Portfolio ${ portfolioId }`)
      this.setState({
        screen: (
          <AppPortfolioSettings
            tabs={ this.state.tabs }
            leagues={ this.state.leagues }
            portfolio={ this.state.reports[portfolioId] } />
        )
      })
    })


    // Delete
    events.on('/portfolio/delete', event => {
      
    })


    // Update
    events.on('/portfolio/update', event => {

    })


    // Create
    events.on('/portfolio/create', event => {
      
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
        <div className="app-viewport draggable">
          <AppControlBar 
            newVersion={this.state.newVersion}
            upToDate={this.state.upToDate}
          />
          <LoadingScreen message={this.state.isLoading} />
        </div>
      )
    }

    if (!this.state.client.accountSessionId) {
      return (
        <div className="app-viewport draggable">
          <AppControlBar 
            newVersion={this.state.newVersion}
            upToDate={this.state.upToDate}
          />
          <LoginScreen onLogin={this.handleLogin.bind(this)} />
        </div>
      )
    }

    return (
      <div className="app-viewport draggable">
        <div className="application">
          <AppHeader 
            newVersion={this.state.newVersion}
            upToDate={this.state.upToDate}
            config={this.state.config}
          />

          <AppSidebar
            config={this.state.config}
            leagues={this.state.leagues}
            portfolios={this.state.reports}
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


class AppHeader extends React.Component {
  render () {
    return (
      <div className="layout-item header">
        <div className="header-logo">
          <img className="header-image" src={ require('../assets/logo.png') } />
          <span className="header-text">Currency Cop</span>
        </div>

        { getConfig(ConfigKeys.ACCOUNT_USERNAME) ? ( <AccountActions /> ) : null }

        <AppControls
          newVersion={this.props.newVersion}
          upToDate={this.props.upToDate} />
      </div>
    )
  }
}


class AppSidebar extends React.Component {
  openPortfolioCreateScreen () {
    events.emit('/screen/portfolio/create')
  }

  render () {
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
              <li key={ portfolio.settings.name }>
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
      value: history[0].reportTotal || 0,
      valueFormatted: formatNumber(history[0].reportTotal || 0),
      currency: 'C'
    }
  }

  getPortfolioChange (portfolio) {
    let { history } = portfolio
    let previousHoldings = history[1].reportTotal || 0
    let currentHoldings = history[0].reportTotal || 0
    let percentageChange = getPercentageChange(previousHoldings, currentHoldings)

    return {
      direction: percentageChange.direction,
      directionIndicator: percentageChange.direction === 'up' ? '+' : '-',
      directionClassName: percentageChange.direction ? percentageChange.direction : '',
      value: Math.abs(previousHoldings - currentHoldings),
      valueFormatted: formatNumber(Math.abs(previousHoldings - currentHoldings)),
      percentage: percentageChange,
      currency: 'C'
    }
  }

  openPortfolio (portfolioId) {
    return (e) => {
      events.emit('/screen/portfolio', {
        portfolioId
      })
    }
  }

  render () {
    return (
      <div className="portfolio-item not-draggable" onClick={ this.openPortfolio(this.props.index) }>
        <div className="info">
          <div className="title">
            { this.props.portfolio.settings.name }
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


class AppContent extends React.Component {
  render () {
    let screen = this.props.screen

    if (!screen) {
      screen = <AppPortfolioUnselected />
    }

    return (
      <div className="layout-item content">
        { screen }
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
      value: history[0].reportTotal || 0,
      valueFormatted: formatNumber(history[0].reportTotal || 0),
      currency: 'C'
    }
  }

  getPortfolioChange (portfolio) {
    let { history } = portfolio
    let previousHoldings = history[1].reportTotal || 0
    let currentHoldings = history[0].reportTotal || 0
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
          league={this.props.portfolio.settings.league}
          name={this.props.portfolio.settings.name}
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


class AppPortfolioUnselected extends React.Component {
  render () {
    return (
      <div className="layout-content portfolio">
        Please Select A Report!
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
  }

  componentWillMount () {
    if (!this.props.portfolio) {
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
        tracking: null,
        league: value
      }
    })
  }

  handleTabChange (tabs) {
    this.setState({
      settings: {
        ...this.state.settings,
        tracking: tabs
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

  }

  handleUpdate () {

  }

  render () {
    let tracking = this.state.settings.tracking
    let tabs = this.props.tabs[this.state.settings.league]

    return (
      <div className="portfolio-settings">
        <h1>Portfolio Settings</h1>

        <div className="form-group">
          <h2>Portfolio Name</h2>
          <input name="name" type="text" value={this.state.settings.name} onChange={this.handleChange} />
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
            name="tracking"
            multi={true}
            value={this.state.settings.tracking}
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

        <PrimaryButton />
      </div>
    )
  }
}


export default App
