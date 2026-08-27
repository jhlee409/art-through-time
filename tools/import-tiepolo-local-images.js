const fs=require('fs/promises');
const path=require('path');

const root=path.resolve(__dirname,'..');
const artistId='artist-Q162048';
const sourceDir=path.join(root,'다운로드용');
const targetDir=path.join(root,'data','thumbnails',artistId);
const artistsPath=path.join(root,'data','artists.json');
const now='2026-08-27T00:00:00Z';

const localWorks=[
  {
    id:'local-tiepolo-san-domenico-in-glory', file:'3840px-Accademia_-_Giambattista_Tiepolo,_San_Domenico_in_gloria_1723.jpg', year:1723,
    title:{ko:'《성 도미니코의 영광》',en:'The Glory of Saint Dominic'}, medium:{ko:'유화',en:'Oil on canvas'},
    description:{ko:'초기 종교화에서 강한 대각선과 인물의 상승 운동을 사용해, 훗날 천장화로 이어질 극적인 공간 감각을 보여준다.',en:'An early religious work whose diagonals and rising figures anticipate his later theatrical ceiling spaces.'}
  },
  {
    id:'local-tiepolo-scipio-freeing-massiva', file:'Giovanni_Battista_Tiepolo_-_Scipio_Africanus_Freeing_Massiva_-_Walters_37657.jpg', year:1721,
    title:{ko:'《스키피오 아프리카누스가 마시바를 석방하다》',en:'Scipio Africanus Freeing Massiva'}, medium:{ko:'유화',en:'Oil on canvas'},
    description:{ko:'고대사의 관대함을 극적인 군중 배치와 밝은 색채로 무대처럼 연출한 초기 역사화다.',en:'An early history painting that stages classical generosity through theatrical crowding and vivid colour.'}
  },
  {
    id:'local-tiepolo-perseus-and-andromeda', file:'3840px-Tiepolo_-_Perseus_and_Andromeda,_ca._1730–31.jpg', year:1730,
    title:{ko:'《페르세우스와 안드로메다》',en:'Perseus and Andromeda'}, medium:{ko:'유화',en:'Oil on canvas'},
    description:{ko:'신화적 구출 장면을 공중에서 급강하하는 인물과 열린 하늘로 구성해, 로코코 특유의 가벼운 비상감을 만든다.',en:'A mythological rescue staged through airborne figures and an open sky, creating Rococo buoyancy.'}
  },
  {
    id:'local-tiepolo-zephyr-and-flora', file:'Tiepolo,_Giovanni_Battista_-_The_Triumph_of_Zephyr_and_Flora_-_1734-35.jpg', year:1734,
    title:{ko:'《제피로스와 플로라의 승리》',en:'The Triumph of Zephyr and Flora'}, medium:{ko:'유화',en:'Oil on canvas'},
    description:{ko:'밝은 하늘, 꽃과 바람의 알레고리, 떠오르는 인물이 베네치아 로코코의 투명한 빛과 감각적 우아함을 응축한다.',en:'Bright sky, floral and wind allegory, and floating figures concentrate Venetian Rococo lightness and elegance.'}
  },
  {
    id:'local-tiepolo-banquet-of-cleopatra', file:'3840px-Giambattista_Tiepolo_-_The_Banquet_of_Cleopatra_-_Google_Art_Project.jpg', year:1743,
    title:{ko:'《클레오파트라의 연회》',en:'The Banquet of Cleopatra'}, medium:{ko:'유화',en:'Oil on canvas'},
    description:{ko:'고대의 일화를 궁정 연회처럼 꾸며, 건축 무대·비단·가벼운 색채로 베네치아 로코코의 사교적 화려함을 드러낸다.',en:'An ancient story restaged as a courtly banquet, revealing Venetian Rococo splendour through architecture, silk, and light colour.'}
  },
  {
    id:'local-tiepolo-nuptial-allegory', file:'Giovanni_Battista_Tiepolo_034.jpg', year:1757,
    title:{ko:'《혼인 알레고리》',en:'Nuptial Allegory'}, medium:{ko:'프레스코',en:'Fresco'},
    description:{ko:'아폴론의 전차와 알레고리 인물을 천장 위 하늘로 열어, 다중 시점과 가상 건축이 결합한 베네치아 로코코 장식의 정점을 보여준다.',en:'Apollo’s chariot and allegorical figures open the ceiling to the sky in a summit of Venetian Rococo illusion.'}
  },
  {
    id:'local-tiepolo-glory-of-pisani-family-detail', file:'Giovanni_Battista_Tiepolo_-_The_Apotheosis_of_the_Pisani_Family_(detail)_-_WGA22364.jpg', year:1761,
    title:{ko:'《피사니 가문의 영광》 (세부)',en:'The Glory of the Pisani Family (detail)'}, medium:{ko:'프레스코',en:'Fresco'},
    description:{ko:'귀족 가문의 영광을 구름과 알레고리로 하늘에 올려놓은 천장화의 세부로, 위에서 아래를 내려다보는 환영적 원근을 읽을 수 있다.',en:'A detail from the ceiling fresco that lifts aristocratic glory into clouds and allegory through illusionistic perspective.'}
  },
  {
    id:'local-tiepolo-glory-of-pisani-family', file:'Giovanni_Battista_Tiepolo,_Wealth_and_Benefits_of_the_Spanish_Monarchy_under_Charles_III,_1762,_NGA_12137.jpg', year:1762,
    title:{ko:'《카를로스 3세 치세 스페인 군주국의 부와 은혜》',en:'Wealth and Benefits of the Spanish Monarchy under Charles III'}, medium:{ko:'프레스코',en:'Fresco'},
    description:{ko:'마드리드 왕궁을 위한 천장 장식으로, 넓은 하늘과 의인화된 풍요를 통해 티에폴로의 베네치아 로코코가 국제 궁정 양식으로 확장된 모습을 보여준다.',en:'A Madrid palace ceiling decoration showing Venetian Rococo expanded into an international court language of sky and abundance.'}
  }
];

