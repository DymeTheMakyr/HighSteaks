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
let unbind;
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
		unbind();
		for (let i = 0; i < container.children.length; i++){
			container.children[0].remove();
		}	
		unbind = scene[targetScene](sock, ...args);
	} else {
		throw new Error("targetScene not found, is it in scene object?");
	}
}

// card manager
class cards {
	static rNo = [];
	static bNo = [];
	static suits = [];
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
		cards.bg = loadImg("cards\\030.png");
	}
}

///// DELETE LATER
let drawQueue = [];
let currentInteractable = undefined;
let votes;

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
		audio.clips.jazz = loadAudio("./audio/jazz.mp3");
		audio.clips.jazz.loop = true;
	}
}

// Game Scene
function lobbyScene(sock) {
	let players = [];
	let projectiles = [];
	//Populate and initialise index.html
	const canv = document.createElement('canvas'); //create canvas
	canv.width = '640'; //internal width
	canv.height = '360'; //internal height
	canv.style.width = sw.toString() + 'px'; //external width
	canv.style.height = sh.toString() + 'px'; //external height
	canv.style.border = 'solid 1px blue'; //border
	container.appendChild(canv); //add to container
	const ctx = canv.getContext('2d'); //grab context
	ctx.imageSmoothingEnabled = false;

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
	let vel = {
		"x" : 0,
		"y" : 0
	}
	//collider class
	class col {
		origin = vec.n(0,0);
		points = [];
		type = "r";
		constructor(t, o, ...p){
			this.origin = o;
			this.type = t;
			this.points = p;
		}
	}
	//player class
	class player {
		col = new col("r", vec.n(50,50), [vec.n(0,0),vec.n(0,0),vec.n(0,0),vec.n(0,0)]);
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
	//projetile class
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
	
	let interactFuncs = {
		"sl" : () => {alert("spin slots");},
		"ba" : () => {alert("get drink");}
	}
	
	function interactFunc(key){
		if (key in interactFuncs) interactFuncs[key]();
		else if (key in votes) sock.send(`v\x1F${roomNo}\x1F${playerName}\x1F${key}`);
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
				if (playerName in game.votes && game.votes[playerName] != currentInteractable.funcKey) audio.clips.sel.play();
				else audio.clips.desel.play();
				interactFunc(currentInteractable.funcKey);
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
				if (i.flipped == true) ctx.drawImage(cows.fimgs[i.skin], 0, 0, 16, 16, i.col.origin.x - 4*charScaleFact, i.col.origin.y - charScaleFact, 16*charScaleFact, 16*charScaleFact);
				else ctx.drawImage(cows.imgs[i.skin], 0, 0, 16, 16, i.col.origin.x - 4*charScaleFact, i.col.origin.y - charScaleFact, 16*charScaleFact, 16*charScaleFact);
			} else if (i.className == "interactable"){
				//ctx.fillStyle="rgba(255,255,255,0.4)";
				//ctx.fillRect(i.col.origin.x, i.col.origin.y, i.col.width, i.col.height);
				if (sprites.imgs[i.spritename] != null) ctx.drawImage(sprites.imgs[i.spritename], i.col.origin.x + i.renderOffset.x, i.col.origin.y + i.renderOffset.y);
			}
		}
		
		votes = {
			"bj"  : 0,
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
			let spaceCount = c.text.split("\x20").length - 1;
			let pixelLength = c.text.length * 6 - 4*spaceCount-2;
			ctx.fillStyle = `rgba(0,0,0,0.8)`;
			ctx.fillRect(c.col.origin.x + (0.5*c.col.width) - 0.5*pixelLength - 2, c.col.origin.y + c.renderOffset.y - 2, pixelLength + 4, 13);
			ctx.font = `10px pixel`;
			ctx.fillStyle = `white`;
			ctx.fillText(c.text, c.col.origin.x + (0.5*c.col.width) - 0.5*pixelLength, c.col.origin.y + c.renderOffset.y + 9);
		}
		
		
		for (let i = 0; i < game.players.length; i++){ //draw player names
			let spaceCount = game.players[i].pName.split("\x20").length - 1;
			let pixelLength = Math.round(game.players[i].pName.length * 6 - 3.5*spaceCount - 1);
			pixelLength += pixelLength%2;
			ctx.fillStyle = `rgba(0,${(game.players[i].pName == playerName)*200},0,0.5)`;
			ctx.fillRect(game.players[i].col.origin.x + (8 - 0.5*pixelLength) - 2, game.players[i].col.origin.y - 1, 2 + pixelLength, -10);
			ctx.font = `10px pixel`;
			ctx.fillStyle = "rgba(255,255,255,1)";
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
	
	function unbindLocal() {
		audio.clips.jazz.pause();
		audio.clips.jazz.currentTime = 0;
		window.removeEventListener('keydown', keydown);
		window.removeEventListener('keyup', keyup);
		window.removeEventListener('resize', resize);
		clearInterval(mlId);
//		clearInterval(gsId);
	}
	audio.clips.jazz.play();
	return unbindLocal;
}
scene.lobby = lobbyScene;

function selectionScene(sock){
	let storage = document.getElementById("selectionScene");
	let ipToggle = document.getElementById("ipToggle");
	let ip = document.getElementById("ip");
	let sel = document.getElementById("skin");
	let img = document.getElementById("char");
	ip.style.display = "none";
	ipToggle.onchange = () => {ip.style.display = ipToggle.checked?"block":"none";};
	sel.onchange = () => {img.src = cows.strings[sel.value]}
	img.src = cows.strings[sel.value];
	function unbindLocal(){
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
		let skn = container.children[0].children[9].value;
		if (nam.length = 0) {alert("Input Name"); return 0;}
		if (nam.includes("\x1F")) {alert("Forbidden character '\x1F' in name"); return 0;}
		if (rId.length != 4) {alert("Room ID needs 4 characters"); return 0;}
		if (skn == 8) {alert("Select Skin"); return 0;}
		try {
			sock = new WebSocket(chooseAddr(0));
		} catch {
			sock = new WebSocket(choosAddr(1))
		}
		sock.onopen = () => {console.log(`h\x1F${nam}\x1F${rId}\x1F${skn}`);sock.send(`h\x1F${nam}\x1F${rId}\x1F${skn}`)};
		sock.onmessage = (message) => {if (message.data.toString() == -1){alert("Room Not Available");sock.close();return 0;} 
		else {
			game=JSON.parse(message.data);
			playerName = nam;
			roomNo = rId;
			console.log("room made");
			sock.onmessage = (message) => {
				temp = JSON.parse(message.data);
				temp.players.forEach((x) => {x.col.origin.x = parseInt(x.col.origin.x); x.col.origin.y = parseInt(x.col.origin.y)});
				game = temp;
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
			else if (message.data == -3){alert("This Room Is Full");sock.close();return 0;}else {console.log(message.data); 
			game = JSON.parse(message.data);
			playerName = nam;
			roomNo = rId;
			sock.onmessage = (message) => {
				temp = JSON.parse(message.data);
				temp.players.forEach((x) => {x.col.origin.x = parseInt(x.col.origin.x); x.col.origin.y = parseInt(x.col.origin.y)});
				game = temp;
			}
			changeScene("lobby", sock);
		};}
	}	
	container.appendChild(document.getElementById("selectionScene").children[0]);
	document.getElementById("host").onclick = hostRoom;
	document.getElementById("join").onclick = joinRoom;
	
	return unbindLocal;
}
scene.selection = selectionScene;

unbind = selectionScene();
