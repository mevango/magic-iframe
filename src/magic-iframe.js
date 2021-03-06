(function () {
    'use strict';

    var FLIMME_COMMUNICATIONS = 'FLM_CMM';

    var lastDataToChild;

    if (!window.postMessage) {
        return console.error('MIF: no postMessage support. MIF terminating.');
    }

    var requestAnimationFrame = (function () {
        return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();

    var currentScript = document.currentScript;
    if (currentScript === null || currentScript === undefined) {
        var scripts = document.getElementsByTagName('script');
        currentScript = scripts[scripts.length - 1];
    }

    var _registeredParentListeners = false;
    var registerParentListeners = function () {
        if (_registeredParentListeners) return;

        if (window.addEventListener) {
            window.addEventListener('message', handleMessage, false);
        } else if (window.attachEvent) {
            window.attachEvent('onmessage', handleMessage);
        }

        _registeredParentListeners = true;
    };

    var registeredIframes = [];
    var initParent = function (element) {
        if (element.length) {
            for (var q = 0; q < element.length; q++) {
                initParent(element[q]);
            }
            return;
        }
        registerParentListeners();
        registeredIframes.push(element);

        requestAnimationFrame(function af() {
            postToChild(element);
            requestAnimationFrame(af);
        });

    };

    var postToChild = function (element) {
        var rect = element.getBoundingClientRect();
        var offsetY = (rect.top < 0 && rect.bottom > 0) ? rect.y * -1 : 0;
        var data = {
            type: FLIMME_COMMUNICATIONS,
            y: offsetY
        };
        var dataAsString = encodeMessage(data);
        if (lastDataToChild === dataAsString) return;
        lastDataToChild = dataAsString;

        element.contentWindow.postMessage(dataAsString, '*');
    };

    var encodeMessage = function (message) {
        var messageStr = '';

        if (message === null || (typeof message) !== 'object') return messageStr;

        for (var key in message) {
            if (!message.hasOwnProperty(key)) continue;
            if (messageStr.length) messageStr += '&';
            messageStr += key + '=' + encodeURIComponent(message[key]);
        }

        return messageStr;
    };

    var decodeMessage = function (messageStr) {
        var message = {};

        messageStr += '';
        if (!messageStr.length) return message;

        var messageParts = messageStr.split('&');

        for (var q = 0; q < messageParts.length; q++) {
            var part = messageParts[q].split('=', 2);
            message[part[0]] = decodeURIComponent(part[1]);
        }

        return message;
    };

    var getFullHeight = function (selector) {
        const el = document.querySelector(selector);
        if (el) return (function (el) {
            return el.clientHeight;
        })(el);
    };

    var _childInitialized = false;
    var initChild = function (params) {

        if (window === top) return;
        if (_childInitialized) return;

        var messageParent = function (selector) {
            var message = encodeMessage({ type: FLIMME_COMMUNICATIONS, h: getFullHeight(selector) });

            parent.postMessage(message, '*');
        };

        requestAnimationFrame(function af() {
            messageParent(params.selector);
            requestAnimationFrame(af);
        });

        _childInitialized = true;
    };

    var getSourceIframe = function (event) {
        var frames = document.getElementsByTagName('iframe');
        for (var q = 0; q < frames.length; q++) {
            if (frames[q].contentWindow === event.source) return frames[q];
        }
        return null;
    };

    var handleMessage = function (event) {
        var iframe = getSourceIframe(event);
        var message = decodeMessage(event.data);

        if (message.type !== FLIMME_COMMUNICATIONS) return;

        setHeight(iframe, message.h);
    };

    var setHeight = function (iframe, height) {
        if (!iframe) return;
        iframe.height = height;
        iframe.style.height = height + 'px';
    };

    var initParentBySelector = function (selector) {
        var elem;

        if (document.querySelectorAll) {
            elem = document.querySelectorAll(selector);
        } else if (selector.match(/^#[a-z0-9_-]+$/i)) {
            elem = [document.getElementById(selector.substring(1))];
        } else {
            return console.error('MIF: no querySelectorAll, jQuery, or simple selector. MIF target ignored.');
        }

        for (var q = 0; q < elem.length; q++) {
            MagicIframe.parent(elem[q]).init();
        }
    };

    var initParentByURL = function (url) {
        var iframe = document.createElement('iframe');

        if (currentScript.id) {
            iframe.id = currentScript.id;
            currentScript.id = 'mif-script-' + currentScript.id;
        }
        if (currentScript.className) {
            iframe.className = currentScript.className;
            currentScript.className = '';
        }

        iframe.src = url;
        iframe.frameBorder = 0;
        iframe.scrolling = 'no';
        iframe.allowFullscreen = 'true';
        iframe.style.display = 'block';
        iframe.style.webkitBoxSizing = 'border-box';
        iframe.style.mozBoxSizing = 'border-box';
        iframe.style.boxSizing = 'border-box';
        iframe.style.width = '100%';
        iframe.style.overflow = 'hidden';
        currentScript.parentNode.insertBefore(iframe, currentScript.nextSibling);

        MagicIframe.parent(iframe).init();
    };

    var MagicIframe = window.MagicIframe = {
        child: function (params) {
            return {
                init: initChild.bind(this, params)
            };
        },
        parent: function (element) {
            return {
                init: function () { initParent(element); }
            };
        },
        init: function () {
            return {
                parent: initParent,
                child: initChild
            };
        }
    };

    var getParameterByName = function (name, url) {
        if (!url) url = window.location.href;

        name = name.replace(/[\[\]]/g, "\\$&");

        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);

        if (!results) return null;

        if (!results[2]) return '';

        return decodeURIComponent(results[2].replace(/\+/g, " "));
    };

    var rawEvent = currentScript.getAttribute('data-event');

    if (!rawEvent) {
        var selector = (currentScript.getAttribute('data-selector') || 'body').toLowerCase();

        MagicIframe.child({ selector: selector }).init();

    } else if (rawEvent) {
        var baseURL = currentScript.getAttribute('data-base') || 'https://flimme.tv/wall/';
        var event = rawEvent || 'flimmetv';
        var url = baseURL + event

        var show = getParameterByName('show');

        if (show) url += '?show=' + show;

        initParentByURL(url);
    }
})();
