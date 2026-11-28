/* Winter scenery for the original village in preview/2026. */
window.WinterScenery = (() => {
  'use strict';

  const NORTH_GATE = -41;
  const isVillage = (x, z) => Math.abs(x) <= 42 && z >= NORTH_GATE && z <= 42;
  const smooth = (a, b, value) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const waves = (x, z) =>
    Math.sin(x * 1.71 + z * 1.25) * .51 + Math.sin(z * 2.18 - x * .72) * .29 +
    Math.cos(z * .55 + x * .94) * .20;

  // Keep the far side of the arch clear and blend into the existing terrain at the fence.
  const villageMaskGLSL = `
    float villageMask(vec2 p) {
      return smoothstep(-41.0, -39.0, p.y) *
        (1.0 - smoothstep(40.0, 43.0, max(abs(p.x), p.y)));
    }
    float snowWave(vec2 p) {
      return 0.51 * sin(p.x * 1.71 + p.y * 1.25) +
        0.29 * sin(p.y * 2.18 - p.x * 0.72) + 0.20 * cos(p.y * 0.55 + p.x * 0.94);
    }
  `;

  function shadeSurface(material, key, fragment, { vertex = '', uniforms = {} } = {}) {
    const compile = material.onBeforeCompile;
    material.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      const varyings = 'varying vec3 vSnowWorld; varying vec2 vSnowSurface;\n';
      shader.vertexShader = varyings + shader.vertexShader.replace('#include <project_vertex>', `
        vec4 snowWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          snowWorld = instanceMatrix * snowWorld;
        #endif
        vSnowWorld = (modelMatrix * snowWorld).xyz;
        vSnowSurface = vec2(position.y, normalize(objectNormal).y);
        ${vertex}
        #include <project_vertex>
      `);
      shader.fragmentShader = varyings + villageMaskGLSL + shader.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + fragment);
      shader.fragmentShader = Object.keys(uniforms)
        .map(name => 'uniform float ' + name + ';\n').join('') + shader.fragmentShader;
    };
    material.customProgramCacheKey = () => 'winter-scenery-' + key;
    material.needsUpdate = true;
  }

  function shapeSnowGround(geometry, roadClear, plazas, stairs) {
    const position = geometry.attributes.position;
    const color = geometry.attributes.color;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i);
      if (!isVillage(x, z)) continue;
      const boundary = smooth(-41, -39, z) * (1 - smooth(39, 42, Math.max(Math.abs(x), z)));
      const wave = waves(x, z);
      let apron = roadClear(x, z);
      for (const [cx, cz, radius] of plazas) {
        apron = Math.min(apron, Math.hypot(x - cx, z - cz) - radius);
      }
      for (const stair of stairs) {
        const dx = Math.max(stair.xl - x, 0, x - stair.xr);
        const dz = Math.max(stair.b - z, 0, z - stair.a);
        apron = Math.min(apron, Math.hypot(dx, dz) - .55);
      }
      const drift = boundary * smooth(-.62, 1.25, apron + wave * .52);
      position.setY(i, position.getY(i) + drift * (.19 + wave * .075));
      color.setXYZ(i, color.getX(i) * (1 - .10 * boundary + .10 * drift),
        color.getY(i) * (1 - .057 * boundary + .057 * drift), color.getZ(i));
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    // The terrain includes coincident vertices at stairs. Keep their original slope normals.
    geometry.computeBoundingSphere();
  }

  function shadePaths(MAT) {
    const surface = (edge) => `
      vec2 groundPoint = vSnowWorld.xz;
      float variation = snowWave(groundPoint);
      float snowEdge = smoothstep(0.63, 1.04, ${edge} + 0.14 * variation);
      vec3 packed = diffuseColor.rgb * vec3(0.76, 0.74, 0.74);
      packed += variation * 0.033;
      vec3 frosted = mix(packed, vec3(0.78, 0.85, 0.93), snowEdge * 0.83);
      float village = villageMask(groundPoint);
      diffuseColor.rgb = mix(diffuseColor.rgb, frosted, village);
      diffuseColor.a *= 1.0 - snowEdge * village * 0.48;
    `;
    shadeSurface(MAT.dirt, 'path', surface('abs(vUv.x * 2.0 - 1.0)'));
    shadeSurface(MAT.plazaDirt, 'plaza', surface('length(vUv - 0.5) * 2.0'));
  }

  function roofSnow(THREE, scene, batches) {
    const points = [], slopes = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const p = new THREE.Vector3(), q = new THREE.Vector3(), r = new THREE.Vector3();
    for (const batch of batches) {
      const { position, normal } = batch.geo.attributes;
      const index = batch.geo.index;
      const count = index ? index.count : position.count;
      for (const matrix of batch.m) {
        const z = matrix.elements[14];
        if (!isVillage(matrix.elements[12], z)) continue;
        for (let i = 0; i < count; i += 3) {
          const ia = index ? index.getX(i) : i;
          const ib = index ? index.getX(i + 1) : i + 1;
          const ic = index ? index.getX(i + 2) : i + 2;
          if (normal.getY(ia) + normal.getY(ib) + normal.getY(ic) <= 0) continue;
          a.fromBufferAttribute(position, ia);
          b.fromBufferAttribute(position, ib);
          c.fromBufferAttribute(position, ic);
          const steps = batch.geo.type === 'ConeGeometry' ? 4 : 10;
          const push = (u, v) => {
            p.copy(a).addScaledVector(q, u / steps).addScaledVector(r, v / steps);
            const slope = p.y + (batch.geo.type === 'ConeGeometry' ? .5 : 0);
            p.applyMatrix4(matrix);
            const roll = smooth(.055, .19, slope);
            points.push(p.x, p.y + .07 + roll * (.19 + .075 * waves(p.x, p.z)), p.z);
            slopes.push(slope);
          };
          q.subVectors(b, a);
          r.subVectors(c, a);
          for (let u = 0; u < steps; u++) {
            for (let v = 0; v < steps - u; v++) {
              push(u, v); push(u + 1, v); push(u, v + 1);
              if (u + v < steps - 1) {
                push(u + 1, v); push(u + 1, v + 1); push(u, v + 1);
              }
            }
          }
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('snowSlope', new THREE.Float32BufferAttribute(slopes, 1));
    geometry.computeVertexNormals();
    const material = new THREE.MeshLambertMaterial({ color: 0xf0f6ff });
    shadeSurface(material, 'roof', `
      float roll = snowWave(vSnowWorld.xz);
      float eave = 0.064 + 0.035 * roll;
      if (vSnowSurface.x < eave) discard;
      diffuseColor.rgb *= mix(vec3(0.77, 0.84, 0.94), vec3(1.0),
        smoothstep(eave, eave + 0.11, vSnowSurface.x)) * (0.98 + roll * 0.02);
    `, { vertex: 'vSnowSurface.x = snowSlope;' });
    const compile = material.onBeforeCompile;
    material.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer);
      shader.vertexShader = 'attribute float snowSlope;\n' + shader.vertexShader;
    };
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Winter roof snow';
    scene.add(mesh);
  }

  function snowCaps(THREE, scene, batches) {
    const caps = [], position = new THREE.Vector3(), scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion(), offset = new THREE.Vector3();
    for (const [batch, select] of batches) {
      batch.m.forEach((matrix, index) => {
        matrix.decompose(position, rotation, scale);
        if (!isVillage(position.x, position.z) || !select(position, scale, batch.c[index])) return;
        const count = Math.max(1, Math.ceil(scale.x / .72));
        for (let j = 0; j < count; j++) {
          const wave = waves(position.x + j, position.z);
          offset.set(((j + .5) / count - .5) * scale.x, scale.y / 2, -.07 * scale.z)
            .applyQuaternion(rotation).add(position);
          caps.push(new THREE.Matrix4().compose(offset, rotation, new THREE.Vector3(
            scale.x / count * (.66 + wave * .08), .065 + wave * .018,
            scale.z * (.50 + wave * .045)
          )));
        }
      });
    }
    const geometry = new THREE.SphereGeometry(1, 9, 5);
    const material = new THREE.MeshLambertMaterial({ color: 0xe6effb });
    const mesh = new THREE.InstancedMesh(geometry, material, caps.length);
    caps.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.frustumCulled = false; // Instanced bounds are based on the source geometry in r128.
    mesh.name = 'Winter snow on stonework and sills';
    scene.add(mesh);
  }

  function warmLights(THREE, batches, glows) {
    const honey = new THREE.Color(0xffd18b);
    const amber = new THREE.Color(0xffb66b);
    const warm = color => color.r > .75 && color.r > color.g * 1.16 && color.g > color.b * 1.24;
    for (const batch of batches) {
      batch.c.forEach((color, index) => {
        const { elements } = batch.m[index];
        if (isVillage(elements[12], elements[14]) && warm(color)) color.lerp(honey, .36);
      });
    }
    for (const glow of glows) {
      if (!isVillage(glow.x, glow.z) || !warm(glow.c)) continue;
      glow.c.lerp(amber, .32);
      glow.size *= glow.size < 3 ? 1.1 : 1.18;
    }
  }

  function dressVillage({ THREE, scene, B, MAT, terrain, roadClear, plazas, stairs, glows }) {
    shapeSnowGround(terrain, roadClear, plazas, stairs);
    shadePaths(MAT);
    const ground = scene.getObjectByProperty('geometry', terrain);
    shadeSurface(ground.material, 'ground', `
      vec2 p = vSnowWorld.xz;
      float drifts = snowWave(p * 0.46);
      float grains = snowWave(p * 4.15);
      diffuseColor.rgb *= 1.0 - villageMask(p) * (0.038 + 0.026 * drifts + 0.012 * grains);
    `);
    shadeSurface(MAT.awn, 'awning', `
      float frost = smoothstep(0.12, 0.74, vSnowSurface.y +
        0.15 * snowWave(vSnowWorld.xz)) * villageMask(vSnowWorld.xz);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.91, 0.95, 1.0), frost * 0.42);
    `);
    roofSnow(THREE, scene, [B.roof, B.hip, B.cone]);
    const sillColor = new THREE.Color(0xc8b498);
    snowCaps(THREE, scene, [
      [B.wood, (_p, _s, c) => c.equals(sillColor)],
      [B.wall, (p, s) => p.z === NORTH_GATE && s.y < 1 && s.z > 2],
    ]);
    warmLights(THREE, [B.glass, B.cylg, B.lamp], glows);
  }

  function dressProps({ trees, shrubs, gate, posts }) {
    const apply = (mesh, kind, lower, upper, settle) => {
      const geometry = mesh.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const span = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
      const foliage = kind === 'tree' || kind === 'shrub';
      if (foliage) mesh.material.emissive.multiplyScalar(.28);
      shadeSurface(mesh.material, kind, `
        vec2 p = vSnowWorld.xz;
        float wave = snowWave(p + vSnowWorld.y * vec2(0.68, -0.37));
        float y = vSnowSurface.x / winterPropHeight;
        float upperFace = smoothstep(${settle}, ${settle + .30}, vSnowSurface.y + wave * 0.18);
        float height = smoothstep(${lower}, ${upper}, y + wave * 0.10);
        float amount = upperFace * height;
        vec3 base = diffuseColor.rgb;
        ${foliage ? `
          float luminosity = dot(base, vec3(0.24, 0.64, 0.12));
          base = mix(base, luminosity * vec3(0.82, 0.94, 1.09), 0.64);
        ` : ''}
        ${kind === 'gate' ? `
          float tile = smoothstep(0.02, 0.18, base.r - base.g) *
            smoothstep(0.48, 0.63, y + wave * 0.04);
          amount = max(amount, tile * smoothstep(-0.18, 0.39, vSnowSurface.y + wave * 0.30));
        ` : ''}
        diffuseColor.rgb = mix(diffuseColor.rgb,
          mix(base, vec3(0.83, 0.90, 0.98), amount * 0.96),
          ${foliage ? 'smoothstep(-41.0, -39.6, p.y)' : '1.0'});
      `, { uniforms: { winterPropHeight: { value: span } } });
    };
    for (const mesh of trees) {
      if (!isVillage(mesh.position.x, mesh.position.z)) continue;
      mesh.material = mesh.material.clone();
      apply(mesh, 'tree', .29, .65, .19);
    }
    for (const mesh of shrubs) {
      mesh.material = mesh.material.clone();
      apply(mesh, 'shrub', .22, .52, .14);
    }
    apply(gate, 'gate', .46, .69, .02);
    for (const mesh of posts) {
      mesh.material = mesh.material.clone();
      apply(mesh, 'post', .78, .94, .31);
    }
  }

  return { isVillage, dressVillage, dressProps };
})();
