import { DRACOLoader } from "../../libs/three.js-r132/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "../../libs/three.js-r132/examples/jsm/loaders/GLTFLoader.js";

const THREE = window.MINDAR.IMAGE.THREE;

let activeModel = null;
let activeMixer = null;
let activeNarration = null;
let activeSFX = null;

const initializeMindAR = () => {
  return new window.MINDAR.IMAGE.MindARThree({
    container: document.body,
    imageTargetSrc: '../../assets/targets/g4.mind',
  });
};

const configureGLTFLoader = () => {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('../../libs/three.js-r132/examples/js/libs/draco/');
  loader.setDRACOLoader(dracoLoader);
  return loader;
};

const gltfLoader = configureGLTFLoader();
const modelCache = {}; // cache loaded models

const loadModel = async (id, path, scale, position) => {
  if (modelCache[id]) return modelCache[id];

  const model = await gltfLoader.loadAsync(path);

  model.scene.scale.set(scale.x, scale.y, scale.z);
  model.scene.position.set(position.x, position.y, position.z);

  modelCache[id] = model;
  return model;
};

const setupLighting = (scene) => {
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);
};

const setupLazyAnchor = (mindarThree, config) => {
  const { id, modelPath, scale, position, audioPath, sfxPath } = config;
  const anchor = mindarThree.addAnchor(id);

  let mixer = null;
  let narration = new Audio(audioPath);
  narration.loop = true;

  let sfx = null;
  if (sfxPath) {
    sfx = new Audio(sfxPath);
    sfx.loop = false;
  }

  anchor.onTargetFound = async () => {
    const model = await loadModel(id, modelPath, scale, position);

  if (activeNarration) {
    activeNarration.pause();
    activeNarration.currentTime = 0;
  }

    anchor.group.add(model.scene);
    model.scene.visible = true;

    mixer = new THREE.AnimationMixer(model.scene);
    model.animations.forEach(clip => {
      mixer.clipAction(clip).reset().play();
    });

    model.interactionAudio = sfx;

    activeModel = model;
    activeMixer = mixer;

    
    activeNarration = narration;
    narration.currentTime = 0;
    narration.play().catch(() => {});
  };

  anchor.onTargetLost = () => {
    if (!modelCache[id]) return;

    const model = modelCache[id];
    anchor.group.remove(model.scene);
    model.scene.visible = false;

    if (mixer) {
      mixer.stopAllAction();
      mixer = null;
    }

    narration.pause();
    narration.currentTime = 0;

    if (activeModel === model) {
      activeModel = null;
      activeMixer = null;
    }

     if (activeSFX) {
      activeSFX.pause();
      activeSFX.currentTime = 0;
      activeSFX = null;
    }


    if (activeNarration === narration) {
      narration.pause();
      narration.currentTime = 0;
      activeNarration = null;
    }


  };
};

const enableGlobalInteraction = (camera) => {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  window.addEventListener("pointerdown", (event) => {
    if (!activeModel) return;

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(activeModel.scene.children, true);

    if (intersects.length > 0 && activeModel.interactionAudio) {

      // stop previous sfx
      if (activeSFX) {
        activeSFX.pause();
        activeSFX.currentTime = 0;
      }

      activeSFX = activeModel.interactionAudio;
      activeSFX.currentTime = 0;
      activeSFX.play().catch(() => {});
    }

  });
};

const enableRotation = () => {
  let isDragging = false;
  let prev = { x: 0, y: 0 };

  const start = (e) => {
    isDragging = true;
    prev.x = e.touches ? e.touches[0].clientX : e.clientX;
    prev.y = e.touches ? e.touches[0].clientY : e.clientY;
  };

  const move = (e) => {
    if (!isDragging || !activeModel) return;

    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = x - prev.x;
    const dy = y - prev.y;

    activeModel.scene.rotation.y += dx * 0.01;
    activeModel.scene.rotation.x += dy * 0.01;

    prev = { x, y };
  };

  const end = () => isDragging = false;

  window.addEventListener("mousedown", start);
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);

  window.addEventListener("touchstart", start);
  window.addEventListener("touchmove", move);
  window.addEventListener("touchend", end);
};



