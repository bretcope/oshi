"use strict";

setTimeout(function () { process.send({ message: 'hello' }); }, 100);

process.on('message', function () { console.log(arguments); });