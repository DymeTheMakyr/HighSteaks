const WebSocket = require('ws');

const server = new WebSocket.Server({host:'0.0.0.0', port : 8000 });

let games = [];

function vec2(x, y){
	return {"x":parseFloat(x), "y":parseFloat(y)};
}
function addVec(a,b){
	return vec2(a.x+b.x, a.y+b.y);
}
function avgVec(off, ...vecs){
	let x = 0;
	let y = 0;
	vecs.forEach(v => {x += v.x; y += v.y;});
	x = Math.round(x/vecs.length);
	y = Math.round(y/vecs.length);
	return vec2(off.x+x, off.y+y);
}
function setPos(obj, x, y){
	obj.col.origin = {"x":x, "y":y};
}
class game{
	id = 0;
	players = [];
	projectiles = [];
	locked = 0;
	constructor(args) {
		this.id=args;
	}
}
class col {
	origin = vec2(0,0);
	points = [];
	type = "r";
	constructor(t, o, ...p){
		this.type = t;
		this.origin = o;
		this.points = p;
	}
	static rect(o, w, h){
		let c = new col("r", o, vec2(0,0), vec2(0+w,0), vec2(0+w,0+h), vec2(0,0+h));
		return c;
	}
	static sphere(o, r){
		let c = new col("s", o, vec2(0,0));
		c.radius = r;
		return c;
	}
	static line(o, e, t){
		let c = new col("l", o, vec2(0,0), vec2(e.x-o.x, e.y-o.y));
		c.thickness = t;
		return c;
	}
}
class player {
	col = col.rect(vec2(50,50), 16, 30);
	flipped = false;
	item = "gun";
	skin = "hereford";
	health = 100;
	money = 0;
	cards = [[0,0],[3,12]];
	pName = "";
	constructor(it, sk, he, mo, ca, na){
		this.item = it;
		this.skin = sk;
		this.health = he;
		this.money = mo;
		this.cards = ca;
		this.pName = na;
	}
}
class projectile {
	col;
	flipped = false;
	speed = new vec2(0,0);
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

function arrPop(array, index){
	return array.slice(0, index).concat(array.slice(index+1));
}

function overlap(a, b){
	if (b.type == "l"){
		b.points[1].y += b.points[1].y==0?0.000001:0; 
		let m = (b.points[1].y/b.points[1].x);
		let c = b.origin.y - m*b.origin.x;
		let mid = avgVec(a.origin, ...a.points);
		if (mid.y - m*mid.x < c){
			let phi = Math.atan(m);
			c = c - (b.thickness/Math.cos(phi));
			for (let i = 0; i < 4; i++){
				let p = addVec(a.points[i], a.origin);
				if (p.y - m*(p.x) > c){
					let test = (b.points[1].y>0);
					console.log(test, b.points[1].y)
					let abv = test?addVec(b.origin,b.points[1]):b.origin;
					let blw = test?b.origin:addVec(b.origin,b.points[1]);
					m = 1/(m==0?0.000001:0);
					c = p.y + (p.x/m);
					console.log(c, abv.y+(abv.x/m), blw.y+(blw.x/m));
					if (c < abv.y + (abv.x/m) && c > blw.y + (blw.x/m)) {
						return 1;
					}
				}
			} return 0;
		} else if (mid.y - m*mid.x > c) {
			let phi = Math.atan(m);
			c = c + (b.thickness/Math.cos(phi));
			for (let i = 0; i < 4; i++){
				let p = addVec(a.points[i], a.origin);
				if (p.y - m*(p.x) > c){
					let test = (b.points[1].y>0);
					console.log(test, b.points[1].y);
					let abv = test?addVec(b.origin,b.points[1]):b.origin;
					let blw = test?b.origin:addVec(b.origin,b.points[1]);
					m = 1/(m==0?0.000001:0);
					c = p.y + (p.x/m);
					console.log(c, abv, blw, abv.y+(abv.x/m), blw.y+(blw.x/m));
					if (c < abv.y + (abv.x/m) && c > blw.y + (blw.x/m)) {
						return 1;
					}
				}
			} return 0;
		} else {
			return 1;
		}
	} else if (b.type == "r"){
		
	} else if (b.type == "s"){
	
	}
}
function temp(){
	console.log("-"*100);
	console.log("dia",overlap(games[0].players[0].col, games[0].projectiles[0].col));
	console.log("lft",overlap(games[0].players[0].col, games[0].projectiles[1].col));
	console.log("rgt",overlap(games[0].players[0].col, games[0].projectiles[2].col));
}

function colliderTest(){
	console.log(1);
	if (games.length>0){
		console.log(2);
		games[0].projectiles.push(new projectile(col.line(vec2(0,0), vec2(640,360), 20), 0, 0, 0, 0));
		games[0].projectiles.push(new projectile(col.line(vec2(100,100), vec2(300,260), 10), 0, 0, 0, 0));
		games[0].projectiles.push(new projectile(col.line(vec2(540,0), vec2(340,360), 15), 0, 0, 0, 0));
		console.log(3);
		if (games[0].players.length>0){
			console.log(4);
			setInterval(temp,1000);
		}
	}	
}

server.on('connection', (socket) => {
	console.log("connected");
	let id;
	socket.on('message', (message) => {
		message = message.toString();
		if (message[0] == 'h'){
			let args = message.split("⌥");
			if (games.find(x => x.id == args[2]) == null){
				id = args[1]+args[2];
				let nGame = new game(args[2]);
				nGame.players.push(new player("", args[3], 100, 0, [], args[1]));
				games.push(nGame);
				socket.send(JSON.stringify(nGame));
				colliderTest();
			} else {socket.send(-1); console.log("room not made");}
		} else if (message[0] == 'j') {
			console.log("joining");
			let args = message.split("⌥");
			let game = games.find(x => x.id == args[2]);
			if (game != null){
				if (game.players.find(x => x.pName == args[1]) != null){socket.send(-2); return 0;}
				if (game.players.length == 4){socket.send(-3); return 0;}
				id = args[1]+args[2];
				game.players.push(new player("", args[3], 100, 0, [], args[1]));
				socket.send(JSON.stringify(game));
			} else {socket.send(-1);}
		} else if (message[0] == "m") {
			let args = message.split("⌥");
			let game = games.find(x => x.id==args[1]);
			if (game != null){
				let pIndx = game.players.findIndex(x => x.pName == args[2]);
				let player = game.players[pIndx]; 
				if (player != null){
					player.col.origin = vec2(args[3],args[4]);
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
