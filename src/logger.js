var fs = require('fs'); 
var util = require('util');
var path = require('path');

/**
 * options: { 
 *   section:'...', 
 *   retentionMinutes: in minutes,
 *   retentionGranularity: n+('m'|'h'|'d')
 *   retentionCheckInterval: 
 *   retention: true|false
 *   logdir: directory,
 *   logname: file name (%DATE: use date string as log name),
 *   withtime: true|false
 *   destination: 'file'|'console'|'both'
 * }
 */
function logger(options){
  var _cnt = -1;
  var _prev_log_period = 0;
  var _log_status = {};

  var _oneday = 1000*60*60*24;
  var _onehour = 1000*60*60;
  var _oneminute = 1000*60;

  var _levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL']

  var noop = function(){};

  // Check configuration
  options = options || {};
  var _level = options.level || 0;
  var _section = options.section || null;
  var _retentionCheck = options.retentionCheck || false;
  var _retentionMinutes = options.retentionMinutes || 60*24*7;
  var _retentionCheckInterval = options.retentionCheckInterval || _oneday; 
  var _retentionGranularity = (options.retentionGranularity || '1d');
  var _retentionRotationNum = (options.retentionRotationNum || 30 );
  var _sync = options.sync || false;
  var _logname = options.logname || '%DATE';
  var _logdir = options.logdir || 'logger';
  var _withtime = options.withtime != null ? options.withTime : true;
  var _destination = (options.destination || 'both').toLowerCase();
  var _context = options.context || null

  // Setup state variables in terms of configuration
  var _debugMode = process.env.NODE_DEBUG && process.env.NODE_DEBUG.indexOf(_section)>=0;
  if (!_debugMode) this.debuglog = noop; 
  
  var _tofile = (_destination==='both' || _destination==='file') 
                ? ( _sync===true 
                     ? function(f,d,cb){ fs.appendFileSync(f,d); }
                     : fs.appendFile
                  ) 
                : noop;
  var _console = (_destination==='both' || _destination==='console') 
    ? console 
    : { log:noop, info:noop, warn:noop, error:noop};
  var _dateform = _logname==='%DATE';
  var _retentionGranularityInEpoch = _granularityToEpoch(_retentionGranularity);
  var _logFilter = (_dateform) ? (new RegExp(/^log-.*/)) : (new RegExp('^'+_logname+'.*')); 

  var _cleanHdl = null;
  _mkdirpSync(_logdir);
  if (_retentionCheck){
     _cleanHdl = setInterval(function(){
       _removeExpiredLogs();
     },_retentionCheckInterval*_oneminute);
  }

  this.topic = function (name) {
    return {
      debug: createLogFn('debug', name),
      log: createLogFn('info', name),
      info: createLogFn('info', name),
      warn: createLogFn('warn', name),
      error: createLogFn('error', name),
      critical: createLogFn('critical', name)
    }
  }

  this.configure = function (options) {
    _level = options.level || 0;
    _section = options.section || null;
    _retentionCheck = options.retentionCheck || false;
    _retentionMinutes = options.retentionMinutes || 60*24*7;
    _retentionCheckInterval = options.retentionCheckInterval || _oneday; 
    _retentionGranularity = (options.retentionGranularity || '1d');
    _retentionRotationNum = (options.retentionRotationNum || 30 );
    _sync = options.sync || false;
    _logname = options.logname || '%DATE';
    _logdir = options.logdir || 'logger';
    _withtime = options.withtime != null ? options.withTime : true;
    _destination = (options.destination || 'both').toLowerCase();
    _context = options.context || null
  }

  function createLogFn(type, name) {
    return function () {
      if (_levels.slice(_level).indexOf(type.toUpperCase()) < 0) return;
      var rst = _generateOutputString(type, name, arguments); 
      _tofile(_log_name_status(rst.length+1),rst+'\n',function(err){ if (err) console.error(err)} );
      type = _console[type] ? type : 'error'
      _console[type].apply(_context,[rst]);
    }
  }

  function debuglog(){
    if (_debugMode)
      log.apply(this,arguments);
  }

  this.debuglog = debuglog

  function destroy(){
     if (_cleanHdl)
       clearInterval(_cleanHdl);
     _cleanHdl = null;
  }

  this.destroy = destroy

  function _generateOutputString(type, name, inputs){
     var rst = '';
     rst = _withtime ? ('[' + _timeStr() + '] ') : ''
     rst += '[' + type.toUpperCase() + '] '
     rst += '[' + name + '] '
     rst += util.format.apply(null,inputs);
     return rst;
  }

  function _removeExpiredLogs(){
    fs.readdir(_logdir,function(err,files){
      if (err) return console.error(err);
      files.forEach(function(file,idx,arr){
         if ( !file.match(_logFilter) )
            return;
         var completePath = path.join(_logdir,file);
         fs.stat(completePath,function(err,stats){
            if (err) return console.error(err);
            var lastModTime = new Date(stats.mtime);
            if ( 
                  _shouldBeRemovedForExpiration(completePath,stats) ||
                  _shouldBeRemovedForRotation(completePath)
               ){
               fs.unlink(completePath,function(err){
                  if (err) return console.error(err);   
               });
            }
         });
      });
    });
  }
  
  function _shouldBeRemovedForRotation(fn){
    var stat = _log_status[fn];
    if (!stat) // other files
        return false;
    if (_cnt-stat[0]>=_retentionRotationNum){
        delete _log_status[fn];
        return true;
    }
    return false;
  }

  function _shouldBeRemovedForExpiration(fn,stats){
    if (!_log_status[fn]) //other files
      return false;
    var lastModTime = new Date(stats.mtime);
    var now = Date.now();
    if (now-lastModTime>_retentionMinutes*_oneminute+_oneminute*0.1){
      delete _log_status[fn];
      return true;
    }
    return false;
  }

  this.getCurrentLogsFile = function () {
    var this_period = _dateStr();
    return fs.readFileSync((_dateform) 
      ? path.join(_logdir,'log-'+this_period+'.'+_cnt) 
      : path.join(_logdir,_logname+'.'+_cnt))
  }

  function _log_name_status(new_size){ 
    var this_period = _dateStr();
    var fn = '';
    if (this_period!==_prev_log_period) {
      _cnt++; // do this first
      _prev_log_period = this_period;
      fn = (_dateform) ? path.join(_logdir,'log-'+this_period+'.'+_cnt) 
                      : path.join(_logdir,_logname+'.'+_cnt);
      _log_status[fn] = [_cnt,new_size]
    } else {
      fn = (_dateform) ? path.join(_logdir,'log-'+this_period+'.'+_cnt) 
                      : path.join(_logdir,_logname+'.'+_cnt);
      _log_status[fn][1] += new_size;
    }
    return fn; 
  }

  function _granularityToEpoch(str){
    var n = parseInt(str);
    if (isNaN(n))
        return _oneday;
    var unit = str.replace(n,'').trim().toLowerCase();
    var p = 1000;
    if (unit==='d') p=n*_oneday;
    else if (unit==='h') p=n*_onehour;
    else if (unit==='m') p=n*_oneminute;
    else p=_oneday;
    return p;
  }

  function _dateStr(){
    var now = Date.now();
    var cur = new Date( now-now%_retentionGranularityInEpoch );
    var year = cur.getFullYear();
    var month = _twoDigits(cur.getMonth()+1);
    var day = _twoDigits(cur.getDay());
    var rst = ''+year+month+day;
    if (_retentionGranularityInEpoch>=_oneday) return rst;
    else if (_retentionGranularityInEpoch>=_onehour) rst += ('-'+_twoDigits(cur.getHours()));
    else if (_retentionGranularityInEpoch>=_oneminute) rst += ('-'+_twoDigits(cur.getHours())+':'+_twoDigits(cur.getMinutes())); 
    return rst;
  }

  function _timeStr(){
    var cur = new Date();
    var hour = _twoDigits(cur.getHours());
    var minute = _twoDigits(cur.getMinutes());
    var second = _twoDigits(cur.getSeconds());
    return ''+hour+':'+minute+':'+second;
  }

  function _twoDigits(input){
    if (input<10) return '0'+input;
    return ''+input;
  }

  function _mkdirpSync(dir){
    try{ 
      var stats = fs.statSync(dir);
    }catch (err){
      if (err && err.code==='ENOENT')
        fs.mkdirSync(dir);   
      else console.error(err);
    }
  }
}

module.exports = logger;