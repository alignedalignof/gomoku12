"use strict";

let g12 = {
	scale: 1,
	mouse: { x: 0, y: 0, },
	board: [],
	moves: [],
	winner: null,
	ui: {
		board: { bb: { x: 25, y: 25, w: 450, h: 450, }, draw: drawGrid, click: clickBoard, x: -1, y: -1, },
		undo: { bb: { x: 300, y: 480, w: 30, h: 30 }, highlight: true, draw: drawUndo, click: clickUndo, },
		reset: { bb: { x: 350, y: 480, w: 30, h: 30 }, highlight: true, draw: drawReset, click: clickReset, },
		cfg: { bb: { x: 400, y: 480, w: 30, h: 30 }, highlight: true, draw: drawSettings, click: clickSettings, },
		next: { bb: { x: 75, y: 480, w: 200, h:200 }, draw: drawNext, },
		xmenu: { bb: { x:100, y:200, w:300, h:300 }, selected: false, draw: drawMenu,
			ui: {
				p1:	{ bb: { x: 0.1, y: 0.1, w: 0.2, h: 0.2, }, draw: drawPerson, click: clickBlack, },
				cpu1: { bb: { x: 0.35, y: 0.1, w: 0.2, h: 0.2, }, draw: drawComputer, click: clickBlack, },
				p2: { bb: { x: 0.1, y: 0.35, w: 0.2, h: 0.2, }, draw: drawPerson, click: clickWhite, },
				cpu2: { bb: { x: 0.35, y: 0.35, w: 0.2, h: 0.2, }, draw: drawComputer, click: clickWhite, },
				small: { bb: { x: 0.05, y: 0.6, w: 0.3, h: 0.3, }, N:11, draw: drawSize, click: clickSize },
				medium:	{ bb: { x: 0.35, y: 0.6, w: 0.3, h: 0.3, }, N:15, draw: drawSize, click: clickSize },
				large:	{ bb: { x: 0.65, y: 0.6, w: 0.3, h: 0.3, }, N:19, draw: drawSize, click: clickSize },
			},
		},
	},
	focus: null,
	cpu: null,
};

let g12Selection = {
	size: g12.ui.xmenu.ui.small,
	black: g12.ui.xmenu.ui.p1,
	white: g12.ui.xmenu.ui.p2,
};

let g12Next;


////////////////////////////////////////////////////////////////////////////////

let canvas = document.getElementById("canvas");
let ctx = canvas.getContext ? canvas.getContext("2d") : null;
if (ctx && window.Worker) {
	clickReset();
	window.addEventListener("resize", requestRedraw);
	canvas.addEventListener("mousemove", mouseMove);
	canvas.addEventListener("mouseout", e => { mouseMove({ clientX:-1, clientY:-1, })} );
	canvas.addEventListener("mousedown", e => { 
		mouseMove(e);
		if (g12.focus.click)
			g12.focus.click()
	});
	requestRedraw();
}
else {
	alert("Unsupported browser");
}

////////////////////////////////////////////////////////////////////////////////

function playCpuIfNecessary() {
	let player = g12Selection[g12Next[0].player];
	
	if (player.draw == drawPerson)
		return;

	const N = g12Selection.size.N;
	let f2s = f => { return f ? ((f == drawWhite) ? 2 : 1) : 0 }
	let moves = [g12Next[4], g12Next[3], g12Next[2], g12Next[1], g12Next[0]];
	moves = moves.map(f => f2s(f.draw));
	
	let board = [];
	g12.board.forEach(row => row.forEach(pebble => board.push(f2s(pebble))));
	g12.cpu.postMessage({moves, board, N});
}

function isInsideBoard(x, y) {
	if (x < 0 || y < 0 || x >= g12Selection.size.N || y >= g12Selection.size.N)
		return false;
	return true;
}

function checkDirection(x, y, d, p) {
	let range = [];
	while (true) {
		x += d.x;
		y += d.y;
		if (!isInsideBoard(x, y) || (g12.board[y][x] != p))
			break;
		range.push({x, y});
	}
	return range;
}

