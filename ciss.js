/*

Copyright 2019, AIS Automation Dresden GmbH

Permission is hereby granted, free of charge, to any person obtaining a copy of 
this software and associated documentation files (the "Software"), to deal in 
the Software without restriction, including without limitation the rights to 
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so, 
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all 
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR 
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER 
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN 
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

module.exports = function (RED) {
    "use strict";
    var settings = RED.settings;
    var events = require("events");
    var serialp = require("serialport");
    var bufMaxSize = 32768;  // Max serial buffer size, for inputs...

    function SerialPortNode(n) {
        RED.nodes.createNode(this, n);
        this.serialport = n.serialport;
        this.serialbaud = parseInt(n.serialbaud) || 57600;
        this.databits = parseInt(n.databits) || 8;
        this.parity = n.parity || "none";
        this.stopbits = parseInt(n.stopbits) || 1;
        this.responsetimeout = n.responsetimeout || 1000;
    }

    RED.nodes.registerType("ciss-port", SerialPortNode);

    function CissSensorNode(n) {
        RED.nodes.createNode(this, n);
        this.serial = n.serial;
        this.serialConfig = RED.nodes.getNode(this.serial);

        // initialize node js output msg array
        var values = [];
        for (var i = 0; i < 13; i++) {
            values[i] = { payload: "" };
        }

        this.send_data = function (data) {
            var buffer = calc_crc(data);
            this.port.write(buffer, function () { });
        };

        this._switch_sensor = function (sensor, enable) {
            return this.send_data(new Buffer([0xFE, 0x02, sensor, enable]));
        };

        this.enable_sensor = function (sensor) {
            return this._switch_sensor(sensor, 0x01);
        };

        this.disable_sensor = function (sensor) {
            return this._switch_sensor(sensor, 0x00);
        };

        this.check_payload = function (payload) {
            var crc = 0;
            for (var i = 1; i < payload.length - 1; i++) {
                crc = crc ^ payload[i];
            }
            if ((crc & 0xFF) == payload[payload.length - 1]) {
                return 1;
            }

            return 0;
        };

        this.disable_all_sensors = function () {
            node.disable_sensor(0x82);
            node.disable_sensor(0x83);
            node.disable_sensor(0x84);
            node.disable_sensor(0x85);
            node.disable_sensor(0x86);
        };

        this.parse_payload = function (_payload) {
            //            outputLabels: 
            // [ "Humidity", "Pressure", "Temperature", "Lux", "Acc-X", "Acc-Y", "Acc-Z", "Mag-X", "Mag-Y", "Mag-Z", "Gyro-X", "Gyro-Y", "Gyro-Z"],
            if (this.check_payload(_payload)) {
                var pos = 2;
                try {
                    var isEnvironmentalChanged = false;
                    // loop until crc byte reached
                    while (pos < _payload.length - 1) {
                        switch (_payload[pos]) {
                            case 0x02: // Acceleration
                                values[4].payload = _payload.readInt16LE(pos + 1);
                                values[5].payload = _payload.readInt16LE(pos + 3);
                                values[6].payload = _payload.readInt16LE(pos + 5);
                                node.send([null, null, null, null, values[4], values[5], values[6]]);
                                pos += 7;
                                break;
                            case 0x03: // Magnetometer
                                values[7].payload = _payload.readInt16LE(pos + 1);
                                values[8].payload = _payload.readInt16LE(pos + 3);
                                values[9].payload = _payload.readInt16LE(pos + 5);
                                node.send([null, null, null, null, null, null, null, values[7], values[8], values[9]]);
                                pos += 7;
                                break;
                            case 0x04: // Gyroscope
                                values[10].payload = _payload.readInt16LE(pos + 1);
                                values[11].payload = _payload.readInt16LE(pos + 3);
                                values[12].payload = _payload.readInt16LE(pos + 5);
                                node.send([null, null, null, null, null, null, null, null, null, null, values[10], values[11], values[12]]);
                                pos += 7;
                                break;
                            case 0x05: // Temperature
                                isEnvironmentalChanged = true;
                                values[2].payload = _payload.readInt16LE(pos + 1) / 10;
                                pos += 3;
                                break;
                            case 0x06: // Pressure
                                isEnvironmentalChanged = true;
                                values[1].payload = _payload.readInt32LE(pos + 1) / 100;
                                pos += 5;
                                break;
                            case 0x07: // Humidity
                                isEnvironmentalChanged = true;
                                values[0].payload = _payload.readInt16LE(pos + 1) / 100;
                                pos += 3;
                                break;
                            case 0x08: // Light
                                values[3].payload = _payload.readInt32LE(pos + 1);
                                pos += 5;
                                node.send([null, null, null, values[3]]);
                                break;
                            default:
                                pos = _payload.length;
                        }
                    }
                    if (isEnvironmentalChanged) {
                        // update only the environmental sensor values at once
                        node.send([values[0], values[1], values[2]]);
                    }
                } catch (ex) {
                    RED.log.error(ex.toString());
                }
            }

        };

        if (this.serialConfig) {
            var node = this;
            node.status({ fill: "grey", shape: "dot", text: "node-red:common.status.not-connected" });
            node.port = serialPool.get(this.serialConfig);

            node.port.on("data", function (msgout) {
                node.parse_payload(msgout);
            });

            node.port.on("ready", function () {
                // disable all sensors on startup
                node.disable_all_sensors();

                node.status({ fill: "green", shape: "dot", text: "node-red:common.status.connected" });
            });
            node.port.on("closed", function () {
                node.disable_all_sensors();
                node.status({ fill: "red", shape: "ring", text: "node-red:common.status.not-connected" });
            });

            node.port = serialPool.get(this.serialConfig);

            // Serial input for configuration
            node.on("input", function (msg) {
                if (!msg.hasOwnProperty("payload")) {
                    return;
                } // do nothing unless we have a payload

                switch (msg.topic) {
                    case "Environmental":
                        if (msg.payload === true) {

                            //Set sampling rate
                            this.send_data(new Buffer([0xFE, 0x04, 0x83, 0x02, 0x01, 0x00]));

                            //Enable Temp sensor
                            this.enable_sensor(0x83);
                        } else {
                            this.disable_sensor(0x83);
                        }
                        break;
                    case "Light":
                        if (msg.payload === true) {
                            //Set sampling rate
                            this.send_data(new Buffer([0xFE, 0x04, 0x84, 0x02, 0x01, 0x00]));

                            //Enable Light sensor
                            this.enable_sensor(0x84);
                        } else {
                            this.disable_sensor(0x84);
                        }
                        break;
                    case "Acceleration":
                        if (msg.payload === true) {
                            //Set sampling rate
                            this.send_data(new Buffer([0xFE, 0x06, 0x80, 0x02, 0x40, 0x42, 0x0F, 0x00]));

                            //Enable Light sensor
                            this.enable_sensor(0x80);
                        } else {
                            this.disable_sensor(0x80);
                        }
                        break;
                    case "Magnetometer":
                        if (msg.payload === true) {
                            //Set sampling rate
                            this.send_data(new Buffer([0xFE, 0x06, 0x81, 0x02, 0x40, 0x42, 0x0F, 0x00]));

                            //Enable Light sensor
                            this.enable_sensor(0x81);
                        } else {
                            this.disable_sensor(0x81);
                        }
                        break;
                    case "Gyroscope":
                        if (msg.payload === true) {
                            //Set sampling rate
                            this.send_data(new Buffer([0xFE, 0x06, 0x82, 0x02, 0x40, 0x42, 0x0F, 0x00]));

                            //Enable Light sensor
                            this.enable_sensor(0x82);
                        } else {
                            this.disable_sensor(0x82);
                        }
                        break;
                }
            });
        }
        else {
            this.error(RED._("ciss.errors.missing-conf"));
        }

        this.on("close", function (done) {
            if (this.serialConfig) {
                this.disable_all_sensors();
                serialPool.close(this.serialConfig.serialport, done);
            }
            else {
                done();
            }
        });
    }

    RED.nodes.registerType("ciss-sensor", CissSensorNode);

    function calc_crc(data) {
        var result = 0;
        var incoming = data;
        for (var i = 0; i < data.length; i++)
            result = result ^ data[i];
        result = result ^ 254;
        return Buffer.concat([incoming, Buffer.from([result])]);
    }

    var serialPool = (function () {
        var connections = {};
        return {
            get: function (serialConfig) {
                // make local copy of configuration -- perhaps not needed?
                var port = serialConfig.serialport,
                    baud = serialConfig.serialbaud,
                    databits = serialConfig.databits,
                    parity = serialConfig.parity,
                    stopbits = serialConfig.stopbits,
                    binoutput = "bin";
                var id = port;
                // just return the connection object if already have one
                // key is the port (file path)
                if (connections[id]) { return connections[id]; }

                // State variables to be used by the on('data') handler
                var i = 0; // position in the buffer
                // .newline is misleading as its meaning depends on the split input policy:
                //   "char"  : a msg will be sent after a character with value .newline is received
                //   "time"  : a msg will be sent after .newline milliseconds
                //   "count" : a msg will be sent after .newline characters
                // if we use "count", we already know how big the buffer will be
                var bufSize = bufMaxSize;

                var buf = new Buffer.alloc(bufSize);

                connections[id] = (function () {
                    var obj = {
                        _emitter: new events.EventEmitter(),
                        serial: null,
                        _closing: false,
                        tout: null,
                        queue: [],
                        on: function (a, b) { this._emitter.on(a, b); },
                        close: function (cb) { this.serial.close(cb); },
                        encodePayload: function (payload) {
                            if (!Buffer.isBuffer(payload)) {
                                if (typeof payload === "object") {
                                    payload = JSON.stringify(payload);
                                }
                                else {
                                    payload = payload.toString();
                                }
                            }
                            return payload;
                        },
                        write: function (m, cb) { this.serial.write(m, cb); },
                        enqueue: function (msg, sender, cb) {
                            var payload = this.encodePayload(msg.payload);
                            var qobj = {
                                sender: sender,
                                msg: msg,
                                payload: payload,
                                cb: cb,
                            };
                            this.queue.push(qobj);
                            // If we're enqueing the first message in line,
                            // we shall send it right away
                            if (this.queue.length === 1) {
                                this.writehead();
                            }
                        },
                        writehead: function () {
                            if (!this.queue.length) { return; }
                            var qobj = this.queue[0];
                            this.write(qobj.payload, qobj.cb);
                            var msg = qobj.msg;
                            var timeout = msg.timeout;
                            this.tout = setTimeout(function () {
                                this.tout = null;
                                var msgout = obj.dequeue() || {};
                                msgout.port = port;
                                // if we have some leftover stuff, just send it
                                if (i !== 0) {
                                    var m = buf.slice(0, i);
                                    m = Buffer.from(m);
                                    i = 0;
                                    if (binoutput !== "bin") { m = m.toString(); }
                                    msgout.payload = m;
                                }
                                /* Notify the sender that a timeout occurred */
                                obj._emitter.emit("timeout", msgout, qobj.sender);
                            }, timeout);
                        },
                        dequeue: function () {
                            // if we are trying to dequeue stuff from an
                            // empty queue, that's an unsolicited message
                            if (!this.queue.length) { return null; }
                            var msg = Object.assign({}, this.queue[0].msg);
                            msg = Object.assign(msg, {
                                request_payload: msg.payload,
                                request_msgid: msg._msgid,
                            });
                            delete msg.payload;
                            if (this.tout) {
                                clearTimeout(obj.tout);
                                obj.tout = null;
                            }
                            this.queue.shift();
                            this.writehead();
                            return msg;
                        },
                    };
                    //newline = newline.replace("\\n","\n").replace("\\r","\r");
                    var olderr = "";
                    var setupSerial = function () {
                        obj.serial = new serialp(port, {
                            baudRate: baud,
                            dataBits: databits,
                            parity: parity,
                            stopBits: stopbits,
                            //parser: serialp.parsers.raw,
                            autoOpen: true
                        }, function (err) {
                            if (err) {
                                if (err.toString() !== olderr) {
                                    olderr = err.toString();
                                    RED.log.error(RED._("ciss.errors.error", { port: port, error: olderr }));
                                }
                                obj.tout = setTimeout(function () {
                                    setupSerial();
                                }, settings.serialReconnectTime);
                            }
                        });
                        obj.serial.on("error", function (err) {
                            RED.log.error(RED._("ciss.errors.error", { port: port, error: err.toString() }));
                            obj._emitter.emit("closed");
                            obj.tout = setTimeout(function () {
                                setupSerial();
                            }, settings.serialReconnectTime);
                        });
                        obj.serial.on("close", function () {
                            if (!obj._closing) {
                                RED.log.error(RED._("ciss.errors.unexpected-close", { port: port }));
                                obj._emitter.emit("closed");
                                obj.tout = setTimeout(function () {
                                    setupSerial();
                                }, settings.serialReconnectTime);
                            }
                        });
                        obj.serial.on("open", function () {
                            olderr = "";
                            RED.log.info(RED._("ciss.onopen", { port: port, baud: baud, config: databits + "" + parity.charAt(0).toUpperCase() + stopbits }));
                            if (obj.tout) {
                                clearTimeout(obj.tout); obj.tout = null;
                            }
                            //obj.serial.flush();
                            obj._emitter.emit("ready");
                        });

                        obj.serial.on("data", function (d) {
                            var sof = "\xFE";
                            i = 0;
                            var innerbuffer = new Buffer.alloc(512);

                            var expectedSize = 0;

                            d.forEach(element => {
                                if (element == sof) {
                                    i = 0;
                                }

                                innerbuffer[i] = element;
                                if (i == 1) {
                                    expectedSize = element + 3;
                                }

                                i++;
                                if (i == expectedSize) {
                                    obj._emitter.emit("data", Buffer.from(innerbuffer.slice(0, i)));
                                }
                            });
                        });
                        // obj.serial.on("disconnect",function() {
                        //     RED.log.error(RED._("serial.errors.disconnected",{port:port}));
                        // });
                    };
                    setupSerial();
                    return obj;
                }());
                return connections[id];
            },
            close: function (port, done) {
                if (connections[port]) {
                    if (connections[port].tout != null) {
                        clearTimeout(connections[port].tout);
                    }
                    connections[port]._closing = true;
                    try {
                        connections[port].close(function () {
                            RED.log.info(RED._("ciss.errors.closed", { port: port }));
                            done();
                        });
                    }
                    catch (err) { 
                        RED.log.debug(RED._("ciss.errors.closed", err));
                    }
                    delete connections[port];
                }
                else {
                    done();
                }
            }
        };
    }());

    RED.httpAdmin.get("/ciss", RED.auth.needsPermission("serial.read"), function (req, res) {
        serialp.list(function (err, ports) {
            res.json(ports);
        });
    });
};
