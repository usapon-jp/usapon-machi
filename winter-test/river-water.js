/* ===== Winter river water (うさぽん村 城下町) =====
   Standalone module: it only reads the river shape from layout.js and adds two meshes.
   Ideas taken from the 癒しの泉 water (soft fresnel sky, mint/teal in-scatter, sparkles, caustics,
   ring ripples), adapted to a river: flow along the centre line (faster in the middle, slower at
   the banks), winter palette, thin ice at the shore, no extra render pass (phone friendly).
   Deterministic: everything is a function of time modulo the loop length L.

   Use:
     const river = createRiverWater(T, scene, {riverZ, riverWidth, waterY, groundHeight, bridge,
                                              mill:{x,z}, flowSpeed:.86, snow:snowCoverUniform});
     river.time.value = t;   // same contract as the old water(): game.js keeps `town.time.value=t`
*/
export function createRiverWater(T, scene, opt) {
  const {riverZ, riverWidth, waterY, groundHeight, bridge} = opt;
  const L = opt.loop || 8;                 // seconds; every periodic term repeats exactly in L
  const flowSpeed = opt.flowSpeed ?? .86;  // m/s at the centre (same value as the old shader)
  const x0 = opt.x0 ?? -65, x1 = opt.x1 ?? 65;
  const coarse = !!opt.coarse;
  const margin = opt.margin ?? 1.0;          // surface reaches this far past riverWidth (hidden under the banks)
  const TAU = Math.PI * 2;

  // ---------- arc length along the centre line ----------
  const SN = 1300, sx = new Float32Array(SN + 1), ss = new Float32Array(SN + 1);
  for (let i = 0; i <= SN; i++) {
    const x = x0 + (x1 - x0) * i / SN; sx[i] = x;
    if (i) { const px = sx[i - 1]; ss[i] = ss[i - 1] + Math.hypot(x - px, riverZ(x) - riverZ(px)); }
  }
  const arc = x => { const f = (x - x0) / (x1 - x0) * SN, i = Math.max(0, Math.min(SN - 1, Math.floor(f))); return ss[i] + (ss[i + 1] - ss[i]) * (f - i); };

  // ---------- tileable textures (canvas, generated once) ----------
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function dataTex(n, fill, srgb) {
    const data = new Uint8Array(n * n * 4); fill(data, n);
    const t = new T.DataTexture(data, n, n, T.RGBAFormat);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter;
    t.generateMipmaps = true; if (srgb) t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; return t;
  }
  // normal map: R,G = slope (x along flow, y across), B = soft value noise, all tileable
  const tNorm = dataTex(128, (d, n) => {
    const r = mulberry(31), W = [];
    for (let k = 0; k < 14; k++) {
      const fx = 1 + Math.floor(r() * 6), fy = Math.floor(r() * 9) - 4, a = 1 / Math.hypot(fx, fy || 1) ** 1.15;
      W.push([fx * (r() < .5 ? -1 : 1), fy, a, r() * TAU]);
    }
    const N2 = []; for (let k = 0; k < 6; k++) N2.push([1 + Math.floor(r() * 3), Math.floor(r() * 5) - 2, r() * TAU]);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = i / n * TAU, v = j / n * TAU; let gx = 0, gy = 0, nz = 0;
      for (const [fx, fy, a, p] of W) { const c = Math.cos(fx * u + fy * v + p) * a; gx += c * fx; gy += c * fy; }
      for (const [fx, fy, p] of N2) nz += Math.sin(fx * u + fy * v + p);
      const o = (j * n + i) * 4;
      d[o] = Math.max(0, Math.min(255, 128 + gx * 9)); d[o + 1] = Math.max(0, Math.min(255, 128 + gy * 9));
      d[o + 2] = Math.max(0, Math.min(255, 128 + nz * 34)); d[o + 3] = 255;
    }
  });
  // caustics: tileable soft voronoi web (same idea as the spring)
  const tCaus = dataTex(128, (d, n) => {
    const r = mulberry(77), P = []; for (let k = 0; k < 22; k++) P.push([r(), r()]);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = i / n, v = j / n; let a = 9, b = 9;
      for (const [px, py] of P) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const dd = Math.hypot(u - px - ox, v - py - oy); if (dd < a) { b = a; a = dd; } else if (dd < b) b = dd;
      }
      const e = b - a, w = Math.exp(-e * e / (2 * .018 * .018)), o = (j * n + i) * 4;
      d[o] = d[o + 1] = d[o + 2] = Math.min(255, w * 255); d[o + 3] = 255;
    }
  });
  // river bed: cold grey-brown gravel with a few larger pebbles (2 m tile)
  const tBed = dataTex(256, (d, n) => {
    const r = mulberry(9); const base = [112, 108, 98];
    for (let k = 0; k < n * n; k++) { const v = (r() - .5) * 22; d[k * 4] = base[0] + v; d[k * 4 + 1] = base[1] + v; d[k * 4 + 2] = base[2] + v * .9; d[k * 4 + 3] = 255; }
    const cols = [[138, 132, 120], [96, 98, 96], [150, 141, 126], [118, 112, 106], [86, 84, 80], [160, 152, 140]];
    for (let k = 0; k < 170; k++) {
      const cx = r() * n, cy = r() * n, rr = 3 + r() * r() * 15, el = .6 + r() * .5, an = r() * Math.PI, c = cols[Math.floor(r() * cols.length)];
      const ca = Math.cos(an), sa = Math.sin(an);
      for (let y = -rr - 1; y <= rr + 1; y++) for (let x = -rr - 1; x <= rr + 1; x++) {
        const lx = (x * ca + y * sa) / rr, ly = (-x * sa + y * ca) / (rr * el), q = lx * lx + ly * ly; if (q > 1) continue;
        const px = ((Math.floor(cx + x) % n) + n) % n, py = ((Math.floor(cy + y) % n) + n) % n, o = (py * n + px) * 4;
        const sh = 1 - .28 * q + .14 * (-lx - ly) * (1 - q);     // rounded, lit from the upper left
        for (let ch = 0; ch < 3; ch++) d[o + ch] = Math.max(0, Math.min(255, c[ch] * sh));
      }
    }
  }, true);

  // ---------- uniforms ----------
  const sun = (opt.sunDir || new T.Vector3(-34, 40, -14)).clone().normalize();
  const millX = opt.mill ? opt.mill.x : -1e4, millC = opt.mill ? opt.mill.z - riverZ(opt.mill.x) : 0;
  const RIPN = 7;
  const uni = {
    uTime: { value: 0 }, uL: { value: L }, uFlow: { value: flowSpeed },
    uSun: { value: sun }, uSnow: opt.snow || { value: 1 },
    tNorm: { value: tNorm }, tCaus: { value: tCaus }, tBed: { value: tBed },
    uShallow: { value: new T.Color(0.36, 0.64, 0.62) }, uDeep: { value: new T.Color(0.06, 0.25, 0.30) },
    uAbs: { value: new T.Vector3(.62, .20, .17) },
    uFogColor: { value: new T.Color(0x887fa4) }, uFog: { value: new T.Vector2(25, 117) },
    uBridge: { value: new T.Vector3(bridge.x, bridge.halfWidth, (bridge.a + bridge.b) / 2) },
    uMill: { value: new T.Vector2(millX, millC) },
    uRip: { value: Array.from({ length: RIPN }, () => new T.Vector4(0, 0, -1, 0)) },
  };
  // drifting ring ripples (snow / drips from the branches): s, c, birth time, amplitude. Loop every L.
  const ripSrc = opt.ripples || [[-3.5, -.9, .3, 1], [6.5, .8, 1.5, .8], [-12, .4, 2.6, .9], [1.0, 1.4, 3.9, .7],
    [11, -1.2, 5.0, .9], [-7.5, -1.6, 6.2, .8], [3.6, -.2, 7.1, 1]];
  const ripS = ripSrc.map(([x, c, t0, a]) => [arc(x), c, t0, a]);

  const COMMON = `
    uniform float uTime,uL,uFlow; uniform sampler2D tNorm; uniform vec4 uRip[${RIPN}];
    uniform vec3 uBridge; uniform vec2 uMill;
    const float TAU=6.2831853;
    float speedAt(float vn){ return uFlow*(.62+.38*(1.-vn*vn)); }
    // two phase flow (looped): returns slope (along s, across c) of the surface
    vec2 flowSlope(vec2 st,float vn,out float foamN){
      float P=uL/8.;                       // 8 phases per loop -> exact loop
      float f0=fract(uTime/P), f1=fract(uTime/P+.5);
      float w0=1.-abs(1.-2.*f0), w1=1.-abs(1.-2.*f1);
      float sp=speedAt(vn)*P;
      vec2 a=st*vec2(.30,.46), b=st*vec2(.62,.95);           // stretched along the flow
      vec2 j0=vec2(0.,.31), j1=vec2(.47,0.);
      vec2 s0=texture2D(tNorm,a-vec2(sp*f0*.30,0.)+j0).rg*2.-1.;
      vec2 s1=texture2D(tNorm,a-vec2(sp*f1*.30,0.)+j1).rg*2.-1.;
      vec2 d0=texture2D(tNorm,b-vec2(sp*f0*.62,0.)+j1).rg*2.-1.;
      vec2 d1=texture2D(tNorm,b-vec2(sp*f1*.62,0.)+j0).rg*2.-1.;
      float n0=texture2D(tNorm,st*vec2(.17,.5)-vec2(sp*f0*.17,0.)).b, n1=texture2D(tNorm,st*vec2(.17,.5)-vec2(sp*f1*.17,0.)+.5).b;
      foamN=n0*w0+n1*w1;
      return (s0*w0+s1*w1)*.050+(d0*w0+d1*w1)*.030;
    }
    vec2 rippleSlope(vec2 st,float vn){
      vec2 g=vec2(0.);
      for(int i=0;i<${RIPN};i++){vec4 R=uRip[i]; if(R.z<0.)continue;
        vec2 d=st-R.xy; float r0=length(d)+1e-4, fr=.06+.42*R.z, x=r0-fr, w=.09+.10*R.z;
        float env=exp(-x*x/(w*w))*R.w*exp(-R.z*.9)/(1.+1.8*fr)*smoothstep(0.,.2,R.z);
        float k=TAU/(.26+.05*R.z);
        g+=env*(-sin(x*k)*k)*d/r0*.006;
      }
      return g;
    }
  `;

  // ---------- geometry: one ribbon for the surface, one for the bed ----------
  const NS = coarse ? 170 : 240, NC = coarse ? 14 : 22;
  function ribbon(isBed) {
    const pos = [], st = [], dep = [], vn = [], idx = [];
    for (let i = 0; i <= NS; i++) {
      const x = x0 + (x1 - x0) * i / NS, zc = riverZ(x), w = riverWidth(x), r = w + margin, s = arc(x);
      for (let j = 0; j <= NC; j++) {
        const c = -r + 2 * r * j / NC, z = zc + c, g = groundHeight(x, z);
        pos.push(x, isBed ? Math.min(g + .11, waterY - .004) : waterY, z);
        st.push(s, c); dep.push(Math.max(0, waterY - g)); vn.push(c / w);
        if (i && j) { const a = (i - 1) * (NC + 1) + j - 1, b = a + NC + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aST', new T.Float32BufferAttribute(st, 2));
    geo.setAttribute('aDepth', new T.Float32BufferAttribute(dep, 1));
    geo.setAttribute('aVn', new T.Float32BufferAttribute(vn, 1));
    geo.setIndex(idx); geo.computeBoundingSphere();
    return geo;
  }

  const VERT = `
    attribute vec2 aST; attribute float aDepth,aVn;
    varying vec2 vST; varying float vDepth,vVn,vDist; varying vec3 vW;
    void main(){ vST=aST; vDepth=aDepth; vVn=aVn;
      vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv=viewMatrix*w; vDist=-mv.z; gl_Position=projectionMatrix*mv; }`;

  // bed: gravel + caustics + absorption tint (it is only ever seen through the water)
  const bedMat = new T.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    vertexShader: VERT,
    fragmentShader: `${COMMON}
      uniform sampler2D tCaus,tBed; uniform vec3 uSun,uAbs,uDeep,uShallow,uFogColor; uniform vec2 uFog;
      varying vec2 vST; varying float vDepth,vVn,vDist; varying vec3 vW;
      void main(){
        float d=vDepth; if(d<.005)discard;
        float fn; vec2 sl=flowSlope(vST,clamp(vVn,-1.,1.),fn)+rippleSlope(vST,vVn);
        vec3 V=normalize(cameraPosition-vW);
        float path=d*(.6+1./max(V.y,.3));                       // light in + view out
        vec2 wob=sl*d*1.6;                                         // fake refraction wobble
        vec3 base=texture2D(tBed,vW.xz*.5+wob).rgb;
        // caustics: two layers, drifting slowly downstream, sharper in the shallows
        float P=uL/8., f0=fract(uTime/P), f1=fract(uTime/P+.5), w0=1.-abs(1.-2.*f0), w1=1.-abs(1.-2.*f1);
        float sp=speedAt(clamp(vVn,-1.,1.))*P*.35;
        vec2 cu=vST*vec2(.55,.62)+sl*2.2;
        float c0=texture2D(tCaus,cu-vec2(sp*f0*.55,0.)).r, c1=texture2D(tCaus,cu*1.37+vec2(.3,.6)-vec2(sp*f1*.75,0.)).r;
        float ca=texture2D(tCaus,cu*.71+vec2(.5,.1)-vec2(sp*f0*.39,0.)).r, cb=texture2D(tCaus,cu*.83+vec2(.2,.8)-vec2(sp*f1*.46,0.)).r;
        float caus=(min(c0,ca)*w0+min(c1,cb)*w1)*1.8;
        float cK=smoothstep(.03,.25,d)*exp(-d*.55);
        float lit=.62+.38*max(0.,uSun.y);
        // shade under the bridge arch
        float dx=abs(vW.x-uBridge.x); float shelter=1.-smoothstep(uBridge.y-.15,uBridge.y+.9,dx);
        vec3 col=base*1.7*lit*(1.-.55*shelter);                        // tBed is decoded to linear by the sampler
        col+=vec3(.95,.88,.74)*caus*cK*.60*(1.-.8*shelter);
        vec3 Tr=exp(-uAbs*path);
        col=col*Tr;
        float fog=smoothstep(uFog.x,uFog.y,vDist);
        col=mix(col,uFogColor,fog);
        gl_FragColor=vec4(col,smoothstep(.005,.10,d));
        #include <colorspace_fragment>
      }`,
  });
  // surface
  const surfMat = new T.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, side: T.DoubleSide,
    vertexShader: VERT,
    fragmentShader: `${COMMON}
      uniform vec3 uSun,uShallow,uDeep,uFogColor; uniform vec2 uFog; uniform float uSnow;
      varying vec2 vST; varying float vDepth,vVn,vDist; varying vec3 vW;
      vec3 sky(vec3 r){ // dusk winter sky, darkened near the horizon by houses and trees on the banks
        float h=clamp(r.y,-.05,1.);
        vec3 hz=vec3(.52,.43,.58), glow=vec3(.80,.55,.44), top=vec3(.20,.22,.42);
        float toSun=max(0.,dot(normalize(r.xz+1e-4),normalize(uSun.xz)));
        vec3 c=mix(hz,glow,(1.-smoothstep(.04,.35,h))*toSun*toSun*.7);
        c=mix(c,top,smoothstep(.18,.8,h));
        c=mix(vec3(.16,.15,.19),c,smoothstep(.03,.24,h));
        return c;
      }
      void main(){
        float vn=clamp(vVn,-1.,1.), fn;
        vec2 sl=flowSlope(vST,vn,fn)+rippleSlope(vST,vn);
        // st is (along, across) and the river runs roughly along +x, so the slope maps straight to xz
        vec3 N=normalize(vec3(-sl.x,1.,-sl.y));
        vec3 V=normalize(cameraPosition-vW);
        float cosv=max(dot(N,V),0.);
        float F=.03+.97*pow(1.-cosv,5.);
        float thick=vDepth/max(cosv,.3);
        float ab=1.-exp(-thick*.30);                              // how much of the bed is hidden
        vec3 insc=mix(uShallow*.75,uDeep,smoothstep(.15,1.6,thick));
        insc*=1.+clamp(dot(-sl,normalize(uSun.xz))*1.6,-.10,.10);  // lit and shaded sides of the ripples
        vec3 env=sky(reflect(-V,N));
        // shade under the bridge
        float dx=abs(vW.x-uBridge.x); float shelter=1.-smoothstep(uBridge.y-.15,uBridge.y+.9,dx);
        env*=1.-.6*shelter; insc*=1.-.45*shelter;
        float Fr=clamp(F*1.1,0.,1.);
        vec3 src=insc*ab*(1.-Fr)+env*Fr;
        float a=1.-(1.-ab)*(1.-Fr);
        // sun: broad sheen + small sparkles
        vec3 H=normalize(uSun+V); float nh=max(dot(N,H),0.);
        vec3 spec=vec3(1.,.82,.62)*(pow(nh,260.)*.05+pow(nh,900.)*.8*smoothstep(.55,.8,fn+.4*sl.x*10.))*(1.-.9*shelter);
        // foam: a soft bubbly trail behind the mill wheel, and where the flow folds round the bridge abutments
        float travel=vW.x-uMill.x;
        float wake=smoothstep(-.2,.6,travel)*(1.-smoothstep(1.,5.,travel));
        float band=abs(vST.y-uMill.y);
        float spread=.30+.16*max(travel,0.);
        float bub=texture2D(tNorm,vST*vec2(1.6,2.4)-vec2(uTime*speedAt(vn)*1.6,0.)).b;
        float bub2=texture2D(tNorm,vST*vec2(2.3,3.1)+vec2(.37,.11)-vec2(uTime*speedAt(vn)*2.3,0.)).b;
        float foam=wake*(1.-smoothstep(spread*.3,spread,band))*smoothstep(.5,.9,max(bub,bub2)*.75+fn*.4)*.5;
        float lip=(1.-smoothstep(.0,.8,abs(dx-uBridge.y-.25)))*smoothstep(.6,.95,abs(vn))*smoothstep(.5,.8,max(bub,bub2));
        foam=max(foam,lip*.5)*(1.-smoothstep(18.,40.,vDist));
        // thin shore ice (only with snow on): irregular plates that hug the shallow edge
        float iceN=texture2D(tNorm,vW.xz*vec2(.23,.31)+.17).b*.65+texture2D(tNorm,vW.xz*.9).b*.35;
        float iceW=(.06+.30*smoothstep(.35,.85,iceN))*uSnow;
        float ice=(1.-smoothstep(iceW*.55,iceW,vDepth))*step(.0001,uSnow);
        float crack=(1.-smoothstep(.0,.03,abs(texture2D(tNorm,vW.xz*.7+.4).b-.5)))*.18;
        vec3 iceCol=mix(vec3(.62,.74,.80),vec3(.88,.91,.94),smoothstep(.0,iceW*.7,iceW-vDepth))*(1.-crack);
        spec*=1.-smoothstep(14.,45.,vDist)*.85;   // no glitter noise far away
        src=src+spec/max(a,.05)*a;
        src=mix(src,vec3(.84,.89,.90),foam); a=max(a,foam);
        src=mix(src,iceCol,ice*.8); a=max(a,ice*.8);
        // meniscus line where the water meets the bank
        src+=vec3(.75,.85,.88)*.06*(1.-smoothstep(0.,.04,vDepth))*(1.-ice);
        float fog=smoothstep(uFog.x,uFog.y,vDist);
        src=mix(src,uFogColor,fog); a=mix(a,1.,fog);
        gl_FragColor=vec4(src,a);
        #include <colorspace_fragment>
      }`,
  });
  const bed = new T.Mesh(ribbon(true), bedMat); bed.name = 'riverBed'; bed.renderOrder = 1;
  const surface = new T.Mesh(ribbon(false), surfMat); surface.name = 'riverWater'; surface.renderOrder = 2;
  scene.add(bed, surface);

  function update(t) {
    const tt = ((t % L) + L) % L; uni.uTime.value = tt;
    const R = uni.uRip.value;
    ripS.forEach(([s, c, t0, a], i) => {
      const age = ((tt - t0) % L + L) % L, vn = Math.min(1, Math.abs(c) / 2.6);
      if (age > 4.5) { R[i].set(0, 0, -1, 0); return; }
      const sp = flowSpeed * (.62 + .38 * (1 - vn * vn));
      R[i].set(s + sp * age, c, age, a);
    });
  }
  update(0);
  // same contract as the old water(): `town.time.value = t`
  const time = { get value() { return uni.uTime.value; }, set value(t) { update(t); } };
  return { time, update, uniforms: uni, bed, surface, L, arc,
    dispose() { scene.remove(bed, surface); bed.geometry.dispose(); surface.geometry.dispose(); bedMat.dispose(); surfMat.dispose(); tNorm.dispose(); tCaus.dispose(); tBed.dispose(); } };
}
