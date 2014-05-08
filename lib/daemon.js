"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var Axon = require('axon');
var ChildProcess = require('child_process');
var Config = require('./config');
var Group = require('./group');
var Rpc = require('axon-rpc');

/* -------------------------------------------------------------------
 * Auto-Start Daemon
 * ---------------------------------------------------------------- */

if (!module.parent)
{
	// setup daemon object
	setImmediate(function ()
	{
		new Daemon(new Config.HostConfig());
		
		// create an infinite async loop to keep the daemon alive when not connected to anything
		setInterval(function () {}, 86400000);
	});
}

/* =============================================================================
 * 
 * Oshi.Daemon
 * 
 * ========================================================================== */

module.exports = Daemon;

function Daemon (hostConfig)
{
	/* -------------------------------------------------------------------
	 * Private Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */

	var _config = hostConfig;
	
	var _rpcSocket;
	var _rpcServer;
	
	var _groups = {};

	/* -------------------------------------------------------------------
	 * Public Methods << Keep in alphabetical order >>
	 * ---------------------------------------------------------------- */
	
//	this.configGet = function (callback)
//	{
//		callback(null, _config);
//	};
//	
//	this.configSet = function (config, callback)
//	{
//		//
//	};
	
//	this.cleanup = function (options, callback)
//	{
//		//
//	};

	this.kill = function (callback)
	{
		callback();
		process.exit();
	};
	
	this.prepare = function (groupConfig, callback)
	{
		try
		{
			var response = { created: false, existed: false, config: null };
			
			groupConfig = new Config.GroupConfig(groupConfig);
			
			if (_groups.hasOwnProperty(groupConfig.name))
			{
				response.existed = true;
				response.config = _groups[groupConfig.name].config;
			}
			else
			{
				response.created = true;
				response.config = groupConfig;
				_groups[groupConfig.name] = new Group(groupConfig);
			}
			
			callback(null, response);
		}
		catch (ex)
		{
			callback(ex);
		}
	};
	
//	this.rotateLogs = function ()
//	{
//		//
//	};
	
	this.start = function (options, callback)
	{
		try
		{
			var obj = parseChildOptions(options);
			obj.group.start(obj.options, callback);
		}
		catch (ex)
		{
			if (typeof callback === 'function')
				callback(ex);
			else
				console.error(ex);
		}
	};
	
//	this.status = function (callback)
//	{
//		callback(null, { env: process.env });
//	};
	
	this.stop = function (options, callback)
	{
		try
		{
			var obj = parseChildOptions(options);
			obj.group.stop(obj.options, callback);
		}
		catch (ex)
		{
			if (typeof callback === 'function')
				callback(ex);
			else
				console.error(ex);
		}
	};
	
//	this.version = function ()
//	{
//		//
//	};

	/* -------------------------------------------------------------------
	 * Private Methods << Keep in alphabetical order >>
	 * ---------------------------------------------------------------- */
	
	function parseChildOptions (process)
	{
		var options = {};
		
		var groupName;
		if (typeof process === 'string')
		{
			var match = /^([^:]+):(\d+)$/.exec(process);
			if (match)
			{
				groupName = match[1];
				options.port = Number(match[2]);
			}
		}
		else if (process && typeof process === 'object')
		{
			groupName = process.group;
			options = process;
		}

		if (!groupName || typeof groupName !== 'string' || !options.port || typeof options.port !== 'number')
		{
			throw new TypeError('Incorrect process format.');
		}

		// find the group
		if (!_groups.hasOwnProperty(groupName))
		{
			throw new Error('No group exists by the name of ' + groupName);
		}

		var group = _groups[groupName];
		return { group: group, options: options };
	}
 
	/* -------------------------------------------------------------------
	 * Initialization
	 * ---------------------------------------------------------------- */
	
	// setup RPC
	_rpcSocket = Axon.socket('rep');
	_rpcServer = new Rpc.Server(_rpcSocket);
	_rpcSocket.bind(_config.rpcPort, _config.rpcHost);
	
	_rpcServer.expose(this);
}

/* -------------------------------------------------------------------
 * Static Methods << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

Daemon.connect = function (clientConfig, callback)
{
	var done = false;
	var sock = Axon.socket('req');
	sock.once('socket error', handler);
	sock.once('connect', handler);
	sock.connect(clientConfig.rpcPort, clientConfig.rpcHost);

	function handler (error)
	{
		if (done)
			return;

		done = true;

		if (error)
		{
			sock.close();
			sock = null;
		}

		callback(error, sock);
	}
};

Daemon.start = function (hostConfig, clientConfig, callback)
{
	if (typeof callback !== 'function')
		callback = console.log;

	var args = hostConfig.nodeArgs.concat(__filename);
	var options = { detached: true, stdio: 'ignore', cwd: hostConfig.cwd, env: hostConfig.toEnv() };
	var daemonProc = ChildProcess.spawn(hostConfig.nodeExec, args, options);
	daemonProc.on('error', invokeCallback);
	daemonProc.on('exit', exitHandler);

	// try to connect to daemon after starting
	setTimeout(Daemon.connect.bind(null, clientConfig, invokeCallback), hostConfig.initTimeout);

	function exitHandler (code)
	{
		invokeCallback(new Error('The Daemon exited unexpectedly with code ' + code));
	}

	function invokeCallback (error, sock)
	{
		if (!callback)
			return;

		daemonProc.removeListener('error', invokeCallback);
		daemonProc.removeListener('exit', exitHandler);

		callback(error, sock);
	}
};
