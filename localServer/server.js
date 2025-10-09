const WebSocket = require('ws');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

let hostInput = null;
readline.question("Input IPv4 address: ", inp => {hostInput = inp;readline.close();})

const server = new WebSocket.Server({host: hostInput, port : 8000 });

class gameManager{
	static games = {};
	static playerMem = {};
	static collisionHandlers = {};
	static projectileHandlers = [];
}

class vec{
	x = 0;
	y = 0;
	constructor(_x, _y){
		this.x = parseFloat(_x);
		this.y = parseFloat(_y);
	}
	static n(_x, _y){
		return new vec(_x, _y);
	}
	static avg(off, ...vecs){
		let x = 0;
		let y = 0;
		vecs.forEach(v => {x += v.x; y += v.y;});
		x = Math.round(x/vecs.length);
		y = Math.round(y/vecs.length);
		if (off.x != null && off.y != null){
			return vec.n(off.x+x, off.y+y);
		} else {
			return vec.n(x, y);
		}
	}
	static add(a,b){
		return vec.n(a.x+b.x, a.y+b.y);
	}
	static sub(a,b){
		return vec.n(a.x-b.x, a.y-b.y);
	}
	static distance(a,b){
		return ((a.x-b.x)**2 + (a.y-b.y)**2)**0.5;
	}
}

function setPos(obj, ...args){
	if (args.length == 3){
		obj.col.origin = {"x":args[1], "y":args[2]};
	} else if (args.length == 2){
		obj.col.origin = args[1];
	}
}
class game{
	className = "game";
	id = 0;
	currentRound = "selection";
	votes = {};
	players = [];
	projectiles = [];
	colliders = [];
	interactables = [];
	locked = 0;
	constructor(args) {
		this.id=args;
	}
}
class col {
	className = "col";
	origin = vec.n(0,0);
	points = [];
	type = "r";
	constructor(t, o, ...p){
		this.type = t;
		this.origin = o;
		this.points = p;
	}
	static rect(o, w, h){
		let c = new col("r", o, vec.n(0,0), vec.n(0+w,0), vec.n(0+w,0+h), vec.n(0,0+h));
		c.width = w;
		c.height = h;
		c.solid = false;
		return c;
	}
	static srect(o, w, h){
		let c = new col("r", o, vec.n(0,0), vec.n(0+w,0), vec.n(0+w,0+h), vec.n(0,0+h));
		c.width = w;
		c.height = h;
		c.solid = true;
		return c;
	}
	static circle(o, r){
		let c = new col("c", o, vec.n(0,0));
		c.radius = r;
		return c;
	}
	static line(o, e, t){
		let c = new col("l", o, vec.n(0,0), vec.n(e.x-o.x, e.y-o.y));
		c.thickness = t;
		return c;
	}
}
class player {
	className = "player";
	col = col.rect(vec.n(312,175), 16, 30);
	flipped = false;
	item = "gun";
	skin = "hereford";
	health = 100;
	money = 0;
	cards = [[0,0],[3,12]];
	pName = "NullName";
	constructor(it, sk, he, mo, ca, na){
		this.item = it;
		this.skin = sk;
		this.health = he;
		this.money = mo;
		this.cards = ca;
		if (na != null) this.pName = na;
	}
}
class projectile {
	className = "projectile";
	col;
	flipped = false;
	speed = vec.n(0,0);
	damage = 10;
	life = 10;
	owner = 0;
	constructor(c, s, d, l, o){
		this.col = c;
		this.speed = s;
		this.damage = d;
		this.life = l;
		this.owner = o;
	}
}

class interactable {
	className = "interactable";
	col;
	text = "";
	renderOffset = vec.n(0,0);
	spritename = "";
	funcKey = "";
	short = false;
	constructor(n, rO, c, t, fk, s){
		this.spritename = n;
		this.renderOffset = rO;
		this.col = c;
		this.text = t;
		this.funcKey = fk;
		this.short = s;
	}
	static short(n, rO, c, fk, t){
		return new interactable(n, rO, c, t, fk, true);
	}
	static tall(n, rO, c, fk, t){
		return new interactable(n, rO, c, t, fk, false);
	}
}

const sceneInteractables = {
	"selection":[],
	"lobby":[
		interactable.short("blackjack", vec.n(16,8), col.rect(vec.n(40,112), 160, 79), "bj", "'E' for Blackjack"),
		interactable.short("roulette", vec.n(16,8), col.rect(vec.n(40,232), 160, 79), "rl", "'E' for Roulette"),
		interactable.short("poker", vec.n(16,8), col.rect(vec.n(440,112), 160, 79), "pk","'E' for Poker"),
		interactable.short("fight", vec.n(16,8), col.rect(vec.n(440,232), 160, 79), "ff", "'E' to Fight"),
		interactable.short("shop", vec.n(0,0), col.rect(vec.n(448,16), 96, 50), "sh", "'E' to Open Shop"),
		interactable.short("bar", vec.n(0,0), col.rect(vec.n(80,22), 128, 62), "ba", "'E' to Get a Drink"),
		interactable.tall("slots", vec.n(4,4), col.rect(vec.n(300, 16), 40,68), "sl", "'E' to Spin")
	],
	"blackjack":[],
	"roulette":[],
	"poker":[],
	"brawl":[]
}

