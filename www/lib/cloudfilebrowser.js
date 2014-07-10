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

    $.fn.cloudFileBrowser = function(options) {

        cloudFileBrowser.buildDomEls(this.selector, function() {
            CloudElements.init(options);
        });
    };

}(jQuery));

var cloudFileBrowser = (function() {

    var services = null,
        servicesDisplay = null,
        tabs = '#services-tabs',
        container = '#services-containers',
        selectedFiles = {},
        extension = '';

    return {

        //////////////////////////////////////////////////////////
        // Initialize FilePicker script and build DOM elements  //
        // and setup binding methods                            //
        //////////////////////////////////////////////////////////
        
        init: function(srvs, srvsDis) {
            
            services = srvs;
            servicesDisplay = srvsDis;

            console.log('Services Installed: ', services);

            cloudFileBrowser.selectedFiles = {};

            this.buildTabs();
            this.bindTabs();
            this.bindProvisionButtons();
            this.initDragDropHandlers();
        },
        
        ///////////////////////////////////////////////////////////
        // Prevent browser from opening files and control events //
        ///////////////////////////////////////////////////////////

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

        buildDomEls: function(selector, cb) {

            var HTML = '<section id="tab-container"><ul id="services-tabs"></ul><section id="services-containers"></section><section id="file-info"><div class="preview"><a class="close" href="#"></a></div><h2>File Details</h2><div class="fileDetails"></div></section></section><section id="loading"><span><i></i></span></section><section id="error"></section>';
            $(selector).append(HTML);
            cb();
        },

        buildTabs: function() {

            var tabsHTML = '',
                containerHTML = '';

            for (var i=0; i<services.length; i++) {
                tabsHTML += '<li class="' + services[i] + (i == 0 ? ' on' : '' )+ '">' + servicesDisplay[i] + '</li>';
                containerHTML +=    '<div class="' + services[i] + (i == 0 ? ' on' : '' ) + ' drop-zone" aria-element="' + services[i] + '">'+
                    '<h2></h2>' +
                    '<a href="#" class="provision" aria-element="' + services[i] + '">Connect to your ' + servicesDisplay[i] + ' account</a>' +
                    '</div>';
            }

            $(tabs).append(tabsHTML);
            $(container).append(containerHTML);

        },

        bindTabs: function() {

            // Set the bind method for tab switches

            $(tabs + ' li').on('click', function() {

                var index = $(this).index();

                $('#file-info').removeClass('show');
                $('div.on, li.on').removeClass('on');
                $(this).addClass('on');
                $(container + ' > div').eq(index).addClass('on');

            });
        },

        bindProvisionButtons: function() {

            $('.provision').on('click', function() {

                var element = $(this).attr('aria-element');

                cloudFileBrowser.provisionEl(element);
            });

        },

        bindBreadCrumbClick: function(element) {

            //Onclick of breadcrumb, fetch the files under breadcrumb folder
            $('.breadcrumb ul li.home').on('click', function() {

                $('#file-info').removeClass('show');

                $('.addFiles, .addFilesButton, .selectFilesButton').remove();

                $('#loading').addClass('show');

                var callbackArgs = {
                    'element' : element,
                    'path' : '/'
                };

                provision.getDocuments(element, '/', function(data, cbArgs) {
                    cloudFileBrowser.drawEl(data, cbArgs.element, cbArgs.path);
                }, callbackArgs);
            });

            $('.breadcrumb ul li.selectedPath').on('click', function() {

                $('#loading').addClass('show');

                var callbackArgs = {
                    'element' : element,
                    'path' : this.attributes[0].nodeValue
                };

                provision.getDocuments(element, this.attributes[0].nodeValue, function(data, cbArgs) {
                    cloudFileBrowser.drawEl(data, cbArgs.element, cbArgs.path);
                }, callbackArgs);
            });
        },

        bindFileInfo: function(element) {

            /////////////////////////////////////////////////////////////
            // If a folder is clicked, retrieve files from the folder  //
            /////////////////////////////////////////////////////////////
            
            $('.listTable ul li.foldername').one('click', function() {
                
                var folderName = $(this).text()
                var location = $(this).next().text();

                var callbackArgs = {
                    'element' : element,
                    'path' : location
                };

                $('#file-info').removeClass('show');
                $('.addFiles, .addFilesButton, .selectFilesButton').remove();
                $('#loading').addClass('show');

                provision.getDocuments(element, location, function(data, cbArgs) {
                    cloudFileBrowser.drawEl(data, cbArgs.element, cbArgs.path);
                }, callbackArgs);
            });
            
            /////////////////////////////////////////////////////////////
            // When a file is clicked, check for filetype to display   //
            // thumbnail if image format, otherwise just show details  //
            /////////////////////////////////////////////////////////////

            $('.listTable ul li.filename').on('click', function() {

                var fileInfo = '#file-info';
                var fileName = $(this).text();
                var location = $(this).next().text();
                var listHTML = '<ul><li>Filename:</li><li>' + fileName + '</li></ul>' +
                    '<ul><li>Location:</li><li>' + location + '</li></ul>' +
                    '<a href="#" class="selectbutton">Select</a>'+
                    '<a href="#" class="downloadbutton">Download</a>';

                extension = fileName.split('.').pop();

                //Get the thumbnail of the image only when the extension is of type image
                $('#file-info .preview img').remove();

                var extlower = extension.toLowerCase();
                if (extlower == "jpg" | extlower == "gif" | extlower == "jpeg" | extlower == "png")
                {
                    // Prepare thumbnail to be displayed
                    provision.displayFile(element, location, cloudFileBrowser.displayThumbnail);
                }

                $(fileInfo).addClass('show').find('.fileDetails').html(listHTML);


                $(fileInfo).find('.selectbutton').on('click', function() {
                    provision.fileSelected(element, location);
                });

                $(fileInfo).find('.downloadbutton').on('click', function() {
                    provision.downloadFile(element, location);
                });

            });

            $('div.preview a.close').on('click', function() {
                $('#file-info').removeClass('show');
            });

            $('.listTable ul li.checkbox').on('change', function() {
                
                var selectedPath = this.nextSibling.nextSibling.textContent;
                var position = $.inArray(selectedPath, cloudFileBrowser.selectedFiles[element]);
                
                if(cloudFileBrowser.selectedFiles[element] == null || cloudFileBrowser.selectedFiles[element] == undefined) {
                    cloudFileBrowser.selectedFiles[element] = new Array();
                }
                if(~position){
                    cloudFileBrowser.selectedFiles[element].splice(position, 1);
                }
                else{
                    cloudFileBrowser.selectedFiles[element].push(selectedPath);
                }
            });
        },

        displayThumbnail: function(data) {

            var extlower = extension.toLowerCase();
            
            if (extlower == "jpg" | extlower == "gif" | extlower == "jpeg" | extlower == "png") {
                $('#file-info .preview').append('<img src="' + data.cloudElementsLink + '">');
            }
            
        },

        provisionEl: function(element) {

            var callbackArgs = {
                'element' : element
            };
            
            $('#loading').addClass('show');
            provision.createInstance(element, cloudFileBrowser.handleOnProvision, callbackArgs);
        },

        handleOnProvision: function(element, cbArgs) {

            var callbackArgs = {
                'element' : element,
                'path' : '/'
            };

            provision.getDocuments(element, '/', function(data, cbArgs) {
                cloudFileBrowser.drawEl(data, cbArgs.element, cbArgs.path);
            }, callbackArgs);
        },

        drawEl: function(data, element, path) {
            
            // Call for table from helper class
            var tableHTML = this.buildTable(data, true, path, element);
            
            if (!data || !element) console.warn('Cannot draw element, Data or Element missing!');

            // Clean up load screen
            $('#loading').removeClass('show');

            //TODO May be a better way of refreshing the data, this is needed for folder click
            $('div.' + element + ' .listTable, div.' + element + ' .breadcrumb').remove();

            $(container + ' .' + element).addClass('provisioned').append(tableHTML);

            this.animateTable(element);
            this.bindFileDragDrop(element, path);
            this.bindAddFiles(element, path);
            this.bindBreadCrumbClick(element);
            this.bindFileInfo(element);
        },

        buildTable: function(data, isNew, path, element) {

            if (isNew == true) {

                var tableHTML = '';
                var trailingpath;

                cloudFileBrowser.selectedFiles[element] = new Array();

                console.log('table data recieved: ', data);

                tableHTML += '<a href="#" class="selectFilesButton">Select Files</a><input type="file" class="hidden addFiles" multiple></input><a class="addFilesButton" href="#">Add Files</a><div class="breadcrumb">' +
                    '<ul>';

                if(path != null || path != undefined) {
                    
                    var selectedPathRes = path.split("/");

                    for (var i = 0; i < selectedPathRes.length; i++) {
                        
                        var selectedPathResRec = selectedPathRes[i];

                        if(i == 0 && selectedPathResRec == '') {
                            trailingpath = '/';
                            tableHTML += '<li class="home">Home</li>';
                        }
                        else if(selectedPathResRec != null && selectedPathResRec != '') {
                            
                            if(trailingpath == '/') {
                                trailingpath = trailingpath + selectedPathResRec;
                            }
                            else {
                                trailingpath = trailingpath + '/' + selectedPathResRec;
                            }

                            tableHTML += '<li class="caret"></li>';
                            tableHTML += '<li class="selectedPath" name='+trailingpath+'>'+selectedPathResRec +'</li>';
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

                    tableHTML += '<ul draggable="true">';
                    
                    if(objItm.directory) {
                        tableHTML += '<li class="checkbox"></li>' +
                            '<li class="foldername">';
                    }
                    else {
                        tableHTML += '<li class="checkbox"><input type="checkbox"></li>' +
                            '<li class="filename">';   
                    }

                    tableHTML += objItm.name + '</li>' +
                        '<li>' + objItm.path + '</li>' +
                        '<li>' + objItm.modifiedDate + '</li></ul>';
                }

            }
            else {

                var tableHTML = '';
                var currentIndex = $('.listTable ul').length;

                for (var i=0; i < data.length; i++) {
                    tableHTML += '<ul draggable="true" class="loading '+ data[i].name+'">' +
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

            return tableHTML;

        },

        handleUploadComplete: function(cbArgs) {

            var tableList = $('.listTable ul');
            var ulElement = tableList[cbArgs.currentIndex];
            
            if($('.listTable ul.loading') != null)
            {
                $('.listTable ul.loading').removeClass('loading');
            }

            if(ulElement != null)
            {
                ulElement.innerHTML = '<li class="checkbox"><input type="checkbox"></li>' +
                    '<li class="fileName">' + cbArgs.data.fileName + '</li>' +
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

            $('.selectFilesButton').on('click', function() {
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

            $('#error').html('<span>' + err + '</span>').addClass('show');

            setTimeout(function() {
                $('#error').removeClass('show');
            }, 2500);

        },

        uploadFiles: function(element, path, files) {

            var tableHTML = this.buildTable(files, false, path, element);

            $('div.' + element + ' .listTable').append(tableHTML);
            
            this.animateTable(element);

        }
    };

})();