"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var ConfigBase = require('./ConfigBase');
var Path = require('path');
var Util = require('util');

/* =============================================================================
 * 
 * DaemonConfig Class
 *  
 * ========================================================================== */

module.exports = DaemonConfig;
Util.inherits(DaemonConfig, ConfigBase);

/**
 * @param [obj] {object}
 * @constructor
 */
function DaemonConfig (obj)
{
	/** @member {object} */
	this.env = {};
	/** @member {string} */
	this.cwd = process.cwd();

	/** @member {string} */
	this.nodeExec = process.execPath;
	/** @member {string[]} */
	this.nodeArgs = process.execArgv;

	/** @member {number} Default 200 */
	this.initTimeout = 200;

	/** @member {number} Default 4423 */
	this.rpcPort = 4423;
	/** @member {string} Default '0.0.0.0' */
	this.rpcHost = '0.0.0.0';

	/** @member {number} Default 4424 */
	this.eventsPort = 4424;
	/** @member {string} Default '0.0.0.0' */
	this.eventsHost = '0.0.0.0';

	/** @member {string} Default: '{cwd}/logs' */
	this.logDir = Path.resolve(this.cwd, 'logs');
	/** @member {string} Default: '00:00' */
	this.logRotateAt = '00:00';
	/** @member {number} Default: 1 week in ms */
	this.logTTL = 1000 * 60 * 60 * 24 * 7
	/** @member {boolean} Default: false */
	this.logRotateOnStart = false;

	ConfigBase.call(this, obj);
}
