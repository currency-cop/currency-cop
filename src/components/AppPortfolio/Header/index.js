import React, { PropTypes } from 'react'
import './index.css'

import HeaderMeta from './Meta'
import HeaderChart from './Chart'
import HeaderLargeStats from './Stats'

class PortfolioHeader extends React.Component {
  render () {
    return (
      <div className="portfolio-header">
        <h1>{this.props.name}</h1>

        <HeaderMeta
          league={this.props.league}
          lastUpdated={this.props.lastUpdated} />

        <HeaderLargeStats
          holdings={this.props.holdings}
          profit={this.props.change} />

        <HeaderChart
          data={this.props.data} />
      </div>
    )
  }
}

export default PortfolioHeader
