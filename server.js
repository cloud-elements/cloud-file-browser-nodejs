/*
###################################################################################
##     Cloud File Browser                                                        ##
###################################################################################

Copyright 2012-2014 Cloud Elements <http://www.cloud-elements.com>          

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License.

*/

/////////////////////////////////////////////////
// NODEJS SERVER EXAMPLE ////////////////////////
/////////////////////////////////////////////////
/*

    The Following is an example server on how to route
    REST calls from the Cloud File Browser to the Cloud
    Elements API while keeping your User Secret and
    Organization Secret hidden from the end user.
    
    For this example, we're using Node.js in combination
    with Express and Connect. The basics of what we're
    doing here is catching ANY request that comes into
    localhost:8888 and transforming the request into
    a valid Cloud Elements API request -- This way,
    we're able to keep the URL paths consistent across
    a number of different platforms.

*/

var http = require("http");
var https = require("https");
var connect = require("connect");
var express = require("express");
var cookieParser = require("cookie-parser");
var serveStatic = require("serve-static");
var limits = require("limits");
var url = require("url");
var qs = require('querystring');
var util = require('util');
var app = express();

///////////////////////////////////////////////////
// SET HEADERS ON NODE TO ACCEPT FROM ANY ORIGIN //
///////////////////////////////////////////////////

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
};

/////////////////////////////////////////////////
// CONFIG ///////////////////////////////////////
/////////////////////////////////////////////////

    
    //////////////////////////////////////////////////////////////////////////////////
    // EXAMPLE USE ONLY                                                             //
    //                                                                              //
    // Note: Typically, you would want to store your Org Secret and User Secret     //
    //       in a more secure manner than plain-text (e.g. Database). For example   //
    //       purposes, we are storing it in the server as a string to show how you  //
    //       would work with populated oSec and uSec variables.                     //
    //////////////////////////////////////////////////////////////////////////////////

    organizationSecret = '98c89f16608df03b0248b74ecaf6a79b',
    userSecret = '846708bb4a1da71d70286bc5bb0c51bf',
        
    //////////////////////////////////////////////////////////////////////////////////
    // HOW TO DEFINE ELEMENTS                                                       //
    //                                                                              //
    // Note: Here is where we define which elements will be visible on the File     //
    //       Browser UI. Example usage shown below.                                 //
    //////////////////////////////////////////////////////////////////////////////////
    
        documents = {
            'box': {
                'elementToken' : 'd2d3ec396a33f70d00f91a27e46bdb24'
            },

            'dropbox': {
                'elementToken' : 'd2d3ec396a33f70d00f91a27e46bdb24'
            },

            'googledrive': {
                'apiKey': '282923532784-t89r45pvo4nuo49l6clpfa6b8mkkgnnu.apps.googleusercontent.com',
                'apiSecret': 'uErA1R7L4BAxZdgKW20VcqpE',
                'callbackUrl': 'http://localhost:8080/callback.html'
            },

            'onedrive' : {
                
            },

            'sharepoint' : {

            }
    }
    
    
    var limits_config = {
        enable: true,
        file_uploads:true,
        post_max_size:2000000
    }

/////////////////////////////////////////////////
// SERVER INIT //////////////////////////////////
/////////////////////////////////////////////////
    
app.use(allowCrossDomain);
app.use(connect.cookieParser());
app.use(connect.session({ secret: organizationSecret }));
app.use(limits(limits_config));


