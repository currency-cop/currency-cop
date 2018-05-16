import DataFile from './datafile'

class CacheFile extends DataFile {
  set (key, value, ttl) {
    if (this.data[key] != null 
      && this.data[key].value === value
      && this.data[key].ttl === (ttl * 1000)) {
      return this
    }

    this.data[key] = {
      key: key,
      value: value,
      ttl: (ttl * 1000),
      expiresAt: Date.now() + (ttl * 1000)
    }

    this.save()

    return this
  }

  get (key) {
    let entry = this.data[key]
    if (entry && entry.expiresAt >= Date.now()) {
      return entry.value
    } else if (entry) {
      delete this.data[key]
      this.save()
      return
    }
  }

  save () {
    return super.save(this.data)
  }
}

export default CacheFile