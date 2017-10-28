import fs from 'fs'

class DataFile {
  constructor (type, filename) {
    this.filename = filename
    this.log = logger.topic(type)
  }

  load (defaults) {
    try {
      this.log.info(`Loading file from: ${this.filename}`)
      return JSON.parse(fs.readFileSync(this.filename))
    } catch(error) {
      this.log.warn(`File could not be loaded: ${error.message}`)
      return defaults
    }
  }

  save (data) {
    try {
      this.log.info(`Saving file: ${this.filename}`)
      fs.writeFileSync(this.filename, JSON.stringify(data))
    } catch (error) {
      this.log.critical(`Could not save file: ${error.message}`)
    }
  }
}

module.exports = DataFile