import * as THREE from 'three'

import {GLTFLoader} from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { Client } from './client.js';
// import { EffectComposer } from "../node_modules/three/examples/jsm/postprocessing/EffectComposer.js";
// import { OutlinePass } from "../node_modules/three/examples/jsm/postprocessing/OutlinePass.js";
// import { RenderPass } from "../node_modules/three/examples/jsm/postprocessing/RenderPass.js";
// import { ShaderPass } from "../node_modules/three/examples/jsm/postprocessing/ShaderPass.js";
// import { FXAAShader } from "../node_modules/three/examples/jsm/shaders/FXAAShader.js";
// import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

const scene = new THREE.Scene()
const bullets = [];
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);



// for guns
scene.add(camera);


function clamp(x, a, b) {
    return Math.min(Math.max(x, a), b);
}


class UI{
    constructor(){
        this.healtHBar = document.querySelector("#health");
        this.ammo = document.querySelector("#ammo");
        this.gunImage = document.querySelector(".gunIcon");
        this.kills = document.getElementById("kills");
    }
}
 
class InputController {
    constructor(){
        this.init();
    }

    init(){
        this.current = {
            leftButton: false,
            rightButton: false,
            mouseX: 0,
            mouseY: 0,
            mouseXDelta: 0,
            mouseYDelta: 0
        };
        this.previous = null;
        this.keys ={};
        this.previousKeys = {};
        this.movedMouse = false;

        document.addEventListener("mousedown", (e) => this.onMouseDown(e), false);        
        document.addEventListener("mousemove", (e) => this.onMouseMove(e), false);
        document.addEventListener("mouseup", (e) => this.onMouseUp(e), false);
        document.addEventListener("keydown", (e) => this.onkeyDown(e), false);
        document.addEventListener("keyup", (e) => this.onkeyUp(e), false);
    }

    onMouseUp(e){
        switch(e.button){
            case 0:
                this.current.leftButton = false;
                break;
            case 1:
                this.current.rightButton = false;
                break;
        }
    }

    onMouseDown(e){
        switch(e.button){
            case 0:
                this.current.leftButton = true;
                renderer.domElement.requestPointerLock();
                break;
            case 1:
                this.current.rightButton = true;
                break;
        }
    }

    onMouseMove(e){
        this.movedMouse = true;
        this.current.mouseX = e.pageX - window.innerWidth / 2;
        this.current.mouseY = e.pageY - window.innerHeight / 2;

        if(this.previous == null){
            this.previous = {...this.current};
        }

        // how much have they moved the mouse
        this.current.mouseXDelta = e.movementX;
        this.current.mouseYDelta = e.movementY;
    }

    onkeyDown(e){
        this.keys[e.keyCode] = true;
    }

    onkeyUp(e){
        this.keys[e.keyCode] = false;
    }

    update(delta){
        if(!this.movedMouse){
            this.current.mouseXDelta = 0;
            this.current.mouseYDelta = 0;
        }else{
            this.movedMouse = false;
        }
        this.previous = {...this.current};
    }
}