function getMoveRange(x, y, p) {
	let dir = [{x:1, y:0}, {x:0, y:1}, {x:1, y:1}, {x:-1, y:1}];
	return dir.map(d => checkDirection(x, y, d, p).concat([{x, y}]).concat(checkDirection(x, y, {x:-d.x, y:-d.y}, p)));
}

function playNextMove(x, y) {
	if (g12.winner)
		return;
	let move = g12Next.shift();
	g12Next.push(move);
	g12.board[y][x] = move.draw;
	g12.moves.push({x, y});
	
	let winner = getMoveRange(x, y, move.draw).filter(r => r.length >= 5);
	if (winner.length)
		g12.winner = winner[0];
}

function reinitCpu() {
	if (g12.cpu)
		g12.cpu.terminate();
	g12.cpu = new Worker("cpu.js");
	g12.cpu.onmessage = function(msg) {
		for (let move of msg.data.moves) {
			let x = Math.floor(move%g12Selection.size.N);
			let y = Math.floor(move/g12Selection.size.N);
			playNextMove(x, y);
		}
		playCpuIfNecessary();
	}
	playCpuIfNecessary();
}

function mouseMove(e) {
	let r = canvas.getBoundingClientRect();
	g12.mouse.x = e.clientX - r.left;
	g12.mouse.y = e.clientY - r.top;
	g12.mouse.x /= g12.scale;
	g12.mouse.y /= g12.scale;
	requestRedraw();
	
	let pointIn = function(x, y, bb) {
		if (x < bb.x || y < bb.y)
			return false;
		if (x >= bb.x + bb.w || y >= bb.y + bb.h)
			return false;
		return true;
	};
	
	let x = g12.mouse.x;
	let y = g12.mouse.y;
	
	let board = g12.ui.board;
	board.x = -1;
	g12.focus = { click: () => { g12.ui.xmenu.selected = false; }};
	
	let menu = g12.ui.xmenu;
	if (menu.selected) {
		if (!pointIn(x, y, menu.bb))
			return;
		g12.focus = menu;
		x -= menu.bb.x;
		y -= menu.bb.y;
		x /= menu.bb.w;
		y /= menu.bb.h;
		for (let ui in menu.ui) {
			ui = menu.ui[ui];
			if (pointIn(x, y, ui.bb)) {
				g12.focus = ui;
				return
			}
		}
		return;
	}
	for (let ui in g12.ui) {
		ui = g12.ui[ui];
		if (pointIn(x, y, ui.bb)) {
			g12.focus = ui;
			break;
		}
	}
	if (g12.focus === board) {
		const N = g12Selection.size.N - 1;
		x = (x - board.bb.x)/board.bb.w + 0.45/N - 0.05;
		y = (y - board.bb.y)/board.bb.h + 0.45/N - 0.05;
		x *= N/0.9;
		y *= N/0.9;
		x = Math.floor(x);
		y = Math.floor(y);
		if (x < 0 || x > N || y < 0 || y > N)
			x = -1;
		board.x = x;
		board.y = y;
	}
}

////////////////////////////////////////////////////////////////////////////////

function clickSize() {
	g12Selection.size = this;
	clickReset();
}

function clickBlack() {
	g12Selection.black = this;
	clickReset();
}

function clickWhite() {
	g12Selection.white = this;
	clickReset();
}

function clickReset() {
	for (let row = 0; row < g12Selection.size.N; ++row) {
		g12.board[row] = [];
		for (let col = 0; col < g12Selection.size.N; ++col)
			g12.board[row][col] = null;
	}
	let f2s = function(f){ return {draw:f, player: (f == drawWhite) ? "white" : "black"}; };
	g12Next = [f2s(drawBlack), f2s(drawWhite), f2s(drawWhite), f2s(drawBlack), f2s(drawWhite), f2s(drawBlack)];
	g12.moves = [];
	g12.winner = null;
	reinitCpu();
}

