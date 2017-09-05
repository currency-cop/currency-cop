# Currency Cop for Path of Exile

Basically takes your private / public stashes and tells you how much chaos you have.

### To get started:
* Run `npm install`

##### Development
* Run `npm run dev` to start webpack-dev-server. Electron will launch automatically after compilation.

##### Production

###### One Shot

* Run `npm run package` to have webpack compile your application into `dist/bundle.js` and `dist/index.html`, and then an electron-packager run will be triggered for the current platform/arch, outputting to `builds/`