class FirstPersonCamera {
    constructor(camera){
        this.camera = camera;
        this.input = new InputController();
        this.rotation = new THREE.Quaternion();
        this.translation = new THREE.Vector3(100, 1000, -800);
        this.phi_ = 0;
        this.theta_ = 0; 
        this.headBobActive = false;
        this.headBobTimer = 0;
        this.onGround = true;
        this.velocity = new THREE.Vector3(0,0,0);

        this.fraycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3(), -5, 50 );
        this.lraycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3(), -5, 50 );
        this.draycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3( 0, - 1, 0 ), -5, 20 );
        // defualt health
        this.health = 100;
        this.maxHealth = 100;
        this.mySet = new Set();
        this.gun = null;
    }

    update(delta){
        this.updateRotation(delta);
        this.updateHeadBob(delta);
        this.updateCamera(delta);
        this.updateTranslation(delta);
        this.input.update(delta);
        if(this.health <= 0){
            const point = spawnPoints[Math.floor(Math.random()*spawnPoints.length)];
            this.translation.copy(point);
            this.gun.ammo = this.gun.clipSize;
            ui.ammo.innerHTML = this.gun.ammo;
            client.broadcastAll(`${client.pid}|h|${-(this.maxHealth - this.health)}`, true);
        }
        ui.healtHBar.value = this.health;
        this.gun.update(delta);
    }

    updateCamera(delta){
        this.camera.quaternion.copy(this.rotation);
        this.camera.position.copy(this.translation);
        this.camera.position.y += Math.sin(this.headBobTimer * 10) * 8;

        const forward = new THREE.Vector3(0,0,-1);
        forward.applyQuaternion(this.rotation);

        const dir = forward.clone();

        forward.multiplyScalar(100);
        forward.add(this.translation);

        let closest = forward;
        const result = new THREE.Vector3;
        const ray = new THREE.Ray(this.translation, dir);
        for(let i = 0; i < objs.length; i++){
            if(ray.intersectBox(bounds[i], result)){
                if(result.distanceTo(ray.origin) < closest.distanceTo(ray.origin)){
                    closest = result.clone();
                }
            }
        }

        this.camera.lookAt(closest);
    }

    updateHeadBob(delta){
        if(this.headBobActive){
            const waveLength = Math.PI;
            const nextStep = 1 + Math.floor(((this.headBobTimer + 0.000001) * 10)/waveLength);
            const nextStepTime = nextStep * waveLength/10;

            this.headBobTimer = Math.min(this.headBobTimer + delta, nextStepTime);
            if(this.headBobTimer == nextStepTime){{
                this.headBobActive = false;
            }}
        }
    }

    updateRotation(delta){
        const xh = this.input.current.mouseXDelta / window.innerWidth;
        const yh = this.input.current.mouseYDelta / window.innerHeight;

        this.phi_ += -xh * 5;
        this.theta_ = clamp(this.theta_ + -yh * 5, -Math.PI / 3, Math.PI / 3);

        const qx = new THREE.Quaternion();
        qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);

        const qz = new THREE.Quaternion();
        qz.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.theta_);

        const q = new THREE.Quaternion();
        q.multiply(qx);
        q.multiply(qz);
        this.rotation.copy(q);
    }

    updateTranslation(delta){

        const w = 87;
        const s = 83;
        const a = 65;
        const d = 68;
        const space = 32;
        const forwardVelocity = (this.input.keys[w] ? 1: 0) + (this.input.keys[s] ? -1 : 0);
        const strafeVelocity = (this.input.keys[a] ? 1: 0) + (this.input.keys[d] ? -1 : 0);
        // default forward
        const qx = new THREE.Quaternion();
        qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);
        
        const forward = new THREE.Vector3(0,0,-1);
        forward.applyQuaternion(qx);
        forward.multiplyScalar(forwardVelocity * delta * 500);

        const left = new THREE.Vector3(-1,0,0);
        left.applyQuaternion(qx);
        left.multiplyScalar(strafeVelocity * delta * 500);


        // init rays
        this.fraycaster.ray.direction.copy(forward);
        this.fraycaster.ray.origin.copy( this.translation );
        this.fraycaster.ray.origin.y -= 50;

        this.lraycaster.ray.direction.copy(left);
        this.lraycaster.ray.origin.copy( this.translation );
        this.lraycaster.ray.origin.y -= 50;

        this.draycaster.ray.origin.copy( this.translation );
        this.draycaster.ray.origin.y -= 100;

        let front, down, side = false; 
        // get collisions
        objs.forEach(obj => {
            if(!front){
                front = this.fraycaster.intersectObject(obj, false).length > 0;
            }
            if(!down){
                down = this.draycaster.intersectObject(obj, false).length > 0;
            }
            if(!side){
                side = this.lraycaster.intersectObject(obj, false).length > 0;
            }
        })

        // check FRONT
        if(!front){

            this.translation.add(forward);
        }

        // check LEFT
        if(!side){
            this.translation.add(left);
        }

        if(forwardVelocity != 0 || strafeVelocity != 0){
            this.headBobActive = true;
        }


        this.onGround = down;
        if(!this.onGround){
            const fraycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3( 0, 10, 0 ), 0, 10 );
            fraycaster.ray.origin.copy( this.translation );
            const intersections = fraycaster.intersectObjects(objs, false );
            if(intersections.length > 0){
                this.velocity.y = 0;
            }


            this.headBobActive = false;
            if(this.velocity.y > -25){
                this.velocity.y -= 1;
            }

        }else{
            if(this.input.keys[space]){
                if(this.velocity.y <= 1){
                    this.velocity.y += 20;
                }
            }else{
                this.velocity.y = 0;
            }

        }
        this.translation.add(this.velocity);
        if(this.input.current.leftButton){
            console.log("X:" +this.translation.x + "Y: " + this.translation.y + "Z: "  + this.translation.z);
        }
    }
}

