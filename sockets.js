(function () {
    'use strict';

    var Socket = function Socket(options) {
        if (!this instanceof Socket) {
            return new Socket(options);
        }

        this.options = options || {};
        this.master = false;
        this.listeners = {};
        this.storage = window.localStorage || false;
        this.init();
    };

    Socket.prototype.init = function () {
        if(!this.storage) {
            return this.initSockets();
        }
        
        var self = this;
        function storageEvent(event) {
            event = event || window.event; // give IE8 some lovealert('Yo people! Something just got stored!');
            self.storageEvent(event);
        }

        if (window.attachEvent) { // ::sigh:: IE8 support
            window.attachEvent('onstorage', storageEvent);
        } else {
            window.addEventListener('storage', storageEvent, false);
        }
        var storeMaster = this.storage[this.options.storageKey + ':master'];
        if(!storeMaster) {
            this.setMaster();
        } else {
            this.setSlave();
        }
    };

    Socket.prototype.initSockets = function () {
        if(!window.io) {
            console.log('Websockets not found.Please check support socket.io.');
            return;
        }
        this.socket = window.io.connect(this.options.url, this.options.socket || {});
        this.socket.on('connect', function(){
          console.log('Websocket connecting...');
        });

        this.socket.on('disconnect', function(){
          console.log('Websocket disconnecting...');
        });
    };

    Socket.prototype.setMaster = function () {
        var self = this;
        this.master = true;
        function set(){
            var now = (new Date()).getTime();
            self.storage.setItem(self.options.storageKey + ':master', now);
        }
        set();
        this.masterTimer = setInterval(set, 2000);
        this.initSockets();
        this.addListeners();
    };

    Socket.prototype.addListeners = function () {
        for(var i in this.listeners) {
           this.addListener(i);
        }
    };

    Socket.prototype.addListener = function (e) {
        var self = this;
        if(this.socket) {
            this.socket.on(e, function (response) {
                self.socketEvent(e, response);
            });
        }
    };

    Socket.prototype.setSlave = function () {
        var self = this;

        function checkMaster() {
            var now = (new Date()).getTime();
            var time = self.storage.getItem(self.options.storageKey + ':master');
            if(now - time > 5000) {
                self.setMaster();
            }
        }
        this.slaveTimer = setInterval(checkMaster, 5000);
        checkMaster();
    };

    Socket.prototype.on = function (e, callback) {
        if (!this.listeners[e]) {
            this.listeners[e] = [];
        }
        this.listeners[e].push(callback);

        if(this.socket) {
            this.addListener(e);
        }
    };

    Socket.prototype.off = function (e, callback) {
        if (!this.listeners[e]) {
            this.listeners[e] = [];
        }

        for (var i in this.listeners[e]) {
            if (this.listeners[e][i] === callback) {
                this.listeners[e].splice(i, 1);
                break;
            }
        }
    };

    Socket.prototype.socketEvent = function (e, response) {
        if(this.storage) {
            this.notifyStorage(e, response);
        }
        this.onCallback(e, response, 'socket');
    };

    Socket.prototype.onCallback = function (e, response) {
        if(!this.listeners[e]) {
            return;
        }

        for(var i in this.listeners[e]) {
            this.listeners[e][i].call(this, new Object(response));
        }
    };

    Socket.prototype.storageEvent = function (e) {
        var key = e.key.replace(this.options.storageKey + ':','');
        this.onCallback(key, JSON.parse(e.newValue), 'storage');
    };

    Socket.prototype.notifyStorage = function (e, response) {
        this.storage.setItem(this.options.storageKey + ':' + e, JSON.stringify(response));
    };

    app.factory('socket',['$window', function ($window) {
        var socket = new Socket({
            url : $window.location.origin,
            storageKey : 'news',
            socket : {
                query : 'token=' + localStorage.accessToken,
                transports: ['flashsocket','xhr-polling','websocket','jsonp-polling']
            }
        });
        return {
            on : socket.on.bind(socket),
            off : socket.off.bind(socket)
        };
    }]);
})();
