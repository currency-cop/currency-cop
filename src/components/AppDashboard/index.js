import React, { PropTypes } from 'react'
import './index.css'

class AppDashboard extends React.Component {
  render () {
    if (this.props.portfolios.length) {
      return (
        <div className="layout-content portfolio dashboard">
          <h1>Welcome Back 👋</h1>
          <h2>Select a Portfolio in the sidebar to get started!</h2>
        </div>
      )
    }

    return (
      <div className="layout-content portfolio dashboard">
        <h1>Welcome to Currency Cop 👮</h1>
        <h2>Click "Add Portfolio" to get started!</h2>
      </div>
    )
  }
}

export default AppDashboard