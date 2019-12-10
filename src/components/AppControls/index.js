import { remote } from 'electron';
import React, { PropTypes } from 'react';

import Button from '@/components/Button';
import { GoToUrl } from '@/helpers';
import styles from './index.css';

class AppControls extends React.Component {
  componentWillMount() {
    this.setState({
      window: remote.getCurrentWindow()
    });

    this.handleFullscreenButtonClick = this.handleFullscreenButtonClick.bind(
      this
    );
    this.handleMinimizeButtonClick = this.handleMinimizeButtonClick.bind(this);
    this.handleCloseButtonClick = this.handleCloseButtonClick.bind(this);
  }

  handleMinimizeButtonClick() {
    this.state.window.minimize();
  }

  handleFullscreenButtonClick() {
    let { window } = this.state;

    if (process.platform === 'darwin') {
      if (!window.isFullScreen()) {
        window.setFullScreen(true);
      }

      window.setFullScreen(false);
    }

    if (!window.isMaximized()) {
      return window.maximize();
    }

    window.unmaximize();
  }

  handleCloseButtonClick() {
    this.state.window.close();
  }

  render() {
    let updateIndicatorElement;

    if (!this.props.upToDate && this.props.newVersion) {
      updateIndicatorElement = (
        <Button onClick={e => GoToUrl(this.props.newVersion.html_url, e)}>
          💕 New Release
        </Button>
      );
    }

    return (
      <div className="app-controls not-draggable">
        <div className="app-update">{updateIndicatorElement}</div>
        <div
          className="minimize-control"
          onClick={this.handleMinimizeButtonClick}
        >
          &#xE921;
        </div>
        <div
          className="fullscreen-control"
          onClick={this.handleFullscreenButtonClick}
        >
          &#xE922;
        </div>
        <div className="close-control" onClick={this.handleCloseButtonClick}>
          &#xE8BB;
        </div>
      </div>
    );
  }
}

export default AppControls;
