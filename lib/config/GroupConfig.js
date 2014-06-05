"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var ConfigBase = require('./ConfigBase');
var Path = require('path');
var Util = require('util');

/* =============================================================================
 * 
 * GroupConfig Class
 *  
 * ========================================================================== */

module.exports = GroupConfig;
Util.inherits(GroupConfig, ConfigBase);

/**
 * @param [options] {object} Default options object.
 * @constructor
 */
function GroupConfig (options)
{
	if (typeof options === 'string')
	{
		options = { script: options };
	}

	if (!options.script || typeof options.script !== 'string')
		throw new TypeError('');

	/** @member {string} */
	this.name = String(options.name || Path.basename(options.script, '.js')).trim();
	/** @member {string[]} */
	this.args = options.args instanceof Array ? options.args : [];
	/** @member {string} */
	this.cwd = options.cwd || process.cwd();
	/** @member {string} */
	this.script = Path.resolve(this.cwd, options.script);
	/** @member {object} */
	this.env = (options.env && typeof options.env === 'object') ? options.env : {};
	/** @member {string} */
	this.nodeExec = process.execPath;
	/** @member {string[]} */
	this.nodeArgs = options.nodeArgs instanceof Array ? options.nodeArgs : [];
	/** @member {string} Default null */
	this.nodeVersion = options.nodeVersion || null;

	/** @member {string} Default null */
	this.readyEvent = options.readyEvent || null;
	/** @member {number} Default 200 */
	this.initTimeout = 'initTimeout' in options ? options.initTimeout : 200;

	/** @member {string} Default 'SIGTERM' */
	this.gracefulSignal = options.gracefulSignal || 'SIGTERM';
	/** @member {number} Default 5000 */
	this.gracefulTimeout = typeof options.gracefulTimeout === 'number' ? options.gracefulTimeout : 5000;
	/** @member {boolean} Default false */
	this.useMessageOnWindows = !!options.useMessageOnWindows;
}