const sceneColliders = {
	"selection":[],
	"lobby": [
		col.srect(vec.n(0,0), 16, 360),
		col.srect(vec.n(0,0), 640, 39),
		col.srect(vec.n(640-16,0), 16, 360),
		col.srect(vec.n(0,360-16), 640, 16),
		col.srect(vec.n(96,0), 96, 55),
		col.srect(vec.n(304,20), 32,31),
		
		col.srect(vec.n(56,134), 128, 21),
		col.srect(vec.n(56,254), 128, 21),
		col.srect(vec.n(456,134), 128, 21),
		col.srect(vec.n(456,254), 128, 21),
	],
	"blackjack":[],
	"roulette":[],
	"poker":[],
	"brawl":[]
}

function arrPop(array, index){
	return array.slice(0, index).concat(array.slice(index+1));
}

function collide(a, b){
	if (b.type == "r" && b.solid){
		let aCntr = vec.avg(a.origin, ...a.points);
		let bCntr = vec.avg(b.origin, ...b.points);
		let tWidth = (a.width+b.width)/2;
		let tHeight = (a.height+b.height)/2;
		let xDist = Math.abs(aCntr.x - bCntr.x);
		let yDist = Math.abs(aCntr.y - bCntr.y);
		
		if (xDist < tWidth && yDist < tHeight){
			if (xDist/tWidth < yDist/tHeight){
				return vec.n(0, (bCntr.y<aCntr.y?1:-1)*(tHeight - yDist));
			} else {
				return vec.n((bCntr.x<aCntr.x?1:-1)*(tWidth - xDist),0);
			}
		}
		return 0;
	} return -1;
}

function overlap(a, b){
	if (b.type == "l"){
		b.points[1].y += b.points[1].y==0?0.000001:0; 
		let m = (b.points[1].y/b.points[1].x);
		let c = b.origin.y - m*b.origin.x;
		let mid = vec.avg(a.origin, ...a.points);
		
		if (mid.y - m*mid.x < c){
			let phi = Math.atan(m);
			c = c - (b.thickness/Math.cos(phi));
			let edgeCheck = false;
			let endCheck = false;
			
			for (let i = 0; i < 4; i++){
				let edge = false;
				let x = a.points[i].x + a.origin.x;
				let y = a.points[i].y + a.origin.y;
				
				let t = b.points[1].y > 0;
				let abv = t?vec.add(b.points[1],b.origin):b.origin;
				let blw = t?b.origin:vec.add(b.points[1]+b.origin);
				let im = 1/(m==0?m+0.000001:m);
				
				if (y - m*(x) > c) {edgeCheck = true; edge = true;}
				let endCon = (y + x/m > blw.y + blw.x/m && y + x/m < abv.y + abv.x/m) 
				if (endCon && edge) { endCheck = true;
				} else if (endCon && !edge) {
					let xoff = Math.abs(b.thickness * Math.sin(phi) * 0.9);
					let yoff = Math.abs(b.thickness * Math.cos(phi) * 0.9);
					let t = blw.x < abv.x;
					let lft = t?blw.x:abv.x;
					let rgt = t?abv.x:blw.x;
					if ((x > lft - xoff && x < rgt +xoff) && (y > blw.y - yoff && y < abv.y + yoff)){
						endCheck = true;
					}
				}
				if (edgeCheck && endCheck) return 1;
			} return 0;
		} else if (mid.y - m*mid.x > c) {
			let phi = Math.atan(m);
			c = c + (b.thickness/Math.cos(phi));
			let edgeCheck = false;
			let endCheck  = false;
			for (let i = 0; i < 4; i++){
				let edge = false
				let x = a.points[i].x + a.origin.x;
				let y = a.points[i].y + a.origin.y;
				
				let t = b.points[1].y > 0;
				let abv = t?vec.add(b.points[1],b.origin):b.origin;
				let blw = t?b.origin:vec.add(b.points[1]+b.origin);
				let im = 1/(m==0?m+0.000001:m);
				
				if (y - m*(x) < c) {edgeCheck = true; edge = true}
				let endCon = (y + x/m > blw.y + blw.x/m && y + x/m < abv.y + abv.x/m)
				if (endCon && edge) { endCheck = true;
				} else if (endCon && !edge) {
					let xoff = Math.abs(b.thickness * Math.sin(phi) * 0.9);
					let yoff = Math.abs(b.thickness * Math.cos(phi) * 0.9);
					let t = blw.x < abv.x;
					let lft = t?blw.x:abv.x;
					let rgt = t?abv.x:blw.x;
					if ((x > lft - xoff && x < rgt +xoff) && (y > blw.y - yoff && y < abv.y + yoff)){
						endCheck = true;
					}
				}
				if (edgeCheck && endCheck) return 1;
			} return 0;
		} else {
			return 1;
		}
	} else if (b.type == "r" && !b.solid){
		let aCntr = vec.avg(a.origin, ...a.points);
		let bCntr = vec.avg(b.origin, ...b.points);
		
		if (Math.abs(aCntr.x - bCntr.x) < (a.width + b.width)/2 && Math.abs(aCntr.y - bCntr.y) < (a.height+b.height)/2){
			return 1;
		}
		return 0;
	} else if (b.type == "c"){
		for (let i = 0; i < 4; i++){
			if (vec.distance(vec.add(a.origin,a.points[i]),b.origin) < b.radius){
				return 1;
			}
		}
		let aCntr = vec.avg(a.origin, ...a.points);
		let xdif = Math.abs(aCntr.x - b.origin.x);
		let ydif = Math.abs(aCntr.y - b.origin.y);
		if ((xdif < b.radius + a.width/2 && ydif < a.height/2) || (ydif < b.radius + a.height/2 && xdif < a.width/2)){
			return 1;
		}
		return 0;
	}
}


