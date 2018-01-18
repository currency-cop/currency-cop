import Button from '../Button'
import Constants from '../../constants'

class AccountActions extends React.Component {
  handleLogoutClick () {
    this.props.events.emit('/config/clear')
  }

  render () {
    let { config } = this.props
    let username = config.get(Constants.CONFIG_USERNAME)
    if (username) {
      return (
        <div className="account-actions">
          <Button onClick={ this.props.onClick }>
            { username } (logout)
          </Button>
        </div>
      )
    }
  }
}

module.exports = AccountActions