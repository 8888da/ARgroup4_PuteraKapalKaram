import { DRACOLoader } from "../../libs/three.js-r132/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "../../libs/three.js-r132/examples/jsm/loaders/GLTFLoader.js";

const THREE = window.MINDAR.IMAGE.THREE;

//Create a global active model reference
let activeModel = null;
let activeMixer = null;


// Function to initialize the MindARThree instance
const initializeMindAR = () => {
  return new window.MINDAR.IMAGE.MindARThree({
    container: document.body, // Attach AR experience to the body
    imageTargetSrc: '../../assets/targets/g4.mind',
  });
};

// Configure GLTFLoader with DRACOLoader
const configureGLTFLoader = () => {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('../../libs/three.js-r132/examples/js/libs/draco/'); // Path to DRACO decoder files
  loader.setDRACOLoader(dracoLoader);
  return loader;
};

// Function to set up lighting in the scene
const setupLighting = (scene) => {
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1); // Add a light source
  scene.add(light);
};

// Function to load the GLB model with animations
const loadModel = async (path, scale = { x: 0.15, y: 0.15, z: 0.15 }, position = { x: 0, y: -0.4, z: 0 }) => {
  const loader = configureGLTFLoader();
  const model = await loader.loadAsync(path);

  // Set the scale
  model.scene.scale.set(scale.x, scale.y, scale.z);

  // Set the position
  model.scene.position.set(position.x, position.y, position.z);

  return model;
};

// Enable zoom and rotation
const enableZoomAndRotation = (camera, model) => {
  let scaleFactor = 1.0; // Default scaling factor
  let isDragging = false;
  let previousPosition = { x: 0, y: 0 };
  let initialDistance = null; // Used for pinch-to-zoom on mobile
  
  // Handle mouse and touch start
  const handleStart = (event) => {
    if (event.touches && event.touches.length === 1) {
      // Single touch: start drag
      isDragging = true;
      previousPosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    } else if (event.touches && event.touches.length === 2) {
      // Pinch-to-zoom start
      isDragging = false; // Disable dragging during zoom
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      initialDistance = Math.sqrt(dx * dx + dy * dy);
    } else if (event.type === 'mousedown') {
      // Mouse: start drag
      isDragging = true;
      previousPosition = { x: event.clientX, y: event.clientY };
    }
  };

  // Handle mouse and touch move
  const handleMove = (event) => {
    if (isDragging && (event.type === 'mousemove' || (event.touches && event.touches.length === 1))) {
      const currentPosition = event.touches
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
        : { x: event.clientX, y: event.clientY };

      const deltaMove = {
        x: currentPosition.x - previousPosition.x,
        y: currentPosition.y - previousPosition.y,
      };

      // Rotate the model
      model.scene.rotation.y += deltaMove.x * 0.01; // Horizontal rotation
      model.scene.rotation.x += deltaMove.y * 0.01; // Vertical rotation
      previousPosition = currentPosition;
    } else if (event.touches && event.touches.length === 2 && initialDistance) {
      // Pinch-to-zoom
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);

      // Adjust scale factor
      const zoomDelta = (currentDistance - initialDistance) * 0.005; // Adjust zoom sensitivity
      scaleFactor = Math.min(Math.max(scaleFactor + zoomDelta, 0.5), 2); // Clamp scale between 0.5 and 2
      model.scene.scale.set(scaleFactor, scaleFactor, scaleFactor);

      initialDistance = currentDistance; // Update the distance for next calculation
    }
  };

  // Handle mouse and touch end
  const handleEnd = () => {
    isDragging = false;
    initialDistance = null; // Reset pinch-to-zoom
  };

  // Add event listeners
  window.addEventListener('mousedown', handleStart);
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleEnd);

  window.addEventListener('touchstart', handleStart);
  window.addEventListener('touchmove', handleMove);
  window.addEventListener('touchend', handleEnd);
};

