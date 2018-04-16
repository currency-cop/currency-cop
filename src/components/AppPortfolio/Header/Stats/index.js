import React, { PropTypes } from 'react'
import './index.css'

class HeaderLargeStats extends React.Component {
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

        {/* <div>
          <h3>{this.props.dayProfit} {this.props.currency}</h3>
          <h2>24H Gain / Loss</h2>
        </div> */}
      </div>
    )
  }
}

export default HeaderLargeStats
