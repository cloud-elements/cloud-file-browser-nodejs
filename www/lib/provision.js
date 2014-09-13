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

var CloudElements = (function() {

    var cedocumentconfig = null, envUrl=null,
        ceconfig =null, notif = null, callback=null,
        servicemapping = {
            'box' : 'Box',
            'dropbox': 'Dropbox',
            'googledrive': 'Google Drive',
            'onedrive': 'OneDrive',
            'sharepoint': 'SharePoint'
        };

    return {
        getConfig: function() {
            return cedocumentconfig;
        },

        getEnvUrl: function() {
            return envUrl;
        },

        setNotification: function(response, action) {

            if(callback != null || callback != undefined) {
                callback(action, response);
            }

            if(notif == null || notif == undefined) {
                notif = new Array();
            }

            notif.push(response);
        },

        getNotification: function() {
            return notif;
        },

        init: function(config) {

            if(config.env == null || config.env == undefined) {
                envUrl = 'https://node.filebrowser.io/elements/'
            }
            else {
                envUrl = config.env;
            }

            server.providers(CloudElements.initCallback);

            callback = config.callback;

            //TODO
            ceconfig = config;
        },

        initCallback: function(data, cbArgs) {

            var docservices = [];
            var docservicesnames = [];
            var docservicesimages = [];

            cedocumentconfig = data;
            
            for(var x in data)
            {
                docservices.push(x);
                docservicesnames.push(data[x].name);
                docservicesimages.push(data[x].image);
            }

            cloudFileBrowser.init(docservices, docservicesnames, docservicesimages);
        },

        updateCallback: function(pagequery) {

            provision.processNextOnCallback(pagequery);
        }
    };
})();

var provision = (function() {

    var lastCallbackArgs = null;
    _provision = {
        isTokenPresentForElement: function(element) {
            
            var eleObj = CloudElements.getConfig()[element];
            return eleObj.present;

        },

        getElementDetails: function(element) {
            
            var eleObj = CloudElements.getConfig()[element];
            return eleObj;
        },

        setTokenToElement: function(element, token) {
            
            var eleObj = CloudElements.getConfig()[element];
            eleObj['present'] = true;

            var response = {
                'element': element,
                'elementToken': token,
                'action' : 'create'
            };

            CloudElements.setNotification(response, 'create');
        },

        getParamsFromURI: function(queryparams) {
            
            var uri = decodeURI(queryparams);
            var chunks = uri.split('&');
            var params = Object();

            for (var i=0; i < chunks.length ; i++) {
                
                var chunk = chunks[i].split('=');
                
                if(chunk[0].search("\\[\\]") !== -1) {
                    if( typeof params[chunk[0]] === 'undefined' ) {
                        params[chunk[0]] = [chunk[1]];
                    } 
                    else {
                        params[chunk[0]].push(chunk[1]);
                    }
                } 
                else {
                    params[chunk[0]] = chunk[1];
                }
            }

            return params;
        }
    };

    return {

        getDocuments: function(element, path, cb, cbArgs) {
            server.list(element, path, cb, cbArgs);
        },

        createInstance: function(element, cb, cbArgs) {

            //Step 1 : Check if the element token is present, if so list the documents
            if(_provision.isTokenPresentForElement(element)) {
                cb(element, cbArgs);
                return;
            }

            //Step 2 : Check if API Key and Secret Exists, create an instance using those keys
            var win = window.open('', '_target');
            var callbackArgs = {
                'cbFun' : cb,
                'cbArgs': cbArgs,
                'element': element,
                'win' : win
            }

            server.getOAuthUrlOnAPIKey(element, provision.handleOnGetOAuthUrl, callbackArgs);

            return;
        },

        handleOnGetOAuthUrl: function(data, cbArgs) {
            lastCallbackArgs = cbArgs;
            cbArgs.win.location.href = data.oauthUrl;
        },

        processNextOnCallback: function(queryparams) {

            var pageParameters = _provision.getParamsFromURI(queryparams);
            var not_approved= pageParameters.not_approved;

            if(not_approved) {
                // TODO Show that not approved
                return;
            }

            var ele = lastCallbackArgs.element;

            var cbArgs = {
                'element' : ele,
                'cbFun'   : lastCallbackArgs.cbFun,
                'cbArgs'  : lastCallbackArgs.cbArgs
            };

            //Provision the element and get elementToken
            //Provision as new
            server.createInstance(ele, pageParameters.code, provision.handleOnCreateInstanceCall, cbArgs);
        },

        handleOnCreateInstanceCall: function(data, cbArgs) {

            _provision.setTokenToElement(cbArgs.element, data.token);

            cbArgs.cbFun(cbArgs.cbArgs.element, cbArgs.cbArgs);
        },

        fileSelected: function(element, filepath) {

            var response = {
                'element': element,
                'selectedFile': filepath,
                'action' : 'select'
            };

            CloudElements.setNotification(response, 'select');

        },

        downloadFile: function(element, filepath) {
            server.downloadFile(element, filepath);
        },

        displayFile: function(element, filepath, cb, cbArgs) {
            server.displayThumbnail(element, filepath, cb, cbArgs);
        },

        testThumbnail: function(url, cb) {
            server.testThumbnail(url, cb);
        },

        uploadFile: function(element, filepath, fileData, cb, cbArgs) {
            server.uploadFile(element, filepath, fileData, cb, cbArgs);
        }
    };

})();

