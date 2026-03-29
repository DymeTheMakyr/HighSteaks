const WebSocket = require('ws'); //include the websocket library

const server = new WebSocket.Server({host: "0.0.0.0", port : 8000 });

class gameManager{ //static class that organises game related objects
    static games = {}; //all game objects
    static sockets = {}; //all websockets
    static playerMem = {}; //all sets of player memory
    static collisionHandlers = {}; //all collisionHandlers
    static projectileHandlers = {}; //all projectileHandlers
}

class vec{ //vector class
	x = 0;
	y = 0;

    normal = () => { //returns unit vector of object
		let m = (this.x**2 + this.y**2)**0.5;
		return new vec(this.x / m || 0, this.y / m || 0);
	};

	constructor(_x, _y){
		this.x = parseFloat(_x);
		this.y = parseFloat(_y);
	}
    static n(_x, _y){ //alernate method to make a vector
		return new vec(_x, _y);
	}
    static avg(off, ...vecs){ //returns the average of n vectors with an offset.
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
    static add(a,b){ //adds 2 vectors
		return vec.n(a.x+b.x, a.y+b.y);
	}
    static sub(a,b){ //subtracts vector a from vector b
		return vec.n(a.x-b.x, a.y-b.y);
	}
    static distance(a,b){ //returns the distance between a and b
		return ((a.x-b.x)**2 + (a.y-b.y)**2)**0.5;
	}
}

function setPos(obj, ...args){ //helper function to updtae the position of an object with a collider
	if (args.length == 3){
		obj.col.origin = {"x":args[1], "y":args[2]};
	} else if (args.length == 2){
		obj.col.origin = args[1];
	}
}
class gameObj{ //game object class, is the game state of a game, organises all information sent to clients
    className = "game"; //network integral class identifier
    id = 0; //room code
	currentScene = "lobby";
    currentPlayer; //the name of the player whose turn it is
    turnOptions;   //the options the players have on their turn
    remRounds = 0; //how many rounds have been played
    maxRounds = 0; //how many rounds can be played
    votes = {};    //what each player has voted for
    info = {       //general information used in the activities
		"bets" : [],
		"pots" : [],
		"minRaise" : 0,
        "call" : 0,
        "folded" : [],
        "ready" : [],
        "win" : []
	};
    players = []; //all the player objects, each one representing a client
    dealer = {"cards":[]}; //the dealer's information
    projectiles = [];  //all the projectiles in the current game state
    colliders = [];    //all the map colliders in the current game state
    interactables = [];//all the interactables in the current game state
    locked = 0;        //if players can join the lobby
	constructor(args) {
		this.id=args;
	}
}
class col { //collider class, used in a myriad of objects for bound
    className = "col"; //network integral identifier
    origin = vec.n(0,0); //the world position of the collider
    points = [];   //other vertices in the collider (i.e. corners of a rectangle)
    type = "r";    //type of collider, determines how it is processed
    constructor(t, o, ...p){
		this.type = t;
		this.origin = o;
		this.points = p;
	}
    static rect(o, w, h){ //shorthand creates a rectangle collider
		let c = new col("r", o, vec.n(0,0), vec.n(0+w,0), vec.n(0+w,0+h), vec.n(0,0+h));
		c.width = w;
		c.height = h;
		return c;
	}
    static circle(o, r){ //shorthand creates a circle collider
		let c = new col("c", o, vec.n(0,0));
		c.radius = r;
		return c;
	}
}
class player { //player object, organises information of each player, representing a client
    className = "player"; //network intergral identifier
    col = col.rect(vec.n(312,175), 16, 30); //collider that represents where the player is
    flipped = false; //if the player is facing left or right
    skin = "hereford";
    health = [100,100];
    ammo = [10,10];
    upgrades = ""; //string of all upgrades the character has, delimited by "."
    ldir = vec.n(1,0); //where the player is looking with mouse, used especially in fight scene
    burn = 0; //how many frames of burn a player has
    hits = 0; //how many times a player has successfully hit another player
    money = 1000;
	bet = 0;
	cards = [[]];
    currentHand = 0;
    pName = "NullName"; //nickname of the player, chosen at creation
	constructor(st, sk, he, mo, na){
		this.skin = sk;
        this.health = [he,he];
		this.money = mo;
		if (na != null) this.pName = na;
	}
}
class projectile { //projectile class, used to represent any and all projectiles
	className = "projectile";
    col;
    speed = vec.n(0,0); //how much a projectile will move on a frame
    damage = 10;
    life = 10; //how many frames a project
    owner = 0; //owner of the projectile
    bounces = 0; //how many bounces the projectile has
    doCol = true; //if the projectile should collide with walls
    constructor(c, s, d, l, o, b, is){
		this.col = c;
		this.speed = s;
		this.damage = d;
		this.life = l;
		this.owner = o;
        this.bounces = b;
        this.doCol = is??true;
	}
}

class interactable { //interactable class, used to organise and represent information to display the interactables in the lobby
    className = "interactable"; //network inegral identifier
    col; //collider to detect player in range
    text = ""; //text to show whenever player is nearby
    renderOffset = vec.n(0,0); //vector offset to render the sprite from the origin of the collider
    spritename = ""; //name of the sprite to render on the client
    funcKey = ""; //sting linking to the function on the client
	short = false;
	constructor(n, rO, c, t, fk, s){
		this.spritename = n;
		this.renderOffset = rO;
		this.col = c;
		this.text = t;
		this.funcKey = fk;
		this.short = s;
	}
    static short(n, rO, c, fk, t){ //shorthand to create a short interactable
		return new interactable(n, rO, c, t, fk, true);
	}
    static tall(n, rO, c, fk, t){ //shorthand to create a tall interactable
		return new interactable(n, rO, c, t, fk, false);
	}
}

//card object, contains information about suit and rank
class card {
    className = "card"; //network integral identifier
	suit;
	value;
	faceDown;
	constructor(s, v, f){
		this.suit = s;
		this.value = v;
		this.faceDown = f;
	}
}

let kts = { //key to scene, converts 2char string into full scene name
	"bj" : "blackjack",
	"rl" : "roulette",
	"pk" : "poker",
	"ff" : "fight"
}

const sceneInteractables = { //list of all ineractables in all scenes
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
    "fight":[]
}

const sceneColliders = { //list of all colliders in all scenes
	"selection":[],
	"lobby": [
		col.rect(vec.n(0,0), 16, 360),
		col.rect(vec.n(16,0), 608, 39),
		col.rect(vec.n(640-16,0), 16, 360),
		col.rect(vec.n(16,360-16), 608, 16),
		col.rect(vec.n(96,0), 96, 55),
		col.rect(vec.n(304,20), 32,31),

		col.rect(vec.n(56,134), 128, 21),
		col.rect(vec.n(56,254), 128, 21),
		col.rect(vec.n(456,134), 128, 21),
		col.rect(vec.n(456,254), 128, 21),
	],
	"blackjack":[],
	"roulette":[],
	"poker":[],
    "fight":[
        col.rect(vec.n(-100,-100), 132, 560),
        col.rect(vec.n(608,-100), 132, 560),
        col.rect(vec.n(-100,-100), 840, 114),
        col.rect(vec.n(-100,328), 840, 132)
    ]
}

//collides two colliders, a and b, where the a collider is alwas a rect
//returns a corrective vector to move the a collider to the correct position
function collide(a, b){
    if (b.type == "r"){
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
    }
    else if (b.type == "c"){
        let aCntr = vec.avg(a.origin, ...a.points);
		let bCntr = b.origin;
        let tWidth = (a.width)/2 + b.radius;
        let tHeight = (a.height)/2 + b.radius;
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

//checks if two colliders, a and b, are overlapping, where a is always a rect collider
//returns 1 if the colliders are overlapping
function overlap(a, b){
	if (b.type == "r"){
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

//checks a player collider against all scene colliders
function collisionHandler(game, p){
    for (let c = 0; c < game.colliders.length; c++){
		let adj = collide(p.col, game.colliders[c]);
		if (typeof(adj) == 'object'){
			p.col.origin = vec.add(p.col.origin, adj);
		}
	}
}

//applies damage to a player, taking upgrades into consideration
function damage(p, d){
    if (p.upgrades.includes("h") && Math.random() < Math.min((1-1/(1+0.05*(p.upgrades.split("h").length-1))), 0.85)){
        return 0;
    }
    d = Math.max(1, d - 5*(p.upgrades.split("a").length - 1));
    if (p.health[0] <= d && p.upgrades.includes("e")){
        let t = p.upgrades.split(".");
        let lsId = t.indexOf("e");
        t.splice(lsId,lsId+2);
        p.upgrades = t.join(".") + ".";
        return 0;
    }
    p.health[0] = p.health[0] - d;
    p.health[0] = Math.round(Math.max(p.health[0], -0));
    if (p.health[0] == 0) return 2;
    return 1;
}

//kills a player, so players can die
//factors in cow tipping upgrade
function kill(p, g){
    let ind = g.info.ready.findIndex(x => x == p.pName);
    if (ind > -1){
        if (p.upgrades.includes("g")){
            g.projectiles.push(new projectile( //c, s, d, l, o, b, is
                col.circle(vec.n(p.col.origin.x+8, p.col.origin.y+15), 40 + 10 * (p.upgrades.split("g").length - 1)),
                vec.n(0,0), 50*(1.1**(p.upgrades.split("0").length-1))*(p.upgrades.split("g").length-1),
                1, p.pName, 0, false
            ));
            g.projectiles.at(-1).ls = true;
        }
            g.info.ready.splice(ind, 1);
    }
}

//processes all projectiles
function projectileHandler(game){
    try { //will not crash if a player leaves mid way
        for (let i = 0; i < game.projectiles.length; i++){
            let p = game.projectiles[i]??{}; //get projectile
            let o = game.players.find(x => x.pName == p.owner)??{}; //get owner of projectile
            if (p && o){ //if there is a projectile and an owner
                if ((p.life < 1 && p.doCol) || (p.life < -10 && !p.doCol)) {
                    delete game.projectiles[i]; //if projectile has run out of life, remove the projectile
                    game.projectiles.splice(i,1);
                    i--;
                    continue;
                }
                p.col.origin = vec.add(p.col.origin, p.speed); //move projectile
                let r = projectileCollide(game, p); //check collision of projcetile
                if (r == "w"){ //if the projectile has hit the wall, kill, explode if possible
                    delete game.projectiles[i];
                    game.projectiles.splice(i,1);
                    i--;
                    if (o.upgrades.includes("8")) game.projectiles.push(new projectile(col.circle(vec.n(p.col.origin.x, p.col.origin.y), 20), vec.n(0,0), 0.3*p.damage, 1, p.owner, 0, false));
                }
                else if (r == 0) p.life = (p.life??0) - 1; // reduce life if not hit
                else if (r[0] == "p" && p.life > 0) { //if player is hit
                    o.hits++; //increment owner hit
                    let rl = r.split(".");
                    let tl = [];
                    for (let j = 1; j < rl.length; j++){ //get all players that are hit
                        tl.push(game.players.find(x => x.pName == rl[j]));
                    }
                    tl.map(x => x != undefined); //drop undefined players from list
                    let projChecks = [o.upgrades.includes("9"), o.upgrades.includes("8"), o.upgrades.includes("5")]; //get upgrades
                    if (tl.length > 0) {
                        for (let j = 0; j < tl.length; j++){
                            let t = tl[j];
                            let check = damage(t, p.damage * 0.5**(p.owner == t.pName));
                            if (check) o.hits += 1;
                            if (check == 2 && game.info.ready.includes(t.pName)) {
                                kill(t, game);
                                if (game.info.ready.length == 0 && p.ls == true){
                                    game.info.win = p.owner; //if death projectile kills last player, death projectile owner wins
                                }
                            }
                            //apply upgrades
                            if (projChecks[0]) o.health[0] = Math.round(Math.min(o.health[0] + p.damage * (0.1 * (o.upgrades.split("9").length - 1)), o.health[1]));
                            if (projChecks[1] && p.doCol) game.projectiles.push(new projectile(col.circle(vec.n(p.col.origin.x, p.col.origin.y), 20), vec.n(0,0), 0.3*p.damage, 1, p.owner, 0, false));
                            if (projChecks[2]) {
                                if (t.burn == 0) {
                                    t.burn = (o.upgrades.split("5").length - 1) * 3;
                                    (async () => { //burn loop
                                        try{
                                            for (let i = 0; i < t.burn * 2; t.burn -= 0.5){
                                                await new Promise(r => setTimeout(r, 500));
                                                if (damage(t, 2 * 0.5**(p.owner == t.pName)) == 2 && game.info.ready.includes(t.pName)) {
                                                    kill(t, game);
                                                    return;
                                                }
                                            }
                                        } catch (e){
                                            console.log(e);
                                        }
                                    })();
                                } else t.burn = (o.upgrades.split("5").length - 1) * 3;
                            }
                        }
                        if (p.doCol){ //if collides and hits a player, remove projectile
                            delete game.projectiles[i];
                            game.projectiles.splice(i,1);
                            i--;
                        } else { //if not colliding and hits a player, reduce life
                            p.life -= 1;
                        }
                    }
                } else if (!p.doCol && p.life > -11){
                    p.life -= 1; //if projectile doesn't collide
                }
            }
        }
    } catch (e) {
        console.log(e);
    }
}

//collide projectile with players and walls
function projectileCollide(game, p){
    let ret = "p";
    for (let c = 0; c < game.players.length; c++){ //get all players that collide with projectile
        let pr = game.players[c];
        let over = overlap(pr.col, p.col);
        if (over == 1 && !(p.ls && p.owner == pr.pName)){
            ret += "." + pr.pName;
        }
	}
    if (ret != "p") return ret;

    for (let c = 0; c < game.colliders.length; c++){
        let adj = collide(game.colliders[c],p.col); //get adjustment vector from collision
        if (typeof(adj) == 'object'){ //bounce object
            if (p.bounces > 0){
                p.bounces -= 1; //reflect projectile speed relative to wall
                p.col.origin = vec.sub(p.col.origin, adj);
                p.speed.x *= 1 - (2*(adj.x != 0));
                p.speed.y *= 1 - (2*(adj.y != 0)); //
            }
            else if (p.doCol) return "w";
		}
	}
    return 0;
}

//sends message to all clients in same game
function sendall(gameid, msg){
	if (gameid in gameManager.sockets){
		for (let i = 0; i < gameManager.sockets[gameid].length; i++){
			gameManager.sockets[gameid][i].send(msg);
		}
	}
}

//Template data structure for blackjack memory
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

//object of blackjack memories
let blackjackMemory = {};

//object containing all functions use specifically by blackjack game
const blackjackFuncs = {
    "reshuffle" : (game) => { //shuffles 6 standard 52 card decks and returns the divider threshold
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
    "checkHand" : (p, checkBJ) => { //checks what a player's turn options are. returns if a blackjack is present
        let result = {"turn" : "bjturn"};
		let blackjack = false;
		let mem = blackjackMemoryTemplate;
        if (p.bet > 0 && p.money >= 0){ //check if player has bet
            let hand = p.cards[p.currentHand]; // below : check for blackjack
            if (checkBJ && hand[0].value + mem.valueLookup[hand[1].value] == 22 || hand[1].value + mem.valueLookup[hand[0].value] == 22) result.bj = true;
            if (p.money < p.bet) return result; //prematurely end function if player cannot afford split or double
            let sumHand = 0;
			for (let i = 0; i < hand.length; i++){
				if (hand[i].value == 12) sumHand += 1;
				else sumHand += mem.valueLookup[hand[i].value];
			}
			if (sumHand > 8 && sumHand < 12) result.turn += "double"; //check if hand sum falls in range for double
            if (mem.valueLookup[hand[0].value] == mem.valueLookup[hand[1].value] && hand.length == 2) result.turn += "split"; //check if start cards are same
		}
		return result;
	},
    "split" : async function(game, p){ //splits players hand into two and deals new card
        try {
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
        } catch {
            blackjackFuncs.next(game);
        }
	},
    "start" : (game) => { //starts a round of blackjack
		if (game.currentScene == "blackjack") blackjackFuncs.clear(game);
		game.remRounds = 1;
		let mem = blackjackMemory[game.id];
		game.dealer.cards = [];
		let temp = blackjackFuncs.reshuffle(game);
		mem.cards = temp[0];
		mem.divider = temp[1];
		game.currentPlayer = game.players[0].pName;
		game.turnOptions = "bjbet";
	},
    "deal" : async function(game){ //deals initial cards to players at start of round
		try {
			let mem = blackjackMemory[game.id];
			if (mem.cards.length == 0){
				let temp = blackjackFuncs.reshuffle(game);
				mem.cards = temp[0];
				mem.divider = temp[1];
			}
			game.turnOptions = "none";
			let validPlayerIndexes = [];
            for (let i = 0; i < game.players.length; i++){ //find players who are able to recieve a hand
				if (game.players[i].money + game.players[i].bet >= 1) validPlayerIndexes.push(i);
			}

            for (let j = 0; j < 2; j++){ // deal two cards to all valid players
				for (let i = 0; i < validPlayerIndexes.length; i++){
					await new Promise(r => setTimeout(r, 500));
                    try {
                        game.players[validPlayerIndexes[i]].cards[0].push(mem.cards.shift());
                    } catch {}
				}
				await new Promise(r => setTimeout(r, 500));
				let tcard = mem.cards.shift();
				tcard.faceDown = j;
				game.dealer.cards.push(tcard);
			}
            let handCheck = blackjackFuncs.checkHand(game.players[0], true); //get turn options and blackjack
            if (handCheck.bj) { //if blackjack, skip to next player/dealer
				game.currentPlayer = game.players[validPlayerIndexes[0]].pName ?? "none";
				blackjackFuncs.next(game);
			}
            else { //set turn options and currentplayer
                try {
                    game.turnOptions = handCheck.turn;
                    game.currentPlayer = game.players[validPlayerIndexes[0]].pName ?? "none";
                } catch {
                    game.turnOptions = "none";
    				game.currentPlayer = "\x1F";
    				game.currentScene = "lobby";
    				game.colliders = sceneColliders["lobby"];
    				game.interactables = sceneInteractables["lobby"];
    				blackjackFuncs.clear(game, true);
                }
			}

		} catch(e) {
			console.log(e);
		}
	},
    "next": async function(game){ //gets next player
		let mem = blackjackMemory[game.id];
		try{
            let playerIndex = game.players.findIndex((x) => {return x.pName == game.currentPlayer}); //get player index

            if (game.players[playerIndex].currentHand+1 >= game.players[playerIndex].cards.length){//if current hand is last hand of player, move on to next player
				playerIndex += 1;
                if (playerIndex < game.players.length) game.players[playerIndex].currentHand = 0; //if playerindex+1 is a player, set current hand to 0
            } else if (game.players[playerIndex].currentHand+1 < game.players[playerIndex].cards.length){ //if hand isn't last hand, increment hand
				game.players[playerIndex].currentHand += 1;
			}
            game.currentPlayer = "\x1F"; //clear current player
            if (playerIndex < game.players.length && playerIndex != -1){ //if player index is valid, process hand for turn options
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
                } else { //if player doesnt have cards, skip
					game.currentPlayer = game.players[playerIndex].pName;
					blackjackFuncs.next(game);
				}
            } else { //if player index is not a player, do dealer cards
				game.turnOptions = "none";
				game.currentPlayer = "\x1F";
				await new Promise(r => setTimeout(r, 500));
                game.dealer.cards[1].faceDown = 0; // reveal second card
                for(;;){ //deal cards to dealer until sum of hand is more than 16
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
                blackjackFuncs.cashout(game); //cashout money to players based on hands
			}
		} catch (e) {
			console.log(e);
		}
	},
    "cashout": async function(game){ //calculates winnings and pays players
		let mem = blackjackMemory[game.id];
		try {
            for(let j = 0; j < game.players.length; j++){ //for each player, for each hand, calculate how much each player wins as a
                mem.winRates[game.players[j].pName] = []; //factor of their initial bet
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

                    if (sum == 21 && game.players[j].cards[k].length == 2 && game.players[j].cards.length == 1){ //check player hand against dealer hand
                        if (mem.dealerSum == 21 && game.dealer.cards.length == 2) mem.winRates[game.players[j].pName][k] = 1; //and get amount won
						else mem.winRates[game.players[j].pName][k] = 2.5;
					} else if (sum > 21) mem.winRates[game.players[j].pName][k] = 0;
                    else if (mem.dealerSum == 21 && game.dealer.cards.length == 2) mem.winRates[game.players[j].pName][k] = 0;
					else if (mem.dealerSum > 21) mem.winRates[game.players[j].pName][k] = 2;
					else if (mem.dealerSum > sum) mem.winRates[game.players[j].pName][k] = 0;
					else if (mem.dealerSum == sum) mem.winRates[game.players[j].pName][k] = 1;
					else if (mem.dealerSum < sum) mem.winRates[game.players[j].pName][k] = 2;
					if (doubled == 1) mem.winRates[game.players[j].pName][k] *= 2;
				}
			}
            game.info.win = [];
            for (let j = 0; j < game.players.length; j++){ //for allplayers, for all hands, pay the amount owed proportional to the bet
                game.info.win.push([game.players[j].pName, 0]);
				for (let k = 0; k < game.players[j].cards.length; k++){
                    game.info.win[j][1] += game.players[j].bet * (mem.winRates[game.players[j].pName][k] ?? 0);
					game.players[j].money += game.players[j].bet * (mem.winRates[game.players[j].pName][k] ?? 0);
					game.players[j].money = Math.round(game.players[j].money);
                    game.info.win[j][1] = Math.round(game.info.win[j][1]);
				}
				game.players[j].bet = 0;
			}

            //re-deal deck of cards and proceed with rounds
            game.currentPlayer = "none";
			await new Promise(r => setTimeout(r, 2000));
            game.info.win = [];
			blackjackFuncs.clear(game, false);
			if (mem.cards.length == mem.divider){
				let t = blackjackFuncs.shuffle(game);
				mem.divider = t[1];
				mem.cards = t[0];
			}
            //if not last round, proceed with new round
			if (game.remRounds < game.maxRounds){
				game.remRounds += 1;
                game.currentPlayer = game.players[0].pName??"";
				game.turnOptions = "bjbet";
				blackjackFuncs.clear(game, false);
            } else { //if last round has been played, send players back to lobby
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
    "clear": (game, comp) => { //clears the blackjack memory of information for use in new round
		let mem = blackjackMemory[game.id];
		game.dealer.cards = [];
		for (let i = 0; i < game.players.length; i++){
			game.players[i].cards = [[]];
			game.players[i].currentHand = 0;
		}
		if (comp) delete blackjackMemory[game.id];
	},
    "disconnect" : async function(game, playerIndex){ //function that handles a player disconnecting from the game
        game.players[playerIndex].cards = [[]];
        if (game.currentPlayer == game.players[playerIndex].pName){
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
}

//converts value to indexed rotation from 0-36
const rlWheelLookup = [0, 23, 6, 35, 4, 19, 10, 31, 16, 27, 18, 14, 33, 12, 25, 2, 21, 8, 29, 3, 24, 5, 28, 17, 20, 7, 36, 11, 32, 30, 15, 26, 1, 22, 9, 34, 13]
const rlValues = { //translates asystematic roulette values into readable values
	"r" : [
        [ 3, 6, 9,12,15,18,21,24,27,30,33,36], //1st row
        [ 2, 5, 8,11,14,17,20,23,26,29,32,35], //2nd row
        [ 1, 4, 7,10,13,16,19,22,25,28,31,34]  //3rd row
	],
    "re" : [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36], //red number
    "bl" : [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]    //black numbers
	};

const rlSpecialLookup = {
	51 : "d1",
	52 : "d2",
	53 : "d3",
	54 : "e1",
	59 : "e2",
	55 : "ev",
	58 : "od",
    57 : "re",
    56 : "bl",
	61 : "r1",
	62 : "r2",
	63 : "r3"
}

const rouletteFuncs = { //all functions use by the roulette game
    "spin" : async (game) => { //calculates the index to spin to
        let betTotals = {}; //
        for (let i = 0; i < game.info.bets.length; i++){ //find how much each player has bet in total
			betTotals[game.info.bets[i].owner] = (betTotals[game.info.bets[i].owner]||0) + game.info.bets[i].bet;
		}
        for (let i = 0; i < game.players.length; i++){ //subtract how much each player has bet in total
			game.players[i].money -= betTotals[game.players[i].pName]||0;
		}
        game.turnOptions = "spinning"; //start spinning wheel
        let val = Math.max(Math.round(Math.random() * 36 - 1),0); //randomly choose a number
        sendall(game.id, `a\x1Frl\x1F${rlWheelLookup[val]}`); //send wheel index to all clients
        await new Promise(resolve => setTimeout(resolve, 12000)); //wait for wheel to stop spinning
        rouletteFuncs.cashout(game, val); //pay bets to all players
        game.info.ready = []; //clear ready list
	},
    "cashout" : (game, val) => { //calculates winnings and pays all players
        let payouts = {}
        for (let i = 0; i < game.info.bets.length; i++){ //for all bets
			let b = game.info.bets[i];

            if (!(b.owner in payouts)) payouts[b.owner] = 0; //initialise payout for a player
            if (b.val > 50){ //if the bet is a special bet (dozens, odd, etc.)
                let spec = rlSpecialLookup[b.val]; //get special lookup string
                if (spec[0] == "d" && (spec[1]-1)*12 < val && val <= (spec[1])*12) payouts[b.owner] += b.bet * 3;       //if bet and result in same dozen, pay 3x
                else if (spec[0] == "e" && (spec[1]-1)*18 < val && val <= (spec[1])*18) payouts[b.owner] += b.bet * 2;  //if bet and result correct eighteen, pay 2x
                else if (spec == "ev" && val%2 == 0 && val > 0) payouts[b.owner] += b.bet * 2;                          //if bet and result even, pay 2x
                else if (spec == "od" && val%2 == 1) payouts[b.owner] += b.bet * 2;                                     //if bet and result odd, pay 2x
                else if (spec == "re" && rlValues.re.includes(val)) payouts[b.owner] += b.bet*2;                        //if if bet and result red, pay 2x
                else if (spec == "bl" && rlValues.bl.includes(val)) payouts[b.owner] += b.bet*2;                        //if if bet and result black, pay 2x
                else if (spec[0] == "r" && spec[1] > 0 && rlValues.r[spec[1]-1].includes(val)) payouts[b.owner] += b.bet*3; //if bet and result in same row, pay 3x
            } else { //if bet is not special
                if (b.pos[2] == 0.5 && b.pos[3] == 0.5){ //if bet is on corner
                    if (b.pos[1] == 2.5){ //if bet is on edge of numbers
                        if (b.val == 0 && val <= 3) payouts[b.owner] += b.bet * 9; //if 0 is a part of bet, and its sucessful, pay 9x
                        else if (b.val <= val && val < b.val+6) payouts[b.owner] += b.bet * 6;
                    } else { //if bet is inside numbers
						let posVal = [b.val-1, b.val, b.val+2, b.val+3];
                        if (posVal.includes(val)) payouts[b.owner] += b.bet * 9; //pay 9x on success
					}
                } else if (b.pos[2] == 0.5){ //if bet is between two numbers horizontally, pay 18x on success
					if (val == b.val || val == b.val+3) payouts[b.owner] += b.bet*18;
                } else if (b.pos[3] == 0.5){ //if bet is on edge vertically
                    if (b.pos[1] == 2.5 && b.val <= val && val <= b.val+2) payouts[b.owner] += b.bet*12; //if on edge of numbers, success pays 12x
                    else if (b.pos[1] != 2.5 && val == b.val || val == b.val - 1) payouts[b.owner] += b.bet*18; //if between two numbers, success pays 18x
				} else {
                    if(val == b.val) payouts[b.owner] += b.bet * 36; //if bet on single, success pays 36x
				}
			}
		}

		for (let i = 0; i < game.players.length; i++){
            game.players[i].money += payouts[game.players[i].pName]||0; //pay money based on payouts
		}

        game.info.bets = []; //clear bets placed
        if (game.remRounds < game.maxRounds && (game.players.map(x => x.money).filter(x => x > 0).length > 0)){ //if not last round, increment round count and play again
			game.turnOptions = "betting";
			game.remRounds += 1;
        } else { //if last round, send to lobby
			game.turnOptions = "none";
            game.currentPlayer = "\x1E";
			game.currentScene = "lobby";
			game.colliders = sceneColliders["lobby"];
			game.interactables = sceneInteractables["lobby"];
		}
	}
};

const pokerMemTemplate = { //template object used to make a new poker memory object
    "phase" : 0,
    "prevRaise" : 0,
    "faiTT" : [],
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

const handRanks = { //types of hands ranked, 0 is best, 9 is worst
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

let pokerMem = {}; //object containing all the poker memory objects

const pokerFuncs = { //all functions used by the poker function
    "checkHand" : (game, pIndx) => { //checks the tier of hand, aswell as relevant cards and their ranks
        let seven = [...game.players[pIndx].cards[0]];
        seven.push(...game.dealer.cards); //grab seven potential cards
        let suits = [0,0,0,0];
        let allValue = [];
        let ranks = [0,0,0,0,0,0,0,0,0,0,0,0,0];
        let flush = 0;
        let groups = [];
        let straight = [0,-10,-10];

        for (let j = 0; j < 7; j++){ //find how many cards of specific suit and rank
            let i = seven[j];
            suits[i.suit] += 1;
            ranks[i.value] += 1;
            if (!allValue.includes(i.value)) allValue.push(i.value); //find unique ranks in hand
        }
        allValue.sort((a,b) => b-a); //sort by descending order

        for (let i in suits){ //find if there is a flush present
            if (suits[i] >= 5){
                flush = [1, i];
            }
        }
        if (allValue.length >= 5){ //check if there is a straight present, Ace (12) is high or low
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
            if (maxrun == 5) straight = [1, runStart, runEnd]; //if there is a run of five, set straight to that value
        }

        for (let i in ranks){ //check how many groups of cards of the ame rank there are
            if (ranks[i] > 1) groups.push([parseInt(ranks[i]),parseInt(i)]);
        }

        groups.sort((a,b) => 100*(b[0]-a[0]) + b[1]-a[1]); //sort groups by size and rank of group
        while (groups.length < 2){ //fill group with filler if not available
            groups.push([-1,0]);
        }

        seven.sort((a,b) => b.value-a.value); //sort seven potential cards by rank

        if (straight[0] == 1 && flush[0] == 1 && straight [1] == 8){ //return royal flush
            return "rf";
        } else if (straight[0] == 1 && flush[0] == 1){ //return straight flush
            return ["sf", straight[2]];
        } else if (groups[0][0] == 4){ //return four of a kind if largest group is of 4
            return ["4k", groups[0][1], allValue.filter(x => x != groups[0][1])[0]];
            //check for 5th highest card
        } else if (groups[0][0] == 3 && groups[1][0] >= 2){ //return fullhouse if largest and second largest group is 3 and (2 or more)
            return ["fh", groups[0][1], groups[1][1]];
        } else if (flush[0]) { //return flush and all cards if flush
            return ["fl", seven.filter(x => x.suit == flush[1]).slice(0,5).map(x => x.value)];
            //check for highest card zipper style
        } else if (straight[0]){ //return straight if straight
            return ["st", straight[2]];
            //check highest card (ace high OR low)
        } else if (groups[0][0] == 3){ //return three of a kind if the largest group is 3
            return ["3k", groups[0][1], seven.filter(x => x.value != groups[0][1]).slice(0,2).map(x => x.value)];
        } else if (groups[0][0] == 2 && groups[1][0] == 2){//return two pair if the largest two groups are 2
            return ["2p", groups[0][1], groups[1][1], allValue.filter(x => x != groups[0][1] && x != groups[1][1])[0]];
            //check for next highest card
        } else if (groups[0][0] == 2) { //return pair if the largest group is 2
            return ["1p", groups[0][1], seven.filter(x => x.value != groups[0][1]).slice(0,3).map(x => x.value)];
            //check for next highest card zipper style
        } else { //return high card if nothing else
            return ["hc", seven.slice(0,5).map(x => x.value)];
            //check for next highest card zipper style
        }
    },
    "compLikeHands" : (h1, h2) => { //check two hand of the same rank against eachother
        switch (h1[1]){
            case "hc": //find the highest card between the two hands. If the highest card is the same, look at the next highest
                for (let i = 0; i < 5; i++){
                    if (h1[2][i] > h2[2][i]) return h1;
                    if (h2[2][i] > h1[2][1]) return h2;
                }
                break;
            case "1p": //check rank of pair, then check each high card not in the pair highest to lowest.
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                for (let i = 0; i < 3; i++){
                    if (h1[3][i] > h2[3][i]) return h1;
                    else if (h2[3][i] > h1[3][1]) return h2;
                }
                break;
            case "2p": //check rank of the pairs high to low, then check the 5th card
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                if (h1[3] > h2[3]) return h1;
                if (h2[3] > h1[3]) return h2;
                if (h1[4] > h2[4]) return h1;
                if (h2[4] > h1[4]) return h2;
                break;
            case "3k": //check rank of group of three, then check two other cards high to low
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                for (let i = 0; i < 2; i++){
                    if (h1[3][i] > h2[3][i]) return h1;
                    else if (h2[3][i] > h1[3][1]) return h2;
                }
                break;
            case "st": //check highest card in straight
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                break;
            case "fl": //find the highest card between the two hands. If the highest card is the same, look at the next highest
                for (let i = 0; i < 5; i++){
                    if (h1[2][i] > h2[2][i]) return h1;
                    else if (h2[2][i] > h1[2][1]) return h2;
                }
                break;
            case "fh": //check the value of the group of three, then the group of two
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                if (h1[3] > h2[3]) return h1;
                if (h2[3] > h1[3]) return h2;
                break;
            case "4k": //check the rank of the group of four, then the fifth card
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                if (h1[3] > h2[3]) return h1;
                if (h2[3] > h1[3]) return h2;
                break;
            case "sf": //check the highest card of the straight
                if (h1[2] > h2[2]) return h1;
                if (h2[2] > h1[2]) return h2;
                break;
            case "rf": //all royal flushes are equal
                break;
        }
        return [[h1,h2]]; //return both hands if they are equal strength
    },
    "deal" : async (game) => { //deal cards to all players and initialise poker
        pokerMem[game.id] = {...pokerMemTemplate}; //create a new memory object
        let mem = pokerMem[game.id]; //shorthand assign the memory
        let cards = []; //deck of cards temporary golder

        game.info.win = []; //clear winners

         //creat a deck of 52 cards, shuffle cards
        for (let i = 0; i < 52; i++){
            cards.push(new card(Math.floor(i/13)%4, i%13, 1));
        }
        cards = cards.map((a) => ({ sort: Math.random(), value: a })).sort((a, b) => a.sort - b.sort).map((a) => a.value);

        //initialise / clean some memory elements
        game.currentPlayer =  "\x1E";
        game.dealer.cards = [];
        game.info.pots = [];
        mem.folds = [];
        game.info.folded = [];

        //clear all player cards
        for (let i = 0; i < game.players.length; i++){
            game.players[i].cards = [[]]
        }
        await new Promise(resolve => setTimeout(resolve, 500)); //deal cards to all players
        for (let i = 0; i < 2; i++){
            for (let j = 0; j < game.players.length; j++){
                try {game.players[j].cards[0].push(cards.shift());} catch {}
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        for (let i = 0; i < 5; i++){ //deal 5 facedown cards to dealer
            game.dealer.cards.push(cards.shift());
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        if (game.players.length > 1){ //assign round specific information
            mem.sblind = (game.remRounds - 1)%game.players.length; //assign small blind and current player
            mem.current = mem.sblind;
            mem.lastRaise = (mem.sblind + 1)%game.players.length; //set last raise
            mem.betStart = 1;
            mem.pots.main.sum = 30; //pay small and big blinds
            if (game.players[mem.sblind].money < 11 || game.players[(mem.sblind+1)%game.players.length].money < 21){
                pokerFuncs.proceed(game, 0);
                return;
            }
            game.players[mem.current].money -= 10;
            game.players[(mem.current+1)%game.players.length].money -= 20;
            mem.pots.main.bets = {};
            mem.pots.main.bets[game.players[mem.current].pName] = 10;
            mem.pots.main.bets[game.players[(mem.current+1)%game.players.length].pName] = 20;
            mem.pots.main.match = 20
            mem.pots.main.prevMatch = 0;
            mem.pots.main.max = -1;
            mem.pots.other = []; //initialise pots in game state
            game.info.pots = [["MAIN POT",mem.pots.main.sum, mem.pots.main.match]];
            game.info.minRaise = 20;
            game.info.sblind = mem.sblind;
            game.turnOptions = "raisecall"; //set turn options and set up for first tuen
            mem.current = (mem.current+2)%game.players.length
            game.currentPlayer = game.players[mem.current].pName;
            game.info.bets = mem.pots.main.bets;
            game.info.match = 20;
            mem.call = 20 - (mem.pots.main.bets[game.currentPlayer]||0);
        } else {
            pokerFuncs.proceed(game, 0); //return to lobby if insufficient players
        }
        return;
    },
    "next" : (game, nocheck) =>  { // move on to next player and process events of previous turn
        let mem = pokerMem[game.id];
        mem.current = (mem.current + 1)%game.players.length;
        game.currentPlayer = game.players[mem.current].pName;

        if (!nocheck){
            if (mem.folds.length == game.players.length -1){ //check if all but one players have folded
                pokerFuncs.nextPhase(game, 1);
                return;
            }
            if (mem.current == mem.lastRaise && (mem.betStart == 0 || mem.phase != 0)){ //check if all bets have been matched
                pokerFuncs.nextPhase(game);
                return;
            } else if (game.players[mem.current].money == 0 || mem.folds.includes(game.currentPlayer) || game.players[mem.current].cards[0].length == 0) {
                mem.betStart = 0; //start of betting is set to 0
                pokerFuncs.next(game); //check if the current player is broke, folded, or doesn't have cards
            } else if (game.players[mem.current].money > 0 && !mem.folds.includes(game.currentPlayer)){ //proceed if player has money and isnt fodled
                if (mem.pots.main.max == -1){ //if main pot is current active pot, process turn options and bet requeirements
                    game.info.bets = mem.pots.main.bets;
                    mem.call = mem.pots.main.match - (mem.pots.main.bets[game.currentPlayer]||0);
                    game.info.match = mem.pots.main.match;
                } else { //if main pot is not active, get active pot and process turn options and bet requirments
                    let potIndx = -1;
                    for (let i = 0; i < mem.pots.other.length; i++){
                        if (mem.pots.other[i].max == -1){
                            potIndx = i;
                            break;
                        }
                    }
                    if (potIndx != -1) {
                        game.info.bets = mem.pots.other[potIndx].bets;
                        mem.call = mem.pots.other[potIndx].match - (mem.pots.other[potIndx].bets[game.currentPlayer]||0);
                        game.info.match = mem.pots.other[potIndx].match;
                    }
                } //check if player must go in or raise; assign turn options approptiately
                if (mem.prevRaise > 0 && game.players[mem.current].money > mem.call) game.turnOptions = "raisecall";
                else if (mem.prevRaise > 0) game.turnOptions = "fallin";
            }
        }
        mem.betStart = 0; //start of betting is set to 0
        game.info.folded = mem.folds; //update game state with folded players
        game.info.pots[0] = ["MAIN POT", mem.pots.main.sum, mem.pots.main.match - mem.pots.main.prevMatch]; //update game state pots
        for (let i = 0; i < mem.pots.other.length; i++){
            let pot = mem.pots.other[i];
            if (i+1 in game.info.pots) game.info.pots[i+1] = [pot.exclude[pot.exclude.length-1] + "'S POT", pot.sum, pot.match - pot.prevMatch];
                else game.info.pots.push([pot.exclude[pot.exclude.length-1] + "'S POT", pot.sum, pot.match]);
        }
    },
    "nextPhase": async (game, allFold) => { //proceeds onto the next round of betting
        let mem = pokerMem[game.id]; //shorthand for memory

        if (mem.faiTT.length > 0){ //check forced all in for current active pot
            let pot = mem.pots.main;
            if (pot.max != -1){
                for (let j = 0; j < mem.pots.other.length; j++){
                    if (mem.pots.other[j].max == -1){
                        pot = mem.pots.other[j];
                        break;
                    }
                }
            }
            let ins = []; //list of players going all in
            for (let i = 0; i < mem.faiTT.length; i++){
                ins.push([[mem.faiTT[i]],pot.bets[mem.faiTT[i]]]);
            }


            ins.sort((a,b) => a[1] - b[1]); //sort all ins by the size of in
            for (let i = 0; i < ins.length; i++) {
                if (ins[i][1] == (ins[i+1]||[])[1]){
                    ins[i][0].push(...ins[i+1][0]);
                    ins.splice(i+1,1);
                    i--;
                }
            }
            let refPot = pot; //pot to copy from
            let tempPot = {}; //temporary pot for creating a new one
            for (let i = 0; i < ins.length; i++){ //add a new pot for each all in, in ascending bet value
                tempPot.bets = {};
                tempPot.match = 0;
                tempPot.prevMatch = 0;
                tempPot.sum = 0;
                tempPot.max = -1;
                tempPot.exclude = [...refPot.exclude, ...ins[i][0]];
                for (let j in refPot.bets.length){
                    if (j != ins[i][0]) {
                        tempPot.bets[j] = refPot.bets[j] - ins[i][1];
                        tempPot.sum += tempPot.bets[j];
                        refPot.sum -= (refPot.bets[j] - ins[i][1]);
                        refPot.bets[j] -= tempPot.bets[j];
                    }
                }
                refPot.max = 1;
                refPot = {...tempPot};
                refPot.prevMatch = 0;
                mem.pots.other.push(refPot);
                tempPot = {};
            }
        }
        mem.faiTT = []; //clear all in this turn

        mem.faiTT = []; //clear all ins
        mem.phase += 1; //increment phase
        mem.betStart = 1; //indicate start of betting
        mem.prevRaise = 0; //reset previous raise value
        mem.lastRaise = mem.sblind; //set last raise and current player to the small blind
        mem.current = mem.sblind;
        game.currentPlayer = game.players[mem.sblind].pName;

        game.turnOptions = "betcheck"; //assign turn options

        if (allFold != 1){ //if not all players have folded, process as normal
            mem.pots.main.prevMatch = mem.pots.main.match; //update value of other pots
            for (let i = 0; i < mem.pots.other.length; i++){
                mem.pots.other[i].prevMatch = mem.pots.other.prevMatch;
            }
            if (mem.phase < 4) { //if not the last phase, then update gamestate folds and pots
                game.info.folded = mem.folds;
                game.info.pots[0] = ["MAIN POT", mem.pots.main.sum, mem.pots.main.match - mem.pots.main.prevMatch];
                for (let i = 0; i < mem.pots.other.length; i++){
                    let pot = mem.pots.other[i];
                    if (i+1 in game.info.pots) game.info.pots[i+1] = [pot.exclude[pot.exclude.length-1] + "'S POT", pot.sum, pot.match-pot.prevMatch];
                    else game.info.pots.push([pot.exclude[pot.exclude.length-1] + "'S POT", pot.sum, pot.match]);
                }
            }
            if (mem.phase == 1){ //if its the first phase, reveale the first 3 dealer cards
                for (let i = 0; i < 3; i++){
                    await new Promise(resolve => setTimeout(resolve, 200));
                    game.dealer.cards[i].faceDown = 0;
                }
            } else if (mem.phase == 2){ //if its the second phase, reveal the 4th dealer card
                game.dealer.cards[3].faceDown = 0;
            } else if (mem.phase == 3){ //if its the third phase, reveal the final dealer card
                game.dealer.cards[4].faceDown = 0
            } else if (mem.phase > 3){ //if its the last phase, present player with option to proceed or quit
                pokerFuncs.settle(game); //payout
                game.turnOptions = "proceedquit";
                game.currentPlayer = game.players[mem.sblind].pName;
            }
            if (mem.phase < 4 && (game.players[mem.sblind].money == 0 || mem.folds.includes(game.currentPlayer))){
                pokerFuncs.next(game); //if the player has chosen to proceed, then start a new round
            }
        } else if (allFold == 1){ //if all players have folded
            for (let i = 0; i < game.dealer.cards.length; i++){ //reveal all dealer cards
                game.dealer.cards[i].faceDown = 0;
            }
            pokerFuncs.settle(game); //payout and present option to proceed or quit to players
            game.turnOptions = "proceedquit";
            game.currentPlayer = game.players[mem.sblind].pName;
        }
    },
    "settle" : (game) => { //calculates and pays winnings
        let mem = pokerMem[game.id]; //shorthand for memory
        game.currentPlayer = "\x1EDealer"
        let hands = []; //all hands in game
        let winners = { //holds who has won for each pot
            "main" : [],
            "other" : []
        };
        for (let i = 0; i < mem.pots.other.length; i++){
            winners.other.push([]); //adds new list for each side pot
        }

        for (let i = 0; i < game.players.length; i++){ //for all players, reveal hands, and add their hand to hands if not folded
            if (game.players[i].cards[0].length != 2) continue;
            let hand = pokerFuncs.checkHand(game, i);
            game.players[i].cards[0][0].faceDown = 0;
            game.players[i].cards[0][1].faceDown = 0;
            if (!mem.folds.includes(game.players[i].pName)) hands.push([game.players[i].pName, ...hand]);
        }
        winners.main.push(hands[0]); //set winner to first hand
        for (let i = 1; i < hands.length; i++) { //for each hand, check if it is higher ranked than the current winner and set winner, otherwise, add it to winners
            if (handRanks[hands[i][1]] < handRanks[winners.main[0][1]]){
                winners.main = [hands[i]];
            } else if (hands[i][1] == winners.main[0][1]){
                winners.main.push(hands[i]);
            }
        }
        for (let j = 0; j < winners.other.length; j++) { //do same as main pot for each side pot, excluding excluded players
            let thands = hands.filter(x => !mem.pots.other[j].exclude.includes(x[0]));
            for (let i = 0; i < thands.length; i++) {
                if (i == 0) winners.other[j].push(thands[0]);
                else {
                    if (handRanks[thands[i][1]] < handRanks[winners.other[j][0][1]]){
                        winners.other[j] = [thands[i]];
                    } else if (thands[i][1] == winners.other[j][0][1]){
                        winners.other[j].push(thands[i]);
                    }
                }
            }
        }
        if (winners.main.length > 1){ //if there is more than one winner, compare hands
            let best = [winners.main[0]]; //only accept hands of equal highest strength
            for (let i = 1; i < winners.main.length; i++){
                let t = pokerFuncs.compLikeHands(best[0], winners.main[i]);
                if (typeof(t[0]) == "object") {
                    best.push(winners.main[i]);
                } else {
                    best = [t];
                }
            }
            winners.main = best;
        }
        for (let j = 0; j < winners.other.length; j++){ //do same as main for side pots
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
            }
        }

        game.info.win = []; //clear winners in game state

        for (let i = 0; i < winners.main.length; i++){ //add winner and won amount to gamestate.win, add money to player value
            game.players.find(x => x.pName == winners.main[i][0]).money += (Math.round(mem.pots.main.sum/winners.main.length)||0);
            game.info.win.push([winners.main[i][0], Math.round(mem.pots.main.sum/winners.main.length)||0]);
        }
        for (let j = 0; j < winners.other.length; j++){ //do same for side pots
            for (let i = 0; i < winners.other[j].length; i++){
                game.players.find(x => x.pName == winners.other[j][i][0]).money += (Math.round(mem.pots.other[j].sum/winners.other[j].length)||0);
                game.info.win.push([winners.other[j][i][0], Math.round(mem.pots.other[j].sum/winners.other[j].length)||0]);
            }
        }

        for (let i = 0; i < game.players.length; i++){
            game.players[i].money = Math.max(0, game.players[i].money);
        }
    },
    "turns" : {  //functions representing different actions players can make on theit turn
        "be" : (game, amount) => { //bet, place a new bet, and add to all in if the player has bet all their money
            let mem = pokerMem[game.id];
            if (mem.pots.main.max == -1){ //check if main pot is active and place bet
                mem.pots.main.match += amount;
                mem.pots.main.sum += amount;
                mem.pots.main.bets[game.currentPlayer] += amount;
                mem.prevRaise = amount;
                mem.lastRaise = mem.current;
                game.players[mem.current].money -= amount;
                if (game.players[mem.current].money == 0){
                    mem.faiTT.push(game.currentPlayer);
                }
            } else {  //get active pot and place bet
                let potIndx = -1;
                for (let i = 0; i < mem.pots.other.length; i++){
                    if (mem.pots.other[i].max == -1){
                        potIndx = i;
                        break;
                    }
                }
                if (potIndx != -1){
                    if (!mem.pots.other[potIndx].exclude.includes(game.currentPlayer)){
                        mem.pots.other[potIndx].match = amount;
                        mem.pots.other[potIndx].sum = amount;
                        game.players[mem.current].money -= amount;
                        mem.pots.other[potIndx].bets = {};
                        mem.pots.other[potIndx].bets[game.currentPlayer] = amount;
                        mem.lastRaise = mem.current;
                        if (game.players[mem.current].money == 0){
                            mem.faiTT.push(game.currentPlayer);
                        }
                    }
                }
            }
            pokerFuncs.next(game); //move to next player
        },
        "ch" : (game) => { //check, move to next player
            let mem = pokerMem[game.id];
            pokerFuncs.next(game);
        },
        "ra" : (game, amount) => { //raise, increase bet, adjust related variables, and move to next player
            let mem = pokerMem[game.id];
            amount = Math.min(game.players[mem.current].money - mem.call, amount);
            mem.lastRaise = mem.current; //set last raise and prev raise to match this raise action
            mem.prevRaise = Math.max(mem.prevRaise, amount);
            game.info.minRaise = mem.prevRaise;
            if (mem.pots.main.max == -1){ //if main pot is active, apply changes to main pot
                mem.pots.main.match += amount;
                mem.pots.main.bets[game.currentPlayer] = mem.pots.main.match;
                mem.pots.main.sum += mem.call + amount;
                game.players[mem.current].money -= amount + mem.call;

                if (game.players[mem.current].money == 0){ //if player has bet all money, add to all ins
                    mem.faiTT.push(game.currentPlayer);
                }
            } else { //if main pot is not active, get active pot
                let potIndx = -1;
                for (let i = 0; i < mem.pots.other.length; i++){
                    if (mem.pots.other[i].max == -1){
                        potIndx = i;
                        break;
                    }
                }
                if (potIndx != -1 ){
                    if (!mem.pots.other[potIndx].exclude.includes(game.currentPlayer)){
                        mem.pots.other[potIndx].match += amount;
                        mem.pots.other[potIndx].bets[game.currentPlayer] = mem.pots.other[potIndx].match ;
                        mem.pots.other[potIndx].sum += mem.call + amount;
                        game.players[mem.current].money -= amount + mem.call;
                    }
                }
            }
            pokerFuncs.next(game); //move to next player
        },
        "ca" : (game) => { //call, player is matching the bet that is already placed
            let mem = pokerMem[game.id];
            if (mem.pots.main.max == -1){ //check if main pot is active
                mem.pots.main.bets[game.currentPlayer] = mem.pots.main.match;
                mem.pots.main.sum += mem.call; //add money to bet and remove money from player
                game.players[mem.current].money -= mem.call;
            } else { //if main pot is not active, get active pot and do the same
                let potIndx = -1;
                for (let i = 0; i < mem.pots.other.length; i++){
                    if (mem.pots.other[i].max == -1){
                        potIndx = i;
                        break;
                    }
                }
                if (potIndx != -1){
                    mem.pots.other[potIndx].bets[game.currentPlayer] = mem.pots.other[potIndx].match;
                    mem.pots.other[potIndx].sum += mem.pots.other.match - mem.pots.other[potIndx].bets[game.currentPlayer];
                    game.player[mem.current].money -= mem.pot.other.match - mem.pos.other[potIndx].bets[game.currentPlayer];
                }
            }
            pokerFuncs.next(game); //move to next player
        },
        "ai" : (game) => { //all in, when a player is forced to move all in because they cannot afford to call
            let mem = pokerMem[game.id];
            mem.faiTT.push(game.currentPlayer); //add to all in
            if (mem.pots.main.max == -1){ //check if main pot is active
                mem.pots.main.sum += game.players[mem.current].money; //add player money to pot
                mem.pots.main.bets[game.currentPlayer] +=  game.players[mem.current].money;
                game.players[mem.current].money = 0; //clear player money
            } else { //if main pot is not active, get active pot and do same
                let potIndx = -1;
                for (let i = 0; i < mem.pots.other.length; i++){
                    if (mem.pots.other[i].max == -1) {
                        potIndx = i;
                        break;
                    }
                }
                let pot = mem.pots.other[potIndx];
                pot.sum += game.players[mem.current].money;
                pot.bets[game.currentPlayer] += game.players[mem.current].money;
                game.players[mem.current].money = 0;
            }
            pokerFuncs.next(game); //move to next player
        },
        "fo" : (game) => { //fold
            let mem = pokerMem[game.id];
            game.players[mem.current].cards[0][0].faceDown = 0; //reveal cards
            game.players[mem.current].cards[0][1].faceDown = 0;
            mem.folds.push(game.currentPlayer); //add to folds
            pokerFuncs.next(game); //move to next player
        }
    },
    "proceed" : (game, deci) => { //executes on decision made by player to proceed or quit
        if (game.remRounds != game.maxRounds && deci == 1){ //on proceed
                game.remRounds += 1;    //increment rounds`
                pokerFuncs.deal(game);  //deal a new game
        } else {                        //on a quit, send to lobby
            game.turnOptions = "none";
            game.currentPlayer = "\x1E";
            game.currentScene = "lobby";
            game.colliders = sceneColliders["lobby"];
            game.interactables = sceneInteractables["lobby"];
        }
    },
    "disconnect" : (game, lostInd, lostName) => { //what the game should do if a player discomnects during poker
        mem = pokerMem[game.id];
        if (lostInd == mem.current && game.players.length > 0) {
            game.currentPlayer = ((game.players[mem.current]??game.players[0]).pName)??"";
            if (mem.current == game.players.length) mem.current = 0;
        }
        else if (lostInd < mem.current && game.players.length > 0) mem.current -= 1;
        if (game.players.length == 0) delete pokerMem[game.id];
        gameManager.playerMem[game.id][lostName].cards = [[]];
    }
};

let fightMemTemplate = {
    "clId" : undefined
}
let fightMem = {}
let fightFuncs = { //functions used by the fight scene
    "checkWin" : (game) => { //check if there is only one player standing
        if (game.info.ready.length < 2){
            game.info.win = game.info.ready[0]??game.info.win; //assign winner
            fightFuncs.end(game); //end fight scene
        }
    },
    "end" : async (game) => { //end fight scene function
        clearInterval(fightMem[game.id].clId); //clear check win interval

        let p = game.players.find(x => x.pName == game.info.win)??{}; //get player object of winner
        let winVal = (p.money??0) + 2000; //set how much money the player has won
        for (let i = 0; i < game.players.length; i++){ //for all players...
            if (game.players[i].pName == p.pName) { //if the player is the winner, pay them the winnings
                game.info.win = [p.pName, winVal];
                game.players.money *= 2;
                game.players[i].money += 2000;
            }
            if (game.players[i].money <= 0.3*(winVal+2000)) { //if a player has less than 30% of the winnings in money, pay them 50%
                game.players[i].money += Math.round(winVal*0.5 + 1000); //of the winnings to prevent stagnation of the game
            }
        }

        await new Promise(r => setTimeout(r, 5000)); //wait 5 seconds before advancing

        for (let i = 0; i < game.players.length; i++){ //for all players, reset their positions to the center
            game.players[i].col.origin.x = 317 - 40*(i%2) + 20*(game.players.length == 3 && i == 3);
            game.players[i].col.origin.y = 205 - 80*(i>2) + 40*(game.players.length < 2);
            game.players[i].health = [100,100]; //reset health
            game.players[i].ammo = [10,10]; //reset ammo
            game.players[i].upgrades = ""; //clear upgrades
        }

        game.turnOptions = "none"; //send players to lobby
        game.currentPlayer = "\x1E";
        game.currentScene = "lobby";
        game.colliders = sceneColliders["lobby"];
        game.interactables = sceneInteractables["lobby"];
    }
}

server.on('connection', (socket) => { //determines what happens when a player connects to the server
    let id;    //id of the socket (playerName + roomCode)
    let game;  //game state that the socket is a part of
    let playerIndex; //index of the player that is linked via this socket
    let riId;  //interval id of the refreshIndex function

    function refreshIndex(){ //gets the index of the player that is linked to this socket
		playerIndex = game.players.findIndex((x) => {return x.pName == id.slice(0,-4)});
	}

    socket.on('message', (message) => { //what the socket should do when it recieves a message
        message = message.toString(); //convert message into a string
        if (message[0] == '!'){
            let args = message.split("\x1F");
            if (args.length == 4) game.players[args[1]][args[2]] = args[3];
            else if (args.length == 5) game.players[args[1]][args[2]][args[3]] = args[4];
        }
        if (message[0] == 'h'){ //if the string is "h"-prefixed, try to host a room
            let args = message.split("\x1F"); //split into arguments with delimiting character
            if (gameManager.games[args[2]] == null){ //if the game doesn't already exist
                id = args[1]+args[2]; //create a room id and assign it
                let nGame = new gameObj(args[2]); //create a new game object
                nGame.players.push(new player({}, args[3], 100, 1000, args[1])); //add a new player (the host)
				playerIndex = 0;
                nGame.votes[args[1]] = 0; //initialise votes for this player
                nGame.maxRounds = parseInt(args[4]); //assign max rounds for the game
                nGame.currentScene = "lobby"; //set current scene and related variables in the game to lobby
				nGame.interactables = sceneInteractables.lobby;
				nGame.colliders = sceneColliders.lobby;
                gameManager.games[args[2]] = nGame; //push game object to game manager
                game = gameManager.games[args[2]];  //set game variable to the game object
                gameManager.collisionHandlers[args[2]] = collisionHandler; //add a new collision handler
                gameManager.projectileHandlers[args[2]] = setInterval(() => {projectileHandler(game)}, 25); //add a new projectile handler
                gameManager.playerMem[args[2]] = {}; //initialise player memory for this game
                socket.send("r\x1F" + JSON.stringify(game));   //return game state to player
                riId = setInterval(refreshIndex,100); //assign refreshIndex interval
                gameManager.sockets[args[2]] = [];  //initialise sockets list for this game
                gameManager.sockets[args[2]].push(socket); //push this socket to the sockets list
            } else {socket.send(-1);} //if room is not availabe, return error code
        } else if (message[0] == 'j') {  //if message is "j"-prefixed, try to join a room
            let args = message.split("\x1F"); //split message into arguments with delimiting character
            game = gameManager.games[args[2]]; //try and fetch game from game manager
            if (game != null){ //if game exists
                if (game.players.find(x => x.pName == args[1]) != null){socket.send(-2); return 0;} //send error code to client if player name is taken
                if (game.players.length == 4){socket.send(-3); return 0;}   //send error code to client if room is full
                id = args[1]+args[2];   //assign id to socket
                playerIndex = game.players.length; //intialise playerindex
                if (gameManager.playerMem[args[2]][args[1]] != null) { //if player is stored in memory
                    let tempPlayer = gameManager.playerMem[args[2]][args[1]]; //grab player from memory
                    tempPlayer.bet = 0; //clear player bet
                    game.players.push(tempPlayer); //add player to game
                    delete gameManager.playerMem[args[2]][args[1]]; //remove player from memory
                } else game.players.push(new player({}, args[3], 100, 1000, args[1])); //if not in memory, create new player
                game.votes[args[1]] = 0;
                socket.send("r\x1F" + JSON.stringify(game)); //return game state
                riId = setInterval(refreshIndex,100);       //assign refresh index interval
				gameManager.sockets[args[2]].push(socket);
			} else {socket.send(-1);}
        } else if (message[0] == "m") {   //if message is "m"-prefixed, process movement request
            let args = message.split("\x1F");
			if (game != null){
				let player = game.players[playerIndex];
				if (player != null){
                    if (game.info.ready.includes(player.pName) || game.currentScene != "fight") {
                        player.col.origin = vec.add(player.col.origin, vec.n(args[1],args[2]));
                        player.flipped = parseInt(args[3]);
                        gameManager.collisionHandlers[game.id](game, player); //collide player against scene
                    }
					socket.send("r\x1F" + JSON.stringify(game));
				}
			}
        } else if (message[0] == "d") { //if message is "d"-prefixed, update look direction of player
            let args = message.split("\x1F");
            if (game != null){
                let player = game.players[playerIndex];
                if (player != null){
                    player.ldir.x = args[1];
                    player.ldir.y = args[2];
                }
            }
        } else if (message[0] == "v") { //if message is "v"-prefixed, process player votes
			let args = message.split("\x1F");
            if (game.votes[id.slice(0,-4)] == args[1]) game.votes[id.slice(0,-4)] = 0; //if vote is already the object, clear vote
            else game.votes[id.slice(0,-4)] = args[1]; //otherwise assign vote
            if (args[1] != 0){ //if vote is assigned, check if any object has full votes
                let count = 0; //proceed with relevant scene if so
                for (let v in game.votes) {count += (game.votes[v]==args[1])};
    			if (count == Math.max(2, game.players.length)){
    				for (let v in game.votes) {game.votes[v] = 0;}
                    let t = kts[args[1]]
    				game.currentScene = t;
    				game.colliders = sceneColliders[t];
    				game.interactables = sceneInteractables[t];
                    if (args[1] == "bj"){ //start blackjack
                        blackjackMemory[game.id] = {...blackjackMemoryTemplate};
    					blackjackFuncs.start(game);
                    } else if (args[1] == "rl") { //start roulette
                        game.info.ready = [];
                        game.info.bets = [];
    					game.remRounds = 1;
    					game.votes = {};
    					game.turnOptions = "betting";
                    } else if (args[1] == "pk"){ //start poker
                        game.currentPlayer = "\x1E"
    					game.remRounds = 1;
    					game.votes = {};
                        game.turnOptions = "\x1E";
                        pokerFuncs.deal(game);
                    } else if (args[1] == "ff"){ //start fight
                        game.info.ready = game.players.map(x => x.pName);
                        for (let i = 0; i < game.players.length; i++){
                            let p = game.players[i];
                            if (p.upgrades.includes("2")) p.ammo[0] = p.ammo[1] = p.ammo[1] + (5 * (p.upgrades.split("2").length -1));
                            if (p.upgrades.includes("b")) p.health[0] = p.health[1] = p.health[1] + (25 * (p.upgrades.split("b").length - 1));

                            p.col.origin.x = 32 + Math.random() * 560;
                            p.col.origin.y = 32 + Math.random() * 266;
                        }
                        game.info.win = [];
                        fightMem[game.id] = {...fightMemTemplate};
                        fightMem[game.id].clId = setInterval(()=>{fightFuncs.checkWin(game)}, 25);
                    }
    			}
            }
        } else if (message[0] == "r"){ //if message is "r"-prefixed request message, return game sate
			let args = message.split("\x1F");
			if (game != null){
				socket.send("r\x1F" + JSON.stringify(game));
			}
        } else if (message[0] == "a") { //if message is "a"-prefixed action message, process action
            let args = message.split("\x1F"); //split into args and grab player object
			let p = game.players[playerIndex];

            if (game.currentScene == "fight") { //if the current scene is fight...
                if (!game.info.ready.includes(p.pName)) return; //if the player has died, ignore message
                if (args[1] == "s") { //if the player is trying to shoot and they have ammo
                    if (p.ammo[0] > 0){
                        p.ammo[0] -= 1;
                        let dm = p.upgrades.split("0").length - 1; //grab upgrades relevant to new projectiles
                        let ra = p.upgrades.split("4").length - 1;
                        let sh = p.upgrades.split("7").length - 1;  //create projectiles in direction of look direction of the player
                        game.projectiles.push(new projectile(col.circle(vec.n(p.col.origin.x + 8*p.ldir.x + 8,
                            p.col.origin.y + 8*p.ldir.y + 15), 4), vec.n(p.ldir.x * 15, p.ldir.y * 15),
                            10 * (1.1**dm), 15*(1.2**ra), p.pName, sh));

                        if (p.upgrades.includes("6")){ //if the player has multishot (minced) upgrade
                            let co = (p.upgrades.split("6").length - 1);
                            for (let i = 0; i < co; i++){ //for each minced upgrade, create 2 extra projectiles, equally spread in an angle of 90 degrees
                                let c = Math.cos(Math.PI * ((0.25/co) + (i*0.25/(co))));
                                let s = Math.sin(Math.PI * ((0.25/co) + (i*0.25/(co))));
                                let acDir = vec.n(p.ldir.x * c - p.ldir.y * s, p.ldir.x*s + p.ldir.y*c);
                                let cDir = vec.n(p.ldir.x * c + p.ldir.y * s, p.ldir.y * c - p.ldir.x * s);
                                game.projectiles.push(new projectile(col.circle(vec.n(p.col.origin.x + 8*cDir.x + 8, //creat projectile anticlockwise and clockwise
                                    p.col.origin.y + 8*cDir.y + 15), 4), vec.n(cDir.x * 15, cDir.y * 15),
                                    10 * (1.1**dm), 15*(1.2**ra), p.pName, sh));
                                game.projectiles.push(new projectile(col.circle(vec.n(p.col.origin.x + 8*acDir.x + 8,
                                    p.col.origin.y + 8*acDir.y + 15), 4), vec.n(acDir.x * 15, acDir.y * 15),
                                    10 * (1.1**dm), 15*(1.2**ra), p.pName, sh));

                            }
                        }
                    }
                } else if (args[1] == "r"){ //if player is trying to reload, set ammo to ammo maximum
                        p.ammo[0] = p.ammo[1];
                }
            } else if (game.currentScene == "lobby"){ //if current scene is lobby
                if (args[1] == "sl"){ //if player is trying to spin slots
                    if (p.money > 0) { //if player has money, remove up to five money
						p.money = Math.max(0, p.money - 5);
                    } else { //else add a random amount between 0 and 75% of the poorest players money. If nobody has money, then use 250 as bounds
                        p.money = Math.round((((game.players.map(x => x.money).sort((a,b) => a-b).filter(x => x != 0)[0]) * 0.75)||250) * Math.random());
					}
                } else if (args[1] == "buy"){ //if player is trying to buy an item
                    if (p.money > (parseInt(args[2])||0)){
                        p.money = p.money - parseInt(args[2])||0; //subtract money from player
                        p.upgrades += args[3]||""; //add upgrade to player
                    }
                }
			}

            else if (game.currentScene == "roulette"){ //if current scene is roulette
                if (game.turnOptions == "betting"){ //if turn options are betting
                    if (args[1] == "ba"){  //if player is trying to add bet
                        game.info.bets.push(JSON.parse(args[2])); //add bet and sort bets by position
						game.info.bets.sort((a,b) => {return ((a.pos[0]-b.pos[0]) + 100*(a.pos[1] - b.pos[1]));});
                    } else if (args[1] == "br"){ //if player is trying to remove bet
						let ind = game.info.bets.findIndex(x => (x.pos == `${args[2]}` && x.owner == id.slice(0,-4)));
                        if (ind > -1) game.info.bets.splice(ind, 1); //if bet is found, remove it
                        else if (args[2] == "a") { //if player is trying to remove all bets, remove all bets placed by that player
							for (let i = 0; i < game.info.bets.length; i++) {
								if (game.info.bets[i].owner == id.slice(0,-4)){
									game.info.bets.splice(i,1);
									i -= 1;
								}
							}
						}
                    } else if (args[1] == "re" && !game.info.ready.includes(p.pName)){ //if player is submitting ready message, lock bets
                        game.info.ready.push(id.slice(0,-4)); //add them to gamestate ready
                        if (game.info.ready.length == game.players.length){
                            rouletteFuncs.spin(game); //if all players are ready, spin roulette wheel
						}
					}
				}
			}
            else if (game.currentScene == "blackjack"){ //if current scene is blackjack...
                if (game.turnOptions == "bjbet" && game.currentPlayer == p.pName){ //if turnoptions are bjbet...
                    if (args[1] != null){ //if the player has bet money, assign player bet and subtract it from player money
                        if (args[1] > 0){
                            p.bet = args[1];
                            p.money -= args[1]; //increment current player
							if (playerIndex+1 < game.players.length) game.currentPlayer = game.players[playerIndex+1].pName;
							else {game.currentPlayer = "\x1F"; blackjackFuncs.deal(game);}
                        } else if (args[1] == 0 && p.money == 0){ //if player is broke, accept empty bet
							if (playerIndex+1 < game.players.length) game.currentPlayer = game.players[playerIndex+1].pName;
							else {game.currentPlayer = "\x1F"; blackjackFuncs.deal(game);}
						}
					}
				}
                if (game.turnOptions.slice(0,6) == "bjturn" && game.currentPlayer == p.pName){ //if turn option include bjturn...
                    if (args[1] == "h"){ //if player tries to hit, deal new card, move to next player if bust
                        p.cards[p.currentHand].push(blackjackMemory[game.id].cards.shift());
						let handSum = 0;
						for (let i = 0; i < p.cards[p.currentHand].length; i++){
							let temp = blackjackMemory[game.id].valueLookup[p.cards[p.currentHand][i].value];
							if (typeof(temp) == "object") handSum += 1;
							else handSum += temp;
						}
                        if (handSum > 21) { //if bust move to next player
							blackjackFuncs.next(game);
						} else {
							game.turnOptions = blackjackFuncs.checkHand(p).turn;
						}
					}
                    else if (args[1] == "p") { //if player tries to split, split hand
						p.money -= p.bet;
						blackjackFuncs.split(game, p);
					}
                    else if (args[1] == "d") { //if playe tries to double down, double down
						p.money -= p.bet;
						let temp = blackjackMemory[game.id].cards.shift();
						temp.faceDown = 1;
						p.cards[p.currentHand].push(temp);
						blackjackFuncs.next(game);
					}
                    else if (args[1] == "s") blackjackFuncs.next(game); //if player tries to stand, move to next player
				}
			}
            else if (game.currentScene == "poker"){ //if current scene is poker
                if (args[1] == "pr"){ //if action is proceed, run proceed function
                    pokerFuncs.proceed(game, parseInt(args[2]));
                } else if (args[1] in pokerFuncs.turns){ //if there is an associated turn function, run turn function
                    pokerFuncs.turns[args[1]](game, parseInt(args[2]||0)||0);
                }
            }
		}
	});

    socket.on('close', (...args) => { //defines what happens when the a connection closes
        if (id != null) { //if the socket has an assigned id
            clearInterval(riId); //clear refresh interval
            let pId = id.slice(0, -4); //split id into game and player names
			let gId = id.slice(-4);
            //handle disconnect for blackjack
			if (game.currentScene == "blackjack") {
                blackjackFuncs.disconnect(game, playerIndex);
            }
            gameManager.playerMem[gId][pId] = game.players[playerIndex]; //send player to memory
            gameManager.games[gId].players.splice(playerIndex, 1); //remove player from game state
            let rlRId = game.info.ready.findIndex(x => x == pId);
            if (rlRId != -1) game.info.ready.splice(rlRId,1); //remove player from gamestate ready
            delete game.votes[pId]; //clear votes
            if (game.currentScene == "poker") { //handle disconnect if in poker
                pokerFuncs.disconnect(game, playerIndex, pId);
            }
            if (game.currentScene == "fight") { //handle disconnect if in fight
                let ind = game.info.ready.indexOf(pId);
                if (ind > -1){
                    game.info.ready.splice(ind,1);
                }
            }
            if (game.players.length == 0){ //if there are no players left, close room.
				delete gameManager.games[gId];
				clearInterval(gameManager.collisionHandlers[gId]);
                clearInterval(gameManager.projectileHandlers[gId]);
                if (fightMem[gId] && (fightMem[gId]??{}).clId) clearInterval(fightMem[gId].clId);
				delete gameManager.collisionHandlers[gId];
                delete gameManager.projectileHandlers[gId];
				delete gameManager.playerMem[gId];
                delete blackjackMemory[gId];
                delete pokerMem[gId];
                delete fightMem[gId];
            }
		}
	});
});
