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

var should = require("should");
var helper = require("node-red-node-test-helper");
var cissNode = require("../ciss.js");

helper.init(require.resolve('node-red'));

describe('ciss-sensor Node', function() {

    beforeEach(function(done) {
        helper.startServer(done);
    });


    afterEach(function(done) {
        helper.unload();
        helper.stopServer(done);
    });

    
    it('should be loaded CISS sensor', function(done) {
        var flow = [{ id:"n1", type:"ciss-sensor", name:"CISS sensor" }];
        helper.load(cissNode, flow, function() {
            var n1 = helper.getNode("n1");
            n1.should.have.property('name', 'CISS sensor');
            done();
        });
    });

    it('should be loaded CISS port', function(done) {
        var flow = [{ id:"n1", type:"ciss-port", name:"CISS port" }];
        helper.load(cissNode, flow, function() {
            var n1 = helper.getNode("n1");
            n1.should.have.property('name', 'CISS port');
            done();
        });
    });

    /*
    it('should read a dummy value high (not on Pi)', function(done) {
        var flow = [{id:"n1", type:"rpi-gpio in", pin:"7", intype:"up", debounce:"25", read:true, wires:[["n2"]] },
        {id:"n2", type:"helper"}];
        helper.load(cissNode, flow, function() {
            var n1 = helper.getNode("n1");
            var n2 = helper.getNode("n2");
            n2.on("input", function(msg) {
                try {
                    msg.should.have.property('topic', 'pi/7');
                    msg.should.have.property('payload', 1);
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    it('should read a dummy value low (not on Pi)', function(done) {
        var flow = [{id:"n1", type:"rpi-gpio in", pin:"11", intype:"down", debounce:"25", read:true, wires:[["n2"]] },
        {id:"n2", type:"helper"}];
        helper.load(cissNode, flow, function() {
            var n1 = helper.getNode("n1");
            var n2 = helper.getNode("n2");
            n2.on("input", function(msg) {
                try {
                    msg.should.have.property('topic', 'pi/11');
                    msg.should.have.property('payload', 0);
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    it('should be able preset out to a dummy value (not on Pi)', function(done) {
        var flow = [{id:"n1", type:"rpi-gpio out", pin:"7", out:"out", level:"0", set:true, freq:"", wires:[], z:"1"},
        {id:"n2", type:"status", scope:null, wires:[["n3"]], z:"1"},
        {id:"n3", type:"helper", z:"1"}];
        helper.load([cissNode,statusNode], flow, function() {
            var n1 = helper.getNode("n1");
            var n2 = helper.getNode("n2");
            var n3 = helper.getNode("n3");
            var count = 0;
            n3.on("input", function(msg) {
                // Only check the first status message received as it may get a
                // 'closed' status as the test is tidied up.
                if (count === 0) {
                    count++;
                    try {
                        msg.should.have.property('status');
                        msg.status.should.have.property('text', "rpi-gpio.status.na");
                        done();
                    } catch(err) {
                        done(err);
                    }
                }
            });
            n1.receive({payload:"1"});
        });
    });
*/
});