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
      account: Config.get(Constants.CONFIG_USERNAME),
      cookie: Config.get(Constants.CONFIG_COOKIE),
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
    CC.Events.emit('create_report', {
      report: this.state.report
    })

    this.handleCreateReportCancelled()
  }

  handleReportSelected (event, reportId) {
    if (!this.props.reports[reportId].history.length) {
      return
    }

    CC.Events.emit('view_report', {
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