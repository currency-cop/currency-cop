import fs from 'fs'

class DataFile {
  constructor (type, filename) {
    this.filename = filename
    this.log = CC.Logger.topic(type)
  }

  get (key) {
    return this.data[key]
  }

  set (key, value) {
    this.data[key] = value
    this.save(this.data)
    return this
  }

  load (defaults) {
    try {
      this.log.info(`Loading file from: ${this.filename}`)
      this.data = JSON.parse(fs.readFileSync(this.filename))
    } catch(error) {
      this.log.warn(`File could not be loaded: ${error.message}`)
      this.data = defaults
    }
    return this
  }

  save (data) {
    try {
      this.log.info(`Saving file: ${this.filename}`)
      this.data = data
      fs.writeFileSync(this.filename, JSON.stringify(this.data))
    } catch (error) {
      this.log.critical(`Could not save file: ${error.message}`)
    }
    return this
  }
}

module.exports = DataFile