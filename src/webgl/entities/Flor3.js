import * as THREE from "three";
import fragShader from "../shaders/top.frag?raw";
import vertShader from "../shaders/top.vert?raw";
import nx from "../../assets/textures/envmaps/0/nx.png";
import ny from "../../assets/textures/envmaps/0/ny.png";
import nz from "../../assets/textures/envmaps/0/nz.png";
import px from "../../assets/textures/envmaps/0/px.png";
import py from "../../assets/textures/envmaps/0/py.png";
import pz from "../../assets/textures/envmaps/0/pz.png";
import Debug from "../utils/Debug";
import matcap from "../../assets/textures/matcap/3.png";

export default class Flor {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this.amount = 100;
    this.size = 0.9;
    this.offset = (this.amount - 1) / 2;
    this.dummy = new THREE.Object3D();
    this.topDummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.gui = new Debug();

    const count = Math.pow(this.amount, 2);

    const cubeTextureLoader = new THREE.CubeTextureLoader();

    const environmentMapTexture = cubeTextureLoader.load([
      px,
      nx,
      py,
      ny,
      pz,
      nz,
    ]);

    // this.shaderMaterial = new THREE.ShaderMaterial({
    //   vertexShader: vertShader,
    //   fragmentShader: fragShader,
    // });

    const geometry = new THREE.BoxGeometry(this.size, this.size * 6, this.size);
    const material = new THREE.MeshStandardMaterial({
      color: 0xdfdfdf,
      metalness: 1,
      roughness: 0.5,
      envMap: environmentMapTexture,
    });


    const textureLoader = new THREE.TextureLoader();
    const matcapTexture = textureLoader.load(matcap);
    const matcapMaterial = new THREE.MeshMatcapMaterial({
      matcap: matcapTexture,
    });

    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `
        #include <common>
        varying vec3 vNewNormal;
        varying vec3 vEye;
        `
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <fog_vertex>",
        `
        #include <fog_vertex>

          vec4 newMvPosition = vec4( position, 1.0 );
          newMvPosition = instanceMatrix * newMvPosition;

          vec4 modelViewPosition = modelViewMatrix * newMvPosition;

          vNewNormal = normalize(normalMatrix * transformedNormal);
          vEye = normalize(vec3(modelViewMatrix * vec4(newMvPosition.xyz, 1.0)).xyz);
        `
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `
        #include <common>
        varying vec3 vNewNormal;
        varying vec3 vEye;
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <output_fragment>",
        `
        #ifdef OPAQUE
        diffuseColor.a = 1.0;
        #endif

        #ifdef USE_TRANSMISSION
        diffuseColor.a *= material.transmissionAlpha + 0.1;
        #endif

        float a = (1.0 - -min(dot(vEye, normalize(vNewNormal)), 0.0));

        vec3 color = vec3(0.,0.,1.);