class Gun extends THREE.Group {
    constructor(model, pos, camera){
        
        super();
        camera.gun = this;
        let children = []
        model.children.forEach(child => {
            children.push(child.clone());
        });

        children.forEach(c => {
            this.add(c);
        });        
        // this.scale.copy(scale);
        // this.position.copy(pos);
        this.t = 0;
        this.recoil = false;
        this.raycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3( 0, 0, 100 ), 0, 10000 );

        const loader = new THREE.TextureLoader();
        this.hole = loader.load("./assets/bullet.png");

        this.camera = camera;

        this.listener = new THREE.AudioListener();
        this.add(this.listener);
        this.fire = new THREE.Audio(this.listener);
        const aLoader = new THREE.AudioLoader();
        aLoader.load("./assets/fire.wav", (buffer) => {
            this.fire.setBuffer(buffer);
            this.fire.setVolume(1);

        })
    }

    update(delta){
        this.updatePosition();
        this.updateRecoil();
        this.updateFire();

    }

    updateFire(){
        // !curr mouse && prev mouse for single fire!
        if(this.camera.input.current.leftButton && this.recoil == false && this.t > -0.3){
            this.recoil = true;
            this.raycaster.setFromCamera(new THREE.Vector2(), camera);
            this.t = 0.15;
            this.updateRecoil();
            if(!this.fire.isPlaying){
                this.fire.play();
                this.fire.setLoop(true);
            }

            const intersects = this.raycaster.intersectObjects(objs);
            const hits = this.raycaster.intersectObjects(Object.values(enemies));
            if(hits.length > 0){
                console.log(hits[0].object.peer)
                console.log(enemies);
                client.broadcastAll(`${hits[0].object.peer}|h|${10}`, true);
            }
            this.addBullet(this.raycaster.ray.direction.clone(), intersects[0].point);

        }else if(!this.camera.input.current.leftButton){
            if(this.fire.isPlaying){
                this.fire.setLoop(false);
            }
        }
            // spawn decal
        //     const hits = this.raycaster.intersectObjects(objs);
        //     if(hits.length != 0){
        //         const position = hits[0].point.clone();
        //         const eye = position.clone();
        //         eye.add(hits[0].face.normal);
                
        //         const rotation = new THREE.Matrix4();
        //         rotation.lookAt(eye, position, THREE.Object3D.DEFAULT_UP);
        //         const euler = new THREE.Euler();
        //         euler.setFromRotationMatrix(rotation);

        //         const decalGeo = new DecalGeometry(
        //             hits[0].object, hits[0].point, euler, new THREE.Vector3(15,15,5));

        //         const decalMat = new THREE.MeshStandardMaterial({
        //             color: 0xFFFFFF, depthTest: true, depthWrite: false, polygonOffsetFactor: -50, polygonOffset: true,
        //             map: this.hole, transparent: true
        //         });
        //         const decal = new THREE.Mesh(decalGeo, decalMat);
        //         decal.receiveShadow = true;
        //         scene.add(decal);
        //     }
        // }
    }


    updatePosition(){
        this.position.copy( camera.position );
        this.rotation.copy( camera.rotation );
        this.updateMatrix();
        this.translateZ(-1.5);
        this.translateY(-1.3);
        this.translateX(1);
        this.rotateY( 180* Math.PI / 180 - 0.1);
    }

    updateRecoil(){
        if(this.t <= 1 && this.recoil){
            this.t += 0.45;
        }else{
            this.recoil = false;
            if(this.t > 0){
                this.t -= 0.25;
            }
        }
        this.translateZ( ( Math.PI/4) * -this.t);
        this.rotateX( ( Math.PI/35) * -this.t);

    }

    addBullet(dir, end) {
        let particle = new Bullet(new THREE.SphereGeometry(20,20,20), new THREE.MeshLambertMaterial({color: 0x3393FF}), 0.03, dir, end, this.position);
        scene.add(particle);
    }
}

