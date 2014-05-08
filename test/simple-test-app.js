"use strict";

setInterval(function () { console.log('child'); }, 1000);

process.on('message', function () { console.log(arguments); });