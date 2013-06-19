var app = require('http').createServer(handler)
	, io = require('socket.io').listen(app)
	, fs = require('fs')

app.listen(80);

var indexPage="Server is starting"

fs.readFile(__dirname + '/index.html', function (err, data) {
	if (err) {
		console.log("Error starting server")
	}
	indexPage=data
});

function handler (req, res) {
	res.writeHead(200);
	res.end(indexPage);
}

function getRoom(socket) {
	var a = io.sockets.manager.roomClients[socket.id]
	for(var i in a){
		if (a.hasOwnProperty(i) && i!="") {
			return i.substr(1, a[i].length)
		}
	}
}

gameRooms = {}

users = {}

io.sockets.on('connection', function (socket) {
	rooms={}
	for(i in io.sockets.manager.rooms) {
		rooms[i.substr(1, i.length)]=io.sockets.manager.rooms[i].length
	}
	socket.emit('rooms', rooms);


	socket.on('subscribe', function(data) { 
		socket.join(data.room); 

		if(gameRooms[data.room]==undefined){
			gameRooms[data.room]={}
			gameRooms[data.room].field=[]
			gameRooms[data.room].turn=0
			gameRooms[data.room].isStarted=false
		}

		if(gameRooms[data.room].isStarted){
			socket.emit('setField', { 
				field: gameRooms[data.room].field,
				isStarted: true,
				player1: users[gameRooms[data.room].player1],
				player2: users[gameRooms[data.room].player2]
			})
			socket.emit('chat', { msg: "Играют "+users[gameRooms[data.room].player1]+" и "+users[gameRooms[data.room].player2]})
		}

		if(gameRooms[data.room].player1==undefined) {
			gameRooms[data.room].player1 = socket.id
			io.sockets.in(getRoom(socket)).emit('chat', { msg: users[socket.id]+" - первый игрок"})
		}else	if(gameRooms[data.room].player2==undefined) {
			gameRooms[data.room].player2 = socket.id

			io.sockets.in(getRoom(socket)).emit('setField', { 
				field: [],
				isStarted: true,
				player1: users[gameRooms[data.room].player1],
				player2: users[socket.id]
			})
			gameRooms[data.room].field=[]
			gameRooms[data.room].turn=0
			gameRooms[data.room].isStarted=true
			io.sockets.in(getRoom(socket)).emit('chat', { msg: users[socket.id]+" - второй игрок"})
		} else {
			io.sockets.in(getRoom(socket)).emit('chat', { msg: users[socket.id]+" вошёл в комнату"})
		}
	})


	socket.on('unsubscribe', function(data) { 
		if(gameRooms[data.room] && (gameRooms[data.room].player1 == socket.id || gameRooms[data.room].player2 == socket.id)) {
			io.sockets.in(getRoom(socket)).emit('chat', { msg: users[socket.id]+" left room"})
			io.sockets.in(getRoom(socket)).emit('setField', { 
				field: [],
				isStarted: false,
				player1: "",
				player2: ""
			})
			gameRooms[data.room]={}
			gameRooms[data.room].field=[]
			gameRooms[data.room].turn=0
		} else {
			io.sockets.in(getRoom(socket)).emit('chat', { msg: users[socket.id]+" left room"})
		}
		socket.leave(data.room); 
	})


	socket.on('setName', function(data) { 
		users[socket.id]=data.name
	})


	socket.on('changeName', function(data) { 
		var old = users[socket.id]
		users[socket.id]=data.name
		io.sockets.in(getRoom(socket)).emit('chat', { msg: old+" сменил имя на "+data.name})
	})


	socket.on('chat', function(data) { 
			if(data.msg.trim()!="") io.sockets.in(getRoom(socket)).emit('chat', { msg: users[socket.id]+": "+data.msg})
	})


	socket.on('roomList', function(data) { 
		rooms={}
		for(i in io.sockets.manager.rooms) {
			rooms[i.substr(1, i.length)]=io.sockets.manager.rooms[i].length
		}
		socket.emit('roomList', rooms);
	})

	socket.on('makeStep', function(data) { 
		var room=getRoom(socket)
		if(gameRooms[room]!=undefined && !gameRooms[room].isStarted) { console.log("not started"); return;}
		var pl=0
		if(gameRooms[room].player1==socket.id && gameRooms[room].turn % 2 == 0) pl=1
		if(gameRooms[room].player2==socket.id && gameRooms[room].turn % 2 == 1) pl=2
		if(pl==0) { console.log("wrong player "+socket.id+" "+gameRooms[room].player1+" "+gameRooms[room].player2+" "+turn); return;}

		var possible = false
		var prev = gameRooms[room].prev
		if(gameRooms[room].turn  == 0) { 
			possible = true
			console.log("$1")
		} else {
			var target = ((prev-1) % 9) + 1
			var turn = Math.floor((data.id-1) / 9) + 1
			console.log("$2"+target+"$"+turn)
			if(target==turn) {
				possible = true
				console.log("$3")
			} else {
				console.log("$4")
				var c=0
				for(var i=9*(target-1)+1; i<=9*(target-1)+9; i++)
					if(gameRooms[room].field[i]>0) c++
				if(c==9) {
					possible = true
					console.log("$5")
				}
			}
		}
		console.log("$6")
		if(gameRooms[room].field[data.id]>0) possible = false
		if(!possible) return;

		gameRooms[room].field[data.id]=pl
		gameRooms[room].prev = data.id
		io.sockets.in(room).emit('updateField', { a: data.id, b: pl})
		gameRooms[room].turn++
	})

	socket.on('disconnect', function () {
		var room=getRoom(socket)
		if(gameRooms[room] && (gameRooms[room].player1 == socket.id || gameRooms[room].player2 == socket.id)) {
			io.sockets.in(getRoom(socket)).emit('chat', { msg: users[socket.id]+" left room"})
			io.sockets.in(getRoom(socket)).emit('setField', { 
				field: [],
				isStarted: false,
				player1: "",
				player2: ""
			})
			gameRooms[room]={}
			gameRooms[room].field=[]
			gameRooms[room].turn=0
		} else {
			io.sockets.in(getRoom(socket)).emit('chat', { msg: users[socket.id]+" left room"})
		}
	});


});