class AR extends Gun {
    constructor(model, pos, camera){
        super(model, pos, camera);
        const aLoader = new THREE.AudioLoader();
        aLoader.load("./assets/AR/fire.wav", (buffer) => {
            this.fire.setBuffer(buffer);
            this.fire.setVolume(1);

        });
        this.clipSize = 36;
        this.ammo = this.clipSize;
        ui.ammo.innerHTML = this.ammo;
        this.reload = false;
        this.kills= 0;
        this.reloading = false;
    }

    updatePosition(){
    this.position.copy( camera.position );
    this.rotation.copy( camera.rotation );
    this.updateMatrix();
    this.translateZ(-1.5);
    this.translateY(-1.5);
    this.translateX(1);
    this.rotateY( Math.PI / 2);
    }
    updateFire(){
        // !curr mouse && prev mouse for single fire!
        // r for manual reload
        if(this.camera.input.keys[82]){
            if(!this.reload){
                this.reload = true;
                this.reloading = true;
                this.fire.setLoop(false);
                return;
            }else{
                return;
            }
        }
        if(this.camera.input.current.leftButton && this.recoil == false && this.t > -0.3){
            // cancel manual reload on fire
            this.reload = false;
            this.reloading = false;
            // reload
            if(this.ammo == 0){
                if(!this.reload){
                    this.reload = true;
                    this.reloading = true;
                    return;
                }else{
                    return;
                }

            }
            this.recoil = true;
            this.raycaster.setFromCamera(new THREE.Vector2(), camera);
            this.t = 0.15;
            this.updateRecoil();
            if(!this.fire.isPlaying){
                this.fire.play();
                this.fire.setLoop(true);
            }

            this.ammo -= 1;
            ui.ammo.innerHTML = this.ammo;
            const hits = this.raycaster.intersectObjects(Object.values(enemies));
            if(hits.length > 0){
                if(hits[0].object.health - 10 == 0){
                    client.broadcastAll(`${client.pid}|h|${-controls.maxHealth - controls.health}`, true);
                    this.kills += 1;
                    ui.kills.innerHTML = "☠" + this.kills;
                }
                client.broadcastAll(`${hits[0].object.peer}|h|${10}`, true);
            }
        }else if(!this.camera.input.current.leftButton && !this.recoil){
            if(this.fire.isPlaying){
                this.fire.setLoop(false);
            }
        }
    }
    updateRecoil(){
        if(!this.reload){
            if(this.t <= 1 && this.recoil){
                this.t += 0.15;
            }else{
                this.recoil = false;
                if(this.t >= 0){
                    this.t = 0.15;
                }
            }
        }else{
            if(this.t <= 1 && this.reloading){
                this.t += 0.01;
            }else{
                this.reloading = false;
                if(this.t >= 0){
                    this.t = 0.01;
                    this.reload = false;
                    this.ammo = this.clipSize;
                    ui.ammo.innerHTML = this.ammo;
                }
            }
        }

        this.translateX( ( Math.PI/20) * -this.t);
        this.rotateZ( ( Math.PI/35) * this.t);

    }
}

