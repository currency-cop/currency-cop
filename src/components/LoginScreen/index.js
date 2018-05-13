import React, { PropTypes } from 'react'
import { GoToUrl } from '../../helpers'
import Input from '../Input'
import PrimaryButton from '../PrimaryButton'

import './index.css'

class LoginScreen extends React.Component {
  state = {
    value: '',
    error: false
  }

  componentWillMount() {
    this.setState({ 
      value: this.props.value || ''
    })
  }

  componentWillUpdate(nextProps) {
    if (nextProps.value !== this.props.value) {
      // eslint-disable-next-line react/no-will-update-set-state
      this.setState({
        value: nextProps.value 
      })
    }
  }

  componentWillUnmount () {
    this.setState({
      error: null
    })
  }

  handleChange = (event, value) => {
    this.setState({ value })
  }

  async handleLoginButtonClick () {
    let {value} = this.state
    if (!value) {
      return this.setState({
        error: 'Session ID is required!'
      })
    }

    if (!CC.Constants.POE_COOKIE_REGEXP.test(value)) {
      return this.setState({
        error: `Session ID must be a 32 character hexadecimal string!`
      })
    }

    // Attempt login
    try {
      await this.props.onLogin(value)
    } catch (error) {
      return this.setState({
        error: error.message
      })
    }
  }

  render() {
    const { value, ...other } = this.props

    let errorMessageElement
    if (this.state.error) {
      errorMessageElement = (
        <p className="error">✋ {this.state.error}</p>
      )
    }

    let loginButtonStyle = {
      marginTop: 8,
      width: '100%'
    }

    let sessionIdInputElement = (<Input
      id={CC.Constants.POE_COOKIE_NAME}
      placeholder={CC.Constants.POE_COOKIE_NAME}
      value={this.state.value}
      onChange={event => this.setState({
        value: event.target.value
      })}
    />)

    return (
      <div className="login-viewport viewport">

        {errorMessageElement}

        <div className="viewport row middle-xs center-xs">
          <div className="login-container">
            <div className="draggable row">
              <div className="col-xs-12">
                <div className="box">
                  <h2>Login</h2>
                </div>
              </div>
            </div>

            <div className="draggable row center-xs">
              <div className="col-xs-12">
                <div className="not-draggable box">
                  <div>
                    <label>Session ID</label>

                    {sessionIdInputElement}

                    <p>
                      👮 Need help finding your session id?&nbsp;
                      <a href={CC.Constants.SESSION_URL} onClick={GoToUrl.bind(this)}>Click here!</a>
                    </p>
                  </div>

                  <PrimaryButton 
                    style={loginButtonStyle} 
                    onClick={this.handleLoginButtonClick.bind(this)}>
                    Login
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

module.exports = LoginScreen