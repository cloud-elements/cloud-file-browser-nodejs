###################################################################################
##     Cloud File Browser                                                        ##
###################################################################################
[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/cloud-elements/cloud-file-browser-nodejs?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Copyright 2012-2016 Cloud Elements <http://www.cloud-elements.com>          

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License.


##########################
##         DEMO         ##
##########################
[Cloud File Browser Demo](http://filebrowser.io/) 


##########################
##     Description      ##
##########################
Cloud File Browser is a javascript library to connect to Document Hub provider (e.g. Dropbox, Box,
Google Drive) by creating Cloud Elements instances, this library uses nodejs on the backend for connecting to Cloud
Elements API by not exposing any keys or tokens to outside world.


##########################
##     Requirements     ##
##########################
* Node.js <http://nodejs.org/>
* Express <http://expressjs.com/>
* jQuery 2+ <http://code.jquery.com/jquery-2.1.0.min.js>

Setup and create of application for the each document provider. Find the document for setting up application for the
provider 


##########################
##         Setup        ##
##########################

## STEP 1 ##
There are two ways of installing the required scripts for the Cloud File Browser:

1. Include the desired version of jQuery & minified cfb.min.js script in your HTML HEAD tag,
and the script will build all the required client-side scripts on your page.

```html
<script src="http://code.jquery.com/jquery-2.1.0.min.js"></script>
<script src="https://filebrowser.io/v1/cfb.js"></script>
```

2. or alternatively, you may host the plugin by including the lib, img, fonts, css folders and callback.html in your
web application.

```html

<link rel="stylesheet" href="css/normalize.css" />
<link rel="stylesheet" href="css/font-awesome.min.css" />
<link rel="stylesheet" href="css/styles.css" />

<script src="http://code.jquery.com/jquery-2.1.0.min.js"></script>
<script src="lib/cloudfilebrowser.js"></script>
<script src="lib//provision.js"></script>
```
## STEP 2 ##
Define the HTML section where you would like the file browser to appear:

```html
<section class="cloudFileBrowser"></section>
```

and initialize the client-side scripting using jQuery as follows:

```javascript
$('.cloudFileBrowser').cloudFileBrowser({
      callback: mycallbackfunction
      env: 'http://localhost:8888/elements/'
});
```
### Configuration Options ###
 **callback** - Function that gets invoked when an action happens, 'select' - when a file is selected by
user, 'create' - when an element instance is created when user authorizes your application. Format of callback
function is

```javascript
    function mycallback(type, response)
    {
        console.log('Callback for type ' + type + ' with response ' + JSON.stringify(response));
    };
```
response in callback example
```javascript
    {
        'element': box,
        'elementToken': 'cAhB2y64CMJv28BcnVlEXBb7pmQm1wW',
        'action' : 'create'
    }
```
```javascript
    {
        'element': box,
        'selectedFile': '/fakepath/fakefile.jpg',
        'action' : 'select'
    }
```
 **env** - The node server URL that running at.

## STEP 3 ##
Obtain your Organization Secret key and User Secret key from your Cloud-Elements account, and place them in your server.js file (line 84-85)
These keys are the required Authorization headers for invoking the Cloud Elemnts API

## STEP 4 ##
Set up the providers you would like to use in server.js, if you don't mention the provider in the documents it
doesn't show up on the screen.
Supported documents providers are box, dropbox, googledrive, onedrive, sharepoint
example:

```javascript
documents = {
        'box': {
            'apiKey': 'q3kuw28dqdkirsesgjtwreutuwnu8djg4499',
            'apiSecret': 'jZGbIgjhgGJhnkKJaOLMA8HXgsbb3TkcXo4iKnD',
            'callbackUrl': 'http://localhost:8080/callback.html'
        },

        'dropbox': {
            'apiKey': '9kyxmsmhdfh8xn2m4',
            'apiSecret': 'trap7ksmgbsdfa71xzh',
            'callbackUrl': 'http://localhost:8080/callback.html'
        },

        'googledrive': {
            'apiKey': '282923532784-t89r45pvo4nuo49l6clpfa6b8mkkgnnu.apps.googleusercontent.com',
            'apiSecret': 'uErA1R7L4BAxZdgKW20VcqpE',
            'callbackUrl': 'http://localhost:8080/callback.html'
        },

        'onedrive' : {
            'elementToken' : 'wL8dSSeddRkje3V6ftWy6/XJhUJH3oJHSRA7/miR+C4='
        },

        'sharepoint' : {
            'elementToken' : 'cAhB2y64CMJv28BcnVlEXBb7pmQm1wW+uW1muJS2LdY='
        }
}
```
### Configuration Options ###

| Key        | Description |
| ----------------- |:-------------:|
| **apiKey**        | The client ID or API key or App key of your provider application. |
| **apiSecret**     | The client secret or App secret of your provider application.     |
| **callbackUrl**   | The redirect uri once the OAuth2 approval is done,this needs to be callback.html|
| **elementToken**  | This is the Cloud Elements instance token, if an elementToken is present it takes the priority over the other configs. You can pass in the elementToken based on user login to your application|

The required scripts and markup are ready to go! Start up your node server by opening your terminal and finding the directory you've downloaded the Cloud File Browser to, and type:

```javascript
node server.js
```

And you're all set!


##########################
##       Examples       ##
##########################

You can find the examples of using the Cloud File Browser under examples folder and in index.html
###Example1
index.html shows you how to use Cloud File Browser, by just including the cfb.js which loads all the client side
sources

###Example2
filebrowser1.html shows you how to use Cloud File Browser by downloading the source and using it in your web application.

###Example3
filebrowser2.html shows you how to use Cloud File Browser in a modal window.


##########################
##          Code        ##
##########################

####server.js
This is the Node.js server that handles the Organization Secret and User Secret, and routes them to the appropriate Cloud-Elements API call.

####lib/provision.js
This JS file acts as a wrapper JS and nodejs by calling the required nodejs API calls which in turn
connect to Cloud Elements API.

####lib/cloudfilebrowser.js
This JS file has the complete UI design of the Cloud File Browser, you can customize this according to your needs.

####css/styles.css
This CSS file has the styling of Cloud File Browser, you can customize this according to your application.
There are two methods of customizing the styles, one by modifying 'styles.css', or by introducing a custom stylesheet with your application.

####css/normalize.css
This CSS file is a browser normalization stylesheet, helping make all browsers read default styles similarly.
More information can be found at: http://necolas.github.io/normalize.css/3.0.1/normalize.css

####lib/cfb.js
This JS file is a single import script which loads all the required JS and CSS files for the Cloud File Browser.


##########################
##        License       ##
##########################

```
Copyright 2012-2016 Cloud Elements <http://www.cloud-elements.com>

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License.
```
