"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var Axon = require('axon');
var ChildConfig = require('./config/ChildConfig');
var ChildProcess = require('child_process');
var DaemonConfig = require('./config/DaemonConfig');
var Enums = require('./enums');
var Group = require('./group');
var GroupConfig = require('./config/GroupConfig');
var Debug = require('debug');
var Package = require('../package.json');
var Rpc = require('axon-rpc');

//neoDebug.addFilter('oshi:*');
var debug = Debug('oshi:daemon');
var debugRpc = Debug('oshi:daemon:rpc');

/* -------------------------------------------------------------------
 * Auto-Start Daemon
 * ---------------------------------------------------------------- */

if (!module.parent)
{
	// setup daemon object
	setImmediate(function ()
	{
		new Daemon(new DaemonConfig());
	});
}

/* =============================================================================
 * 
 * Oshi.Daemon
 * 
 * ========================================================================== */

module.exports = Daemon;

/**
 * 
 * @param daemonConfig {DaemonConfig}
 * @constructor
 */
function Daemon (daemonConfig)
{
	/* -------------------------------------------------------------------
	 * Private Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */
	var _this = this;

	var _config = daemonConfig;
	
	var _rpcSocket;
	var _rpcServer;
	
	var _eventsSocket;
	
	/** @type {object<string,Group>} */
	var _groups = {};
	
	var _groupEventHandlers = {
		broadcast: onGroupBroadcast
	};	
	
	/* -------------------------------------------------------------------
	 * Public Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */
	
	/** @member {DaemonConfig} */
	this.config = _config;
	
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

	/**
	 * @param callback {function}
	 */
	this.kill = function (callback)
	{
		debugRpc('kill');
		callback();
		setImmediate(function()
		{
			process.exit();
		});
	};

	/**
	 * @param groupConfig {GroupConfig}
	 * @param callback {function(Error, PrepareResponse)}
	 */
	this.prepare = function (groupConfig, callback)
	{
		debugRpc('prepare');
		try
		{
			var response = new PrepareResponse();
			
			groupConfig = new GroupConfig(groupConfig);
			
			if (_groups.hasOwnProperty(groupConfig.name))
			{
				if (/[^A-Za-z0-9_-]/.exec(groupConfig.name))
				{
					callback(new Error('Group names may only contain characters [A-Za-z0-9_-].'), null);
					return;
				}
				
				response.existed = true;
				response.config = _groups[groupConfig.name].config;
			}
			else
			{
				response.created = true;
				response.config = groupConfig;
				_groups[groupConfig.name] = new Group(_this, groupConfig);
				_groups[groupConfig.name].attach('*', onGroupGenericEvent);
				
				for (var eventName in _groupEventHandlers)
					_groups[groupConfig.name].attach(eventName, _groupEventHandlers[eventName]);
					
			}
			
			callback(null, response);
		}
		catch (ex)
		{
			if (typeof callback === 'function')
				callback(ex, null);
			else
				console.error(ex);
		}
	};
	
	/**
	 * @param options {ChildConfig|string}
	 * @param callback {function(Error, StartResponse)}
	 */
	this.start = function (options, callback)
	{
		debugRpc('start');
		debugRpc(options);
		try
		{
			var conf = new ChildConfig(options);
			var group = _groups[conf.groupName];
			if (!(group instanceof Group))
				throw new Error('No group exists by the name of ' + conf.groupName);
			
			group.start(conf, callback);
		}
		catch (ex)
		{
			if (typeof callback === 'function')
				callback(ex, null);
			else
				console.error(ex);
		}
	};

	/**
	 * @param options {ChildConfig|string}
	 * @param callback {function(Error, StatusResponse)}
	 */
	this.status = function (options, callback)
	{
		debugRpc('status');
		debugRpc(options);
		
		var response = new StatusResponse();
		
		try
		{
			var conf = new ChildConfig(options);
			var group = _groups[conf.groupName];
			
			if (group instanceof Group && group.children.hasOwnProperty(conf.port))
			{
				/** @type {Child} */
				var child = group.children[conf.port];
				response.statusCode = child.status;
				response.statusText = Enums.STATUS[child.status];
			}
			
			callback(null, response);
		}
		catch (ex)
		{
			if (typeof callback === 'function')
				callback(ex, null);
			else
				console.error(ex);
		}
	};

	/**
	 * @param callback {function(Error, ListResponse)}
	 */
	this.list = function (callback)
	{
		debugRpc('list');

		var response = new ListResponse();

		try
		{
			for(var name in _groups)
			{
				var group = response.groups[name] = [];
				for (var port in _groups[name].children)
				{
					group.push(port);
				}
			}

			callback(null, response);
		}
		catch (ex)
		{
			if (typeof callback === 'function')
				callback(ex, null);
			else
				console.error(ex);
		}
	};

	/**
	 * @param options {ChildConfig|string}
	 * @param callback {function(Error, StopResponse)}
	 */
	this.stop = function (options, callback)
	{
		debugRpc('stop');
		debugRpc(options);
		try
		{
			var conf = new ChildConfig(options);
			var group = _groups[conf.groupName];
			if (!(group instanceof Group))
				throw new Error('No group exists by the name of ' + conf.groupName);

			group.stop(conf, callback);
		}
		catch (ex)
		{
			if (typeof callback === 'function')
				callback(ex, null);
			else
				console.error(ex);
		}
	};
	
	/**
	 * @param callback {function(Error)}
	 */
	this.version = function (callback)
	{
		debugRpc('version');
		callback(null, Package.version);
	};

	/**
	 * @param options {ChildConfig|string}
	 * @param callback {function (Error)}
	 */
	this.rotateLogs = function (options, callback)
	{
		debugRpc('rotateLogs');
		debugRpc(options);
		try
		{
			var conf = new ChildConfig(options);
			var group = _groups[conf.groupName];
			if (!(group instanceof Group))
				throw new Error('No group exists by the name of ' + conf.groupName);

			group.rotateLogs(conf, callback);
		}
		catch (ex)
		{
			if (typeof callback === 'function')
				callback (ex);
			else
				console.error(ex);
		}
	};

	/* -------------------------------------------------------------------
	 * Private Methods << Keep in alphabetical order >>
	 * ---------------------------------------------------------------- */
	
	function onGroupGenericEvent (e, info, data)
	{
		if (!_groupEventHandlers.hasOwnProperty(e.event)) 
			_eventsSocket.send(e.event, info, data);
	}
 
	function onGroupBroadcast (e, info, data)
	{
		var broadcastToSelf = !!data.broadcastToSelf;		
		
		var message = { 
			type: 'broadcast', 
			event: data.event,
			data: data.data,
			source: {
				child: e.origin.shortName,
				group: e.origin.config.groupName,
				port: e.origin.config.port
			}
		};

		for (var j in _groups)
			_groups[j].broadcast(message, e.origin, broadcastToSelf);

	}
 
	/* -------------------------------------------------------------------
	 * Initialization
	 * ---------------------------------------------------------------- */
	
	// setup RPC
	_rpcSocket = Axon.socket('rep');
	_rpcServer = new Rpc.Server(_rpcSocket);
	_rpcSocket.bind(_config.rpcPort, _config.rpcHost);
	
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

/**
 * @param apiConfig {ApiConfig}
 * @param callback {function(Error, Socket, Socket)}
 */
Daemon.connect = function (apiConfig, callback)
{
	var done = false;
	var eventsSock = null;
	var rpcSock = Axon.socket('req');
	rpcSock.once('socket error', errorHandler);
	rpcSock.connect(apiConfig.rpcPort, apiConfig.rpcHost);
	
	rpcSock.once('connect', function ()
	{
		// rpc connected successfully, now let's connect to the events server
		eventsSock = Axon.socket('sub');
		eventsSock.once('socket error', errorHandler);
		eventsSock.on('message', messageHandler);
		eventsSock.connect(apiConfig.eventsPort, apiConfig.eventsHost);
		
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
				errorHandler(new Error('Events socket timed out. ' + apiConfig.eventsHost +':'+ apiConfig.eventsPort));
			
		}, apiConfig.connectTimeout);
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

/**
 * @param daemonConfig {DaemonConfig}
 * @param apiConfig {ApiConfig}
 * @param callback {function(Error, Socket, Socket)}
 */
Daemon.start = function (daemonConfig, apiConfig, callback)
{
	if (typeof callback !== 'function')
		callback = console.log;

	var args = daemonConfig.nodeArgs.concat(__filename);
	var options = { detached: true, stdio: 'ignore', cwd: daemonConfig.cwd, env: daemonConfig.toEnv() };
	var daemonProc = ChildProcess.spawn(daemonConfig.nodeExec, args, options);
	daemonProc.on('error', invokeCallback);
	daemonProc.on('exit', exitHandler);
	daemonProc.unref();

	// try to connect to daemon after starting
	setTimeout(Daemon.connect.bind(null, apiConfig, invokeCallback), daemonConfig.initTimeout);

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

/* =============================================================================
 * 
 * PrepareResponse Class
 * 
 * ========================================================================== */

function PrepareResponse ()
{
	/** @member {boolean} True if a new group was created. */
	this.created = false;
	/** @member {boolean} True if a group by the same name already existed. */
	this.existed = false;
	/** @member {GroupConfig} The group config object. */
	this.config = null;
}

/* =============================================================================
 * 
 * StatusResponse Class
 * 
 * ========================================================================== */

function StatusResponse ()
{
	/** @member {string} */
	this.statusText = 'UNDEFINED';
	/** @member {number} */
	this.statusCode = Enums.STATUS.UNDEFINED;
}

/* =============================================================================
 * 
 * ListResponse Class
 * 
 * ========================================================================== */

function ListResponse ()
{
	/** @member {Object} */
	this.groups = {};
}


