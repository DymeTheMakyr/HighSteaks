//init display variables
let sw = window.innerWidth - 1;
let sh = window.innerHeight - 1;
let factor = [16, 9];
let charScaleFact = 2;
console.log([sw, sh]);
sw = sw / factor[0] < sh / factor[1] ? sw : (sh / factor[1]) * factor[0];
sh = sw / factor[0] > sh / factor[1] ? sh : (sw / factor[0]) * factor[1];
console.log([sw, sh]);

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

let unload;
const scene = {};
let game = 0;

const pixelFont = new FontFace("pixel", "url(./fonts/pixel.otf)");
document.fonts.add(pixelFont);

//public debug variables
let debug = {
	"showHitboxes":false,
	"hitboxOpacity":0.1
};

// ease of use variables
let roomNo;
let playerName;
let skin;
let flip = 0;

let kts = {
	"bj" : "blackjack",
	"rl" : "roulette",
	"pk" : "poker",
	"ff" : "fight"
}

// Collision function

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

//vector object helper
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
// scene change function
function changeScene(targetScene, sock, ...args){
	if (targetScene in scene){
		if (sock != null) sock.send(`c\x1F${roomNo}\x1F${targetScene}`);
		unload();
		if (targetScene == "selection") container.appendChild(document.getElementById("selectionScene"));
		else container.appendChild(canv);
		unload = scene[targetScene](sock, ...args);
	} else {
		throw new Error("targetScene not found, is it in scene object?");
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


class button {
	col;
	text;
	textCol;
	colour;
	colourPressed;
	pressed = 0;
	func;
	
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
	static rNo = [];
	static bNo = [];
	static suits = [];
	static back;
	static bg;

	static {
		for (let i = 0; i < 13; i++){
			cards.rNo.push(loadImg("cards\\" + ("000" + i).substr(-3) + ".png"));
		}
		for (let i = 0; i < 13; i++){
			cards.bNo.push(loadImg("cards\\" + ("000" + (i+13)).substr(-3) + ".png"));
		}
		for (let i = 0; i < 4; i++){
			cards.suits.push(loadImg("cards\\" + ("000" + (i+26)).substr(-3) + ".png"));
		}
		cards.back = loadImg("cards\\back.png");
		cards.bg = loadImg("cards\\030.png");
	}
}

///// DELETE LATER

// cow manager
class cows {
	static strings = [];
	static imgs = [];
	static fimgs = [];
	
	static {
		for (let i = 0; i < 9	; i++){
			cows.strings.push("cows\\" + ("000" + (i)).substr(-3)+".png")
			cows.imgs.push(loadImg(cows.strings[i]));
		}
		for (let i = 0; i < 8; i++){
			cows.fimgs.push(loadImg("cows\\flipped\\" + ("000" + (i)).substr(-3)+".png"));
		}
	}
}
// background manager
class background {
	static imgs = {};
	
	static {
		background.imgs.lobby = {};
		background.imgs.lobby.floor = loadImg("./background/lfloor.png");
		background.imgs.lobby.wall = loadImg("./background/lwall.png");
		background.imgs.blackjack = loadImg("./background/blackjack.png");
	}
}

//Sprite Manager
class sprites {
	static imgs = {};
	
	static {
		sprites.imgs.tableTemp = loadImg("./sprites/tableTemp.png");
		sprites.imgs.blackjack = loadImg("./sprites/blackjack.png");
		sprites.imgs.roulette = loadImg("./sprites/roulette.png");
		sprites.imgs.poker = loadImg("./sprites/poker.png");
		sprites.imgs.fight = loadImg("./sprites/fight.png");
		sprites.imgs.slots = loadImg("./sprites/slots.png");
	}
}

class audio {
	static clips = {};
	
	static {
		audio.clips.sel = loadAudio("./audio/select.wav");
		audio.clips.desel = loadAudio("./audio/deselect.wav");
		audio.clips.slots = loadAudio("./audio/slots.wav");
		audio.clips.bar = loadAudio("./audio/bar.wav");
		audio.clips.shop = loadAudio("./audio/shop.mp3");
		audio.clips.card = loadAudio("./audio/card.wav");
		audio.clips.jazz = loadAudio("./audio/jazz.mp3");
		audio.clips.jazz.loop = true;
	}
}

// Game Scene
function lobbyScene(sock) {
	//key functions
	function resize() {
		sw = window.innerWidth - 1;
		sh = window.innerHeight - 1;
		factor = [16, 9];
		console.log([sw, sh]);
		sw = sw / factor[0] < sh / factor[1] ? sw : (sh / factor[1]) * factor[0];
		sh = sw / factor[0] > sh / factor[1] ? sh : (sw / factor[0]) * factor[1];
		console.log([sw, sh]);
		canv.style.width = sw.toString() + 'px'; //external width
		canv.style.height = sh.toString() + 'px'; //external height
	}

	//force call resize function
	resize();

	//key variables
	let drawQueue = [];
	let currentInteractable = undefined;
	let votes;
	let vel = {
		"x" : 0,
		"y" : 0
	}
	//collider class
	
	let interactFuncs = {
		"sl" : () => {audio.clips.slots.play();},
		"ba" : () => {audio.clips.bar.play();},
		"sh" : () => {sock.send(`v\x1F${roomNo}\x1F${playerName}\x1F0`);audio.clips.shop.play();}
	}
	
	function interactFunc(key){
		if (key in interactFuncs) interactFuncs[key]();
		else if (key in votes) {
			sock.send(`v\x1F${roomNo}\x1F${playerName}\x1F${key}`);
			if (playerName in game.votes && game.votes[playerName] != currentInteractable.funcKey) audio.clips.sel.play();
			else audio.clips.desel.play();
		}
	}
		
	//Key Manager;
	let keys = {
		"w" : 0,
		"a" : 0,
		"s" : 0,
		"d" : 0,
		"shift" : 0,
		"funcs" : {
			"e":() => {if(currentInteractable != null) {
				interactFunc(currentInteractable.funcKey);
				console.log("interact");
			}}
		}
	}
	
	//Movement variables
	const baseSpeed = 4
	const sprintFact = 0.5
	let x = 50;
	let y = 50;

	function mainloop() {
		drawQueue = [];
		
		if (sock == null || sock.readyState == WebSocket.CLOSED){
			try{
				return;
			} finally {
				changeScene("selection", null);
			}
		}
		
		if (game.currentScene != "lobby"){
			changeScene(game.currentScene, sock);
		}
		
		//Update Velocity
		vel.x = baseSpeed * (keys.a ^ keys.d) * (keys.a ? -1 : 1) * (keys.shift * sprintFact + 1);
		vel.y = baseSpeed * (keys.w ^ keys.s) * (keys.w ? -1 : 1) * (keys.shift * sprintFact + 1);
		//Update Position
		
		if (vel.x != 0) flip = 1 * (vel.x < 0);
		//Send To Serve
		sock.send(`m\x1F${roomNo}\x1F${playerName}\x1F${vel.x}\x1F${vel.y}\x1F${flip}`);
		
		//prepare draww order;
		drawQueue = drawQueue.concat(game.players);
		drawQueue = drawQueue.concat(game.interactables);
		//Clear And Draw
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		ctx.drawImage(background.imgs.lobby.floor,0,0,640,360); //draw floor
		for (let i=0; i < game.players.length; i++){ //draw shadows
			ctx.fillStyle = `rgba(10,10,10,0.5)`
			ctx.fillRect(game.players[i].col.origin.x - charScaleFact, game.players[i].col.origin.y + 13*charScaleFact, 10*charScaleFact, 3*charScaleFact)
		}
		ctx.drawImage(background.imgs.lobby.wall,0,0,640,360); //draw walls
		
		//get interactable if any
		currentInteractable = null;
		game.interactables.sort((a,b) => {return a.col.y - b.col.y});
		for (let i = 0; i < game.interactables.length; i++){
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
		
		
		for (const i of drawQueue){
			if (i.className == "player"){
				if (i.flipped == true) ctx.drawImage(cows.fimgs[i.skin], 0, 1, 16, 15, i.col.origin.x-4*charScaleFact, i.col.origin.y, 16*charScaleFact, 15*charScaleFact);
				else ctx.drawImage(cows.imgs[i.skin], 0, 1, 16, 15, i.col.origin.x-4*charScaleFact, i.col.origin.y, 16*charScaleFact, 15*charScaleFact);
			} else if (i.className == "interactable"){
				//ctx.fillStyle="rgba(255,255,255,0.4)";
				//ctx.fillRect(i.col.origin.x, i.col.origin.y, i.col.width, i.col.height);
				if (sprites.imgs[i.spritename] != null) ctx.drawImage(sprites.imgs[i.spritename], i.col.origin.x + i.renderOffset.x, i.col.origin.y + i.renderOffset.y);
			}
		}
		
		votes = {
			"bj" : 0,
			"rl" : 0,
			"pk" : 0,
			"ff" : 0
		};
		
		for (let i in game.votes){
			votes[game.votes[i]] += 1;
		}
		
		for (let i = 0; i < game.interactables.length; i++){
			let c = game.interactables[i];
			if (votes[c.funcKey] > 0){
				ctx.fillStyle = `rgba(0,0,0,0.5)`;
				ctx.fillRect(c.col.origin.x + (0.5*c.col.width) - (28), c.col.origin.y + c.renderOffset.y - 4, 59, -29);
				ctx.font = `30px pixel`;
				ctx.fillStyle = `rgba(255,255,255,1)`;
				ctx.fillText(`${votes[c.funcKey]}/${Object.keys(game.players).length}`, c.col.origin.x + (0.5*c.col.width) - (24), c.col.origin.y + c.renderOffset.y-8);
			}
		}
		
		//ctx.fillStyle = "rgba(255,255,255,0.3)";
		if (currentInteractable != null) {
			let c = currentInteractable;
			ctx.font = `10px pixel`;
			let pixelLength = ctx.measureText(c.text).width;
			pixelLength += pixelLength%2;
			ctx.fillStyle = `rgba(0,0,0,0.8)`;
			ctx.fillRect(c.col.origin.x + (0.5*c.col.width) - 0.5*pixelLength - 2, c.col.origin.y + c.renderOffset.y - 2, pixelLength + 4, 13);
			ctx.fillStyle = `white`;
			ctx.fillText(c.text, c.col.origin.x + (0.5*c.col.width) - 0.5*pixelLength, c.col.origin.y + c.renderOffset.y + 9);
		}
		
		
		for (let i = 0; i < game.players.length; i++){ //draw player names
			ctx.font = `10px pixel`;
			let pixelLength = ctx.measureText(game.players[i].pName).width;
			pixelLength += pixelLength%2;
			ctx.fillStyle = `rgba(0,${(game.players[i].pName == playerName)*200},0,0.5)`;
			ctx.fillRect(game.players[i].col.origin.x + (8 - 0.5*pixelLength) - 2, game.players[i].col.origin.y - 1, 2 + pixelLength, -10);
			ctx.fillStyle = `rgba(255,255,255,1)`;
			ctx.fillText(game.players[i].pName, game.players[i].col.origin.x + (8 - 0.5*pixelLength),game.players[i].col.origin.y - 2);
		}
		
		
		if (debug.showInteractables){
			for (let i = 0; i < game.interactables.length; i++){
				let j = game.interactables[i];
				ctx.fillStyle = `rbga(255,255,255,0.4)`;
				ctx.fillRect(j.col.origin.x, j.col.origin.y, j.col.width, j.col.height);
			}
		}
		
		if (debug.showHitboxes){
			debug.hitboxOpacity = Math.max(0, Math.min(1, debug.hitboxOpacity));
			for (let i = 0; i < game.colliders.length; i++){ //render colliders
				if (game.colliders[i].type == "l"){
					let c = game.colliders[i];
					ctx.lineWidth = c.thickness*2;
					ctx.strokeStyle = `rgba(0,255,0,${debug.hitboxOpacity})`;
					ctx.beginPath();
					ctx.moveTo(c.origin.x, c.origin.y);
					ctx.lineTo(c.origin.x + c.points[1].x, c.origin.y + c.points[1].y);
					ctx.stroke();
				} else if (game.colliders[i].type == "c"){
					let c = game.colliders[i];
					ctx.fillStyle = `rgba(255,0,0,${debug.hitboxOpacity})`;
					ctx.beginPath();
					ctx.arc(c.origin.x, c.origin.y, c.radius, 0, 2*Math.PI);
					ctx.fill();
				} else if (game.colliders[i].type == "r"){
					let c = game.colliders[i]; 
					ctx.fillStyle = `rgba(0,0,255,${debug.hitboxOpacity})`;
					ctx.fillRect(c.origin.x, c.origin.y, c.width, c.height);
				}
			}
		}
	}

	function keydown(e) {
		//Collect Keydowns
		if (e.code === 'KeyW') keys.w = 1;
		if (e.code === 'KeyA') keys.a = 1;
		if (e.code === 'KeyS') keys.s = 1;
		if (e.code === 'KeyD') keys.d = 1;
		if (e.code === 'ShiftLeft') keys.shift = 1;
		
		if (e.code === 'KeyE') keys.funcs.e();
	}
	function keyup(e) {
		//Collect Keyups
		if (e.code === 'KeyW') keys.w = 0;
		if (e.code === 'KeyA') keys.a = 0;
		if (e.code === 'KeyS') keys.s = 0;
		if (e.code === 'KeyD') keys.d = 0;
		if (e.code === 'ShiftLeft') keys.shift = 0;
	}

	//Assign Listeners
	window.addEventListener('keydown', keydown);
	window.addEventListener('keyup', keyup);
	window.addEventListener('resize', resize);
	mlId = setInterval(mainloop, 25);
//	gsId = setInterval(mainloop, 10);
	
	function unloadLocal() {
		storage.appendChild(canv);
		audio.clips.jazz.pause();
		window.removeEventListener('keydown', keydown);
		window.removeEventListener('keyup', keyup);
//		window.removeEventListener('resize', resize);
		clearInterval(mlId);
//		clearInterval(gsId);
	}
	audio.clips.jazz.play();
	return unloadLocal;
}
scene.lobby = lobbyScene;

function selectionScene(sock){	
	audio.clips.jazz.currentTime = 0;
	let ipToggle = document.getElementById("ipToggle");
	let ip = document.getElementById("ip");
	let sel = document.getElementById("skin");
	let img = document.getElementById("char");
	ip.style.display = "none";
	ipToggle.onchange = () => {ip.style.display = ipToggle.checked?"block":"none";};
	sel.onchange = () => {img.src = cows.strings[sel.value]}
	img.src = cows.strings[sel.value];
	function update(){
		let rCo = container.children[0].children[9].value;
		if (rCo[0] == "-") container.children[0].children[9].value = rCo.slice(1);
		if (rCo[0] == 0) container.children[0].children[9].value = 1;
		if (rCo > 50) container.children[0].children[9].value = 50;
	}
	let uId;
	function unloadLocal(){
		clearInterval(uId);
		storage.appendChild(container.children[0]);
	}
	function chooseAddr(priv){
		console.log(ip.value);
		if (priv === 1){
			return ipToggle.checked?("wss://"+ip.value):"wss://localhost:8000";
		} else {
			return ipToggle.checked?("ws://"+ip.value):"ws://localhost:8000";
		}
	}
	function hostRoom(){
		console.log("host");
		let nam = container.children[0].children[5].value;
		let rId = container.children[0].children[7].value;
		let rCo = container.children[0].children[9].value;
		let skn = container.children[0].children[11].value;
		if (nam.length = 0) {alert("Input Name"); return 0;}
		if (nam.includes("\x1F")) {alert("Forbidden character '\x1F' in name"); return 0;}
		if (rId.length != 4) {alert("Room ID needs 4 characters"); return 0;}
		if (skn == 8) {alert("Select Skin"); return 0;}
		try {
			sock = new WebSocket(chooseAddr(0));
		} catch {
			sock = new WebSocket(choosAddr(1))
		}
		sock.onopen = () => {console.log(`h\x1F${nam}\x1F${rId}\x1F${skn}\x1F${rCo}`);sock.send(`h\x1F${nam}\x1F${rId}\x1F${skn}\x1F${rCo}`)};
		sock.onmessage = (message) => {if (message.data.toString() == -1){alert("Room Not Available");sock.close();return 0;} 
		else {
			game=JSON.parse(message.data.split("\x1F")[1]);
			playerName = nam;
			roomNo = rId;
			console.log("room made");
			sock.onmessage = (message) => {
				let resp = message.data.split("\x1F");
				if (resp[0] == "r"){
					temp = JSON.parse(resp[1]);
					temp.players.forEach((x) => {x.col.origin.x = parseInt(x.col.origin.x); x.col.origin.y = parseInt(x.col.origin.y)});
					game = temp;
				}
			}
			changeScene("lobby", sock);
		}};
	}
	function joinRoom(){
		let nam = container.children[0].children[5].value;
		let rId = container.children[0].children[7].value;
		let skn = container.children[0].children[9].value;
		if (nam.length = 0) {alert("Input Name"); return 0;}
		if (nam.includes("\x1F")) {alert("Forbidden character '\x1F' in name"); return 0;}
		if (rId.length != 4) {alert("Room ID needs 4 characters"); return 0;}
		if (skn == 8) {alert("Select Skin"); return 0;}
		if (chooseAddr == "ws://"){alert("Input IP address"); return;}
		try {
			sock = new WebSocket(chooseAddr(0));
		} catch {
			sock = new WebSocket(choosAddr(1))
		}
		sock.onopen = () => {console.log(`j\x1F${nam}\x1F${rId}\x1F${skn}`[0]);sock.send(`j\x1F${nam}\x1F${rId}\x1F${skn}`)};
		sock.onmessage = (message) => {if (message.data == -1){alert("Room Not Found");sock.close();return 0;} 
			else if (message.data == -2){alert("Another User Has This Name");sock.close();return 0;} 
			else if (message.data == -3){alert("This Room Is Full");sock.close();return 0;} else {
			game=JSON.parse(message.data.split("\x1F")[1]);
			playerName = nam;
			roomNo = rId;
			sock.onmessage = (message) => {
				let resp = message.data.split("\x1F");
				if (resp[0] == "r"){
					temp = JSON.parse(resp[1]);
					temp.players.forEach((x) => {x.col.origin.x = parseInt(x.col.origin.x); x.col.origin.y = parseInt(x.col.origin.y)});
					game = temp;
				}
			}
			changeScene("lobby", sock);
		};}
	}
	uId = setInterval(update, 100);
	container.appendChild(document.getElementById("selectionScene"));
	document.getElementById("host").onclick = hostRoom;
	document.getElementById("join").onclick = joinRoom;
	
	return unloadLocal;
}
scene.selection = selectionScene;
unload = selectionScene();
function blackjackScene(sock){
	let betAmount = 0;
	let buttons = {};	
	let rounds = {
		"bet" : {
			"p1" : new button("+1", "black", col.rect(vec.n(32,32), 54, 22), `rgba(185,245,185,1)`, `rgba(255,255,255,1)`, () => {
				betAmount += 1; 
				let mon = game.players.find((x) => (x.pName == playerName)).money;
				if (betAmount > mon) betAmount = mon;
			}),
			"s1" : new button("-1", "black", col.rect(vec.n(86,32), 54, 22), `rgba(235,175,175,1)`, `rgba(255,255,255,1)`, () => {betAmount -= 1; if (betAmount < 0) betAmount = 0;}),
			"p10" : new button("+10", "black", col.rect(vec.n(32,54), 54, 22), `rgba(175,235,175,1)`, `rgba(255,255,255,1)`, () => {
				betAmount += 10; 
				let mon = game.players.find((x) => (x.pName == playerName)).money;
				if (betAmount > mon) betAmount = mon;
			}),
			"s10" : new button("-10", "black", col.rect(vec.n(86,54), 54, 22), `rgba(245,185,185,1)`, `rgba(255,255,255,1)`, () => {betAmount -= 10; if (betAmount < 0) betAmount = 0;}),
			"p100" : new button("+100", "black", col.rect(vec.n(32,76), 54, 21), `rgba(185,245,185,1)`, `rgba(255,255,255,1)`, () => {
				betAmount += 100; 
				let mon = game.players.find((x) => (x.pName == playerName)).money;
				if (betAmount > mon) betAmount = mon;
			}),
			"s100" : new button("-100", "black", col.rect(vec.n(86,76), 54, 21), `rgba(235,175,175,1)`, `rgba(255,255,255,1)`, () => {betAmount -= 100; if (betAmount < 0) betAmount = 0;}),
			"m2" : new button("x2", "black", col.rect(vec.n(32,97), 54, 22), `rgba(175,235,175,1)`, `rgba(255,255,255,1)`, () => {
				betAmount *= 2; 
				let mon = game.players.find((x) => (x.pName == playerName)).money;
				if (betAmount > mon) betAmount = mon;
			}),
			"d2" : new button("/2", "black", col.rect(vec.n(86,97), 54, 22), `rgba(245,185,185,1)`, `rgba(255,255,255,1)`, () => {betAmount = Math.round(betAmount/2);if (betAmount < 0) betAmount = 0;}),
			"m10" : new button("x10", "black", col.rect(vec.n(32,119), 54, 22), `rgba(185,245,185,1)`, `rgba(255,255,255,1)`, () => {
				betAmount *= 10; 
				let mon = game.players.find((x) => (x.pName == playerName)).money;
				if (betAmount > mon) betAmount = mon;
			}),
			"d10" : new button("/10", "black", col.rect(vec.n(86,119), 54, 22), `rgba(235,175,175,1)`, `rgba(255,255,255,1)`, () => {betAmount = Math.round(betAmount/10);if (betAmount < 0) betAmount = 0;}),
			"submit" : new button("BET", "black", col.rect(vec.n(500,32), 108, 109), `rgba(235,235,235,1)`, `rgba(255,255,255,1)`, ()=>{
				if (betAmount > 0) sock.send(`a\x1F${playerName}\x1F${roomNo}\x1F${betAmount}`);
			})
		},
		"turn" : {
			"hit" : new button("HIT", "black", col.rect(vec.n(32,32), 108, 109), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fh`);}),
			"stand" : new button("STAND", "black", col.rect(vec.n(500,32), 108, 109), `rgba(245,175,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fs`);})
		},
		"turnsplit" : {
			"hit" : new button("HIT", "black", col.rect(vec.n(32,32), 108, 55), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fh`);}),
			"stand" : new button("STAND", "black", col.rect(vec.n(500,32), 108, 109), `rgba(245,175,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fs`);}),
			"split" : new button("SPLIT", "black", col.rect(vec.n(32,87), 108, 54), `rgba(170,240,170,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fp`);})
		},
		"turndouble" : {
			"hit" : new button("HIT", "black", col.rect(vec.n(32,32), 108, 55), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fh`);}),
			"stand" : new button("STAND", "black", col.rect(vec.n(500,32), 108, 109), `rgba(245,175,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fs`);}),
			"double" : new button("DOUBLE", "black", col.rect(vec.n(32,87), 108, 54), `rgba(170,240,170,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fd`);})
		},
		"turndoublesplit" : {
			"hit" : new button("HIT", "black", col.rect(vec.n(32,32), 108, 37), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fh`);}),
			"stand" : new button("STAND", "black", col.rect(vec.n(500,32), 108, 109), `rgba(245,175,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fs`);}),
			"double" : new button("DOUBLE", "black", col.rect(vec.n(32,69), 108, 36), `rgba(170,240,170,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fd`);}),
			"split" : new button("SPLIT", "black", col.rect(vec.n(32,105), 108, 36), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fp`);})
		}
	}	

	function mainloop(){
		if (sock == null || sock.readyState == WebSocket.CLOSED){
			try{
				return;
			} finally {
				changeScene("selection", null);
			}
		}
		
		sock.send(`r\x1F${roomNo}`);
		
		if (game.currentScene != "blackjack"){
			changeScene(game.currentScene, sock);
		}
		
		let pOffset = 576 / game.players.length;
		ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
		ctx.drawImage(background.imgs.blackjack, 0, 0);
		
		ctx.font = "20px pixel";
		let text = `Round ${game.remRounds} of ${game.maxRounds}`;
		let l = ctx.measureText(text).width;
		l += l%2;
		ctx.fillStyle = "rgba(22,22,29, 0.9)";
		console.log(l);
		ctx.fillRect(318 - 0.5*l,4, l + 4, 28);
		ctx.fillStyle = "white";
		ctx.fillText(text, 320 - 0.5*l, 28);	
		
		for (let i = 0; i < game.players.length; i++){
			let p = game.players[i];
			let curOff = 32 + (pOffset * 0.5) + (pOffset*i);
			ctx.fillStyle = `rgba(255,230,120,0.5)`;
			ctx.beginPath();
			ctx.arc(curOff,312, 32,5*Math.PI/6 , Math.PI/6);
			ctx.fill();
			ctx.drawImage(cows.imgs[p.skin], 0, 1, 16, 15, curOff - 16, 298, 32,30);
			
			text = p.pName + "--$" + p.money.toString();	
			ctx.font = `10px pixel`;
			let pixelLength = ctx.measureText(text).width;
			pixelLength += pixelLength%2;
			ctx.fillStyle = `rgba(0,${255*(p.pName == playerName)},0,0.5)`;
			ctx.fillRect(curOff - (0.5*pixelLength) - 2, 331, 2 + pixelLength, 10);
			ctx.fillStyle = 'white';
			ctx.fillText(text, curOff - (0.5*pixelLength), 340);
			if (p.bet != 0){
				pixelLength = ctx.measureText(`$${p.bet}`).width;
				pixelLength += pixelLength%2;
				ctx.fillText(`$${p.bet}`, curOff - 0.5*pixelLength, 296);
			}
			
			let scale = 2;
			let tempCards = [];
			if (p.cards.length > 7) {
				scale = 1;
			} else {
				for (let i = 0; i < p.cards.length; i++){
					if (p.cards[i].length != 0) tempCards.push(p.cards[i]); 
					if (p.cards[i].length > 6) scale = 1;
				}
			}
			
			for (let k = 0; k < tempCards.length; k++){	
				let hOff = Math.round(curOff - (0.5*tempCards.length * 16 * scale) - scale + k*17*scale)+0.5;
				for (let j = 0; j < tempCards[k].length; j++){
					let vOff = Math.round(152 + ((j+1) * 100/(tempCards[k].length+1)))+0.5;
					if (tempCards[k][j].className != "card") ctx.drawImage(cards.bg, hOff, vOff, 15*scale, 21*scale);
					else if (tempCards[k][j].faceDown === 1) ctx.drawImage(cards.back, hOff, vOff, 15*scale, 21*scale); 
					else {
						ctx.drawImage(cards.bg, hOff, vOff, 15*scale, 21*scale);
						ctx.drawImage(cards.suits[tempCards[k][j].suit], hOff, vOff, 15*scale, 21*scale);
						ctx.drawImage(tempCards[k][j].suit>1?cards.rNo[tempCards[k][j].value]:cards.bNo[tempCards[k][j].value], hOff, vOff, 15*scale, 21*scale);
					}
				}
			}
		}
		
		for (let i = 0; i < game.dealer.cards.length; i++){
			let hOff = 320.5 - 0.5*(18 + 12*game.dealer.cards.length) + (12*i);
			if (game.dealer.cards[i].faceDown == 1) ctx.drawImage(cards.back, hOff, 48.5, 30, 42);
			else {
				ctx.drawImage(cards.bg, hOff, 48.5, 30, 42);
				ctx.drawImage(cards.suits[game.dealer.cards[i].suit], hOff, 48.5, 30, 42);
				ctx.drawImage(game.dealer.cards[i].suit>1?cards.rNo[game.dealer.cards[i].value]:cards.bNo[game.dealer.cards[i].value], hOff, 48.5, 30,42);
			}
		}
		
		if (game.turnOptions == "bjbet"){
			let betText = "$" + betAmount.toString();
			ctx.font = `20px pixel`;
			let pixelLength = ctx.measureText(betText).width;
			pixelLength += pixelLength%2;
			ctx.fillStyle = 'white';
			ctx.fillText(betText, 320 - (0.5*pixelLength), 80);
		}
		
		if (game.currentPlayer == playerName){
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
				buttons = {};
			}
			for (let j in buttons){
				let i = buttons[j];
				if (i.pressed === 1){
					ctx.fillStyle = i.colourPressed;
					} else {
					ctx.fillStyle = i.colour;
				}
				ctx.fillRect(i.col.origin.x, i.col.origin.y, i.col.width, i.col.height);
				ctx.font = "10px pixel";
				ctx.fillStyle = i.textCol;
				let pixelLength = ctx.measureText(i.text).width;
				ctx.fillText(i.text, i.col.origin.x + Math.round(0.5*i.col.width - 0.5*pixelLength), i.col.origin.y + 0.5*i.col.height + 4);			
			}
		}
	}
	
	let cardsPrev = 0;
	function soundloop(){
		let temp = 0;
		for (let i = 0; i < game.players.length; i++){
			for (let j = 0; j < game.players[i].cards.length; j++){
				temp += game.players[i].cards[j].length;
			}
		} temp += game.dealer.cards.length;
		
		if (temp > cardsPrev) audio.clips.card.play();
		cardsPrev = temp;
	}
	
	let pressedButton;
	let mouse = {
		0 : { 
			"d": (e) => {
				let canvR = canv.getBoundingClientRect();
				let x = (e.clientX - canvR.left) / canv.style.width.split("px")[0] * 640 - 1;
				let y = (e.clientY - canvR.top) / canv.style.height.split("px")[0] * 360 - 1;
				console.log("X "+x+"  Y "+y);
				pressedButton = undefined;
				if (game.currentPlayer == playerName) {
					for (let j in buttons){
						let i = buttons[j];
						let distX = x - i.col.origin.x;
						let distY = y - i.col.origin.y;
						if (distX >= 0 && distX <= i.col.width && distY >=0 && distY <= i.col.height){
							pressedButton = i;
							console.log(i.text + " pressed");
					}} if (pressedButton != undefined){
						pressedButton.pressed = 1; pressedButton.func();
					}
				}},
			"u" : (e) => {
				if (pressedButton != undefined){
					console.log(pressedButton.text + " released");
					pressedButton.pressed = 0;
				}
			}
		}
	}
	
	function mousedown(e){
		if (e.button in mouse) mouse[e.button].d(e)
	}	
	function mouseup(e){
		if (e.button in mouse) mouse[e.button].u(e);
	}
	
	let keys = {
		"e" : () => {
			console.log("change to lobby");
			sock.send(`c\x1F${roomNo}\x1Flobby`);
		},
	};
	
	function keydown(e){
		if (e.code === "KeyE") keys.e();
	}
	function keyup(e){
		
	}
	
	window.addEventListener('mouseup', mouseup);
	window.addEventListener('mousedown', mousedown);
	window.addEventListener('keydown', keydown);
	window.addEventListener('keyup', keyup);
	mlId = setInterval(mainloop, 25);
	slId = setInterval(soundloop, 25);
	
	function unloadLocal(){
		audio.clips.jazz.pause();
		storage.appendChild(canv);
		window.removeEventListener('mouseup', mouseup);
		window.removeEventListener('mousedown', mousedown);
		window.removeEventListener('keydown', keydown);
		window.removeEventListener('keyup', keyup);
		clearInterval(mlId);
		clearInterval(slId);
	}
	
	audio.clips.jazz.play();
	return unloadLocal
}
scene.blackjack = blackjackScene;
