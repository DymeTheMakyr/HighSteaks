//init display variables
let sw = window.innerWidth - 1;
let sh = window.innerHeight - 1;
let factor = [16, 9];
let charScaleFact = 4;
console.log([sw, sh]);
sw = sw / factor[0] < sh / factor[1] ? sw : (sh / factor[1]) * factor[0];
sh = sw / factor[0] > sh / factor[1] ? sh : (sw / factor[0]) * factor[1];
console.log([sw, sh]);

const container = document.getElementById('container');
let unbind;
const scene = {};
let game = 0;

// ease of use variables
let sock;
let roomNo;
let playerName;
let skin;
let flip = 0;

// img load helper function
function loadImg(path){
		let temp = new Image();
		temp.src = path;
		return temp;
}

// scene change function
function changeScene(targetScene, ...args){
	if (targetScene in scene){
		unbind();
		for (let i = 0; i < container.children.length; i++){
			container.children[0].remove();
		}	
		unbind = scene[targetScene](...args);
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

// Game Scene
function lobbyScene(id, roomId, skin) {
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
	//player class
	class player {
		pos = [0,0];
		flipped = false;
		item = "gun";
		skin = "hereford";
		health = 100;
		money = 0;
		cards = [[0,0],[3,12]];
		constructor(po, it, sk, he, mo, ca){
			this.pos = po;
			this.item = it;
			this.skin = sk;
			this.health = he;
			this.money = mo;
			this.cards = ca;
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
	let x = 0;
	let y = 0;

	function mainloop() {
		
		//Update Velocity
		vel.x = baseSpeed * (keys.a ^ keys.d) * (keys.a ? -1 : 1) * (keys.shift * sprintFact + 1);
		vel.y = baseSpeed * (keys.w ^ keys.s) * (keys.w ? -1 : 1) * (keys.shift * sprintFact + 1);
		//Update Position
		if (((0 < x) & keys.a) | ((x < ctx.canvas.width - 8*charScaleFact) & keys.d)) x += vel.x;
		if (((0 < y) & keys.w) | ((y < ctx.canvas.height - 15*charScaleFact) & keys.s)) y += vel.y;
		
		if (vel.x != 0) flip = 1 * (vel.x < 0);
		
		//Send To Serve
		sock.send(`m|${roomNo}|${playerName}|${x}|${y}|${flip}`);
		
		//prepare draww order;
		let draw = game.players.sort((a,b) => a.pos[1] - b.pos[1]);
		//Clear And Draw
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		for (let i = 0; i < game.players.length; i++){
			let pFlip = parseInt(game.players[i].flipped);
			if (pFlip){
				ctx.drawImage(cows.fimgs[game.players[i].skin], 0, 0, 16, 16, game.players[i].pos[0] - 4*charScaleFact, game.players[i].pos[1] - charScaleFact, 16*charScaleFact, 16*charScaleFact);			
			} else {
				ctx.drawImage(cows.imgs[game.players[i].skin], 0, 0, 16, 16, game.players[i].pos[0] - 4*charScaleFact, game.players[i].pos[1] - charScaleFact, 16*charScaleFact, 16*charScaleFact)
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
	gsId = setInterval(mainloop, 10);
	
	function unbindLocal() {
		window.removeEventListener('keydown', keydown);
		window.removeEventListener('keyup', keyup);
		window.removeEventListener('resize', resize);
		clearInterval(mlId);
		clearInterval(gsId);
	}
	return unbindLocal;
}
scene.lobby = lobbyScene;

function selectionScene(){
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
	function chooseAddr(){
		console.log(ip.value);
		return ipToggle.checked?("ws://"+ip.value):"ws://localhost:8000";
	}
	function hostRoom(){
		console.log("host");
		let nam = container.children[0].children[5].value;
		let rId = container.children[0].children[7].value;
		let skn = container.children[0].children[9].value;
		if (rId.length != 4) {alert("Room ID needs 4 characters"); return 0;}
		if (skn < 0) {alert("Select Skin"); return 0;}
		sock = new WebSocket(chooseAddr());
		sock.onopen = () => {console.log(`h|${nam}|${rId}|${skn}`[0]);sock.send(`h|${nam}|${rId}|${skn}`)};
		sock.onmessage = (message) => {if (message.data.toString() == -1){alert("Room Not Available");return 0;} 
		else {
			game=JSON.parse(message.data);
			playerName = nam;
			roomNo = rId;
			console.log("room made");
			sock.onmessage = (message) => {
				game = JSON.parse(message.data);
			}
			changeScene("lobby");
		}};
	}
	function joinRoom(){
		let nam = container.children[0].children[5].value;
		let rId = container.children[0].children[7].value;
		let skn = container.children[0].children[9].value;
		if (rId.length != 4) {alert("Room ID needs 4 characters"); return 0;}
		if (skn < 0) {alert("Select Skin"); return 0;}
		if (chooseAddr == "ws://"){alert("Input IP address"); return;}
		sock = new WebSocket(chooseAddr());
		sock.onopen = () => {console.log(`j|${nam}|${rId}|${skn}`[0]);sock.send(`j|${nam}|${rId}|${skn}`)};
		sock.onmessage = (message) => {if (message.data == -1){alert("Room Not Found");return 0;} 
			else if (message.data == -2){alert("Another User Has This Name");return 0;} 
			else if (message.data == -3){alert("This Room Is Full");return 0;}else {console.log(message.data); 
			game = JSON.parse(message.data);
			playerName = nam;
			roomNo = rId;
			sock.onmessage = (message) => {
				game = JSON.parse(message.data);
			}
			changeScene("lobby");
		};}
	}	
	container.appendChild(document.getElementById("selectionScene").children[0]);
	document.getElementById("host").onclick = hostRoom;
	document.getElementById("join").onclick = joinRoom;
	
	return unbindLocal;
}
scene.selection = selectionScene;

unbind = selectionScene();


