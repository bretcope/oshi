"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var ChildProcess = require('child_process');
var debug = require('debug')('oshi:child');
var Enums = require('./enums');
var Fs = require('fs');
var Path = require('path');
var FlexEvents = require('flex-events');
var mkdirp = require('mkdirp');

var STATUS = Enums.STATUS;

/* =============================================================================
 * 
 * Oshi.Child Class
 *  
 * ========================================================================== */

module.exports = Child;

/**
 * @constructor
 * @param group {Group}
 * @param config {ChildConfig}
 */
function Child (group, config)
{
	/* -------------------------------------------------------------------
	 * Private Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */
	
	var _this = this;

	var _events = FlexEvents.setup(this, group);
	/** @type {ChildProcess} */
	var _process = null;
	/** @type {Object.<string, fs.WriteStream>} */
	var _logStreams = {};
	
	/* -------------------------------------------------------------------
	 * Public Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */

	/** @member {Group} */
	this.group = group;
	/** @member {string} */
	this.groupName = config.groupName;
	/** @member {number} */
	this.port = config.port;
	/** @member {string} */
	this.shortName = this.groupName + ':' + this.port;
	/** @member {ChildConfig} */
	this.config = config;
	this.status = STATUS.STOPPED;
	this.errors = [];
	this.crashCount = 0;
	this.timeline = [];
	
	Object.defineProperty(this, 'info',
	{
		/** @returns {{group: string, port: number, handled: boolean}} */
		get: function ()
		{
			return {
				group: _this.groupName,
				port: _this.port,
				handled: false
			};
		}
	});
	
	Object.defineProperty(this, 'process',
	{
		/** @returns {ChildProcess} */
		get: function () { return _process; },
		/** @param proc {ChildProcess} */
		set: function (proc)
		{
			if (_process)
			{
				_process.removeListener('error', _this.onError);
				_process.removeListener('exit', _this.onExit);
				_process.removeListener('message', _this.onMessage);
				
				try
				{
					_process.stdout.unpipe();
					_process.stderr.unpipe();
				}
				catch (ex)
				{
					// don't really care if unpipe throws an exception... though I don't think it ever should
					console.error(ex);
				}
			}

			_process = proc;

			if (_process)
			{
				_process.on('error', _this.onError);
				_process.on('exit', _this.onExit);
				_process.on('message', _this.onMessage);
				
				// setup log files
				// TODO: Make these rotatable
				var logDir = _this.group.daemon.config.logDir;
				if (logDir)
				{
					//TODO: make this not hardcoded
					var outputs = {
						err: _process.stderr,
						out: _process.stdout
					};

					/** @type {stream.Readable[]} */
					var readStreams;
					/** @type {fs.WriteStream} */
					var ws;
					var filePath;
					for (var name in outputs)
					{
						readStreams = outputs[name];
						if (!(readStreams instanceof Array))
						{
							outputs[name] = readStreams = readStreams ? [ readStreams ] : [];
						}
						
						if (readStreams.length === 0)
							continue;
						
						ws = _logStreams[name];
						if (!(ws instanceof Fs.WriteStream))
						{
							mkdirp(logDir);
							filePath = Path.resolve(logDir, _this.groupName + '_' + _this.port + '.' + name + '.log');
							ws = Fs.createWriteStream(filePath, { flags: 'a' });
							_logStreams[name] = ws;
						}
						
						for (var i = 0; i < readStreams.length; i++)
						{
							readStreams[i].pipe(ws);
						}
					}
				}
			}
		}
	});
	
	/* -------------------------------------------------------------------
	 * Public Methods << Keep in alphabetical order >>
	 * ---------------------------------------------------------------- */

	this.destroy = function ()
	{
		if (this.running)
			throw new Error('Cannot destroy. Process is still running '+ this.groupName +':'+ this.port);
		
		_events.destroy();
		return true;
	};

	/**
	 * @param error {Error}
	 */
	this.onError = function (error)
	{
		try
		{
			var data =
			{
				error: error
			};

			_this.errors.push(error); // TODO: limit the number of errors to keep
			_this.invoke('error', _this.info, data);
			
			_this.status = STATUS.ERROR;
			_this.process = null;
		}
		catch (ex)
		{
			//TODO ?
			console.error(ex);
		}
	};

	/**
	 * @param code {number}
	 * @param signal {string}
	 */
	this.onExit = function (code, signal)
	{
		try
		{
			debug(_this.shortName + ' exited');
			
			var data =
			{
				code: code,
				signal: signal,
				expected: _this.status === STATUS.STOPPING
			};
			
			var info = _this.info;
			_this.invoke('exit', info, data);
			_this.process = null;
			_this.status = STATUS.STOPPED;

			if (!data.expected)
			{
				_this.crashCount++;
				debug(_this.shortName + ' exit was unexpected');
			}
			
			if (!info.handled)
			{
				debug(_this.shortName + 'attempting to restart');
				// exit event wasn't handled by another listener, so just try to restart
				_this.start(null, function (error, response)
				{
					if (error)
					{
						//TODO ?
						console.error(error);
					}
				});
			}

		}
		catch (ex)
		{
			//TODO ?
			console.error(ex);
		}
	};

	/**
	 * @param data {*}
	 */
	this.onMessage = function (data)
	{
		try
		{
			if (data && typeof data === 'string' && data === _this.group.config.readyEvent)
			{
				_this.invoke('ready', _this.info);
			}
			else
			{
				_this.invoke('message', _this.info, data);
			}
		}
		catch (ex)
		{
			//TODO ?
			console.error(ex);
		}
	};
}

