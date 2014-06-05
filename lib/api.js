"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var ApiConfig = require('./config/ApiConfig');
var Daemon = require('./daemon');
var DaemonConfig = require('./config/DaemonConfig');
var Dns = require('dns');
var GroupConfig = require('./config/GroupConfig');
var Rpc = require('axon-rpc');

/* =============================================================================
 * 
 * Oshi.Api
 *  
 * ========================================================================== */

module.exports = Api;

/**
 * 
 * @param apiConfig {ApiConfig}
 * @param rpcSock {Socket}
 * @param eventsSock {Socket}
 * @constructor
 */
function Api (apiConfig, rpcSock, eventsSock)
{
	/* -------------------------------------------------------------------
	 * Private Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */
	
	var _this = this;
	
	var _client = new Rpc.Client(rpcSock);
	var _eventHandlers = [];
	
	/* -------------------------------------------------------------------
	 * Public Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */
	
	this.rpcSocket = rpcSock;
	
	/* -------------------------------------------------------------------
	 * Public Methods << Keep in alphabetical order >>
	 * ---------------------------------------------------------------- */
	
	this.call = _client.call.bind(_client);
	
	this.disconnect = function ()
	{
		rpcSock.close();
		eventsSock.close();
	};
	
	this.kill = function (callback)
	{
		_client.call('kill', callback);
	};
	
	this.on = function (event, options, handler)
	{
		if (typeof options === 'function')
		{
			handler = options;
			options = null;
		}
		
		_eventHandlers.push(new EventHandler(event, options, handler));
	};
	
	this.prepare = function (groupConfig, callback)
	{
		var conf = groupConfig;
		if (!(conf instanceof GroupConfig))
			conf = new GroupConfig(groupConfig);
		
		_client.call('prepare', conf, callback);
	};

	this.removeListener = function (event, options, handler)
	{
		if (typeof options === 'function')
		{
			handler = options;
			options = null;
		}
		
		if (typeof event === 'function')
		{
			handler = event;
			event = null;
			options = null;
		}
		
		var matchHandler = true;
		if (typeof handler !== 'function')
		{
			handler = function () {};
			matchHandler = false;
		}
		
		var a = new EventHandler(event || '', options, handler);
		var b;
		var removed = [];
		for (var i = _eventHandlers.length - 1; i > -1; i--)
		{
			b = _eventHandlers[i];
			if ((!matchHandler || a.handler === b.handler) && (!event || a.matches(b)))
			{
				removed.push(_eventHandlers.splice(i, 1));
			}
		}

		return removed;
	};

	this.start = function (options, callback)
	{
		_client.call('start', options, callback);
	};
	
	this.status = function (options, callback)
	{
		_client.call('status', options, callback);
	};

	this.stop = function (options, callback)
	{
		_client.call('stop', options, callback);
	};
	
	this.version = function (callback)
	{
		_client.call('version', callback);
	};
	
	/* -------------------------------------------------------------------
	 * Private Methods << Keep in alphabetical order >>
	 * ---------------------------------------------------------------- */
	
	function onMessage (event, info, data)
	{
		if (event === 'oshi' || !info || typeof info !== 'object')
			return;
		
		info.event = event;
		
		// find the matching handlers
		for (var i = 0; i < _eventHandlers.length; i++)
		{
			if (_eventHandlers[i].matches(info))
			{
				_eventHandlers[i].handler(info, data);
			}
		}
	}
	
	/* -------------------------------------------------------------------
	 * Initialization
	 * ---------------------------------------------------------------- */
	
	eventsSock.on('message', onMessage);
}

/* -------------------------------------------------------------------
 * Static Methods << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

/**
 * @param [apiConf] {ApiConfig}
 * @param [daemonConf] {DaemonConfig}
 * @param callback {function(Error, Api)}
 */
Api.createApi = function (apiConf, daemonConf, callback)
{
	if (typeof apiConf === 'function')
	{
		callback = apiConf;
		apiConf = null;
		daemonConf = null;
	}
	else if (typeof daemonConf === 'function')
	{
		callback = daemonConf;
		daemonConf = null;
	}
	
	if (!(apiConf instanceof ApiConfig))
		apiConf = new ApiConfig();
		
	// try to connect to an existing daemon
	Daemon.connect(apiConf, function (connectError, rpcSock, eventsSock)
	{
		if (!connectError)
		{
			callback(null, new Api(apiConf, rpcSock, eventsSock));
		}
		else
		{
			// daemon probably doesn't exist yet, let's try to start it
			// unless we were trying to connect to a remote host, or explicitly disabled in the ApiConfig
			if (apiConf.noStart)
			{
				callback(connectError, null);
				return;
			}
			
			// check if the client config is for localhost
			Dns.lookup(apiConf.rpcHost, function (dnsError, ip)
			{
				if (dnsError)
				{
					callback(dnsError, null);
					return;
				}
				
				switch (ip)
				{
					case '127.0.0.1':
					case '::1':
					case '0:0:0:0:0:0:0:1':
						break;
					default:
						// client wants to connect to a remote host, so just return the connect error
						callback(connectError, null);
						return;
				}
				
				// client wants to connect to localhost - let's try to start the daemon locally
				if (!(daemonConf instanceof DaemonConfig))
					daemonConf = new DaemonConfig();
				
				Daemon.start(daemonConf, apiConf, function (startError, rpcSock, eventsSock)
				{
					if (startError)
						callback(startError, null);
					else
						callback(null, new Api(apiConf, rpcSock, eventsSock));
				});
			});
		}
	});
};

/* -------------------------------------------------------------------
 * EventHandler Helper Class
 * ---------------------------------------------------------------- */

function EventHandler (event, options, handler)
{
	if (typeof handler !== 'function')
		throw new Error('Event handler must be a function.');

	if (!options || typeof options !== 'object')
		options = {};
	
	this.event = event === '*' ? null : String(event);
	
	this.group = null;
	if (options.group && options.group !== '*')
		this.group = String(options.group);
	
	this.port = null;
	if (options.port && options.port !== '*')
		this.port = Number(options.port);
	
	this.handler = handler;
	this.exact = !!options.exact;
	this.handled = !!options.handled;
}

EventHandler.prototype.matches = function (info)
{
	if (info.handled && !this.handled)
		return false;
	
	if (this.exact)
		return info.event === this.event && info.group === this.group && info.port === this.port;
	
	if (this.event !== null && info.event !== this.event)
		return false;
	
	if (this.group !== null && info.group !== this.group)
		return false;
	
	if (this.port !== null && info.port !== this.port)
		return false;
	
	return true;
};
 