"use strict";
/* -------------------------------------------------------------------
 * Require Statements << Keep in alphabetical order >>
 * ---------------------------------------------------------------- */
var Dgram = require('dgram');
var Amp = require('amp');
var Os = require('os');
var EventEmitter = require('events').EventEmitter;
var Util = require('util');

/* =============================================================================
 *
 * Pulse - the data that is actually sent over the network
 *
 * ========================================================================== */
function Pulse (hostname, pid, timestamp)
{
	this.hostname = hostname;
	this.pid = pid;
	this.timestamp = timestamp;

	var _this = this;

	var _hostnameBuffer = new Buffer(hostname);

	var _pidBuffer = new Buffer(4);
	_pidBuffer.writeInt32BE(this.pid, 0);

	var _timestampBuffer = new Buffer(8);

	this.toPacket = function ()
	{
		var ts = _this.timestamp ? _this.timestamp : Date.now();
		_timestampBuffer.writeDoubleBE(ts, 0);

		return Amp.encode([
			_hostnameBuffer,
			_pidBuffer,
			_timestampBuffer
		]);
	};
}

Pulse.fromPacket = function (packet)
{
	var parts = Amp.decode(packet);
	var hostname = parts[0].toString();
	var pid = parts[1].readInt32BE(0);
	var timeStamp = parts[2].readDoubleBE(0);
	// Each part is a buffer
	return new Pulse(
		hostname,
		pid,
		timeStamp
	);
};

/* =============================================================================
 *
 * Socket
 *
 * ========================================================================== */

// constructor
function Heartbeat (config)
{
	EventEmitter.call(this);
	/* -------------------------------------------------------------------
	 * Private Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */
	var _this = this;

	var _multicastAddress = config.address || '230.1.2.3';
	var _multicastPort = config.port || 54321;
	var _heartRate = config.heartRate || 5000;
	var _timeout = config.timeout || _heartRate * 3;

	var _heartbeatId;

	// Create heartbeat packet
	var _beat = new Pulse(Os.hostname(), process.pid);

	var _socket;
	var _knownServers = {};

	/* -------------------------------------------------------------------
	 * Public Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */

	// code

	/* -------------------------------------------------------------------
	 * Public Methods << Keep in alphabetical order >>
	 * ---------------------------------------------------------------- */

	this.start = function ()
	{
		try
		{
			if (!_socket)
			{
				// if _heartbeatId is defined (it shouldn't be), clear it just to
				// be safe
				if (_heartbeatId)
				{
					clearInterval(_heartbeatId);
					_heartbeatId = null;
				}

				initializeSocket();
			}
			else if (!_heartbeatId)
			{
				_heartbeatId = setInterval(sendPulse, _heartRate);
			}
		}
		catch (err)
		{
			_this.emit('error', err);
		}
	};

	/* -------------------------------------------------------------------
	 * Private Methods << Keep in alphabetical order >>
	 * ---------------------------------------------------------------- */
	function initializeSocket ()
	{
		try
		{
			_socket = Dgram.createSocket('udp4');

			_socket.on('listening', onListening);
			_socket.on('message', processReceivedPulse);
			_socket.on('error', handleError);

			// On Linux, bind to _multicastAddress, otherwise bind to local address
			_socket.bind(_multicastPort, process.platform == 'linux' ? _multicastAddress : '0.0.0.0');
		}
		catch (err)
		{
			_this.emit('error', err);
		}
	}

	function onListening ()
	{
		try
		{
			_socket.setMulticastTTL(3);
			_socket.addMembership(_multicastAddress);
			_heartbeatId = setInterval(sendPulse, _heartRate);

			setImmediate(sendPulse);
		}
		catch (err)
		{
			_this.emit('error', err);
		}
	}

	function sendPulse ()
	{
		try
		{
			// if we can't send the heartbeat, something is seriously wrong
			var packet = _beat.toPacket();
			_this.emit('sending', _beat, packet);
			_socket.send(packet, 0, packet.length, _multicastPort, _multicastAddress, function (err)
			{
				if (err)
				{
					_this.emit('error', err);
					return;
				}

				_this.emit('sent', packet);
			});
		}
		catch (err)
		{
			_this.emit('error', err);
			return;
		}

		checkForTimeouts();
	}

	function checkForTimeouts ()
	{
		try
		{
			var now = Date.now();
			var serverNames = Object.keys(_knownServers);
			for (var i = 0, l = serverNames.length; i < l; ++i)
			{
				var key = serverNames[i];
				var server = _knownServers[key];

				if (now - server.received >= _timeout)
				{
					delete _knownServers[key];
					_this.emit('timeout', server);
				}
			}
		}
		catch (err)
		{
			_this.emit('error', err);
		}
	}

	function processReceivedPulse (packet, rinfo)
	{
		try
		{
			// rinfo is unreliable, as it's just going to contain the multicast address
			var beat = Pulse.fromPacket(packet);
			beat.received = Date.now();

			var id = beat.hostname + ':' + beat.pid;
			_knownServers[id] = beat;
			_this.emit('pulse', beat, _knownServers);
		}
		catch (err)
		{
			_this.emit('error', err);
		}
	}

	function handleError (error)
	{
		_this.emit('error', error);
	}

	/* -------------------------------------------------------------------
	 * Initialization
	 * ---------------------------------------------------------------- */
}

Util.inherits(Heartbeat, EventEmitter);

module.exports = Heartbeat;