var server = (function() {

    /**
     * Element Server private object
     * @type {Object}
     */
    _server = {

        call: function(path, methodtype, headers, params, cb, cbArgs) {

            if(server.isNullAndUndef(methodtype))
                methodtype = 'Get';

            var proxy = $.ajax({
                url: server.getUrl(path),
                type: methodtype,
                headers: headers,
                data: params,
                cache: false,
                contentType: 'application/json'
            })
            .done(function(data) {
                console.log(data);
                if(server.isNullAndUndef(data.results))
                    cb(data, cbArgs);
                else
                    cb(data.results, cbArgs);

            })
            .error(function(data){
                console.log(data.status + ' error on ' + path);
                _server.handleFailure(data, cb, cbArgs);
            });
        },

        callUpload: function(path, methodtype, headers, params, cb, cbArgs) {

            var proxy = $.ajax({
                url: server.getUrl(path),
                type: methodtype,
                headers: headers,
                data: params,
                cache: false,
                processData: false,
                contentType: false
            })
            .done(function(data) {
                console.log(data);
                if(server.isNullAndUndef(data.results))
                    cb(data, cbArgs);
                else
                    cb(data.results, cbArgs);

            })
            .error(function(data){
                console.log(data.status + ' error on ' + path);
                _server.handleFailure(data, cb, cbArgs);
            });
        },

        callThumbnail: function(url, cb) {

            var proxy = $.ajax({
                url: url,
                type: 'Get',
                cache: false
            })
            .done(function(data) {
                console.log(data);
                cb('true');
            })
            .error(function(data) {

                // Temporary catch for X-DOMAIN
                if (data.status === 0) {
                    cb('true');
                }
                else {
                    cb('false');
                    cloudFileBrowser.displayError('Error loading thumbnail!');
                }
            });
        },

        handleFailure: function(response, cb, cbArgs) {
            if (response.status == -1) {
                // This is a timeout, we can't expect an HTTP error code in the status field
                console.error('The server has not responded and ' +
                    'your request has timed out.' +
                    ' Please use your browser\'s refresh ' +
                    'button to try again. (' + response.statusText + ')');

                cloudFileBrowser.displayError(response.statusText);
            }
            else if (response.status == 0) {
                // This is a network error of some kind (connection lost for example) and
                // we can't expect an HTTP error code in the status field
                console.error('A communication error has occurred and ' +
                    'your request cannot be processed.' +
                    ' Please use your browser\'s refresh button ' +
                    'to try again. (' + response.statusText + ')');

                cloudFileBrowser.displayError(response.statusText);
            }
            else {
                if(server.isNullAndUndef(response.responseText)) {
                    cb(response, cbArgs);

                    cloudFileBrowser.displayError(response.statusText);
                }
                else {
                    console.error('The server was unable to process this request. ' +
                        'Please contact your representative. (' +
                        response.status + '/' + response.statusText + ')');

                    cloudFileBrowser.displayError(response.statusText);
                }
            }
        }

    };

    return {

        getUrl: function(additionalParams) {
            return CloudElements.getEnvUrl() + additionalParams;
        },

        isNullAndUndef: function(variable) {
            return (variable == null || variable == undefined);
        },

        providers: function(cb, cbArgs) {
            _server.call('providers', 'Get', null, null, cb, cbArgs);
        },

        list: function(element, path, cb, cbArgs) {

            var params = {
                'path' : path,
                'element': element
            }

            _server.call('contents', 'Get', null, params, cb, cbArgs);
        },

        _downloadCallback: function(data) {
            
            var hiddenIFrameID = 'hiddenDownloader',
                iframe = document.getElementById(hiddenIFrameID);
            if (iframe === null) {
                iframe = document.createElement('iframe');
                iframe.id = hiddenIFrameID;
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
            }
            iframe.src = data.cloudElementsLink;
        },

        downloadFile: function(element, path, cb, cbArgs) {

            var params = {
                'path' : path,
                'element': element
            }

            _server.call('links', 'Get',
                null, params, this._downloadCallback, cbArgs);
        },

        displayThumbnail: function(element, path, cb, cbArgs) {

            var params = {
                'path' : path,
                'element': element
            }

            _server.call('links', 'Get', null, params, cb, cbArgs);
        },

        testThumbnail: function(url, cb) {
            _server.callThumbnail(url, cb);
        },

        uploadFile: function(element, path, file, cb, cbArgs) {

            var params = new FormData();
            
            params.append('file', file);

            var callbackArgs = {
                'cb': cb,
                'cbArgs': cbArgs
            };

            _server.callUpload('upload?element='+element+'&path='+path+ '/' + file.name, 'POST', null, params, this._uploadCallback, callbackArgs);
        },

        _uploadCallback: function(data, callbackArgs) {
            console.log(data);

            callbackArgs.cbArgs.data = data;
            callbackArgs.cb(callbackArgs.cbArgs);
        },

        getOAuthUrlOnAPIKey: function(element, cb, cbArgs) {

            var parameters = {
                'element': element
            };

            _server.call('oauth', 'Get', null, parameters, cb, cbArgs);
        },

        createInstance: function(element, code, cb, cbArgs) {

            var parameters = {
                'element': element,
                'code': code
            };

            _server.call('instances', 'Get', null, parameters, cb, cbArgs);
        }

    }
})();