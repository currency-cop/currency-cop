import React, { PropTypes } from 'react'
import AppSidebarPortfolioList from '../AppSidebarPortfolioList'

import styles from './index.css'

class AppSidebar extends React.Component {
  render () {
    return (
      <div className="layout-item sidebar">
        <button onClick={this.openPortfolioCreateScreen}>
          Add Portfolio
        </button>

        <AppSidebarPortfolioList
          portfolios={this.props.portfolios} />
      </div>
    )
  }

  openPortfolioCreateScreen () {
    CC.Events.emit('/screen/portfolio/create')
  }
}

export default AppSidebar