/* -------------------------------------------------------------------
 * Public Prototype Members Declaration << no methods >>
 * ---------------------------------------------------------------- */

Object.defineProperty(Child.prototype, 'running',
{
	/** @returns {boolean} */
	get: function () { return this.process ? (this.process.connected && this.status < STATUS.STOPPED) : false; }
});

/* -------------------------------------------------------------------
 * Public Prototype Methods << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

/**
 * @function
 * @param newConfig {ChildConfig}
 * @param callback {function(Error, StartResponse)}
 * @param [stopResponse] {StopResponse}
 */
Child.prototype.start = function (newConfig, callback, stopResponse)
{
	if (newConfig)
		this.config.update(newConfig);
	
	var childConf = this.config;
	var groupConf = this.group.config;
	var daemonConf = this.group.daemon.config;

	var _this = this;
	var response = new StartResponse(childConf);
	
	if (stopResponse)
	{
		response.restarted = true; // should this actually be stopResponse.stopped?
		response.forceRestarted = stopResponse.forced;
	}
	
	// first check to see if this is already running
	if (this.running)
	{
		if (childConf.ifNotRunning)
		{
			callback(null, response);
			return;
		}
		
		if (!childConf.restart)
		{
			callback(new Error('Process is already running.'), null);
			return;
		}
		
		// need to stop the process first
		this.stop(null, function (error, res)
		{
			if (error)
			{
				callback(error, null);
				return;
			}
			
			try
			{
				_this.start(null, callback, res);
			}
			catch (ex)
			{
				callback(ex, null);
			}
		});
		
		return;
	}
	
	var args = groupConf.nodeArgs.concat(groupConf.script, groupConf.args);
	if (childConf.debug && groupConf.nodeArgs.indexOf('--debug') === -1)
		args.unshift('--debug');
	
	if (childConf.args instanceof Array)
		args = args.concat(childConf.args);

	var pOptions =
	{
		cwd: groupConf.cwd,
		env: groupConf.env,
		stdio: [ 'ignore', 'pipe', 'pipe', 'ipc' ]
	};

	this.status = STATUS.STARTING;
	this.process = ChildProcess.spawn(groupConf.nodeExec, args, pOptions);
	
	this.attach('error', startError);
	this.attach('exit', startExit);
	this.attach('ready', startReady);

	setTimeout(startTimeout, groupConf.initTimeout);
	
	function startError (e, info, data)
	{
		if (callback)
		{
			info.handled = true;
			done(data.error);
		}
	}
	
	function startExit (e, info, data)
	{
		if (callback)
		{
			info.handled = true;
			response.crashed = true;
			done();
		}
	}
	
	function startReady (e)
	{
		if (callback)
		{
			response.started = true;
			response.ready = true;
			done();
		}
	}
	
	function startTimeout ()
	{
		if (callback)
		{
			response.started = true;
			done();
		}
	}
	
	function done (error)
	{
		try
		{
			_this.detach('error', startError);
			_this.detach('exit', startExit);
			_this.detach('ready', startReady);
			
			_this.status = error ? STATUS.ERROR : STATUS.RUNNING;

			callback(error, response);
			callback = null;
		}
		catch (ex)
		{
			//TODO ?
			console.error(ex);
		}
	}
};