// Function to set up anchors with automatic animation, audio playback, and sound effect
const setupAnchorWithAutoAnimationAndAudio = async (mindarThree, model, anchorId, audioPath, sfxPath = null) => {
  const anchor = mindarThree.addAnchor(anchorId);
  anchor.group.add(model.scene);

  const mixer = new THREE.AnimationMixer(model.scene);
  const actions = model.animations.map(clip => mixer.clipAction(clip));

  // 1. Narration (Longer audio)
  const narration = new Audio(audioPath);
  narration.loop = true;

  // 2. Sound Effect (Short audio - only if sfxPath is provided)
  let sfx = null;
  if (sfxPath) {
    sfx = new Audio(sfxPath);
    sfx.loop = false; // Usually SFX shouldn't loop
  }

  anchor.onTargetFound = () => {
  model.scene.visible = true;

  activeModel = model;
  activeMixer = mixer;

  actions.forEach(action => {
    action.reset();
    action.play();
  });

  narration.currentTime = 0;
  narration.play().catch(() => {});
};

  anchor.onTargetLost = () => {
  model.scene.visible = false;

  if (activeModel === model) {
    activeModel = null;
    activeMixer = null;
  }

  actions.forEach(action => action.stop());
  narration.pause();

  if (model.interactionAudio) {
    model.interactionAudio.pause();
    model.interactionAudio.currentTime = 0;
  }
};


  return mixer;
};

