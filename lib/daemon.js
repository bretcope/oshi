"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var Axon = require('axon');
var ChildProcess = require('child_process');
var Config = require('./config');
var Enums = require('./enums');
var Group = require('./group');
var neoDebug = require('neo-debug');
var Package = require('../package.json');
var Rpc = require('axon-rpc');
var Heartbeat = require('./heartbeat');

//neoDebug.addFilter('oshi:*');
var debug = neoDebug('oshi:daemon');
var debugRpc = neoDebug('oshi:daemon:rpc');

/* -------------------------------------------------------------------
 * Auto-Start Daemon
 * ---------------------------------------------------------------- */

if (!module.parent)
{
	// setup daemon object
	setImmediate(function ()
	{
		new Daemon(new Config.HostConfig());
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
	
	var _eventsSocket;
	
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
		debugRpc('kill');
		callback();
		process.exit();
	};
	
	this.prepare = function (groupConfig, callback)
	{
		debugRpc('prepare');
		try
		{
			var response = { created: false, existed: false, config: null };
			
			groupConfig = new Config.GroupConfig(groupConfig);
			
			if (_groups.hasOwnProperty(groupConfig.name))
			{
				if (/[^A-Za-z0-9_-]/.exec(groupConfig.name))
				{
					callback(new Error('Group names may only contain characters [A-Za-z0-9_-].'));
					return;
				}
				
				response.existed = true;
				response.config = _groups[groupConfig.name].config;
			}
			else
			{
				response.created = true;
				response.config = groupConfig;
				_groups[groupConfig.name] = new Group(groupConfig);
				_groups[groupConfig.name].attach('*', onGroupEvent);
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
		debugRpc('start');
		debugRpc(options);
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
	
	this.status = function (options, callback)
	{
		debugRpc('status');
		debugRpc(options);
		
		var obj;
		var response =
		{
			statusText: 'UNDEFINED',
			statusCode: Enums.STATUS.UNDEFINED
		};
		
		try
		{
			obj = parseChildOptions(options, true);
			
			if (obj.group && obj.group.children.hasOwnProperty(obj.options.port))
			{
				var child = obj.group.children[obj.options.port];
				response.statusCode = child.status;
				response.statusText = Enums.STATUS[child.status];
			}
			
			callback(null, response);
		}
		catch (ex)
		{
			if (typeof callback === 'function')
				callback(ex);
			else
				console.error(ex);
		}
	};
	
	this.stop = function (options, callback)
	{
		debugRpc('stop');
		debugRpc(options);
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
	
	this.version = function (callback)
	{
		debugRpc('version');
		callback(null, Package.version);
	};

	/* -------------------------------------------------------------------
	 * Private Methods << Keep in alphabetical order >>
	 * ---------------------------------------------------------------- */
	
	function onGroupEvent (e, info, data)
	{
		_eventsSocket.send(e.event, info, data);
	}
	
	function parseChildOptions (process, parseOnly)
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
		if (!parseOnly && !_groups.hasOwnProperty(groupName))
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
  _heartbeatSocket = new Heartbeat.Socket(_config.heartbeatPort);
	
	_rpcServer.expose(this);
	
	// setup Events Server
	_eventsSocket = Axon.socket('pub');
	_eventsSocket.bind(_config.eventsPort, _config.eventsHost);
	
	_eventsSocket.on('connect', function ()
	{
		// respond to the client connect event so the API can verify it is talking to the correct Daemon
		_eventsSocket.send('oshi', _config, Package.version);
	});
}

/* -------------------------------------------------------------------
 * Static Methods << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

Daemon.connect = function (clientConfig, callback)
{
	var done = false;
	var eventsSock = null;
	var rpcSock = Axon.socket('req');
	rpcSock.once('socket error', errorHandler);
	rpcSock.connect(clientConfig.rpcPort, clientConfig.rpcHost);
	
	rpcSock.once('connect', function ()
	{
		// rpc connected successfully, now let's connect to the events server
		eventsSock = Axon.socket('sub');
		eventsSock.once('socket error', errorHandler);
		eventsSock.on('message', messageHandler);
		eventsSock.connect(clientConfig.eventsPort, clientConfig.eventsHost);
		
		function messageHandler (event, config, version)
		{
			if (event === 'oshi')
			{
				eventsSock.removeListener('message', messageHandler);
				if (!done)
				{
					done = true;
					callback(null, rpcSock, eventsSock);
				}
			}
		}

		// set a timeout in case the connect message never occurs 
		setTimeout(function ()
		{
			if (!done)
				errorHandler(new Error('Events socket timed out. ' + clientConfig.eventsHost +':'+ clientConfig.eventsPort));
			
		}, clientConfig.connectTimeout);
	});
	
	
	function errorHandler (error)
	{
		if (done)
			return;
		
		done = true;
		
		try
		{
			rpcSock.close();
		}
		finally
		{
			rpcSock = null;
		}
		
		try
		{
			if (eventsSock)
				eventsSock.close();
		}
		finally
		{
			eventsSock = null;
		}
		
		callback(error, rpcSock, eventsSock);
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

	function invokeCallback (error, rpcSock, eventsSock)
	{
		if (!callback)
			return;

		daemonProc.removeListener('error', invokeCallback);
		daemonProc.removeListener('exit', exitHandler);

		callback(error, rpcSock, eventsSock);
	}
};