function clickBoard() {
	let x = g12.ui.board.x;
	let y = g12.ui.board.y;
	if (x == -1 || g12.board[y][x] || g12Selection[g12Next[0].player].draw != drawPerson)
		return;
	playNextMove(x, y);
	playCpuIfNecessary();
}

function clickUndo() {
	g12.winner = null;
	while (true) {
		let pos = g12.moves.pop();
		if (!pos)
			return;
		
		g12.board[pos.y][pos.x] = null;
		let move = g12Next.pop();
		g12Next.unshift(move);
		
		let humanVsCpu = g12Selection.white.draw != g12Selection.black.draw;
		let player = g12Selection[move.player];
		if (!humanVsCpu || (player.draw == drawPerson)) {
			if (humanVsCpu || (player.draw != drawPerson))
				reinitCpu();
			return;
		}
	}
}

function clickSettings() {
	g12.ui.xmenu.selected = true;
}

////////////////////////////////////////////////////////////////////////////////

const GRADIENT_HI = "#f5e28b";
const GRADIENT_LO = "#f4aa4b";
	
function drawHighlighted(ui) {
	if (g12.focus != ui) {
		ui.draw();
		return;
	}
	const OFS = 0.05;
	ctx.globalAlpha = 0.3;
	ui.draw();
	ctx.globalAlpha = 1.0;
	ctx.translate(-OFS, -OFS);
	ui.draw();
	ctx.translate(OFS, OFS);
}

function drawMenu() {
	if (!this.selected)
		return;
	let grd = ctx.createLinearGradient(0, 0, 1, 1);
	grd.addColorStop(0, GRADIENT_HI);
	grd.addColorStop(1, GRADIENT_LO);
	ctx.shadowOffsetY = 5*g12.scale;
	ctx.shadowOffsetX = 5*g12.scale;
	ctx.shadowBlur = 0;
	ctx.shadowColor = "rgba(0, 0, 0, 0.5)";

	ctx.fillStyle = grd;
	ctx.fillRect(0, 0, 1, 1);

	ctx.shadowColor = "transparent";
	for (let ui in this.ui) {
		ui = this.ui[ui];
		let bb = ui.bb;
		ctx.save();
		let style = null;
		if (ui == g12Selection.black)
			style = "black";
		else if (ui == g12Selection.white)
			style = "white";
		else if (ui == g12Selection.size) 
			style = "black";
		
		if (style) {
			const OFS = 0.02;
			ctx.beginPath();
			ctx.strokeStyle = style;
			ctx.lineWidth = 0.01;
			ctx.strokeRect(bb.x - OFS/2, bb.y - OFS/2, bb.w + OFS, bb.h + OFS);
		}
		ctx.strokeStyle = "tranesperant";
		ctx.translate(bb.x, bb.y);
		ctx.scale(bb.w, bb.h);
		drawHighlighted(ui);
		ctx.restore();
	}
}

function drawPebble(x, y, s, flat, light, shadow) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s, s);
	
	ctx.beginPath();
	ctx.arc(0, 0, 0.5, 0, 2*Math.PI);
	ctx.fillStyle = flat;
	ctx.fill();
	
	ctx.beginPath();
	let grad = ctx.createRadialGradient(-0.15, -0.15, 0, 0, 0, 0.6);
	grad.addColorStop(0, "#ffffff");
	grad.addColorStop(0.3, light);
	grad.addColorStop(0.9, shadow);
	let color = parseInt(shadow.substring(1), 16);
	let r = (color/65536)%256;
	let g = (color/256)%256;
	let b = color%256;
	grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
	ctx.arc(0, 0, 0.5, 0, 2*Math.PI);
	ctx.fillStyle = grad;
	ctx.fill();
	
	ctx.restore();
}