/////////////////////////////////////////////////
// ROUTER FOR API ///////////////////////////////
/////////////////////////////////////////////////

    /////////////////////////////////////////////////////////
    // Define port for Node.js ajax requests & HTTP Server //
    /////////////////////////////////////////////////////////

    var restPort = process.env.port || 8888;
    var httpPort = 8080;

    /////////////////////////////////////////////////////////////
    // Catch all requests and route to Cloud Elements API V2   //
    //                                                         //
    //  Note: In this method, we are extracting the URL from   //
    //        the client reqiuest, and transforming it to the  //
    //        correct Cloud Elements API.                      //
    //                                                         //
    //        We are using app.all to catch *ANY* request      //
    //        and letting the Cloud Elements REST API          //
    //        handle any errors/incorrect URLs.                //
    /////////////////////////////////////////////////////////////

    app.all('*', function(req, res) {

        if ( typeof String.prototype.startsWith != 'function' ) {
            String.prototype.startsWith = function( str ) {
                return this.substring( 0, str.length ) === str;
            }
        };

        var path = req.url;
        var parts = url.parse(req.url, true);
        var ele = parts.query['element'];

        /////////////////////////////////////////////////////////////////
        // This request is for displaying the required providers on UI //
        /////////////////////////////////////////////////////////////////

        if(parts.pathname == '/elements/providers') {

            //Constructing the documents to be shown on UI
            var respdocuments = new Object;

            for(var x in documents)
            {
                respdocuments[x] = new Object;
                if(documents[x].elementToken != null)
                {
                    respdocuments[x].present = true;
                }
            }
            res.json(respdocuments);
        }

        //////////////////////////////////////////////////////////////////////////
        // This method is used for getting the file contents (folders or files) //
        //////////////////////////////////////////////////////////////////////////

        else if(parts.pathname == '/elements/contents') {

            var params = {
                'path' : parts.query['path']
            }

            callAPI('Get', '/elements/api-v2/hubs/documents/folders/contents', getHeaders(ele), params, function(data) {
                console.log('CFB: Retrieved Listing for', ele);
                res.json(data);
            });
        }

        //////////////////////////////////////////////////////////////////
        //This method is used for getting the download links for a file //
        //////////////////////////////////////////////////////////////////

        else if(parts.pathname == '/elements/links') {

            var params = {
                'path' : parts.query['path']
            }

            callAPI('Get', '/elements/api-v2/hubs/documents/files/links', getHeaders(ele), params, function(data) {
                console.log('CFB: Retrieved download links', ele);
                res.json(data);
            });
        }

        /////////////////////////////////////////////////////////////////////////////
        // This method is for getting the OAuth URL for requesting the User access //
        /////////////////////////////////////////////////////////////////////////////

        else if(parts.pathname == '/elements/oauth') {

            var elementDetails = getElementDetails(ele);
            var params = {
                'elementKeyOrId': ele,
                'apiKey' : elementDetails.apiKey,
                'apiSecret': elementDetails.apiSecret,
                'callbackUrl': elementDetails.callbackUrl
            } 

            callAPI('Get', '/elements/api-v2/elements/'+ele+'/oauth', getHeaders(ele), params, function(data) {
                res.json(data);
            });
        }
        /////////////////////////////////////////////////////////////////////////////////////////////
        // This method is for creating the element instance after the user has approved the access //
        /////////////////////////////////////////////////////////////////////////////////////////////

        else if(parts.pathname == '/elements/instances') {

            var elementDetails = getElementDetails(ele);
            var elementProvision = {
                'configs': [
                    {
                        'key' : 'oauth.api.key',
                        propertyValue : elementDetails.apiKey
                    },
                    {
                        'key' : 'oauth.api.secret',
                        propertyValue : elementDetails.apiSecret
                    },
                    {
                        'key' : 'oauth.callback.url',
                        propertyValue : elementDetails.callbackUrl
                    }
                ],
                'element': {
                    "key" : ele
                },
                'name': ele
            };
            var postdata = JSON.stringify(elementProvision);
            var params = {
                'code': parts.query['code']
            }

            callAPI('POST', '/elements/api-v2/instances', getHeaders(ele, postdata), params, function(data) {

                console.log('CFB: Retrieved Instances: ', data);

                setElementToken(ele, data.token);
                res.json(data);
            },
            postdata);
        }

        /////////////////////////////////////////
        // This method is for Uploading a file //
        /////////////////////////////////////////

        else if(parts.pathname == '/elements/upload') {
            uploadFile('/elements/api-v2/hubs/documents/files', ele, req, function(data) {
                console.log(data);
                res.json(data);

            });
        }
        else {
            callAPI('Get', req.url, req.headers, ele, function(data) {
                console.log('callback recieved', req.session);
                console.log(req);
                res.json(data);
            });
        }
    });


