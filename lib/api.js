"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var Axon = require('axon');
var Config = require('./config');
var Daemon = require('./daemon');
var Dns = require('dns');
var Rpc = require('axon-rpc');

/* =============================================================================
 * 
 * Oshi.Api
 *  
 * ========================================================================== */

module.exports = Api;

function Api (options, rpcSock)
{
	/* -------------------------------------------------------------------
	 * Private Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */
	
	var _this = this;
	
	var _client = new Rpc.Client(rpcSock);
	
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
		//
	};
	
	this.kill = function (callback)
	{
		_client.call('kill', callback);
	};
	
	this.prepare = function (groupConfig, callback)
	{
		var conf = groupConfig;
		if (!(conf instanceof Config.GroupConfig))
			conf = new Config.GroupConfig(groupConfig);
		
		_client.call('prepare', conf, callback);
	};

	this.start = function (options, callback)
	{
		_client.call('start', options, callback);
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
	
	//
	
	/* -------------------------------------------------------------------
	 * Initialization
	 * ---------------------------------------------------------------- */
	
	//normalize options
	
}

/* -------------------------------------------------------------------
 * Static Methods << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

Api.createApi = function (options, callback)
{
	if (typeof options === 'function')
	{
		callback = options;
		options = null;
	}
	
	if (!options)
		options = {};
	
	if (!(options.clientConfig instanceof Config.ClientConfig))
		options.clientConfig = new Config.ClientConfig();
		
	// try to connect to an existing daemon
	Daemon.connect(options.clientConfig, function (connectError, rpcSock)
	{
		if (!connectError)
		{
			callback(null, new Api(options, rpcSock));
		}
		else
		{
			// daemon probably doesn't exist yet, let's try to start it
			// unless we were trying to connect to a remote host, or explicitly disabled in the options
			if (options.noStart)
			{
				callback(connectError);
				return;
			}
			
			// check if the client config is for localhost
			Dns.lookup(options.clientConfig.rpcHost, function (dnsError, ip)
			{
				if (dnsError)
				{
					callback(dnsError);
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
						callback(connectError);
						return;
				}
				
				// client wants to connect to localhost - let's try to start the daemon locally
				if (!(options.hostConfig instanceof Config.HostConfig))
					options.hostConfig = new Config.HostConfig();
				
				Daemon.start(options.hostConfig, options.clientConfig, function (startError, rpcSock)
				{
					if (startError)
						callback(startError);
					else
						callback(null, new Api(options, rpcSock));
				});
			});
		}
	});
};
