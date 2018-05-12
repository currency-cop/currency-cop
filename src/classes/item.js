class Item {
  constructor ({ tab, item }) {
    this.children = []
    this.source = item
    this.tab = { id: tab.id, name: tab.name }
  }

  property (name) {
    return this.source.properties ? this.source.properties
      .find(p => p.name === name) : null
  }

  get id () {
    return this._id || (this._id = this.source.id)
  }

  get icon () {
    return this.source.icon
  }

  get orderId () {
    return this._orderId || (this._orderId = (this.source.poeTradeId || this.source.id))
  }

  get name () {
    return this._name || (this._name = this.source.name
      ? this.source.name
          .split('>')
          .pop()
          .replace('Superior ', '')
      : null)
  }

  get type () {
    return this._type || (this._type = this.source.typeLine
      .replace('Superior ', ''))
  }

  // Determine the 'variant' of items, e.g. some special propery that differentiates
  // items with multiple versions with otherwise identical names
  // the variant (if we know it) must match with the poe.ninja item variant.
  get variant () {
    if (this._variant != undefined) {
      return this._variant
    }

    const { explicitMods, icon, category } = this.source

    if (category && 'maps' in category) {
      // beachhead maps
      if (this.name === 'The Beachhead') {
        if (icon.indexOf('HarbingerRed') > -1) {
          return this._variant = 'T15'
        }
        
        if (icon.indexOf('HarbingerYellow') > -1) {
          return this._variant = 'T10'
        }
        
        if (icon.indexOf('HarbingerWhite') > -1) {
          return this._variant = 'T5'
        }
      }

      // war of the atlas (notched round maps)
      if (icon.indexOf('/Maps/Atlas2Maps/') > -1) {
        return this._variant = 'Atlas2'
      }

      // atlas of worlds (round maps)
      if (icon.indexOf('/Maps/AtlasMaps/') > -1) {
        return this._variant = 'Atlas'
      }

      // release maps
      if (icon.indexOf('/Maps/act4maps/') > -1) {
        return this._variant = 'Pre 2.0'
      }

      // awakening (square maps)
      if (icon.indexOf('/Maps/') > -1) {
        return this._variant = 'Pre 2.4'
      }

      return this._variant = null
    }

    if (explicitMods && explicitMods.length) {
      if (explicitMods.indexOf('Has 1 Abyssal Socket') > -1) {
        return this._variant = '1 Jewel'
      }

      if (explicitMods.indexOf('Has 2 Abyssal Sockets') > -1) {
        return this._variant = '2 Jewels'
      }
    }

    return this._variant = null
  }

  get fullName () {
    if (this._fullName != undefined) {
      return this._fullName
    }

    if (this.name && this.type) {
      return this._fullName = `${this.name} ${this.type}`
    }

    return this._fullName = `${this.type}`
  }

  get unique () {
    return this._unique || (this._unique = this.source.frameType === 3)
  }

  get quality () {
    let property = this.property('Quality')
    return this._quality || (this._quality = property
      ? parseInt(property.values[0][0], 10)
      : 0)
  }

  get level () {
    if (this._level) {
      return this._level
    }

    let property = this.property('Level') || 0
    if (property) {
      property = parseInt(property.values[0][0])
    }

    if (this.source.frameType === 4 && property > 4 && property < 19) {
      property = 1
    }

    if (this.source.frameType === 4 && property === 19) {
      property = 20
    }

    return (this._level = property)
  }

  get links () {
    if (this._links != undefined) {
      return this._links
    }

    let {sockets} = this.source
    if (!sockets) {
      return this._links = 0
    }

    let groupCount = []
    for (var i = 0; i < sockets.length; i++) {
      groupCount[sockets[i].group]++
    }

    let groupMax = Math.max(groupCount[0], groupCount[1])
    return this._links = groupMax > 4 ? groupMax : 0;
  }

  get stackSize () {
    return this.source.stackSize || 1
  }
}

Item.toItem = function ({ source, tab }) {
  return new Item({
    item: source,
    tab
  })
}

module.exports = Item