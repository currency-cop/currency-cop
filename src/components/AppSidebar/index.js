import React, { PropTypes } from 'react'
import PortfolioList from './List'

import styles from './index.css'

class AppSidebar extends React.Component {
  render () {
    return (
      <div className="layout-item sidebar">
        <button onClick={this.openPortfolioCreateScreen}>
          Add Portfolio
        </button>

        <PortfolioList
          portfolioId={this.props.portfolioId}
          portfolios={this.props.portfolios} />
      </div>
    )
  }

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

  openPortfolioCreateScreen () {
    CC.Events.emit('/screen/portfolio/create')
  }
}

export default AppSidebar
