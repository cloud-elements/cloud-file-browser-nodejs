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

var moment = require("moment");

var CloudElements = (function() {
    'use strict';
    var cedocumentconfig = null, oSec = null,
        uSec = null, aKey = null, envUrl=null,
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

        getOTkn: function() {
            return oSec;
        },

        getUTkn: function() {
            return uSec;
        },

        getAkey: function() {
            return uSec;
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

        validateToken: function(element) {

            var deferred = $.Deferred();

            provision.getDocuments(element, '/', function(response, args) {
                if (response.status == 401) {
                    delete cedocumentconfig[element].elementToken;
                }
                deferred.resolve();
            });

            return deferred;
        },

        init: function(config) {

            cedocumentconfig = config.documents;
            oSec = config.oSec;
            uSec = config.uSec;
            aKey = config.aKey;
            callback = config.callback;
            ceconfig = config;

            if(config.env == null || config.env == undefined) {
                envUrl = 'https://api.cloud-elements.com/elements/'
            }
            else {
                envUrl = config.env;
            }

            server.providers(CloudElements.initCallback);
        },

        initCallback: function(data, cbArgs) {

            var docservices = [];
            var docservicesnames = [];
            var docservicesimages = [];

            for (var x in data) {
                var elementKey = data[x].key;
                if (cedocumentconfig[elementKey] != null) {
                    docservices.push(elementKey);
                    docservicesnames.push(data[x].name);
                    docservicesimages.push(envUrl+'images/'+data[x].image);
                }
            }

            cloudFileBrowser.init(docservices, docservicesnames, docservicesimages);
        },

        updateCallback: function(pagequery) {
            provision.processNextOnCallback(pagequery);
        }
    };
})();

var provision = (function() {
    'use strict';

     var lastCallbackArgs = null;

     var _provision = {
        getTokenForElement: function(element) {
            var eleObj = CloudElements.getConfig()[element];
            return eleObj['elementToken'];
        },

        getElementDetails: function(element) {
            var eleObj = CloudElements.getConfig()[element];
            return eleObj;
        },

        setTokenToElement: function(element, token) {

            var eleObj = CloudElements.getConfig()[element];
            eleObj['elementToken'] = token;

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

                    } else {
                        params[chunk[0]].push(chunk[1]);
                    }


                } else {
                    params[chunk[0]] = chunk[1];
                }
            }

            return params;
        }
    };

    return {

        isAuthorized: function(element) {
            var eleTkn = _provision.getTokenForElement(element);
            return eleTkn != null;
        },

        getDocuments: function(element, path, cb, cbArgs) {
            server.list(_provision.getTokenForElement(element), path, cb, cbArgs);
        },

        searchDocuments: function(element, path, keyword, cb, cbArgs) {
            server.search(_provision.getTokenForElement(element), path, keyword, cb, cbArgs);
        },

        createInstance: function(element, cb, cbArgs) {

            //Step 1 : Check if the element token is present, if so list the documents
            var eleTkn = _provision.getTokenForElement(element);
            if(eleTkn != null) {
                cb(eleTkn, cbArgs);
                return;
            }

            //Step 2 : Check if API Key and Secret Exists, create an instance using those keys
            var elementDetails = _provision.getElementDetails(element);
            if(elementDetails != null && elementDetails != undefined) {

                var win = window.open('', '_target');

                var callbackArgs = {
                    'cbFun' : cb,
                    'cbArgs': cbArgs,
                    'element': element,
                    'win' : win,
                    'elementDetails': elementDetails
                }

                server.getOAuthUrlOnAPIKey(element, elementDetails.apiKey, elementDetails.apiSecret,
                    elementDetails.callbackUrl, provision.handleOnGetOAuthUrl, callbackArgs);

                return;
            }
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
            var elementDetails = lastCallbackArgs.elementDetails;
            //Provision as new
            server.createInstance(ele, pageParameters.code, elementDetails.apiKey,
                elementDetails.apiSecret, elementDetails.callbackUrl, provision.handleOnCreateInstanceCall, cbArgs);
        },

        handleOnCreateInstanceCall: function(data, cbArgs) {

            _provision.setTokenToElement(cbArgs.element, data.token);

            //server.list(data.token, '/', cbArgs.cbFun, cbArgs.cbArgs);
            cbArgs.cbFun(cbArgs.element, cbArgs.cbArgs);
        },

        fileSelected: function(element, filepath, fileId) {

            var response = {
                'element': element,
                'elementToken': _provision.getTokenForElement(element),
                'selectedFile': filepath,
                'action' : 'select',
                'fileId': fileId
            };

            CloudElements.setNotification(response, 'select');
        },

        getFile: function(tkn, path, cb, cbArgs) {
            server.getFile(tkn, path, cb, cbArgs);
        },

        downloadFile: function(element, filepath) {
            server.downloadFile(_provision.getTokenForElement(element), filepath);
        },

        displayFile: function(element, filepath, cb, cbArgs) {
            server.displayThumbnail(_provision.getTokenForElement(element), filepath, cb, cbArgs);
        },

        getLinks: function(tkn, filepath, cb, cbArgs) {
            server.getLinks(tkn, filepath, cb, cbArgs);
        },

        getLinkById: function(data, cb, cbArgs) {
            server.getLinkById(data, cb, cbArgs);
        },

        getMetadata: function(tkn, filepath, cb, cbArgs) {
            server.getMetadata(tkn, filepath, cb, cbArgs);
        },

        getMetadataById: function(data, cb, cbArgs) {
            server.getMetadataById(data, cb, cbArgs);
        },

        testThumbnail: function(url, cb) {
            server.testThumbnail(url, cb);
        },

        uploadFile: function(element, filepath, fileData, cb, cbArgs) {
            server.uploadFile(_provision.getTokenForElement(element), filepath, fileData, cb, cbArgs);
        }
    };

})();

