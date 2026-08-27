const fs=require('fs/promises');
const path=require('path');

const root=path.resolve(__dirname,'..');
const artistId='artist-Q161866';
const sourceDir=path.join(root,'다운로드용');
const targetDir=path.join(root,'data','thumbnails',artistId);
const artistsPath=path.join(root,'data','artists.json');
const now='2026-08-27T00:00:00Z';

const localWorks=[
  {id:'local-canaletto-rialto-bridge-north',file:'Canaletto_-_Rialto_Bridge_from_the_North_RCIN_400668.jpg',year:1725,title:{ko:'《북쪽에서 본 리알토 다리》',en:'The Rialto Bridge from the North'},description:{ko:'리알토 다리를 도시 생활과 수로 교통의 중심으로 잡아, 초기 베두타의 정밀한 건축 질서를 보여준다.',en:'An early veduta that frames the Rialto Bridge as the centre of urban life and canal traffic.'}},
  {id:'local-canaletto-stonemasons-yard',file:'3840px-Canaletto_-_The_Stonemason\'s_Yard.jpg',year:1725,title:{ko:'《석공의 마당》',en:'The Stonemason’s Yard'},description:{ko:'공사장과 일상 노동, 빛과 그림자를 무대처럼 엮어 베네치아의 생활 공간을 시적으로 보여준다.',en:'Construction, daily labour, light, and shadow turn Venice’s lived space into a poetic stage.'},replace:'artist-Q161866-representative-work'},
  {id:'local-canaletto-grand-canal-entrance',file:'3840px-Canaletto_-_The_Entrance_to_the_Grand_Canal,_Venice_-_Google_Art_Project.jpg',year:1730,title:{ko:'《대운하 입구》',en:'The Entrance to the Grand Canal, Venice'},description:{ko:'도제나와 살루테 성당을 넓은 수로의 빛 속에 배치해, 관광 기념품을 넘어 도시의 장엄한 리듬을 만든다.',en:'The Dogana and Salute are placed in broad canal light to make a monumental rhythm of the city.'}},
  {id:'local-canaletto-arsenal-entrance',file:'View_of_the_entrance_to_the_Arsenal_by_Canaletto,_1732.jpg',year:1732,title:{ko:'《베네치아 병기창 입구》',en:'View of the Entrance to the Arsenal'},description:{ko:'해양 공화국의 군사·산업 시설을 정밀한 원근과 일상적인 배의 움직임으로 기록한 도시 풍경이다.',en:'A city view recording the maritime republic’s arsenal through precise perspective and everyday boat traffic.'}},
  {id:'local-canaletto-st-pauls-cathedral',file:'3840px-Canaletto_-_St._Paul\'s_Cathedral_-_Google_Art_Project.jpg',year:1747,title:{ko:'《성 바오로 대성당》',en:'St Paul’s Cathedral'},description:{ko:'런던 체류기에 템스 강과 성 바오로 대성당을 베네치아 풍경처럼 넓은 하늘과 맑은 수면 안에 조직했다.',en:'During his London years, he organised the Thames and St Paul’s beneath a broad sky with Venetian clarity.'}},
  {id:'local-canaletto-thames-from-richmond-house',file:'Canaletto_london.jpg',year:1747,title:{ko:'《리치먼드 하우스에서 본 템스 강과 성 바오로 대성당》',en:'The Thames and St Paul’s from Richmond House'},description:{ko:'강을 넓게 펼치고 성 바오로 대성당을 수평선에 놓아, 런던을 베네치아 베두타의 시선으로 재구성한다.',en:'The broad river and distant St Paul’s recast London through the visual logic of Venetian veduta.'}},
  {id:'local-canaletto-westminster-bridge-procession',file:'3840px-Canaletto_-_Westminster_Bridge,_with_the_Lord_Mayor\'s_Procession_on_the_Thames_-_Google_Art_Project.jpg',year:1747,title:{ko:'《템스 강의 시장 행렬과 웨스트민스터 다리》',en:'Westminster Bridge, with the Lord Mayor’s Procession on the Thames'},description:{ko:'새 다리와 수상 행렬을 한 화면에 넣어, 런던의 공적 의례와 근대 도시 기반시설을 장관으로 바꾼다.',en:'A new bridge and civic river procession turn London’s infrastructure and ceremony into spectacle.'}},
  {id:'local-canaletto-warwick-castle',file:'3840px-Canaletto_-_Warwick_Castle_-_Google_Art_Project.jpg',year:1748,title:{ko:'《워릭 성》',en:'Warwick Castle'},description:{ko:'영국 귀족의 영지를 넓은 하늘과 정원, 중세 성채의 균형 속에 배치해 영국 풍경화의 취향과 만난다.',en:'An English aristocratic estate is balanced among sky, garden, and medieval fortress.'}},
  {id:'local-canaletto-westminster-abbey',file:'Westminster_Abbey_by_Canaletto.jpg',year:1749,title:{ko:'《웨스트민스터 사원》',en:'Westminster Abbey'},description:{ko:'고딕 건축의 밀도를 과장하지 않고, 열린 광장과 시민의 움직임 속에서 런던의 공적 공간으로 제시한다.',en:'Gothic density is balanced with open public space and moving citizens in a London view.'}}
];