const enableGlobalInteraction = (camera) => {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const handleInteraction = (event) => {
    if (!activeModel || !activeModel.scene.visible) return;

    if (event.touches) {
      pointer.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    } else {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(activeModel.scene.children, true);

    if (intersects.length > 0) {

      // Play only ACTIVE model SFX
      if (activeModel.interactionAudio) {
        activeModel.interactionAudio.currentTime = 0;
        activeModel.interactionAudio.play().catch(() => {});
      }

      //  Restart animation safely
      activeMixer._actions.forEach(action => {
        action.reset();
        action.play();
      });
    }
  };

  window.addEventListener("pointerdown", handleInteraction);
};


const startRenderingLoop = (renderer, scene, camera, options) => {
  renderer.setAnimationLoop(() => {
    const delta = renderer.clock.getDelta();
    if (options.update) options.update(delta);
    renderer.render(scene, camera);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  const start = async () => {
    const mindarThree = initializeMindAR();
    const { renderer, scene, camera } = mindarThree;

    renderer.clock = new THREE.Clock(); // Create a clock for animations
    setupLighting(scene); // Add lighting

    // Load models and set up anchors
    const page1Model = await loadModel('../../assets/models/pg1/pg1.glb', { x: 0.7, y: 0.7, z: 0.7 }, { x: 0, y: -0.4, z: 0 });
    const page2Model = await loadModel('../../assets/models/pg2/pg2.glb', { x: 0.7, y: 0.7, z: 0.7 }, { x: 0, y: -0.4, z: 0 });
    const page3Model = await loadModel('../../assets/models/pg3/pg3.glb', { x: 0.15, y: 0.15, z: 0.15 }, { x: 0, y: -0.4, z: 0 });
      page3Model.interactionAudio = new Audio('../../assets/audio/sfx/thunder2.mpeg');
      page3Model.interactionAudio.loop = false;
    const page4Model = await loadModel('../../assets/models/pg4/pg4.glb', { x: 0.5, y: 0.5, z: 0.5}, { x: -0.1, y: -0.7, z: -1.0 });
    const page5Model = await loadModel('../../assets/models/pg5/pg5.glb', { x: 0.3, y: 0.3, z: 0.3 }, { x: 0, y: -0.6, z: 0 });
    const page6Model = await loadModel('../../assets/models/pg6/pg6.glb', { x: 0.2, y: 0.2, z: 0.2 }, { x: 0, y: -0.4, z: 0 });
    const page7Model = await loadModel('../../assets/models/pg7/pg7.glb', { x: 1.2, y: 1.2, z: 1.2 }, { x: 0, y: -0.6, z: 0 });
    const page8Model = await loadModel('../../assets/models/pg8/pg8.glb', { x: 0.1, y: 0.1, z: 0.1 }, { x: 0, y: -0.5, z: 0 });
        page8Model.interactionAudio = new Audio('../../assets/audio/sfx/cheering.mp3');
        page8Model.interactionAudio.loop = false;
    const page9Model = await loadModel('../../assets/models/pg9/pg9.glb', { x: 0.1, y: 0.1, z: 0.1 }, { x: 0, y: -0.3, z: 0 });
        page9Model.interactionAudio = new Audio('../../assets/audio/sfx/ghost.mp3');
        page9Model.interactionAudio.loop = false;
    const page10Model = await loadModel('../../assets/models/pg10/pg10.glb', { x: 0.04, y: 0.04, z: 0.04 }, { x: 0, y: -0.4, z: 0 });
        page10Model.interactionAudio = new Audio('../../assets/audio/sfx/rain.mp3');
        page10Model.interactionAudio.loop = false;
    const page11Model = await loadModel('../../assets/models/pg11/page11.glb', { x: 0.06, y: 0.06, z: 0.06 }, { x: 0.5, y: -0.5, z: -1.5 });
    const page12Model = await loadModel('../../assets/models/pg12/pg12.glb', { x: 0.1, y: 0.1, z: 0.1 }, { x: 0, y: -0.8, z: 0 });
    const page13Model = await loadModel('../../assets/models/pg13/pg13.glb', { x: 0.1, y: 0.1, z: 0.1 }, { x: 0, y: -0.8, z: 0 });
    const page14Model = await loadModel('../../assets/models/pg14/pg14.glb', { x: 0.1, y: 0.1, z: 0.1 }, { x: 0, y: -0.4, z: 0 });
    const page15Model = await loadModel('../../assets/models/pg15/pg15.glb', { x: 0.12, y: 0.12, z: 0.12 }, { x: 0, y: -0.4, z: 0 });
        page15Model.interactionAudio = new Audio('../../assets/audio/sfx/peace.mp3');
        page15Model.interactionAudio.loop = false;

    const page1Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page1Model, 0, '../../assets/audio/dusun/SCENE 1.mp3')
    const page2Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page2Model, 1,  '../../assets/audio/dusun/SCENE 2.mp3');
    const page3Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page3Model, 2,  '../../assets/audio/dusun/SCENE 3.mp3');
    const page4Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page4Model, 3,  '../../assets/audio/dusun/SCENE 4.mp3');
    const page5Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page5Model, 4,  '../../assets/audio/dusun/SCENE 5.mp3');
    const page6Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page6Model, 5,  '../../assets/audio/dusun/SCENE 6.mp3');
    const page7Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page7Model, 6,  '../../assets/audio/dusun/SCENE 7.mp3');
    const page8Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page8Model, 7,  '../../assets/audio/dusun/SCENE 8.mp3');
    const page9Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page9Model, 8,  '../../assets/audio/dusun/SCENE 9.mp3');
    const page10Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page10Model, 9,  '../../assets/audio/dusun/SCENE 10.mp3')
    const page11Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page11Model, 10,  '../../assets/audio/dusun/SCENE 11.mp3')
    const page12Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page12Model, 11,  '../../assets/audio/dusun/SCENE 12.mp3');
    const page13Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page13Model, 12,  '../../assets/audio/dusun/SCENE 13.mp3')
    const page14Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page14Model, 13,  '../../assets/audio/dusun/SCENE 14.mp3');
    const page15Mixer = await setupAnchorWithAutoAnimationAndAudio(mindarThree, page15Model, 14,  '../../assets/audio/dusun/SCENE 15.mp3');

    // Enable interaction for each model
    enableZoomAndRotation(camera, page1Model);
    enableZoomAndRotation(camera, page2Model);
    enableZoomAndRotation(camera, page3Model);
    enableZoomAndRotation(camera, page4Model);
    enableZoomAndRotation(camera, page5Model);
    enableZoomAndRotation(camera, page6Model);
    enableZoomAndRotation(camera, page7Model);
    enableZoomAndRotation(camera, page8Model);
    enableZoomAndRotation(camera, page9Model);
    enableZoomAndRotation(camera, page10Model);
    enableZoomAndRotation(camera, page11Model);
    enableZoomAndRotation(camera, page12Model); 
    enableZoomAndRotation(camera, page13Model);
    enableZoomAndRotation(camera, page14Model);
    enableZoomAndRotation(camera, page15Model); 

    enableGlobalInteraction(camera);

    // Start AR session and rendering loop
    await mindarThree.start();
    startRenderingLoop(renderer, scene, camera, {
      update: (delta) => {
        page1Mixer.update(delta);
        page2Mixer.update(delta);
        page3Mixer.update(delta);
        page4Mixer.update(delta);
        page5Mixer.update(delta);
        page6Mixer.update(delta);
        page7Mixer.update(delta);
        page8Mixer.update(delta);
        page9Mixer.update(delta);
        page10Mixer.update(delta);
        page11Mixer.update(delta);
        page12Mixer.update(delta);
        page13Mixer.update(delta);
        page14Mixer.update(delta);
        page15Mixer.update(delta);
      },
    });
  };

  start();
});