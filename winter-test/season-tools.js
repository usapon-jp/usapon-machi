(() => {
  const halloweenKey='usapon-halloween-machi-v1';
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch { return {}; }
  }
  const owns=key=>read('usapon-village-'+key+'-v1')===true;
  function grant(key) {
    try {
      localStorage.setItem('usapon-village-'+key+'-v1','true');
      return true;
    } catch { return false; }
  }
  function inventory() {
    const old=read(halloweenKey);
    const valid=Array.isArray(old.found);
    return {
      halloweenBroom:valid&&(old.broom===undefined?!!old.done:!!old.broom),
      halloweenWand:valid&&!!old.wand,
      winterWand:owns('winter-wand'),
      winterBroom:owns('winter-broom'),
    };
  }
  function whiteBroom(T) {
    const broom=new T.Group();
    const ivory=new T.MeshStandardMaterial({color:0xfff6dd,roughness:.75});
    const white=new T.MeshStandardMaterial({color:0xfffcef,roughness:.92});
    const red=new T.MeshStandardMaterial({color:0xc52236,roughness:.48,side:T.DoubleSide});
    const handle=new T.Mesh(new T.CylinderGeometry(.048,.07,1.8,10),ivory);
    handle.rotation.x=Math.PI/2;handle.position.z=.33;broom.add(handle);
    for(let i=0;i<13;i++){
      const a=i*2.4, r=i===0?0:.15;
      const bristle=new T.Mesh(new T.ConeGeometry(.09,.66,7),white);
      bristle.rotation.x=Math.PI/2;
      bristle.position.set(Math.cos(a)*r,Math.sin(a)*r*.68,-.82-(i%3)*.06);
      broom.add(bristle);
    }
    const band=new T.Mesh(new T.CylinderGeometry(.17,.17,.13,12),red);
    band.rotation.x=Math.PI/2;band.position.z=-.58;broom.add(band);
    for(const side of [-1,1]){
      const bow=new T.Mesh(new T.SphereGeometry(.14,12,8),red);
      bow.scale.set(1,.51,.41);bow.rotation.z=.35*side;bow.position.set(.12*side,.16,-.59);broom.add(bow);
      const tail=new T.Mesh(new T.BoxGeometry(.09,.23,.025),red);
      tail.rotation.z=.45*side;tail.position.set(.09*side,.04,-.59);broom.add(tail);
    }
    return broom;
  }
  window.VillageSeasons={inventory,owns,grant,whiteBroom};
})();
