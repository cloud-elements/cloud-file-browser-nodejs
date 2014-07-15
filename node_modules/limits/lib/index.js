/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */
var timers = require('timers'),
    http = require('http');

var globalOutgoing = 0,
    globalIncoming = 0;

//overwrite the global functions to control the timeout behavior.
var hassign = http.ClientRequest.prototype.onSocket;

function mergeConfig(global, local) {
    var result = {}, i;
    for (i in global) {
        if (global.hasOwnProperty(i)) {
            result[i] = global[i];
        }
    }
    for (i in local) {
        if (local.hasOwnProperty(i)) {
            result[i] = local[i];
        }
    }
    return result;
}

/*
 * This object is getting attached to each outgoing
 * request in order to limit the time request is processed.
 *
 * It might be used as idle- or total-time timer.
 * Obviously overhead of using it will not exceed 1000 timer objects per second,
 * since timers with the same expiration are getting bundled.
 *
 * @param message - the outgoing request object or outgoing response object.
 * @param t - timeout value
 */
function Closer(message, t) {
    this.message = message;
    message.__closer = this;

    timers.enroll(this, t);
    timers.active(this);
}

Closer.prototype = {

    _onTimeout : function () {
        if (this.message instanceof http.ClientRequest) {
            var abortError;
            this.message.abort();

            abortError = new Error('limits forced http.ClientRequest to time out');
            abortError.code = 'timeout';
            delete this.message.__closer;
            this.message.emit('error', abortError);
        } else if (this.message instanceof http.ServerResponse) {
            try {
                delete this.message.__closer;
                this.message.writeHead(504, 'Gateway Timeout', {'Content-Type': 'text/plain'});
                this.message.end('504 Gateway Timeout');
            } catch (e) {
            }
        }
    },
    /*
     * Removes the closer object from the request.
     */
    remove : function () {
        timers.unenroll(this);
        if (this.message && this.message.__closer) {
            delete this.message.__closer;
        }
    }
};

http.ClientRequest.prototype.onSocket = function (socket) {
    // Attach socket
    var s = hassign.apply(this, arguments),
        closer,
        self = this;

    if (globalOutgoing > 0 && this instanceof http.ClientRequest) {
        closer = new Closer(this, globalOutgoing);
        if (socket) {
            socket.once('free', function () {
                if (socket._httpMessage === self) {
                    //Detach Socket
                    if (self.__closer) {
                        timers.unenroll(self.__closer);
                        delete self.__closer;
                    }
                }
            });
        }
    }
    return s;
};

/*
 * This function sets the timeout value for incoming and outgoing requests
 * in order to limit the waiting time for back ends to the SLA.
 */
function exposeGlobalTimers(config) {

    // Sets the global timeout value for all outgoing requests
    process.setOutgoingRequestsTimeout = function (val) {
        globalOutgoing = val;
    };

    // Sets the global timeout value for all incoming requests
    process.setIncomingRequestsTimeout = function (val) {
        globalIncoming = val;
    };

    // Sets the global timeout value for all incoming and outgoing requests
    process.setAllRequestsTimeout = function (val) {
        globalOutgoing = val;
        globalIncoming = val;
    };

    // set values from config
    config.global_timeout = parseInt(config.global_timeout, 10);
    if (config.global_timeout > 0) {
        process.setAllRequestsTimeout(config.global_timeout);
    }

    config.inc_req_timeout = parseInt(config.inc_req_timeout, 10);
    if (config.inc_req_timeout > 0) {
        process.setIncomingRequestsTimeout(config.inc_req_timeout);
    }

    config.out_req_timeout = parseInt(config.out_req_timeout, 10);
    if (config.out_req_timeout > 0) {
        process.setOutgoingRequestsTimeout(config.out_req_timeout);
    }
    
}

/*
 * Instruments request for timeouts
 */
function instrumentReq(config, req, resp) {
    var closer,
        timeout;

    config.idle_timeout = parseInt(config.idle_timeout, 10);
    if (config.idle_timeout > 0) {
        if (req.socket) {
            req.socket.setTimeout(config.idle_timeout);
        } else if (req.connection && req.connection.socket) {
            req.connection.socket.setTimeout(config.idle_timeout);
        }
    }

    config.incoming_timeout = parseInt(config.incoming_timeout, 10);
    // sets the timeout on the request
    if (config.incoming_timeout > 0 || globalIncoming > 0) {
        timeout = config.incoming_timeout || globalIncoming;
        closer = new Closer(resp, timeout);
    }
}

/*
 * Set Socket NoDelay to true
 */
function setNoDelay(conf, req) {
    var socket;
    if (conf.socket_no_delay) {
        socket = req.connection && req.connection.socket ? req.connection.socket : req.socket;
        socket.setNoDelay(true);
    }
}

/*
 * Sets the maxSockects
 */
function setDefaultMaxSockets(conf) {
    conf.max_sockets = parseInt(conf.max_sockets, 10);
    if (conf.max_sockets > 0) {
        http.globalAgent.maxSockets = conf.max_sockets;
    }
}

module.exports = function (config) {
    if (config && (config.enable === "true" || config.enable === true)) {
        exposeGlobalTimers(config);
    }

    return function (req, resp, next) {
        var count = null,
            conf = (req.mod_config) ? mergeConfig(config, req.mod_config) : config;
            
        if (!conf || (conf.enable !== "true" && conf.enable !== true)) {
            next();
            return;
        }

        if (typeof conf.post_max_size === "string") {
            conf.post_max_size = parseInt(conf.post_max_size, 10);
        }
        
        if (typeof conf.uri_max_length === "string") {
            conf.uri_max_length = parseInt(conf.uri_max_length, 10);
        }

        if (conf.uri_max_length > 0 && req.url.length > conf.uri_max_length ) {
            resp.writeHead(413, 'Request-URI Too Long', {'Content-Type': 'text/plain'});
            resp.end('413 Request-URI Too Long');
            return;
        }

        setDefaultMaxSockets(conf);

        instrumentReq(conf, req, resp);
        setNoDelay(conf, req);

        req.on('data', function (data) {
            if (data instanceof Buffer) {
                count += data.length;
            } else if (typeof data === "string") {
                var encoding = (req._decoder && req._decoder.encoding) ?  req._decoder.encoding : 'utf8';
                count += Buffer.byteLength(data, encoding);
            }

            if ((conf.post_max_size > 0 && count > conf.post_max_size) || (conf.file_uploads !== "true" && conf.file_uploads !== true)) {

                if (!resp._header) {
                    if (req.socket) {
                        req.socket.setNoDelay(true);
                    } else if (req.connection && req.connection.socket) {
                        req.connection.socket.setNoDelay(true);
                    }

                    // write response
                    resp.writeHead(413, 'Request Entity Too Large', {'Content-Type': 'text/plain'});
                    resp.end('413 Request Entity Too Large');
                }
                req.emit('error', 'Request Entity Too Large');
                req._hadError = true;

                // stops the socket, so the data stream stops
                if (req.socket) {
                    req.socket.pause();
                    // allow socket to flush
                    setTimeout(function () {
                        if (req.socket) {
                            req.socket.destroySoon();
                        }
                    });
                } else if (req.connection) {
                    req.connection.pause();
                    setTimeout(function () {
                        if (req.connection) {
                            req.connection.destroySoon();
                        }
                    });
                }
            }
        });
        next();
    };
};
module.exports.__Unit_Closer = Closer;