function drawPerson() {
	ctx.beginPath();
	ctx.strokeStyle = "black";
	ctx.lineWidth = 0.05;
	ctx.arc(0.5, 0.3, 0.2, 0, 2*Math.PI);
	ctx.stroke();
	
	ctx.beginPath();
	ctx.arc(0.5, 0.9, 0.3, Math.PI, 2*Math.PI);
	ctx.closePath();
	ctx.stroke();
}

function drawCrack(x, y, r) {
	ctx.fillStyle = "black";
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(r);
	
	ctx.beginPath();
	ctx.moveTo(0.6, 0.25);
	ctx.lineTo(0.3, 0.5);
	ctx.lineTo(0.45, 0.45);
	ctx.closePath();
	ctx.fill();
	
	ctx.restore();
}

function drawComputer() {
	ctx.strokeStyle = "black";
	ctx.lineWidth = 0.05;
	ctx.strokeRect(0.2, 0.2, 0.6, 0.4);
	ctx.strokeRect(0.1, 0.75, 0.8, 0.15);
}

function drawSize() {
	ctx.save();
	ctx.scale(1/90, 1/90);
	
	ctx.beginPath();
	ctx.lineCap = "round";
	ctx.strokeStyle = "black";
	ctx.lineWidth = 13;
	
	ctx.strokeStyle = "black";
	ctx.lineWidth = 3;
	for (let line = 0; line < 4; ++line) {
		let ofs = 10 + line*20;
		ctx.moveTo(10, ofs);
		ctx.lineTo(70, ofs);
		ctx.moveTo(ofs, 10);
		ctx.lineTo(ofs, 70);
	}
	ctx.stroke();
	
	ctx.fillStyle = "black";
	ctx.strokeStyle = "white";
	ctx.lineWidth = 7;
	ctx.font = "bold 20px verdana";
	ctx.fillText(`${this.N}x${this.N}`, 15, 90);
	ctx.restore();
}

function drawBlack(x, y, s) {
	drawPebble(x, y, s, "#808080", "#808080", "#000000");
}

function drawWhite(x, y, s) {
	drawPebble(x, y, s, "#dcdcdc", "#fafafa", "#b8b8b8");
}

function drawNext() {
	let scaleX = this.bb[2];
	let scaleY = this.bb[3];

	ctx.save();
	ctx.translate(this.bb[0], this.bb[1]);
	ctx.scale(scaleX, scaleY);
	
	const N = 1/(g12Next.length + 1);
	for (let i = g12Next.length; --i;)
		g12Next[i].draw(N + 0.7*i*N, 0.1, N);
	if (!g12.winner)
		g12Next[0].draw(N, 0.1 + 0.02*Math.sin(Date.now()/400), N);
	else
		g12Next[0].draw(N, 0.1, N);
	ctx.restore();
}

function drawUndo() {
	ctx.beginPath();
	ctx.moveTo(0.9, 0.9);
	ctx.lineTo(0.5, 0.9);
	ctx.arc(0.5, 0.5, 0.4, Math.PI/2, 3*Math.PI/2);
	ctx.lineTo(0.9, 0.1);
	ctx.lineWidth = 0.1;
	ctx.strokeStyle = "black";
	ctx.stroke();
	
	ctx.beginPath();
	ctx.moveTo(1.0, 0.1);
	ctx.lineTo(0.7, -0.1);
	ctx.lineTo(0.7, 0.3);
	ctx.fillStyle = "black";
	ctx.fill();
}

function drawReset() {
	ctx.beginPath();
	ctx.moveTo(0.9, 0.9);
	ctx.lineTo(0.1, 0.9);
	ctx.lineTo(0.1, 0.1);
	ctx.lineTo(0.9, 0.1);
	ctx.lineTo(0.9, 0.75);
	ctx.lineWidth = 0.1;
	ctx.strokeStyle = "black";
	ctx.stroke();
	
	ctx.beginPath();
	ctx.moveTo(0.9, 0.9);
	ctx.lineTo(0.7, 0.5);
	ctx.lineTo(1.1, 0.5);
	ctx.fillStyle = "black";
	ctx.fill();
}

