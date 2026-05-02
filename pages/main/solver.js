
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let rand = Math.random; 

function setSeed(seed) {
  rand = mulberry32(seed);
}


function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function solve(options) {
  const {
    N, M, forbiddenRect, points, dhGroups,
    lxlyOccupiedSet, 
    maxIterDh = 2000,
    saTemperature = 100,
    saCooling = 0.95,
    saMinTemp = 0.01,
    seed = null,
    history = null,
    retryCount = 0
  } = options;

  const MAX_RETRY = 5;
  if (retryCount > MAX_RETRY) history = null;
  if (seed !== null) setSeed(seed);

  const [dx1, dy1, dx2, dy2] = forbiddenRect;
  const available = [];
  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      if (i >= dx1 && i <= dx2 && j >= dy1 && j <= dy2) continue;
      if (lxlyOccupiedSet.has(`${i},${j}`)) continue;
      available.push([i, j]);
    }
  }
  if (available.length < points.length) {
    throw new Error(`可用位置不足：需要${points.length}个，只有${available.length}个`);
  }
  shuffle(available);

  const placed = new Map();
  const occupied = new Set();
  const grid = Array.from({ length: N + 2 }, () => Array(M + 2).fill(null));

  for (const [pid] of points) {
    const pos = available.pop();
    placed.set(pid, pos);
    occupied.add(`${pos[0]},${pos[1]}`);
    grid[pos[0]][pos[1]] = pid;
  }

  function hasDhConflict(pid, [x, y], grid, pointToGroups, dhGroups) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        const neighbor = (grid[nx] || [])[ny];
        if (neighbor && neighbor !== pid) {
          for (const gIdx of pointToGroups.get(pid) || []) {
            if (dhGroups[gIdx].includes(neighbor)) return true;
          }
        }
      }
    }
    return false;
  }

  const pointToGroups = new Map();
  points.forEach(([pid]) => pointToGroups.set(pid, []));
  dhGroups.forEach((group, gIdx) => {
    group.forEach(pid => {
      if (pointToGroups.has(pid)) pointToGroups.get(pid).push(gIdx);
    });
  });

  
  for (let iter = 0; iter < maxIterDh; iter++) {
    const conflictPoints = [];
    for (const [pid, pos] of placed) {
      if (hasDhConflict(pid, pos, grid, pointToGroups, dhGroups)) {
        conflictPoints.push(pid);
      }
    }
    if (!conflictPoints.length) break;
    const pid = conflictPoints[Math.floor(rand() * conflictPoints.length)];
    const [x, y] = placed.get(pid);
    const candidates = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx>=1 && nx<=N && ny>=1 && ny<=M &&
            !(nx>=dx1 && nx<=dx2 && ny>=dy1 && ny<=dy2) &&
            !lxlyOccupiedSet.has(`${nx},${ny}`) &&
            grid[nx][ny] === null &&
            !hasDhConflict(pid, [nx,ny], grid, pointToGroups, dhGroups)) {
          candidates.push([nx, ny]);
        }
      }
    }
    if (!candidates.length) {
      
      for (let i=1; i<=N; i++) {
        for (let j=1; j<=M; j++) {
          if (grid[i][j] === null &&
              !lxlyOccupiedSet.has(`${i},${j}`) &&
              !(i>=dx1 && i<=dx2 && j>=dy1 && j<=dy2) &&
              !hasDhConflict(pid, [i,j], grid, pointToGroups, dhGroups)) {
            candidates.push([i,j]);
          }
        }
      }
      shuffle(candidates);
    }
    if (candidates.length) {
      const newPos = candidates[Math.floor(rand() * candidates.length)];
      grid[x][y] = null; occupied.delete(`${x},${y}`);
      placed.set(pid, newPos);
      grid[newPos[0]][newPos[1]] = pid;
      occupied.add(`${newPos[0]},${newPos[1]}`);
    }
  }

  const valMap = new Map(points);
  function objective() {
    let total = 0;
    for (const [pid, [x,y]] of placed) {
      const myVal = valMap.get(pid);
      let sum = 0, count = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx===0 && dy===0) continue;
          const nx = x+dx, ny = y+dy;
          const nid = (grid[nx] || [])[ny];
          if (nid && nid !== pid) { sum += valMap.get(nid); count++; }
        }
      }
      if (count) total += (myVal - sum/count) ** 2;
    }
    return total;
  }

  let T = saTemperature;
  let currentObj = objective();
  let bestPlaced = new Map(placed);
  let bestObj = currentObj;

  while (T > saMinTemp) {
    const pids = Array.from(placed.keys());
    const pid = pids[Math.floor(rand() * pids.length)];
    const [x,y] = placed.get(pid);
    const candidates = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx===0 && dy===0) continue;
        const nx = x+dx, ny = y+dy;
        if (nx>=1 && nx<=N && ny>=1 && ny<=M &&
            !(nx>=dx1 && nx<=dx2 && ny>=dy1 && ny<=dy2) &&
            !lxlyOccupiedSet.has(`${nx},${ny}`) &&
            grid[nx][ny] === null) {
          candidates.push([nx, ny]);
        }
      }
    }
    
    for (let i=1; i<=N; i++) {
      let found = false;
      for (let j=1; j<=M; j++) {
        if (grid[i][j] === null &&
            !lxlyOccupiedSet.has(`${i},${j}`) &&
            !(i>=dx1 && i<=dx2 && j>=dy1 && j<=dy2)) {
          candidates.push([i,j]);
          found = true; break;
        }
      }
      if (found) break;
    }

    if (!candidates.length) { T *= saCooling; continue; }
    const newPos = candidates[Math.floor(rand() * candidates.length)];
    if (hasDhConflict(pid, newPos, grid, pointToGroups, dhGroups)) {
      T *= saCooling; continue;
    }

    grid[x][y] = null; occupied.delete(`${x},${y}`);
    placed.set(pid, newPos);
    grid[newPos[0]][newPos[1]] = pid;
    occupied.add(`${newPos[0]},${newPos[1]}`);

    const newObj = objective();
    const delta = newObj - currentObj;
    if (delta < 0 || rand() < Math.exp(-delta / T)) {
      currentObj = newObj;
      if (currentObj < bestObj) {
        bestObj = currentObj;
        bestPlaced = new Map(placed);
      }
    } else {
      
      grid[newPos[0]][newPos[1]] = null; occupied.delete(`${newPos[0]},${newPos[1]}`);
      placed.set(pid, [x,y]);
      grid[x][y] = pid; occupied.add(`${x},${y}`);
    }
    T *= saCooling;
  }

  const result = Array.from({ length: N }, () => Array(M).fill(''));
  for (const [pid, [x,y]] of bestPlaced) {
    result[x-1][y-1] = pid;
  }

  
  if (history && history.length && retryCount <= MAX_RETRY && points.length >= 5) {
    const similarity = (a, b) => {
      let cnt = 0, total = 0;
      for (let i=0; i<N; i++) for (let j=0; j<M; j++) {
        total++;
        if (a[i][j] === b[i][j]) cnt++;
      }
      return total ? cnt/total : 0;
    };
    const sims = history.map(h => similarity(result, h));
    const avg = sims.reduce((a,b)=>a+b,0)/sims.length;
    if (avg > 0.9) {
      return solve({
        ...options,
        seed: seed ? seed + retryCount + 1 : Math.floor(rand()*1000000),
        retryCount: retryCount + 1
      });
    }
  }

  return result;
}

module.exports = { solve, setSeed };