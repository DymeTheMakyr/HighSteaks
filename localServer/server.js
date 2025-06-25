const WebSocket = require('ws');

const server = new WebSocket.Server({host:'0.0.0.0', port : 8000 });

let games = [];

class game{
	id = 0;
	players = [];
	projectiles = [];
	locked = 0;
	constructor(args) {
		this.id=args;
	}
}
class player {
	pos = [50,50];
	flipped = false;
	item = "gun";
	skin = "hereford";
	health = 100;
	money = 0;
	cards = [[0,0],[3,12]];
	pName = "";
	constructor(po, it, sk, he, mo, ca, na){
		this.pos = po;
		this.item = it;
		this.skin = sk;
		this.health = he;
		this.money = mo;
		this.cards = ca;
		this.pName = na;
	}
}
class projectile {
	pos = [0,0];
	flipped = false;
	speed = [0,0];
	damage = 10;
	life = 10;
	owner = 0;
	constructor(p, s, d, l, o){
		this.pos = p;
		this.speed = s;
		this.damage = d;
		this.life = l;
		this.owner = o;
	}
}

function arrPop(array, index){
	return array.slice(0, index).concat(array.slice(index+1));
}

server.on ('connection', (socket) => {
	console.log("connected");
	let id;
	socket.on('message', (message) => {
		message = message.toString();
		if (message[0] == 'h'){
			let args = message.split("⌥");
			if (games.find(x => x.id == args[2]) == null){
				id = args[1]+args[2];
				let nGame = new game(args[2]);
				nGame.players.push(new player([50,50], "", args[3], 100, 0, [], args[1]));
				games.push(nGame);
				socket.send(JSON.stringify(nGame));
			} else {socket.send(-1); console.log("room not made");}
		} else if (message[0] == 'j') {
			console.log("joining");
			let args = message.split("⌥");
			let game = games.find(x => x.id == args[2]);
			if (game != null){
				if (game.players.find(x => x.pName == args[1]) != null){socket.send(-2); return 0;}
				if (game.players.length == 4){socket.send(-3); return 0;}
				id = args[1]+args[2];
				game.players.push(new player([50,50], "", args[3], 100, 0, [], args[1]));
				socket.send(JSON.stringify(game));
			} else {socket.send(-1);}
		} else if (message[0] == "m") {
			let args = message.split("⌥");
			let game = games.find(x => x.id==args[1]);
			if (game != null){
				let pIndx = game.players.findIndex(x => x.pName == args[2]);
				let player = game.players[pIndx]; 
				if (player != null){
					player.pos = [args[3],args[4]];
					player.flipped = parseInt(args[5]);
					socket.send(JSON.stringify(game));
				}
			}
		} else {
			console.log(message);
		}
	});	
	
	socket.on('close', (...args) => {
		if (id != null) {
			let pId = id.slice(0, -4);
			let gIndx = games.findIndex(x => x.id == id.slice(-4));
			let pIndx = games[gIndx].players.findIndex(x => x.pName == pId);
			games[gIndx].players = arrPop(games[gIndx].players, pIndx);
			if (games[gIndx].players.length == 0){
				games = arrPop(games, gIndx);
			}
		}
	});
});
