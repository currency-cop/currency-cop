const logger = window.require('@studio/log')
const fsr = window.require('file-stream-rotator')
const path = window.require('path')

class Logger {
  constructor (opt = {}) {
    this.stream = fsr.getStream({
      filename: path.join(opt.directory, `app-%DATE%.log`),
      date_format: "YYYY-MM-DD",
      size: `10M`,
      frequency:"daily"
    })

    logger.out(this.stream)
  }

  topic (ns) {
    return logger(ns)
  }
}

export default Logger