function collisionHandler(id, p){
	for (let c = 0; c < gameManager.games[id].colliders.length; c++){
		let adj = collide(p.col, gameManager.games[id].colliders[c]);
		if (typeof(adj) == 'object'){
			p.col.origin = vec.add(p.col.origin, adj);
		}
	}	
}

function projectileHandler(id){
	
}

server.on('connection', (socket) => {
	console.log("connected");
	let id;
	socket.on('message', (message) => {
		message = message.toString();
		if (message[0] == 'h'){
			let args = message.split("\x1F");
			if (gameManager.games[args[2]] == null){
				id = args[1]+args[2];
				let nGame = new game(args[2]);
				nGame.players.push(new player("", args[3], 100, 0, [], args[1]));
				nGame.votes[args[1]] = 0;
				gameManager.games[args[2]] = nGame;
				gameManager.collisionHandlers[args[2]] = collisionHandler;
				gameManager.playerMem[args[2]] = {};
				socket.send(JSON.stringify(nGame));
			} else {socket.send(-1); console.log("room not made");}
		} else if (message[0] == 'j') {
			console.log("joining");
			let args = message.split("\x1F");
			let game = gameManager.games[args[2]];
			if (game != null){
				if (game.players.find(x => x.pName == args[1]) != null){socket.send(-2); return 0;}
				if (game.players.length == 4){socket.send(-3); return 0;}
				id = args[1]+args[2];
				if (gameManager.playerMem[args[2]][args[1]] != null) {
					game.players.push(gameManager.playerMem[args[2]][args[1]]);
					delete gameManager.playerMem[args[2]][args[1]];
				} else game.players.push(new player("", args[3], 100, 0, [], args[1]));
				game.votes[args[1]] = 0;
				socket.send(JSON.stringify(game));
			} else {socket.send(-1);}
		} else if (message[0] == "m") {
			let args = message.split("\x1F");
			let game = gameManager.games[args[1]];
			if (game != null){
				let pIndx = game.players.findIndex(x => x.pName == args[2]);
				let player = game.players[pIndx]; 
				if (player != null){
					player.col.origin = vec.add(player.col.origin, vec.n(args[3],args[4]));
					player.flipped = parseInt(args[5]);
					gameManager.collisionHandlers[args[1]](args[1], player);
					socket.send(JSON.stringify(game));
				}
			}
		} else if (message[0] == "c") {
			let args = message.split("\x1F");
			gameManager.games[args[1]].currentRound = args[2];
			gameManager.games[args[1]].colliders = sceneColliders[args[2]];
			gameManager.games[args[1]].interactables = sceneInteractables[args[2]];
		} else if (message[0] == "v") {
			let args = message.split("\x1F");
			let game = gameManager.games[args[1]];
			if (game.votes[args[2]] == args[3]) game.votes[args[2]] = 0;
			else game.votes[args[2]] = args[3]; 
		} else {
			console.log(message);
		}
	});	
	
	socket.on('close', (...args) => {
		if (id != null) {
			let pId = id.slice(0, -4);
			let gId = id.slice(-4);
			let pIndx = gameManager.games[gId].players.findIndex(x => x.pName == pId);
			gameManager.playerMem[gId][pId] = gameManager.games[gId].players[pIndx];
			gameManager.games[gId].players = arrPop(gameManager.games[gId].players, pIndx);
			delete gameManager.games[gId].votes[pId];
			if (gameManager.games[gId].players.length == 0){
				delete gameManager.games[gId];
				clearInterval(gameManager.collisionHandlers[gId]);
				delete gameManager.collisionHandlers[gId];
				delete gameManager.playerMem[gId];
			}
		}
	});
});
