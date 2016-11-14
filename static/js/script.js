var editor = ace.edit("editor")
editor.setTheme("ace/theme/chrome")
editor.getSession().setMode("ace/mode/javascript");
editor.setOption("showPrintMargin", false)
editor.$blockScrolling = Infinity

function autoSelectURLContents(obj) {
    if (obj.value == "www.example.com") {
        obj.setSelectionRange(0, obj.value.length)
    }
}

var headerSuggestions = {
    "Content-Type": ['application/json', 'application/xml', 'text/html', 'text/plain', 'text/xml'],
    "Authorization": ['Bearer'],
    "Accept": ['application/json', 'application/xml', 'text/html', 'text/plain', 'text/xml'],
    "Accept_Language": ['en-US']
};

var methodTypes = ['GET', 'PUT', 'POST', 'DELETE']

var editorModes = [{
    value: 'text',
    name: 'Plain Text'
}, {
    value: 'json',
    name: 'JSON'
}, {
    value: 'xml',
    name: 'XML'
}]

function ViewModel() {
    var self = this;
    self.uid = ko.observable({
      "uid": ko.observable(null),
      "valid": ko.observable(false)
    });
    self.headers = ko.observableArray([{
        key: ko.observable(""),
        value: ko.observable("")
    }, ]);

    self.queryParams = ko.observableArray([{
        key: ko.observable(""),
        value: ko.observable("")
    }, ]);

    self.authentication = ko.observable({
        "auth_necessary": ko.observable(true),
        "set_auth": function(bool) {
            return function() {
                self.authentication().auth_necessary(bool);
                self.authentication().username("");
                self.authentication().password("");
            }
        },
        "username": ko.observable(""),
        "password": ko.observable("")
    })

    self.editorMode = ko.observable("json")
    self.editorMode.subscribe(function() {
        editor.getSession().setMode("ace/mode/" + self.editorMode())
    });
    self.editorContent = ko.observable("")

    self.methodType = ko.observable("")
    self.url = ko.observable("www.example.com")

    self.dataPayload = ko.observable("")


    self.saveCurl = function() {
        $.ajax({
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(self.serializeCurlAsJson()),
            dataType: 'json',
            url: '/save_curl',
            success: function(response) {
                if (!self.url_has_uid()) {
                    window.history.pushState("", "", "/" + response.uid);
                }
                self.uid()['uid'](response.uid);
                self.uid()['valid'](true);
            },
            error: function() {
                console.log("error occurred")
            }
        })
    }

    self.curlCommand = ko.computed(function() {
        headers = ""
        for (var i = 0; i < self.headers().length; i++) {
            if (self.headers()[i].key() != '' || self.headers()[i].value() != '') {
                headers += " --header \"" + self.headers()[i].key() + ": " + self.headers()[i].value() + "\"";
            }
        }

        var data = '';
        if (self.editorContent() != '') {
            data = '--data \'' + self.editorContent() + '\'';
        }

        var auth = '';
        if (self.authentication().username() != "" || self.authentication().password() != "") {
            auth = ' --user \'' + self.authentication().username() + ":" + self.authentication().password() + "\'";
        }

        queryparameters = '';
        if (self.queryParams().length > 0 && self.queryParams()[0].key() != '') {
            queryparameters = "?";
        }
        for (var i = 0; i < self.queryParams().length; i++) {
            if (self.queryParams()[i].key() != '' || self.queryParams()[i].value() != '') {
                queryparameters += self.queryParams()[i].key() + "=" + self.queryParams()[i].value();
                if (i < self.queryParams().length - 1) {
                    queryparameters += "&";
                }
            }
        }

        var url = ''
        if (self.url() != '') {
            url = "\"" + self.url() + queryparameters + "\"";
        }

        var method = " --request \"" + self.methodType() + "\" ";

        return "curl --verbose " + headers + data + auth + method + url
    })

    self.headers.getSuggestedValues = function(pair) {
        return ko.computed(function() {
            return headerSuggestions[pair.key()];
        });
    };

    // Callbacks
    self.headers.addHeader = function() {
        self.headers.push({
            key: ko.observable(''),
            value: ko.observable('')
        });
    }
    self.headers.removeHeader = function() {
        self.headers.remove(this)
    }

    self.queryParams.addQueryParam = function() {
        self.queryParams.push({
            key: ko.observable(''),
            value: ko.observable('')
        });
    }

    self.queryParams.removeQueryParam = function() {
        self.queryParams.remove(this)
    }

    editor.getSession().on('change', function(e) {
        self.editorContent(editor.getValue().replace(/[\n\t ]/g, ''))
    });

    self.formatText = function() {
        if (self.editorMode() == 'json') {
            editor.setValue(JSON.stringify(JSON.parse(editor.getValue()), null, '\t'));
        }
        if (self.editorMode() == 'xml') {
            editor.setValue(vkbeautify.xml(editor.getValue()));
        }
    }

    self.serializeCurlAsJson = function() {
        var hdrs = []
        for (var i = 0; i < self.headers().length; i++) {
            hdrs.push({
                key: self.headers()[i].key(),
                value: self.headers()[i].value()
            })
        }
        var qpms = []
        for (var i = 0; i < self.queryParams().length; i++) {
            qpms.push({
                key: self.queryParams()[i].key(),
                value: self.queryParams()[i].value()
            })
        }
        return {
            uid: self.uid()['uid'](),
            headers: hdrs,
            queryParameters: qpms,
            username: self.authentication().username(),
            password: self.authentication().password(),
            dataPayload: self.editorContent(),
            editorMode: self.editorMode(),
            methodType: self.methodType(),
            url: self.url()
        }
    }

    self.deserializeJson = function(curl) {
        self.url(curl.url)
        self.editorMode(curl.editorMode)
        self.methodType(curl.methodType)
        self.authentication().username(curl.username)
        self.authentication().password(curl.password)
        editor.setValue(curl.dataPayload)

        self.headers().pop()
        for (var i = 0; i < curl.headers.length; i++) {
            self.headers.push({
                key: ko.observable(curl.headers[i].key),
                value: ko.observable(curl.headers[i].value)
            })
        }

        self.queryParams().pop()
        for (var i = 0; i < curl.queryParameters.length; i++) {
            self.queryParams.push({
                key: ko.observable(curl.queryParameters[i].key),
                value: ko.observable(curl.queryParameters[i].value)
            })
        }
    }

    self.get_uid = function() {
        url = document.URL
        uid = url.substr(url.length - 16)
        return /[a-zA-Z0-9]{16}$/.test(uid) ? uid : null;
    }

    self.url_has_uid = ko.computed(function() {
        var uid_not_null = self.uid()['uid']() != null;
        var uid_is_valid = self.uid()['valid']() == true
        return uid_not_null && uid_is_valid;
    })

    function checkForData() {
        if (self.get_uid()) {
            $.post('/retrieve_curl/' + self.get_uid(), function(data) {
                var data = JSON.parse(data);
                if (data['error']){
                  debugger;
                }else{
                  self.uid()['uid'](self.get_uid());
                  self.uid()['valid'](true);
                  self.deserializeJson(data);
                }
            });
        }
    }

    function setupClipboardButton() {
        var copyButton = document.querySelector('.copy-button');
        copyButton.addEventListener('click', function(event) {
            var curl_cmd = document.querySelector('#curl_cmd');
            curl_cmd.select();
            document.execCommand('copy');
        });
    }

    function initialize() {
        $(document).ready(function() {
            checkForData();
            setupClipboardButton();
        });
    }
    initialize();

};


ko.applyBindings(new ViewModel());
