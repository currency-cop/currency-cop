import React, { PropTypes } from 'react'
import AppControls from '../AppControls'

class AppControlBar extends React.Component {
  render () {
    return (
      <div className="app-control not-draggable">
        <AppControls
          newVersion={this.props.newVersion}
          upToDate={this.props.upToDate} />
      </div>
    )
  }
}

module.exports = AppControlBar