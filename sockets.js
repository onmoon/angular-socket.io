(function () {
  'use strict';

  function extend(obj, props) {
    for (var prop in props) {
      if (typeof props[prop] === 'object') {
        extend(obj[prop], props[prop])
      } else {
        if (props.hasOwnProperty(prop)) {
          obj[prop] = props[prop];
        }
      }
    }
    return obj;
  }

  var Socket = function Socket(options) {
    if (!this instanceof Socket) {
      return new Socket(options);
    }
    // extend default options
    this.options = extend({
      url: '',
      socket: {

      },
      debug: true,
      intervals: {
        masterSet: 1000,
        masterCheck: 2000
      },
      storage: {
        delimiter: ':',
        prefix: 'sockets',
        master: 'master'
      }
    }, options);
    // socket master flag
    this.master = false;
    // emits queue
    this.emits = [];
    // registered listeners
    this.listeners = {};
    // storage link
    this.storage = window.localStorage || false;
    // helpers
    this.storageKey = this.options.storage.prefix + this.options.storage.delimiter;
    this.storageKeyMaster = this.storageKey + this.options.storage.master;
  }
  /**
   * Trigger event to storage
   * @param  string
   * @param  object
   */
  Socket.prototype.debug = function(message) {
    if (this.options.debug) {
      console.log(message);
    }
  };
  /**
   * Start listen sockets
   */
  Socket.prototype.init = function() {
    var self = this;
    // if storage not found start socket
    if (!this.storage) {
      return this.initSockets();
    }
    // on storage event func
    function storageEvent(event) {
      event = event || window.event; // give IE8 some love
      // trigger on storage
      self.storageEvent(event.key, event.newValue);
    }

    if (window.attachEvent) { // ::sigh:: IE8 support
      window.attachEvent('onstorage', storageEvent);
    } else {
      window.addEventListener('storage', storageEvent, false);
    }
    // if there are no master yet
    if (!this.storage.getItem(this.storageKeyMaster)) {
      // make this a master
      this.setMaster();
    } else {
      // make this a slave
      this.setSlave();
    }
  };
  /**
   * Initialize socket
   * @return Socket
   */
  Socket.prototype.initSockets = function() {
    var self = this;

    if (!window.io) {
      this.debug('Websockets not found.Please check support socket.io.');
      return;
    }
    // create websocket object
    this.socket = window.io.connect(this.options.url, this.options.socket);
    // socket open event
    this.socket.on('connect', function() {
      self.debug('Websocket connecting...');
      // go through emits
      self.checkEmits();
    });
    // socket close event
    this.socket.on('disconnect', function() {
      self.debug('Websocket disconnecting...');
    });
  };
  /**
   * Set as master
   */
  Socket.prototype.setMaster = function() {
    var self = this;
    // set master flag
    this.master = true;
    // timestamp saver
    function storeTime() {
      self.storage.setItem(self.storageKeyMaster, Date.now());
    }
    // master save ticker
    this.masterTimer = setInterval(storeTime, this.options.intervals.masterSet);
    // store now
    storeTime();
    this.debug('set as master');
    // init sockets
    this.initSockets();
    // add listeners if no socket
    this.addListeners();
  };
  /**
   * Check emits after start socket
   */
  Socket.prototype.checkEmits = function() {
    while (this.emits.length) {
      var emitObj = this.emits.pop();
      // call every emit
      this.emit(emitObj.action, emitObj.data);
    }
  };

  /**
   * add all listeners
   */
  Socket.prototype.addListeners = function() {
    for (var key in this.listeners) {
      this.addListener(key);
    }
  };
  /**
   * add one listener
   */
  Socket.prototype.addListener = function(key) {
    var self = this;
    if (this.socket) {
      this.socket.on(key, function(response) {
        self.socketEvent(key, response);
      });
    }
  };
  /**
   * Set as slave
   */
  Socket.prototype.setSlave = function() {
    var self = this;
    // check if master exists
    function checkMaster() {
      if (Date.now() - self.storage.getItem(self.storageKeyMaster) > self.options.intervals.masterCheck) {
        // no -> set this as master
        self.setMaster();
      }
    }
    // master check ticker
    this.slaveTimer = setInterval(checkMaster, this.options.intervals.masterCheck);
    // check now
    checkMaster();
    this.debug('set as slave');
    // check storage for events
    this.checkStorage();
  };
  /**
   * Storage check for events on set slave
   */
  Socket.prototype.checkStorage = function() {
    if (!this.storage) {
      return;
    }
    this.debug('check storage...');
    // go through all storage keys
    for (var key in this.storage) {
      if(key.match(this.storageKey)) {
        // trigger events
        this.storageEvent(key, this.storage[key]);
      }
    }
  };
  /**
   * Add callback for event
   * @param  string
   * @param  function
   * @return Socket
   */
  Socket.prototype.on = function(key, callback) {
    if (this.socket) {
      this.addListener(key);
    } else {
      // no event yet
      if (!this.listeners[key]) {
        // init storage for this
        this.listeners[key] = [];
      }
      this.debug('add listener: ' + key)
      // add callback to storage
      this.listeners[key].push(callback);
    }
    return this;
  };
  /**
   * Remove callback for event
   * @param  string
   * @param  function
   * @return Socket
   */
  Socket.prototype.off = function(action, callback) {
    // no event yet
    if (!this.listeners[action]) {
      // init storage for this
      this.listeners[action] = [];
    }

    // go through all callbacks for this event
    for (var i in this.listeners[action]) {
      // if this is needed callback
      if (this.listeners[action][i] === callback) {
        // remove this from storage
        this.listeners[action].splice(i, 1);
        break;
      }
    }
    return this;
  };
  /**
   * trigger event on socket
   */
  Socket.prototype.socketEvent = function(key, response) {
    if (this.storage) {
      this.storage.setItem(this.storageKey + ':' + key, JSON.stringify(response));
    }
    this.onCallback(key, response);
  };
  /**
   * Trigger event
   * @param  string
   * @param  object
   */
  Socket.prototype.onCallback = function(action, data) {
    // no listeners for event
    if (!this.listeners[action]) {
      return;
    }
    this.debug('trigger: ' + action);
    // go through all listeners for this event
    for (var i in this.listeners[action]) {
      // call every one
      this.listeners[action][i].call(this, data);
    }
  };
  /**
   * Trigger event to storage
   * @param  string
   * @param  object
   */
  Socket.prototype.storageEvent = function(key, data) {
    key = key.replace(this.storageKey + ':', '');
    // if it's not a set master event & only for slaves
    if (!this.master && key != this.options.storage.master) {
      // trigger event
      try {
        this.onCallback(key, JSON.parse(data));
      } catch (err) {
        this.debug(err);
      }
    }
  };
  /**
   * Emit event (send message to socket)
   * @param  string
   * @param  object
   * @return Socket
   */
  Socket.prototype.emit = function(action, data) {
    // socket initialized and ready
    if (this.socket) {
      // send message
      this.socket.emit(action, data);
    } else {
      var emit = {
        action: action,
        data: data
      };
      // push emit to queue
      this.emits.push(emit);
    }
    return this;
  };
  
  window.sockets = Socket;
  
})();