function drawSettings(x, y) {
	ctx.beginPath();
	ctx.moveTo(0.1, 0.1);
	ctx.lineTo(0.1, 0.9);
	ctx.moveTo(0.5, 0.1);
	ctx.lineTo(0.5, 0.9);
	ctx.moveTo(0.9, 0.1);
	ctx.lineTo(0.9, 0.9);
	ctx.lineWidth = 0.1;
	ctx.lineCap = "square";
	ctx.strokeStyle = "black";
	ctx.stroke();
	
	ctx.beginPath();
	ctx.lineCap = "round";
	ctx.moveTo(0.0, 0.2);
	ctx.lineTo(0.2, 0.2);
	ctx.moveTo(0.4, 0.8);
	ctx.lineTo(0.6, 0.8);
	ctx.moveTo(1.0, 0.5);
	ctx.lineTo(0.8, 0.5);
	ctx.stroke();
}

function drawGrid() {
	const N = g12Selection.size.N;
	
	ctx.beginPath();
	ctx.lineWidth = 2/500;
	ctx.lineCap = "square";
	ctx.strokeStyle = "black";
	for (let line = 0; line < N; ++line) {
		let ofs = 0.9*line/(N - 1) + 0.05;
		ctx.moveTo(0.05, ofs);
		ctx.lineTo(0.95, ofs);
		ctx.moveTo(ofs, 0.05);
		ctx.lineTo(ofs, 0.95);
	}
	ctx.stroke();
	
	let iToX = function(i) {
		return 0.05 + 0.9*i/(N - 1);
	}
	let isWinningPebble = function(x, y) {
		if (!g12.winner)
			return false;
		return g12.winner.find(p => (p.x == x) && (p.y == y));
	}
	let isRegularPebble = function(x, y) {
		if (!g12.board[y][x] || isWinningPebble(x, y))
			return false;
		return true;
	}
	let winScale = function(x, y) {
		return 0.01*(Math.sin(Date.now()/400 + x*x + y*y) + 1);
	}
	for (let y = 0; y < N; ++y)
		for (let x = 0; x < N; ++x)
			if (isRegularPebble(x, y))
				g12.board[y][x](iToX(x), iToX(y), 0.9/N);

	for (let y = 0; y < N; ++y)
		for (let x = 0; x < N; ++x)
			if (isWinningPebble(x, y))
				g12.board[y][x](iToX(x), iToX(y) + winScale(x, y), 0.9/N);
	
	let x = g12.ui.board.x;
	let y = g12.ui.board.y;
	if ((x >= 0) && (g12Selection[g12Next[0].player].draw == drawPerson) && !g12.board[y][x]) {
		ctx.globalAlpha = 0.5;
		g12Next[0].draw(iToX(x), iToX(y), 0.9/N);
		ctx.globalAlpha = 1.0;
	}
}

function drawGame() {
	let len = Math.min(0.9*window.innerHeight, 0.9*window.innerWidth);
	len = Math.max(500, len);
	len = Math.min(1000, len);
	g12.scale = len/500;
	canvas.height = 1.05*len;
	canvas.width = len;
	
	let grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
	grd.addColorStop(0, GRADIENT_HI);
	grd.addColorStop(1, GRADIENT_LO);

	ctx.fillStyle = grd;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	
	ctx.save();
	ctx.scale(g12.scale, g12.scale);
	
	for (let ui in g12.ui) {
		ui = g12.ui[ui];
		ctx.save();
		ctx.translate(ui.bb.x, ui.bb.y);
		ctx.scale(ui.bb.w, ui.bb.h);
		if (ui.highlight)
			drawHighlighted(ui);
		else
			ui.draw();
		ctx.restore();
	}
	
	ctx.restore();
	
	clearTimeout(g12.anim);
	g12.anim = setTimeout(requestRedraw, 100);
}

function requestRedraw() {
	window.requestAnimationFrame(drawGame);
}
