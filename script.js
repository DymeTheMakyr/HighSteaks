(() => {//init display variables
let sw = window.innerWidth - 1;
let sh = window.innerHeight - 1;
let factor = [16, 9];
let charScaleFact = 2;
sw = sw / factor[0] < sh / factor[1] ? sw : (sh / factor[1]) * factor[0];
sh = sw / factor[0] > sh / factor[1] ? sh : (sw / factor[0]) * factor[1];

// DISABLE CONTExT MENU
document.addEventListener("contextmenu", event => event.preventDefault());
/*// DISABLE CONSOLE
(function () {
  try {
    const originalConsole = console;
    Object.defineProperty(window, 'console', {
      get: function () {
        throw new Error('Console is disabled for security reasons.');
      },
      set: function (val) {
        console = val;
      }
    });
  } catch (e) {}
})();
*/


//create essential HTML elements
const container = document.getElementById('container');
const storage = document.getElementById('sceneStorage');
const canv = document.createElement('canvas'); //create canvas
canv.width = '640'; //internal width
canv.height = '360'; //internal height
canv.style.width = sw.toString() + 'px'; //external width
canv.style.height = sh.toString() + 'px'; //external height
canv.style.border = 'solid 1px blue'; //border
storage.appendChild(canv); //add to container
const ctx = canv.getContext('2d'); //grab context
ctx.imageSmoothingEnabled = false;

let unload; //holds unload function for current scene
const scene = {}; //holds all scene functions
let game = 0; //holds game state

//load pixel font
const pixelFont = new FontFace("pixel", "url(./fonts/pixel.otf)");
document.fonts.add(pixelFont);

//public debug variables
let debug = {
	"showHitboxes":false,
	"hitboxOpacity":0.1
};

let roomNo; //stores room Code
let playerName; //stores client pName
let flip = 0; //stores if player is flipped

let kts = { //key to scene, converts 2char string into scene names
	"bj" : "blackjack",
	"rl" : "roulette",
	"pk" : "poker",
	"ff" : "fight"
}


// Overlap function
function overlap(a, b){
	if (b.type == "r" && !b.solid){
		let aCntr = vec.avg(a.origin, ...a.points);
		let bCntr = vec.avg(b.origin, ...b.points);

		if (Math.abs(aCntr.x - bCntr.x) < (a.width + b.width)/2 && Math.abs(aCntr.y - bCntr.y) < (a.height+b.height)/2){
			return 1;
		}
		return 0;
	} return -1;
}

// img load helper function
function loadImg(path){
		let temp = new Image();
		temp.src = path;
		return temp;
}

// audio load helper function
function loadAudio(path){
	let temp = new Audio();
	temp.src = path;
	return temp;

}

//vector class
class vec{
	x = 0;
	y = 0;

	normal = () => { //returns unit vector of the current vector
		let m = (this.x**2 + this.y**2)**0.5;
		return new vec(this.x / m || 0, this.y / m || 0);
	};

	constructor(_x, _y){
		this.x = parseFloat(_x);
		this.y = parseFloat(_y);
	}
	static n(_x, _y){ //alternate method to create a vector object
		return new vec(_x, _y);
	}
	static avg(off, ...vecs){ //averages n amount of vectors with a positin offset
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
	static add(a,b){ //adds two vectors
		return vec.n(a.x+b.x, a.y+b.y);
	}
	static sub(a,b){ //subtracts vector a from vector b
		return vec.n(a.x-b.x, a.y-b.y);
	}
	static distance(a,b){ //gets the scalar distance between to point described by the vectors
		return ((a.x-b.x)**2 + (a.y-b.y)**2)**0.5;
	}
}

// scene change function
function changeScene(targetScene, sock, ...args){
	if (targetScene in scene){
		unload(); //run stored unload function
		let close = 0; //if scene switched to selection, raise flag to close connection
		if (targetScene == "selection") {container.appendChild(document.getElementById("selectionScene")); close = 1;}
		else container.appendChild(canv); //if not selection, push canvas to document
		unload = scene[targetScene](sock, ...args); //run scene function and grab unload
		if (close == 1) sock.close(); //if flag is raised, close connection
	} else {
		throw new Error("targetScene not found, is it in scene object?");
	}
}

//collier class
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
	static rect(o, w, h){ //creates a rectangle collider with origin at top left
		let c = new col("r", o, vec.n(0,0), vec.n(0+w,0), vec.n(0+w,0+h), vec.n(0,0+h));
		c.width = w;
		c.height = h;
		c.solid = false;
		return c;
	}
}

//button class
class button {
	col; //collider that represents clickable area
	text; //text to be drawn over button
	textCol; //colour of said text
	colour; //colour of the button
	colourPressed; //colout of the button when pressed
	pressed = 0; //property to determine if button is or isnt pressed
	func; //function to run when the button is pressed

	constructor(t, tc, c, co, cop, f){
		this.col = c;
		this.text = t;
		this.textCol = tc;
		this.colour = co;
		this.colourPressed = cop;
		this.func = f;
	}
}

// card manager
class cards {
	static rNo = []; //all the red number images
	static bNo = []; //all the black number images
	static suits = []; //the four suits images
	static back; //the card back image
	static bg; //the card background image (white)

	static {
		for (let i = 0; i < 13; i++){ //load red numbers
			cards.rNo.push(loadImg("./cards/" + ("000" + i).substr(-3) + ".png"));
		}
		for (let i = 0; i < 13; i++){ //load black numbers
			cards.bNo.push(loadImg("./cards/" + ("000" + (i+13)).substr(-3) + ".png"));
		}
		for (let i = 0; i < 4; i++){ //load suits
			cards.suits.push(loadImg("./cards/" + ("000" + (i+26)).substr(-3) + ".png"));
		}
		cards.back = loadImg("./cards/back.png"); //load back
		cards.bg = loadImg("./cards/030.png"); //load background
	}
}

// cow manager
class cows {
	static strings = []; //values to be referenced by selection scene
	static imgs = []; //right facing images for all cows
	static fimgs = []; //left facing (flipped) images for all cows
	static dead; //image to represent dead players

	static {
		for (let i = 0; i < 9	; i++){ //load and store string of cow images
			cows.strings.push("./cows/" + ("000" + (i)).substr(-3)+".png");
			cows.imgs.push(loadImg(cows.strings[i]));
		}
		for (let i = 0; i < 8; i++){ //load flipped cow images
			cows.fimgs.push(loadImg("cows\\flipped\\" + ("000" + (i)).substr(-3)+".png"));
		}

		cows.dead = loadImg(".\\cows\\dead.png"); //load dead cow image
	}
}
// background manager
class background {
	static imgs = {}; //holds all background images to be used in the scenes

	static {
		background.imgs.lobby = {}; //create a lobby structure
		background.imgs.fight = {}; //create a fight structure
		background.imgs.lobby.floor = loadImg("./background/lfloor.png"); //add lobby floor to lobby structure
		background.imgs.lobby.wall = loadImg("./background/lwall.png"); //add wall to same
		background.imgs.blackjack = loadImg("./background/blackjack.png"); //load blackjack bg
		background.imgs.generic = loadImg("./background/generic.png"); //load generic table
		background.imgs.rtable = loadImg("./background/rtable.png"); //load roulette betting area
		background.imgs.shop = loadImg("./background/shop.png"); //load shop background
		background.imgs.fight.floor = loadImg("./background/ffloor.png"); //add fight floor to fight structure
		background.imgs.fight.wall = loadImg("./background/fwall.png"); //add wall to same
	}
}

//Sprite Manager
class sprites {
	static imgs = {};

	static {
		sprites.imgs.blackjack = loadImg("./sprites/blackjack.png"); //load blackjack table sprite
		sprites.imgs.roulette = loadImg("./sprites/roulette.png"); //load roulette table sprite
		sprites.imgs.poker = loadImg("./sprites/poker.png"); //load poker table sprite
		sprites.imgs.fight = loadImg("./sprites/fight.png"); //load fight table sprite
		sprites.imgs.slots = loadImg("./sprites/slots.png"); //load slot machine sprite
		sprites.imgs.wheel = loadImg("./sprites/wheel.png"); //load roulette wheel sprite
		sprites.imgs.ball = loadImg("./sprites/ball.png"); //load roulette ball sprite
		sprites.imgs.sb = loadImg("./sprites/sb.png"); //load small blind token
		sprites.imgs.bb = loadImg("./sprites/bb.png"); //load big blind token
	}
}

class audio {
	static clips = {};

	static {
		audio.clips.sel = loadAudio("./audio/select.wav"); //load select sound
		audio.clips.desel = loadAudio("./audio/deselect.wav"); //load deselect sound
		audio.clips.slots = loadAudio("./audio/slots.wav"); //load slot roll sound
		audio.clips.slotswin = loadAudio("./audio/slotswin.wav"); //load slots win sound
		audio.clips.bar = loadAudio("./audio/bar.wav"); //load bar sound
		audio.clips.shop = loadAudio("./audio/shop.mp3"); //load shop open sound
		audio.clips.card = loadAudio("./audio/card.wav"); //load card dealt sound
		audio.clips.hit = loadAudio("audio/hit.wav"); //load hit sound
		audio.clips.hurt = loadAudio("audio/hurt.wav"); //load hurt sound
		audio.clips.shoot = loadAudio("audio/shoot.wav"); //load shoot sound
		audio.clips.dash = loadAudio("audio/dash.wav"); //load dash sound
		audio.clips.jazz = loadAudio("./audio/jazz.mp3"); //load background music
		audio.clips.jazz.loop = true; //set background music to loop
	}
}

class upgrades {
	static lu = ["dm", "fr", "ma", "rs", "ra",
				"sv", "mi", "sh", "oc","dc"] //first 10 upgrade keys

	static faces = {}; //load all upgrade unique faces
	static back; //load background for the upgrade sprite

	static all = [[ //a list of all the upgrades, descriptions, and effects sorted into categories
				["0","Mootilation", "It all over the fields", "+10% damage"],
				["1","Ruminate","More bullet per bullet? Im in.", "+20% fire rate"],
	/*norm weapon*/	["2", "Bucket Full", "Never run dry", "+5 magazine size"],
				["3", "Opposable Hooves", "How does that even work?", "+10% reload speed"],
				["4", "Open Pastures", "Is that Bessie over there?", "+20% range"]
		],
		[
				["5", "Sous Vide", "Like a 100\xB0C bath", "+3s burn time"],
				["6", "Minced", "It really gets everywhere...", "+2 projectiles"],
	/*spec weapon*/	["7", "Milkshake", "Ice cream from a different angle", "+1 bounces"],
				["8", "Overcooked", "Well done? More like well gone.", "Bullets explode for 30% damage"],
				["9", "Debt Collector", "I'll be taking that!", "+10% lifesteal"]
		],
		[
				["a", "Thick Hide", "You'll need more than a steak knife", "-5 incoming damage (Min. 1)"],
	/*norm player*/ ["b", "Well Done", "Like chewing rubber", "+25 health"],
				["c", "Rendered Fat", "Slippery.", "+10% movement speed"],
				["d", "Matador", "Who's dancing now?", "+2 dashes"]
		],
		[
				["e", "Last Stand", "Not Today.", "+1 lethal attacks negated"],
	/*spec player*/ ["f", "Bull Rush", "It's just one after another", "+2% speed on damage dealt"],
				["g", "Cow Tipping", "Timber!!!", "+500% damage to on death."],
				["h", "Loaded Dice", "The house always wins", "+5% hyperbolic chance to negate damage"]
		]

	];

	static priceMults = [ //first 10 price multipliers
		1  , 1  , 1  , 1   , 1  ,//nw
		1.1, 1.1, 1.2, 1.3, 1.2,//sw
	];

	static {
		let add = ["de", "he", "mo", "do", //lookup identifiers to add using a-g
		"ls", "br", "ct", "ld"];
		let addm = [
			1  , 1  , 1  , 1   , //price multipliers to add using a-g
			1.1, 1.1, 2.2, 1.8 ];
		for (let i = 0; i < add.length; i++){ //add lookup identifiers and price multipliers
			upgrades.lu[String.fromCharCode(97+i)] = add[i];
			upgrades.priceMults[String.fromCharCode(97+i)] = addm[i];
		}
		upgrades.back = loadImg("./upgrades/back.png"); //load back

		for (let j = 0; j < 18; j++){ //load all unique upgrade faces
			let i = (j>9)?String.fromCharCode(87+j):j;
			upgrades.faces[upgrades.lu[i]] = loadImg(`./upgrades/${upgrades.lu[i]}.png`);
		}
	}
}

let time = 0; //time variable to track drunk effect
let drunkFactor = 0; //target level of drunk effect
let localDrunkFactor = 0; //current level of drunk effect
let sober = true; //flag to see if effect should be processed or not
async function drunk(){
	if (time > 8){ //loop time so it does consume endless memory
		time = 0;
	}

	//gradually change the drunk factor up or down
	if (localDrunkFactor+0.1 < drunkFactor && time%1 == 0){
		localDrunkFactor = drunkFactor;
	} else if (localDrunkFactor > drunkFactor + 0.1){
		localDrunkFactor -= 0.01;
	}
	localDrunkFactor = Math.min(localDrunkFactor, 7); //clamp drunk effect at 7

	if (localDrunkFactor > 0.1){ //remove sober and apply css animation if drunk
		sober = false;
		canv.style.animation = `drunk ${32 * (0.5**Math.round(Math.min(4, localDrunkFactor)))}s infinite`;
	} else if (localDrunkFactor < 0.1){ //apply sober and reset animation related properties if drunk factor drops below threshold
		localDrunkFactor = 0;
		time = 0;
		canv.style.animation = "";
		ctx.resetTransform();
		sober = true;
	}

	if (sober == false){ //JS powered drunk animation, uses sine and cos to have a wobbling shear, rotate, and translation
		time += 0.005;
		time = parseFloat(time.toFixed(5));
		let ct = 3 * localDrunkFactor * Math.sin(1.5*Math.PI * time * localDrunkFactor);
		let st = 3 * localDrunkFactor * Math.sin(2*Math.PI * time * localDrunkFactor);
		ctx.resetTransform();
		ctx.setTransform(1, 0.003*localDrunkFactor*st, 0.003*localDrunkFactor*ct,1,-0.003*localDrunkFactor*st,-0.003*localDrunkFactor*ct);
		ctx.translate(-300*0.005*ct*localDrunkFactor, -160*0.005*st*localDrunkFactor);
		ctx.translate(3*st,3*ct);
	}
}

async function soberTimer(){ //timer to reduce drunk effect
	await new Promise(r => setTimeout(r, 45000));
	drunkFactor -= 1;
}

setInterval(drunk, 25); //interval to process the drunk effect

// Game Scene
function lobbyScene(sock) {
	//key functions
	function resize() { //resizes the canvas image in the event that the window resizes
		sw = window.innerWidth - 1;
		sh = window.innerHeight - 1;
		factor = [16, 9];
		sw = sw / factor[0] < sh / factor[1] ? sw : (sh / factor[1]) * factor[0];
		sh = sw / factor[0] > sh / factor[1] ? sh : (sw / factor[0]) * factor[1];
		canv.style.width = sw.toString() + 'px'; //external width
		canv.style.height = sh.toString() + 'px'; //external height
	}

	//force call resize function
	resize();

	//key variables
	let drawQueue = []; //holds object to be drawn in order
	let currentInteractable = undefined; //current interactable in range of player
	let votes; //holds how much each table has been voted on
	let shop = false; //flag if the player is in the shop
	let vel = vec.n(0,0) //velocity to determine movement


	let interactFuncs = { //functions of interactables unique interactions aside from voting
		"sl" : () => {if (game.players.find(x => x.pName == playerName).money == 0){
				audio.clips.slotswin.play(); //play win on a successful use of slots
			} else {
				audio.clips.slots.play(); //play normal on unsuccessful
			} sock.send("a\x1Fsl"); //send request to server
		},
		"ba" : () => {if (localDrunkFactor >= drunkFactor) {drunkFactor += 1; audio.clips.bar.play(); soberTimer();}}, //increment drunk factor if the player is able to drink
		"sh" : () => {sock.send(`v\x1F0`);if (shop == false)audio.clips.shop.play(); shop = !shop;} //clear vote and open shop
	}

	function interactFunc(key){ //function that links keydown event and interact funcs
		if (key in interactFuncs) interactFuncs[key](); //run interact func if present
		else if (key in votes) { //if not in interactFuncs and the key is in votes, send vote request
			sock.send(`v\x1F${key}`); //send vote to server
			if (playerName in game.votes && game.votes[playerName] != currentInteractable.funcKey) audio.clips.sel.play(); //play sel sound if voting
			else audio.clips.desel.play(); //play deselect sound if player is removing vote
		}
	}

	//Key Manager
	let keys = {
		"w" : 0,
		"a" : 0,
		"s" : 0,
		"d" : 0,
		"shift" : 0,
		"funcs" : {
			//run interactFunc if e key is pressed
			"e":() => {if(currentInteractable != null) {
				interactFunc(currentInteractable.funcKey);
			}
			//close upgrade view panel if shop is closed
			if (shop == false && ugDisplay != undefined){
					ugDisplay.remove();
					ugDisplay = undefined;
			}}
		}
	}


	//Movement variables
	const baseSpeed = 4; // initial speed of players
	const sprintFact = 0.5; //percentage increase when sprinting

	let pixelLength = 0; //length of string in pixels, declared globally to save memory

	//main function of the lobby scene that is run every 25ms
	function mainloop(){
		//check if the server has closed, end scene and send to lobby if closed
		if (sock == null || sock.readyState == WebSocket.CLOSED){
			try{
				return;
			} finally {
				changeScene("selection", null);
			}
		}

		//check if current scene is lobby, if not, correct it
		if (game.currentScene != "lobby"){
			changeScene(game.currentScene, sock);
		}

		//if the shop is closed, run the lobby function, else run the shop function
		if (shop == false) lobbyFunc();
		else if (shop == true) shopFunc();
	}

	function lobbyFunc() {
		drawQueue = []; //clear draw queue
		//Update Velocity
		vel.x = baseSpeed * (keys.a ^ keys.d) * (keys.a ? -1 : 1) * (keys.shift * sprintFact + 1);
		vel.y = baseSpeed * (keys.w ^ keys.s) * (keys.w ? -1 : 1) * (keys.shift * sprintFact + 1);

		//check if player sprite needs to be flipped
		if (vel.x != 0) flip = 1 * (vel.x < 0);
		//Send amount to be moved and if the player should be flipped
		sock.send(`m\x1F${vel.x}\x1F${vel.y}\x1F${flip}`);

		//prepare draww order;
		drawQueue = drawQueue.concat(game.players); //add players to queue
		drawQueue = drawQueue.concat(game.interactables); //add interactables to queue
		//Clear And Draw
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		ctx.drawImage(background.imgs.lobby.floor,0,0,640,360); //draw floor
		for (let i=0; i < game.players.length; i++){ //draw shadows
			ctx.fillStyle = `rgba(10,10,10,0.5)`
			ctx.fillRect(game.players[i].col.origin.x - charScaleFact, game.players[i].col.origin.y + 13*charScaleFact, 10*charScaleFact, 3*charScaleFact)
		}
		ctx.drawImage(background.imgs.lobby.wall,0,0,640,360); //draw walls
		//draw lobby information on wall panels
		ctx.fillStyle = "white";
		ctx.font = "7px pixel";
		ctx.fillText("Money", 246-15, 32);
		ctx.fillText("Room Code", 394-26, 32);
		ctx.font = "14px pixel";
		let t = ctx.measureText(roomNo);
		ctx.fillText(roomNo, 394-0.5*t.width, 42+0.5*t.actualBoundingBoxAscent);
		let tx = `$${game.players.find(x => x.pName == playerName).money}`;
		if (tx.length > 5) ctx.font = "7px pixel";
		t = ctx.measureText(tx);
		ctx.fillText(tx, 246-0.5*t.width, 42+0.5*t.actualBoundingBoxAscent);

		//get interactable if any
		currentInteractable = undefined;
		game.interactables.sort((a,b) => {return a.col.y - b.col.y}); //sort interactables by height
		for (let i = 0; i < game.interactables.length; i++){ //for all interactables, if player and interactable colliders overlap, assign current interactable
			let over = overlap(game.players.find((x) => {return x.pName == playerName}).col, game.interactables[i].col);
			if (over == 1){
				currentInteractable = game.interactables[i];
			}
		}

		// draw sprites and players in order
		drawQueue.sort((a,b) => {
			let first = (a.className == "player")?a.col.origin.y + a.col.height:a.col.origin.y + a.col.height - a.renderOffset.y;
			if (a.short) first -= (a.col.height-(a.renderOffset.y*2) - (b.col.height*0.75));
			let second = (b.className == "player")?b.col.origin.y + b.col.height:b.col.origin.y + b.col.height - b.renderOffset.y;
			if (b.short) second -= (b.col.height-(b.renderOffset.y*2) - (a.col.height*0.75));
			return first - second;
		});


		for (let j = 0; j < drawQueue.length; j++){ //for all objects in the draw queue, draw their respective sprites
			const i = drawQueue[j];
			if (i.className == "player"){ //draw player skin
				if (i.flipped == true) ctx.drawImage(cows.fimgs[i.skin], 0, 1, 16, 15, i.col.origin.x-4*charScaleFact, i.col.origin.y, 16*charScaleFact, 15*charScaleFact);
				else ctx.drawImage(cows.imgs[i.skin], 0, 1, 16, 15, i.col.origin.x-4*charScaleFact, i.col.origin.y, 16*charScaleFact, 15*charScaleFact);
			} else if (i.className == "interactable"){ //draw interactable sprite
				if (sprites.imgs[i.spritename] != null) ctx.drawImage(sprites.imgs[i.spritename], i.col.origin.x + i.renderOffset.x, i.col.origin.y + i.renderOffset.y);
			}
		}

		for (let i = 0; i < game.players.length; i++){ //draw player names
			ctx.font = `7px pixel`;
			pixelLength = ctx.measureText(game.players[i].pName).width; //get pixelLength
			pixelLength += pixelLength%2;
			ctx.fillStyle = `rgba(0,${(game.players[i].pName == playerName)*200},0,0.5)`; //draw bubble
			ctx.fillRect(game.players[i].col.origin.x + (7 - 0.5*pixelLength), game.players[i].col.origin.y - 2, 2 + pixelLength, -10);
			ctx.fillStyle = `rgba(255,255,255,1)`; //draw name
			ctx.fillText(game.players[i].pName, game.players[i].col.origin.x + (9 - 0.5*pixelLength),game.players[i].col.origin.y - 4);
		}

		votes = { //clear votes object
			"bj" : 0,
			"rl" : 0,
			"pk" : 0,
			"ff" : 0
		};

		for (let i in game.votes){ //update votes object
			votes[game.votes[i]] += 1;
		}

		for (let i = 0; i < game.interactables.length; i++){ //for all interactables, draw votes
			let c = game.interactables[i]; //get interactable as shorthand
			if (votes[c.funcKey] > 0){ //check if any votes are for this interactable
				ctx.font = `28px pixel`; //draw bubble and votes / number of players
				let text = `${votes[c.funcKey]}/${Math.max(2,Object.keys(game.players).length)}`;
				pixelLength = Math.round(0.5*ctx.measureText(text).width);
				ctx.fillStyle = `rgba(0,0,0,0.5)`;
				ctx.fillRect(c.col.origin.x + (0.5*c.col.width) - pixelLength - 4, c.col.origin.y + c.renderOffset.y - 4, 2*pixelLength + 4, -33);
				ctx.fillStyle = `rgba(255,255,255,1)`;
				ctx.fillText(text, c.col.origin.x + (0.5*c.col.width) - pixelLength, c.col.origin.y + c.renderOffset.y-8);
			}
		}

		if (currentInteractable != undefined) {
			let c = currentInteractable; //get current interactable as shorthand
			ctx.font = `7px pixel`; //draw interactable text in bubble
			pixelLength = ctx.measureText(c.text).width;
			ctx.fillStyle = `rgba(0,0,0,0.8)`;
			ctx.fillRect(c.col.origin.x + Math.round((0.5*c.col.width) - 0.5*pixelLength) - 2, c.col.origin.y + c.renderOffset.y - 2, pixelLength + 4, 13);
			ctx.fillStyle = `white`;
			ctx.fillText(c.text, c.col.origin.x + Math.round((0.5*c.col.width) - 0.5*pixelLength), c.col.origin.y + c.renderOffset.y + 9);
		}
	}

	let currItem; //holds the current shop item
	let mPos = []; //holds pixel position of mouse relative to canvas
	let action = "looking"; //what the player is doing in the shop

	let ugSlots = [ //slots that hold the upgrades in the shop
			[[],[],[],[],[]],
			[[],[],[],[],[]]
		];
	let restockCount = 0; //number of restocks bought
	let restockPrice = 50; //price of a restock
	let basePrice = 50; //base price of an item
	function rollSlots(ind){ //function to refresh the upgrades either in the weapon or cow upgrades
		const lu = upgrades.lu; //shorthand for the loojup
		if (ind == undefined){
			for (let j = 0; j < ugSlots.length; j++){ //assign all slots to relevant random upgrade, 25% chance for special
				for (let i = 0; i < ugSlots[j].length; i++){
					let norm = 2*j + Math.ceil(Math.random() - 0.75);
					let ui = Math.floor(Math.random() * upgrades.all[norm].length);
					ugSlots[j][i] = upgrades.all[norm][ui];
				}
			}
		} else if (ind == 0) { //assign first five slots to relevant random upgrade, 25% chance for special
			for (let i = 0; i < ugSlots[0].length; i++){
				let norm = Math.ceil(Math.random() - 0.75);
				let ui = Math.floor(Math.random() * upgrades.all[norm].length);
				ugSlots[0][i] = upgrades.all[norm][ui];
			}
		} else if (ind == 1) { //assign last five slots to relevant random upgrade, 25% chance for special
			for (let i = 0; i < ugSlots[1].length; i++){
				let norm = 2 + Math.ceil(Math.random() - 0.75);
				let ui = Math.floor(Math.random() * upgrades.all[norm].length);
				ugSlots[1][i] = upgrades.all[norm][ui];
			}
		}
	}

	function purchase(item){ //function to purchas an upgrade from the shop
		console.log(item);
		let m = game.players.find(x => x.pName == playerName).money; //get money from player
		let mflag = 0; //flag to see if the item is too expepensive
		if (currItem.slice(-2) == "re"){ //check if the item is a restock
			if (m > restockPrice){ // if player has enough money, roll relevant slots and increase base and restock price
				sock.send("a\x1Fbuy\x1F" + restockPrice + "\x1F");
				if (currItem[0] == "w") rollSlots(0);
				else if (currItem[0] == "p") rollSlots(1);
				restockCount += 1;
				restockPrice = Math.round(basePrice * Math.pow(1.2, restockCount));
				basePrice = Math.round(basePrice*1.1);
				console.log(restockPrice);
			} else {
				mflag = 1;
			}
		} else if (m > Math.round(basePrice * upgrades.priceMults[ugSlots[currItem[0]][currItem[1]][0]])){ //if player can afford upgrade, buy upgrade and clear slot
			sock.send("a\x1Fbuy\x1F" + (basePrice * upgrades.priceMults[ugSlots[currItem[0]][currItem[1]][0]]) + "\x1F" + ugSlots[currItem[0]][currItem[1]][0] + ".");
			ugSlots[item[0]][item[1]] = "sold";
			currItem = undefined;
			action = "looking";
		} else {
			mflag = 1;
		}
		if (mflag == 0) audio.clips.shop.play();
		if (mflag == 1){ //if mflag is raised, alert player
			alert("Insufficient Money");
			pressedButton.pressed = 0;
		}
	}

	let ugDisplay = undefined; //holds div that contains list of player upgrades

	function displayUpgrades(){ //function to toggle display of player upgrades
		if (ugDisplay == undefined){ //if display div is not present
			let ugt = ((game.players.find(x => x.pName == playerName)||{}).upgrades||"").split("."); //grab upgrades
			let ft = "";
			ugDisplay = document.createElement("div"); //create and initialise div for display
			ugDisplay.id = "onScreenText";
			ugDisplay.style.height = canv.style.height;
			ugDisplay.style.fontFamily = "pixel";

			console.log(ugt);
			for (let i = 0; i < ugt.length-1; i++){ //for all upgrades, add upgrade name and upgrade effect to ft
				let id = ugt[i];
				if (id.charCodeAt(0) > 57) id = id.charCodeAt(0) - 87;
				let ug = [];
				if (id < 5) {
					ug = upgrades.all[0][id];
				} else if (id < 10) {
					ug = upgrades.all[1][id-5];
				} else if (id < 14) {
					ug = upgrades.all[2][id-10];
				} else if (id < 18){
					ug = upgrades.all[3][id-14];
				}
				console.log(id, ug);

				console.log(ug[1]);
				ft += ug[1] + "\n" + ug[3] + "\n\n";
			}

			ugDisplay.innerText = ft; //assign ft to be div inner text

			container.appendChild(ugDisplay); //add div to body
		} else { //if div is already present, remove it from the document and clear ugDisplay variable
			ugDisplay.remove();
			ugDisplay = undefined;
		}
	}

	rollSlots(); //initialise shop slots

	let itemFunc = (a, b) => {  //function to assign current item and relevant turn options when item button is clicked
		currItem = [a,b];
		if (ugSlots[a][b] != "sold") action = "buying";
		else action = "looking";
	}
	let sactions = { //contains all possible buttons for the shop
		"looking" : [
			new button("", "", col.rect(vec.n(321,40 ), 89, 60), `rgba(0,0,0,0)`, `rgba(255,255,255,0.05)`, () => {itemFunc(0,0)}),
			new button("", "", col.rect(vec.n(410,40 ), 89, 60), `rgba(0,0,0,0)`, `rgba(255,255,255,0.05)`, () => {itemFunc(0,1)}),
			new button("", "", col.rect(vec.n(499,40 ), 89, 60), `rgba(0,0,0,0)`, `rgba(255,255,255,0.05)`, () => {itemFunc(0,2)}),
			new button("", "", col.rect(vec.n(321,100), 89, 60), `rgba(0,0,0,0)`, `rgba(255,255,255,0.05)`, () => {itemFunc(0,3)}),
			new button("", "", col.rect(vec.n(410,100), 89, 60), `rgba(0,0,0,0)`, `rgba(255,255,255,0.05)`, () => {itemFunc(0,4)}),
			new button("", "", col.rect(vec.n(499,100), 89, 60), `rgba(0,0,0,0)`, `rgba(255,255,255,0.05)`, () => {currItem = "wre"; action = "buying";}),

			new button("", "", col.rect(vec.n(321,160), 89, 60), `rgba(0,0,0,0)`, `rgba(255,255,255,0.05)`, () => {itemFunc(1,0)}),
			new button("", "", col.rect(vec.n(410,160), 89, 60), `rgba(0,0,0,0)`, `rgba(255,255,255,0.05)`, () => {itemFunc(1,1)}),
			new button("", "", col.rect(vec.n(499,160), 89, 60), `rgba(0,0,0,0)`, `rgba(255,255,255,0.05)`, () => {itemFunc(1,2)}),
			new button("", "", col.rect(vec.n(321,220), 89, 60), `rgba(0,0,0,0)`, `rgba(255,255,255,0.05)`, () => {itemFunc(1,3)}),
			new button("", "", col.rect(vec.n(410,220), 89, 60), `rgba(0,0,0,0)`, `rgba(255,255,255,0.05)`, () => {itemFunc(1,4)}),
			new button("", "", col.rect(vec.n(499,220), 89, 60), `rgba(0,0,0,0)`, `rgba(255,255,255,0.05)`, () => {currItem = "pre"; action = "buying";}),

			new button("View Upgrades", "black", col.rect(vec.n(47,32), 100,40), `rgba(205,205,205,1)`, "white", displayUpgrades)
		],
		"buying" : [
			new button("BUY", "black", col.rect(vec.n(390, 285), 129,37), `rgba(175,235,175,1)`, `rgba(255,255,255,1)`, () => {purchase(currItem);}),
		]
	}
	sactions.buying.push(...sactions.looking); //add looking buttons to buying buttons
	let sbuttons = []; //holds the current buttons for the actions

	function shopFunc(){ //main function of shop scene
		sock.send("r"); //request game state

		//clear canvas and draw background
		ctx.clearRect(0,0,640,360);
		ctx.drawImage(background.imgs.shop, 0, 0);

		//draw player's money
		ctx.fillStyle = "lightgrey";
		ctx.font = "7px pixel";
		ctx.fillText("Balance:", 56, 295);
		ctx.fillStyle = "white";
		ctx.font = "21px pixel";
		let m = (game.players.find(x => x.pName == playerName)??{}).money||0;
		ctx.fillText("$" + m, 56, 320);

		//draw hint text for how to leave the shop
		ctx.fillStyle = "rgba(0,0,0,0.5)";
		ctx.fillRect(248, 8, 144, 16);
		ctx.font = "7px pixel";
		ctx.fillStyle = "white";
		ctx.fillText("Press 'E' to exit shop", 254, 21);

		//draw all upgrades from the shop slots
		for (let j = 0; j < 2; j++){
			for (let i = 0; i < 5; i++){
				if (ugSlots[j][i] != "sold"){
					let vOff = -2 * (mPos[0] == i%3 && (mPos[1] == (1*(i>2) + 2*j)));
					ctx.drawImage(upgrades.back, 321 + 89*(i%3) + 29, 40 + 60*(1*(i>2) + 2*j) + 8 + vOff);
					ctx.drawImage(upgrades.faces[upgrades.lu[ugSlots[j][i][0]]],321 + 89*(i%3) + 29, 40 + 60*(1*(i>2) + 2*j) + 8 + vOff);
				}
			}
		}

		//update buttons to match current action
		if (`${sbuttons}` != sactions[action]){
			sbuttons = sactions[action];
		}

		//adjust buy button text based of current item
		if (action == "buying" && currItem != "re" && currItem.slice(-2) == "re"){
			sactions.buying[0].text = "BUY $" + restockPrice;
		} else if (action == "buying" && ugSlots[currItem[0]][currItem[1]] != "sold") {
			sactions.buying[0].text = "BUY $" + Math.round(basePrice * upgrades.priceMults[ugSlots[currItem[0]][currItem[1]][0]]);
		} else {
			sactions.buying[0].text = "BUY";
		}

		//draw text spoken by shop keeper
		//either item description or generic message
		ctx.font = "7px pixel";
		if (currItem == undefined){
			ctx.fillText("My own creations...", 64, 192+9);
			ctx.fillText("Please, take a look.", 64, 192+18);
		} else if (currItem == "wre") {
			ctx.fillText("That is [ Weapon Restock ]", 64, 192+9);
			ctx.fillText("It'll give you a fresh look", 64, 192 + 18);
			ctx.fillText("Restocks weapon related upgrades", 64, 192 + 27);
		} else if (currItem == "pre") {
			ctx.fillText("That is [ Cow Restock ]", 64, 192+9);
			ctx.fillText("It'll give you a fresh look", 64, 192 + 18);
			ctx.fillText("Restocks cow related upgrades", 64, 192 + 27);
		} else {
			let cu = ugSlots[currItem[0]][currItem[1]]
			if (cu != "sold"){
				ctx.fillText("That is [ " + cu[1] + " ]", 64, 192+9);
				ctx.fillText(cu[2], 64, 192 + 18);
				ctx.fillText(cu[3], 64, 192 + 27);
			} else {
				ctx.fillText("My own creations...", 64, 192+9);
				ctx.fillText("Please, take a look.", 64, 192+18);
			}
		}

		//draw all buttons from sbuttons array
		for (let j = 0; j < sbuttons.length; j++){
			let i = sbuttons[j];
			let oW = 0;
			let oX = 0;
			if (i.text.slice(0,3) == "BUY"){ //adjust width of button if text is too large
				ctx.font = `14px pixel`;
				pixelLength = ctx.measureText(i.text).width;
				pixelLength += pixelLength%2;
				if (pixelLength > i.col.width - 16){
					oX = 0.5*(oW = pixelLength - i.col.width + 16);
				}
			}
			if (i.pressed == 1){
				ctx.fillStyle = i.colourPressed;
			} else {
				ctx.fillStyle = i.colour;
			}
			ctx.fillRect(i.col.origin.x-oX, i.col.origin.y, i.col.width+oW, i.col.height);
			if (i.text != ""){ //if button has text, draw text
				if (i.text.slice != "BUY") ctx.font = "7px pixel";
				ctx.fillStyle = i.textCol;
				pixelLength = ctx.measureText(i.text).width;
				pixelLength += pixelLength%2;
				ctx.fillText(i.text, i.col.origin.x + Math.round(0.5*i.col.width - 0.5*pixelLength), i.col.origin.y + 0.5*i.col.height + 4);
			}
		}
	}

	let pressedButton = 0; //holds pressed button
	let mouse = { //organises functions for all mouse inputs
		0 : {
			"u" : (e) => {
				if (pressedButton != undefined){
					pressedButton.pressed = 0;
					pressedButton = undefined;
				}
			},
			"d" : (e) => {
				if (shop == true){
					let canvR = canv.getBoundingClientRect();
					let x = (e.clientX - canvR.left) / canv.style.width.slice(0,-2) * 640 - 1;
					let y = (e.clientY - canvR.top) / canv.style.height.slice(0,-2) * 360 - 1;
					pressedButton = undefined
					for (let j = 0; j < sbuttons.length; j++){
						let i = sbuttons[j];
						let distX = x - i.col.origin.x;
						let distY = y - i.col.origin.y;
						if (distX >= 0 && distX <= i.col.width && distY >=0 && distY <= i.col.height){
							pressedButton = i;
						}
					}
					if (pressedButton != undefined){
						if (pressedButton.text.slice(0,3) == "BUY") audio.clips.sel.play();
						else audio.clips.desel.play();
						pressedButton.pressed = 1; pressedButton.func();
					}
				}
			}
		}
	}

	function keydown(e) { //processes information from keydown event
		//Collect Keydowns
		if (e.code === 'KeyW') keys.w = 1;
		if (e.code === 'KeyA') keys.a = 1;
		if (e.code === 'KeyS') keys.s = 1;
		if (e.code === 'KeyD') keys.d = 1;
		if (e.code === 'ShiftLeft' || e.code === 'ControlLeft') keys.shift = 1;

		if (e.code === 'KeyE') keys.funcs.e();
	}
	function keyup(e) { //processes information from keyup event
		//Collect Keyups
		if (e.code === 'KeyW') keys.w = 0;
		if (e.code === 'KeyA') keys.a = 0;
		if (e.code === 'KeyS') keys.s = 0;
		if (e.code === 'KeyD') keys.d = 0;
		if (e.code === 'ShiftLeft' || e.code === 'ControlLeft') keys.shift = 0;
	}

	function mousedown(e) { //processes information from mousedown event
		if (e.button in mouse) mouse[e.button].d(e);
		if (ugDisplay != undefined && shop == true && (pressedButton??{}).text != "View Upgrades"){
			ugDisplay.remove(); //clear upgrade display on a mouse press
			ugDisplay = undefined;
		}
	}
	function mouseup(e) { //processes information from mouse up event
		if (e.button in mouse) mouse[e.button].u(e);
	}
	function mousemove(e){ //processes information from mousemove event
		if (shop == true){ //if in shop, get the mouse position and update mPos
			let canvR = canv.getBoundingClientRect();
			let x = (e.clientX - canvR.left) / canv.style.width.slice(0,-2) * 640 - 1;
			let y = (e.clientY - canvR.top) / canv.style.height.slice(0,-2) * 360 - 1;
			x = -(x -= 321) % 89 + x;
			y = -(y -= 40) % 60 + y;
			x = x/89;
			y = y/60;
			mPos = [x,y];
		}
	}

	//Assign Listeners and intervals
	window.addEventListener('keydown', keydown);
	window.addEventListener('keyup', keyup);
	window.addEventListener('resize', resize);
	window.addEventListener('mousedown', mousedown);
	window.addEventListener('mouseup', mouseup);
	window.addEventListener('mousemove', mousemove);
	let mlId = setInterval(mainloop, 25);

	function unloadLocal() { //unload function to be run by the changeScene function
		if (ugDisplay != undefined) { //remove upgrade display
			ugDisplay.remove();
			ugDisplay = undefined;
		}
		storage.appendChild(canv); //store canvas
		audio.clips.jazz.pause(); //pause music
		window.removeEventListener('keydown', keydown); //unassign all event listeners
		window.removeEventListener('keyup', keyup);
		window.removeEventListener('mousedown', mousedown);
		window.removeEventListener('mouseup', mouseup);
		window.removeEventListener('mousemove', mousemove);
		clearInterval(mlId); //clear interval
	}
	audio.clips.jazz.play(); //start music
	return unloadLocal; //return unload function so changeScene can access it
}
scene.lobby = lobbyScene; //add lobby scene to scene object

function selectionScene(sock){ //function that contains selection scene
	audio.clips.jazz.currentTime = 0; //reset playtime of jazz
	//get html elements from form
	let ip = document.getElementById("ip");
	let sel = document.getElementById("skin");
	let img = document.getElementById("char");
	sel.onchange = () => {img.src = cows.strings[sel.value]} //change displayed skin whenever selected skin changes
	function update(){ //clamp round counter between 1 and 50
		let rCo = container.children[0].children[10].value;
		if (rCo[0] == "-") container.children[0].children[10].value = rCo.slice(1);
		if (rCo[0] == 0) container.children[0].children[10].value = 1;
		if (rCo > 50) container.children[0].children[10].value = 50;
	}
	let uId; //holds id for interval that updates round counter
	function unloadLocal(){
		clearInterval(uId);
		storage.appendChild(container.children[0]);
	}
	function chooseAddr(priv){ //use ws or wss depending on input
		if (priv === 1){
			return ip.value.length>0?("wss://"+ip.value):"wss://localhost:8000";
		} else {
			return ip.value.length>0?("ws://"+ip.value):"ws://localhost:8000";
		}
	}

	function servMsg(message){ //response to a server message
		let resp = message.data.split("\x1F"); //split message into arguments using delimiting character

		switch (resp[0]){
			case 'r': //if refresh, update game state.
				temp = JSON.parse(resp[1]);
				temp.players.forEach((x) => {x.col.origin.x = parseInt(x.col.origin.x); x.col.origin.y = parseInt(x.col.origin.y)});
				game = temp;
				break;
			case 'a': //if action, and its roulette, spin the roulette wheel
				if (resp[1] == "rl"){
					console.log(resp);
					if (parseInt(resp[2])+1){ //check if the 3rd argument is a positive number
						(async () => {
							//create div and img elements to hold roulette wheel
							//structure is div => {img, img}
							console.log("start spin");
							let wheelCont = document.createElement("div");
							wheelCont.id = "wheelCont";
							let wheel = document.createElement("img");
							wheel.src = "./sprites/wheel.png";
							let ball = document.createElement("img");
							ball.src = "./sprites/ball.png";
							wheel.className = ball.className = "wheelImg"; // \/ assign transform to match canvas
							ball.style.height = ball.style.width = wheel.style.width = wheel.style.height = canv.style.height;
							ball.style.transform = wheel.style.transform = wheelCont.style.transform = "rotate(0deg)";

							container.appendChild(wheelCont);
							wheelCont.appendChild(wheel);
							wheelCont.appendChild(ball);

							await new Promise(resolve => setTimeout(resolve, 1000)); //wait a second before spinning
							wheelCont.style.transition = ball.style.transition = "ease 10s" // match all transition styles


							let finalAngle = 3600 + 360*Math.random(); //set target angle
							wheelCont.style.transform = `rotate(-${finalAngle}deg)`; //rotate wheel container to rotate wheel and ball
							ball.style.transform = `rotate(${finalAngle}deg)`; //rotate ball in converse direction so it appears stationary

							await new Promise(resolve => setTimeout(resolve, 1000)); //wait a second before "launching" ball
							ball.style.transition = "ease-in-out 5s"; //change transition properties
							ball.style.transform = `rotate(${7200 + (360 * parseInt(resp[2])/37)}deg)`; //rotate ball to final wheel index relative to roulette wheel
						})();
						let chId = setInterval(() => { //if the roulette wheel should close, remove from document and clear this interval
							if (game.turnOptions != "spinning" || game.currentScene != "roulette" || sock == null || sock.readyState == WebSocket.CLOSED){
								wheelCont.remove();
								clearInterval(chId);
							}
						}, 100);
						break;
					}
				break;
			}
		}
	}

	function hostRoom(){ //function to be run when the host button is pressed
		let nam = container.children[0].children[6].value; //get Name field
		let rId = container.children[0].children[8].value; //get room code field
		let rCo = container.children[0].children[10].value || 10; //get round counter field
		let skn = container.children[0].children[12].value; //get skin select dropdown
		//client side validation
		if (nam.length = 0) {alert("Input Name"); return 0;}
		if (nam.includes("\x1F")) {alert("Forbidden character '\x1F' in name"); return 0;}
		if (rId.length != 4) {alert("Room ID needs 4 characters"); return 0;}
		if (skn == 8) {alert("Select Skin"); return 0;}
		try { //try make connection using ws
			sock = new WebSocket(chooseAddr(0));
		} catch { //if fails, try to make a connection with wss
			sock = new WebSocket(choosAddr(1))
		}
		sock.onopen = () => {sock.send(`h\x1F${nam}\x1F${rId}\x1F${skn}\x1F${rCo}`);}; //send a host message to server when connection is established
		sock.onmessage = (message) => {if (message.data.toString() == -1){alert("Room Not Available");sock.close();return 0;} //get return information and server validation
		else { //if room is created
			game=JSON.parse(message.data.split("\x1F")[1]); //update game state
			playerName = nam; //assign local player name
			roomNo = rId; //assign local room code
			sock.onmessage = servMsg; //set onmessage to be the servMsg
			changeScene("lobby", sock); //change scene to lobby
		}};
	}
	function joinRoom(){ //function to be run when the join button is pressed
		let nam = container.children[0].children[6].value; //get name field
		let rId = container.children[0].children[8].value; //get room field
		let skn = container.children[0].children[12].value; //get skin dropdown
		//client side validation
		if (nam.length == 0) {alert("Input Name"); return 0;}
		if (nam.includes("\x1F")) {alert("Forbidden character '\x1F' in name"); return 0;}
		if (rId.length != 4) {alert("Room ID needs 4 characters"); return 0;}
		if (skn == 8) {alert("Select Skin"); return 0;}
		if (chooseAddr == "ws://"){alert("Input IP address"); return;}
		try { //try connect with ws
			sock = new WebSocket(chooseAddr(0));
		} catch { //else try connect with wss
			sock = new WebSocket(choosAddr(1))
		}
		sock.onopen = () => {sock.send(`j\x1F${nam}\x1F${rId}\x1F${skn}`);}; //send a join message when the connection is established
		sock.onmessage = (message) => {if (message.data == -1){alert("Room Not Found");sock.close();return 0;} //read server side validation
			else if (message.data == -2){alert("Another User Has This Name");sock.close();return 0;}		   //alert the user to appropriate response
			else if (message.data == -3){alert("This Room Is Full");sock.close();return 0;} else {
			game=JSON.parse(message.data.split("\x1F")[1]); //if successful update game state
			playerName = nam; //assign local player name
			roomNo = rId; //assign local room code
			sock.onmessage = servMsg; //set on message to servMsg
			changeScene("lobby", sock); //change scene to lobby
		};}
	}
	uId = setInterval(update, 100); //set interval to update the contents of roomCode
	container.appendChild(document.getElementById("selectionScene")); //add the selection scene HTML to the container div
	document.getElementById("host").onclick = hostRoom; //assign click functions for the buttons
	document.getElementById("join").onclick = joinRoom;
	img.src = cows.strings[sel.value]; //update img source

	return unloadLocal;
}
scene.selection = selectionScene; //add selection scene to scenes object
unload = selectionScene(); //set global unload function

function blackjackScene(sock){ //function that contains blackjack scene
	let betAmount = 0; //holds bet amount before being sent to server
	let buttons = {}; //holds current buttons
	let rounds = { //holds all buttons for all possible turn options
		"bet" : {
			"p1" : new button("+1", "black", col.rect(vec.n(36,36), 46, 14), `rgba(185,245,185,1)`, `rgba(255,255,255,1)`, () => {
				betAmount += 1;
				let mon = game.players.find((x) => (x.pName == playerName)).money;
				if (betAmount > mon) betAmount = mon;
			}),
			"s1" : new button("-1", "black", col.rect(vec.n(86,36), 46, 14), `rgba(235,175,175,1)`, `rgba(255,255,255,1)`, () => {betAmount -= 1; if (betAmount < 0) betAmount = 0;}),
			"p10" : new button("+10", "black", col.rect(vec.n(36,54), 46, 14), `rgba(175,235,175,1)`, `rgba(255,255,255,1)`, () => {
				betAmount += 10;
				let mon = game.players.find((x) => (x.pName == playerName)).money;
				if (betAmount > mon) betAmount = mon;
			}),
			"s10" : new button("-10", "black", col.rect(vec.n(86,54), 46, 14), `rgba(245,185,185,1)`, `rgba(255,255,255,1)`, () => {betAmount -= 10; if (betAmount < 0) betAmount = 0;}),
			"p100" : new button("+100", "black", col.rect(vec.n(36,72), 46, 14), `rgba(185,245,185,1)`, `rgba(255,255,255,1)`, () => {
				betAmount += 100;
				let mon = game.players.find((x) => (x.pName == playerName)).money;
				if (betAmount > mon) betAmount = mon;
			}),
			"s100" : new button("-100", "black", col.rect(vec.n(86,72), 46, 14), `rgba(235,175,175,1)`, `rgba(255,255,255,1)`, () => {betAmount -= 100; if (betAmount < 0) betAmount = 0;}),
			"m2" : new button("\xD72", "black", col.rect(vec.n(36,90), 46, 14), `rgba(175,235,175,1)`, `rgba(255,255,255,1)`, () => {
				betAmount *= 2;
				let mon = game.players.find((x) => (x.pName == playerName)).money;
				if (betAmount > mon) betAmount = mon;
			}),
			"d2" : new button("\xF72", "black", col.rect(vec.n(86,90), 46, 14), `rgba(245,185,185,1)`, `rgba(255,255,255,1)`, () => {betAmount = Math.round(betAmount/2);if (betAmount < 0) betAmount = 0;}),
			"m10" : new button("\xD710", "black", col.rect(vec.n(36,108), 46, 14), `rgba(185,245,185,1)`, `rgba(255,255,255,1)`, () => {
				betAmount *= 10;
				let mon = game.players.find((x) => (x.pName == playerName)).money;
				if (betAmount > mon) betAmount = mon;
			}),
			"d10" : new button("\xF710", "black", col.rect(vec.n(86,108), 46, 14), `rgba(235,175,175,1)`, `rgba(255,255,255,1)`, () => {betAmount = Math.round(betAmount/10);if (betAmount < 0) betAmount = 0;}),
			"submit" : new button("BET", "black", col.rect(vec.n(508,36), 96, 86), `rgba(235,235,235,1)`, `rgba(255,255,255,1)`, ()=>{
				sock.send(`a\x1F${Math.min(betAmount, game.players.find((x) => (x.pName == playerName)).money)}`);
			})
		},
		"turn" : {
			"hit" : new button("HIT", "black", col.rect(vec.n(36,36), 96, 83), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1Fh`);}),
			"stand" : new button("STAND", "black", col.rect(vec.n(508,36), 96, 83), `rgba(245,175,175,1)`, `white`, () => {sock.send(`a\x1Fs`);})
		},
		"turnsplit" : {
			"hit" : new button("HIT", "black", col.rect(vec.n(36,36), 96, 38), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1Fh`);}),
			"stand" : new button("STAND", "black", col.rect(vec.n(508,36), 96, 83), `rgba(245,175,175,1)`, `white`, () => {sock.send(`a\x1Fs`);}),
			"split" : new button("SPLIT", "black", col.rect(vec.n(36,81), 96, 38), `rgba(170,240,170,1)`, `white`, () => {sock.send(`a\x1Fp`);})
		},
		"turndouble" : {
			"hit" : new button("HIT", "black", col.rect(vec.n(36,36), 96, 38), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1Fh`);}),
			"stand" : new button("STAND", "black", col.rect(vec.n(508,36), 96, 83), `rgba(245,175,175,1)`, `white`, () => {sock.send(`a\x1Fs`);}),
			"double" : new button("DOUBLE", "black", col.rect(vec.n(36,81), 96, 38), `rgba(170,240,170,1)`, `white`, () => {sock.send(`a\x1Fd`);})
		},
		"turndoublesplit" : {
			"hit" : new button("HIT", "black", col.rect(vec.n(36,36), 96, 25), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1Fh`);}),
			"stand" : new button("STAND", "black", col.rect(vec.n(508,36), 96, 83), `rgba(245,175,175,1)`, `white`, () => {sock.send(`a\x1Fs`);}),
			"double" : new button("DOUBLE", "black", col.rect(vec.n(36,65), 96, 25), `rgba(170,240,170,1)`, `white`, () => {sock.send(`a\x1Fd`);}),
			"split" : new button("SPLIT", "black", col.rect(vec.n(36,94), 96, 25), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1Fp`);})
		}
	}

	let pixelLength = 0; //pixel length of string, declared here to reduce memory usage

	const maxHands = [16, 8, 6, 4]; //maximum number of hands allowed before downscaling sprites
									//index correlates to number of players
	function mainloop(){ //main function that is run repeatedly for blackjack
		pixelLength = 0; //clear pixelLength
		if (sock == null || sock.readyState == WebSocket.CLOSED){ //if connection is closed, set scene to selection
			try{
				return;
			} finally {
				changeScene("selection", null);
			}
		}

		sock.send(`r`); //request game state

		if (game.currentScene != "blackjack"){ //if the current scene isnt blackjack, correct it
			changeScene(game.currentScene, sock);
		}

		//calculate the pixel offset of each player when they are drawn
		//each player is equally spaced throughout the felt of the roulette table (32<x<628)
		let pOffset = 576 / game.players.length;
		//clear canvas and draw background
		ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
		ctx.drawImage(background.imgs.blackjack, 0, 0);

		//draw remaining rounds at top of screen
		ctx.font = "21px pixel";
		let text = `Round ${game.remRounds} of ${game.maxRounds}`;
		let l = ctx.measureText(text).width;
		l = Math.round(0.5*l);
		ctx.fillStyle = "rgba(22,22,29, 0.9)";
		ctx.fillRect(318 - l,4, 2*l + 4, 28);
		ctx.fillStyle = "white";
		ctx.fillText(text, 320 - l, 28);

		//draw all players and relevant information in turn
		for (let i = 0; i < game.players.length; i++){
			let p = game.players[i]; //shortand for player
			let curOff = 32 + (pOffset * 0.5) + (pOffset*i); //calculate draw offset of specific player
			//draw spotlight on player
			ctx.fillStyle = `rgba(255,230,120,0.5)`;
			ctx.beginPath();
			ctx.arc(curOff,312, 32,5*Math.PI/6 , Math.PI/6);
			ctx.fill();
			ctx.drawImage(cows.imgs[p.skin], 0, 1, 16, 15, curOff - 16, 298, 32,30); //draw player skin

			//draw player name and money
			text = p.pName + "--$" + p.money.toString();
			ctx.font = `7px pixel`;
			pixelLength = ctx.measureText(text).width;
			pixelLength += pixelLength%2;
			ctx.fillStyle = `rgba(0,${255*(p.pName == playerName)},0,0.5)`;
			ctx.fillRect(curOff - (0.5*pixelLength) - 2, 331, 2 + pixelLength, 10);
			ctx.fillStyle = 'white';
			ctx.fillText(text, curOff - (0.5*pixelLength), 340);
			if (p.bet != 0){ //if player has bet, draw bet above the players head
				pixelLength = ctx.measureText(`$${p.bet}`).width;
				pixelLength += pixelLength%2;
				ctx.fillText(`$${p.bet}`, curOff - 0.5*pixelLength, 296);
			}

			let scale = 2; //set scale to be 2 by default, if player hands exceed limit, or player hand exceeds card length, half scale
			if (game.players[i].cards.length > maxHands[game.players.length-1]) scale = 1;
			else {
				for (let k = 0; k < game.players[i].cards.length; k++){
					if (game.players[i].cards[k].length > 6) scale = 1;
				}
			}
			let tempCards = game.players[i].cards; //shorhand for the player's cards
			for (let k = 0; k < tempCards.length; k++){
				let hOff = Math.round(curOff - (0.5*tempCards.length * 16 * scale) + k*17*scale); //calculate draw offset of hand of player
				if (game.currentPlayer == game.players[i].pName && game.players[i].currentHand == k){
					ctx.fillStyle = "rgba(0,255,0,1)"; //if this hand is the current hand of the current player, draw a green indicating arrow
					ctx.beginPath();
					ctx.moveTo(hOff + 0.5*16*scale-8, 146.5);
					ctx.lineTo(hOff + 0.5*16*scale, 154.5);
					ctx.lineTo(hOff + 0.5*16*scale+8, 146.5);
					ctx.fill();
				}

				let sum = 0; //initialise summing variables
				let aces = 0;
				//for all cards in this hand, draw the cards and calculate the sum value of the hand
				for (let j = 0; j < tempCards[k].length; j++){
					let vOff = Math.round(152 + ((j+1) * 100/(tempCards[k].length+1)));
					if (tempCards[k][j].className != "card") ctx.drawImage(cards.bg, hOff + 0.5, vOff + 0.5, 15*scale, 21*scale);
					else if (tempCards[k][j].faceDown === 1) ctx.drawImage(cards.back, hOff + 0.5, vOff + 0.5, 15*scale, 21*scale);
					else {
						if (tempCards[k][j].value == 12) aces += 1;
						else sum += Math.min(10, tempCards[k][j].value + 2);
						ctx.drawImage(cards.bg, hOff + 0.5, vOff+0.5, 15*scale, 21*scale);
						ctx.drawImage(cards.suits[tempCards[k][j].suit], hOff, vOff, 15*scale, 21*scale);
						ctx.drawImage(tempCards[k][j].suit>1?cards.rNo[tempCards[k][j].value]:cards.bNo[tempCards[k][j].value], hOff, vOff, 15*scale, 21*scale);
					}
				}
				for (let l = 0; l < aces; l++){
					if (sum + 11 < 22) sum += 11;
					else sum += 1;
				}
				if (sum > 0) { //draw sum above the hand
					ctx.font = scale==2?"14px pixel":"7px pixel";
					ctx.fillStyle = "white";
					pixelLength = 0.5*ctx.measureText(sum).width;
					ctx.fillText(sum, Math.round(hOff+0.5*17*scale - pixelLength), 136);
				}
			}
		}

		//initialise sum variables for the dealer's hand
		let dSum = 0;
		let dAce = 0;
		for (let i = 0; i < game.dealer.cards.length; i++){
			let hOff = 320 - 0.5*(18 + 12*game.dealer.cards.length) + (12*i); //calculate draw offset for the specific card
			if (game.dealer.cards[i].faceDown == 1) ctx.drawImage(cards.back, hOff + 0.5, 64.5, 30, 42); //draw card back if face down
			else { //draw card and add sum variables
				if (game.dealer.cards[i].value == 12) dAce += 1;
				else dSum += Math.min(10, game.dealer.cards[i].value+2);
				ctx.drawImage(cards.bg, hOff+0.5, 64.5, 30, 42);
				ctx.drawImage(cards.suits[game.dealer.cards[i].suit], hOff, 64, 30, 42);
				ctx.drawImage(game.dealer.cards[i].suit>1?cards.rNo[game.dealer.cards[i].value]:cards.bNo[game.dealer.cards[i].value], hOff, 64, 30,42);
			}

		}

		if (game.dealer.cards.length > 0) { //if the dealer has cards, process the hand value
			for (let i = 0; i < dAce; i++){
				if (dSum + 11 < 22) dSum += 10; //add aces high or low as appropriate
				dSum += 1;
			}

			ctx.font = `14px`; //draw sum value of the dealers hand
			ctx.fillStyle = "white";
			pixelLength = Math.round(0.5*ctx.measureText(dSum).width);
			ctx.fillText(dSum, 320 - pixelLength, 56);
		}

		if (game.turnOptions == "bjbet" && game.currentPlayer == playerName){ //if the player is able to bet, display bet amount
			let betText = "$" + betAmount.toString();
			ctx.font = `21px pixel`;
			pixelLength = ctx.measureText(betText).width;
			pixelLength += pixelLength%2;
			ctx.fillStyle = 'white';
			ctx.fillText(betText, 320 - (0.5*pixelLength), 92);
		}

		if (game.currentPlayer == playerName){ //update buttons according to turn options
			if (game.turnOptions.slice(0,2) == "bj"){
				if (game.turnOptions == "bjbet"){
					if (buttons !== rounds.bet) buttons = rounds.bet;
				} else if (game.turnOptions.slice(0,6) == "bjturn") {
					if (game.turnOptions.slice(6) == "double" && buttons !== rounds.turndouble) buttons = rounds.turndouble;
					else if (game.turnOptions.slice(6) == "split" && buttons !== rounds.turnsplit) buttons = rounds.turnsplit;
					else if (game.turnOptions.slice(6) == "doublesplit" && buttons !== rounds.turndoublesplit) buttons = rounds.turndoublesplit;
					else if (game.turnOptions == "bjturn" && buttons !== rounds.turn) buttons = rounds.turn;
				}
			} else {
				buttons = {}; //clear buttons if not the current player's turn
			}
			for (let j in buttons){ //draw buttons
				let i = buttons[j];
				if (i.pressed === 1){ //check if button is pressed or not
					ctx.fillStyle = i.colourPressed;
					} else {
					ctx.fillStyle = i.colour;
				}
				ctx.fillRect(i.col.origin.x, i.col.origin.y, i.col.width, i.col.height);
				ctx.font = `7px pixel`; //draw button text
				ctx.fillStyle = i.textCol;
				pixelLength = ctx.measureText(i.text).width;
				pixelLength += pixelLength%2;
				ctx.fillText(i.text, i.col.origin.x + Math.round(0.5*i.col.width - 0.5*pixelLength), i.col.origin.y + 0.5*i.col.height + 4);
			}
		}
	}

	let cardsPrev = 0;
	function soundloop(){ //play a sound if a card has been dealt
		let temp = 0; //holds number of cards
		for (let i = 0; i < game.players.length; i++){ //tally cards
			for (let j = 0; j < game.players[i].cards.length; j++){
				temp += game.players[i].cards[j].length;
			}
		} temp += game.dealer.cards.length;

		if (temp > cardsPrev) audio.clips.card.play(); //if cards have been dealt, play a sound clip
		cardsPrev = temp;
	}

	let pressedButton; //holds the pressed button
	let mouse = { //organises function for the mouse events
		0 : {
			"d": (e) => { //get mouse position and find button that is pressed if any.
				let canvR = canv.getBoundingClientRect();
				let x = (e.clientX - canvR.left) / canv.style.width.slice(0,-2) * 640 - 1;
				let y = (e.clientY - canvR.top) / canv.style.height.slice(0,-2) * 360 - 1;
				pressedButton = undefined;
				if (game.currentPlayer == playerName) {
					for (let j in buttons){
						let i = buttons[j];
						let distX = x - i.col.origin.x;
						let distY = y - i.col.origin.y;
						if (distX >= 0 && distX <= i.col.width && distY >=0 && distY <= i.col.height){
							pressedButton = i;
					}} if (pressedButton != undefined){ //if button is pressed, run its function
						pressedButton.pressed = 1; pressedButton.func();
					}
				}},
			"u" : (e) => { //if a button is pressed, release the button
				if (pressedButton != undefined){
					pressedButton.pressed = 0;
				}
			}
		}
	}

	function mousedown(e){ //processes mousedown event
		if (e.button in mouse) mouse[e.button].d(e);
	}
	function mouseup(e){ //processes mouseup event
		if (e.button in mouse) mouse[e.button].u(e);
	}

	//assign event listeners and intervals
	window.addEventListener('mouseup', mouseup);
	window.addEventListener('mousedown', mousedown);
	let mlId = setInterval(mainloop, 25);
	let slId = setInterval(soundloop, 25);

	//define local unload function
	function unloadLocal(){
		audio.clips.jazz.pause(); //stop music
		storage.appendChild(canv); //store canvas
		window.removeEventListener('mouseup', mouseup); //clear event listeners and intervals
		window.removeEventListener('mousedown', mousedown);
		clearInterval(mlId);
		clearInterval(slId);
	}

	audio.clips.jazz.play(); //start jazz music
	return unloadLocal //return unload function so changeScene can access it
}
scene.blackjack = blackjackScene; //add blackjack scene to scene object

function rouletteScene(sock){ //function that contains the roulette scene
	let mX = -100; //holds x of mouse position
	let mY = -100; //holds y of mouse position

	let pixelLength = 0; //holds pixellength of a string, declared here to save memort
	let betAmount = 0; //holds bet amount before being sent to server
	let runningTotal = 0; //holds running total of bets so that the player cannot overbet into negative money

	for (let i = 0; i < game.info.bets.length; i++){ //initialise running total in case of rejoining
		if (game.info.bets[i].owner == playerName) runningTotal += game.info.bets[i].bet;
	}

	let buttons = {}; //holds current buttons
	let rounds = { //holds all buttons possible for the scene
		"betting" : {
			"clear" : new button("CLEAR ALL BETS", "black", col.rect(vec.n(40, 40), 100,48), `rgba(235,175,175,1)`, "white", () => {sock.send("a\x1Fbr\x1Fa"); runningTotal = 0;}),
			"ready" : new button("READY", "black", col.rect(vec.n(500, 40), 100, 48), `rgba(175, 235, 175, 1)`, "white", () => {sock.send("a\x1Fre");}),
			"p1" : new button("+1", "black", col.rect(vec.n(160, 35), 32, 10), "rgba(175,235,175,1)", "white", () => {let playerInd = game.players.findIndex(x => x.pName == playerName); betAmount = Math.min(game.players[playerInd].money - runningTotal, betAmount+1);}),
			"p10" : new button("+10", "black", col.rect(vec.n(160, 47), 32, 10), "rgba(175,235,175,1)", "white", () => {let playerInd = game.players.findIndex(x => x.pName == playerName); betAmount = Math.min(game.players[playerInd].money - runningTotal, betAmount+10);}),
			"p100" : new button("+100", "black", col.rect(vec.n(160, 59), 32, 10), "rgba(175,235,175,1)", "white", () => {let playerInd = game.players.findIndex(x => x.pName == playerName); betAmount = Math.min(game.players[playerInd].money - runningTotal, betAmount+100);}),
			"m2" : new button("\xD72", "black", col.rect(vec.n(160, 71), 32, 10), "rgba(175,235,175,1)", "white", () => {let playerInd = game.players.findIndex(x => x.pName == playerName); betAmount = Math.min(game.players[playerInd].money - runningTotal, betAmount*2);}),
			"m10" : new button("\xD710", "black", col.rect(vec.n(160, 83), 32, 10), "rgba(175,235,175,1)", "white", () => {let playerInd = game.players.findIndex(x => x.pName == playerName); betAmount = Math.min(game.players[playerInd].money - runningTotal, betAmount*10);;}),
			"s1" : new button("-1", "black", col.rect(vec.n(448, 35), 32, 10), "rgba(235, 175, 175, 1)", "white", () => {betAmount = Math.max(0, betAmount - 1);}),
			"s10" : new button("-10", "black", col.rect(vec.n(448, 47), 32, 10), "rgba(235, 175, 175, 1)", "white", () => {betAmount = Math.max(0, betAmount - 10);}),
			"s100" : new button("-100", "black", col.rect(vec.n(448, 59), 32, 10), "rgba(235, 175, 175, 1)", "white", () => {betAmount = Math.max(0, betAmount - 100);}),
			"d2" : new button("\xF72", "black", col.rect(vec.n(448, 71), 32, 10), "rgba(235, 175, 175, 1)", "white", () => {betAmount = Math.max(0, Math.round(betAmount / 2));}),
			"d10" : new button("\xF710", "black", col.rect(vec.n(448, 83), 32, 10), "rgba(235, 175, 175, 1)", "white", () => {betAmount = Math.max(0, Math.round(betAmount / 10));}),

		},
		"spinning" : {
		}
	};

	const values = [ //all values corresponding to a bet position in the betting area
		[ 0, 3, 6, 9,12,15,18,21,24,27,30,33,36,61],
		[ 0, 2, 5, 8,11,14,17,20,23,26,29,32,35,62],
		[ 0, 1, 4, 7,10,13,16,19,22,25,28,31,34,63],
		[-1,51,51,51,51,52,52,52,52,53,53,53,53,-1],
		[-1,54,54,55,55,56,56,57,57,58,58,59,59,-1]
	];

	const itc = [//translates a player's index into a colour
		"200,0,255,",
		"255,127,0,",
		"0,255,255,",
		"255,255,0,"
	]

	function mainloop(){ //main function to be run regularly
		if (sock == null || sock.readyState == WebSocket.CLOSED){ //check if the connection is closed
			try{												  //change scene to selection if so
				return;
			} finally {
				changeScene("selection", null);
			}
		}

		sock.send(`r`); //request game sate

		if (game.currentScene != "roulette"){ //if scene is not roulette, correct it
			changeScene(game.currentScene, sock);
		}
		//assign text of the ready button to match the current game state
		rounds.betting.ready.text = `Ready (${game.info.ready.length}/${game.players.length})`;

		let pOffset = 576 / game.players.length; //calculate drawing offset between players
		ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height); //clear canvas
		ctx.drawImage(background.imgs.generic, 0, 0); //draw background

		ctx.font = "21px pixel"; //draw round counter
		let text = `Round ${game.remRounds} of ${game.maxRounds}`;
		let l = ctx.measureText(text).width;
		l = Math.round(0.5*l);
		ctx.fillStyle = "rgba(22,22,29, 0.9)";
		ctx.fillRect(318 - l,4, 2*l + 4, 28);
		ctx.fillStyle = "white";
		ctx.fillText(text, 320 - l, 28);

		ctx.drawImage(background.imgs.rtable, 68, 96); //draw betting area sprite

		for (let i = 0	; i < game.players.length; i++){ //for each player in the game...
			let p = game.players[i]; //assign shorthand
			let curOff = 32 + (pOffset * 0.5) + (pOffset*i); //calculate drawing offset for current player
			ctx.fillStyle = "rgba("+ itc[i] + "0.5)"; //assign spotlight colour
			ctx.beginPath(); //draw spotlight
			ctx.arc(curOff,312, 32,5*Math.PI/6 , Math.PI/6);
			ctx.fill();
			ctx.drawImage(cows.imgs[p.skin], 0, 1, 16, 15, curOff - 16, 298, 32,30); //draw player skin

			//draw player name and money
			text = p.pName + "--$" + p.money.toString();
			ctx.font = `7px pixel`;
			pixelLength = ctx.measureText(text).width;
			pixelLength += pixelLength%2;
			ctx.fillStyle = `rgba(0,${255*(p.pName == playerName)},0,0.5)`;
			ctx.fillRect(curOff - (0.5*pixelLength) - 2, 331, 2 + pixelLength, 10);
			ctx.fillStyle = 'white';
			ctx.fillText(text, curOff - (0.5*pixelLength), 340);
		}

		//update buttons to match turn options
		if (Object.keys(buttons).toString() != Object.keys(rounds[game.turnOptions]??{})){
			if (game.turnOptions == "betting") {
				runningTotal = 0;
			}
			buttons = rounds[game.turnOptions]??{};
		}

		//if the turn options are betting and player hasn't locked bets, draw buttons and bet amount
		if (game.turnOptions == "betting" && !game.info.ready.includes(playerName)){
			for (let i in buttons){
				let c = buttons[i].col;
				ctx.fillStyle = buttons[i].pressed?buttons[i].colourPressed:buttons[i].colour;
				ctx.fillRect(c.origin.x, c.origin.y, c.width, c.height);
				ctx.fillStyle = buttons[i].textCol;
				ctx.font = "7px pixel"
				let t = ctx.measureText(buttons[i].text);
				ctx.fillText(buttons[i].text, c.origin.x + 0.5*(c.width-t.width), c.origin.y + 0.5*(c.height + t.actualBoundingBoxAscent));
			}

			ctx.fillStyle = "white";
			ctx.font = "42px pixel"
			pixelLength = ctx.measureText(`$${betAmount}`).width;
			ctx.fillText(`$${betAmount}`, 320 - 0.5*(pixelLength), 82);
		} else if (game.turnOptions == "betting" && game.info.ready.includes(playerName)) { //otherwise draw how many players are ready
			ctx.fillStyle = "white";
			ctx.font = "42px pixel";
			pixelLength = ctx.measureText(`(${game.info.ready.length}/${game.players.length}) ready`).width;
			ctx.fillText(`(${game.info.ready.length}/${game.players.length}) ready`, 320 - 0.5*(pixelLength), 82);
		}

		//initialise bet variables
		let betCo = 0;
		let betPo = 0;
		let betI = 0;

		for (let i = 0; i < game.info.bets.length; i++){ //for all bets
			if (game.info.bets[i].pos != betPo){ //if bet is not in current position
				betPo = game.info.bets[i].pos.toString(); //update bet position
				betCo = 1; // update bet counter
				betI = i; //store value of iterative variale i for this bet
			}

			if (betCo == 1){ //if the bet is the first bet to be counted
				//find how many bets are in the same position as the initial bet
				for (let j = 1; j < 4 + Math.min(0, game.info.bets.length - (4 + i)); j++){
					if (game.info.bets[i+j].pos == game.info.bets[i].pos.toString()) betCo++;
					else break;
				}
			}
			let ind = game.players.findIndex(x => x.pName == game.info.bets[i].owner);
			if (ind != -1) { //if the owner of the bet is in the game, draw the bets.
				ctx.fillStyle = "rgba("+itc[ind]+"0.8)";
				let d = [86-4 + 36*(game.info.bets[i].pos[0]), 112 - 4 + 32*game.info.bets[i].pos[1]]

				switch (betCo){ //adjust drawn position based on number of bets placed in this position
					case 2:
						d[0] += (8*(i-betI == 1) - 4);
						break;
					case 3:
						d[0] += (8*(i-betI == 1) - 4) * (i-betI != 2);
						d[1] += 8*(i-betI == 2) - 4;
						break;
					case 4:
						d[0] += (8*((i-betI)%2) - 4);
						d[1] += (8*(i-betI>1) -4);
					default:
						break;
				}
				ctx.fillRect(d[0], d[1], 8, 8); //draw bet on table
			}
		}

		if (game.turnOptions == "betting" && !game.info.ready.includes(playerName)){ //if turn options are betting and player hasns't locked bets
			let tX = mX-86;	 //zero mouse coordinates to top left of bet area		 //get mouse position in bet area and  draw indicator
			let tY = mY-112;
			tX = Math.round(tX/18)*0.5; //quantise mouse coordinates to the width and height of bet "cell"
			tY = Math.round(tY/16)*0.5;
			if (tX > 12 || tY > 2.5){ //if bet is outside of number area, round the y (no inbetween bets outside of numbers)
				tY = Math.round(tY);
			}
			if (tY == 3 && (tX - 0.5)%4 != 0) tX = Math.floor((tX - 0.5)/4)*4 + 2.5; //clamp mouse x to be in one of 3 positions (12,24,36)
			else if (tY == 3) tX = -2; //set mouse out of bounds if inbetween options
			if (tY == 4 && (tX - 0.5)%2  > 0.25) tX = Math.floor((tX - 0.5)/2)*2 + 1.5; //clamp mouse to be in one of 6 positions (18, even, black, red, odd, 36)
			else if (tY == 4) tY = -2; //set mouse out of bounds if inbetween options
			if (tY > 2.5 && tX < 0.5){tY = -2; tX = -2;} //if mouse is under 0, set out of bounds
			if (tY > 2.5 && tX > 12.5){tY = -2; tX = -2;} //if mouse is under the row bets, set out of bounds
			if (tX == 12.5) tX = -2; //if mouse is between numebrs and rows, sett out of bounds
			if (-0.5 < tX && tX < 13.5 && -0.5 < tY && tY < 5){ //if mouse is not out of bounds
				if (tX == 0) tY = 1; //set y value if mouse is over 0
				ctx.fillStyle=`rgba(255,255,255,0.5)`; //draw indicator square where mouse is
				ctx.fillRect(86-4 +36*(tX), 112-4 +32*(tY), 8, 8);
			}

			if (keys.shift){ //show value of bets when shift key is pressed
				let toShow = []; //holds bets to show
				for (let i = 0; i < game.info.bets.length; i++){ //get bets in same position as mouse
					if (game.info.bets[i].pos[0] == tX && game.info.bets[i].pos[1] == tY){
						toShow.push(game.info.bets[i]);
					} else if (game.info.bets[i].pos[0] > tX && game.info.bets[i].pos[1] >= tY) break; //if position is greater than mouse, break, as bets are ordered by position
				}


				if (toShow.length > 0){ //if there are bets to show, show value of bets
					let pos = [tX * 36 + 86, tY * 32 + 112]; //get pixel position of bets
					ctx.font = "7px pixel";
					if (toShow.length == 1){ //if there is one or two bets, draw above in a bubble, seperated by a |
						let t = ctx.measureText(`$${toShow[0].bet}`);
						ctx.fillStyle = "rgba(0,0,0,0.5)";
						ctx.fillRect(pos[0] - 0.5*t.width - 1, pos[1]-4, t.width+1, -t.fontBoundingBoxAscent);
						ctx.fillStyle = "white";
						ctx.fillText(`$${toShow[0].bet}`, pos[0]-0.5*t.width, pos[1]-5);
					} else if (toShow.length == 2){
						let t = ctx.measureText(`$${toShow[0].bet}|$${toShow[1].bet}`);
						ctx.fillStyle = "rgba(0,0,0,0.5)";
						ctx.fillRect(pos[0] - 0.5*t.width - 1, pos[1]-4, t.width+1, -t.fontBoundingBoxAscent);
						ctx.fillStyle = "white";
						ctx.fillText(`$${toShow[0].bet}|$${toShow[1].bet}`, pos[0]-0.5*t.width, pos[1]-5);
					} else if (toShow.length == 3){ //if there are three bets, draw two above and one below
						let t = ctx.measureText(`$${toShow[0].bet}|$${toShow[1].bet}`);
						ctx.fillStyle = "rgba(0,0,0,0.5)";
						ctx.fillRect(pos[0] - 0.5*t.width - 1, pos[1]-8, t.width+1, -t.fontBoundingBoxAscent);
						ctx.fillStyle = "white";
						ctx.fillText(`$${toShow[0].bet}|$${toShow[1].bet}`, pos[0]-0.5*t.width, pos[1]-9);

						t = ctx.measureText(`$${toShow[2].bet}`);
						ctx.fillStyle = "rgba(0,0,0,0.5)";
						ctx.fillRect(pos[0] - 0.5*t.width - 1, pos[1]+8, t.width+1, t.fontBoundingBoxAscent);
						ctx.fillStyle = "white";
						ctx.fillText(`$${toShow[2].bet}`, pos[0]-0.5*t.width, pos[1]+ 7 + t.fontBoundingBoxAscent);
					} else { //if there are four bets, draw two above and two below
						let t = ctx.measureText(`$${toShow[0].bet}|$${toShow[1].bet}`);
						ctx.fillStyle = "rgba(0,0,0,0.5)";
						ctx.fillRect(pos[0] - 0.5*t.width - 1, pos[1]-8, t.width+1, -t.fontBoundingBoxAscent);
						ctx.fillStyle = "white";
						ctx.fillText(`$${toShow[0].bet}|$${toShow[1].bet}`, pos[0]-0.5*t.width, pos[1]-9);

						t = ctx.measureText(`$${toShow[2].bet}|$${toShow[3].bet}`);
						ctx.fillStyle = "rgba(0,0,0,0.5)";
						ctx.fillRect(pos[0] - 0.5*t.width - 1, pos[1]+8, t.width+1, t.fontBoundingBoxAscent);
						ctx.fillStyle = "white";
						ctx.fillText(`$${toShow[2].bet}|$${toShow[3].bet}`, pos[0]-0.5*t.width, pos[1]+ 7 + t.fontBoundingBoxAscent);
					}
				}
			}
		}
	}

	let keys = { //holds value of shift key
		"shift" : 0
	};

	let pressedButton; //holds current pressed button
	let mouse = { //organises functions for mouse events
		0: {
			"d": (e)=>{
				let canvR = canv.getBoundingClientRect(); //get mouse position relative to canvas
				let x = (e.clientX - canvR.left) / canv.style.width.slice(0,-2) * 640 - 1;
				let y = (e.clientY - canvR.top) / canv.style.height.slice(0,-2) * 360 - 1;
				pressedButton = undefined; //clear pressed button
				for (let j in buttons){ //find pressed button
					let i = buttons[j];
					let distX = x - i.col.origin.x;
					let distY = y - i.col.origin.y;
					if (distX >= 0 && distX <= i.col.width && distY >=0 && distY <= i.col.height){
						pressedButton = i;
						break;
					}
				}
				if (pressedButton != undefined){ //if a button is pressed, run its function and exit mouse down event
					pressedButton.pressed = 1; pressedButton.func();
					return;
				}

				//if the player is invalid to place bets, exit event function
				if (game.turnOptions != "betting" || game.info.ready.includes(playerName)) return;
				//get mouse position relative to the bet area
				let tX = mX-86;
				let tY = mY-112;
				tX = Math.round(tX/18)*0.5;
				tY = Math.round(tY/16)*0.5;
				if (tX > 12 || tY > 2.5){
					tY = Math.round(tY);
				}
				if (tY == 3 && (tX - 0.5)%4 != 0) tX = Math.floor((tX - 0.5)/4)*4 + 2.5;
				else if (tY == 3) tX = -2;
				if (tY == 4 && (tX - 0.5)%2  > 0.25) tX = Math.floor((tX - 0.5)/2)*2 + 1.5;
				else if (tY == 4) tY = -2;
				if (tY > 2.5 && tX < 0.5){tY = -2; tX = -2;}
				if (tY > 2.5 && tX > 12.5){tY = -2; tX = -2;}
				if (tX == 12.5) tX = -2;
				if (-0.5 < tX && tX < 13.5 && -0.5 < tY && tY < 5){
					if (tX == 0) tY = 1;
					//clamp mouse positions
					tX = Math.max(0, Math.min(13, tX));
					tY = Math.max(0, Math.min(4, tY));
					if (tX == 0) tY = 1;
					let vX = (tX - Math.floor(tX)); //get decimal part of position
					let vY = (tY - Math.floor(tY));
					//check if a bet owned by the player is already in the mouse position
					let check = game.info.bets.findIndex(x => (x.pos == `${[tX,tY,vX,vY]}` && x.owner == playerName));
					let msg = "";
					//if a bet is not present in the mouse position, set message to be a new bet request
					if (check == -1 && betAmount > 0 && (game.players.find(x => x.pName == playerName)??{}).money >= (betAmount + runningTotal)){
						let temp = {
							"owner" : playerName,
							"pos" : [tX, tY, vX, vY],
							"val" : values[Math.floor(tY)][Math.floor(tX)],
							"bet" : betAmount
						};
						msg = "a\x1Fba\x1F"+JSON.stringify(temp);
						runningTotal += betAmount;
					} else if (check > -1) { //if a bet is in the position, set message to a remove bet request
						msg = `a\x1Fbr\x1F${[tX,tY,vX,vY]}`
						runningTotal -= game.info.bets[check].bet;
					} else {
						return; //if neither match, exit function
					}
					sock.send(msg); //send message to server
				}
			},
			"u": (e) => { //if button is pressed, release button
				if (pressedButton != undefined){
					pressedButton.pressed = 0;
				}
			}
		}
	}

	function keydown(e){ //processes keydown event
		if (e.code === "ShiftLeft" || e.code === "ControlLeft") keys.shift = 1;
	}
	function keyup(e){ //processes keyup event
		if (e.code === "ShiftLeft" || e.code === "ControlLeft") keys.shift = 0;
	}

	function mousemove(e){ //process mouse move event
		let canvR = canv.getBoundingClientRect();
		let x = Math.round((e.clientX - canvR.left) / canv.style.width.slice(0,-2) * 640)-1;
		let y = Math.round((e.clientY - canvR.top) / canv.style.height.slice(0,-2) * 360)-1;
		mX = x;
		mY = y; //set to mouse position relative to canvas
	}

	function mousedown(e){ //process mousedown event
		if (e.button in mouse) mouse[e.button].d(e);
	}
	function mouseup(e){ //process mouseup event
		if (e.button in mouse) mouse[e.button].u(e);
	}

	//assign event listeners and intervals
	window.addEventListener("keyup", keyup);
	window.addEventListener("keydown", keydown);
	window.addEventListener("mousemove", mousemove);
	window.addEventListener("mousedown", mousedown);
	window.addEventListener("mouseup", mouseup);
	let mlId = setInterval(mainloop, 25);

	function unbindLocal(){ //define unload function
		audio.clips.jazz.pause(0); //stop music
		storage.appendChild(canv); //store canvas
		window.removeEventListener("keyup", keyup); //clear event listeners and intervals
		window.removeEventListener("keydown", keydown);
		window.removeEventListener("mousemove", mousemove);
		window.removeEventListener("mousedown", mousedown);
		window.removeEventListener("mouseup", mouseup);
		clearInterval(mlId);
	}

	audio.clips.jazz.play(); //start music
	return unbindLocal; //return unload function so changeScene can access it
}
scene.roulette = rouletteScene; //add roulette scene to scene object

function pokerScene(sock){ //function that contains the poker scene
	let betAmount = 0; //holds the bet amount before being sent to server
	let pIndx; //ease of reference to find the clients player object

	let rounds = { //holds all sets of buttons for a given turn option
		"\x1E":{
			"\x1F" : null
		},
		"betcheck" : {
			"bet" : new button("BET", "black", col.rect(vec.n(36,36), 84,38),"rgba(175,235,175,1)", "white", ()=>{sock.send(`a\x1Fbe\x1F${betAmount}`)}),
			"check" : new button("CHECK", "black", col.rect(vec.n(36,78),84,38), "rgba(175,235,175,1)", "white", ()=>{sock.send("a\x1Fch");}),
			"fold" : new button("FOLD", "black", col.rect(vec.n(36, 120),84,38), "rgba(235,175,175,1)", "white", ()=>{sock.send("a\x1Ffo");}),
		},
		"raisecall" : {
			"raise" : new button("RAISE", "black", col.rect(vec.n(36,36), 84,38),"rgba(175,235,175,1)", "white", ()=>{sock.send(`a\x1Fra\x1F${betAmount}`);}),
			"call" : new button("CALL", "black", col.rect(vec.n(36,78),84,38), "rgba(175,235,175,1)", "white", ()=>{sock.send("a\x1Fca");}),
			"fold" : new button("FOLD", "black", col.rect(vec.n(36, 120),84,38), "rgba(235,175,175,1)", "white", ()=>{sock.send("a\x1Ffo");}),
		},
		"fallin" : {
			"fallin" : new button("ALL IN", "black", col.rect(vec.n(36,36), 84, 57),"rgba(175,235,175,1)", "white", ()=>{sock.send("a\x1Fai");}),
			"fold" : new button("FOLD", "black", col.rect(vec.n(36, 97),84, 57), "rgba(235,175,175,1)", "white", ()=>{sock.send("a\x1Ffo");}),
		},
		"proceedquit" : {
			"proceed" : new button("PROCEED", "black", col.rect(vec.n(36,36), 84, 57),"rgba(175,235,175,1)", "white", ()=>{sock.send("a\x1Fpr\x1F1");}),
			"quit" : new button("QUIT", "black", col.rect(vec.n(36, 97),84, 57), "rgba(235,175,175,1)", "white", ()=>{sock.send("a\x1Fpr\x1F0");}),
		}
	};

	let buttons = {}; //holds current buttons
	let mButtons = { //buttons for money manipulation
		"p1" : new button("+1", "black", col.rect(vec.n(520, 68), 28, 16), "rgba(145,205,145,1)", "white", ()=>{betAmount += 1;}),
		"p10" : new button("+10", "black", col.rect(vec.n(548, 68), 28, 16), "rgba(155,215,155,1)", "white", ()=>{betAmount += 10;}),
		"p100" : new button("+100", "black", col.rect(vec.n(576, 68), 28, 16), "rgba(165,225,165,1)", "white", ()=>{betAmount += 100;}),
		"m2" : new button("\xD72", "black", col.rect(vec.n(520, 52), 42, 16), "rgba(165,225,165,1)", "white", ()=>{betAmount *= 2;}),
		"m10" : new button("\xD710", "black", col.rect(vec.n(562, 52), 42, 16), "rgba(175,235,175,1)", "white", ()=>{betAmount *= 10;}),
		"s1" : new button("-1", "black", col.rect(vec.n(520, 110), 28, 16), "rgba(235,175,175,1)", "white", ()=>{betAmount -= 1;}),
		"s10" : new button("-10", "black", col.rect(vec.n(548, 110), 28, 16), "rgba(225,165,165,1)", "white", ()=>{betAmount -= 10;}),
		"s100" : new button("-100", "black", col.rect(vec.n(576, 110), 28, 16), "rgba(215,155,155,1)", "white", ()=>{betAmount -= 100}),
		"d2" : new button("\xF72", "black", col.rect(vec.n(520, 126), 42, 16), "rgba(215,155,155,1)", "white", ()=>{betAmount = Math.round(betAmount/2);}),
		"d10" : new button("\xF710", "black", col.rect(vec.n(562, 126), 42, 16), "rgba(205,145,145,1)", "white", ()=>{betAmount = Math.round(betAmount/10);}),
		"clear" : new button("clear", "black", col.rect(vec.n(520, 142), 84, 16), "rgba(235,145,145,1)", "white", ()=>{betAmount = game.info.minRaise}),
		"allin" : new button("all in", "black", col.rect(vec.n(520, 36), 84, 16), "rgba(145,235,145,1)", "white", ()=>{betAmount = game.players[pIndx].money})
	};

	let pixelLength = 0; //pixellength of a string, declared here to save memory
	function mainloop(){ //main function run repeatedly durind poker scene
		if (sock == null || sock.readyState == WebSocket.CLOSED){ //check if socket is closed, send to selection scene if closed
			try{
				return;
			} finally {
				changeScene("selection", null);
			}
		}
		sock.send(`r`); //request game state

		pIndx = game.players.findIndex(x => x.pName == playerName); //update player index

		if (game.currentScene != "poker"){ //check if curernt scene is poker, if not, correct it
			changeScene(game.currentScene, sock);
		}

		//clamp bet amount between min raise and money
		if (betAmount < game.info.minRaise) betAmount = Math.min(game.players[pIndx].money, game.info.minRaise);
		if (betAmount > game.players[pIndx].money) betAmount = game.players[pIndx].money;

		if (Object.keys(buttons)[0] != Object.keys(rounds[game.turnOptions])[0]){ //check if the buttons are correct, if not, correct them
			console.log("chage");
			buttons = {...rounds[game.turnOptions], ...mButtons};
		}

		let pOffset = 576 / game.players.length; //draw offset between players
		ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height); //clear canvas and draw background
		ctx.drawImage(background.imgs.generic, 0, 0);

		ctx.font = "21px pixel"; //draw round counter at top of screen
		let text = `Round ${game.remRounds} of ${game.maxRounds}`;
		let l = ctx.measureText(text).width;
		l = Math.round(0.5*l);
		ctx.fillStyle = "rgba(22,22,29, 0.9)";
		ctx.fillRect(318 - l,4, 2*l + 4, 28);
		ctx.fillStyle = "white";
		ctx.fillText(text, 320 - l, 28);

		for (let i = 0; i < game.players.length; i++){ //for each player in game
			let p = game.players[i]; //shorthand for player
			let curOff = 32 + (pOffset * 0.5) + (pOffset*i); //calculat draw offset of specific player
			if (game.info.folded.includes(p.pName)) ctx.fillStyle = `rgba(255, 60, 60, 0.5)`;
			else ctx.fillStyle = `rgba(255,230,120,0.5)`; //set spotlight colour, red if folded
			ctx.beginPath(); //draw spotlight
			ctx.arc(curOff,312, 32,5*Math.PI/6 , Math.PI/6);
			ctx.fill();
			ctx.drawImage(cows.imgs[p.skin], 0, 1, 16, 15, curOff - 16, 298, 32,30); //draw player skin
			//draw player name and money
			text = p.pName + "--$" + p.money.toString();
			ctx.font = `7px pixel`;
			pixelLength = ctx.measureText(text).width;
			pixelLength += pixelLength%2;
			ctx.fillStyle = `rgba(0,${255*(p.pName == playerName)},0,0.5)`;
			ctx.fillRect(curOff - (0.5*pixelLength) - 2, 331, 2 + pixelLength, 10);
			ctx.fillStyle = 'white';
			ctx.fillText(text, curOff - (0.5*pixelLength), 340);

			//check if player is small blind and poker is not between rounds (dealing, proceed wuit)
			if (game.info.sblind == i && game.currentPlayer != "\x1E" && game.turnOptions != "proceedquit"){
				ctx.drawImage(sprites.imgs.sb, curOff-16, 180); //if small blind, draw small blind token
			} else if ((game.info.sblind+1)%(game.players.length) == i && game.currentPlayer != "\x1E" && game.turnOptions != "proceedquit"){
				ctx.drawImage(sprites.imgs.bb, curOff-16, 180); //if big blind, draw big blind token
			} else if (game.turnOptions == "proceedquit"){ //if turn options are proceed quit, draw how much money the player has won
				let indx = game.info.win.findIndex(x => x[0] == p.pName);
				if (indx > -1){
					ctx.font = "14px pixel";
					let t = `+$${game.info.win[indx][1]}`;
					pixelLength = ctx.measureText(t).width;
					ctx.fillText(t, curOff - 0.5*pixelLength, 220);
				}
			}
			//draw cards
			let tempCards = p.cards[0]; //shorthand for the players cards
			for (let k = 0; k < tempCards.length; k++){ //for each card in hand
				let hOff = Math.round(curOff - (0.5*tempCards.length * 32) + k*34 - 1); //calculate draw offset of specific card
				let vOff = 0; //set vertical draw offset to 0
				if (game.info.folded.includes(game.players[i].pName)) vOff = -8; //reduce draw offset if player is folded
				if (tempCards[k].className != "card") ctx.drawImage(cards.bg, hOff + 0.5, 232 + 0.5, 30, 42); //draw blank if card is not a card
				else if (tempCards[k].faceDown === 1 && game.players[i].pName != playerName) ctx.drawImage(cards.back, hOff + 0.5, 232 + 0.5 + vOff, 30, 42); //draw card back if face down and not the clients card
				else { //if card is face up or the clients card, draw the suit and number on the card background
					ctx.drawImage(cards.bg, hOff + 0.5, 232+0.5 + vOff, 30, 42);
					ctx.drawImage(cards.suits[tempCards[k].suit], hOff, 232 + vOff, 30, 42);
					ctx.drawImage(tempCards[k].suit>1?cards.rNo[tempCards[k].value]:cards.bNo[tempCards[k].value], hOff, 232 + vOff, 30, 42);
				}
			}
		}

		//draw community cards
		for (let i = 0; i < game.dealer.cards.length; i++){
			let hOff = 178 + 60*i; //calculate draw offset of specific card
			if (game.dealer.cards[i].faceDown == 1) ctx.drawImage(cards.back, hOff + 0.5, 44.5, 45, 63); //draw facedown if face down
			else { //draw number and suit on background if face up
				ctx.drawImage(cards.bg, hOff + 0.5, 44.5, 45, 63);
				ctx.drawImage(cards.suits[game.dealer.cards[i].suit], hOff, 44, 45, 63);
				ctx.drawImage(game.dealer.cards[i].suit>1?cards.rNo[game.dealer.cards[i].value]:cards.bNo[game.dealer.cards[i].value], hOff, 44, 45, 63);
			}
		}

		//draw bet amount
		ctx.fillStyle = "white";
		ctx.font = "14px pixel";
		pixelLength = ctx.measureText(`$${betAmount}`).width;
		ctx.fillText(`$${betAmount}`, 562-(0.5*(pixelLength)), 103);

		//draw turn indicator if current player is not the client
		if (game.currentPlayer != playerName){
			ctx.fillStyle = "lightgrey";
			ctx.fillRect(36, 36, 84, 122);
			ctx.fillStyle = "black";
			ctx.font = "7px pixel";
			pixelLength = ctx.measureText(`${game.currentPlayer.length>10?game.currentPlayer.slice(0,6)+"...":game.currentPlayer}'s`).width;
			ctx.fillText(`${game.currentPlayer.length>10?game.currentPlayer.slice(0,6)+"...":game.currentPlayer}'s`, 78-0.5*pixelLength, 97);
			ctx.fillText("turn", 66, 106);
		}

		//draw buttons
		for (let i in buttons){
			if (buttons[i] == null || (i in rounds[game.turnOptions] && game.currentPlayer != playerName)) continue; //skip button if not visible to current player
			let c = buttons[i].col; //shorthand for button collider
			ctx.fillStyle = buttons[i].pressed?buttons[i].colourPressed:buttons[i].colour; //draw button
			ctx.fillRect(c.origin.x, c.origin.y, c.width, c.height);
			ctx.fillStyle = buttons[i].textCol; //draw button text
			ctx.font = "7px pixel"
			let t = ctx.measureText(buttons[i].text);
			ctx.fillText(buttons[i].text, c.origin.x + 0.5*(c.width-t.width), c.origin.y + 0.5*(c.height + t.actualBoundingBoxAscent));
		}

		//draw pot information in center
		ctx.fillStyle = "white";
		ctx.font = "7px pixel";
		ctx.fillText("_".repeat(61), 137, 118); //draw top of table
		for (let i = 0; i < game.info.pots.length; i++){ //for each pot, draw information as fixed length string
			let pot = game.info.pots[i];
			let vOff = 128 + i * 10;
			let t = ("               " + pot[0]).slice(-15) + " || Value : " + ("$" + pot[1] + "       ").slice(0,7) + " || To Call : $" + (game.info.match - (game.info.bets[playerName]||0) + "        ").slice(0,5);
			ctx.fillText(t, 137, vOff);
		}
	}

	let cardsPrev = [0,0]; //holds number of cards and number of facedown dealer cards
	function soundloop(){ //plays sound if card is dealt or dealer reveals card
		let temp = [0,0];
		for (let i = 0; i < game.players.length; i++){ //tally cards
            for (let j = 0; j < game.players[i].cards.length; j++){
				temp[0] += game.players[i].cards[j].length;
            }
		} temp[0] += game.dealer.cards.length;
		for (let i = 0; i < game.dealer.cards.length; i++){ //tally facedown community cards
			temp[1] += game.dealer.cards[i].faceDown;
		}
		//if suitable cahnge detected, play sound
		if (temp[0] > cardsPrev[0] || temp[1] != cardsPrev[1]) audio.clips.card.play();
		cardsPrev = [...temp]; //update previous cards
    }

	let pressedButton; //holds previous button
	let mouse = { //organises functions for mouse events
		0 : {
			"d": (e) => { //get pressed button and run
				let canvR = canv.getBoundingClientRect(); //get mouse position
				let x = (e.clientX - canvR.left) / canv.style.width.slice(0,-2) * 640 - 1;
				let y = (e.clientY - canvR.top) / canv.style.height.slice(0,-2) * 360 - 1;
				pressedButton = undefined; //clear pressed button
				for (let j in buttons){ //get button pressed if any
					if (j in rounds[game.turnOptions] && game.currentPlayer != playerName) continue;
					let i = buttons[j];
					let distX = x - i.col.origin.x;
					let distY = y - i.col.origin.y;
					if (distX >= 0 && distX <= i.col.width && distY >=0 && distY <= i.col.height){
						pressedButton = i;
					}
				}
				if (pressedButton != undefined){ //if button is pressed, set pressed property and run function
					pressedButton.pressed = 1; pressedButton.func();
				}
			},
			"u" : (e) => { //if button is pressed, release it;
				if (pressedButton != undefined){
					pressedButton.pressed = 0;
				}
				pressedButton = undefined;
			}
		}
	}

	function mousedown(e){ //processes mousedown event
		if (e.button in mouse) mouse[e.button].d(e);
	}
	function mouseup(e){ //processes mouseup event
		if (e.button in mouse) mouse[e.button].u(e);
	}
	//assign event listeners and intervals
	window.addEventListener("mousedown", mousedown);
	window.addEventListener("mouseup", mouseup);
	let mlId = setInterval(mainloop, 25);
	let slId = setInterval(soundloop, 25);

	function unbindLocal(){ //define unload function
		audio.clips.jazz.pause(0); //stop music
		storage.appendChild(canv); //store canvas
		window.removeEventListener("mousedown", mousedown); //clear event listeners and intervals
		window.removeEventListener("mouseup", mouseup);
		clearInterval(mlId);
		clearInterval(slId);
	}

	audio.clips.jazz.play(); //start music
	return unbindLocal; //return unload function so changeScene can use it
}
scene.poker = pokerScene; //add poker scene to scene object

