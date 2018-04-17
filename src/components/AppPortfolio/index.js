import React, { PropTypes } from 'react'
import './index.css'

import PortfolioHeader from './Header'
import PortfolioItemList from './ItemList'

class AppPortfolio extends React.Component {
  render () {
    return (
      <div className="layout-content portfolio">
        <PortfolioHeader
          league={this.props.portfolio.league}
          name={this.props.portfolio.name}
          data={this.getHistory()}
          lastUpdated={this.props.portfolio.getLastUpdateTime()}
          holdings={this.props.portfolio.getHoldings()}
          change={this.props.portfolio.getChange()} />

        <PortfolioItemList
          id={this.props.portfolio.id}
          items={this.props.portfolio.latestReport().items} />
      </div>
    )
  }

  constructor (props) {
    super(props)

    this.interval = setInterval(() => {
      this.setState({ 
        time: Date.now() 
      })
    }, 60000)
  }

  componentWillUnmount () {
    clearInterval(this.interval)
  }

  getHistory () {
    return this.props.portfolio.history
  }
}

export default AppPortfolio
