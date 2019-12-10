import React, { PropTypes } from 'react';
import Button from '../Button';

class AccountActions extends React.Component {
  handleLogoutClick() {
    CC.Events.emit('/config/clear');
  }

  render() {
    let username = CC.Config.get(CC.Constants.CONFIG_USERNAME);
    if (username) {
      return (
        <div className="account-actions">
          <Button onClick={() => this.handleLogoutClick()}>
            {username} (logout)
          </Button>
        </div>
      );
    }

    return <div />;
  }
}

export default AccountActions;
