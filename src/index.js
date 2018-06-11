import React from 'react'
import { render } from 'react-dom'

// Import styles
import 'material-design-icons/iconfont/material-icons.css'
import 'typeface-roboto'
import '@/assets/fonts/segmdl2-webfont.woff2'

// Import application
import App from '@/components/App'

// Now we can render our application into it
window.App = render(<App />, document.getElementById('app'))
