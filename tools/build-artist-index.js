#!/usr/bin/env node
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const artistsFile=path.join(root,'data','artists.json');
const indexFile=path.join(root,'data','artists-index.json');
function indexArtist(artist) { const {works,...summary}=artist || {}; return {...summary,workCount:Array.isArray(works)?works.length:0,_detailLoaded:false}; }
async function writeArtistIndex(payload) {
  const source=payload && Array.isArray(payload.artists) ? payload : JSON.parse(await fs.readFile(artistsFile,'utf8'));
  const index={dataSchema:source.dataSchema||1,metadata:source.metadata||{},artists:(source.artists||[]).map(indexArtist),deletedArtists:Array.isArray(source.deletedArtists)?source.deletedArtists:[],historicalEvents:Array.isArray(source.historicalEvents)?source.historicalEvents:[],favoriteWorks:Array.isArray(source.favoriteWorks)?source.favoriteWorks:[]};
  await fs.writeFile(indexFile,JSON.stringify(index,null,2)+'\n','utf8');
  return index;
}
if(require.main===module) writeArtistIndex().then(index=>console.log(JSON.stringify({ok:true,artists:index.artists.length,file:'data/artists-index.json'}))).catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
module.exports={indexArtist,writeArtistIndex};
