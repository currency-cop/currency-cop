import React from 'react'

class AppContent extends React.Component {
  componentDidMount() {
    this.screen = this.props.screenAction
  }

  componentDidUpdate() {
    if (this.props.screenAction != this.screen) {
      this._div.scrollTop = 0
      this.screen = this.props.screenAction
    }
  }

  render () {
    let screen = this.props.screen

    return (
      <div className="layout-item content" ref={(ref) => this._div = ref}>
        { screen }
      </div>
    )
  }
}

export default AppContent