// for visual bullet
class Bullet extends THREE.Mesh{
    constructor(m,geo , speed, dir, dist, pos){
        super(m, geo)
        this.position.copy(pos);
        this.speed = speed;
        this.dir = dir.multiplyScalar(80);
        this.end = dist;
        this.greater = !isVectorLessThan(this.position, this.end);
        this.i = bullets.length;
        bullets[this.i] = this;
        // if(this.end == null){
        //     this.end.copy(this.position);
        //     this.end.multiplyScalar(100);
        //     scene.remove(this);
        //     this.geometry.dispose();
        //     this.material.dispose();

        //     delete bullets[this.i];
        // }
    }
    update(){
        if(this.greater){
            if(!isVectorLessThan(this.position, this.end)){
                this.position.add(this.dir);
            }else{
                scene.remove(this);
                this.geometry.dispose();
                this.material.dispose();

                delete bullets[this.i];
            }
        }else{
            if(isVectorLessThan(this.position, this.end)){
                this.position.add(this.dir);
            }else{
                scene.remove(this);
                this.geometry.dispose();
                this.material.dispose();
                delete bullets[this.i];
            }
        }

    }
}

function isVectorLessThan(vector1, vector2) {
    return (vector1.x <= vector2.x && vector1.y <= vector2.y && vector1.z <= vector2.z);
  }

// a simple wrapper class for enemies
class Enemy extends THREE.Mesh{
    constructor(geo, mat){
        super(geo, mat);
        this.health = 100;
        this.maxHealth = this.health;
        this.peer = "";


        this.fire = new THREE.PositionalAudio(l);
        const aLoader = new THREE.AudioLoader();
        aLoader.load("./assets/AR/fire.wav", (buffer) => {
            this.fire.setBuffer(buffer);
            this.fire.setVolume(1);
            this.fire.setLoop(true)
        })
        this.fire.setRefDistance(200);
        this.add(this.fire);
        this.shooting = false;
    }

    shoot(toggle){
        if(toggle == "true" && !this.shooting){
            this.fire.setLoop(true)
            this.shooting = true;
            this.fire.play();
        }else if(toggle == "false" && this.shooting){
            this.fire.setLoop(false)
            this.shooting = false;
        }

    }
} 

// const bound = bounds[i];
// const w = bound.max.x - bound.min.x;
// const h = bound.max.y - bound.min.y;
// const d = bound.max.z - bound.min.z;
// const x = this.translation.x > objs[i].position.x + w/2 && this.translation.x < objs[i].position.x - w/2;
// const z = this.translation.z > objs[i].position.z + d/2 && this.translation.z < objs[i].position.z - d/2;
// if(this.camera.position.y >= objs[i].position.y + h/2 && !x && !z){

// }else{
//     this.onFloor = true;
// }


const renderer = new THREE.WebGLRenderer({alpha: true})
var objs = [];
var bounds = [];
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.depthBuffer = true;
document.body.appendChild(renderer.domElement);


const spawnPoints = [
    new THREE.Vector3(579.9888083261771, 322, -2956.9424191133144),
    new THREE.Vector3(-118.09720332338347, 322, -2966.499626017237),
    new THREE.Vector3(-1272.908443170783, 231, -4008.2036126183266),
    new THREE.Vector3(-1360.7690916935044, 231, -2260.9587340533953),
    new THREE.Vector3(311.1546344386906, 321, 2990.9466953218184),
    new THREE.Vector3(1052.5564942971525, 231, 2247.431493143679),
  ];

const controls =  new FirstPersonCamera(camera);
const point = spawnPoints[Math.floor(Math.random()*spawnPoints.length)];
controls.translation.copy(point);
const ui = new UI();

const gltfloader = new GLTFLoader()
// player listener
const l = new THREE.AudioListener();
let gun = null;
// gltfloader.load("./assets/plasma/scene.gltf", (gltf) => {
//     gltf.scene.scale.set(15, 15,15 );
//     gltf.scene.position.set( 120, 105, -750);
//     gun =  new Gun(gltf.scene, gltf.scene.position, controls);
//     scene.add(gun );
// })
const sColor = new THREE.Color(0xFF0000);
const eColor = new THREE.Color(0x00FF00);
const lerpedColor = new THREE.Color(0xFF0000)
const enemies = {};