document.addEventListener('DOMContentLoaded', async () => {
  const mindarThree = initializeMindAR();
  const { renderer, scene, camera } = mindarThree;

  renderer.clock = new THREE.Clock();
  setupLighting(scene);
  enableGlobalInteraction(camera);
  enableRotation();

  const pages = [
    {
      id: 0,
      modelPath: '../../assets/models/pg1/pg1.glb',
      scale: { x: 0.7, y: 0.7, z: 0.7 },
      position: { x: 0, y: -0.4, z: 0 },
      audioPath: '../../assets/audio/bm/pg1.mp3'
    },
    {
      id: 1,
      modelPath: '../../assets/models/pg2/pg2.glb',
      scale: { x: 0.7, y: 0.7, z: 0.7 },
      position: { x: 0, y: -0.4, z: 0 },
      audioPath: '../../assets/audio/bm/pg2.mp3'
    },
    {
      id: 2,
      modelPath: '../../assets/models/pg3/pg3.glb',
      scale: { x: 0.15, y: 0.15, z: 0.15 },
      position: { x: 0, y: -0.4, z: 0 },
      audioPath: '../../assets/audio/bm/pg3.mp3',
      sfxPath: '../../assets/audio/sfx/thunder2.mpeg'
    },
    {
      id: 3,
      modelPath: '../../assets/models/pg4/pg4.glb',
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      position: { x: -0.1, y: -0.7, z: -1.0 },
      audioPath: '../../assets/audio/bm/pg4.mp3',
    },
    {
      id: 4,
      modelPath: '../../assets/models/pg5/pg5.glb',
      scale: { x: 0.3, y: 0.3, z: 0.3 },
      position: { x: 0, y: -0.6, z: 0  },
      audioPath: '../../assets/audio/bm/pg5.mp3',
    },
    {
      id: 5,
      modelPath: '../../assets/models/pg6/pg6.glb',
      scale: { x: 0.2, y: 0.2, z: 0.2 },
      position: { x: 0, y: -0.4, z: 0 },
      audioPath: '../../assets/audio/bm/pg6.mp3',
    },
    {
      id: 6,
      modelPath: '../../assets/models/pg7/pg7.glb',
      scale: { x: 1.2, y: 1.2, z: 1.2  },
      position: {  x: 0, y: -0.6, z: 0  },
      audioPath: '../../assets/audio/bm/pg7.mp3',
    },
    {
      id: 7,
      modelPath: '../../assets/models/pg8/pg8.glb',
      scale: { x: 0.1, y: 0.1, z: 0.1 },
      position: { x: 0, y: -0.5, z: 0},
      audioPath: '../../assets/audio/bm/pg8.mp3',
      sfxPath: '../../assets/audio/sfx/cheering.mp3'
    },
    {
      id: 8,
      modelPath: '../../assets/models/pg9/pg9.glb',
      scale: { x: 0.1, y: 0.1, z: 0.1 },
      position: { x:  0, y: -0.3, z: 0},
      audioPath: '../../assets/audio/bm/pg9.mp3',
      sfxPath: '../../assets/audio/sfx/ghost.mp3'
    },
    {
      id: 9,
      modelPath: '../../assets/models/pg10/pg10.glb',
      scale: { x: 0.04, y: 0.04, z: 0.04 },
      position: { x: 0, y: -0.4, z: 0 },
      audioPath: '../../assets/audio/bm/pg10.mp3',
      sfxPath: '../../assets/audio/sfx/rain.mp3'
    },
    {
      id: 10,
      modelPath: '../../assets/models/pg11/page11.glb',
      scale: { x: 0.06, y: 0.06, z: 0.06  },
      position: { x: 0.5, y: -0.5, z: -1.5  },
      audioPath: '../../assets/audio/bm/pg11.mp3',
    },
    {
      id: 11,
      modelPath: '../../assets/models/pg12/pg12.glb',
      scale: { x: 0.1, y: 0.1, z: 0.1 },
      position: { x: 0, y: -0.8, z: 0 },
      audioPath: '../../assets/audio/bm/pg12.mp3',
    },
    {
      id: 12,
      modelPath: '../../assets/models/pg13/pg13.glb',
      scale: { x: 0.1, y: 0.1, z: 0.1 },
      position: { x: 0, y: -0.8, z: 0 },
      audioPath: '../../assets/audio/bm/pg13.mp3',
    },
    {
      id: 13,
      modelPath: '../../assets/models/pg14/pg14.glb',
      scale: { x: 0.1, y: 0.1, z: 0.1 },
      position: { x: 0, y: -0.4, z: 0 },
      audioPath: '../../assets/audio/bm/pg14.mp3',
    },
    {
      id: 14,
      modelPath: '../../assets/models/pg15/pg15.glb',
      scale: { x: 0.12, y: 0.12, z: 0.12 },
      position: { x: 0, y: -0.4, z: 0 },
      audioPath: '../../assets/audio/bm/pg15.mp3',
      sfxPath: '../../assets/audio/sfx/peace.mp3'
    },
    
  ];

  pages.forEach(cfg => setupLazyAnchor(mindarThree, cfg));

  await mindarThree.start();

  renderer.setAnimationLoop(() => {
    const delta = renderer.clock.getDelta();
    if (activeMixer) activeMixer.update(delta);
    renderer.render(scene, camera);
  });
});
