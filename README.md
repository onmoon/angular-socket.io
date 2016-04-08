# multitab-socket.io

        var socket = new Socket();
        
        socket.on('hi', function(m) {
          console.log(m);
        });
        
        socket.emit('da',{t:4});
        
        socket.init();
