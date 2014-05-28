"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var ChildProcess = require('child_process');
var FlexEvents = require('flex-events');

/* =============================================================================
 * 
 * Oshi.Child Class
 *  
 * ========================================================================== */

module.exports = Child;

function Child (port, group)
{
	/* -------------------------------------------------------------------
	 * Private Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */
	
	var _this = this;

	var _events = FlexEvents.setup(this, group);
	var _process = null;
	
	/* -------------------------------------------------------------------
	 * Public Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */
 	
	this.group = group;
	this.groupName = group.config.name;
	this.port = port;
	this.options = null;
	this.status = Child.STOPPED;
	this.errors = [];
	this.crashCount = 0;
	this.timeline = [];
	
	Object.defineProperties(this,
	{
		info:
		{
			get: function ()
			{
				return {
					group: _this.groupName,
					port: _this.port,
					handled: false
				};
			}
		},
		process:
		{
			get: function () { return _process; },
			set: function (proc)
			{
				if (_process)
				{
					_process.removeListener('error', _this.onError);
					_process.removeListener('exit', _this.onExit);
					_process.removeListener('message', _this.onMessage);
				}

				_process = proc;

				if (_process)
				{
					_process.on('error', _this.onError);
					_process.on('exit', _this.onExit);
					_process.on('message', _this.onMessage);
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
			
			_this.status = Child.ERROR;
			_this.process = null;
		}
		catch (ex)
		{
			//TODO ?
			console.error(ex);
		}
	};

	this.onExit = function (code, signal)
	{
		try
		{
			var data =
			{
				code: code,
				signal: signal,
				expected: this.status === Child.STOPPING
			};
			
			var info = _this.info;
			_this.invoke('exit', info, data);
			_this.process = null;
			_this.status = Child.STOPPED;

			if (!data.expected)
				this.crashCount++;
			
			if (!info.handled)
			{
				// exit event wasn't handled by another listener, so just try to restart
				_this.start(_this.options, function (error, response)
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
 * Constants
 * ---------------------------------------------------------------- */

Child.STARTING = 1;
Child.RUNNING = 2;
Child.STOPPING = 3;
Child.STOPPED = 4;
Child.ERROR = 5;

/* -------------------------------------------------------------------
 * Public Prototype Members Declaration << no methods >>
 * ---------------------------------------------------------------- */

Object.defineProperty(Child.prototype, 'running',
{
	get: function () { return this.process ? this.process.connected : false; }
});

/* -------------------------------------------------------------------
 * Public Prototype Methods << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

Child.prototype.start = function (options, callback, stopResponse)
{
	this.options = options;
	var conf = this.group.config;
	
	var _this = this;
	var response = 
	{
		restarted: false,
		started: false,
		forceRestarted: false,
		ready: false,
		crashed: false,
		port: options.port,
		group: this.groupName
	};
	
	if (stopResponse)
	{
		response.restarted = true; // should this actually be stopResponse.stopped?
		response.forceRestarted = stopResponse.forced;
	}
	
	// first check to see if this is already running
	if (this.running)
	{
		if (options.ifNotRunning)
		{
			callback(null, response);
			return;
		}
		
		if (!options.restart)
		{
			callback(new Error('Process is already running.'));
			return;
		}
		
		// need to stop the process first
		this.stop(options, function (error, res)
		{
			if (error)
			{
				callback(error);
				return;
			}
			
			try
			{
				_this.start(options, callback, res);
			}
			catch (ex)
			{
				callback(ex);
			}
		});
		
		return;
	}
	
	var args = conf.nodeArgs.concat(conf.script, conf.args);
	if (options.debug && conf.nodeArgs.indexOf('--debug') === -1)
		args.unshift('--debug');

	var pOptions =
	{
		cwd: conf.cwd,
		env: conf.env,
		stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ]
	};

	this.status = Child.STARTING;
	this.process = ChildProcess.spawn(conf.nodeExec, args, pOptions);
	
	this.attach('error', startError);
	this.attach('exit', startExit);
	this.attach('ready', startReady);
	
	setTimeout(startTimeout, conf.initTimeout);
	
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

Child.prototype.stop = function (options, callback)
{
	var _this = this;
	var conf = this.group.config;
	var response = 
	{
		stopped: false,
		forced: false,
		port: options.port,
		group: this.groupName
	};
	
	if (!this.running)
	{
		console.log('already stopped');
		setImmediate(callback, null, response);
		return;
	}
	
	// setup exit listener
	this.attach('exit', exitListener);
	
	// save a reference to the current process, since this.process could change before the graceful timeout
	var origProc = this.process;
	this.status = Child.STOPPING;
	
	//try to signal the process to gracefully stop
	if (process.platform === 'win32' && conf.useMessageOnWindows)
	{
		// special mode since Windows doesn't support signals
		this.process.send(conf.gracefulSignal);
	}
	else
	{
		this.process.kill(conf.gracefulSignal);
	}
	
	//give the process time to gracefully terminate
	setTimeout(forceKill, conf.gracefulTimeout);
	
	function exitListener (e, info, data)
	{
		try
		{
			_this.detach('exit', exitListener);
			info.handled = true;
			response.stopped = true;
			callback(null, response);
			callback = null;
		}
		catch (ex)
		{
			//TODO ?
			console.error(ex);
		}
	}
	
	function forceKill ()
	{
		try
		{
			if (!origProc.connected) // process terminated, we don't need to force kill it
				return;

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
