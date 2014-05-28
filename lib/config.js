"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var Path = require('path');
var Util = require('util');
 
/* =============================================================================
 * 
 * Base Config Class
 *  
 * ========================================================================== */

module.exports = Config;

function Config (obj)
{
	var prefix;
	var env;
	
	if (!obj)
	{
		env = process.env;
		prefix = getPrefix(this);
	}
	else
	{
		prefix = '';
		env = obj;
	}
	
	var props = Object.getOwnPropertyNames(this);
	
	var p;
	for (var i in props)
	{
		p = props[i];
		if (prefix + p in env)
		{
			if (typeof this[p] === 'number')
				this[p] = Number(env[prefix + p]);
			else
				this[p] = env[prefix + p]
		}
	}
}

/* -------------------------------------------------------------------
 * Public Methods << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

Config.prototype.toEnv = function ()
{
	var ret = {};
	dotNotation(this, getPrefix(this), ret);
	return ret;
};
/* -------------------------------------------------------------------
 * Helper Functions << no methods >>
 * ---------------------------------------------------------------- */

//converts nested properties into a flat object with sub-keys separated with dots
function dotNotation (origObj, prefix, newObj)
{
	var keys = Object.keys(origObj);
	var k, v;
	for (var i in keys)
	{
		k = keys[i];
		v = origObj[k];
		if (v && typeof v === 'object')
			dotNotation(v, prefix + k + '.', newObj);
		else
			newObj[prefix + k] = v;
	}
}

function getPrefix (obj)
{
	if (obj instanceof HostConfig)
		return 'oshi.host.';
	
	if (obj instanceof ClientConfig)
		return 'oshi.client.';
	
	if (obj instanceof GroupConfig)
		return 'oshi.group.' + obj.name.replace(/[^A-Za-z0-9_-]/g, '_') + '.';
	
	return 'oshi.';
}

/* =============================================================================
 * 
 * Host Config Class
 *  
 * ========================================================================== */

Util.inherits(HostConfig, Config);
Config.HostConfig = HostConfig;

function HostConfig (obj)
{
	this.env = {};
	this.cwd = process.cwd();

	this.nodeExec = process.execPath;
	this.nodeArgs = process.execArgv;
	
	this.initTimeout = 200;
	
	this.rpcPort = 4423;
	this.rpcHost = '0.0.0.0';
	
	this.eventsPort = 4424;
	this.eventsHost = '0.0.0.0';
	
	Config.call(this, obj);
}

/* =============================================================================
 * 
 * Client Config Class
 *  
 * ========================================================================== */

Util.inherits(ClientConfig, Config);
Config.ClientConfig = ClientConfig;

function ClientConfig (obj)
{
	this.rpcPort = 4423;
	this.rpcHost = 'localhost';

	this.eventsPort = 4424;
	this.eventsHost = 'localhost';
	
	this.connectTimeout = 2000;
	
	Config.call(this, obj);
}

/* =============================================================================
 * 
 * Process Group Config Class
 *  
 * ========================================================================== */

Util.inherits(GroupConfig, Config);
Config.GroupConfig = GroupConfig;

function GroupConfig (options)
{
	if (typeof options === 'string')
	{
		options = { script: options };
	}
	
	if (!options.script || typeof options.script !== 'string')
		throw new TypeError('');

	this.name = String(options.name || Path.basename(options.script, '.js')).trim();
	this.args = options.args instanceof Array ? options.args : [];
	this.cwd = options.cwd || process.cwd();
	this.script = Path.resolve(this.cwd, options.script);
	this.env = (options.env && typeof options.env === 'object') ? options.env : {};
	this.nodeExec = process.execPath;
	this.nodeArgs = options.nodeArgs instanceof Array ? options.nodeArgs : [];
	this.nodeVersion = options.nodeVersion || null;

	this.readyEvent = options.readyEvent || null;
	this.initTimeout = 'initTimeout' in options ? options.initTimeout : 200;

	this.gracefulSignal = 'SIGTERM';
	this.gracefulTimeout = 5000;
	this.useMessageOnWindows = false;
}
