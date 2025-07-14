const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.5, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
scene.add(light);

// Floor
const floorSize = 20;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(floorSize, floorSize),
  new THREE.MeshStandardMaterial({ color: 0x888888 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Walls
const wallHeight = 2;
const wallThickness = 0.5;
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });

const walls = [];

const frontWall = new THREE.Mesh(
  new THREE.BoxGeometry(floorSize, wallHeight, wallThickness),
  wallMaterial
);
frontWall.position.set(0, wallHeight / 2, floorSize / 2);
scene.add(frontWall);
walls.push(frontWall);

const backWall = new THREE.Mesh(
  new THREE.BoxGeometry(floorSize, wallHeight, wallThickness),
  wallMaterial
);
backWall.position.set(0, wallHeight / 2, -floorSize / 2);
scene.add(backWall);
walls.push(backWall);

const leftWall = new THREE.Mesh(
  new THREE.BoxGeometry(wallThickness, wallHeight, floorSize),
  wallMaterial
);
leftWall.position.set(-floorSize / 2, wallHeight / 2, 0);
scene.add(leftWall);
walls.push(leftWall);

const rightWall = new THREE.Mesh(
  new THREE.BoxGeometry(wallThickness, wallHeight, floorSize),
  wallMaterial
);
rightWall.position.set(floorSize / 2, wallHeight / 2, 0);
scene.add(rightWall);
walls.push(rightWall);

// Player variables
let isLocked = false;
let yaw = 0;
let pitch = 0;
const pitchLimit = Math.PI / 2 - 0.1;
const baseSpeed = 0.1;
const keys = {};

// Physics variables for gravity and jump
let velocityY = 0;
const gravity = -30;
const jumpSpeed = 10;
const groundHeight = 1.5;
let canJump = false;

// Zombies
const zombieCount = 5;
const zombies = [];

// Create zombie meshes with positions around the map
function spawnZombies() {
  for(let i = 0; i < zombieCount; i++) {
    const zombie = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1.5, 1),
      new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    // Random position on the floor, avoiding spawn near player start
    let x, z;
    do {
      x = (Math.random() - 0.5) * floorSize * 0.9;
      z = (Math.random() - 0.5) * floorSize * 0.9;
    } while (Math.sqrt((x - camera.position.x)**2 + (z - camera.position.z)**2) < 5);

    zombie.position.set(x, 0.75, z);
    zombie.health = 1;
    scene.add(zombie);
    zombies.push(zombie);
  }
  updateZombieCount();
}

function updateZombieCount() {
  document.getElementById('zcount').textContent = zombies.length;
}

spawnZombies();

// Add knife to camera
const knifeGeometry = new THREE.BoxGeometry(0.1, 0.02, 0.5);
const knifeMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.7, roughness: 0.2 });
const knife = new THREE.Mesh(knifeGeometry, knifeMaterial);
knife.position.set(0.3, -0.3, -0.5);
camera.add(knife);
scene.add(camera);

// Pointer lock controls
window.addEventListener('click', () => {
  if (!isLocked) {
    document.body.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === document.body;
});

document.addEventListener('mousemove', e => {
  if (!isLocked) return;

  const sensitivity = 0.002;
  yaw -= e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;
  pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
});

window.addEventListener('keydown', e => {
  keys[e.code] = true;

  if (e.code === 'Space' && canJump) {
    velocityY = jumpSpeed;
    canJump = false;
  }

  if (e.code === 'KeyE') {
    attackZombies();
  }
});

window.addEventListener('keyup', e => {
  keys[e.code] = false;
});

function checkCollision(newPos) {
  const radius = 0.4;
  for (const wall of walls) {
    const minX = wall.position.x - wall.geometry.parameters.width / 2 - radius;
    const maxX = wall.position.x + wall.geometry.parameters.width / 2 + radius;
    const minZ = wall.position.z - wall.geometry.parameters.depth / 2 - radius;
    const maxZ = wall.position.z + wall.geometry.parameters.depth / 2 + radius;

    if (
      newPos.x > minX && newPos.x < maxX &&
      newPos.z > minZ && newPos.z < maxZ
    ) {
      return true;
    }
  }
  return false;
}

function attackZombies() {
  const knifeRange = 1.5;
  const playerPos = camera.position;

  for (let i = zombies.length - 1; i >= 0; i--) {
    const zombie = zombies[i];
    const dist = zombie.position.distanceTo(playerPos);
    if (dist <= knifeRange) {
      scene.remove(zombie);
      zombies.splice(i, 1);
      updateZombieCount();
    }
  }
}

let prevTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  prevTime = time;

  zombies.forEach(zombie => {
    const dir = new THREE.Vector3().subVectors(camera.position, zombie.position);
    dir.y = 0;
    const distance = dir.length();

    if (distance > 0.1) {
      dir.normalize();
      const speed = 0.7 * delta;
      const newPos = zombie.position.clone().add(dir.multiplyScalar(speed));

      if (!checkCollision(newPos)) {
        zombie.position.copy(newPos);
      }
    }
  });

  const forwardDir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const rightDir = new THREE.Vector3(Math.sin(yaw - Math.PI / 2), 0, Math.cos(yaw - Math.PI / 2));

  let moveVector = new THREE.Vector3();

  if (isLocked) {
    if (keys['KeyW']) moveVector.add(forwardDir);
    if (keys['KeyS']) moveVector.sub(forwardDir);
    if (keys['KeyA']) moveVector.sub(rightDir);
    if (keys['KeyD']) moveVector.add(rightDir);
  }

  if (moveVector.length() > 0) {
    moveVector.normalize();
    moveVector.multiplyScalar(0.1);
  }

  const newPosition = camera.position.clone();
  newPosition.x += moveVector.x;
  newPosition.z += moveVector.z;

  if (!checkCollision(newPosition)) {
    camera.position.x = newPosition.x;
    camera.position.z = newPosition.z;
  }

  velocityY += gravity * delta;
  camera.position.y += velocityY * delta;

  if (camera.position.y <= groundHeight) {
    camera.position.y = groundHeight;
    velocityY = 0;
    canJump = true;
  }

  const lookDir = new THREE.Vector3(
    Math.cos(pitch) * Math.sin(yaw),
    Math.sin(pitch),
    Math.cos(pitch) * Math.cos(yaw)
  );
  const lookAtPos = new THREE.Vector3().addVectors(camera.position, lookDir);
  camera.lookAt(lookAtPos);

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