var server = (function() {

    /**
     * Element Server private object
     * @type {Object}
     */
    _server = {

        //TODO Handle for IE CROS http://www.html5rocks.com/en/tutorials/cors/

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
                if(server.isNullAndUndef(data.results))
                    cb(data, cbArgs);
                else
                    cb(data.results, cbArgs);

            })
            .fail(function(data){
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
                //contentType: 'multipart/form-data; boundary=----WebKitFormBoundarymSI41Af84OjbuPgt'
            })
                .done(function(data) {
                    if(server.isNullAndUndef(data.results))
                        cb(data, cbArgs);
                    else
                        cb(data.results, cbArgs);

                })
                .fail(function(data){
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
                    cb('true');
                })
                .fail(function(data) {

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

        handleFailure: function(response, cb, cbArgs)
        {
            // status 0: this is a timeout.
            // status -1: this is a network error of some kind (connection lost for example)
            if (response.status >= 400 && response.status != 401 || response.status <= 0) {
                cloudFileBrowser.displayError(response.statusText);
            } else if (server.isNullAndUndef(response.responseText)) {
                cloudFileBrowser.displayError(response.statusText);
            } else {
                cb(response, cbArgs);
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

        authHeader: function(uSec, oSec, eleTkn) {

            var aHeader='';

            if(!this.isNullAndUndef(uSec)) {
                aHeader += 'User '+uSec;
            }

            if(!this.isNullAndUndef(oSec)) {
                aHeader += ', Organization '+oSec;
            }

            if(!this.isNullAndUndef(eleTkn)) {

                if(aHeader.length > 0) {
                    aHeader += ', Element '+eleTkn;
                }
                else {
                    aHeader += 'Element '+eleTkn;
                }
            }

            return {
                "Authorization" : aHeader
            };
        },

        providers: function(cb, cbArgs) {

            _server.call('api-v2/hubs/documents/elements', 'Get',
                this.authHeader(CloudElements.getUTkn(), CloudElements.getOTkn(), null), null, cb, cbArgs);
        },

        list: function(tkn, path, cb, cbArgs) {
            var params = {
                'path' : path,
                'orderBy' : 'modifiedDate desc'
            }

            _server.call('api-v2/hubs/documents/folders/contents', 'Get',
                this.authHeader(CloudElements.getUTkn(), CloudElements.getOTkn(), tkn), params, cb, cbArgs);
        },

        search: function(tkn, path, keyword, cb, cbArgs) {
            var params = {
                'path': path,
                'text': keyword,
            }

            _server.call('api-v2/hubs/documents/search', 'Get',
                this.authHeader(CloudElements.getUTkn(), CloudElements.getOTkn(), tkn), params, cb, cbArgs);
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

        getFile: function(tkn, path, cb, cbArgs) {
            var params = {
                'path' : path
            }

            _server.call('api-v2/hubs/documents/files', 'Get',
                this.authHeader(CloudElements.getUTkn(), CloudElements.getOTkn(), tkn), params, cb, cbArgs);
        },

        downloadFile: function(tkn, path, cb, cbArgs) {
            var params = {
                'path' : path
            }

            _server.call('api-v2/hubs/documents/files/links', 'Get',
                this.authHeader(CloudElements.getUTkn(), CloudElements.getOTkn(), tkn), params, this._downloadCallback, cbArgs);
        },

        displayThumbnail: function(tkn, path, cb, cbArgs) {

            var params = {
                'path' : path
            }

            _server.call('api-v2/hubs/documents/files/links', 'Get',
                this.authHeader(CloudElements.getUTkn(), CloudElements.getOTkn(), tkn), params, cb, cbArgs);
        },

        getMetadata: function(tkn, path, cb, cbArgs) {
            var params = {
                'path' : path
            }

            _server.call('api-v2/hubs/documents/files/metadata', 'Get',
                this.authHeader(CloudElements.getUTkn(), CloudElements.getOTkn(), tkn), params, cb, cbArgs);
        },

        getMetadataById: function(data, cb, cbArgs) {
            _server.call('api-v2/hubs/documents/files/' + data.fileId + '/metadata', 'Get',
                this.authHeader(CloudElements.getUTkn(), CloudElements.getOTkn(), data.token), {}, cb, cbArgs);

        },

        getLinks: function(tkn, path, cb, cbArgs) {
            var params = {
                'path': path,
                'raw': true
            }

            _server.call('api-v2/hubs/documents/files/links', 'Get',
                this.authHeader(CloudElements.getUTkn(), CloudElements.getOTkn(), tkn), params, cb, cbArgs);
        },

        getLinkById: function(data, cb, cbArgs) {
            var params = {
                'raw': true
            }

            _server.call('api-v2/hubs/documents/files/' + data.fileId + '/links', 'Get',
                this.authHeader(CloudElements.getUTkn(), CloudElements.getOTkn(), data.token), params, cb, cbArgs);
        },

        testThumbnail: function(url, cb) {
            _server.callThumbnail(url, cb);
        },

        uploadFile: function(tkn, path, file, cb, cbArgs) {

            var params = new FormData();
            params.append('file', file);

            var callbackArgs = {
                'cb': cb,
                'cbArgs': cbArgs
            };

            _server.callUpload('api-v2/hubs/documents/files?path='+path+'/'+file.name, 'POST',
                this.authHeader(CloudElements.getUTkn(), CloudElements.getOTkn(), tkn), params, this._uploadCallback, callbackArgs);
        },

        _uploadCallback: function(data, callbackArgs) {

            callbackArgs.cbArgs.data = data;
            callbackArgs.cb(callbackArgs.cbArgs);
        },

        getOAuthUrlOnAPIKey: function(element, apiKey, apiSec, callbackUrl, cb, cbArgs) {

            var parameters = {
                'elementKeyOrId': element,
                'apiKey' : apiKey,
                'apiSecret': apiSec,
                'callbackUrl': callbackUrl
            };



            _server.call('api-v2/elements/'+element+'/oauth/url', 'Get',
                this.authHeader(CloudElements.getUTkn(), CloudElements.getOTkn(), null), parameters, cb, cbArgs);
        },

        createInstance: function(element, code, apiKey, apiSec, callbackUrl, cb, cbArgs) {

            var elementProvision = {
                'configuration': {
                    'oauth.api.key' : apiKey,
                    'oauth.api.secret' : apiSec,
                    'oauth.callback.url': callbackUrl
                },
                'providerData': {
                    'code': code
                },
                'element': {
                    "key" : element
                },
                'name': element
            };

            _server.call('api-v2/instances', 'POST',
                this.authHeader(CloudElements.getUTkn(), CloudElements.getOTkn(), null), JSON.stringify(elementProvision), cb, cbArgs);
        }

    }
})();


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

////////////////////////////////////
// JQUERY WRAPPER FOR EASY PARAMS //
////////////////////////////////////

(function($) {
    'use strict';
    var exports = module.exports = {};
    $.fn.cloudFileBrowser = function(options) {
        cloudFileBrowser.buildDomEls(this, function() {
             CloudElements.init(options);
        });
    };
    exports.provision = provision;
    exports.CloudElements = CloudElements;
    return module.exports;
}(jQuery))

var cloudFileBrowser = (function() {
    'use strict';

    // PRIVATE VARIABLES
    var services = null,
        servicesDisplay = null,
        servicesImages = null,
        tabs = '#services-tabs',
        container = '#services-containers',
        selectedFiles = {},
        extension = '';

    return {

        init: function(srvs, srvsDis, srvsImages) {

            // Initialize FilePicker script and build DOM elements
            // and setup binding methods
            services = srvs;
            servicesDisplay = srvsDis;
            servicesImages = srvsImages;

            cloudFileBrowser.selectedFiles = {};

            this.buildTabs();
            this.bindTabs();
            this.bindProvisionButtons();
            this.initDragDropHandlers();

            var firstElement = services[0];

            // This is a loop that runs validateToken over all of the
            // different CloudElements and deletes bad tokens
            var deferreds = [];

            for (var index in services) {
                var check = CloudElements.validateToken(services[index]);
                deferreds.push(check);
            }

            $.when.apply($, deferreds).done(function() {
                //Initialize the first CloudElement
                cloudFileBrowser.initElement(firstElement);
            });

        },

        showLoading: function() {
            $('#loading').addClass('show');
            $('#services-tabs').addClass('disable-element');
            $('.listTable div').addClass('disable-element');
        },

        hideLoading: function() {
            $('#loading').removeClass('show');
            $('#services-tabs').removeClass('disable-element');
            $('.listTable div').removeClass('disable-element');
        },

        initDragDropHandlers: function() {

            if (window.File) {

                $('.drop-zone').on('dragover', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                });

                $('.drop-zone').on('dragenter', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                });

            }
        },

        escapeApostrophe: function(keyword) {
            return keyword.replace('\'','\\\'');
        },

        performSearch: function(keyword, element, path) {
            var callbackArgs = {
                'element' : element,
                'path' : '/'
            };

            cloudFileBrowser.showLoading();

            // when there are no keywords or if its undefined
            // the default operation would be to display the documents
            // inside the root path
            // In most cases, when searching is not performed keyword is undefined.
            // The user might be able to press enter and search for a blank keyword for ex: ''
            // For that we still display the documents inside root path

            if(keyword === undefined || keyword === '') {
                provision.getDocuments(element, '/', function(data, cbArgs) {
                    cloudFileBrowser.drawEl(data, cbArgs.element, cbArgs.path, keyword);
                }, callbackArgs);
            } else {
                var escapedKeyword = this.escapeApostrophe(keyword);
                provision.searchDocuments(element, path, escapedKeyword, function(data, cbArgs) {
                    cloudFileBrowser.drawEl(data, cbArgs.element, cbArgs.path, keyword);
                }, callbackArgs);
            }
        },

        disableSearchOpen: function() {
            $('#js-search-open').disabled = true;
            $('#js-search-open').css('cursor', 'default');
        },

        enableSearchOpen: function () {
            $('#js-search-open').disabled = false;
            $('#js-search-open').css('cursor', 'pointer');
        },

        bindSearchBox: function(element, path) {
            var self = this;
            $('#js-search-open').on('click', function() {
                $('#js-search-box-form-wrapper').show();
                self.disableSearchOpen();
            });

            $('#js-search-box').on('keypress', function(event) {
                // 13 is keyCode for enter
                if(event.keyCode === 13) {
                    var keyword = $(this).val();
                    self.performSearch(keyword, element, path);
                }
            });

            $('#js-search-close').on('click', function() {
                $('#js-search-box-form-wrapper').hide();
                $('#js-search-box').val('');
                self.enableSearchOpen();
            });
        },

        buildDomEls: function(selector, cb) {

            var HTML = '<section id="tab-container"><ul id="services-tabs"></ul><section id="services-containers"></section></section><section id="loading"><span><i></i></span></section><section id="error"></section>';
            $(selector).append(HTML);
            cb();
        },

        buildTabs: function() {
            // Inspect services object, and build a tab + trigger
            // for each service installed

            var tabsHTML = '',
                containerHTML = '';

            for (var i=0; i<services.length; i++) {
                tabsHTML += '<li class="' + services[i] + (i == 0 ? ' on' : '' )+ '"><img src="' + servicesImages[i] + '">' + servicesDisplay[i] + '</li>';
                containerHTML +=    '<div class="' + services[i] + (i == 0 ? ' on' : '' ) + ' drop-zone" aria-element="' + services[i] + '">'+
                                    '<h2></h2>' +
                                    '<h2><img src="' + servicesImages[i] + '"></h2>' +
                                    '<a href="#" class="provision" aria-element="' + services[i] + '">Connect to your ' + servicesDisplay[i] + ' account</a>' +
                                    '</div>';
            }

            $(tabs).append(tabsHTML);
            $(container).append(containerHTML);
        },

        initElement: function(element) {
            var callbackArgs = {
                'element' : element
            };

            if (provision.isAuthorized(element)) {
                cloudFileBrowser.showLoading();
                provision.createInstance(element, cloudFileBrowser.handleOnProvision, callbackArgs);
            }
        },

        bindTabs: function() {

            // Set the bind method for tab switches

            $(tabs + ' li').on('click', function (event) {
                event.preventDefault();
                event.stopPropagation();

                var index = $(this).index();

                $('div.on, li.on').removeClass('on');
                $(this).addClass('on');
                $(container + ' > div').eq(index).addClass('on');

                cloudFileBrowser.initElement(services[index]);

            });
        },

        bindProvisionButtons: function() {

            $('.provision').on('click', function(event) {
                event.preventDefault();
                event.stopPropagation();

                var element = $(this).attr('aria-element');

                cloudFileBrowser.provisionEl(element);
            });

        },

        bindBreadCrumbClick: function(element) {

            //Onclick of breadcrumb, fetch the files under breadcrumb folder
            $('.breadcrumb ul li.home').on('click', function (event) {
                event.preventDefault();
                event.stopPropagation();


                $('.addFiles, .addFilesButton, .selectFilesButton').remove();

                cloudFileBrowser.showLoading();

                var callbackArgs = {
                    'element' : element,
                    'path' : '/'
                };

                provision.getDocuments(element, '/', function(data, cbArgs) {
                    cloudFileBrowser.drawEl(data, cbArgs.element, cbArgs.path);
                }, callbackArgs);
            });

            $('.breadcrumb ul li.selectedPath').on('click', function (event) {
                event.preventDefault();
                event.stopPropagation();

                var pathResourse = this.getAttribute('name');

                cloudFileBrowser.showLoading();

                var callbackArgs = {
                    'element' : element,
                    'path' : pathResourse
                };

                provision.getDocuments(element, pathResourse, function(data, cbArgs) {
                    cloudFileBrowser.drawEl(data, cbArgs.element, cbArgs.path);
                }, callbackArgs);
            });
        },

        bindFileInfo: function(element) {

            //Onclick of folder, fetch the files under folder
            $('.listTable ul li.foldername').one('click', function (event) {
                event.preventDefault();
                event.stopPropagation();

                $('.addFiles, .addFilesButton, .selectFilesButton').remove();

                 cloudFileBrowser.showLoading();

                var location = $(this).next().text();

                var callbackArgs = {
                    'element' : element,
                    'path' : location
                };

                provision.getDocuments(element, location, function(data, cbArgs) {
                    cloudFileBrowser.drawEl(data, cbArgs.element, cbArgs.path);
                }, callbackArgs);
            });

            $('.listTable ul li.filename').on('dblclick', function (event) {
                event.preventDefault();
                event.stopPropagation();

                var location = $(this).next().text();
                var fileId = $(this).closest('ul').data('file-id');

                provision.fileSelected(element, location, fileId);
            });

            $('.listTable ul li.checkbox').on('change', function() {
                var selectedPath = this.nextSibling.nextSibling.textContent;
                if(cloudFileBrowser.selectedFiles[element] == null
                    || cloudFileBrowser.selectedFiles[element] == undefined)
                {
                    cloudFileBrowser.selectedFiles[element] = new Array();
                }

                var position = $.inArray(selectedPath, cloudFileBrowser.selectedFiles[element]);
                if(~position)
                {
                    cloudFileBrowser.selectedFiles[element].splice(position, 1);
                }
                else
                {
                    cloudFileBrowser.selectedFiles[element].push(selectedPath);
                }
            });
        },

        provisionEl: function(element) {

            // Provision the element based upon its service array name
            // Note -- Demo only, always returns successful

            cloudFileBrowser.showLoading();

            var callbackArgs = {
                'element' : element
            };
            provision.createInstance(element, cloudFileBrowser.handleOnProvision, callbackArgs);
        },

        handleOnProvision: function(elementToken, cbArgs) {

            var element = cbArgs.element;

            var callbackArgs = {
                'element' : element,
                'path' : '/'
            };

            provision.getDocuments(element, '/', function(data, cbArgs) {
                cloudFileBrowser.drawEl(data, cbArgs.element, cbArgs.path);
            }, callbackArgs);
        },

        drawEl: function(data, element, path, keyword) {
            // Clean up load screen
            cloudFileBrowser.hideLoading();


            $('div.' + element + ' .listTable, div.' + element + ' .breadcrumb').remove();

            // remove search wrapper
            $('.search-wrapper').remove();

            // Call for table from helper class
            var tableHTML = this.buildTable(data, true, path, element);

            // Append data returned and start screen adjustment via CSS3 class
            $(container + ' .' + element).addClass('provisioned').append(tableHTML);

            if(keyword !== '' && keyword !== undefined) {
                this.disableSearchOpen();
                $("#js-search-box-form-wrapper").show();
                $('#js-search-box').val(keyword);
            }            

            this.animateTable(element);
            this.bindFileDragDrop(element, path);
            this.bindAddFiles(element, path);
            this.bindBreadCrumbClick(element);
            this.bindFileInfo(element);
            this.bindSearchBox(element, path);
        },

        buildTable: function(data, isNew, path, element) {
            if (isNew == true) {

                var tableHTML = '',
                    trailingpath;

                cloudFileBrowser.selectedFiles[element] = new Array();

                tableHTML += '<div class="search-wrapper">' +
                                '<button id="js-search-open" class="search-open"><i class="fa fa-search fa-flip-horizontal" aria-hidden="true"></i></button>' +
                                '<span class="search-box-form-wrapper" id="js-search-box-form-wrapper">' +
                                '<input type="text" id="js-search-box" class="search-box" placeholder="Search..."/>' +
                                '<button id="js-search-close" class="search-close"><i class="fa fa-times-circle search-close" aria-hidden="true"></i></button>' +
                                '</span>' +
                                '</div>';

                tableHTML += '<div class="breadcrumb"><ul>';

                if(path != null || path != undefined) {

                    var selectedPathRes = path.split("/");

                    for (var i = 0; i < selectedPathRes.length; i++) {

                        var selectedPathResRec = selectedPathRes[i];

                        if(i == 0 && selectedPathResRec == '') {

                            trailingpath = '/';
                            tableHTML += '<li class="home">Home</li>';
                        }
                        else if(selectedPathResRec != null && selectedPathResRec != '') {

                            if(trailingpath == '/')
                            {
                                trailingpath = trailingpath + selectedPathResRec;
                            }
                            else
                            {
                                trailingpath = trailingpath + '/' + selectedPathResRec;
                            }

                            tableHTML += '<li class="breadcrumb-caret">&gt</li>';
                            tableHTML += '<li class="selectedPath" name="'+trailingpath+'">'+selectedPathResRec +'</li>';
                        }
                    }
                }
                else
                {
                    tableHTML += '<li>/</li>';
                }
                tableHTML += '</ul></div>';


                tableHTML += '<div class="listTable">' +
                                '<ul>' +
                                '<li></li>' +
                                '<li>File</li>' +
                                '<li>Location</li>' +
                                '<li>Modified</li>' +
                                '</ul><div class="scrollPanel">';

                /////////////////////////
                // Loop for table rows //
                /////////////////////////
                for (var i=0; i < data.length; i++) {
                    var objItm = data[i];

                    tableHTML += '<ul draggable="true" data-file-id="' +
                                 objItm.id + '">';
                    if(objItm.directory)
                        tableHTML += '<li class="checkbox"></li>' +
                                     '<li class="foldername">';
                    else
                        tableHTML += '<li class="checkbox"></li>' +
                                     '<li class="filename">';

                    var modifiedDate = moment(objItm.modifiedDate).format('MM/DD/YYYY');

                    tableHTML += objItm.name + '</li>' +
                        '<li>' + objItm.path + '</li>' +
                        '<li>' + modifiedDate + '</li></ul>';
                }
            }
            else {

                var tableHTML = '';

                var currentIndex = $('.listTable ul').length;

                for (var i=0; i < data.length; i++) {
                    tableHTML += '<ul draggable="true" class="loading on '+ data[i].name+'">' +
                                    '<li class="checkbox"><input type="checkbox"></li>' +
                                    '<li class="filename">' + data[i].name + '</li>' +
                                    '<li>Uploading...</li>' +
                                 '</ul>';

                    var cbArgs = {
                        'tableHTML' : tableHTML,
                        'path' : path,
                        'element': element,
                        'currentIndex': currentIndex+i
                    };

                    provision.uploadFile(element, path, data[i], cloudFileBrowser.handleUploadComplete, cbArgs);
                }
            }

            tableHTML += '</div></div>';

            // Finished building, return table string
            return tableHTML;

        },

        handleUploadComplete: function(cbArgs) {

            if($('.listTable ul.loading') != null)
            {
                $('.listTable ul.loading').removeClass('loading');
            }

            var tableList = $('.listTable ul');
            var ulElement = tableList[cbArgs.currentIndex];

            if(cbArgs.data.name == null || cbArgs.data.name == undefined)
            {
                var jsonResp = JSON.parse(cbArgs.data.responseText);
                cloudFileBrowser.displayError(jsonResp.message);
                ulElement.innerHTML = null;
            }
            else if(ulElement != null)
            {
                ulElement.innerHTML = '<li class="checkbox"><input type="checkbox"></li>' +
                    '<li class="fileName">' + cbArgs.data.name + '</li>' +
                    '<li>' + cbArgs.data.path + '</li>' +
                    '<li>' + cbArgs.data.modifiedDate + '</li>';
            }
        },

        animateTable: function(element) {

            var len = $('div.' + element + ' .listTable .scrollPanel ul:not(".on")').length;
            var delay = 100;

            for (var i=0; i < len; i++) {

                $('.' + element + ' .listTable .scrollPanel  ul:not(".on"):eq('+i+')').attr('style', '-webkit-transition-delay: ' + delay + 'ms');
                delay += 50;

            }
            setTimeout(function() {
                $('.' + element + ' .listTable .scrollPanel > ul').addClass('on');
            }, 50);

        },

        bindAddFiles: function(element, path) {

            $('.addFilesButton').unbind('click');
            $('.addFiles').unbind('change');

            $('.addFilesButton').on('click', function() {

                $('.' + element + ' .addFiles').trigger('click');

            });

            $('.addFiles').on('change', function(e) {

                cloudFileBrowser.uploadFiles(element, path, this.files);

            });

            $('.selectFilesButton').on('click', function (event) {
                event.preventDefault();
                event.stopPropagation();

                provision.fileSelected(element, cloudFileBrowser.selectedFiles[element]);
            });

        },

        bindFileDragDrop: function(element, path) {

            $('.drop-zone').unbind('drop');

            $('.drop-zone').on('drop', function(e) {

                var files = e.originalEvent.dataTransfer.files
                var element = $(this).attr('aria-element');

                $(this).removeClass('drop-helper');

                // Prevent default events & propogation

                e.preventDefault();
                e.stopPropagation();

                cloudFileBrowser.uploadFiles(element, path, files);

            });

            $('.drop-zone').on('dragover', function(e) {

                // Check for ONLY files dragged into view,
                // otherwise ignore if an el from the screen

               // if (e.originalEvent.dataTransfer.items.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();

                    $(this).addClass('drop-helper');
               // }

            });

        },

        displayError: function(err) {

            cloudFileBrowser.hideLoading();
            $('#error').html('<span>' + err + '</span>').addClass('show');

            setTimeout(function() {
                $('#error').removeClass('show');
            }, 2500);


        },

        uploadFiles: function(element, path, files) {

            var tableHTML = this.buildTable(files, false, path, element);

            //$('div.' + element + ' .listTable').append(tableHTML);
            $('div.' + element + ' .listTable .scrollPanel').append(tableHTML);
            this.animateTable(element);

        }
    };

})();
