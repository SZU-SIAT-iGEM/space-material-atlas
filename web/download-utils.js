/* Small uncompressed ZIP writer; all files are generated locally, UTF-8 names. */
window.AtlasDownload=(()=>{
const enc=new TextEncoder(),table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc(data){let c=0xffffffff;for(const x of data)c=table[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function header(size,values){const a=new Uint8Array(size),d=new DataView(a.buffer);for(const [at,v,len] of values)len===2?d.setUint16(at,v,true):d.setUint32(at,v,true);return a}
function zip(files){const local=[],central=[];let offset=0,cs=0;for(const f of files){const name=enc.encode(f.name),data=typeof f.text==='string'?enc.encode(f.text):f.data,c=crc(data);const h=header(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[14,c,4],[18,data.length,4],[22,data.length,4],[26,name.length,2]]);local.push(h,name,data);const ch=header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[16,c,4],[20,data.length,4],[24,data.length,4],[28,name.length,2],[42,offset,4]]);central.push(ch,name);cs+=ch.length+name.length;offset+=h.length+name.length+data.length}return new Blob([...local,...central,header(22,[[0,0x06054b50,4],[8,files.length,2],[10,files.length,2],[12,cs,4],[16,offset,4]])],{type:'application/zip'})}
function save(name,data,type='application/json'){const a=document.createElement('a'),url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
return {zip,save};})();
