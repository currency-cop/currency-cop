import React, { PropTypes } from 'react'
import './index.css'

class AppSidebar extends React.Component {
  render () {
    return (
      <div className="layout-item sidebar">

      </div>
    )
  }

  openPortfolioCreateScreen () {
    CC.Events.emit('/screen/portfolio/create')
  }
}

export default AppSidebar