//////////////////////
// INIT REST Server //
//////////////////////

    app.listen(restPort, function() {
        console.log(' ');
        console.log('*****************************************');
        console.log('***** Cloud File Browser - 0.8 BETA *****');
        console.log('*****     http://filebrowser.io     *****');
        console.log('*****************************************');
        console.log('** REST Server started on port: ', restPort, ' **');
    });


/////////////////////////////////////////////////
// AJAX METHODS & HELPERS ///////////////////////
/////////////////////////////////////////////////

getHeaders = function(element, postdata) {
    
    var authVal = '';

    if(element != null && this.getElementToken(element) != null) {
        authVal +=  'Element ' + this.getElementToken(element)+ ', ';
    }

    authVal += 'User ' + userSecret + ', Organization ' +organizationSecret

    var header = {
        'Authorization' : authVal
    };

    if(postdata != null)
    {
        header['Content-Length']= postdata.length;
        header['Content-Type'] = 'application/json';
    }

    return header;
},

getElementToken = function(element) {
    return documents[element].elementToken;
},

setElementToken = function(element, token) {
    documents[element].elementToken = token;
},

getElementDetails = function(element) {
    return documents[element];
},

callAPI = function(method, path, headers, params, cb, jsondata) {

    var json = '';
    
    if(params != null) {
        path +='?'+qs.stringify(params);
    }

    var options = {
        hostname: 'qa.cloud-elements.com',
        port: 443,
        path: path,
        method: method,
        headers : headers
    };

    var req = https.request(options, function(res) {

        res.setEncoding('utf8');
        res.on('data', function (data) {            
            json += data;
        });
        res.on('end', function (data) {
            try {
                cb(JSON.parse(json));
            }
            catch(e) {
                console.log('error: ', e);
            }
        });
    });

    req.on('error', function(e) {
        console.log('problem with request: ' + e);
    });

    //For POST requests
    if(jsondata != null)
    {
        req.write(jsondata);
    }

    req.end();
    
},
    
uploadFile = function(path, ele, req, cb) {
        
    var headers = getHeaders(ele);
    var uploadParams = url.parse(req.url).search;

    headers['content-type'] = req.headers['content-type']
    headers['content-length'] = req.headers['content-length']

    console.log('out headers: ', headers);
    console.log('out uploadParams: ', uploadParams);

    var options = {
        hostname: 'qa.cloud-elements.com',
        port: 443,
        path: '/elements/api-v2/hubs/documents/files' + uploadParams ,
        method: 'POST',
        headers : headers
    };

    var reqOut = https.request(options, function(res) {

        var jsonData = '';

        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            //console.log('CFB: Data Recieved: ', chunk);
            jsonData += chunk;
        });
        res.on('error', function (err) {
            console.log('CFB: Outgoing Error', err);
        });
        res.on('end', function() {
            //console.log("CFB: End of Response");
            try {
                cb(JSON.parse(jsonData));
            }
            catch(e) {
                console.error('invalid filetype');
            }
        });
    });

    req.on('data', function(chunk) {
        //console.log('chunk to string: ', chunk.toString());
        reqOut.write(chunk.toString());
    });

    req.on('end', function() {
        reqOut.end();
    });

    reqOut.on('error', function(e) {
        console.log('CFB: problem with request: ' + e);
    });
}

/////////////////////////////////////////////////
// SERVER START /////////////////////////////////
/////////////////////////////////////////////////

connect().use(serveStatic('www')).listen(httpPort, function() {
    console.log('** HTTP Server started on port: ', httpPort, ' **');
    console.log('*****************************************');
});