async function main(){
  const data=JSON.parse(await fs.readFile(artistsPath,'utf8'));
  const artist=data.artists.find(item=>item.id===artistId);
  if(!artist)throw new Error(`Artist not found: ${artistId}`);
  await fs.mkdir(targetDir,{recursive:true});
  const existing=Array.isArray(artist.works)?artist.works:[];
  const byId=new Map(existing.map(work=>[work.id,work]));
  for(const work of localWorks){
    const source=path.join(sourceDir,work.file), targetName=`${work.id}${path.extname(work.file).toLowerCase()}`, target=path.join(targetDir,targetName);
    await fs.access(source);
    await fs.copyFile(source,target);
    const image=path.relative(root,target).replace(/\\/g,'/');
    byId.set(work.id,{
      ...work,
      popularity:100,
      country:{ko:'베네치아 공화국',en:'Republic of Venice'},
      movement:{ko:'로코코',en:'Rococo'},
      image,thumbnail:image,highResImage:image,highResOriginal:image,
      source:`local import from 다운로드용/${work.file}`,
      verified:true,status:'verified',representative:true,movementContribution:true,origin:'local-import',
      metadata:{createdAt:now,updatedAt:now,createdBy:'local import',updatedBy:'local import'},
      migration:{schema:1,image:{status:'ready',localThumbnail:image,highResolution:image,sourceUrl:'',sourceUrls:[],license:'local user-provided file',institution:''}}
    });
  }
  artist.works=[...byId.values()].sort((a,b)=>Number(a.year)-Number(b.year)||String(a.id).localeCompare(String(b.id)));
  artist.nationality={ko:'베네치아 공화국',en:'Republic of Venice'};
  artist.artistSummary={ko:[
    '베네치아 공화국 출신의 로코코 화가이자 판화가로, 18세기 베네치아 회화를 대표합니다.',
    '밝고 투명한 색채, 열린 하늘, 과감한 단축 원근으로 궁전과 교회의 천장에 환영적 공간을 만들었습니다.',
    '이탈리아·독일·스페인 궁정의 대형 장식 수주를 통해 베네치아 로코코를 국제적 양식으로 확장했습니다.'
  ],en:[]};
  artist.featuredWorkIds=['local-tiepolo-zephyr-and-flora','local-tiepolo-banquet-of-cleopatra','local-tiepolo-nuptial-allegory','local-tiepolo-glory-of-pisani-family','artist-Q162048-representative-work'];
  artist.metadata={...(artist.metadata||{}),updatedAt:now,updatedBy:'local import'};
  await fs.writeFile(artistsPath,JSON.stringify(data,null,2)+'\n','utf8');
  console.log(JSON.stringify({artistId,imported:localWorks.length,totalWorks:artist.works.length},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
