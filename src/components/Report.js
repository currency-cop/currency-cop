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
    return CC.Events.emit('notification', {
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
    CC.Events.emit('stop_viewing_report', null)
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
      CC.Events.emit('update_report', {
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
        CC.Events.emit('update_report', {
          report: this.props.report
        })
      })
  }

  deleteReport () {
    CC.Events.emit('delete_report', {
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