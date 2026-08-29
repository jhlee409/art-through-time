const fs=require('fs/promises');
const path=require('path');

const root=path.resolve(__dirname,'..');
const artistId='artist-Q235547';
const sourceDir=path.join(root,'다운로드용');
const targetDir=path.join(root,'data','images',artistId);
const artistsPath=path.join(root,'data','artists.json');
const now='2026-08-27T00:00:00Z';
const localWorks=[
  {id:'local-carriera-watteau-portrait',file:'(Treviso)_The_painter_Antoine_Watteau_by_Rosalba_Carriera_-_Museo_civico_di_Santa_Caterina.jpg',year:1720,title:{ko:'《앙투안 바토의 초상》',en:'Portrait of Antoine Watteau'},description:{ko:'파리 체류기의 예술가 초상으로, 부드러운 피부 표현과 절제된 배경이 파스텔 특유의 친밀한 시선을 보여준다.',en:'An intimate pastel portrait whose soft modelling and restrained ground show the medium’s distinctive closeness.'}},
  {id:'local-carriera-gentleman-in-red',file:'3840px-Ca\'_Rezzonico_Sala_dei_pastelli_-_Ritratto_di_gentiluomo_in_rosso_c.1740_-_Rosalba_Carriera.jpg',year:1740,title:{ko:'《붉은 옷을 입은 신사의 초상》',en:'Portrait of a Gentleman in Red'},description:{ko:'붉은 옷감과 얼굴의 미세한 색조 변화를 파스텔로 조율해, 후기 로코코 초상의 우아한 물질감을 드러낸다.',en:'Pastel modulates red fabric and subtle facial colour into an elegant late-Rococo presence.'}},
  {id:'local-carriera-woman-with-mask',file:'Artgate_Fondazione_Cariplo_-_Carriera_Rosalba,_Ritratto_femminile_con_maschera.jpg',year:1725,title:{ko:'《가면을 든 여인의 초상》',en:'Portrait of a Woman with a Mask'},description:{ko:'가면, 피부, 비단의 섬세한 대비로 베네치아 사교 문화와 로코코 초상의 은밀한 연극성을 보여준다.',en:'Mask, skin, and silk set Venetian sociability and Rococo theatrical intimacy into delicate contrast.'}},
  {id:'local-carriera-venetian-lady-barbarigo',file:'Rosalba_Carriera_-_A_Venetian_Lady_from_the_House_of_Barbarigo_(Caterina_Sagredo_Barbarigo)_-_Google_Art_Project.jpg',year:1730,title:{ko:'《바르바리고 가문의 베네치아 여인》',en:'A Venetian Lady from the House of Barbarigo'},description:{ko:'머리장식과 옷감, 빛나는 피부를 가루 안료의 층으로 표현해 베네치아 귀족 초상의 세련된 친밀감을 만든다.',en:'Layered powdery colour turns adornment, fabric, and luminous skin into an intimate aristocratic portrait.'}},
  {id:'local-carriera-lady-in-turkish-costume',file:'Rosalba_Carriera_-_Dame_im_türkischen_Kostüm.jpeg',year:1730,title:{ko:'《터키 의상을 입은 여인》',en:'Lady in Turkish Costume'},description:{ko:'이국적 의상과 부드러운 색조를 결합해 18세기 유럽 궁정의 취향과 로코코의 감각적 표면을 드러낸다.',en:'Exotic costume and soft colour reveal courtly taste and the sensuous surface of Rococo portraiture.'}},
  {id:'local-carriera-maria-theresa',file:'Rosalba_Carriera_-_Maria_Theresa,_Archduchess_of_Habsburg_(1717-1780)_-_Google_Art_Project.jpg',year:1730,title:{ko:'《마리아 테레사, 합스부르크 대공녀》',en:'Maria Theresa, Archduchess of Habsburg'},description:{ko:'파스텔의 맑은 분홍·청색·흰색과 벨벳 같은 피부 표현으로 어린 대공녀를 격식보다 친밀하게 보여준다. 궁정 초상을 가볍고 투명한 색채, 섬세한 표면, 자연스러운 시선으로 바꾼 카리에라 로코코의 핵심 사례다.',en:'Clear pink, blue, and white pastel, together with velvety skin, make the young archduchess intimate rather than ceremonially remote—a key Carriera Rococo portrait.'}},
  {id:'local-carriera-young-girl-with-monkey',file:'Rosalba_Carriera_-_Young_Girl_Holding_a_Monkey_-_WGA04508.jpg',year:1730,title:{ko:'《원숭이를 안은 소녀》',en:'Young Girl Holding a Monkey'},description:{ko:'장난스러운 동물과 젊은 모델의 표정을 파스텔의 부드러운 터치로 연결해 로코코의 친밀하고 가벼운 정서를 만든다.',en:'A playful animal and youthful expression are joined by soft pastel touch into Rococo intimacy and lightness.'}}
];
async function main(){
  const data=JSON.parse(await fs.readFile(artistsPath,'utf8'));
  const artist=data.artists.find(item=>item.id===artistId);
  if(!artist)throw new Error(`Artist not found: ${artistId}`);
  await fs.mkdir(targetDir,{recursive:true});
  const byId=new Map((artist.works||[]).map(work=>[work.id,work]));
  const representative=byId.get('artist-Q235547-representative-work');
  if(representative){representative.medium={ko:'파스텔',en:'Pastel on paper'};representative.country={ko:'이탈리아',en:'Italy'};representative.description={ko:'말년의 자화상으로, 섬세한 레이스와 피부 표현에 카리에라의 파스텔 솜씨가 드러난다.',en:'A late self-portrait displaying Carriera’s pastel treatment of lace and skin.'};}
  for(const item of localWorks){
    const source=path.join(sourceDir,item.file),targetName=`${item.id}${path.extname(item.file).toLowerCase()}`,target=path.join(targetDir,targetName);
    await fs.access(source);await fs.copyFile(source,target);
    const image=path.relative(root,target).replace(/\\/g,'/');
    byId.set(item.id,{...item,popularity:100,medium:{ko:'파스텔',en:'Pastel on paper'},country:{ko:'이탈리아',en:'Italy'},movement:{ko:'로코코',en:'Rococo'},image,thumbnail:image,highResImage:image,highResOriginal:image,source:`local import from 다운로드용/${item.file}`,verified:true,status:'verified',representative:true,movementContribution:true,origin:'local-import',metadata:{createdAt:now,updatedAt:now,createdBy:'local import',updatedBy:'local import'},migration:{schema:1,image:{status:'ready',localThumbnail:image,highResolution:image,sourceUrl:'',sourceUrls:[],license:'local user-provided file',institution:''}}});
  }
  artist.works=[...byId.values()].sort((a,b)=>Number(a.year)-Number(b.year)||String(a.id).localeCompare(String(b.id)));
  artist.artistSummary={ko:[
    '베네치아 출신의 로코코 화가로, 파스텔 초상을 유럽 궁정과 살롱 문화의 핵심 매체로 끌어올렸습니다.',
    '밝고 투명한 색, 벨벳 같은 피부, 레이스와 비단의 미세한 질감을 통해 격식 있는 초상을 친밀한 관찰의 이미지로 바꾸었습니다.',
    '파리·뒤셀도르프·모데나·빈의 국제 고객과 궁정 주문은 베네치아 로코코의 파스텔 감각을 유럽 전역에 퍼뜨렸습니다.'
  ],en:[]};
  artist.featuredWorkIds=['local-carriera-maria-theresa','local-carriera-venetian-lady-barbarigo','local-carriera-woman-with-mask','local-carriera-young-girl-with-monkey','artist-Q235547-representative-work'];
  artist.metadata={...(artist.metadata||{}),updatedAt:now,updatedBy:'local import'};
  await fs.writeFile(artistsPath,JSON.stringify(data,null,2)+'\n','utf8');
  console.log(JSON.stringify({artistId,imported:localWorks.length,totalWorks:artist.works.length},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
