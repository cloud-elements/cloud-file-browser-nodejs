limits
=======

Simple express/connect middleware to set limit to upload size, set request timeout etc.

It is responsible for:

* Preventing upload completely.
  In config, use: { file_uploads: false }

* Limiting the total size of upload
  In config, use: { post_max_size: [bytes] }, if 0, this functionality is disabled
  
* Limiting the length of uri
  In config, use: { uri_max_length: [number] }, if 0 this functionality is disabled

* Setting a global absolute timeout for both incoming and outgoing connections
  In config, use: { global_timeout: [millis] }, if 0  - no timeout is set

* Setting a global absolute timeout for incoming connections only
  In config, use: { inc_req_timeout: [millis] }, if 0  - no timeout is set

* Setting a global absolute timeout for outgoing connections only
  In config, use: { out_req_timeout: [millis] }, if 0  - no timeout is set

* Setting idle timeout for incoming connections
  In config, use: { idle_timeout: [millis] }, if 0  - no timeout is set

* Setting the http.Agent.defaultMaxSockets for the entire app
  In config, use: { max_sockets: [number] }, if 0  - nothing will be set.
  
* Setting the socket noDelay
  In config, use: { socket_no_delay: [boolean] }, if false  - nothing will be set.

To completely disable module use config, { enable: false }.
Each of the above functionality is disabled if corresponding config attribute is not set.

install
-------
With npm do:

`npm install limits`

usage
-----

```javascript
var express = require('express'),
    limits = require('limits');

var app = express();

var limits_config = {
    enable: true,
    file_uploads: true,
    post_max_size: 2000000
}

app.use(limits(limits_config));

app.listen(8000);
```
Build Status
------------

[![Build Status](https://secure.travis-ci.org/yahoo/node-limits.png?branch=master)](http://travis-ci.org/yahoo/node-limits)

Node Badge
----------

[![NPM](https://nodei.co/npm/limits.png)](https://nodei.co/npm/limits/)
