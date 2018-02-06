import React, { PropTypes } from 'react'

class LoadingScreen extends React.Component {
  render () {
    let errorElement

    if (this.props.error) {
      errorElement = (
        <p className="error">&nbsp;{this.props.error}</p>
      )
    }

    return (
      <div className="login-viewport viewport">
        <div className="viewport row middle-xs center-xs">
          <p>{this.props.message}</p>
          {errorElement}
        </div>
      </div>
    )
  }
}

module.exports = LoadingScreen