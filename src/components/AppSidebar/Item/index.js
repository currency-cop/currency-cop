import React, { PropTypes } from 'react'
import styles from './index.css'

class PortfolioItem extends React.Component {
  openPortfolio (portfolioId) {
    return (e) => {
      if (this.props.portfolio.latestReport()) {
        CC.Events.emit('/screen/portfolio', {
          portfolioId
        })
      } else {
        CC.Events.emit('/screen/portfolio/update', {
          portfolioId: this.props.portfolio.id
        })
      }
    }
  }

  getClassName () {
    let {viewing, portfolio} = this.props
    let defaultClassName = `portfolio-item`

    if (portfolio.id !== viewing) {
      return defaultClassName
    }

    return `${defaultClassName} active`
  }

  renderDeadLeague () {
    return (
      <div className={this.getClassName()} onClick={ this.openPortfolio(this.props.index) }>
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

  render () {
    if (this.props.portfolio.isOld) {
      return this.renderDeadLeague()
    }

    let change = this.props.portfolio.getChange()
    let holdings = this.props.portfolio.getHoldings()
    let lastUpdated = this.props.portfolio.getLastUpdateTime()

    return (
      <div className={this.getClassName()} onClick={ this.openPortfolio(this.props.index) }>
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

export default PortfolioItem