"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */

var ConfigBase = require('./ConfigBase');
var Util = require('util');

/* =============================================================================
 * 
 * ApiConfig Class
 *  
 * ========================================================================== */

module.exports = ApiConfig;
Util.inherits(ApiConfig, ConfigBase);

/**
 * @param [obj] {object}
 * @constructor
 */
function ApiConfig (obj)
{
	/** @member {number} Default 4423 */
	this.rpcPort = 4423;
	/** @member {string} Default 'localhost' */
	this.rpcHost = 'localhost';

	/** @member {number} Default 4424 */
	this.eventsPort = 4424;
	/** @member {string} Default 'localhost' */
	this.eventsHost = 'localhost';

	/** @member {number} Default 2000 */
	this.connectTimeout = 2000;
	
	/** @member {boolean} If true, the API will not try to start up the daemon, even if it doesn't exist. Default false */
	this.noStart = false;

	ConfigBase.call(this, obj);
}
