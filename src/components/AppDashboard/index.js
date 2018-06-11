import React, { PropTypes } from 'react'
import { isWithinRange, startOfMonth, getDate, format } from 'date-fns'

import { Card, CardHeader, CardContent } from '../Card'
import PortfolioList from '../PortfolioList'

import './index.css'


const ReactHighstock = require('react-highcharts/ReactHighstock')
import timeseries from 'timeseries-bins'

function ts (options) {
  return new Promise((resolve, reject) => {
    timeseries(options, (err, bins) => {
      if (err) return reject(err)
      return resolve(bins.map(v => {
        return [v[options.timestampField], v[options.dataField]]
      }))
    })
  })
}


class AppDashboard extends React.Component {
  constructor (props) {
    super(props)

    this.interval = setInterval(() => {
      this.setState({ 
        time: Date.now() 
      })
    }, 1000)
  }

  componentWillUnmount () {
    clearInterval(this.interval)
  }

  componentWillMount () {
    this.getChartData()
  }

  goToCreatePortfolio () {
    CC.Events.emit('/screen/portfolio/create')
  }

  getChartData () {
    let data = []
  
    this.props.portfolios.forEach(async folio => {
      let history = folio.history.map(({ createdAt, total, items }) => {
        return {
          createdAt,
          total,
          items: items.length
        }
      })

      let options = {
        data: history,
        dataField: 'total',
        timestampField: 'createdAt',
        start: startOfMonth(Date.now()),
        end: Date.now(),
        interval: 'day',
        fill: 0
      }

      options.fcn = 'first'
      let pdata = await ts(options)
      let adata

      options.fcn = 'max'
      adata = await ts(options)
      adata.forEach((v, i) => { pdata[i].push(v[1]) })

      options.fcn = 'min'
      adata = await ts(options)
      adata.forEach((v, i) => { pdata[i].push(v[1]) })

      options.fcn = 'last'
      adata = await ts(options)
      adata.forEach((v, i) => { pdata[i].push(v[1]) })

      data.push({
        time: Date.now(),
        name: folio.name,
        data: pdata
      })
    })

    this.setState({
      chartData: {
        updated: Date.now(),
        data: [
          ...data
        ]
      }
    })
  }

  render () {
    if (this.props.portfolios.length) {
      return (
        <div className="layout-content dashboard row">
          <div className="col-md-4 col-sm-6 col-xs-12">
            <Card>
              <CardHeader title="Portfolios" />
              <CardContent>
                <PortfolioList
                  portfolioId={this.props.portfolioId}
                  portfolios={this.props.portfolios} />
              </CardContent>
            </Card>
          </div>

          <div className="col-md-8 col-sm-6 col-xs-12">
            <Card>
              <CardHeader title="Daily Average" />
              <CardContent className="league-breakdown">
              <ReactHighstock
                config={{
                  tooltip: {
                    valueDecimals: 2
                  },
                  rangeSelector: false,
                  series: this.state.chartData ? this.state.chartData.data : []
                }}  />
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    return (
      <div className="layout-content dashboard">
        <h1>Welcome to Currency Cop 👮</h1>
        <h2>Click "Add Portfolio" to get started!</h2>
      </div>
    )
  }
}

import { hot } from 'react-hot-loader'
export default hot(module)(AppDashboard)