async function main(){
  const data=JSON.parse(await fs.readFile(artistsPath,'utf8'));
  const artist=data.artists.find(item=>item.id===artistId);
  if(!artist)throw new Error(`Artist not found: ${artistId}`);
  await fs.mkdir(targetDir,{recursive:true});
  const byId=new Map((artist.works||[]).map(work=>[work.id,work]));
  for(const item of localWorks){
    const source=path.join(sourceDir,item.file),targetName=`${item.id}${path.extname(item.file).toLowerCase()}`,target=path.join(targetDir,targetName);
    await fs.access(source); await fs.copyFile(source,target);
    const image=path.relative(root,target).replace(/\\/g,'/');
    const work={id:item.id,year:item.year,popularity:100,title:item.title,description:item.description,medium:{ko:'유화',en:'Oil on canvas'},country:{ko:'베네치아 공화국',en:'Republic of Venice'},movement:{ko:'로코코',en:'Rococo'},image,thumbnail:image,highResImage:image,highResOriginal:image,source:`local import from 다운로드용/${item.file}`,verified:true,status:'verified',representative:true,movementContribution:true,origin:'local-import',metadata:{createdAt:now,updatedAt:now,createdBy:'local import',updatedBy:'local import'},migration:{schema:1,image:{status:'ready',localThumbnail:image,highResolution:image,sourceUrl:'',sourceUrls:[],license:'local user-provided file',institution:''}}};
    if(item.replace){const prior=byId.get(item.replace)||{};byId.set(item.replace,{...prior,...work,id:item.replace});}else byId.set(item.id,work);
  }
  artist.works=[...byId.values()].sort((a,b)=>Number(a.year)-Number(b.year)||String(a.id).localeCompare(String(b.id)));
  artist.nationality={ko:'베네치아 공화국',en:'Republic of Venice'};
  artist.artistSummary={ko:[
    '베네치아 공화국 출신의 베두타(도시 풍경) 화가로, 로코코 시대 베네치아의 시각적 이미지를 대표합니다.',
    '정확한 원근, 맑은 빛, 선택적으로 재구성한 건축과 수로를 결합해 도시를 사실 기록이자 연출된 장면으로 만들었습니다.',
    '조지프 스미스의 후원과 영국 체류를 통해 베네치아 풍경의 국제 시장을 넓히고, 런던의 템스 강 풍경에도 같은 시선을 적용했습니다.'
  ],en:[]};
  artist.featuredWorkIds=['artist-Q161866-representative-work','local-canaletto-grand-canal-entrance','local-canaletto-westminster-bridge-procession','local-canaletto-thames-from-richmond-house','local-canaletto-warwick-castle'];
  artist.metadata={...(artist.metadata||{}),updatedAt:now,updatedBy:'local import'};
  await fs.writeFile(artistsPath,JSON.stringify(data,null,2)+'\n','utf8');
  console.log(JSON.stringify({artistId,processed:localWorks.length,totalWorks:artist.works.length},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
