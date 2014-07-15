var http = require('http'),
    events = require("events"),
    YUITest = require('yuitest').YUITest,
    Assert = YUITest.Assert,
    suite = new YUITest.TestSuite("Unit test for mod limits");

YUITest.TestRunner.add(suite);

var attached = false,
    detached = false;

// mock the original ones
http.ClientRequest.prototype.onSocket = function(socket) {
    attached = true;
    socket.on('free', function() {
        detached = true;
    });
}

var mod_limits = require('../lib/index.js');

function getReq(arr) {
    return {
        listener : null,
        url : "www.yahoo.com",
        headers : arr ? [["content-type", "text/plain"], ["host", "www.yahoo.com"]]
        :({ "content-type" : "text/plain",
                "host" : "www.yahoo.com"
            }),
        on : function(what, listener) {
            this.listener = listener;
        },
        method : 'GET',
        agent : {
            addRequest : function() {
            }
        },
        emit : function() {
        }
    };
}

function getResp() {
    return {
        status : 0,
        headers : null,
        blob : "",
        write : function (data) {
            this.blob += data;
        },
        writeHead : function(stat) {
            this.status = stat;
            this.headers = (typeof arguments[1] !== "string") ? arguments[1] : arguments[2];
        },
        end : function (data) {
            this.blob += data;
        }
    };
}

function patchObj(a, b) {
    for (var i in a) {
        if (a.hasOwnProperty(i)) {
            b[i] = a[i];
        }
    }
}

