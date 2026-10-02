/* =========================================================
   JCN THREE.JS VIEWER
   three-customer.js
========================================================= */

import * as THREE from "three";

import {
  OrbitControls
} from "three/addons/controls/OrbitControls.js";

import {
  GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";


/* =========================================================
   STATE
========================================================= */

let scene = null;

let camera = null;

let renderer = null;

let controls = null;

let apparelModel = null;

let container = null;

let currentDesignTexture = null;

let animationFrame = null;

let customerPhotoPlane = null;
let customerPhotoTexture = null;

/* =========================================================
   INITIALIZE
========================================================= */

export function initializeThreeViewer() {

  container =
    document.getElementById(
      "previewStage"
    );


  if (!container) {

    throw new Error(
      "#previewStage not found."
    );

  }


  /*
    Prevent duplicate canvas.
  */

  const oldCanvas =
    container.querySelector(
      "canvas[data-three-customer]"
    );


  if (oldCanvas) {

    oldCanvas.remove();

  }


  const width =
    container.clientWidth;


  const height =
    container.clientHeight;


  if (
    width <= 0 ||
    height <= 0
  ) {

    throw new Error(
      "3D preview has invalid size."
    );

  }


  /* =====================================================
     SCENE
  ===================================================== */

  scene =
    new THREE.Scene();


  scene.background =
    null;


  /* =====================================================
     CAMERA
  ===================================================== */

  camera =
    new THREE.PerspectiveCamera(
      35,
      width / height,
      0.1,
      100
    );


  camera.position.set(
    0,
    0,
    5
  );


  /* =====================================================
     RENDERER
  ===================================================== */

  renderer =
    new THREE.WebGLRenderer({

      antialias:
        true,

      alpha:
        true

    });


  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio,
      2
    )
  );


  renderer.setSize(
    width,
    height
  );


  renderer.outputColorSpace =
    THREE.SRGBColorSpace;


  renderer.domElement.dataset.threeCustomer =
    "true";


  renderer.domElement.style.position =
    "absolute";


  renderer.domElement.style.inset =
    "0";


  renderer.domElement.style.width =
    "100%";


  renderer.domElement.style.height =
    "100%";


  renderer.domElement.style.zIndex =
    "2";


  renderer.domElement.style.display =
    "block";


  renderer.domElement.style.touchAction =
    "none";


  container.appendChild(
    renderer.domElement
  );


  /* =====================================================
     LIGHTS
  ===================================================== */

  const ambient =
    new THREE.AmbientLight(
      0xffffff,
      1.8
    );


  scene.add(
    ambient
  );


  const frontLight =
    new THREE.DirectionalLight(
      0xffffff,
      3
    );


  frontLight.position.set(
    4,
    5,
    5
  );


  scene.add(
    frontLight
  );


  const leftLight =
    new THREE.DirectionalLight(
      0xffffff,
      2
    );


  leftLight.position.set(
    -4,
    2,
    4
  );


  scene.add(
    leftLight
  );


  const backLight =
    new THREE.DirectionalLight(
      0xffffff,
      1.5
    );


  backLight.position.set(
    0,
    3,
    -5
  );


  scene.add(
    backLight
  );


  const bottomLight =
    new THREE.DirectionalLight(
      0xffffff,
      0.8
    );


  bottomLight.position.set(
    0,
    -4,
    3
  );


  scene.add(
    bottomLight
  );


  /* =====================================================
     ORBIT CONTROLS
     360° ROTATION
  ===================================================== */

  controls =
    new OrbitControls(
      camera,
      renderer.domElement
    );


  controls.enableRotate =
    true;


  controls.enableZoom =
    true;


  controls.enablePan =
    false;


  controls.enableDamping =
    true;


  controls.dampingFactor =
    0.07;


  controls.rotateSpeed =
    0.65;


  controls.zoomSpeed =
    0.8;


  /*
    Unlimited horizontal rotation.
  */

  controls.minAzimuthAngle =
    -Infinity;


  controls.maxAzimuthAngle =
    Infinity;


  /*
    Prevent extreme vertical flipping.
  */

  controls.minPolarAngle =
    Math.PI * 0.25;


  controls.maxPolarAngle =
    Math.PI * 0.75;


  controls.minDistance =
    2.5;


  controls.maxDistance =
    8;


  controls.target.set(
    0,
    0,
    0
  );


  controls.update();


  /* =====================================================
     HIDE OLD PLACEHOLDER
  ===================================================== */

  const placeholder =
    document.getElementById(
      "shirtPlaceholder"
    );


  if (placeholder) {

    placeholder.style.display =
      "none";

  }


  /* =====================================================
     RESIZE
  ===================================================== */

  window.addEventListener(
    "resize",
    resizeThreeViewer
  );


  animate();


  console.log(
    "THREE: Viewer initialized."
  );

}


