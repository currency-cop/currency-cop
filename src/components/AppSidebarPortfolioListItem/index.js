import React, { PropTypes } from 'react'
import styles from './index.css'

class AppSidebarPortfolioListItem extends React.Component {
  openPortfolio (portfolioId) {
    return (e) => {
      CC.Events.emit('/screen/portfolio', {
        portfolioId
      })
    }
  }

  render () {
    if (this.props.portfolio.isOld) {
      return (
        <div className="portfolio-item not-draggable" onClick={ this.openPortfolio(this.props.index) }>
          <div className="info">
            <div className="title">
              { this.props.portfolio.name }
            </div>
            <div className="last-updated">
              This league is over, please remove.
            </div>
          </div>
        </div>
      )
    }

    let change = this.props.portfolio.getChange()
    let holdings = this.props.portfolio.getHoldings()
    let lastUpdated = this.props.portfolio.getLastUpdateTime()

    return (
      <div className="portfolio-item not-draggable" onClick={ this.openPortfolio(this.props.index) }>
        <div className="info">
          <div className="title">
            { this.props.portfolio.name }
          </div>
          <div className="last-updated">
            { lastUpdated }
          </div>
        </div>
        
        <div className="value">
          <div className="total">
            { holdings.valueFormatted } { holdings.currency }
          </div>
          <div className={`change ${ change.directionClassName }`}>
           { change.directionIndicator } { change.valueFormatted } { change.currency }
          </div>
        </div>
      </div>
    )
  }
}

export default AppSidebarPortfolioListItem