var client = await initClient();
gltfloader.load("./assets/AR/scene.gltf", (gltf) => {

    gun =  new AR(gltf.scene, gltf.scene.position, controls);
    gun.scale.set(0.2, 0.2, 0.2)


    controls.gun = gun;

    scene.add(gun );


    gltfloader.load("./assets/d2/scene.gltf", (gltf) => {
        // comment for nuke town
        gltf.scene.scale.set(50,50,50);
        gltf.scene.traverse(c => {
            if(c.isMesh){
                c.castShadow = true;
                objs.push(c);
                bounds.push(new THREE.Box3().setFromObject(c))
    
            }
            scene.add(gltf.scene);
        });
        animate()
    
    });

    gun.add(l);
})

camera.position.z = 10;

// add light
// create a new directional light
const light = new THREE.DirectionalLight(0xFFFFFF)
light.position.z = 1;
light.position.y = 3;
// have the light cast shadows
light.castShadow = true;
scene.add(light);

// create a ambient light
var clock = new THREE.Clock()
scene.add(new THREE.AmbientLight(0xffffff, 0.5));


// const composer = new EffectComposer(renderer);
// const renderPass = new RenderPass( scene, camera );
// composer.addPass( renderPass );

// const outlinePass= new OutlinePass(
//       new THREE.Vector2(window.innerWidth, window.innerHeight), //resolution parameter
//       scene,
//       nt
// );

// // -- parameter config
// outlinePass.edgeStrength = 100.0;
// outlinePass.edgeThickness = 5.0;
// outlinePass.pulsePeriod = 0;
// outlinePass.usePatternTexture = false; // patter texture for an object mesh
// outlinePass.visibleEdgeColor.set("#000000"); // set basic edge color
// outlinePass.hiddenEdgeColor.set("#00000"); // set edge color when it hidden by other objects
// outlinePass.overlayMaterial.blending = THREE.CustomBlending;
// outlinePass.selectedObjects = scene.children;
// composer.addPass( outlinePass );

//shader
// const effectFXAA = new ShaderPass(FXAAShader);
// effectFXAA.uniforms["resolution"].value.set(
//   1 / window.innerWidth,
//   1 / window.innerHeight
// );
// effectFXAA.renderToScreen = true;
// composer.addPass(effectFXAA);


function addEnemy(peer){
    const e = new Enemy(new THREE.BoxGeometry(55, 250 , 55), new THREE.MeshBasicMaterial({color: eColor}));
    e.peer = peer;
    enemies[peer] = e;
    scene.add(enemies[peer]);
}

async function animate() {
  requestAnimationFrame(animate);
  //composer.render();
  renderer.render(scene, camera);
  controls.update(clock.getDelta());
  bullets.forEach(b => {
    b.update();
  });
  client.broadcastAll(`${client.pid}|m|${controls.translation.x}|${controls.translation.y}|${controls.translation.z}|${controls.rotation.x}|${controls.rotation.y}|${controls.rotation.z}|${controls.gun.recoil}`);
}



// CLIENT TESTS
async function initClient(){
    const client = new Client();
    client.onClientDisconnect = (cid) => {
        scene.remove(enemies[cid]);
        delete enemies[cid];
    }

    client.onConnect = (conn) => {
        addEnemy(conn.peer);
    }
    client.onCreate = (conns) => {
        Object.keys(conns).forEach((id) => {
            addEnemy(id);
        })
    }

    await client.init();

    client.handleData = (d) => {
        const data = d.split("|");
        const id = data[0];
        if(data[1] == "m"){
            enemies[id].position.set(data[2],data[3],data[4]);
            enemies[id].rotation.y = data[6];
            //enemies[id].rotation.z = data[7];
            console.log(data[8]);
            enemies[id].shoot(data[8]);
        }else if(data[1] == "h"){
            console.log("H")
            if(id == client.pid){
                controls.health -= data[2]
            }else{
                enemies[id].health -= data[2];
                enemies[id].material.color.lerpColors(sColor, eColor, enemies[id].health/enemies[id].maxHealth);
            }

        }

    }
    return client;
}