/**
 * @param newConfig {ChildConfig}
 * @param callback {function(Error, StopResponse)}
 */
Child.prototype.stop = function (newConfig, callback)
{
	if (newConfig)
		this.config.update(newConfig);
	
	var _this = this;
	var groupConf = this.group.config;
	var response = new StopResponse(this.config);
	
	if (!this.running)
	{
		debug(this.shortName + ' already stopped');
		setImmediate(callback, null, response);
		return;
	}
	
	// setup exit listener
	this.attach('exit', exitListener);
	
	// save a reference to the current process, since this.process could change before the graceful timeout
	var origProc = this.process;
	this.status = STATUS.STOPPING;
	
	//try to signal the process to gracefully stop
	if (process.platform === 'win32' && groupConf.useMessageOnWindows)
	{
		// special mode since Windows doesn't support signals
		debug('Using Windows graceful shutdown mode');
		this.process.send(groupConf.gracefulSignal);
	}
	else
	{
		this.process.kill(groupConf.gracefulSignal);
	}
	
	//give the process time to gracefully terminate
	debug(this.shortName + ' attempting graceful termination. Timeout ' + groupConf.gracefulTimeout);
	var interval = setInterval(killCheck, 50);
	var killAfter = Date.now() + groupConf.gracefulTimeout;
	
	function exitListener (e, info, data)
	{
		try
		{
			_this.detach('exit', exitListener);
			info.handled = true;
			response.stopped = true;
			if (callback)
				callback(null, response);
			callback = null;
		}
		catch (ex)
		{
			//TODO ?
			console.error(ex);
		}
	}
	
	function killCheck ()
	{
		try
		{
			if (!origProc.connected && _this.status >= STATUS.STOPPED) // process terminated, we don't need to force kill it
			{
				clearInterval(interval);
				
				if (callback)
				{
					callback(null, response);
					callback = null;
				}
				
				return;
			}
			
			if (Date.now() < killAfter)
				return;
			
			clearInterval(interval);
			
			debug(_this.shortName + ' attempting to force-kill');

			response.forced = true;
			origProc.kill('SIGKILL');
		}
		catch (ex)
		{
			if (typeof callback === 'function')
				callback(ex);
		}
	}
};

/* =============================================================================
 * 
 * StartResponse Class
 *  
 * ========================================================================== */

/**
 * @param conf {ChildConfig}
 * @constructor
 */
function StartResponse (conf)
{
	this.restarted = false;
	this.started = false;
	this.forceRestarted = false;
	this.ready = false;
	this.crashed = false;
	this.config = conf;
}

/* =============================================================================
 * 
 * StopResponse Class
 *  
 * ========================================================================== */

/**
 * @param conf {ChildConfig}
 * @constructor
 */
function StopResponse (conf)
{
	this.stopped = false;
	this.forced = false;
	this.config = conf;
}
