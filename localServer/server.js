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
class gameObj{
	className = "game";
	id = 0;
	currentScene = "lobby";
	currentPlayer;
	turnOptions;
	remRounds = 0;
	maxRounds = 0;
	votes = {};
	players = [];
	dealer = {"cards":[]};
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
	item = {};
	skin = "hereford";
	health = 100;
	money = 1000;
	bet = 0;
	cards = [[]];
	currentHand = 0;
	pName = "NullName";
	constructor(st, sk, he, mo, na){
		this.stats = st;
		this.skin = sk;
		this.health = he;
		this.money = mo;
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

class card {
	className = "card";
	suit;
	value;
	faceDown;
	constructor(s, v, f){
		this.suit = s;
		this.value = v;
		this.faceDown = f;
	}
}

let kts = {
	"bj" : "blackjack",
	"rl" : "roulette",
	"pk" : "poker",
	"ff" : "fight"
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
		col.srect(vec.n(16,0), 608, 39),
		col.srect(vec.n(640-16,0), 16, 360),
		col.srect(vec.n(16,360-16), 608, 16),
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
			if (tWidth-xDist > tHeight-yDist){
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
				m = 1/(m==0?m+0.000001:m);
				
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


function collisionHandler(game, p){
	for (let c = 0; c < game.colliders.length; c++){
		let adj = collide(p.col, game.colliders[c]);
		if (typeof(adj) == 'object'){
			p.col.origin = vec.add(p.col.origin, adj);
		}
	}	
}

function projectileHandler(id){
	
}

let blackjackMemoryTemplate = {
	"winRates" : {},
	"cards":[],
	"divider":70,
	"valueLookup" : {
		0 : 2,
		1 : 3,
		2 : 4,
		3 : 5,
		4 : 6,
		5 : 7,
		6 : 8,
		7 : 9,
		8 : 10,
		9 : 10,
		10 : 10,
		11 : 10,
		12 : [1,11]
	},
	"dealerSum" : 0
};

let blackjackMemory = {};

const blackjackFuncs = {
	"reshuffle" : (game) => {
		let mem = blackjackMemory[game.id];
		let cards = [];
		let divider = 60 + Math.round(Math.random() * 15);
		for (let i = 0; i < 6; i++){ //create a random deck consisting of 6 52 card decks
			for (let i = 0; i < 52; i++){
				cards.push(new card(Math.floor(i/13)%4, i%13, 0));
			}
		}
		cards = cards.map((a) => ({ sort: Math.random(), value: a })).sort((a, b) => a.sort - b.sort).map((a) => a.value);
		return [cards, divider];
	},
	"checkHand" : (p, checkBJ) => {
		console.log("checking...");
		let turn = "bjturn";
		let blackjack = false;
		let mem = blackjackMemoryTemplate;
		if (p.bet > 0 && p.money >= 0 && p.money >= p.bet){	
			let hand = p.cards[p.currentHand];
			if (checkBJ && hand[0].value + mem.valueLookup[hand[1].value] == 22 || hand[1].value + mem.valueLookup[hand[0].value] == 22) blackjack = true;
			let sumHand = 0;	
			for (let i = 0; i < hand.length; i++){
				if (hand[i].value == 12) sumHand += 1;
				else sumHand += mem.valueLookup[hand[i].value];
			}
			console.log(hand);
			console.log(sumHand);
			if (sumHand > 8 && sumHand < 12) turn += "double";
			console.log(hand.length);
			if (mem.valueLookup[hand[0].value] == mem.valueLookup[hand[1].value] && hand.length == 2) turn += "split";
		}
		let result = {"turn":turn};
		if (checkBJ) result.bj = blackjack;
		return result;
	},
	"split" : async function(game, p){
		p.cards.splice(p.currentHand+1, 0, []);
		p.cards[p.currentHand+1].push(p.cards[p.currentHand].pop());
		let addCards = [blackjackMemory[game.id].cards.shift(), blackjackMemory[game.id].cards.shift()];
		if (p.cards[p.currentHand][0].value == 12){
			addCards[0].faceDown = 1;
			addCards[1].faceDown = 1;
		}
		await new Promise(r => (setTimeout(r, 500)));
		p.cards[p.currentHand].push(addCards.shift());
		await new Promise(r => (setTimeout(r, 500)));
		p.cards[p.currentHand+1].push(addCards.shift());
		let handCheck = blackjackFuncs.checkHand(p, true);
		if (p.cards[p.currentHand][0].value == 12) blackjackFuncs.next(game);
		else if (handCheck.bj) blackjackFuncs.next(game);
		else game.turnOptions = handCheck.turn;
	},
	"start" : (game) => {
		if (game.currentScene == "blackjack") blackjackFuncs.clear(game);
		game.remRounds = 1;
		let mem = blackjackMemory[game.id];
		game.dealer.cards = [];
		let temp = blackjackFuncs.reshuffle(game);
		mem.cards = temp[0];
		mem.divider = temp[1];
		game.currentPlayer = game.players[0].pName;
		game.turnOptions = "bjbet";
		console.log(blackjackMemory);
	},
	"deal" : async function(game){
		try {
			let mem = blackjackMemory[game.id];	
			if (mem.cards.length == 0){
				console.log("empty!!");
				let temp = blackjackFuncs.reshuffle(game);
				mem.cards = temp[0];
				mem.divider = temp[1];
			}
			game.turnOptions = "none";
			let validPlayerIndexes = [];
			for (let i = 0; i < game.players.length; i++){
				console.log(game.players[i].money + game.players[i].bet);
				if (game.players[i].money + game.players[i].bet >= 1) validPlayerIndexes.push(i);
			}
			
			for (let j = 0; j < 2; j++){
				for (let i = 0; i < validPlayerIndexes.length; i++){
					await new Promise(r => setTimeout(r, 500));
					game.players[validPlayerIndexes[i]].cards[0].push(mem.cards.shift());
				}
				await new Promise(r => setTimeout(r, 500));
				let tcard = mem.cards.shift();
				tcard.faceDown = j;
				game.dealer.cards.push(tcard);
			}
			let handCheck = blackjackFuncs.checkHand(game.players[0], true);
			console.log(handCheck);
			if (handCheck.bj) {
				game.currentPlayer = game.players[validPlayerIndexes[0]].pName ?? "none";
				blackjackFuncs.next(game);
			}
			else {
				game.turnOptions = handCheck.turn;
				game.currentPlayer = game.players[validPlayerIndexes[0]].pName ?? "none";
			}
			
		} catch(e) {
			console.log(e);
		}
		console.log(blackjackMemory);
	},
	"next": async function(game){
		console.log("NEXT");
		let mem = blackjackMemory[game.id];
		try{
			let playerIndex = game.players.findIndex((x) => {return x.pName == game.currentPlayer});
			console.log(playerIndex);
			console.log(game.currentPlayer);
			if (game.players[playerIndex].currentHand+1 >= game.players[playerIndex].cards.length){
				playerIndex += 1;
				if (playerIndex < game.players.length) game.players[playerIndex].currentHand = 0;
			} else if (game.players[playerIndex].currentHand+1 < game.players[playerIndex].cards.length){
				game.players[playerIndex].currentHand += 1;
			}
			game.currentPlayer = "\x1F";
			if (playerIndex < game.players.length && playerIndex != -1){
				if (game.players[playerIndex].cards[0].length != 0){
					let handCheck = blackjackFuncs.checkHand(game.players[playerIndex], true);
					if (handCheck.bj || game.players[playerIndex].cards[game.players[playerIndex].currentHand].at(-1).faceDown == 1) {
						game.currentPlayer = game.players[playerIndex].pName;
						blackjackFuncs.next(game);
					}
					else {
						game.turnOptions = handCheck.turn;
						game.currentPlayer = game.players[playerIndex].pName;
					}
				} else {
					game.currentPlayer = game.players[playerIndex].pName;
					blackjackFuncs.next(game);
				}
			} else {
				game.turnOptions = "none";
				game.currentPlayer = "\x1F";
				await new Promise(r => setTimeout(r, 500));
				game.dealer.cards[1].faceDown = 0;
				for(;;){
					mem.dealerSum = 0;
					let dealerAces = 0;
					await new Promise(r => setTimeout(r, 500));
					for (let i = 0; i < game.dealer.cards.length; i++){
						if (game.dealer.cards[i].value == 12) dealerAces += 1;
						else mem.dealerSum += mem.valueLookup[game.dealer.cards[i].value];
					}
					for (let i = 0; i < dealerAces; i++){
						if (mem.dealerSum + 11 > 21) mem.dealerSum += 1;
						else mem.dealerSum += 11;
					}
					if (mem.dealerSum > 16) break;
					game.dealer.cards.push(mem.cards.shift());
				}
				blackjackFuncs.cashout(game);
			}
		} catch (e) {
			console.log(e);
		}
	},
	"cashout": async function(game){
		let mem = blackjackMemory[game.id];
		console.log("CASHOUT");
		console.log(blackjackMemory);
		console.log(game.dealer.cards);
		try {
			for(let j = 0; j < game.players.length; j++){
				mem.winRates[game.players[j].pName] = [];
				for (let k = 0; k < game.players[j].cards.length && game.players[j].cards[0].length > 0; k++){
					let doubled = 0;
					mem.winRates[game.players[j].pName].push(0);
					let aces = 0
					let sum = 0;
					for (let i = 0; i < game.players[j].cards[k].length; i++){
						if (game.players[j].cards[k][i].faceDown == 1) {
							if (game.players[j].cards[k].length > 2) doubled = 1;
							game.players[j].cards[k][i].faceDown = 0;
						}
						if (game.players[j].cards[k][i].value == 12) aces += 1;
						else sum += mem.valueLookup[game.players[j].cards[k][i].value];
					}
					for (let i = 0; i < aces; i++){
						if (sum + 11 > 21) sum += 1;
						else sum += 11;
					}
					
					if (sum == 21 && game.players[j].cards[k].length == 2 && game.players[j].cards.length == 1){
						if (mem.dealerSum == 21 && game.dealer.cards.length == 2) mem.winRates[game.players[j].pName][k] = 1;
						else mem.winRates[game.players[j].pName][k] = 2.5;
					} else if (sum > 21) mem.winRates[game.players[j].pName][k] = 0;
					else if (mem.dealerSum > 21) mem.winRates[game.players[j].pName][k] = 2;
					else if (mem.dealerSum > sum) mem.winRates[game.players[j].pName][k] = 0;
					else if (mem.dealerSum == sum) mem.winRates[game.players[j].pName][k] = 1;
					else if (mem.dealerSum < sum) mem.winRates[game.players[j].pName][k] = 2;
					if (doubled == 1) mem.winRates[game.players[j].pName][k] *= 2;
				}
			}
			for (let j = 0; j < game.players.length; j++){
				for (let k = 0; k < game.players[j].cards.length; k++){
					game.players[j].money += game.players[j].bet * (mem.winRates[game.players[j].pName][k] ?? 0);
					game.players[j].money = Math.round(game.players[j].money);
				}
				game.players[j].bet = 0;
			}
			
			game.currentPlayer = "none";
			await new Promise(r => setTimeout(r, 2000));
			blackjackFuncs.clear(game, false);
			if (mem.cards.length == mem.divider){
				let t = blackjackFuncs.shuffle(game);
				mem.divider = t[1];
				mem.cards = t[0];
			}
			
			if (game.remRounds < game.maxRounds){
				game.remRounds += 1;
				game.currentPlayer = game.players[0].pName;
				game.turnOptions = "bjbet";
				blackjackFuncs.clear(game, false);
			} else {
				game.turnOptions = "none";
				game.currentPlayer = "\x1F";
				game.currentScene = "lobby";
				game.colliders = sceneColliders["lobby"];
				game.interactables = sceneInteractables["lobby"];
				blackjackFuncs.clear(game, true);	
			}
			
		} catch(e) {
			console.log(e);
		}
	},
	"clear": (game, comp) => {
		let mem = blackjackMemory[game.id];
		game.dealer.cards = [];
		for (let i = 0; i < game.players.length; i++){
			game.players[i].cards = [[]];
			game.players[i].currentHand = 0;
		} 
		if (comp) delete blackjackMemory[game.id];
	},
	"disconnect" : async function(game, playerIndex){
		if (game.turnOptions.slice(0,6) == "bjturn"){
			playerIndex -= 1; 
			blackjackFuncs.next(game);
		}
		else if (game.turnOptions == "bjbet"){
			if (playerIndex+1 < game.players.length) game.currentPlayer = game.players[playerIndex+1].pName;
			else {game.currentPlayer = "none"; blackjackFuncs.deal(game);}
		}
	}
}

server.on('connection', (socket) => {
	console.log("connected");
	let id;
	let game;
	let playerIndex;
	let riId;
	
	function refreshIndex(){
		playerIndex = game.players.findIndex((x) => {return x.pName == id.slice(0,-4)});
	}
	
	socket.on('message', (message) => {
		message = message.toString();
		if (message[0] == 'h'){
			let args = message.split("\x1F");
			if (gameManager.games[args[2]] == null){
				id = args[1]+args[2];
				let nGame = new gameObj(args[2]);
				nGame.players.push(new player({}, args[3], 100, 1000, args[1]));
				playerIndex = 0;
				nGame.votes[args[1]] = 0;
				nGame.maxRounds = parseInt(args[4]);
				nGame.currentScene = "lobby";
				nGame.interactables = sceneInteractables.lobby;
				nGame.colliders = sceneColliders.lobby;
				console.log(nGame);
				gameManager.games[args[2]] = nGame;
				game = gameManager.games[args[2]];
				gameManager.collisionHandlers[args[2]] = collisionHandler;
				gameManager.playerMem[args[2]] = {};
				socket.send("r\x1F" + JSON.stringify(nGame));
				riId = setInterval(refreshIndex,100);
			} else {socket.send(-1); console.log("room not made");}
		} else if (message[0] == 'j') {
			console.log("joining");
			let args = message.split("\x1F");
			game = gameManager.games[args[2]];
			if (game != null){
				console.log("1", game.players[0].cards[0].length);
				if (game.players.find(x => x.pName == args[1]) != null){socket.send(-2); return 0;}
				console.log("2", game.players[0].cards[0].length);
				if (game.players.length == 4){socket.send(-3); return 0;}
				console.log("3", game.players[0].cards[0].length);
				id = args[1]+args[2];
				console.log("4", game.players[0].cards[0].length);
				playerIndex = game.players.length;
				console.log("5", game.players[0].cards[0].length);
				console.log(playerIndex);
				if (gameManager.playerMem[args[2]][args[1]] != null) {
					console.log("6a", game.players[0].cards[0].length);
					let tempPlayer = gameManager.playerMem[args[2]][args[1]];
					console.log(tempPlayer);
					tempPlayer.bet = 0;
					game.players.push(tempPlayer);
					console.log("7a", game.players[0].cards[0].length);
					delete gameManager.playerMem[args[2]][args[1]];
					console.log("8a", game.players[0].cards[0].length);
				} else game.players.push(new player({}, args[3], 100, 1000, args[1]));
				console.log("9", game.players[0].cards[0].length);
				game.votes[args[1]] = 0;
				console.log("10", game.players[0].cards[0].length);
				socket.send("r\x1F" + JSON.stringify(game));
				console.log("11", game.players[0].cards[0].length);
				riId = setInterval(refreshIndex,100);
				console.log("12", game.players[0].cards[0].length);
			} else {socket.send(-1);}
		} else if (message[0] == "m") {
			let args = message.split("\x1F")
			if (game != null){
				let player = game.players[playerIndex]; 
				if (player != null){
					player.col.origin = vec.add(player.col.origin, vec.n(args[3],args[4]));
					player.flipped = parseInt(args[5]);
					gameManager.collisionHandlers[game.id](game, player);
					socket.send("r\x1F" + JSON.stringify(game));
				}
			}
		} else if (message[0] == "c") {
			let args = message.split("\x1F");
			game.currentScene = args[2];
			game.colliders = sceneColliders[args[2]];
			game.interactables = sceneInteractables[args[2]];
		} else if (message[0] == "v") {
			let args = message.split("\x1F");
			console.log("vote");
			if (game.votes[args[2]] == args[3]) game.votes[args[2]] = 0;
			else game.votes[args[2]] = args[3]; 
			
			let count = 0;
			for (let v in game.votes) {count += (game.votes[v]==args[3])};
			console.log(`${count}/${game.players.length}`);
			if (count == Math.max(2, game.players.length)){
				console.log(`proceed with ${args[3]}`);
				for (let v in game.votes) {game.votes[v] = 0;}
				if (args[3] == "bj" || args[3] == "rl"){
					let t = kts[args[3]]
					game.currentScene = t;
					game.colliders = sceneColliders[t];
					game.interactables = sceneInteractables[t];
					if (args[3] == "bj"){
						blackjackMemory[game.id] = {};
						for (let i in blackjackMemoryTemplate){
							blackjackMemory[game.id][i] = blackjackMemoryTemplate[i];
						}
						console.log(blackjackMemory);
						blackjackFuncs.start(game);
						console.log(blackjackMemory);
					} else if (args[3] == "rl") {
						console.log("start roulette");
					}
				}
			}
			
		} else if (message[0] == "r"){
			let args = message.split("\x1F");
			if (game != null){
				socket.send("r\x1F" + JSON.stringify(game));
			}
		} else if (message[0] == "a") {
			let args = message.split("\x1F");
			
			console.log(`recieved action ${args[3]}`);
			console.log(playerIndex);
			let p = game.players[playerIndex];
			if (game.turnOptions == "bjbet" && game.currentPlayer == p.pName){
				if (args[3] != null){
					if (args[3] > 0){
						p.bet = args[3];
						p.money -= args[3];
						if (playerIndex+1 < game.players.length) game.currentPlayer = game.players[playerIndex+1].pName;
						else {game.currentPlayer = "\x1F"; blackjackFuncs.deal(game);}
					} else if (args[3] == 0 && game.players[playerIndex].money == 0){
						if (playerIndex+1 < game.players.length) game.currentPlayer = game.players[playerIndex+1].pName;
						else {game.currentPlayer = "\x1F"; blackjackFuncs.deal(game);}
					}
				}
			} 
			if (game.turnOptions.slice(0,6) == "bjturn" && game.currentPlayer == p.pName){
				if (args[3] == "h"){
					p.cards[p.currentHand].push(blackjackMemory[game.id].cards.shift())
					let handSum = 0;
					for (let i = 0; i < p.cards[p.currentHand].length; i++){
						let temp = blackjackMemory[game.id].valueLookup[p.cards[p.currentHand][i].value];
						if (typeof(temp) == "object") handSum += 1;
						else handSum += temp; 
					}
					console.log(handSum);
					if (handSum > 21) {
						blackjackFuncs.next(game);
					} else {
						game.turnOptions = blackjackFuncs.checkHand(p).turn;
					}
				}
				else if (args[3] == "p") {
					p.money -= p.bet;
					blackjackFuncs.split(game, p);
				}
				else if (args[3] == "d") {
					p.money -= p.bet;
					let temp = blackjackMemory[game.id].cards.shift();
					temp.faceDown = 1;
					p.cards[p.currentHand].push(temp);
					blackjackFuncs.next(game);
				}
				else if (args[3] == "s") blackjackFuncs.next(game);
			}
		} else {
			console.log("unmatched message : " + message);
		}
	});	

	socket.on('close', (...args) => {
		if (id != null) {
			clearInterval(riId);
			let pId = id.slice(0, -4);
			let gId = id.slice(-4);
			if (game.currentPlayer == pId){
				if (game.currentScene == "blackjack") {
					blackjackFuncs.disconnect(game, playerIndex);
				}
			}
			gameManager.playerMem[gId][pId] = game.players[playerIndex];
			game.players = arrPop(gameManager.games[gId].players, playerIndex);
			delete game.votes[pId];
			console.log("player left");
			if (game.players.length == 0){
				console.log("closing room");
				delete gameManager.games[gId];
				clearInterval(gameManager.collisionHandlers[gId]);
				delete gameManager.collisionHandlers[gId];
				delete gameManager.playerMem[gId];
			}
		}
	});
});
