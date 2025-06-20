const WebSocket = require('ws');

const server = new WebSocket.Server({ port : 8000 });

games = [];

class game{
	id = 0;
	players = [];
	projectiles = [];
	constructor(ags) {
		this.id=ags;
	}
}
class player {
	pos = [0,0];
	item = "gun";
	skin = "hereford";
	health = 100;
	id = 0;
	money = 0;
	cards = [[0,0],[3,12]];
	pName = "";
	constructor(po, it, sk, he, id, mo, ca, na){
		this.pos = po;
		this.item = it;
		this.skin = sk;
		this.health = he;
		this.id = id;
		this.money = mo;
		this.cards = ca;
		this.pName = na;
	}
}
class projectile {
	pos = [0,0];
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

server.on ('connection', (socket) => {
	console.log("connected");
	
	socket.on('message', (message) => {
		message = message.toString();
		console.log(message);
		if (message[0] == 'h'){
			let args = message.split("|");
			if (games.find(x => x.id == args[2]) == null){
				let nGame = new game(args[2]);
				nGame.players.push(new player([50,50], "", args[3], 100, 0, 0, [], args[1]));
				games.push(nGame);
				socket.send(JSON.stringify(nGame));
			} else {socket.send(-1); console.log("room not made");}
		} else if (message[0] == 'j') {
			console.log("joining");
			let args = message.split("|");
			let game = games.find(x => x.id == args[2]);
			if (game != null){
				if (game.players.find(x => x.pName == args[1]) != null){socket.send(-2); return 0;}
				if (game.players.length == 4){socket.send(-3); return 0;}
				game.players.push(new player([50,50], "", args[3], 100, game.players.length, 0, [], args[1]));
				socket.send(JSON.stringify(game));
			} else {socket.send(-1);}
		} else if (message[0] == "m") {
			let args = message.split("|");
			let game = games.find(x => x.id==args[1]);
			if (game != null){
				let player = game.players[args[2]]; 
				if (player != null){
					player.pos = [args[3],args[4]];
					socket.send(JSON.stringify(game));
				}
			}
		} else {
			console.log(message);
		}
	});	
	
});

const PORT = 8000;

