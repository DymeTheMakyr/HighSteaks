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
	static sockets = {};
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
	ready = 0;
	info = {
		"bets" : [],
		"pots" : [],
		"minRaise" : 0,
        "call" : 0,
        "folded" : []
	};
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

function sendall(gameid, msg){
	if (gameid in gameManager.sockets){
		for (let i = 0; i < gameManager.sockets[gameid].length; i++){
			gameManager.sockets[gameid][i].send(msg);
		}
	}
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


const rlWheelLookup = [0,23,6,34,4,19,10,31,16,27,18,14,33,12,25,2,21,8,29,3,24,5,28,17,20,7,36,11,32,30,15,26,1,22,9,34,13];

const rlValues = {
	"r" : [
		[ 3, 6, 9,12,15,18,21,24,27,30,33,36],
		[ 2, 5, 8,11,14,17,20,23,26,29,32,35],
		[ 1, 4, 7,10,13,16,19,22,25,28,31,34]
	],
	"re" : [1,3,5,7,9,12,14,16,18,19,21,23,25,27,28,30,32,34,36],
	"bl" : [2,4,6,8,10,11,13,15,17,19,20,22,24,26,29,31,33,35]
	};

const rlSpecialLookup = {
	51 : "d1",
	52 : "d2",
	53 : "d3",
	54 : "e1",
	59 : "e2",
	55 : "ev",
	58 : "od",
	56 : "re",
	57 : "bl",
	61 : "r1",
	62 : "r2",
	63 : "r3"
}

const rouletteFuncs = {
	"spin" : async (game) => {
		let betTotals = {};
		for (let i = 0; i < game.info.bets.length; i++){
			betTotals[game.info.bets[i].owner] = (betTotals[game.info.bets[i].owner]||0) + game.info.bets[i].bet;
		}
		for (let i = 0; i < game.players.length; i++){
			game.players[i].money -= betTotals[game.players[i].pName]||0;
		}
		game.turnOptions = "spinning";
		let val = Math.round(Math.random() * 37) - 1;
		console.log(val, " @ ", rlWheelLookup[val]);
		sendall(game.id, `a\x1Frl\x1F${rlWheelLookup[val]}`);
		await new Promise(resolve => setTimeout(resolve, 12000));
		rouletteFuncs.cashout(game, val);
	},
	"cashout" : (game, val) => {
		let payouts = {}
		for (let i = 0; i < game.info.bets.length; i++){
			let b = game.info.bets[i];

			if (!(b.owner in payouts)) payouts[b.owner] = 0;
			if (b.val > 50){
				let spec = rlSpecialLookup[b.val];
				if (spec[0] == "d" && (spec[1]-1)*12 < val && val <= (spec[1])*12) payouts[b.owner] += b.bet * 3;
				else if (spec[0] == "e" && (spec[1]-1)*18 < val && val <= (spec[1])*18) payouts[b.owner] += b.bet * 2;
				else if (spec == "ev" && val%2 == 0 && val > 0) payouts[b.owner] += b.bet * 2;
				else if (spec == "od" && val%2 == 1) payouts[b.owner] += b.bet * 2;
				else if (spec == "re" && rlValues.re.includes(val)) payouts[b.owner] += b.bet*2;
				else if (spec == "bl" && rlValues.bl.includes(val)) payouts[b.owner] += b.bet*2;
				else if (spec[0] == "r" && spec[1] > 0 && rlValues.r[spec[1]-1].includes(val)) payouts[b.owner] += b.bet*3;
			} else {
				if (b.pos[2] == 0.5 && b.pos[3] == 0.5){
					if (b.pos[1] == 2.5){
						if (b.val == 0 && val <= 3) payouts[b.owner] += b.bet * 9;
						else if (b.val <= val && val < b.val+6) payouts[b.owner] += b.bet * 6;
					} else {
						let posVal = [b.val-1, b.val, b.val+2, b.val+3];
						if (posVal.includes(val)) payouts[b.owner] += b.bet * 9;
					}
				} else if (b.pos[2] == 0.5){
					if (val == b.val || val == b.val+3) payouts[b.owner] += b.bet*18;
				} else if (b.pos[3] == 0.5){
					if (b.pos[1] == 2.5 && b.val <= val && val <= b.val+2) payouts[b.owner] += b.bet*12;
					else if (b.pos[1] != 2.5 && val == b.val || val == b.val - 1) payouts[b.owner] += b.bet*18;
				} else {
					if(val == b.val) payouts[b.owner] += b.bet * 36;
				}
			}
		}

		for (let i = 0; i < game.players.length; i++){
			game.players[i].money += payouts[game.players[i].pName]||0;
		}

		game.info.bets = [];
		game.ready = 0;
		if (game.remRounds < game.maxRounds){
			game.turnOptions = "betting";
			game.remRounds += 1;
		} else {
			console.log("to lobby");
			game.turnOptions = "none";
            game.currentPlayer = "\x1E";
			game.currentScene = "lobby";
			game.colliders = sceneColliders["lobby"];
			game.interactables = sceneInteractables["lobby"];
		}
	}
};

const pokerMemTemplate = {
    "phase" : 0,
    "prevRaise" : 0,
    "faiTT" : 0,
    "lastRaise" : 1,
    "pots" : {
        "main" : {
            "sum" : 0,
            "bets" : {},
            "exclude" : []
        },
    },
    "folds" : [],
    current : 0,
    sblind : 0
};

const handRanks = { //0 is highest priority
    "rf" : 0,
    "sf" : 1,
    "4k" : 2,
    "fh" : 3,
    "fl" : 4,
    "st" : 5,
    "3k" : 6,
    "2p" : 7,
    "1p" : 8,
    "hc" : 9
}

let pokerMem = {};

const pokerFuncs = {
    "checkHand" : (game, pIndx) => {
        let seven = [...game.players[pIndx].cards[0]];
        seven.push(...game.dealer.cards);
        let suits = {0:0,1:0,2:0,3:0};
        let allValue = [];
        let ranks = {0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0};
        let flush = 0;
        let groups = [];
        let straight = [0,-10,-10];

        for (let j = 0; j < 7; j++){
            let i = seven[j];
            suits[i.suit] += 1;
            ranks[i.value] += 1;
            if (!allValue.includes(i.value)) allValue.push(i.value);
        }
        allValue.sort((a,b) => b-a);
        console.log(seven.map(x => x.value));
        console.log(allValue);

        for (let i in suits){
            if (suits[i] >= 5){
                flush = [1, i];
            }
        }
        if (allValue.length >= 5){
            let count = 0;
            let maxrun = 0;
            let prev = -20;
            let runStart = -20;
            let runEnd = -20;
            for (let i = 0; i < allValue.length+1; i++){
                let k = (i)%allValue.length;
                if ((allValue[k] == prev + 12) || allValue[k] == prev-1){count += 1; runStart = allValue[k];}
                else { count = 1; runEnd = allValue[k];}
                maxrun = Math.max(count, maxrun);
                if (maxrun == 5) break;
                prev = allValue[k]
            }
            if (maxrun == 5) straight = [1, runStart, runEnd];
        }

        for (let i in ranks){
            if (ranks[i] > 1) groups.push([parseInt(ranks[i]),parseInt(i)]);
        }

        groups.sort((a,b) => 100*(b[0]-a[0]) + b[1]-a[1]);
        while (groups.length < 2){
            groups.push([-1,0]);
        }

        seven.sort((a,b) => b.value-a.value);

        if (straight[0] == 1 && flush[0] == 1 && straight [1] == 8){
            return "rf";
        } else if (straight[0] == 1 && flush[0] == 1){
            return ["sf", straight[2]];
        } else if (groups[0][0] == 4){
            return ["4k", groups[0][1], allValue.filter(x => x != groups[0][1])[0]];
            //check for 5th highest card
        } else if (groups[0][0] == 3 && groups[1][0] >= 2){
            return ["fh", groups[0][1], groups[1][1]];
        } else if (flush[0]) {
            return ["fl", seven.filter(x => x.suit == flush[1]).slice(0,5).map(x => x.value)];
            //check for highest card zipper style
        } else if (straight[0]){
            return ["st", straight[2]];
            //check highest card (ace high OR low)
        } else if (groups[0][0] == 3){
            return ["3k", groups[0][1], seven.filter(x => x.value != groups[0][1]).slice(0,2).map(x => x.value)];
        } else if (groups[0][0] == 2 && groups[1][0] == 2){
            return ["2p", groups[0][1], groups[1][1], allValue.filter(x => x != groups[0][1] && x != groups[1][1])[0]];
            //check for next highest card
        } else if (groups[0][0] == 2) {
            return ["1p", groups[0][1], seven.filter(x => x.value != groups[0][1]).slice(0,3).map(x => x.value)];
            //check for next highest card zipper style
        } else {
            return ["hc", seven.slice(0,5).map(x => x.value)];
            //check for next highest card zipper style
        }
    },
    "compLikeHands" : (h1, h2) => {
        console.log(h1, h2);
        switch (h1[1]){
            case "hc":
                for (let i = 0; i < 5; i++){
                    if (h1[2][i] > h2[2][i]) return h1;
                    if (h2[2][i] > h1[2][1]) return h2;
                }
                break;
            case "1p":
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                for (let i = 0; i < 3; i++){
                    if (h1[3][i] > h2[3][i]) return h1;
                    else if (h2[3][i] > h1[3][1]) return h2;
                }
                break;
            case "2p":
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                if (h1[3] > h2[3]) return h1;
                if (h2[3] > h1[3]) return h2;
                if (h1[4] > h2[4]) return h1;
                if (h2[4] > h1[4]) return h2;
                break;
            case "3k":
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                for (let i = 0; i < 2; i++){
                    if (h1[3][i] > h2[3][i]) return h1;
                    else if (h2[3][i] > h1[3][1]) return h2;
                }
                break;
            case "st":
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                break;
            case "fl":
                for (let i = 0; i < 5; i++){
                    if (h1[2][i] > h2[2][i]) return h1;
                    else if (h2[2][i] > h1[2][1]) return h2;
                }
                break;
            case "fh":
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                if (h1[3] > h2[3]) return h1;
                if (h2[3] > h1[3]) return h2;
                break;
            case "4k":
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                if (h1[3] > h2[3]) return h1;
                if (h2[3] > h1[3]) return h2;
                break;
            case "sf":
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                break;
            case "rf":
                break;
        }
        return [[h1,h2]];
    },
    "deal" : async (game) => {
        pokerMem[game.id] = {...pokerMemTemplate};
        let mem = pokerMem[game.id];
        let cards = [];

        game.info.win = [];

        for (let i = 0; i < 52; i++){
            cards.push(new card(Math.floor(i/13)%4, i%13, 1));
        }
        cards = cards.map((a) => ({ sort: Math.random(), value: a })).sort((a, b) => a.sort - b.sort).map((a) => a.value);

        game.currentPlayer =  "\x1E";
        game.dealer.cards = [];
        game.info.pots = [];
        mem.folds = [];
        game.info.folded = [];

        for (let i = 0; i < game.players.length; i++){
            game.players[i].cards = [[]]
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        for (let i = 0; i < 2; i++){
            for (let j = 0; j < game.players.length; j++){
                game.players[j].cards[0].push(cards.shift());
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        for (let i = 0; i < 5; i++){
            game.dealer.cards.push(cards.shift());
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        if (game.players.length > 1){
            mem.sblind = (game.remRounds - 1)%game.players.length;
            mem.current = mem.sblind;
            mem.lastRaise = (mem.sblind + 1)%game.players.length;
            mem.betStart = 1;
            mem.pots.main.sum = 30;
            game.players[mem.current].money -= 10;
            game.players[(mem.current+1)%game.players.length].money -= 20;
            mem.pots.main.bets[game.players[mem.current].pName] = 10;
            mem.pots.main.bets[game.players[(mem.current+1)%game.players.length].pName] = 20;
            mem.pots.main.match = 20
            mem.pots.main.prevMatch = 0;
            mem.pots.main.max = -1;
            mem.pots.other = [];
            game.info.pots = [["MAIN POT",mem.pots.main.sum, mem.pots.main.match]];
            game.info.minRaise = 20;
            game.info.sblind = mem.sblind;
            game.turnOptions = "raisecall";
            mem.current = (mem.current+2)%game.players.length
            game.currentPlayer = game.players[mem.current].pName;
            game.info.call = mem.pots.main.match - (mem.pots.main.bets[game.currentPlayer]||0);
        }

        // put in for loop
        return;
    },
    "next" : (game, nocheck) =>  {
        console.log("next");
        let mem = pokerMem[game.id];
        console.log(mem);
        mem.current = (mem.current + 1)%game.players.length;
        game.currentPlayer = game.players[mem.current].pName;

        if (mem.faiTT.length > 0){
            let pot = mem.pots.main;
            if (pot.max != -1){
                for (let j = 0; j < mem.pots.other.length; j++){
                    if (mem.pots.other[j].max == -1){
                        pot = mem.pots.other[j];
                        break;
                    }
                }
            }
            let ins = [];
            for (let i = 0; i < mem.faiTT.length; i++){
                ins.push([mem.faiTT[i],pot.bets[mem.faiTT[i]]]);
            }
            console.log(ins, mem.faiTT);
            ins.sort((a,b) => a[1] - b[1]);
            let refPot = pot;
            let tempPot = {};
            for (let i = 0; i < ins.length; i++){
                tempPot.bets = {};
                tempPot.sum = 0;
                tempPot.exclude = [...refPot.exclude];
                tempPot.exclude.push(ins[i]);
                for (let j in refPot.bets.length){
                    if (j != ins[i][0]) {
                        tempPot.bets[j] = refPot.bets[j] - ins[i][1];
                        tempPot.sum += tempPot.bets[j];
                        refPot.sum -= (refPot.bets[j] - ins[i][1]);
                        refPot.bets[j] -= tempPot.bets[j];
                    }
                }
                refPot = {...tempPot};
                mem.pots.other.push(refPot);
                tempPot = {};
            }
        }

        if (!nocheck){
            console.log(mem.folds);
            if (mem.folds.length == game.players.length -1){
                pokerFuncs.nextPhase(game, 1);
                return;
            }
            if (mem.current == mem.lastRaise && (mem.betStart == 0 || mem.phase == 0)){
                pokerFuncs.nextPhase(game);
                return;
            } else if (game.players[mem.current].money == 0 || mem.folds.includes(game.currentPlayer) || game.players[mem.current].cards[0].length == 0) {
                pokerFuncs.next(game);
            } else if (game.players[mem.current].money > 0 && !mem.folds.includes(game.currentPlayer)){
                if (mem.pots.main.max == -1){
                    game.info.call = mem.pots.main.match - (mem.pots.main.bets[game.currentPlayer]||0);
                    console.log(game.currentPlayer, " calls ", game.info.call);
                    console.log(mem.pots.main.bets);
                    console.log(mem);
                } else {
                    let potIndx = -1;
                    for (let i = 0; i < mem.pots.other.length; i++){
                        if (mem.pots.other[i].max == -1){
                            potIndx = i;
                            break;
                        }
                    }
                    if (potIndx != -1) {
                        game.info.call = mem.pots.other[potIndx].match - (mem.pots.other[potIndx].bets[game.currentPlayer]||0);
                    }
                }
                if (mem.prevRaise > 0 && game.players[mem.current].money > game.info.call) game.turnOptions = "raisecall";
                else if (mem.prevRaise > 0) game.turnOptions = "fallin";
            }
        }
        mem.betStart = 0;
        game.info.folded = mem.folds;
        game.info.pots[0] = ["MAIN POT", mem.pots.main.sum, mem.pots.main.match - mem.pots.main.prevMatch];
        for (let i = 0; i < mem.pots.other.length; i++){
            let pot = mem.pots.other[i];
            if (i+1 in game.info.pots) game.info.pots[i+1] = [pot.exclude[pot.exclude.length-1] + "'S POT", pot.sum, pot.match - pot.prevMatch];
                else game.info.pots.push([pot.exclude[pot.exclude.length-1] + "'S POT", pot.sum, pot.match]);
        }
    },
    "nextPhase": async (game, allFold) => {
        console.log("next phase");
        let mem = pokerMem[game.id];
        mem.faiTT = [];
        mem.phase += 1;
        mem.betStart = 1;
        mem.prevRaise = 0;
        mem.lastRaise = mem.sblind;
        mem.current = mem.sblind;
        game.currentPlayer = game.players[mem.sblind].pName;

        game.turnOptions = "betcheck";

        if (allFold != 1){
            console.log("line 1086 : ", mem.phase, game.players[mem.sblind].money, mem.folds, game.currentPlayer);

            mem.pots.main.prevMatch = mem.pots.main.match;
            for (let i = 0; i < mem.pots.other.length; i++){
                mem.pots.other[i].prevMatch = mem.pots.other.prevMatch;
            }
            if (mem.phase < 4) {
                game.info.folded = mem.folds;
                game.info.pots[0] = ["MAIN POT", mem.pots.main.sum, mem.pots.main.match - mem.pots.main.prevMatch];
                for (let i = 0; i < mem.pots.other.length; i++){
                    let pot = mem.pots.other[i];
                    console.log(pot, pot.exclude);
                    if (i+1 in game.info.pots) game.info.pots[i+1] = [pot.exclude[pot.exclude.length-1] + "'S POT", pot.sum, pot.match-pot.prevMatch];
                    else game.info.pots.push([pot.exclude[pot.exclude.length-1] + "'S POT", pot.sum, pot.match]);
                }
            }
            if (mem.phase == 1){
                for (let i = 0; i < 3; i++){
                    await new Promise(resolve => setTimeout(resolve, 200));
                    game.dealer.cards[i].faceDown = 0;
                }
            } else if (mem.phase == 2){
                game.dealer.cards[3].faceDown = 0;
            } else if (mem.phase == 3){
                game.dealer.cards[4].faceDown = 0
            } else if (mem.phase > 3){
                pokerFuncs.settle(game);
                game.turnOptions = "proceedquit";
                game.currentPlayer = game.players[mem.sblind].pName;
            }
            if (mem.phase < 4 && (game.players[mem.sblind].money == 0 || mem.folds.includes(game.currentPlayer))){
                pokerFuncs.next(game);
            }
        } else if (allFold == 1){
            for (let i = 0; i < game.dealer.cards.length; i++){
                game.dealer.cards[i].faceDown = 0;
            }
            pokerFuncs.settle(game);
            game.turnOptions = "proceedquit";
            game.currentPlayer = game.players[mem.sblind].pName;
        }
    },
    "settle" : (game) => {
        let mem = pokerMem[game.id];
        game.currentPlayer = "\x1EDealer"
        let hands = [];
        let winners = {
            "main" : [],
            "other" : []
        };
        for (let i = 0; i < mem.pots.other.length; i++){
            winners.other.push([]);
        }

        for (let i = 0; i < game.players.length; i++){
            let hand = pokerFuncs.checkHand(game, i);
            game.players[i].cards[0][0].faceDown = 0;
            game.players[i].cards[0][1].faceDown = 0;
            if (!mem.folds.includes(game.players[i].pName)) hands.push([game.players[i].pName, ...hand]);
        }
        winners.main.push(hands[0]);
        console.log("hands ", hands);
        for (let i = 1; i < hands.length; i++) {
            if (handRanks[hands[i][1]] < handRanks[winners.main[0][1]]){
                winners.main = [hands[i]];
            } else if (hands[i][1] == winners.main[0][1]){
                winners.main.push(hands[i]);
            }
        }
        console.log("winners main ", winners.main);
        for (let j = 0; j < winners.other; i++) {
            let thands = hands.filter(x => !mem.pots.other[j].includes(x[0]));
            for (let i = 0; i < hands.length; i++) {
                if (i = 0) winners.other[j].push(thands[0]);
                else {
                    if (handRanks[thands[i][1]] < handRanks[winners.other[j][0][1]]){
                        winners.other[j] = [thands[i]];
                    } else if (thands[i][1] == winners.other[j][0][1]){
                        winners.other[j].push(thands[i]);
                    }
                }
            }
            console.log("winners other", j, " ", winners.other[j]);
        }
        if (winners.main.length > 1){
            let best = [winners.main[0]];
            for (let i = 1; i < winners.main.length; i++){
                let t = pokerFuncs.compLikeHands(best[0], winners.main[i]);
                if (typeof(t[0]) == "object") {
                    best.push(winners.main[i]);
                } else {
                    best = [t];
                }
            }
            winners.main = best;
            console.log("main best", best);
        }
        for (let j = 0; j < winners.other.length; j++){
            if (winners.other[j].length > 1){
                let best = [winners.other[j][0]];
                for (let i = 1; i < winners.other[j].length; i++){
                    let t = pokerFuncs.compLikeHands(best[0], winners.other[j][i]);
                    if (typeof(t[0]) == "object") {
                        best.push(winners.other[j][i]);
                    } else {
                        best = [t];
                    }
                }
                winners.other[j] = best;
                console.log(best);
            }
        }

        game.info.win = [];

        console.log("line 1229 : ", winners.main);

        for (let i = 0; i < winners.main.length; i++){
            game.players.find(x => x.pName == winners.main[i][0]).money += (Math.round(mem.pots.main.sum/winners.main.length)||0);
            game.info.win.push([winners.main[i][0], Math.round(mem.pots.main.sum/winners.main.length)||0]);
        }
        for (let j = 0; j < winners.other.length; j++){
            for (let i = 0; i < winners.other[j].length; i++){
                game.players.find(x => x.pName == winners.other[j][i][0]).money += (Math.round(mem.pots.other[j].sum/winners.other[j].length)||0);
                game.info.win([winners.other[j][i][0], Math.round(mem.pots.other[j].sum/winners.other[j].length)||0]);
            }
        }
    },
    "turns" : {
        "be" : (game, amount) => {
            let mem = pokerMem[game.id];
            if (mem.pots.main.max == -1){
                mem.pots.main.match += amount;
                mem.pots.main.sum += amount;
                mem.pots.main.bets[game.currentPlayer] += amount;
                mem.prevRaise = amount;
                mem.lastRaise = mem.current;
                game.players[mem.current].money -= amount;
                if (game.players[mem.current].money == 0){
                    mem.faiTT.push(game.currentPlayer);
                }
            } else {
                let potIndx = -1;
                for (let i = 0; i < mem.pots.other.length; i++){
                    if (mem.pots.other[i].max == -1){
                        potIndx = i;
                        break;
                    }
                }
                if (potIndx != -1){
                    if (!mem.pots.other[i].exclude.includes(game.currentPlayer)){
                        mem.pots.other[potIndx].match = amount;
                        mem.pots.other[potIndx].sum = amount;
                        game.players[mem.current].money -= amount;
                        mem.pots.other.bets = {};
                        mem.pots.otjer.bets[game.currentPlayer] = amount;
                        mem.lastRaise = mem.current;
                        if (game.players[mem.current].money == 0){
                            mem.faiTT.push(game.currentPlayer);
                        }
                    }
                }
            }
            pokerFuncs.next(game);
        },
        "ch" : (game) => {
            let mem = pokerMem[game.id];
            pokerFuncs.next(game);
        },
        "ra" : (game, amount) => {
            let mem = pokerMem[game.id];
            mem.lastRaise = mem.current;
            mem.prevRaise = amount;
            if (mem.pots.main.max == -1){
                mem.pots.main.match += amount;
                mem.pots.main.bets[game.currentPlayer] = mem.pots.main.match;
                mem.pots.main.sum += game.info.call + amount;
                game.players[mem.current].money -= amount + game.info.call;

                if (game.players[mem.current].money == 0){
                    mem.faiTT.push(game.currentPlayer);
                }
            } else {
                let potIndx = -1;
                for (let i = 0; i < mem.pots.other.length; i++){
                    if (mem.pots.other[i].max == -1){
                        potIndx = 1;
                        break;
                    }
                }
                if (potIndx != -1 ){
                    if (!mem.pots.other[i].exclude.includes(game.currentPlayer)){
                        mem.pots.other[i].match += amount;
                        mem.pots.other[i].bets[game.currentPlayer] = mem.pots.other[i].match ;
                        mem.pots.other[i].main.sum += game.info.call + amount;
                        game.players[mem.current].money -= amount + game.info.call;
                    }
                }
            }
            pokerFuncs.next(game);
        },
        "ca" : (game) => {
            let mem = pokerMem[game.id];
            if (mem.pots.main.max == -1){
                mem.pots.main.bets[game.currentPlayer] = mem.pots.main.match;
                mem.pots.main.sum += game.info.call;
                game.players[mem.current].money -= game.info.call;
            } else {
                let potIndx = -1;
                for (let i = 0; i < mem.pots.other.length; i++){
                    if (game.pots.other[i].max == -1){
                        potIndx = i;
                        break;
                    }
                }
                if (potIndx != -1){
                    mem.pots.other[i].bets[game.currentPlayer] = mem.pots.other[i].match;
                    mem.pots.other[i].sum += game.info.call;
                    game.player[mem.current].money -= game.info.call;
                }
            }
            pokerFuncs.next(game);
        },
        "ai" : (game) => {
            let mem = pokerMem[game.id];
            mem.faiTT.push(game.currentPlayer);
            if (mem.pots.main.max == -1){
                mem.pots.main.sum += game.players[mem.current].money;
                mem.pots.main.bets[game.currentPlayer] +=  game.players[mem.current].money;
                game.players[mem.current].money = 0;
            } else {
                let potIndx = -1;
                for (let i = 0; i < mem.pots.other.length; i++){
                    if (mem.pots.other[i].max == -1) {
                        potIndx = i;
                        break;
                    }
                }
                let pot = mem.pots.other[i];
                pot.main.sum += game.players[mem.current].money;
                pot.bets[game.currenPlayer] += game.players[mem.current].money;
                game.players[mem.current].money = 0;
            }
            pokerFuncs.next(game);
        },
        "fo" : (game) => {
            let mem = pokerMem[game.id];
            game.players[mem.current].cards[0][0].faceDown = 0;
            game.players[mem.current].cards[0][1].faceDown = 0;
            mem.folds.push(game.currentPlayer);
            pokerFuncs.next(game);
        }
    },
    "proceed" : (game, deci) => {
        if (game.remRounds != game.maxRounds && deci == 1){
                game.remRounds += 1;
                pokerFuncs.deal(game);
        } else {
            game.turnOptions = "none";
            game.currentPlayer = "\x1E";
            game.currentScene = "lobby";
            game.colliders = sceneColliders["lobby"];
            game.interactables = sceneInteractables["lobby"];
        }
    },
    "disconnect" : (game, lostInd) => {
        mem = pokerMem[game.id];
        if (lostInd == mem.current && game.players.length > 0) game.currentPlayer = ((game.players[mem.current]??{}).pName)??"";
        else if (lostInd > mem.current) mem.current -= 1;
        if (game.players.length == 0) delete pokerMem[game.id];
    }
};

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
				gameManager.games[args[2]] = nGame;
				game = gameManager.games[args[2]];
				gameManager.collisionHandlers[args[2]] = collisionHandler;
				gameManager.playerMem[args[2]] = {};
				socket.send("r\x1F" + JSON.stringify(nGame));
				riId = setInterval(refreshIndex,100);
				gameManager.sockets[args[2]] = [];
				gameManager.sockets[args[2]].push(socket);
			} else {socket.send(-1); console.log("room not made");}
		} else if (message[0] == 'j') {
			console.log("joining");
			let args = message.split("\x1F");
			game = gameManager.games[args[2]];
			if (game != null){
				if (game.players.find(x => x.pName == args[1]) != null){socket.send(-2); return 0;}
				if (game.players.length == 4){socket.send(-3); return 0;}
				id = args[1]+args[2];
				playerIndex = game.players.length;
				if (gameManager.playerMem[args[2]][args[1]] != null) {
					let tempPlayer = gameManager.playerMem[args[2]][args[1]];
					tempPlayer.bet = 0;
					game.players.push(tempPlayer);
					delete gameManager.playerMem[args[2]][args[1]];
				} else game.players.push(new player({}, args[3], 100, 1000, args[1]));
				game.votes[args[1]] = 0;
				socket.send("r\x1F" + JSON.stringify(game));
				riId = setInterval(refreshIndex,100);
				gameManager.sockets[args[2]].push(socket);
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
				if (args[3] != "ff"){
					let t = kts[args[3]]
					game.currentScene = t;
					game.colliders = sceneColliders[t];
					game.interactables = sceneInteractables[t];
					if (args[3] == "bj"){
                        blackjackMemory[game.id] = {...blackjackMemoryTemplate};
						blackjackFuncs.start(game);
					} else if (args[3] == "rl") {
						game.ready = 0;
						game.remRounds = 1;
						game.votes = {};
						game.turnOptions = "betting";
						console.log("start roulette");
					} else if (args[3] == "pk"){
                        game.currentPlayer = "\x1E"
						game.remRounds = 1;
						game.votes = {};
                        game.turnOptions = "\x1E";
						console.log("start poker");
                        console.log(pokerMem);
                        pokerFuncs.deal(game);
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

			console.log(`recieved action ${args}`);
			let p = game.players[playerIndex];

			if (game.currentScene == "lobby"){
				if (args[1] == "sl"){
					console.log("slots!!");
					if (game.players[playerIndex].money > 0) {
						game.players[playerIndex].money = Math.max(0, game.players[playerIndex].money - 5);
					} else {
                        game.players[playerIndex].money = Math.round((((game.players.map(x => x.money).sort((a,b) => a-b).filter(x => x != 0)[0]) * 0.75)||250) * Math.random());
					}
				}
			}

            else if (game.currentScene == "roulette"){
				if (game.turnOptions == "betting"){
					if (args[1] == "ba"){
						game.info.bets.push(JSON.parse(args[2]));
						game.info.bets.sort((a,b) => {return ((a.pos[0]-b.pos[0]) + 100*(a.pos[1] - b.pos[1]));});
					} else if (args[1] == "br"){
						let ind = game.info.bets.findIndex(x => (x.pos == `${args[2]}` && x.owner == id.slice(0,-4)));
						if (ind > -1) game.info.bets.splice(ind, 1);
						else if (args[2] == "a") {
							for (let i = 0; i < game.info.bets.length; i++) {
								if (game.info.bets[i].owner == id.slice(0,-4)){
									game.info.bets.splice(i,1);
									i -= 1;
								}
							}
						}
					} else if (args[1] == "re"){
						console.log("ready", id);
						game.ready += 1;
						if (game.ready == game.players.length){
							rouletteFuncs.spin(game);
						}
					}
				}
			}
            else if (game.currentScene == "blackjack"){
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
			}
            else if (game.currentScene == "poker"){
                console.log(args);
                if (args[1] == "pr"){
                    pokerFuncs.proceed(game, parseInt(args[2]));
                } else if (args[1] in pokerFuncs.turns){
                    pokerFuncs.turns[args[1]](game, parseInt(args[2]||0)||0);
                    console.log(pokerMem[game.id]);
                }
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
			game.ready -= 1;
            delete game.votes[pId];
            if (game.currentScene == "poker") {
                pokerFuncs.disconnect(game, playerIndex);
            }
			console.log("player left");
			if (game.players.length == 0){
				console.log("closing room");
				delete gameManager.games[gId];
				clearInterval(gameManager.collisionHandlers[gId]);
				delete gameManager.collisionHandlers[gId];
				delete gameManager.playerMem[gId];
                delete blackjackMemory[gId];
                delete pokerMem[gId];
			}
		}
	});
});