/* =========================================================
   LOAD MODEL
========================================================= */

export function loadThreeApparelModel(
  modelUrl
) {

  return new Promise(
    function (
      resolve,
      reject
    ) {

      if (!scene) {

        reject(
          new Error(
            "Three.js viewer not initialized."
          )
        );


        return;

      }


      if (!modelUrl) {

        reject(
          new Error(
            "model_url is empty."
          )
        );


        return;

      }


      console.log(
        "THREE: Loading model:",
        modelUrl
      );


      const loader =
        new GLTFLoader();


      loader.load(

        modelUrl,


        function (gltf) {

          console.log(
            "THREE: GLB loaded successfully."
          );


          /* REMOVE OLD MODEL */

          if (
            apparelModel
          ) {

            scene.remove(
              apparelModel
            );


            disposeModel(
              apparelModel
            );


            apparelModel =
              null;

          }


          apparelModel =
            gltf.scene;


          /* PREPARE MATERIAL */

          apparelModel.traverse(
            function (child) {

              if (
                !child.isMesh
              ) {

                return;

              }


              if (
                Array.isArray(
                  child.material
                )
              ) {

                child.material =
                  child.material.map(
                    function (material) {

                      const cloned =
                        material.clone();


                      cloned.side =
                        THREE.DoubleSide;


                      return cloned;

                    }
                  );

              } else if (
                child.material
              ) {

                child.material =
                  child.material.clone();


                child.material.side =
                  THREE.DoubleSide;

              }

            }
          );


          scene.add(
            apparelModel
          );


          centerModel(
            apparelModel
          );


          resetThreeViewer();


          resolve(
            apparelModel
          );

        },


        function (progress) {

          if (
            progress.total > 0
          ) {

            const percentage =
              (
                progress.loaded /
                progress.total
              ) *
              100;


            console.log(
              `THREE: ${percentage.toFixed(0)}%`
            );

          }

        },


        function (error) {

          console.error(
            "THREE MODEL ERROR:",
            error
          );


          reject(
            error
          );

        }

      );

    }
  );

}


/* =========================================================
   CENTER AND SCALE
========================================================= */

function centerModel(model) {

  /*
    First calculate original dimensions.
  */

  const firstBox =
    new THREE.Box3()
      .setFromObject(
        model
      );


  const firstSize =
    new THREE.Vector3();


  const firstCenter =
    new THREE.Vector3();


  firstBox.getSize(
    firstSize
  );


  firstBox.getCenter(
    firstCenter
  );


  /*
    Move original center to origin.
  */

  model.position.x -=
    firstCenter.x;


  model.position.y -=
    firstCenter.y;


  model.position.z -=
    firstCenter.z;


  /*
    Normalize scale.
  */

  const largest =
    Math.max(
      firstSize.x,
      firstSize.y,
      firstSize.z
    );


  if (
    largest > 0
  ) {

    const desiredSize =
      3;


    const scale =
      desiredSize /
      largest;


    model.scale.multiplyScalar(
      scale
    );

  }


  /*
    Recenter after scaling.
  */

  const finalBox =
    new THREE.Box3()
      .setFromObject(
        model
      );


  const finalCenter =
    new THREE.Vector3();


  finalBox.getCenter(
    finalCenter
  );


  model.position.x -=
    finalCenter.x;


  model.position.y -=
    finalCenter.y;


  model.position.z -=
    finalCenter.z;


  console.log(
    "THREE: Model centered."
  );

}


/* =========================================================
   CHANGE COLOR
========================================================= */

export function changeThreeApparelColor(
  hex
) {

  if (
    !apparelModel ||
    !hex
  ) {

    return;

  }


  console.log(
    "THREE: Changing color:",
    hex
  );


  apparelModel.traverse(
    function (child) {

      if (
        !child.isMesh ||
        !child.material
      ) {

        return;

      }


      const materials =
        Array.isArray(
          child.material
        )
          ? child.material
          : [child.material];


      materials.forEach(
        function (material) {

          if (
            material.color
          ) {

            material.color.set(
              hex
            );


            material.needsUpdate =
              true;

          }

        }
      );

    }
  );

}


/* =========================================================
   FRONT
========================================================= */

export function showThreeFront() {

  if (
    !apparelModel
  ) {

    return;

  }


  apparelModel.rotation.y =
    0;


  console.log(
    "THREE: Front view."
  );

}


/* =========================================================
   BACK
========================================================= */