function fightScene(sock){ //function that contains poker scene
	let drawQueue = []; //initialise and clear draw queue
	let baseSpeed = 4; //base movement speed
	let dashes = [1,1]; //base current and max dashes
	let br = 0;			//stacks of bull rush upgrade
	let gunStats = { 	//stacks of gun related upgrades
		"ra" : 1,
		"rs" : 1
	};
	const sprintFact = 0.5; //percentage increase to speed when sprinting
	let vel = vec.n(0,0); 	//velocity as a vector
	let mx = 0;				//mouse position
	let my = 0;

	let dmgFrms = [0,0,0,0]; //how many frames a damage animation for a given player should play

	let pIndx = game.players.findIndex(x => x.pName == playerName); //player index of current player, ease of access
	//store all relevant upgrades in variables
	let uglist = game.players[pIndx].upgrades.split("."); //split client player upgrades
	for (let i = 0; i < uglist.length; i += 2){ //
		switch (uglist[i]) { //check what upgrade character is
			case "1": //increase rate of fire if Ruminate upgrade
				gunStats.ra *= 1.2;
				break;
			case "3": //increase reload speed if Opposable Hooves upgrade
				gunStats.rs *= 1.1;
			case "c": //increase movement speed if Rendered Fat upgrade
				baseSpeed *= 1.1;
				break;
			case "d": //increment max and current dashes if Matador upgrade
				dashes[0] = dashes[1] += 1;
				break;
			case "f": //increment bull rush stacks if Bull Rush upgrade
				br += 1;
				break;
		}
	}

	function mainloop(){ //main function that is run repeatedly for fight scene
		drawQueue = []; //clear draw queue

		if (sock == null || sock.readyState == WebSocket.CLOSED){ //check if connection is close
			try{												  // if connection is closed, send to selection scene
				return;
			} finally {
				changeScene("selection", null);
			}
		}

		pIndx = game.players.findIndex(x => x.pName == playerName); //update player index

		if (game.currentScene != "fight"){ //check if current scene is fight, if not, correct it
			changeScene(game.currentScene, sock);
		}

		//Update Velocity
		vel.x = (1 + (0.02*br*game.players[pIndx].hits)) * baseSpeed * (keys.a ^ keys.d) * (keys.a ? -1 : 1) * (keys.shift * sprintFact + 1);
		vel.y = (1 + (0.02*br*game.players[pIndx].hits)) * baseSpeed * (keys.w ^ keys.s) * (keys.w ? -1 : 1) * (keys.shift * sprintFact + 1);
		if (vel.x != 0) flip = 1 * (vel.x < 0); //assign flip if horizontal velocity is negative
		//Calculate unit vector of  mouse from player center
		let dir = vec.n(mx - game.players[pIndx].col.origin.x - 8, my - game.players[pIndx].col.origin.y - 15).normal();
		//send information to server
		sock.send(`d\x1F${dir.x}\x1F${dir.y}`); //send look direction
		sock.send(`m\x1F${vel.x}\x1F${vel.y}\x1F${flip}`); //send movement request

		//prepare draww order;
		drawQueue = drawQueue.concat(game.players);
		//Clear canvas
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

		ctx.drawImage(background.imgs.fight.floor, 0, 0); //draw floor
		for (let i=0; i < game.players.length; i++){ //draw shadows
			ctx.fillStyle = `rgba(10,10,10,0.5)`
			ctx.fillRect(game.players[i].col.origin.x - charScaleFact, game.players[i].col.origin.y + 13*charScaleFact, 10*charScaleFact, 3*charScaleFact)
		}
		ctx.drawImage(background.imgs.fight.wall, 0, 0); //draw walls

		//sort players
		drawQueue.sort((a,b) => {
			let first = a.col.origin.y + (a.col.height??b.col.radius)??0;
			let second = b.col.origin.y + (b.col.height??b.col.radius)??0;
			return first - second;
		});

		//draw players in order
		for (let j = 0; j < drawQueue.length; j++){
			const i = drawQueue[j];
			if (!game.info.ready.includes(i.pName)) ctx.drawImage(cows.dead, 0, 1, 32, 32, i.col.origin.x-4*charScaleFact, i.col.origin.y, 32,32); //if player is dead, draw steak sprite
			else if (i.flipped == true) ctx.drawImage(cows.fimgs[i.skin], 0, 1, 16, 15, i.col.origin.x-4*charScaleFact, i.col.origin.y, 16*charScaleFact, 15*charScaleFact); //draw flipped if flipped
			else ctx.drawImage(cows.imgs[i.skin], 0, 1, 16, 15, i.col.origin.x-4*charScaleFact, i.col.origin.y, 16*charScaleFact, 15*charScaleFact); //otherwise draw normal skin
		}
		//draw player names, damage frames, and look indicators
		for (let i = 0; i < game.players.length; i++){
			let p = game.players[i];
			ctx.font = `7px pixel`;
			pixelLength = ctx.measureText(p.pName).width;
			pixelLength += pixelLength%2;
			ctx.fillStyle = `rgba(50, ${50 + (p.pName == playerName)*150},50,0.8)`;
			ctx.fillRect(p.col.origin.x + (7 - 0.5*pixelLength), p.col.origin.y - 2, 2 + pixelLength, -10);
			if (p.pName != playerName){ //draw other player health in name tag if player is not current player
				ctx.fillStyle = "rgba(255,0,0,0.5)";
				ctx.fillRect(p.col.origin.x + (7 - 0.5*pixelLength), p.col.origin.y - 2, (2 + pixelLength)*(Math.min((p.health[0]/p.health[1]),1) || 0), -10)
			}
			ctx.fillStyle = `rgba(255,255,255,1)`;
			ctx.fillText(p.pName, p.col.origin.x + (9 - 0.5*pixelLength),p.col.origin.y - 4);
			if (dmgFrms[i] > 0){ //if the player at this index has damage frames, draw red overlay and decrement damage frames
				ctx.fillStyle = `rgba(255,0,0,0.4)`;
				ctx.fillRect(p.col.origin.x, p.col.origin.y, p.col.width, p.col.height);
				dmgFrms[i]--;
			}

			ctx.beginPath(); //draw look indicator that shows where players is look
			ctx.arc(p.col.origin.x + 8 + 20*(parseFloat(p.ldir.x)||0), p.col.origin.y + 15 + 20*(parseFloat(p.ldir.y)||0), 2, 0, 2*Math.PI);
			ctx.fillStyle = "rgba(180,0,0,1)";
			ctx.fill();

			if (p.pName == playerName){ //if player is client player, draw UI
				ctx.fillStyle = "black"; 		//draw health dash and ammo bar backgrounds
				ctx.fillRect(30,332, 164, 24);	//
				ctx.fillRect(238,332, 164, 24);	//
				ctx.fillRect(446,332, 164, 24);	//
				ctx.fillStyle = "red"; //draw health bar
				ctx.fillRect(32,334, 160 * (p.health[0]/p.health[1]), 20);
				ctx.fillStyle = "grey"; //draw ammo bar
				ctx.fillRect(240,334, 160 * (p.ammo[0]/p.ammo[1]), 20);
				ctx.fillStyle = "blue"; //draw dash bar
				ctx.fillRect(448,334, 160 * (dashes[0]/dashes[1]), 20);
				ctx.font = "7px pixel"; //draw text in each bar
				ctx.fillStyle = "white";								//draw Health text					//draw one hit protection count (Last Stand)
				if (p.upgrades.split("e").length > 1) { ctx.fillText(`Health ${p.health[0]}/${p.health[1]} (+${p.upgrades.split("e").length-1}\u26e8)`, 36, 348);
				} else {ctx.fillText(`Health ${p.health[0]}/${p.health[1]}`, 36, 348);}
				ctx.fillText(`Ammo ${p.ammo[0]}/${p.ammo[1]}`, 244, 348); //draw ammo text
				ctx.fillStyle = "white";
				ctx.fillText(`Dashes ${dashes[0]}/${dashes[1]}`, 452, 348); //draw health text
			}
		}

		for (let i = 0; i < game.projectiles.length; i++){ //draw all projectiles
			let p = game.projectiles[i];
			ctx.beginPath();
			ctx.fillStyle = p.doCol?"white":"rgba(255,0,0,0.5)";
			ctx.arc(p.col.origin.x,p.col.origin.y, p.col.radius, 0, 2 * Math.PI);
			ctx.fill();
		}

		if (typeof(game.info.win) == "object" && game.info.win.length == 2) { //if a player has won fight scene, draw name and money won
			ctx.font="21px pixel";
			let t = ctx.measureText(game.info.win[0] + " has won $" + game.info.win[1]);
			ctx.fillStyle = "rgba(0,0,0,0.75)";
			ctx.fillRect(320 - 0.5*t.width - 10, 180 - 0.5*t.fontBoundingBoxAscent - 10, t.width + 20, t.fontBoundingBoxAscent+20);
			ctx.fillStyle = "white";
			ctx.fillText(game.info.win[0] + " has won $" + game.info.win[1], 320 - 0.5*t.width, 180 + 0.5*t.fontBoundingBoxAscent);
		}
	}

	let prevHealth = []; //holds previous health of players
	function dmgloop(){ //checks player healths and plays sound
		for (let i = 0; i < game.players.length ; i++){ //for all players if player health is less than previous health
			if (prevHealth[i] > game.players[i].health[0]){ //set damage frames to 4
				if (i == pIndx) audio.clips.hurt.play(); //if client player has less health, play hurt sound
				else audio.clips.hit.play();			 //if other player has less health, play hit sound
				dmgFrms[i] = 4;
			}
			prevHealth[i] = game.players[i].health[0]; //update previous health
		}
	}

	let prevProj = 0; //holds number of projectiles
	function prjloop(){ //plays sound if more projectiles
		if (game.projectiles.length > prevProj) audio.clips.shoot.play(); //if there are more projectiles, play shoot sound
		prevProj = game.projectiles.length; //update previous projectile length
	}

	let reloading = 0; //if this is one, prevents players from reloading or shooting
	let keys = { //holds information relating to keys
		"w" : 0,
		"a" : 0,
		"s" : 0,
		"d" : 0,
		"shift" : 0,
		"funcs" : { //functions for keys
			"r" : () => {
				if (reloading == 0)(async () => { //if not reloading, start reloading, send reload request on finish and clear reloading
					reloading = 1;				  //play appropriate sounds during process
					audio.clips.desel.play();
					await new Promise(r => setTimeout(r, 1000 / gunStats.rs));
					sock.send("a\x1Fr");
					audio.clips.sel.play();
					reloading = 0;
				})();
			},
			"space" : () => { //if player has dashes, send dash movement request in direction of mouse
				if (dashes[0] > 0){ //decrement dashes, increment dashes after 2.5s
					let pO = game.players[pIndx].col.origin;
					let dir = vec.n(mx - pO.x - 8, my - pO.y - 15).normal();
					sock.send(`m\x1F${dir.x * 50}\x1F${dir.y * 50}\x1F${flip}`);
					audio.clips.dash.play();
					dashes[0] -= 1;
					(async () => {await new Promise(r => setTimeout(r,2500)); dashes[0] = Math.min(dashes[0]+1, dashes[1]);})();
				}
				else audio.clips.desel.play(); //if player is not able to dash play deselect
			}
		}
	}

	let shootable = 1; //if this is one, player is not able to shoot
	let mouse = { //organises information relating to mouse
		0 : {
			"f" : (e) => {
				if (shootable == 1 && reloading == 0) (async () => { //if player is able to shoot and the player is not reloading
					while (game.players[pIndx].ammo[0] > 0 && mouse[0].v == 1 && shootable == 1 && reloading == 0){ //loop whilst mouse button is held and not reloading
						shootable = 0; //set shootable to zero so players can't circumvent shoot speed
						sock.send("a\x1Fs"); //send shoot request to server
						await new Promise(r => setTimeout(r, 500/gunStats.ra)); //set cooldown speed based off of player fire rate
						shootable = 1; //set shootable to one before looping
					}
				})();
			},
			"v" : 0 //value of mouse0 down, read by function of mouse0
		}
	}

	function keydown(e) { //processes keydown event
		if(e.code.at(-1).toLowerCase() in keys) keys[e.code.at(-1).toLowerCase()] = 1;
		else if (e.code.at(-1).toLowerCase() in keys.funcs) keys.funcs[e.code.at(-1).toLowerCase()](e);
		else if (e.code == "ShiftLeft" || e.code == "ControlLeft") keys.shift = 1;
		else if (e.code == "Space") keys.funcs.space();
	}
	function keyup(e){ //process keyup event
		if(e.code.at(-1).toLowerCase() in keys) keys[e.code.at(-1).toLowerCase()] = 0;
		else if (e.code == "ShiftLeft" || e.code == "ControlLeft") keys.shift = 0;
	}
	function mousemove(e){ //processes mouse move event
		let canvR = canv.getBoundingClientRect(); //get mouse position relative to canvas
		let x = Math.round((e.clientX - canvR.left) / canv.style.width.slice(0,-2) * 640)-1;
		let y = Math.round((e.clientY - canvR.top) / canv.style.height.slice(0,-2) * 360)-1;
		mx = x; //update mouse position variables
		my = y;
	}
	function mousedown(e){ //processes mousedown event
		if (e.button in mouse) {
			mouse[e.button].v = 1;
			mouse[e.button].f();
		}
	}
	function mouseup(e){ //processes mouseup event
		if (e.button in mouse) mouse[e.button].v = 0;
	}
	//assign event listeners and intervals
	window.addEventListener("keydown", keydown);
	window.addEventListener("keyup", keyup);
	window.addEventListener("mousedown", mousedown);
	window.addEventListener("mouseup", mouseup);
	window.addEventListener("mousemove", mousemove);
	let mlId = setInterval(mainloop, 25);
	let dlId = setInterval(dmgloop, 25);
	let plId = setInterval(prjloop, 25);

	function unloadLocal(){ //define unload function
		storage.appendChild(canv); //store canvas
		window.removeEventListener("keydown", keydown); //clear event listeners
		window.removeEventListener("keyup", keyup);
		window.removeEventListener("mousedown", mousedown);
		window.removeEventListener("mouseup", mouseup);
		window.removeEventListener("mousemove", mousemove);
		clearInterval(mlId); //clear intervals
		clearInterval(dlId);
		clearInterval(plId);
	}

	return unloadLocal; //return unload function so changeScene can access it
}
scene.fight = fightScene; //add fight scene to scene object
})(); //encapsulated to prevent client editing
