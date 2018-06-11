class League {
  constructor (data = {}) {
    this.name = data.id || data.name
    this.startDate = new Date(data.startAt || data.startDate)
    this.endData = new Date(data.endAt || data.endDate)
    this.url = data.url
  }

  isActive () {
    return this.start
  }

  getNinjaFormattedName () {
    let name = this.name
    let formattedName = name
    let isEvent = name.indexOf(' Event') > -1
    let isSSF = name.indexOf('SSF ') > -1
    let isHC = name.match(/\s?HC\s?/)

    // Patch for leagues like:
    // SSF Flashback Event (BRE003) -> 001 (Standard)
    // HC SSF Flashback Event (BRE004) -> 002 (Hardcore)
    if (isEvent && isSSF) {
      if (isHC) {
        formattedName = name.replace(/\d{3}/, '002')
      } else {
        formattedName = name.replace(/\d{3}/, '001')
      }
    }

    // Patch for leagues like:
    // SSF Bestiary HC -> Hardcore Bestiary
    if (!isEvent && isSSF && isHC) {
      formattedName = name.replace(' HC', '')
      formattedName = `Hardcore ${league}`
    }

    // Patch for leagues like:
    // SSF Bestiary -> Bestiary
    if (isSSF) {
      formattedName = name.replace('SSF ', '')
    }

    return formattedName
  }
}

export default League
