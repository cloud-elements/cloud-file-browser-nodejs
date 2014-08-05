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

var _cfb = (function() {
    var cfbOptions = null, cfbCnt = 1;

    return {

        setOptions: function(options) {
            _cfb.cfbOptions = options;
        },


        getOptions: function() {
            return _cfb.cfbOptions;
        },

        load: function() {

            if(_cfb.cfbCnt == undefined)
                _cfb.cfbCnt = 0;

            _cfb.cfbCnt++;

            if(_cfb.cfbCnt == 2)
                $('.cloudFileBrowser').cloudFileBrowser(_cfb.getOptions());
        },

        loadjscssfile: function(filename, filetype, name, cb)
        {
            if (filetype=="js")
            {
                var fileref=document.createElement('script');
                fileref.setAttribute("type","text/javascript");
                fileref.setAttribute("src", filename);

                if(cb != null)
                {
                    fileref.onreadystatechange = fileref.onload = cb;
                }
            }
            else if (filetype=="css")
            {
                var fileref=document.createElement('link');
                fileref.setAttribute("rel", "stylesheet");
                fileref.setAttribute("type", "text/css");
                fileref.setAttribute("href", filename);
            }
            if (typeof fileref!="undefined")
                document.getElementsByTagName("head")[0].appendChild(fileref);
        }
    }
})();

(function($) {

    $.fn.cloudFileBrowser = function(options) {
        _cfb.setOptions(options);
    };

}(jQuery));

_cfb.loadjscssfile("css/normalize.css", "css");
_cfb.loadjscssfile("css/font-awesome.min.css", "css");
_cfb.loadjscssfile("css/styles-min.css", "css");

_cfb.loadjscssfile("http://html5shiv.googlecode.com/svn/trunk/html5.js", "js", 'html5');
_cfb.loadjscssfile("lib/provision-min.js", "js", 'cloudfilebrowser', _cfb.load);
_cfb.loadjscssfile("lib/cloudfilebrowser-min.js", "js", 'cloudfilebrowser', _cfb.load);

