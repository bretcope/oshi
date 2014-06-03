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
 * Heartbeat - the data that is actually sent over the network
 *
 * ========================================================================== */
function Heartbeat (hostname, pid, timestamp)
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

Heartbeat.fromPacket = function (packet)
{
	var parts = Amp.decode(packet);
	var hostname = parts[0].toString();
	var pid = parts[1].readInt32BE(0);
	var timeStamp = parts[2].readDoubleBE(0);
	// Each part is a buffer
	return new Heartbeat(
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
function Socket (config)
{
	EventEmitter.call(this);
	/* -------------------------------------------------------------------
	 * Private Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */
	var _this = this;

	var _multicastAddress = config.address || '230.1.2.3';
	var _multicastPort = config.port || 54321;
	var _heartbeatInterval = config.heartRate || 5000;
	var _timeout = _heartbeatInterval * 3;

	var _timeoutId;
	var _heartbeatId;

	// Create heartbeat packet
	var _beat = new Heartbeat(Os.hostname(), process.pid);

	var _socket;
	var _liveServers = {};

	/* -------------------------------------------------------------------
	 * Public Members Declaration << no methods >>
	 * ---------------------------------------------------------------- */

	// code

	/* -------------------------------------------------------------------
	 * Public Methods << Keep in alphabetical order >>
	 * ---------------------------------------------------------------- */

	this.start = function ()
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
			_heartbeatId = setInterval(sendHeartbeat, _heartbeatInterval);
		}
	};

	this.getLiveServers = function()
	{
		return JSON.parse(JSON.stringify(_liveServers));
	};

	/* -------------------------------------------------------------------
	 * Private Methods << Keep in alphabetical order >>
	 * ---------------------------------------------------------------- */
	function initializeSocket ()
	{
		_socket = Dgram.createSocket('udp4');

		_socket.on('listening', onListening);
		_socket.on('message', processReceivedHeartbeat);
		_socket.on('error', handleError);

		// On Linux, bind to _multicastAddress, otherwise bind to local address
		_socket.bind(_multicastPort, process.platform == 'linux' ? _multicastAddress : '0.0.0.0');
	}

	function onListening ()
	{
		_socket.setMulticastTTL(3);
		_socket.addMembership(_multicastAddress);
		_heartbeatId = setInterval(sendHeartbeat, _heartbeatInterval);

		setImmediate(sendHeartbeat);
	}

	function sendHeartbeat ()
	{
		// if we can't send the heartbeat, something is seriously wrong
		var packet = _beat.toPacket();
		_this.emit('sending', _beat, packet);
		_socket.send(packet, 0, packet.length, _multicastPort, _multicastAddress, function (err)
		{
			if (err)
			{
				console.error('Could not send heartbeat!');
				console.error(err);
				process.exit(-1);
				return;
			}

			_this.emit('sent', packet);
		});

		checkForTimeouts();
	}

	function checkForTimeouts()
	{
		var now = Date.now();
		var serverNames = Object.keys(_liveServers);
		for (var i = 0, l = serverNames.length; i < l; ++i)
		{
			var key = serverNames[i];
			var server = _liveServers[key];

			if (now - server.received >= _timeout)
			{
				delete _liveServers[key];
				_this.emit('timeout', server);
			}
		}
	}

	function processReceivedHeartbeat (packet, rinfo)
	{
		try
		{
			// rinfo is unreliable, as it's just going to contain the multicast address
			var heartbeat = Heartbeat.fromPacket(packet);
			heartbeat.received = Date.now();

			var id = heartbeat.hostname + ':' + heartbeat.pid;
			_liveServers[id] = heartbeat;
			_this.emit('pulse', heartbeat, _liveServers);
		}
		catch (err)
		{
			console.error('Error while processing heartbeat packet');
			console.error(err);
		}
	}

	function handleError (error)
	{
		console.error(error);
		process.exit(-1);
	}

	/* -------------------------------------------------------------------
	 * Initialization
	 * ---------------------------------------------------------------- */
}

Util.inherits(Socket, EventEmitter);

// If function calls need to be made to initialize the module, put those calls here.
exports.Socket = Socket;
exports.Heartbeat = Heartbeat;