export function showThreeBack() {

  if (
    !apparelModel
  ) {

    return;

  }


  apparelModel.rotation.y =
    Math.PI;


  console.log(
    "THREE: Back view."
  );

}


/* =========================================================
   RESET
========================================================= */

export function resetThreeViewer() {

  if (
    apparelModel
  ) {

    apparelModel.rotation.set(
      0,
      0,
      0
    );

  }


  if (
    camera
  ) {

    camera.position.set(
      0,
      0,
      5
    );

  }


  if (
    controls
  ) {

    controls.target.set(
      0,
      0,
      0
    );


    controls.update();

  }


  console.log(
    "THREE: Viewer reset."
  );

}


/* =========================================================
   DESIGN
========================================================= */

export function applyThreeDesign(
  imageUrl
) {

  if (
    !apparelModel ||
    !imageUrl
  ) {

    console.warn(
      "THREE: Cannot apply design."
    );


    return;

  }


  const loader =
    new THREE.TextureLoader();


  loader.load(

    imageUrl,


    function (texture) {

      if (
        currentDesignTexture
      ) {

        currentDesignTexture.dispose();

      }


      currentDesignTexture =
        texture;


      texture.colorSpace =
        THREE.SRGBColorSpace;


      /*
        IMPORTANT:

        Temporary implementation.

        For proper shirt printing,
        your GLB should ideally contain
        a separate PrintAreaFront mesh.
      */


      let printMeshFound =
        false;


      apparelModel.traverse(
        function (child) {

          if (
            !child.isMesh ||
            !child.material
          ) {

            return;

          }


          const meshName =
            String(
              child.name ||
              ""
            ).toLowerCase();


          /*
            Preferred dedicated print mesh.
          */

          if (
            meshName.includes(
              "print"
            ) ||
            meshName.includes(
              "design"
            ) ||
            meshName.includes(
              "logo"
            )
          ) {

            printMeshFound =
              true;


            const materials =
              Array.isArray(
                child.material
              )
                ? child.material
                : [child.material];


            materials.forEach(
              function (material) {

                material.map =
                  texture;


                material.needsUpdate =
                  true;

              }
            );

          }

        }
      );


      if (
        !printMeshFound
      ) {

        console.warn(
          "THREE: GLB does not have a dedicated PrintArea mesh."
        );

      }

    },


    undefined,


    function (error) {

      console.error(
        "THREE DESIGN ERROR:",
        error
      );

    }

  );

}


/* =========================================================
   REMOVE DESIGN
========================================================= */

export function removeThreeDesign() {

  if (
    !apparelModel
  ) {

    return;

  }


  apparelModel.traverse(
    function (child) {

      if (
        !child.isMesh ||
        !child.material
      ) {

        return;

      }


      const meshName =
        String(
          child.name ||
          ""
        ).toLowerCase();


      if (
        meshName.includes(
          "print"
        ) ||
        meshName.includes(
          "design"
        ) ||
        meshName.includes(
          "logo"
        )
      ) {

        const materials =
          Array.isArray(
            child.material
          )
            ? child.material
            : [child.material];


        materials.forEach(
          function (material) {

            if (
              material.map ===
              currentDesignTexture
            ) {

              material.map =
                null;


              material.needsUpdate =
                true;

            }

          }
        );

      }

    }
  );


  if (
    currentDesignTexture
  ) {

    currentDesignTexture.dispose();


    currentDesignTexture =
      null;

  }

}


/* =========================================================
   ANIMATION
========================================================= */

function animate() {

  animationFrame =
    requestAnimationFrame(
      animate
    );


  if (
    controls
  ) {

    controls.update();

  }


  if (
    renderer &&
    scene &&
    camera
  ) {

    renderer.render(
      scene,
      camera
    );

  }

}


/* =========================================================
   RESIZE
========================================================= */

function resizeThreeViewer() {

  if (
    !container ||
    !renderer ||
    !camera
  ) {

    return;

  }


  const width =
    container.clientWidth;


  const height =
    container.clientHeight;


  if (
    width <= 0 ||
    height <= 0
  ) {

    return;

  }


  camera.aspect =
    width /
    height;


  camera.updateProjectionMatrix();


  renderer.setSize(
    width,
    height
  );

}


/* =========================================================
   DISPOSE MODEL
========================================================= */

function disposeModel(model) {

  model.traverse(
    function (child) {

      if (
        !child.isMesh
      ) {

        return;

      }


      if (
        child.geometry
      ) {

        child.geometry.dispose();

      }


      if (
        child.material
      ) {

        const materials =
          Array.isArray(
            child.material
          )
            ? child.material
            : [child.material];


        materials.forEach(
          function (material) {

            material.dispose();

          }
        );

        

      }

    }
  );

}