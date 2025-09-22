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

// ease of use variables
let roomNo;
let playerName;
let skin;
let flip = 0;

// Collision function
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
	} else if (b.type == "r" && b.solid){
		let aCntr = vec.avg(a.origin, ...a.points);
		let bCntr = vec.avg(b.origin, ...b.points);
		let tWidth = (a.width+b.width)/2;
		let tHeight = (a.height+b.height)/2;
		let xDist = Math.abs(aCntr.x - bCntr.x);
		let yDist = Math.abs(aCntr.y - bCntr.y);
		
		if (xDist < tWidth && yDist < tHeight){
			return vec.n((bCntr.x<aCntr.x?1:-1)*(tWidth - xDist), (bCntr.y<aCntr.y?1:-1)*(tHeight - yDist));
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

// img load helper function
function loadImg(path){
		let temp = new Image();
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
	static imgs = [];
	
	static {
		background.imgs.push(loadImg("./background/floor2.png"));
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
	//Key Manager;
	let keys = {
		"w" : 0,
		"a" : 0,
		"s" : 0,
		"d" : 0,
		"shift" : 0
	}
	
	//Movement variables
	const baseSpeed = 1
	const sprintFact = 1
	let x = 50;
	let y = 50;

	function mainloop() {
		
		if (sock.readyState === WebSocket.CLOSED){
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
		let draw = game.players.sort((a,b) => a.col.origin.y - b.col.origin.y);
		//Clear And Draw
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		ctx.drawImage(background.imgs[0],0,0,640,360)
		for (let i = 0; i < game.players.length; i++){
			ctx.fillStyle = `rgba(10,10,10,0.5)`
			ctx.fillRect(game.players[i].col.origin.x - charScaleFact, game.players[i].col.origin.y + 13*charScaleFact, 10*charScaleFact, 3*charScaleFact)
			ctx.fillStyle = `rgba(0,${(game.players[i].pName == playerName)*200},0,0.5)`;
			ctx.fillRect(game.players[i].col.origin.x + (3.5*charScaleFact - 1.5*charScaleFact*game.players[i].pName.length), game.players[i].col.origin.y - 0.5*charScaleFact, charScaleFact + 3*charScaleFact*game.players[i].pName.length, -5*charScaleFact);
			ctx.font = `${charScaleFact*5}px Courier New`;
			ctx.fillStyle = "rgba(255,255,255,1)";
			ctx.fillText(game.players[i].pName, game.players[i].col.origin.x + (4*charScaleFact - 1.5*charScaleFact*game.players[i].pName.length),game.players[i].col.origin.y - charScaleFact);
			let pFlip = parseInt(game.players[i].flipped);
			if (pFlip){
				ctx.drawImage(cows.fimgs[game.players[i].skin], 0, 0, 16, 16, game.players[i].col.origin.x - 4*charScaleFact, game.players[i].col.origin.y - charScaleFact, 16*charScaleFact, 16*charScaleFact);			
			} else {
				ctx.drawImage(cows.imgs[game.players[i].skin], 0, 0, 16, 16, game.players[i].col.origin.x - 4*charScaleFact, game.players[i].col.origin.y - charScaleFact, 16*charScaleFact, 16*charScaleFact)
			}
		}
		for (let i = 0; i < game.colliders.length; i++){
			if (game.colliders[i].type == "l"){
				let c = game.colliders[i];
				ctx.lineWidth = c.thickness*2;
				ctx.strokeStyle = 'black';
				ctx.beginPath();
				ctx.moveTo(c.origin.x, c.origin.y);
				ctx.lineTo(c.origin.x + c.points[1].x, c.origin.y + c.points[1].y);
				ctx.stroke();
			} else if (game.colliders[i].type == "c"){
				let c = game.colliders[i];
				ctx.fillStyle = 'red';
				ctx.beginPath();
				ctx.arc(c.origin.x, c.origin.y, c.radius, 0, 2*Math.PI);
				ctx.fill();
			} else if (game.colliders[i].type == "r"){
				let c = game.colliders[i]; 
				ctx.fillStyle = 'blue';
				ctx.fillRect(c.origin.x, c.origin.y, c.width, c.height);
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
	mlId = setInterval(mainloop, 10);
//	gsId = setInterval(mainloop, 10);
	
	function unbindLocal() {
		window.removeEventListener('keydown', keydown);
		window.removeEventListener('keyup', keyup);
		window.removeEventListener('resize', resize);
		clearInterval(mlId);
//		clearInterval(gsId);
	}
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