suite.add(new YUITest.TestCase({
    name : "Unit Tests for mod limits",

    'Verify that limits  works' : function() {
        var testee = mod_limits({
            "enable" : "false",
            "post_max_size" : "1000",
            "file_uploads" : false
        });

        var req = getReq(),
            resp = getResp(),
            next = false;

        req.mod_config = {
            "enable" : "true",
            "file_uploads" : true
        };

        testee(req, resp, function() {
            next = true;
        });

        Assert.isNotNull(req.listener);
        Assert.isTrue(next);

        req.listener.call(null, new Buffer(500));
        Assert.areEqual(resp.status, 0);

        req.listener.call(null, new Buffer(600));
        Assert.areEqual(resp.status, 413);
    },
    'Verify that limit is disabled with null config' : function() {
        var testee = mod_limits();

        var req = getReq(),
            resp = getResp(),
            next = false;

        testee(req, resp, function() {
            next = true;
        });
        Assert.isNull(req.listener);
        Assert.isTrue(next);
    },
    
    'Verify that we can disable limits' : function() {
        var testee = mod_limits({
            "enable" : "",
            "post_max_size" : 1000,
            "file_uploads" : true
        });

        var req = getReq(),
            resp = getResp(),
            next = false;

        testee(req, resp, function() {
            next = true;
        });
        Assert.isNull(req.listener);
        Assert.isTrue(next);
    },
    'Verify that limits works with string data' : function() {
        var testee = mod_limits({
            "enable" : "true",
            "post_max_size" : 1000,
            "file_uploads" : true,
            "max_sockets" : 1000
        });

        var req = getReq(),
            resp = getResp(),
            next = false,
            socketDestroyed = false,
            paused = false,
            self = this;

        req.connection = {
            destroySoon : function () {
                socketDestroyed = true;
                self.resume(function() {
                    Assert.isTrue(socketDestroyed);
                    Assert.isTrue(paused);
                });
            },
            setNoDelay : function () {
            },
            pause : function() {
                paused = true;
            }
        };

        testee(req, resp, function() {
            next = true;
        });
        Assert.isNotNull(req.listener);
        Assert.isTrue(next);
        Assert.areEqual(http.globalAgent.maxSockets, 1000);
        
        var longString = "",
            i = 0;
        for (i=0; i < 50; i++) {
            longString +="0123456789";
        }

        req.listener.call(null, longString);
        Assert.areEqual(resp.status, 0);
        for (i=0; i < 60; i++) {
            longString +="0123456789";
        }

        req.listener.call(null, longString);
        Assert.areEqual(resp.status, 413);
        self.wait();
    },

    'Verify that can disable uploads' : function() {
        var testee = mod_limits({
            "enable" : "true",
            "file_uploads" : false
        });

        var req = getReq(),
            resp = getResp(),
            next = false,
            socketDestroyed = false,
            paused = false,
            self = this;

        req.socket = {
            destroySoon : function () {
                socketDestroyed = true;
                self.resume(function() {
                    Assert.isTrue(socketDestroyed);
                    Assert.isTrue(paused);
                });
            },
            setNoDelay : function () {
            },
            pause : function() {
                paused = true;
            }
        }

        testee(req, resp, function() {
            next = true;
        });
        Assert.isNotNull(req.listener);
        Assert.isTrue(next);

        req.listener.call(null, "asdlkasdhflkashdfklasdfklh");
        Assert.areEqual(resp.status, 413);
        self.wait();
    },

    'Verify that we can close incoming connection' : function() {
        var testee = mod_limits({
            "enable" : "true",
            "global_timeout" : 1,
            "inc_req_timeout": 1,
            "out_req_timeout": 1
        });

        var req = getReq(),
            resp = new http.ServerResponse(req),
            next = false;

        // Copy dummy functions
        patchObj(getResp(), resp);

        testee(req, resp, function() {
            next = true;
        });
        Assert.isTrue(next);
        resp.status = 0;

        this.wait( function() {
            Assert.areEqual(resp.status, 504);
        }, 100);
    },

    'Verify that we can close outgoing connection' : function() {
        var testee = mod_limits({
            "enable" : "true",
            "global_timeout" : 1
        });

        // set global mock variables
        attached = false;
        detached = false;

        // create incoming request
        var req = getReq(),
            resp = new http.ServerResponse(req),
            next = false,
            err = null;

        // Copy dummy functions
        patchObj(getResp(), resp);

        testee(req, resp, function() {
            next = true;
        });
        Assert.isTrue(next);
        resp.status = 0;

        var outreq = new http.ClientRequest(getReq());

        // call attach and detach again - this should have set and killed the timer
        var socket = new events.EventEmitter();
        outreq.onSocket(socket);
        socket.emit('free');

        // check call has been propogated
        Assert.isTrue(attached);
        Assert.isTrue(detached);

        attached = false;
        detached = false;

        // now set the timer again
        outreq.onSocket(socket);

        // see it getting triggered
        outreq.on('error', function(e) {
            if (!err)
                err = e;
        })
        var self = this;

        self.wait( function() {
            Assert.areEqual(resp.status, 504);
            Assert.isNotNull(err);
            Assert.isTrue(err.toString().indexOf('limits') !== -1);
        }, 100);
    },

    'Test remove method of closer' : function() {
        var outreq = new http.ClientRequest(getReq());
        var closer = new mod_limits.__Unit_Closer(outreq, 1);

        Assert.areEqual(outreq.__closer, closer);
        closer.remove();
        Assert.isTrue(!outreq.__closer);
    },

    'Test idle timeout and no delay' : function() {
        var testee = mod_limits({
            "enable" : "true",
            "idle_timeout" : 0, // will be overwritten by local config
            "socket_no_delay" : true
        });

        var req = getReq(),
            resp = getResp(),
            next = false,
            noDelay = false;

        req.mod_config = {
            idle_timeout : 1
        };

        var socketCalled = false;

        req.socket = {
            setTimeout : function () {
                socketCalled = true;
            },
            setNoDelay : function() {
                noDelay = true;
            }
        }

        testee(req, resp, function() {
            next = true;
        });

        Assert.isTrue(next);
        Assert.isTrue(socketCalled);
        Assert.isTrue(noDelay);

        noDelay = false;

        socketCalled = false;
        req.connection = {
            socket : {
                setTimeout : function () {
                    socketCalled = true;
                },
                setNoDelay : function() {
                    noDelay = true;
                },
                pause : function() {
                }
            }
        };

        delete req.socket;

        testee(req, resp, function() {
            next = true;
        });
        Assert.isTrue(socketCalled);
        Assert.isTrue(noDelay);
    },
    'Verify that limit works with correct url length' : function() {
        var testee = mod_limits({
            "enable" : "true",
            "uri_max_length" : 1000,
        });

        var req = getReq(),
            resp = getResp(),
            next = false;
            
        testee(req, resp, function() {
            next = true;
        });
        Assert.isTrue(next);
        Assert.isTrue(resp.status !== 413);
            
    },
    'Verify that limit give 413 for over the length url' : function() {
        var testee = mod_limits({
            "enable" : "true",
            "uri_max_length" : "12", //length is 13 in the req object coming from getReq
        });

        var req = getReq(),
            resp = getResp(),
            next = false;
            
        testee(req, resp, function() {
            next = true;
        });
        Assert.isTrue(!next);
        Assert.isTrue(resp.status === 413);
            
    }
    
}));

// vim:ts=4 sw=4 et
