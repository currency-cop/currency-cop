import AppControls from '../AppControls'
import AccountActions from '../AccountActions'


class AppHeader extends React.Component {
  render () {
    return (
      <div className="layout-item header">
        <div className="header-logo">
          <img className="header-image" src={ require('../assets/logo.png') } />
          <span className="header-text">Currency Cop</span>
        </div>

        <AccountActions />

        <AppControls
          newVersion={this.props.newVersion}
          upToDate={this.props.upToDate} />
      </div>
    )
  }
}

module.exports = AppHeader
