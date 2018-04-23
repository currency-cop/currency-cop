import React, { PropTypes } from 'react'
import AppDashboard from '../AppDashboard'

class AppContent extends React.Component {
  render () {
    let screen = this.props.screen

    return (
      <div className="layout-item content">
        { screen }
      </div>
    )
  }
}

module.exports = AppContent