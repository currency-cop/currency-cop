import React, { PropTypes } from 'react'
import './index.css'

import HeaderMeta from './Meta'
import HeaderChart from './Chart'
import HeaderLargeStats from './Stats'

class PortfolioHeader extends React.Component {
  render () {
    return (
      <div className="portfolio-header">
        <h1>
          {this.props.name}

          <i onClick={(e) => this.edit(e)} className="material-icons">&#xE8B8;</i>
        </h1>

        <HeaderMeta
          history={this.props.data}
          league={this.props.league}
          lastChecked={this.props.lastChecked}
          lastUpdated={this.props.lastUpdated} />

        <HeaderLargeStats
          holdings={this.props.holdings}
          profit={this.props.change} />

        <HeaderChart
          data={this.props.data} />
      </div>
    )
  }

  edit () {
    CC.Events.emit('/screen/portfolio/update', {
      portfolioId: this.props.id
    })
  }
}

export default PortfolioHeader
