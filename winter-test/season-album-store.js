(() => {
  const databases={halloween:'usapon-machi-album',christmas:'usapon-winter-album'};
  const tabs=[['all','すべて'],['halloween','ハロウィン'],['christmas','クリスマス'],['fav','★ お気に入り']];
  function connect(name){
    return new Promise(resolve=>{
      try{
        const request=indexedDB.open(name,1);
        request.onupgradeneeded=()=>{
          for(const name of ['meta','full'])request.result.createObjectStore(name,{keyPath:'id'});
        };
        request.onsuccess=()=>resolve(request.result);
        request.onerror=request.onblocked=()=>resolve(null);
      }catch{resolve(null);}
    });
  }
  function create(){
    const connections=Object.fromEntries(Object.entries(databases).map(([season,name])=>[season,connect(name)]));
    const memory=new Map();
    const identify=id=>[id.slice(0,id.indexOf(':')),id.slice(id.indexOf(':')+1)];
    const request=(db,store,read,fallback)=>new Promise(resolve=>{
      try{
        const r=read(db.transaction(store).objectStore(store));
        r.onsuccess=()=>resolve(r.result??fallback);
        r.onerror=()=>resolve(fallback);
      }catch{resolve(fallback);}
    });
    return {
      async list(){
        const groups=await Promise.all(Object.entries(connections).map(async([season,connection])=>{
          const db=await connection;
          if(!db)return [];
          const list=await request(db,'meta',store=>store.getAll(),[]);
          return list.filter(m=>m&&typeof m.id==='string'&&typeof m.thumb==='string').map(m=>({...m,id:season+':'+m.id,season}));
        }));
        return groups.flat();
      },
      async put(meta,url){
        const [season,id]=identify(meta.id);
        const db=await connections[season];
        if(!db){if(url)memory.set(meta.id,url);return;}
        try{
          const tx=db.transaction(url?['meta','full']:['meta'],'readwrite');
          const record={...meta,id};
          delete record.season;
          tx.objectStore('meta').put(record);
          if(url)tx.objectStore('full').put({id,url});
          await new Promise(resolve=>{
            tx.oncomplete=resolve;
            tx.onabort=()=>{if(url)memory.set(meta.id,url);resolve();};
          });
        }catch{if(url)memory.set(meta.id,url);}
      },
      async remove(key){
        memory.delete(key);
        const [season,id]=identify(key);
        const db=await connections[season];
        if(!db)return;
        try{
          const tx=db.transaction(['meta','full'],'readwrite');
          tx.objectStore('meta').delete(id);tx.objectStore('full').delete(id);
        }catch{}
      },
      async full(key){
        if(memory.has(key))return memory.get(key);
        const [season,id]=identify(key);
        const db=await connections[season];
        if(!db)return null;
        const record=await request(db,'full',store=>store.get(id),null);
        return record?.url??null;
      }
    };
  }
  function merge(loaded,inSession){
    return [...new Map([...loaded,...inSession].map(meta=>[meta.id,meta])).values()].sort((a,b)=>b.ts-a.ts);
  }
  window.SeasonAlbumStore={create,merge,tabs};
})();