        // gl_FragColor = vec4( colorJ * fresnelTerm, diffuseColor.a);
        gl_FragColor = vec4( vec3(a), 1.);
        `
      );
      // console.log(shader.fragmentShader)

      console.log(shader.vertexShader);
    };

    console.log(this.gui);
    this.gui.ui.add(material, "metalness", 0, 1, 0.01);
    this.gui.ui.add(material, "roughness", 0, 1, 0.01);

    this.instMesh = new THREE.InstancedMesh(geometry, matcapMaterial, count);

    const topGeometry = new THREE.BoxGeometry(
      this.size + 0.01,
      0.1,
      this.size + 0.01
    );
    const topMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.5,
      roughness: 0.5,
      envMap: environmentMapTexture,
    });
    this.gui.ui.add(topMaterial, "metalness", 0, 1, 0.01);
    this.gui.ui.add(topMaterial, "roughness", 0, 1, 0.01);
    this.topInstMesh = new THREE.InstancedMesh(topGeometry, matcapMaterial, count);

    this.peaks = [3550, 4465, 4840, 5250, 6350];
    this.colorsPeaks = [0xf72585, 0x7209b7, 0x3a0ca3, 0x4361ee, 0x4cc9f0];
    this.lighthouses = 5470;
    this.peakElevation = 5;
    this.mountSize = 4;
    this.mountPeaks = [];
    this.peaks.forEach((peak) => {
      const mountPeak = [];
      for (let i = 1; i <= this.mountSize; i++) {
        let circleMountPeak;
        if (mountPeak.length === 0) {
          circleMountPeak = [
            peak - i,
            peak + this.amount * i,
            peak + i,
            peak - this.amount * i,
          ];
        } else {
          circleMountPeak = [];

          for (let m = 0; m < mountPeak[mountPeak.length - 1].length; m++) {
            const upID = mountPeak[mountPeak.length - 1][m];

            const haut = upID - 1;
            const droite = upID + this.amount;
            const bas = upID + 1;
            const gauche = upID - this.amount;

            if (
              !this.peaks.includes(haut) &&
              !mountPeak[mountPeak.length - 1].includes(haut)
            )
              circleMountPeak.push(haut);
            if (
              !this.peaks.includes(droite) &&
              !mountPeak[mountPeak.length - 1].includes(droite)
            )
              circleMountPeak.push(droite);
            if (
              !this.peaks.includes(bas) &&
              !mountPeak[mountPeak.length - 1].includes(bas)
            )
              circleMountPeak.push(bas);
            if (
              !this.peaks.includes(gauche) &&
              !mountPeak[mountPeak.length - 1].includes(gauche)
            )
              circleMountPeak.push(gauche);
          }
        }

        mountPeak.push(circleMountPeak);
      }
      this.mountPeaks.push(mountPeak);
    });

    // raycaster
    this.raycaster = new THREE.Raycaster();
    this.currentIntersectId = null;
    this.mouse = new THREE.Vector2(-1, 1);

    window.addEventListener("mousemove", (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    this.init();
  }

  init() {
    let i = 0;
    let peaksStep = 0;
    const matrix = new THREE.Matrix4();
    const topMatrix = new THREE.Matrix4();

    for (let x = 0; x < this.amount; x++) {
      for (let z = 0; z < this.amount; z++) {
        matrix.setPosition(this.offset - x, 0, this.offset - z);
        topMatrix.setPosition(this.offset - x, 3.5, this.offset - z);
        this.instMesh.setMatrixAt(i, matrix);
        this.topInstMesh.setMatrixAt(i, topMatrix);

        if (this.isPeak(i)) {
          //Change le pic du milieu
          this.instMesh.setColorAt(
            i,
            this.color.setHex(this.colorsPeaks[peaksStep])
          );
          this.topInstMesh.setColorAt(i, this.color.setHex(0xffffff));
          peaksStep++;
        } else {
          this.topInstMesh.setColorAt(i, this.color.setHex(0xffffff));
          this.instMesh.setColorAt(i, this.color.setHex(0x363636));
        }

        i++;
      }
    }

    this.scene.add(this.instMesh, this.topInstMesh);
  }

  update() {
    if (this.instMesh) {
      let i = 0;
      const time = Date.now() * 0.001;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      this.intersects = this.raycaster.intersectObject(this.instMesh);

      if (this.intersects && this.intersects.length >= 1) {
        this.currentIntersectId = this.intersects[0].instanceId;
      } else {
        this.currentIntersectId = null;
      }

      for (let x = 0; x < this.amount; x++) {
        for (let z = 0; z < this.amount; z++) {
          if (i === this.currentIntersectId) {
            this.instMesh.setColorAt(i, new THREE.Color("#000000"));
            this.instMesh.instanceColor.needsUpdate = true;
          } else {
            // this.instMesh.setColorAt(i, new THREE.Color("#363636"))

            this.instMesh.instanceColor.needsUpdate = true;
          }

          let y = (Math.sin(x / 4 + time) + Math.sin(z / 4 + time)) * 0.2;

          if (this.isPeak(i)) {
            y += this.peakElevation;
          }

          if (i === this.lighthouses) {
            y += this.peakElevation;
          }

          for (let m = 0; m < this.mountPeaks.length; m++) {
            for (let r = 0; r < this.mountPeaks[m].length; r++) {
              if (this.mountPeaks[m][r].includes(i)) {
                //Change les values autour du pick
                y += this.peakElevation * (0.6 / (r + 1));
                this.topInstMesh.setColorAt(i, this.color.setHex(0xffffff));
                this.instMesh.setColorAt(
                  i,
                  this.color.setHex(this.colorsPeaks[m])
                );
              }
            }
          }

          this.dummy.position.set(this.offset - x, y, this.offset - z);
          this.dummy.updateMatrix();

          this.topDummy.position.set(
            this.offset - x,
            y + 2.75,
            this.offset - z
          );
          this.topDummy.updateMatrix();

          this.topInstMesh.setMatrixAt(i, this.topDummy.matrix);
          this.instMesh.setMatrixAt(i++, this.dummy.matrix);
        }
      }

      this.instMesh.instanceMatrix.needsUpdate = true;
      this.topInstMesh.instanceMatrix.needsUpdate = true;
    }
  }

  isPeak(i) {
    if (
      i === this.peaks[0] ||
      i === this.peaks[1] ||
      i === this.peaks[2] ||
      i === this.peaks[3] ||
      i === this.peaks[4]
    ) {
      return true;
    } else {
      return false;
    }
  }
}
