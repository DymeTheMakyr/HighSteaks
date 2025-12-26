//init display variables
let sw = window.innerWidth - 1;
let sh = window.innerHeight - 1;
let factor = [16, 9];
let charScaleFact = 2;
sw = sw / factor[0] < sh / factor[1] ? sw : (sh / factor[1]) * factor[0];
sh = sw / factor[0] > sh / factor[1] ? sh : (sw / factor[0]) * factor[1];

// DISABLE CONTExT MENU
document.addEventListener("contextmenu", event => event.preventDefault());

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
		unload();
		let close = 0;
		if (targetScene == "selection") {container.appendChild(document.getElementById("selectionScene")); close = 1;}
		else container.appendChild(canv);
		unload = scene[targetScene](sock, ...args);
		if (close == 1) sock.close();
	} else {
		throw new Error("targetScene not found, is it in scene object?");
	}
}

async function drawAngleImage(image, x, y, angle, w, h){
	w = w ?? image.width;
	h = h ?? image.height;
	ctx.translate(x, y);
	ctx.rotate(angle * 2 * Math.PI);
	ctx.drawImage(image,-0.5*w,-0.5*h,w,h);
	ctx.rotate(-angle * 2 * Math.PI);
	ctx.translate(-x, -y);
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

let normalAngle = 0;

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
		background.imgs.generic = loadImg("./background/generic.png");
		background.imgs.roulette = loadImg("./background/roulette.png");
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

let time = 0;
let drunkFactor = 0;
let localDrunkFactor = 0;
let sober = true;
async function drunk(){
	if (time > 8){
		time = 0;
	}
	
	if (localDrunkFactor+0.1 < drunkFactor && time%1 == 0){
		localDrunkFactor = drunkFactor;
	} else if (localDrunkFactor > drunkFactor + 0.1){
		localDrunkFactor -= 0.01;
	}
	localDrunkFactor = Math.min(localDrunkFactor, 7);
	
	if (localDrunkFactor > 0.1){
		sober = false;
		canv.style.animation = `drunk ${32 * (0.5**Math.round(Math.min(4, localDrunkFactor)))}s infinite`;
	} else if (localDrunkFactor < 0.1){
		localDrunkFactor = 0;
		time = 0;
		canv.style.animation = "";
		ctx.resetTransform();
		sober = true;
	}
	
	if (sober == false){
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

async function soberTimer(){
	console.log(drunkFactor, localDrunkFactor);
	await new Promise(r => setTimeout(r, 30000));
	console.log(drunkFactor, "sobering");
	drunkFactor -= 1;
}

setInterval(drunk, 25);

// Game Scene
function lobbyScene(sock) {
	
	
	//key functions
	function resize() {
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
		"ba" : () => {if (localDrunkFactor >= drunkFactor) {drunkFactor += 1; audio.clips.bar.play(); soberTimer();}},
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
			}}
		}
	}
	
	//Movement variables
	const baseSpeed = 4
	const sprintFact = 0.5
	let x = 50;
	let y = 50;
	
	let pixelLength = 0;

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
		
		
		for (let j = 0; j < drawQueue.length; j++){
			const i = drawQueue[j];
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
				ctx.font = `28px pixel`;
				let text = `${votes[c.funcKey]}/${Math.max(2,Object.keys(game.players).length)}`;
				pixelLength = Math.round(0.5*ctx.measureText(text).width);
				ctx.fillStyle = `rgba(0,0,0,0.5)`;
				ctx.fillRect(c.col.origin.x + (0.5*c.col.width) - pixelLength - 4, c.col.origin.y + c.renderOffset.y - 4, 2*pixelLength + 4, -33);
				ctx.fillStyle = `rgba(255,255,255,1)`;
				ctx.fillText(text, c.col.origin.x + (0.5*c.col.width) - pixelLength, c.col.origin.y + c.renderOffset.y-8);
			}
		}
		
		//ctx.fillStyle = "rgba(255,255,255,0.3)";
		if (currentInteractable != null) {
			let c = currentInteractable;
			ctx.font = `7px pixel`;
			pixelLength = ctx.measureText(c.text).width;
			ctx.fillStyle = `rgba(0,0,0,0.8)`;
			ctx.fillRect(c.col.origin.x + Math.round((0.5*c.col.width) - 0.5*pixelLength) - 2, c.col.origin.y + c.renderOffset.y - 2, pixelLength + 4, 13);
			ctx.fillStyle = `white`;
			ctx.fillText(c.text, c.col.origin.x + Math.round((0.5*c.col.width) - 0.5*pixelLength), c.col.origin.y + c.renderOffset.y + 9);
		}
		
		
		for (let i = 0; i < game.players.length; i++){ //draw player names
			ctx.font = `7px pixel`;
			pixelLength = ctx.measureText(game.players[i].pName).width;
			pixelLength += pixelLength%2;
			ctx.fillStyle = `rgba(0,${(game.players[i].pName == playerName)*200},0,0.5)`;
			ctx.fillRect(game.players[i].col.origin.x + (7 - 0.5*pixelLength), game.players[i].col.origin.y - 2, 2 + pixelLength, -10);
			ctx.fillStyle = `rgba(255,255,255,1)`;
			ctx.fillText(game.players[i].pName, game.players[i].col.origin.x + (8 - 0.5*pixelLength),game.players[i].col.origin.y - 4);
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
	let mlId = setInterval(mainloop, 25);
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
	let ip = document.getElementById("ip");
	let sel = document.getElementById("skin");
	let img = document.getElementById("char");
	sel.onchange = () => {img.src = cows.strings[sel.value]}
	function update(){
		let rCo = container.children[0].children[10].value;
		if (rCo[0] == "-") container.children[0].children[10].value = rCo.slice(1);
		if (rCo[0] == 0) container.children[0].children[10].value = 1;
		if (rCo > 50) container.children[0].children[10].value = 50;
	}
	let uId;
	function unloadLocal(){
		clearInterval(uId);
		storage.appendChild(container.children[0]);
	}
	function chooseAddr(priv){
		if (priv === 1){
			return ip.value.length>0?("wss://"+ip.value):"wss://localhost:8000";
		} else {
			return ip.value.length>0?("ws://"+ip.value):"ws://localhost:8000";
		}
	}
	function hostRoom(){
		let nam = container.children[0].children[6].value;
		let rId = container.children[0].children[8].value;
		let rCo = container.children[0].children[10].value;
		let skn = container.children[0].children[12].value;
		if (nam.length = 0) {alert("Input Name"); return 0;}
		if (nam.includes("\x1F")) {alert("Forbidden character '\x1F' in name"); return 0;}
		if (rId.length != 4) {alert("Room ID needs 4 characters"); return 0;}
		if (skn == 8) {alert("Select Skin"); return 0;}
		try {
			sock = new WebSocket(chooseAddr(0));
		} catch {
			sock = new WebSocket(choosAddr(1))
		}
		sock.onopen = () => {sock.send(`h\x1F${nam}\x1F${rId}\x1F${skn}\x1F${rCo}`);};
		sock.onmessage = (message) => {if (message.data.toString() == -1){alert("Room Not Available");sock.close();return 0;} 
		else {
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
		}};
	}
	function joinRoom(){
		let nam = container.children[0].children[5].value;
		let rId = container.children[0].children[7].value;
		let skn = container.children[0].children[11].value;
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
		sock.onopen = () => {sock.send(`j\x1F${nam}\x1F${rId}\x1F${skn}`);};
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
	img.src = cows.strings[sel.value];
	
	return unloadLocal;
}
scene.selection = selectionScene;
unload = selectionScene();
function blackjackScene(sock){
	let betAmount = 0;
	let buttons = {};	
	let rounds = {
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
			"m2" : new button("x2", "black", col.rect(vec.n(36,90), 46, 14), `rgba(175,235,175,1)`, `rgba(255,255,255,1)`, () => {
				betAmount *= 2; 
				let mon = game.players.find((x) => (x.pName == playerName)).money;
				if (betAmount > mon) betAmount = mon;
			}),
			"d2" : new button("/2", "black", col.rect(vec.n(86,90), 46, 14), `rgba(245,185,185,1)`, `rgba(255,255,255,1)`, () => {betAmount = Math.round(betAmount/2);if (betAmount < 0) betAmount = 0;}),
			"m10" : new button("x10", "black", col.rect(vec.n(36,108), 46, 14), `rgba(185,245,185,1)`, `rgba(255,255,255,1)`, () => {
				betAmount *= 10; 
				let mon = game.players.find((x) => (x.pName == playerName)).money;
				if (betAmount > mon) betAmount = mon;
			}),
			"d10" : new button("/10", "black", col.rect(vec.n(86,108), 46, 14), `rgba(235,175,175,1)`, `rgba(255,255,255,1)`, () => {betAmount = Math.round(betAmount/10);if (betAmount < 0) betAmount = 0;}),
			"submit" : new button("BET", "black", col.rect(vec.n(508,36), 96, 86), `rgba(235,235,235,1)`, `rgba(255,255,255,1)`, ()=>{
				sock.send(`a\x1F${playerName}\x1F${roomNo}\x1F${Math.min(betAmount, game.players.find((x) => (x.pName == playerName)).money)}`);
			})
		},
		"turn" : {
			"hit" : new button("HIT", "black", col.rect(vec.n(36,36), 96, 83), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fh`);}),
			"stand" : new button("STAND", "black", col.rect(vec.n(508,36), 96, 83), `rgba(245,175,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fs`);})
		},
		"turnsplit" : {
			"hit" : new button("HIT", "black", col.rect(vec.n(36,36), 96, 38), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fh`);}),
			"stand" : new button("STAND", "black", col.rect(vec.n(508,36), 96, 83), `rgba(245,175,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fs`);}),
			"split" : new button("SPLIT", "black", col.rect(vec.n(36,81), 96, 38), `rgba(170,240,170,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fp`);})
		},
		"turndouble" : {
			"hit" : new button("HIT", "black", col.rect(vec.n(36,36), 96, 38), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fh`);}),
			"stand" : new button("STAND", "black", col.rect(vec.n(508,36), 96, 83), `rgba(245,175,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fs`);}),
			"double" : new button("DOUBLE", "black", col.rect(vec.n(36,81), 96, 38), `rgba(170,240,170,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fd`);})
		},
		"turndoublesplit" : {
			"hit" : new button("HIT", "black", col.rect(vec.n(36,36), 96, 25), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fh`);}),
			"stand" : new button("STAND", "black", col.rect(vec.n(508,36), 96, 83), `rgba(245,175,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fs`);}),
			"double" : new button("DOUBLE", "black", col.rect(vec.n(36,65), 96, 25), `rgba(170,240,170,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fd`);}),
			"split" : new button("SPLIT", "black", col.rect(vec.n(36,94), 96, 25), `rgba(175,245,175,1)`, `white`, () => {sock.send(`a\x1F${playerName}\x1F${roomNo}\x1Fp`);})
		}
	}	

	let pixelLength = 0;	
	
	function mainloop(){
		pixelLength = 0;
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
		
		ctx.font = "21px pixel";
		let text = `Round ${game.remRounds} of ${game.maxRounds}`;
		let l = ctx.measureText(text).width;
		l = Math.round(0.5*l);
		ctx.fillStyle = "rgba(22,22,29, 0.9)";
		ctx.fillRect(318 - l,4, 2*l + 4, 28);
		ctx.fillStyle = "white";
		ctx.fillText(text, 320 - l, 28);	
		
		for (let i = 0; i < game.players.length; i++){
			let p = game.players[i];
			let curOff = 32 + (pOffset * 0.5) + (pOffset*i);
			ctx.fillStyle = `rgba(255,230,120,0.5)`;
			ctx.beginPath();
			ctx.arc(curOff,312, 32,5*Math.PI/6 , Math.PI/6);
			ctx.fill();
			ctx.drawImage(cows.imgs[p.skin], 0, 1, 16, 15, curOff - 16, 298, 32,30);
			
			text = p.pName + "--$" + p.money.toString();	
			ctx.font = `7px pixel`;
			pixelLength = ctx.measureText(text).width;
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
			if (game.players[i].cards.length > 4) scale = 1;
			else {
				for (let k = 0; k < game.players[i].cards.length; k++){
					if (game.players[i].cards[k].length > 6) scale = 1;
				}
			}
			let tempCards = game.players[i].cards;
			for (let k = 0; k < tempCards.length; k++){	
				let hOff = Math.round(curOff - (0.5*tempCards.length * 16 * scale) + k*17*scale)+0.5;
				if (game.currentPlayer == game.players[i].pName && game.players[i].currentHand == k){
					ctx.fillStyle = "rgba(0,255,0,1)";
					ctx.beginPath();
					ctx.moveTo(hOff + 0.5*16*scale-8, 146.5);
					ctx.lineTo(hOff + 0.5*16*scale, 154.5);
					ctx.lineTo(hOff + 0.5*16*scale+8, 146.5);
					ctx.fill();
				}
				
				let sum = 0;
				let aces = 0;
				for (let j = 0; j < tempCards[k].length; j++){
					let vOff = Math.round(152 + ((j+1) * 100/(tempCards[k].length+1)))+0.5;
					if (tempCards[k][j].className != "card") ctx.drawImage(cards.bg, hOff, vOff, 15*scale, 21*scale);
					else if (tempCards[k][j].faceDown === 1) ctx.drawImage(cards.back, hOff, vOff, 15*scale, 21*scale); 
					else {
						if (tempCards[k][j].value == 12) aces += 1;
						else sum += Math.min(10, tempCards[k][j].value + 2);
						ctx.drawImage(cards.bg, hOff, vOff, 15*scale, 21*scale);
						ctx.drawImage(cards.suits[tempCards[k][j].suit], hOff, vOff, 15*scale, 21*scale);
						ctx.drawImage(tempCards[k][j].suit>1?cards.rNo[tempCards[k][j].value]:cards.bNo[tempCards[k][j].value], hOff, vOff, 15*scale, 21*scale);
					}
				}
				for (let l = 0; l < aces; l++){
					if (sum + 11 < 22) sum += 11;
					else sum += 1;
				}
				if (sum > 0) {
					ctx.font = scale==2?"14px pixel":"7px pixel";
					ctx.fillStyle = "white";
					pixelLength = 0.5*ctx.measureText(sum).width;
					ctx.fillText(sum, Math.round(hOff+0.5*17*scale - pixelLength), 136);
				}
			}
		}
		
		
		let dSum = 0;
		let dAce = 0;
		for (let i = 0; i < game.dealer.cards.length; i++){
			let hOff = 320.5 - 0.5*(18 + 12*game.dealer.cards.length) + (12*i);
			if (game.dealer.cards[i].faceDown == 1) ctx.drawImage(cards.back, hOff, 64.5, 30, 42);
			else {
				if (game.dealer.cards[i].value == 12) dAce += 1;
				else dSum += Math.min(10, game.dealer.cards[i].value+2);
				ctx.drawImage(cards.bg, hOff, 64.5, 30, 42);
				ctx.drawImage(cards.suits[game.dealer.cards[i].suit], hOff, 64.5, 30, 42);
				ctx.drawImage(game.dealer.cards[i].suit>1?cards.rNo[game.dealer.cards[i].value]:cards.bNo[game.dealer.cards[i].value], hOff, 64.5, 30,42);
			}
						
		}
		
		if (game.dealer.cards.length > 0) {
			for (let i = 0; i < dAce; i++){
				if (dSum + 11 < 22) dSum += 10;
				dSum += 1;
			}
			
			ctx.font = `14px`;
			ctx.fillStyle = "white";
			pixelLength = Math.round(0.5*ctx.measureText(dSum).width);
			ctx.fillText(dSum, 320 - pixelLength, 56);
		}
		
		if (game.turnOptions == "bjbet" && game.currentPlayer == playerName){
			let betText = "$" + betAmount.toString();
			ctx.font = `21px pixel`;
			pixelLength = ctx.measureText(betText).width;
			pixelLength += pixelLength%2;
			ctx.fillStyle = 'white';
			ctx.fillText(betText, 320 - (0.5*pixelLength), 92);
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
				ctx.font = `7px pixel`;
				ctx.fillStyle = i.textCol;
				pixelLength = ctx.measureText(i.text).width;
				pixelLength += pixelLength%2;
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
					}} if (pressedButton != undefined){
						pressedButton.pressed = 1; pressedButton.func();
					}
				}},
			"u" : (e) => {
				if (pressedButton != undefined){
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
	let mlId = setInterval(mainloop, 25);
	let slId = setInterval(soundloop, 25);
	
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

function rouletteScene(sock){
	let mX = -100;
	let mY = -100;

	const values = [
		[0,3,6,9,12,15,18,21,24,27,30,33,36],
		[0,2,5,8,11,14,17,20,23,26,29,32,35],
		[0,1,4,7,10,13,16,19,22,25,28,31,34]
	];

	function mainloop(){
		if (sock == null || sock.readyState == WebSocket.CLOSED){
			try{
				return;
			} finally {
				changeScene("selection", null);
			}
		}
		
		sock.send(`r\x1F${roomNo}`);
		
		if (game.currentScene != "roulette"){
			changeScene(game.currentScene, sock);
		}
		
		let pOffset = 576 / game.players.length;
		ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
		ctx.drawImage(background.imgs.generic, 0, 0);
		
		ctx.font = "21px pixel";
		let text = `Round ${game.remRounds} of ${game.maxRounds}`;
		let l = ctx.measureText(text).width;
		l = Math.round(0.5*l);
		ctx.fillStyle = "rgba(22,22,29, 0.9)";
		ctx.fillRect(318 - l,4, 2*l + 4, 28);
		ctx.fillStyle = "white";
		ctx.fillText(text, 320 - l, 28);	
		
		ctx.fillStyle = "black";
		let width = 36*14;
		let heigh = 32*5;
		ctx.fillRect(320 - 0.5*(width), 96, width, heigh);
		ctx.fillStyle = "red"
		for (let i=0; i < 5*7; i++){
			ctx.fillRect(68 + ((i%7 + 0.5*(Math.floor(i/7)%2)) * 72),96 + Math.floor(i/7)*32, 36, 32);
		}
		
		for (let i = 0; i < game.players.length; i++){
			let p = game.players[i];
			let curOff = 32 + (pOffset * 0.5) + (pOffset*i);
			ctx.fillStyle = `rgba(255,230,120,0.5)`;
			ctx.beginPath();
			ctx.arc(curOff,312, 32,5*Math.PI/6 , Math.PI/6);
			ctx.fill();
			ctx.drawImage(cows.imgs[p.skin], 0, 1, 16, 15, curOff - 16, 298, 32,30);
			
			text = p.pName + "--$" + p.money.toString();	
			ctx.font = `7px pixel`;
			pixelLength = ctx.measureText(text).width;
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
		}
		
		let tX = mX-86;
		let tY = mY-112;
		tX = Math.round(tX/18)*0.5;
		tY = Math.round(tY/16)*0.5;
		if (-1 < tX && tX < 13 && -1 < tY && tY < 3){	
			tX = Math.max(0, Math.min(12, tX));
			tY = Math.max(0, Math.min(2, tY));
			ctx.fillStyle="white";
			ctx.fillRect(86-9 +36*(tX), 112-8 +32*(tY), 18, 16);
		}
		//if tX is n + 0.5, do try tX ± 0.5 to get numbers.
		//if tY is n + 0.5, do try tY ± 0.5 to get number. bet type decided by length and contents against dictionary . combine try x and try y and eliminate duplicates. 
	}
	
	let keys = {
		"e" : () => {
			sock.send(`c\x1F${roomNo}\x1Flobby`);
		},
	};
	
	function keydown(e){
		if (e.code === "KeyE") keys.e();
	}
	function keyup(e){
		
	}
	
	function mousemove(e){
		let canvR = canv.getBoundingClientRect();
		let x = Math.round((e.clientX - canvR.left) / canv.style.width.slice(0,-2) * 640)-1;
		let y = Math.round((e.clientY - canvR.top) / canv.style.height.slice(0,-2) * 360)-1;
		mX = x;
		mY = y;	
	}
	
	window.addEventListener("keyup", keyup);
	window.addEventListener("keydown", keydown);
	window.addEventListener("mousemove", mousemove);
	let mlId = setInterval(mainloop, 25);
	
	function unbindLocal(){
		audio.clips.jazz.pause(0);
		storage.appendChild(canv);
		window.removeEventListener("keyup", keyup);
		window.removeEventListener("keydown", keydown);	
		window.removeEventListener("mousemove", mousemove);
		clearInterval(mlId);
	}
	
	audio.clips.jazz.play();
	return unbindLocal;
}
scene.roulette = rouletteScene;
