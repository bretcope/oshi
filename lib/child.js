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
	this.port = port;
	this.options = null;
	this.status = Child.STOPPED;
	this.errors = [];
	this.crashCount = 0;
	this.timeline = [];
	
	Object.defineProperty(this, 'process',
	{
		get: function () { return _process; },
		set: function (proc)
		{
			if (_process)
			{
				_process.removeListener('error', this.onError);
				_process.removeListener('exit', this.onExit);
				_process.removeListener('message', this.onMessage);
			}

			_process = proc;
			
			if (_process)
			{
				_process.on('error', this.onError);
				_process.on('exit', this.onExit);
				_process.on('message', this.onMessage);
			}
		}
	});

	/* -------------------------------------------------------------------
	 * Public Methods << Keep in alphabetical order >>
	 * ---------------------------------------------------------------- */

	this.destroy = function ()
	{
		if (this.running)
			throw new Error('Cannot destroy. Process is still running '+ this.group.config.name +':'+ this.port);
		
		_events.destroy();
		return true;
	};
	
	this.onError = function (error)
	{
		try
		{
			var data =
			{
				error: error,
				handled: false
			};

			_this.errors.push(error); // TODO: limit the number of errors to keep
			_this.invoke('error', data);
			
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
				expected: this.status === Child.STOPPING,
				handled: false
			};

			_this.invoke('exit', data);
			_this.process = null;
			_this.status = Child.STOPPED;

			if (!data.expected)
				this.crashCount++;
			
			if (!data.handled)
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
				_this.invoke('ready');
			}
			else
			{
				_this.invoke('message', data);
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
		group: this.group.config.name
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
	
	function startError (e, data)
	{
		if (callback)
		{
			data.handled = true;
			done(data.error);
		}
	}
	
	function startExit (e, data)
	{
		if (callback)
		{
			data.handled = true;
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
		group: this.group.config.name
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
	
	function exitListener (e, data)
	{
		try
		{
			_this.detach('exit', exitListener);
			data.handled = true;
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
