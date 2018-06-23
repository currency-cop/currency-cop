class Requester {
  constructor () {
    this.requests = {}
    this.listeners = {}

    this.queue = []
    this.previous = []
    this.lastCalled = null
    this.requestsMade = 0

    this.cacheEnabled = false
    this.cache = {}
    this.cacheExpirationInSeconds = 0

    this.evenlySpaced = false
    this.rateLimit = false
  }

  stop () {
    this.state = 0
    clearTimeout(this.queueTimer)
  }

  start () {
    if (!this.rateLimit) {
      return console.warn('[Requester] set a rate limit window before calling start()')
    }
    
    if (this.queueTimer) {
      clearTimeout(this.queueTimer)
    }

    // Obtain Rate Limit Window
    let reqWindow = this.evenlySpaced
      ? this.rateLimitEvenlySpaced
      : this.rateLimit

    // Setup queue mechanisms
    this.state = 1
    this.queue = []
    this.queueTimer = null
    this.lastCalled = Date.now()

    // Create fill function
    function fillQueue (previous) {
      for (const name in this.requests) {
        let request = this.requests[name]
        if (previous.indexOf(request.name) > -1) {
          continue
        }
        
        if (this.queue.length < reqWindow.maxRequestsPerInterval) {
          this.previous.push(request.name)
          this.queue.push(request)
          continue
        }
      }
    }

    // Create queue function
    async function thread () {
      if (!this.state) {
        return
      }

      let requests = Object.keys(this.requests).length
      let threshold = this.lastCalled + reqWindow.interval
      let now = Date.now()
      
      // Ignore request when no requests
      if (!requests) {
        clearTimeout(this.queueTimer)
        this.queueTimer = setTimeout(thread.bind(this), reqWindow.interval)
        return
      }

      // Adjust timer when called too early or no requests exist
      if (now < threshold) {
        clearTimeout(this.queueTimer)
        this.queueTimer = setTimeout(thread.bind(this), threshold - now)
        return
      }
      
      // Capture previous queue
      let previous = this.previous

      // Reset previous queue
      if (requests === this.previous.length) {
        this.previous = []
      }

      this.queue = []

      // Freshen cache
      Object.keys(this.cache).forEach(key => this.getCacheEntry(key))

      // Do initial queue filling based on prior queue
      fillQueue.bind(this)(previous)
      
      // Determine whether we have a large enough queue
      // If not, fill based on current queue
      if (this.queue.length < reqWindow.maxRequestsPerInterval) {
        fillQueue.bind(this)(this.previous)
      }
      
      // Invoke
      for (const index in this.queue) {
        // console.log('handling queue', index, this.queue[index])
        let request = this.queue[index]
        let entry = this.getCacheEntry(request.name)
        if (entry) {
          this.fire({
            name: request.name,
            response: entry.response
          })
          continue
        }

        // console.log('firing request', reqWindow.maxRequestsPerInterval, reqWindow.interval)
        let response = await request.method()
        this.cache[request.name] = {
          response,
          createdAt: Date.now()
        }

        this.requestsMade++
        this.fire({
          name: request.name,
          response
        })
      }
      
      // Finish thread
      this.lastCalled = Date.now()
      this.queueTimer = setTimeout(thread.bind(this), reqWindow.interval)
      // console.log('finishing timer')
    }

    
    // console.log('creating timer', reqWindow.interval)
    this.queueTimer = setTimeout(thread.bind(this), reqWindow.interval)
  }

  // Configuration
  setRateLimitByString (str) {
    let windowStr = str.split(',')[0]
    let options = windowStr.split(':')
    this.setRateLimit(options[1], options[0], options[2])
  }

  setRateLimit (interval, maxRequestsPerInterval, timeoutDuration) {
    this.rateLimit = {
      interval: parseInt(interval, 10) * 1000,
      maxRequestsPerInterval: parseInt(maxRequestsPerInterval, 10),
      timeoutDuration: parseInt(timeoutDuration, 10)
    }

    this.rateLimitEvenlySpaced = {
      interval: this.rateLimit.interval / this.rateLimit.maxRequestsPerInterval,
      maxRequestsPerInterval: 1,
      timeoutDuration
    }
  }

  setCacheExpiry (seconds) {
    this.cacheEnabled = true
    this.cacheExpirationInSeconds = seconds * 1000
  }

  // Helpers
  getCacheEntry (key) {
    let entry = this.cache[key]
    
    // Determine whether entry is still fresh
    if (entry && (Date.now() - entry.createdAt) < this.cacheExpirationInSeconds) {
      return entry
    }
    
    // Otherwise purge entry
    delete this.cache[key]
  }

  // Listeners
  on (name, callable, timeout) {
    let id = Date.now().toString(36) + Math.random().toString(36).slice(-2)
    this.listeners[id] = { 
      interval: timeout ? timeout * 1000 : 0, 
      lastCalled: null, 
      name,
      callable 
    }
    return id
  }

  off (id) {
    delete this.listeners[id]
  }

  fire (o) {
    let now = Date.now()
    Object.keys(this.listeners).forEach(id => {
      let listener = this.listeners[id]
      if (o.name === listener.name) {
        if (!listener.interval || !listener.lastCalled) {
          listener.callable(o.response)
          listener.lastCalled = now
          return
        }
        
        if (listener.interval && listener.lastCalled && (now - listener.lastCalled) > listener.interval) {
          listener.callable(o.response)
          listener.lastCalled = now
        }
      }
    })
  }

  // Checking
  has (name) {
    return !!this.requests[name]
  }

  // Modifying
  remove (name) {
    delete this.requests[name]
  }

  add ({ name, method }) {
    let now = Date.now()

    if (this.cacheEnabled) {
      let entry = this.getCacheEntry(name)
      if (entry) {
        return this.fire({
          name,
          response: entry
        })
      }
    }

    if (!this.requests[name]) {
      this.requests[name] = { name, method }
    } else {
      console.warn('Job already exists, ignoring...')
    }
  }
}

/* Example Usage
// Create request pool
let request = new Requester()
request.evenlySpaced = true
request.setRateLimitByString('5:3:60')
request.setCacheExpiry(30)
request.start()

// Add requests to request pool
tabs.forEach(tab => request.push(() => tab))

// Add listeners to requests in request pool
request.on(tabs[0], (response) => {
  console.log(new Date(), 'from listener w/ 40s timeout', response)
}, 40)

request.on(tabs[6], (response) => {
  console.log(new Date(), 'from listener', response)
})
*/

module.exports = Requester