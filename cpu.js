let g21 = { eval: null};
let selection = { size: {N:11}};
onmessage = function(msg) {
	g21.eval = msg.data.board;
	selection.size.N = msg.data.N;
	postMessage(explore(msg.data.moves));
}

function connected(ofs, stride, pebble, end) {
	let len = 1;
	//bleeds
	for (let left = ofs - stride; left; left -= stride, len++)
		if (g21.eval[left] != pebble)
			break;
	for (let right = ofs + stride; right < end; right += stride, len++)
		if (g21.eval[right] != pebble)
			break;
	return len;
}

function connections(ofs, pebble) {
	const N = selection.size.N;
	return [1, N, N + 1, N - 1].map(stride => connected(ofs, stride, pebble, N*N))
}

function explore(play) {
	if (!play.length)
		return [0, 0, 0];
	
	const N = selection.size.N;
	const LEN = N*N;
	
	let pebble = play.pop();
	let opp = [0, 2, 1][pebble];
	let moves = new Set();
	for (let ofs = 0; ofs < g21.eval.length; ++ofs) {
		if (!g21.eval[ofs])
			continue;
		[
			//bleeds
			ofs - N - 1, ofs - N, ofs - N + 1,
			ofs - 1, ofs + 1,
			ofs + N - 1, ofs + N, ofs + N + 1,
		]
		.filter(stride => ((stride >= 0) && (stride < LEN) && !g21.eval[stride]))
		.forEach(stride => moves.add(stride));
	}
	
	const MUST_MOVE = 1000;
	let best = [0, 0, 0];
	if (!moves.size) {
		if (g21.eval[LEN/2])
			best["moves"] = [];
		else
			best["moves"] = [LEN/2];
		return best;
	}
	
	best[pebble] = -2*MUST_MOVE;
	best[opp] = 2*MUST_MOVE;
	for (let move of moves) {
		g21.eval[move] = pebble;
		let score = connections(move, pebble);
		if (Math.max(...score) >= 5) {
			best[pebble] = MUST_MOVE;
			best[opp] = 0;
			best.moves = [move];
		}
		else {
			score = score.map(x => x*x).reduce((a, b) => { return a + b; });
			let exp = explore(play);
			if (exp[pebble] != MUST_MOVE) {
				exp[pebble] += score;
				if (exp[pebble] - exp[opp] > best[pebble] - best[opp]) {
					best[pebble] = exp[pebble];
					best[opp] = exp[opp];
					best["moves"] = [move];
					if (play.length && (pebble == play[play.length - 1]))
						best["moves"].push(exp.moves[0]);
				}
			}
			else {
				best[pebble] = MUST_MOVE;
				best[opp] = 0;
				best.moves = [move];
				if (play.length && (pebble == play[play.length - 1]))
					best["moves"].push(exp.moves[0]);
			}

		}
		g21.eval[move] = null;
		if (best[pebble] == MUST_MOVE)
			break;
	}
	play.push(pebble);
	return best;
}
