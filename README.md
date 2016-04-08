# multitab-socket.io

        var socket = new sockets({
          debug: true, // enable debug
          url: '', // url for socket.io
          socket: {}, // options for socket.io
          intervals: {
            masterSet: 1000, //set master tab
            masterCheck: 2000 //check if master tab closed
          },
          storage: {
            delimiter: ':', //delimiter for localstorage key
            prefix: 'sockets', // prefix for localstorage key
            master: 'master' // name for entry for check master tab
          }
        });
        
        socket.on('hi', function(m) {
          console.log(m);
        });
        
        socket.emit('da',{t:4});
        
        socket.init();
