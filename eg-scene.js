/**
 * EMS 沙盘 3D — 自 energy-game (127.0.0.1:5174) 同构场景：住宅/光伏/储能/逆变/充电桩/粒子/爱小惟 GLB
 * 依赖：three.min.js + GLTFLoader-global.js
 */
(function(){
  'use strict';
  if(typeof THREE === 'undefined') return;

  var SCENE_MOODS = {
    neutral: { skyTop:0xb8c9dc, skyBot:0xe8eef5, dirCol:0xfff8f0, dirInt:0.78, ambCol:0xc5d4e8, ambInt:0.48, fog:0.010, fogCol:0xc5d0de, solarGlow:0.08, battGlow:0.10, flowSpd:0.30, flowOp:0.30, wind:0.30, emissive:0.10, exposure:0.98, rain:false },
    rain: { skyTop:0x0a0f18, skyBot:0x181f2a, dirCol:0x8899bb, dirInt:0.40, ambCol:0x3a4455, ambInt:0.35, fog:0.028, fogCol:0x141a28, solarGlow:0.02, battGlow:0.20, flowSpd:0.20, flowOp:0.25, wind:0.80, emissive:0.15, exposure:0.80, rain:true }
  };

  var moodTarget = SCENE_MOODS.neutral;
  /* 由页面按日期/时刻/预报写入，animate 向此目标插值（天空穹顶 + 雾 + 主光 + 曝光） */
  var weatherVisualTarget = {
    skyTop: 0xb8c9dc, skyBot: 0xe8eef5, fog: 0.010, fogCol: 0xc5d0de,
    dirCol: 0xfff8f0, dirInt: 0.78, ambCol: 0xc5d4e8, ambInt: 0.48, exposure: 0.98
  };
  var currentConfig = { solarGlow:0.06, batteryGlow:0.12, flowSpeed:0.3, flowOpacity:0.32, windStrength:0.3, emissive:0.12, exposure:0.92, accentColor:new THREE.Color(0x00e8ff) };
  var clock, scene, camera, renderer, sceneGroup, houseGroup, orbitControls;
  var houseWindowMats = [];
  var peopleGroup, householdFigs = [];
  var HOUSEHOLD_FIG_POOL = 25;
  var solarPanels = [], batteryLights = [], chargerVisGroup, chargerLight, flowParticles = [], flowTubeMats = [], trees = [], grasses = [], particleSystem;
  var skyDome, dirLight, ambLight, solarSpotLight, techLight, rainSystem, aiCharacter, aiMixer, _aiRingMesh;
  var hemiLight, fillLight, rimLight;
  var sunDisc, moonDisc, celestialGroup;
  var clockTarget = 12, clockSmooth = 12;
  var dirLightBaseInt = 0.82, ambLightBaseInt = 0.42;
  var hemiBaseInt = 0.38, fillBaseInt = 0.28, rimBaseInt = 0.22;
  var raf = 0;
  var canvasEl = null;
  var HOME_POS = null;
  var HOME_TARGET = new THREE.Vector3(0, 2.2, 0);

  function frameObject(obj, opts){
    try{
      opts = opts || {};
      if(!camera || !obj) return;
      var box = new THREE.Box3().setFromObject(obj);
      if(!box || !isFinite(box.min.x + box.max.x + box.min.y + box.max.y + box.min.z + box.max.z)) return;
      var size = new THREE.Vector3(); box.getSize(size);
      var center = new THREE.Vector3(); box.getCenter(center);
      var maxDim = Math.max(0.001, size.x, size.y, size.z);
      var pad = (opts.padding != null && isFinite(opts.padding)) ? +opts.padding : 1.25;
      // distance that fits maxDim in view (approx, use vertical fov)
      var fov = (camera.fov || 38) * Math.PI / 180;
      var dist = (maxDim / (2 * Math.tan(fov/2))) * pad;
      // keep within OrbitControls constraints
      var minD = orbitControls ? (orbitControls.minDistance || 0) : 0;
      var maxD = orbitControls ? (orbitControls.maxDistance || Infinity) : Infinity;
      dist = Math.max(minD ? minD*1.05 : 0, Math.min(maxD ? maxD*0.92 : dist, dist));
      // view direction (diagonal, slightly above)
      var dir = new THREE.Vector3(1, 0.55, 1).normalize();
      var pos = center.clone().add(dir.multiplyScalar(dist));
      camera.position.set(pos.x, pos.y, pos.z);
      camera.lookAt(center.x, center.y, center.z);
      if(orbitControls){
        orbitControls.target.set(center.x, center.y, center.z);
        orbitControls.update();
      }
      camera.updateProjectionMatrix && camera.updateProjectionMatrix();
      if(opts.setHome){
        HOME_POS = camera.position.clone();
        HOME_TARGET = center.clone();
      }
    }catch(e){}
  }

  function lerpV(a,b,t){ return a+(b-a)*t; }

  /** 0=深夜 1=正午，5:30–18:30 近似日出日落，sin 拱形 */
  function sunHeight01(hour){
    var t = ((hour % 24) + 24) % 24;
    var phase = (t - 5.5) / 13;
    if(phase <= 0 || phase >= 1) return 0;
    return Math.sin(phase * Math.PI);
  }

  function smoothstep01(edge0, edge1, x){
    var t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function createLighting(){
    ambLight = new THREE.AmbientLight(0xc5d4e8, 0.42); scene.add(ambLight);
    ambLightBaseInt = ambLight.intensity;
    hemiLight = new THREE.HemisphereLight(0xeef4ff, 0x6b7a8f, hemiBaseInt); hemiLight.position.set(0, 12, 0); scene.add(hemiLight);
    dirLight = new THREE.DirectionalLight(0xfff5eb, 0.82); dirLight.position.set(9, 16, 7); dirLight.castShadow = true;
    dirLightBaseInt = dirLight.intensity;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 0.5; dirLight.shadow.camera.far = 45;
    dirLight.shadow.camera.left = -12; dirLight.shadow.camera.right = 12;
    dirLight.shadow.camera.top = 12; dirLight.shadow.camera.bottom = -12;     dirLight.shadow.bias = -0.0008;
    scene.add(dirLight);
    techLight = new THREE.DirectionalLight(0x22d3ee, 0.24); techLight.position.set(-7, 9, -6); scene.add(techLight);
    solarSpotLight = new THREE.SpotLight(0xfff4dd, 0.0, 16, Math.PI / 5, 0.45, 1);
    solarSpotLight.position.set(3, 11, 4); solarSpotLight.target.position.set(0, 2.5, 0);
    scene.add(solarSpotLight); scene.add(solarSpotLight.target);
    fillLight = new THREE.DirectionalLight(0xffeedd, fillBaseInt); fillLight.position.set(-5, 6, 10); scene.add(fillLight);
    rimLight = new THREE.DirectionalLight(0xdde8ff, rimBaseInt); rimLight.position.set(-10, 8, -8); scene.add(rimLight);
    try{
      var neon = new THREE.PointLight(0x22d3ee, 0.55, 18, 2);
      neon.position.set(-4.8, 2.2, -3.6);
      neon.userData.panelType = 'tech';
      scene.add(neon);
      var neon2 = new THREE.PointLight(0xa855f7, 0.28, 16, 2);
      neon2.position.set(4.9, 2.4, 3.8);
      neon2.userData.panelType = 'tech';
      scene.add(neon2);
    }catch(e){}
    try{
      dirLight.shadow.radius = 2.2;
      dirLight.shadow.bias = -0.0014;
      dirLight.shadow.normalBias = 0.012;
      if(fillLight) fillLight.intensity = Math.max(fillLight.intensity, 0.34);
      if(rimLight) rimLight.intensity = Math.max(rimLight.intensity, 0.26);
    }catch(e){}
  }

  function createCelestialBodies(){
    celestialGroup = new THREE.Group();
    sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(1.55, 22, 22),
      new THREE.MeshBasicMaterial({ color: 0xffeecc, fog: false })
    );
    moonDisc = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 18, 18),
      new THREE.MeshBasicMaterial({ color: 0xe4e0f2, fog: false })
    );
    celestialGroup.add(sunDisc); celestialGroup.add(moonDisc);
    scene.add(celestialGroup);
  }

  function createSkyDome(){
    var geo = new THREE.SphereGeometry(60, 32, 32);
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x001830) },
        bottomColor: { value: new THREE.Color(0x051a2e) }
      },
      vertexShader: 'varying vec3 vWP;void main(){vWP=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform vec3 topColor;uniform vec3 bottomColor;varying vec3 vWP;void main(){float h=clamp(normalize(vWP).y*0.6+0.4,0.0,1.0);gl_FragColor=vec4(mix(bottomColor,topColor,h),1.0);}',
      side: THREE.BackSide, depthWrite: false
    });
    skyDome = new THREE.Mesh(geo, mat); scene.add(skyDome);
  }

  function applyDiurnalCelestial(dt){
    var lag = Math.min(1, (dt || 0.016) * 2.2);
    clockSmooth += (clockTarget - clockSmooth) * lag;
    var sh = sunHeight01(clockSmooth);
    var dist = 56;
    var az = (clockSmooth / 24) * Math.PI * 2 - Math.PI * 0.2;
    var el = sh * 1.05 * (Math.PI / 2.25);
    var sx = Math.cos(el) * Math.cos(az) * dist;
    var sy = Math.sin(el) * dist + 9;
    var sz = Math.cos(el) * Math.sin(az) * dist;
    if(sunDisc){
      sunDisc.position.set(sx, sy, sz);
      sunDisc.visible = sh > 0.035;
    }
    var maz = az + Math.PI;
    var mel = 0.36 + (1 - sh) * 0.22;
    var md = dist * 0.9;
    var mx = Math.cos(mel) * Math.cos(maz) * md;
    var my = Math.sin(mel) * md + 7;
    var mz = Math.cos(mel) * Math.sin(maz) * md;
    if(moonDisc){
      moonDisc.position.set(mx, my, mz);
      moonDisc.visible = sh < 0.38;
    }
    if(dirLight){
      dirLight.position.set(sx, sy, sz);
      dirLight.target.position.set(0, 2.2, 0);
      dirLight.target.updateMatrixWorld();
      var sunMul = 0.06 + 0.94 * Math.pow(sh, 0.82);
      dirLight.intensity = dirLightBaseInt * sunMul;
      var moonTint = smoothstep01(0.28, 0.06, sh);
      dirLight.color.lerp(new THREE.Color(0xb8d4ff), moonTint * 0.55);
      dirLight.castShadow = sh > 0.07;
    }
    if(hemiLight){
      hemiLight.intensity = hemiBaseInt * (0.32 + 0.68 * sh) + (1 - sh) * 0.12;
    }
    if(fillLight){
      fillLight.intensity = fillBaseInt * (0.25 + 0.75 * sh);
    }
    if(rimLight){
      rimLight.intensity = rimBaseInt * (0.2 + 0.8 * sh);
    }
    if(ambLight){
      ambLight.intensity = ambLightBaseInt * (0.48 + 0.58 * sh);
      ambLight.color.lerp(new THREE.Color(0xb4c4e8), (1 - sh) * 0.18);
    }
    if(solarSpotLight){
      solarSpotLight.intensity = currentConfig.solarGlow * 0.95 * sh;
      solarSpotLight.position.set(sx * 0.25 + 1.5, Math.max(3.5, sy * 0.4 + 3.5), sz * 0.25 - 1.2);
      solarSpotLight.target.position.set(0, 2.2, 0);
      solarSpotLight.target.updateMatrixWorld();
    }
  }

  function createGround(){
    // Ground should read as "stone/concrete pad" distinct from vegetation.
    var slab = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 18), new THREE.MeshStandardMaterial({ color:0x1a2230, roughness:0.96, metalness:0.02 }));
    slab.userData.panelType = 'ground';
    slab.position.y = -0.15; slab.receiveShadow = true; sceneGroup.add(slab);
    var grass = new THREE.Mesh(new THREE.BoxGeometry(18, 0.16, 18), new THREE.MeshStandardMaterial({ color:0x0f2a1c, roughness:0.92, metalness:0.0, emissive:0x001008, emissiveIntensity:0.10 }));
    grass.userData.panelType = 'ground';
    grass.position.y = 0; grass.receiveShadow = true; sceneGroup.add(grass);
    try{
      slab.material.roughness = 0.98;
      slab.material.metalness = 0.02;
      grass.material.roughness = 0.95;
      grass.material.emissiveIntensity = 0.08;
    }catch(e){}
    var drive = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.17, 5.8), new THREE.MeshStandardMaterial({ color:0x1a3048, roughness:0.72, metalness:0.18 }));
    drive.userData.panelType = 'ground';
    drive.position.set(3.35, 0.01, 3.45); drive.receiveShadow = true; sceneGroup.add(drive);
    var grid = new THREE.GridHelper(18, 18, 0x00a8cc, 0x003348); grid.position.y = 0.17;
    grid.userData.panelType = 'ground';
    var gmat = grid.material;
    if(Array.isArray(gmat)){ gmat.forEach(function(m){ m.opacity = 0.12; m.transparent = true; }); }
    else { gmat.opacity = 0.12; gmat.transparent = true; }
    sceneGroup.add(grid);
    for(var i=0;i<5;i++){
      var stone = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.06,8), new THREE.MeshStandardMaterial({ color:0x2a3040, roughness:0.85 }));
      stone.position.set(1.4, 0.05, 1.0+i*0.7); stone.receiveShadow = true; sceneGroup.add(stone);
    }
  }

  function createGarageWithEV(){
    var gg = new THREE.Group();
    gg.userData.panelType = 'garage';
    var wallW = new THREE.MeshStandardMaterial({ color:0xeeeff5, roughness:0.42, metalness:0.06 });
    var wallTrim = new THREE.MeshStandardMaterial({ color:0x3b4659, roughness:0.38, metalness:0.2 });
    var fl = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.07, 2.35), wallW.clone());
    fl.position.set(0, 0.035, 0); fl.receiveShadow = true; gg.add(fl);
    var back = new THREE.Mesh(new THREE.BoxGeometry(2.55, 1.58, 0.11), wallW.clone());
    back.position.set(0, 0.79, -1.12); back.castShadow = true; back.receiveShadow = true; gg.add(back);
    var innerGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.32, 1.32), new THREE.MeshStandardMaterial({
      color:0xffaa66, emissive:0xff7722, emissiveIntensity:1.1, roughness:1, side:THREE.DoubleSide
    }));
    innerGlow.position.set(0, 0.72, -1.055); innerGlow.rotation.y = Math.PI; gg.add(innerGlow);
    var left = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.58, 2.35), wallW.clone());
    left.position.set(-1.22, 0.79, 0); left.castShadow = true; gg.add(left);
    var right = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.58, 2.35), wallW.clone());
    right.position.set(1.22, 0.79, 0); right.castShadow = true; gg.add(right);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.09, 2.48), wallTrim.clone());
    roof.position.set(0, 1.63, 0); roof.castShadow = true; gg.add(roof);
    var eaveLed = new THREE.Mesh(new THREE.BoxGeometry(2.48, 0.022, 0.05), new THREE.MeshStandardMaterial({
      color:0xffeedd, emissive:0xffccaa, emissiveIntensity:0.72, roughness:0.28
    }));
    eaveLed.position.set(0, 1.51, 1.14); gg.add(eaveLed);
    var car = new THREE.Group();
    var paint = new THREE.MeshStandardMaterial({ color:0xf8fafc, roughness:0.22, metalness:0.22 });
    var winCar = new THREE.MeshStandardMaterial({
      color:0x0a1624, roughness:0.04, metalness:0.48, emissive:0x3d2818, emissiveIntensity:0.32
    });
    var bod = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.31, 0.52), paint);
    bod.position.set(0, 0.35, 0.12); bod.castShadow = true; car.add(bod);
    var top = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.21, 0.45), winCar);
    top.position.set(-0.04, 0.55, 0.1); car.add(top);
    var rubber = new THREE.MeshStandardMaterial({ color:0x171a20, roughness:0.94 });
    [[-0.37, 0.12, 0.25], [0.37, 0.12, 0.25], [-0.37, 0.12, -0.21], [0.37, 0.12, -0.21]].forEach(function(p){
      var wh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14), rubber);
      wh.rotation.z = Math.PI / 2; wh.position.set(p[0], p[1], p[2]); wh.castShadow = true; car.add(wh);
    });
    car.position.set(0, 0, 0.06);
    gg.add(car);
    gg.position.set(5.18, 0, 0.42);
    houseGroup.add(gg);
    var glPl = new THREE.PointLight(0xffaa88, 0.58, 5.8, 2);
    glPl.position.set(5.18, 1.05, 0.55);
    houseGroup.add(glPl);
  }

  function createHouse(){
    houseGroup = new THREE.Group(); houseGroup.userData.panelType = 'house';
    houseWindowMats.length = 0;
    var wallMat = new THREE.MeshStandardMaterial({ color:0xf1f4f9, roughness:0.36, metalness:0.07 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.5, 3.3), wallMat);
    body.position.set(0, 1.75, 0); body.castShadow = true; body.receiveShadow = true; houseGroup.add(body);
    var wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 3.1), wallMat.clone());
    wing.position.set(3.3, 1.25, -0.1); wing.castShadow = true; wing.receiveShadow = true; houseGroup.add(wing);
    var roofMat = new THREE.MeshStandardMaterial({ color:0x1e2a3d, roughness:0.82, metalness:0.06 });
    var rs = new THREE.Shape(); rs.moveTo(0, 0); rs.lineTo(5.0, 0); rs.lineTo(2.5, 1.7); rs.closePath();
    var roof = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: 3.9, bevelEnabled: false }), roofMat);
    roof.position.set(-2.5, 3.5, -1.95); roof.castShadow = true; houseGroup.add(roof);
    var wrs = new THREE.Shape(); wrs.moveTo(0, 0); wrs.lineTo(2.5, 0); wrs.lineTo(1.25, 1.0); wrs.closePath();
    var wingRoof = new THREE.Mesh(new THREE.ExtrudeGeometry(wrs, { depth: 3.2, bevelEnabled: false }), roofMat.clone());
    wingRoof.position.set(2.2, 2.5, -1.6); wingRoof.castShadow = true; houseGroup.add(wingRoof);
    var frameDark = new THREE.MeshStandardMaterial({ color:0x2f3848, roughness:0.32, metalness:0.28 });
    var doorSide = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.05, 0.07), frameDark);
    doorSide.position.set(-1.08, 1.02, 1.67); houseGroup.add(doorSide);
    var slideMat = new THREE.MeshStandardMaterial({
      color:0x1a0a04, emissive:0xffaa55, emissiveIntensity:1.38, roughness:0.05, metalness:0.22, transparent: true, opacity: 0.93
    });
    slideMat.userData.baseEmit = 1.38;
    houseWindowMats.push(slideMat);
    var sliding = new THREE.Mesh(new THREE.BoxGeometry(1.88, 1.96, 0.045), slideMat);
    sliding.position.set(0.48, 1.05, 1.668); sliding.name = 'slidingDoor'; houseGroup.add(sliding);
    var winPositions = [[-1.1, 2.28, 1.68], [1.2, 2.28, 1.68], [0, 0.98, 1.68], [3.3, 1.88, 1.66], [-2.2, 1.88, -1.68]];
    var winFrameMat = new THREE.MeshStandardMaterial({ color:0xdfe4ee, roughness:0.4, metalness:0.14 });
    var winMullMat = new THREE.MeshStandardMaterial({ color:0xd0d6e2, roughness:0.42, metalness:0.08 });
    var winSillMat = new THREE.MeshStandardMaterial({ color:0xc8ced9, roughness:0.55, metalness:0.06 });
    winPositions.forEach(function(pos, widx){
      var x = pos[0], y = pos[1], z = pos[2];
      var wg = new THREE.Group(); wg.position.set(x, y, z);
      var outerF = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.68, 0.05), winFrameMat.clone());
      outerF.position.z = -0.025; outerF.castShadow = true; wg.add(outerF);
      var emInt = 1.05 + (widx % 4) * 0.1;
      var glassMat = new THREE.MeshStandardMaterial({
        color:0x081526,
        emissive:0x1a2a3f,
        emissiveIntensity: Math.max(0.22, emInt * 0.55),
        roughness:0.02,
        metalness:0.62,
        transparent: true,
        opacity: 0.72
      });
      glassMat.userData.baseEmit = emInt;
      houseWindowMats.push(glassMat);
      var glass = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.56, 0.016), glassMat); glass.name = 'window'; wg.add(glass);
      var mv = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.54, 0.03), winMullMat.clone()); wg.add(mv);
      var mh = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.032, 0.03), winMullMat.clone()); mh.position.y = 0.07; wg.add(mh);
      var sill = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.046, 0.15), winSillMat.clone());
      sill.position.set(0, -0.36, -0.04); sill.castShadow = true; wg.add(sill);
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.04, 0.09), winSillMat.clone()); head.position.set(0, 0.36, -0.016); wg.add(head);
      houseGroup.add(wg);
    });
    var ledMat = new THREE.MeshStandardMaterial({ color:0xffeedd, emissive:0xffddbb, emissiveIntensity:0.52, roughness:0.35 });
    var ledRoof = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.028, 0.04), ledMat);
    ledRoof.position.set(0, 3.49, 1.67); ledRoof.name = 'ledRoof'; houseGroup.add(ledRoof);
    var inPl = new THREE.PointLight(0xffb070, 0.52, 7.5, 2);
    inPl.position.set(0.4, 2.35, 0.2); houseGroup.add(inPl);
    var inPl2 = new THREE.PointLight(0xffaa77, 0.38, 5.5, 2);
    inPl2.position.set(3.15, 1.55, 0); houseGroup.add(inPl2);
    createGarageWithEV();
    sceneGroup.add(houseGroup);
    createSolarPanels(); createBatteryWall(); createEVCharger(); createGardenLights();
  }

  var SHIRT_COLORS = [0x3b82f6, 0x6366f1, 0x22c55e, 0xeab308, 0xf97316, 0xec4899, 0x14b8a6, 0xa855f7];
  function createOneHouseholdFig(i){
    var g = new THREE.Group();
    var legMat = new THREE.MeshStandardMaterial({ color:0x1e293b, roughness:0.78 });
    var leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.1), legMat);
    leg.position.set(-0.05, 0.1, 0); g.add(leg);
    var leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.1), legMat);
    leg2.position.set(0.05, 0.1, 0); g.add(leg2);
    var shirt = new THREE.MeshStandardMaterial({
      color: SHIRT_COLORS[i % SHIRT_COLORS.length], roughness:0.62, metalness:0.06,
      emissive: SHIRT_COLORS[i % SHIRT_COLORS.length], emissiveIntensity:0.08
    });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.14), shirt);
    torso.position.y = 0.36; g.add(torso);
    var head = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 10, 10),
      new THREE.MeshStandardMaterial({ color:0xf0cfa8, roughness:0.55 })
    );
    head.position.y = 0.6; g.add(head);
    g.scale.setScalar(1.8);
    g.traverse(function(c){
      if(c.isMesh){ c.castShadow = true; c.receiveShadow = true; }
    });
    return g;
  }
  function pointInHouseFootprint(x, z){
    if(x >= -2.5 && x <= 2.5 && z >= -1.85 && z <= 1.85) return true;
    if(x >= 1.95 && x <= 4.85 && z >= -1.8 && z <= 1.6) return true;
    if(x >= 3.9 && x <= 6.75 && z >= -0.45 && z <= 2.25) return true;
    return false;
  }
  function pointOnDrive(x, z){
    return x >= 1.55 && x <= 4.95 && z >= 0.25 && z <= 6.85;
  }
  /* 草坪随机点：前院偏左、侧院、后院，避开房屋与车道；placed 为已占用的 {x,z} */
  function randomLawnXZ(placed, minDist){
    var minD2 = minDist * minDist;
    for(var attempt = 0; attempt < 55; attempt++){
      var x, z, u = Math.random();
      if(u < 0.58){
        x = -7.5 + Math.random() * 8.9;
        z = 2.35 + Math.random() * 5.2;
      }else if(u < 0.82){
        x = -7.5 + Math.random() * 4.15;
        z = -1.5 + Math.random() * 5.0;
      }else{
        x = -3.8 + Math.random() * 7.6;
        z = -6.9 + Math.random() * 3.35;
      }
      if(pointInHouseFootprint(x, z) || pointOnDrive(x, z)) continue;
      if(Math.abs(x) > 8.5 || Math.abs(z) > 8.5) continue;
      var ok = true;
      for(var p = 0; p < placed.length; p++){
        var dx = x - placed[p].x, dz = z - placed[p].z;
        if(dx * dx + dz * dz < minD2){ ok = false; break; }
      }
      if(ok) return { x: x, z: z };
    }
    return null;
  }
  function fallbackLawnGridSlot(index){
    var cols = 5;
    var baseX = -6.2;
    var baseZ = 2.85;
    var stepX = 1.05;
    var stepZ = 0.95;
    var col = index % cols;
    var row = Math.floor(index / cols);
    return { x: baseX + col * stepX, z: baseZ + row * stepZ };
  }
  function createHouseholdFigures(){
    peopleGroup = new THREE.Group();
    peopleGroup.userData.panelType = 'household';
    for(var i = 0; i < HOUSEHOLD_FIG_POOL; i++){
      var fig = createOneHouseholdFig(i);
      fig.visible = false;
      householdFigs.push(fig);
      peopleGroup.add(fig);
    }
    sceneGroup.add(peopleGroup);
    setHouseholdPeople(3);
  }
  function setHouseholdPeople(n){
    if(!householdFigs.length) return;
    n = Math.max(1, Math.min(HOUSEHOLD_FIG_POOL, Math.floor(Number(n)) || 1));
    var placed = [];
    var minSep = 0.55;
    for(var j = 0; j < householdFigs.length; j++){
      var show = j < n;
      householdFigs[j].visible = show;
      if(show){
        var pt = randomLawnXZ(placed, minSep);
        if(!pt) pt = fallbackLawnGridSlot(placed.length);
        placed.push(pt);
        householdFigs[j].position.set(pt.x, 0.04, pt.z);
        householdFigs[j].rotation.y = Math.random() * Math.PI * 2;
      }
    }
  }

  function createSolarPanels(){
    var pMat = new THREE.MeshStandardMaterial({ color:0x143d7a, roughness:0.035, metalness:0.88, emissive:0x0a2866, emissiveIntensity:0.28 });
    var frameMat = new THREE.MeshStandardMaterial({ color:0x5a6578, roughness:0.22, metalness:0.92 });
    var cellMat = new THREE.MeshStandardMaterial({ color:0x1e4a8c, roughness:0.35, metalness:0.35, emissive:0x123a78, emissiveIntensity:0.18 });
    var mountMat = new THREE.MeshStandardMaterial({ color:0x6b7280, roughness:0.26, metalness:0.92 });
    /* 主屋顶 mesh：Shape (0,0)-(5,0)-(2.5,1.7) 在 XY 上，沿本地 +Z 挤出 depth=3.9；mesh.position (-2.5,3.5,-1.95) */
    var roofOx = -2.5, roofOy = 3.5, roofOz = -1.95;
    var ridgeX = 2.5;
    var rise = 1.7;
    var runL = ridgeX;
    var runR = 5 - ridgeX;
    var nL = new THREE.Vector3(-rise, runL, 0).normalize();
    var nR = new THREE.Vector3(rise, runR, 0).normalize();
    var qL = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nL);
    var qR = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nR);
    var skin = 0.06;
    for(var r=0;r<3;r++) for(var c=0;c<5;c++){
      var pg = new THREE.Group(); pg.userData.panelType = 'solar';
      var frame = new THREE.Mesh(new THREE.BoxGeometry(0.78,0.024,0.50), frameMat.clone()); frame.castShadow = true; pg.add(frame);
      var panel = new THREE.Mesh(new THREE.BoxGeometry(0.72,0.030,0.44), pMat.clone()); panel.position.y = 0.008; panel.castShadow = true; pg.add(panel);
      for(var i=0;i<3;i++){ var ln = new THREE.Mesh(new THREE.BoxGeometry(0.70,0.003,0.0025), cellMat.clone()); ln.position.set(0,0.019,-0.145+i*0.145); pg.add(ln); }
      for(var iv=0;iv<5;iv++){ var ln2 = new THREE.Mesh(new THREE.BoxGeometry(0.0025,0.003,0.43), cellMat.clone()); ln2.position.set(-0.28+iv*0.14,0.019,0); pg.add(ln2); }
      var rail = new THREE.Mesh(new THREE.BoxGeometry(0.72,0.040,0.058), mountMat.clone()); rail.position.set(0,-0.028,0.17); rail.castShadow = true; pg.add(rail);
      var lz = 0.42 + r * 1.36;
      var lx, ly, q, n;
      if(c < 3){
        lx = skin + 0.55 + c * 0.78;
        ly = (rise / runL) * lx;
        q = qL;
        n = nL;
      } else {
        lx = 2.68 + (c - 3) * 1.92;
        if(lx > 4.82) lx = 4.82;
        ly = (rise / runR) * (5 - lx);
        q = qR;
        n = nR;
      }
      var wx = roofOx + lx;
      var wy = roofOy + ly;
      var wz = roofOz + lz;
      pg.position.set(wx, wy, wz);
      pg.quaternion.copy(q);
      pg.position.addScaledVector(n, 0.022);
      pg.visible = false;
      houseGroup.add(pg);
      solarPanels.push({ group:pg, panelMesh:panel, r:r, c:c });
    }
  }

  function createBatteryWall(){
    batteryLights.length = 0;
    var wg = new THREE.Group(); wg.userData.panelType = 'battery';
    var slate = 0x5a6d88;
    var frameMat = new THREE.MeshStandardMaterial({ color:0x4a5d78, roughness:0.4, metalness:0.52 });
    var bodyMat = new THREE.MeshStandardMaterial({ color:slate, roughness:0.36, metalness:0.5, emissive:0x0a1524, emissiveIntensity:0.07 });
    var ribMat = new THREE.MeshStandardMaterial({ color:0x4d6078, roughness:0.3, metalness:0.42 });
    var seamMat = new THREE.MeshStandardMaterial({ color:0x2c3848, roughness:0.55, metalness:0.45 });
    var darkGloss = new THREE.MeshStandardMaterial({ color:0x080c12, roughness:0.18, metalness:0.72, emissive:0x002238, emissiveIntensity:0.35 });

    var pillarH = 2.08;
    var lp = new THREE.Mesh(new THREE.BoxGeometry(0.075, pillarH, 0.2), frameMat);
    lp.position.set(-0.545, 0.02, 0); lp.castShadow = true; wg.add(lp);
    var rp = new THREE.Mesh(new THREE.BoxGeometry(0.075, pillarH, 0.2), frameMat);
    rp.position.set(0.545, 0.02, 0); rp.castShadow = true; wg.add(rp);

    var modH = 0.31;
    var gap = 0.018;
    var bottomY = -0.92;
    for(var mi = 0; mi < 5; mi++){
      var cy = bottomY + modH / 2 + mi * (modH + gap);
      var mod = new THREE.Mesh(new THREE.BoxGeometry(0.9, modH, 0.22), bodyMat.clone());
      mod.position.set(0, cy, 0.02); mod.castShadow = true; wg.add(mod);
    }
    var seamV = new THREE.Mesh(new THREE.BoxGeometry(0.022, 1.58, 0.12), seamMat);
    seamV.position.set(0.32, -0.02, 0.125); wg.add(seamV);
    var statBar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.28, 0.035), new THREE.MeshStandardMaterial({ color:0x141820, roughness:0.28, metalness:0.55 }));
    statBar.position.set(0.405, 0.02, 0.132); wg.add(statBar);

    var cyan = 0x00e5f5;
    for(var li = 0; li < 6; li++){
      var led = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.048, 0.018), new THREE.MeshStandardMaterial({ color:cyan, emissive:cyan, emissiveIntensity:0.92, roughness:0.15 }));
      led.position.set(0.405, 0.52 - li * 0.208, 0.152);
      wg.add(led);
      batteryLights.push(led);
    }

    var trap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.2, 0.028), darkGloss);
    trap.position.set(-0.06, -0.86, 0.128); trap.rotation.z = -0.05; wg.add(trap);
    var pillMat = new THREE.MeshStandardMaterial({ color:0xeef6ff, emissive:0xc8dcff, emissiveIntensity:0.55, roughness:0.25 });
    var pillA = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.1, 0.014), pillMat);
    pillA.position.set(0.1, 0.32, 0.124); wg.add(pillA);
    var pillB = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.1, 0.014), pillMat);
    pillB.position.set(0.155, 0.32, 0.124); wg.add(pillB);

    var invG = new THREE.Group();
    var invBody = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.36, 0.2), bodyMat.clone());
    invBody.castShadow = true; invG.add(invBody);
    var ribRoot = new THREE.Group();
    ribRoot.position.set(0.255, 0, 0.105);
    for(var ri = 0; ri < 16; ri++){
      var slat = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.3, 0.018), ribMat.clone());
      slat.rotation.z = Math.PI / 4;
      slat.position.set(ri * 0.024 - 0.175, 0, 0);
      ribRoot.add(slat);
    }
    invG.add(ribRoot);
    var invDisp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.035), darkGloss.clone());
    invDisp.position.set(-0.14, -0.11, 0.112); invG.add(invDisp);
    var warnTri = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.045, 0.018), new THREE.MeshStandardMaterial({ color:0xff1a3a, emissive:0xff0022, emissiveIntensity:1.15 }));
    warnTri.position.set(0.3, -0.13, 0.108); invG.add(warnTri);

    var invY = bottomY + 5 * modH + 4 * gap + modH / 2 + 0.04 + 0.18;
    invG.position.set(0, invY, 0);
    wg.add(invG);

    wg.position.set(-2.2, 1.9, -1.5); wg.rotation.y = 0.35; sceneGroup.add(wg);
  }

  function createEVCharger(){
    chargerVisGroup = new THREE.Group(); chargerVisGroup.userData.panelType = 'charger';
    var shellMat = new THREE.MeshStandardMaterial({ color:0x7a90b8, roughness:0.32, metalness:0.48, emissive:0x1a2840, emissiveIntensity:0.09 });
    var shell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), shellMat);
    shell.scale.set(1, 1.42, 0.62);
    shell.position.set(0, 0.38, 0);
    shell.castShadow = true;
    chargerVisGroup.add(shell);
    var backPlate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.72, 0.06), new THREE.MeshStandardMaterial({ color:0x3a4558, roughness:0.4, metalness:0.5 }));
    backPlate.position.set(0, 0.38, -0.12);
    chargerVisGroup.add(backPlate);
    var green = 0x00ff88;
    var bar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.022, 0.018), new THREE.MeshStandardMaterial({ color:green, emissive:green, emissiveIntensity:1.05, roughness:0.2 }));
    bar.position.set(0, 0.58, 0.19);
    chargerVisGroup.add(bar);
    chargerLight = bar;
    var portRing = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 20), new THREE.MeshStandardMaterial({ color:0x2a3038, roughness:0.35, metalness:0.65 }));
    portRing.rotation.x = Math.PI / 2;
    portRing.position.set(0, 0.12, 0.175);
    chargerVisGroup.add(portRing);
    var cable = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.55, 8), new THREE.MeshStandardMaterial({ color:0x1a1c22, roughness:0.75, metalness:0.15 }));
    cable.position.set(0.14, 0.08, 0.14); cable.rotation.z = 0.45; cable.rotation.x = 0.12; chargerVisGroup.add(cable);
    chargerVisGroup.position.set(2.0, 0.2, 1.8); chargerVisGroup.visible = false; sceneGroup.add(chargerVisGroup);
  }

  function createGardenLights(){
    [[2.8,0,2.5],[-2.8,0,2.5],[4.5,0,0.5],[-3.8,0,-2.0]].forEach(function(p){
      var x=p[0],y=p[1],z=p[2];
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.85,6), new THREE.MeshStandardMaterial({ color:0x334455, roughness:0.6 }));
      post.position.set(x,0.43,z); sceneGroup.add(post);
      var globe = new THREE.Mesh(new THREE.SphereGeometry(0.09,8,8), new THREE.MeshStandardMaterial({ color:0xffeedd, emissive:0xffeedd, emissiveIntensity:1.8, transparent:true, opacity:0.92 }));
      globe.position.set(x,0.94,z); sceneGroup.add(globe);
      var pl = new THREE.PointLight(0xffeedd, 0.35, 4.5); pl.position.set(x,0.94,z); scene.add(pl);
    });
  }

  function createTrees(){
    for(var i=0;i<6;i++){
      var g = new THREE.Group();
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.10,1.3,8), new THREE.MeshStandardMaterial({ color:0x4a3728, roughness:0.95, metalness:0.0 }));
      trunk.position.y = 0.65; g.add(trunk);
      // Layered foliage for more "organic" feel vs ground
      var folMat = new THREE.MeshStandardMaterial({ color:0x1f6b3c, roughness:0.85, metalness:0.0 });
      var fol = new THREE.Mesh(new THREE.SphereGeometry(0.72,12,10), folMat);
      fol.position.y = 1.6; g.add(fol);
      var fol2 = new THREE.Mesh(new THREE.SphereGeometry(0.55,12,10), folMat.clone());
      fol2.material.color.offsetHSL(0.02, -0.05, 0.03);
      fol2.position.set(0.18, 1.85, -0.08);
      g.add(fol2);
      g.position.set(-5.5+i*2.2, 0, -3.5-(i%2)*0.8); g.userData.phase = Math.random()*Math.PI*2; g.userData.windScale = 0.8+Math.random()*0.4;
      sceneGroup.add(g); trees.push(g);
    }
  }

  function createGrasses(){
    for(var i=0;i<35;i++){
      var h = 0.18+Math.random()*0.30;
      var m = new THREE.MeshStandardMaterial({ color:0x2f7a44, roughness:0.95, metalness:0.0, side:THREE.DoubleSide });
      // slight per-blade variation
      try{ m.color.offsetHSL((Math.random()-0.5)*0.03, (Math.random()-0.5)*0.06, (Math.random()-0.5)*0.04); }catch(e){}
      var b = new THREE.Mesh(new THREE.PlaneGeometry(0.05,h), m);
      b.position.set((Math.random()-0.5)*11, h/2, (Math.random()-0.5)*11); b.rotation.y = Math.random()*Math.PI; b.userData.phase = Math.random()*Math.PI*2; sceneGroup.add(b); grasses.push(b);
    }
  }

  function createEnergyFlowLines(){
    [{ from:new THREE.Vector3(0,3.5,-1.0), to:new THREE.Vector3(-0.9,2.0,-0.3), color:0xffee88 },
     { from:new THREE.Vector3(-0.9,2.0,-0.3), to:new THREE.Vector3(1.6,1.0,1.5), color:0x00e8ff }].forEach(function(path){
      var curve = new THREE.CatmullRomCurve3([path.from.clone(), new THREE.Vector3((path.from.x+path.to.x)/2,(path.from.y+path.to.y)/2+0.3,(path.from.z+path.to.z)/2), path.to.clone()]);
      var tm = new THREE.MeshStandardMaterial({ color:path.color, emissive:path.color, emissiveIntensity:0.5, transparent:true, opacity:0.3, blending:THREE.AdditiveBlending, depthWrite:false });
      sceneGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve,30,0.018,6,false), tm)); flowTubeMats.push(tm);
      var fp = new THREE.Mesh(new THREE.SphereGeometry(0.046,8,8), new THREE.MeshStandardMaterial({ color:path.color, emissive:path.color, emissiveIntensity:2.0, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false }));
      fp.userData.curve = curve; fp.userData.t = Math.random(); fp.userData.speed = 0.3+Math.random()*0.2; sceneGroup.add(fp); flowParticles.push(fp);
    });
  }

  function createParticles(){
    var count = 180, geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count*3), vel = new Float32Array(count*3);
    for(var i=0;i<count;i++){
      pos[i*3]=(Math.random()-0.5)*18; pos[i*3+1]=Math.random()*9; pos[i*3+2]=(Math.random()-0.5)*18;
      vel[i*3]=(Math.random()-0.5)*0.008; vel[i*3+1]=Math.random()*0.004+0.002; vel[i*3+2]=(Math.random()-0.5)*0.008;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3)); geo.userData = { velocities: vel };
    particleSystem = new THREE.Points(geo, new THREE.PointsMaterial({ color:0x40d8ff, size:0.03, transparent:true, opacity:0.16, blending:THREE.AdditiveBlending, depthWrite:false }));
    scene.add(particleSystem);
  }

  function createRainSystem(){
    var count = 320, pos = new Float32Array(count*6);
    for(var i=0;i<count;i++){
      var x=(Math.random()-0.5)*22, y=Math.random()*18, z=(Math.random()-0.5)*22;
      pos[i*6]=x; pos[i*6+1]=y; pos[i*6+2]=z; pos[i*6+3]=x+0.28; pos[i*6+4]=y-0.58; pos[i*6+5]=z;
    }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    rainSystem = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color:0x8899cc, transparent:true, opacity:0.60, blending:THREE.AdditiveBlending }));
    rainSystem.visible = false; scene.add(rainSystem);
  }

  function loadAICharacter(){
    if(typeof THREE.GLTFLoader === 'undefined') return;
    var loader = new THREE.GLTFLoader();
    loader.load('aiwei.glb', function(gltf){
      if(aiCharacter && sceneGroup) sceneGroup.remove(aiCharacter);
      aiMixer = null;
      aiCharacter = gltf.scene; aiCharacter.userData.panelType = 'ai';
      var box = new THREE.Box3().setFromObject(aiCharacter);
      var size = new THREE.Vector3(); box.getSize(size);
      var maxDim = Math.max(size.x, size.y, size.z);
      var targetH = 1.75;
      var scl = (size.y > 1e-4) ? (targetH / size.y) : (maxDim > 1e-4 ? targetH / maxDim : 0.55);
      if(scl < 0.015) scl = 0.015;
      if(scl > 20) scl = 20;
      aiCharacter.scale.setScalar(scl);
      aiCharacter.rotation.y = -Math.PI * 0.5;
      /* 车道前开阔处，避免贴房体被挡；水平对准目标点后再贴地 */
      var targetX = 4.35;
      var targetZ = 3.55;
      aiCharacter.position.set(targetX, 0, targetZ);
      var box2 = new THREE.Box3().setFromObject(aiCharacter);
      var center = new THREE.Vector3(); box2.getCenter(center);
      aiCharacter.position.x += targetX - center.x;
      aiCharacter.position.z += targetZ - center.z;
      var box3 = new THREE.Box3().setFromObject(aiCharacter);
      // three.js Box3 exposes .min/.max, not getMin/getMax
      aiCharacter.position.y = -(box3 && box3.min ? box3.min.y : 0);
      aiCharacter.traverse(function(c){
        if(c.isMesh){
          c.castShadow = true; c.receiveShadow = true;
        }
      });
      if(gltf.animations && gltf.animations.length){
        aiMixer = new THREE.AnimationMixer(aiCharacter);
        var idleClip = THREE.AnimationClip.findByName(gltf.animations,'idle') || gltf.animations[0];
        aiMixer.clipAction(idleClip).play();
      }
      // keep only the model; disable extra emissive “ring” lighting effect
      _aiRingMesh = null;
      sceneGroup.add(aiCharacter);
    }, undefined, function(err){
      if(typeof console !== 'undefined' && console.warn){
        console.warn('[EMS 3D] aiwei.glb 加载失败：请用本地 http 服务打开（勿用 file://），并确认 glb 与页面同目录。', err);
      }
    });
  }

  function setEquip(eq){
    if(!solarPanels.length) return;
    var n = Math.min(15, Math.max(0, (eq.pv||0)*2)|0);
    solarPanels.forEach(function(sp, idx){
      sp.group.visible = idx < n;
    });
    if(chargerVisGroup){
      chargerVisGroup.visible = (eq.evse|0) > 0;
    }
  }

  function animateLoop(){
    raf = requestAnimationFrame(animateLoop);
    var dt = clock.getDelta(), time = clock.getElapsedTime();
    if(aiMixer) aiMixer.update(dt);
    if(_aiRingMesh){
      _aiRingMesh.material.emissiveIntensity = 0.8+Math.sin(time*2.2)*0.5;
      _aiRingMesh.rotation.z = time*0.4;
    }
    if(skyDome && weatherVisualTarget){
      var kw = 0.085;
      skyDome.material.uniforms.topColor.value.lerp(new THREE.Color(weatherVisualTarget.skyTop), kw);
      skyDome.material.uniforms.bottomColor.value.lerp(new THREE.Color(weatherVisualTarget.skyBot), kw);
      if(scene.fog && weatherVisualTarget.fog != null){
        scene.fog.density = lerpV(scene.fog.density, weatherVisualTarget.fog, kw);
        if(weatherVisualTarget.fogCol != null && scene.fog.color && scene.fog.color.lerp){
          scene.fog.color.lerp(new THREE.Color(weatherVisualTarget.fogCol), kw);
        }
      }
      if(ambLight && weatherVisualTarget.ambCol != null && ambLight.color && ambLight.color.lerp){
        ambLight.color.lerp(new THREE.Color(weatherVisualTarget.ambCol), kw);
      }
      if(weatherVisualTarget.ambInt != null){
        ambLightBaseInt = lerpV(ambLightBaseInt, weatherVisualTarget.ambInt, kw);
      }
      if(dirLight && weatherVisualTarget.dirCol != null && dirLight.color && dirLight.color.lerp){
        dirLight.color.lerp(new THREE.Color(weatherVisualTarget.dirCol), kw);
      }
      if(weatherVisualTarget.dirInt != null){
        dirLightBaseInt = lerpV(dirLightBaseInt, weatherVisualTarget.dirInt, kw);
      }
      if(weatherVisualTarget.exposure != null){
        renderer.toneMappingExposure = lerpV(renderer.toneMappingExposure, weatherVisualTarget.exposure, kw);
      }
    }
    if(moodTarget){
      var km = 0.028;
      currentConfig.solarGlow = lerpV(currentConfig.solarGlow, moodTarget.solarGlow, km);
      currentConfig.batteryGlow = lerpV(currentConfig.batteryGlow, moodTarget.battGlow, km);
      currentConfig.flowSpeed = lerpV(currentConfig.flowSpeed, moodTarget.flowSpd, km);
      currentConfig.flowOpacity = lerpV(currentConfig.flowOpacity, moodTarget.flowOp, km);
      currentConfig.windStrength = lerpV(currentConfig.windStrength, moodTarget.wind, km);
      currentConfig.emissive = lerpV(currentConfig.emissive, moodTarget.emissive, km);
    }
    if(houseWindowMats.length){
      var wp = 0.94 + Math.sin(time * 1.65) * 0.07;
      for(var wi = 0; wi < houseWindowMats.length; wi++){
        var wm = houseWindowMats[wi];
        if(wm && wm.userData && wm.userData.baseEmit != null) wm.emissiveIntensity = wm.userData.baseEmit * wp;
      }
    }
    if(orbitControls){
      orbitControls.update();
    }else{
      var ca = time * 0.018;
      var camR = 13.5;
      var baseX = Math.sin(ca) * camR, baseZ = Math.cos(ca) * camR;
      camera.position.x = lerpV(camera.position.x, baseX, 0.06);
      camera.position.y = lerpV(camera.position.y, 9.0 + Math.sin(time * 0.18) * 0.4, 0.04);
      camera.position.z = lerpV(camera.position.z, baseZ, 0.06);
      camera.lookAt(0, 2.2, 0);
    }

    solarPanels.forEach(function(sp){
      if(!sp.panelMesh.parent.visible) return;
      var pulse = Math.sin(time*2.0+sp.r*0.5+sp.c*0.3)*0.2+0.8;
      sp.panelMesh.material.emissiveIntensity = currentConfig.solarGlow*pulse;
    });
    batteryLights.forEach(function(led,i){
      var wave = (Math.sin(time*1.5-i*0.6)*0.5+0.5);
      led.material.emissiveIntensity = lerpV(led.material.emissiveIntensity, currentConfig.batteryGlow*wave, 0.05);
    });
    flowParticles.forEach(function(fp){
      fp.userData.t += dt*currentConfig.flowSpeed*fp.userData.speed;
      if(fp.userData.t>1) fp.userData.t -= 1;
      fp.position.copy(fp.userData.curve.getPoint(fp.userData.t));
      fp.material.opacity = currentConfig.flowOpacity*(Math.sin(time*4+fp.userData.t*Math.PI*6)*0.3+0.7);
    });
    flowTubeMats.forEach(function(m){
      m.opacity = lerpV(m.opacity, currentConfig.flowOpacity*0.35, 0.04);
      m.emissiveIntensity = lerpV(m.emissiveIntensity, currentConfig.emissive*0.6, 0.04);
    });
    trees.forEach(function(t){
      t.rotation.z = Math.sin(time*0.9+t.userData.phase)*0.035*currentConfig.windStrength*t.userData.windScale;
    });
    grasses.forEach(function(b){
      b.rotation.z = Math.sin(time*2.2+b.userData.phase)*0.20*currentConfig.windStrength;
    });
    if(particleSystem && particleSystem.geometry && particleSystem.geometry.attributes.position){
      var posArr = particleSystem.geometry.attributes.position.array;
      var velArr = particleSystem.geometry.userData.velocities;
      for(var i=0;i<posArr.length/3;i++){
        posArr[i*3]+=velArr[i*3]*0.2; posArr[i*3+1]+=velArr[i*3+1]*0.2; posArr[i*3+2]+=velArr[i*3+2]*0.2;
        if(posArr[i*3+1]>10){ posArr[i*3+1]=0; posArr[i*3]=(Math.random()-0.5)*18; posArr[i*3+2]=(Math.random()-0.5)*18; }
      }
      particleSystem.geometry.attributes.position.needsUpdate = true;
    }
    if(rainSystem && rainSystem.visible){
      var rp = rainSystem.geometry.attributes.position.array;
      var ws = currentConfig.windStrength;
      for(var ri=0;ri<rp.length/6;ri++){
        rp[ri*6]+=ws*0.055; rp[ri*6+1]-=0.23; rp[ri*6+3]+=ws*0.055; rp[ri*6+4]-=0.23;
        if(rp[ri*6+1]<-1){
          var x=(Math.random()-0.5)*22, y=16+Math.random()*5, z=(Math.random()-0.5)*22;
          rp[ri*6]=x; rp[ri*6+1]=y; rp[ri*6+2]=z; rp[ri*6+3]=x+0.28; rp[ri*6+4]=y-0.58; rp[ri*6+5]=z;
        }
      }
      rainSystem.geometry.attributes.position.needsUpdate = true;
    }
    applyDiurnalCelestial(dt);
    renderer.render(scene, camera);
  }

  window.initEmsEnergyScene = function(canvas){
    canvasEl = canvas;
    clock = new THREE.Clock();
    scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.FogExp2(0x001820, 0.013);
    camera = new THREE.PerspectiveCamera(38, canvas.width/Math.max(canvas.height,1), 0.1, 150);
    camera.position.set(11,9,11); camera.lookAt(0,2,0);
    HOME_POS = camera.position.clone();
    HOME_TARGET = new THREE.Vector3(0, 2.2, 0);
    renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
    renderer.setSize(canvas.width, canvas.height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if(renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    try{
      if(renderer.physicallyCorrectLights !== undefined) renderer.physicallyCorrectLights = true;
    }catch(e){}
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

    if(typeof THREE.OrbitControls === 'function'){
      orbitControls = new THREE.OrbitControls(camera, canvas);
      orbitControls.target.set(0, 2.2, 0);
      orbitControls.enableDamping = true;
      orbitControls.dampingFactor = 0.07;
      orbitControls.minDistance = 7;
      orbitControls.maxDistance = 42;
      orbitControls.minPolarAngle = 0.18;
      orbitControls.maxPolarAngle = Math.PI / 2 - 0.06;
      orbitControls.enablePan = true;
      orbitControls.screenSpacePanning = true;
      /* 无拖动时绕目标自动旋转；拖动/缩放时 OrbitControls 内部 state 非 NONE，自动转停 */
      orbitControls.autoRotate = true;
      orbitControls.autoRotateSpeed = 0.85;
    }

    sceneGroup = new THREE.Group(); scene.add(sceneGroup);
    createLighting(); createSkyDome(); createCelestialBodies(); createGround(); createHouse();
    createTrees(); createGrasses(); createEnergyFlowLines(); createParticles(); createRainSystem();
    createHouseholdFigures();
    loadAICharacter();

    moodTarget = SCENE_MOODS.neutral;
    animateLoop();

    var api = {
      renderer: renderer,
      scene: scene,
      camera: camera,
      canvas: canvas,
      rain: rainSystem,
      hemi: null,
      get sun(){ return dirLight; },
      resetView: function(){
        try{
          if(!camera) return;
          var hp = HOME_POS || new THREE.Vector3(11,9,11);
          var ht = HOME_TARGET || new THREE.Vector3(0,2.2,0);
          camera.position.set(hp.x, hp.y, hp.z);
          camera.lookAt(ht.x, ht.y, ht.z);
          if(orbitControls){
            orbitControls.target.set(ht.x, ht.y, ht.z);
            orbitControls.update();
          }
          camera.updateProjectionMatrix && camera.updateProjectionMatrix();
        }catch(e){}
      },
      frameObject: function(obj, opts){
        frameObject(obj, opts);
      },
      setMoodRain: function(on){
        moodTarget = on ? SCENE_MOODS.rain : SCENE_MOODS.neutral;
        if(rainSystem) rainSystem.visible = !!on;
      },
      setWeatherVisuals: function(partial){
        if(!partial || typeof partial !== 'object') return;
        if(partial.skyTop != null) weatherVisualTarget.skyTop = partial.skyTop;
        if(partial.skyBot != null) weatherVisualTarget.skyBot = partial.skyBot;
        if(partial.fog != null) weatherVisualTarget.fog = partial.fog;
        if(partial.fogCol != null) weatherVisualTarget.fogCol = partial.fogCol;
        if(partial.dirCol != null) weatherVisualTarget.dirCol = partial.dirCol;
        if(partial.dirInt != null) weatherVisualTarget.dirInt = partial.dirInt;
        if(partial.ambCol != null) weatherVisualTarget.ambCol = partial.ambCol;
        if(partial.ambInt != null) weatherVisualTarget.ambInt = partial.ambInt;
        if(partial.exposure != null) weatherVisualTarget.exposure = partial.exposure;
      },
      setSimulationClock: function(hour){
        var t = parseFloat(hour);
        if(!isFinite(t)) t = 12;
        clockTarget = Math.max(0, Math.min(23.999, t));
      },
      setExhibitInteraction: function(opts){
        if(!opts || !orbitControls) return;
        if(opts.autoRotateSpeed != null && isFinite(+opts.autoRotateSpeed)) orbitControls.autoRotateSpeed = +opts.autoRotateSpeed;
        if(opts.autoRotate === true || opts.autoRotate === false) orbitControls.autoRotate = !!opts.autoRotate;
      },
      setEquip: setEquip,
      setHouseholdPeople: setHouseholdPeople,
      resize: function(){
        if(!canvasEl) return;
        var r = canvasEl.parentElement.getBoundingClientRect();
        canvasEl.width = r.width; canvasEl.height = r.height;
        camera.aspect = r.width/Math.max(r.height,1);
        camera.updateProjectionMatrix();
        renderer.setSize(r.width, r.height, false);
      },
      dispose: function(){
        if(raf) cancelAnimationFrame(raf);
        if(orbitControls){
          orbitControls.dispose();
          orbitControls = null;
        }
      }
    };
    return api;
  };
})();
