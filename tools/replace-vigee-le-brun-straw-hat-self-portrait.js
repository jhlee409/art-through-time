const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const artistId = 'artist-Q213163';
const workId = 'wikidata-Q18719540';
const source = path.join(root, '다운로드용', '3840px-Self-portrait_in_a_Straw_Hat_by_Elisabeth-Louise_Vigée-Lebrun.jpg');
const destination = path.join(root, 'data', 'images', artistId, `${workId}.jpg`);
const artistsFile = path.join(root, 'data', 'artists.json');

if (!fs.existsSync(source)) throw new Error(`Missing local image: ${source}`);
fs.mkdirSync(path.dirname(destination), {recursive: true});
fs.copyFileSync(source, destination);
const data = JSON.parse(fs.readFileSync(artistsFile, 'utf8'));
const artist = data.artists?.find(item => item.id === artistId);
const work = artist?.works?.find(item => item.id === workId);
if (!work) throw new Error('Vigee Le Brun Self-Portrait in a Straw Hat was not found');
const localPath = path.relative(root, destination).replace(/\\/g, '/');
Object.assign(work, {title:{ko:'밀짚모자를 쓴 자화상',en:'Self-Portrait in a Straw Hat'},year:1782,description:{ko:'투명한 빛, 부드러운 피부, 자연스러운 시선으로 궁정 초상의 우아함과 신고전주의의 명료한 형태감을 함께 보여주는 자화상이다.',en:'A self-portrait whose transparent light, soft flesh tones, and direct gaze join courtly elegance with Neoclassical clarity of form.'},country:{ko:'프랑스',en:'France'},movement:{ko:'로코코·신고전주의',en:'Rococo and Neoclassicism'},image:localPath,thumbnail:localPath,highResImage:localPath,highResOriginal:localPath,source:'local download import: 3840px-Self-portrait_in_a_Straw_Hat_by_Elisabeth-Louise_Vigée-Lebrun.jpg',verified:true,representative:true,movementContribution:true,status:'verified',origin:'manual'});
work.migration = {schema:1,image:{status:'ready',localThumbnail:localPath,highResolution:localPath,sourceUrl:'',sourceUrls:[],license:'',institution:''}};
artist.featuredWorkIds = [workId];
artist.artistSummary = {ko:['18세기 프랑스 궁정에서 활동한 당대의 가장 유명한 여성 초상화가 가운데 한 명으로, 마리 앙투아네트와 왕실·귀족의 초상을 다수 제작했다.','로코코의 우아함과 신고전주의의 명료한 형태를 결합한 매력적인 초상화로 알려졌다.','왕당파 성향 때문에 프랑스 혁명기에는 망명했으나, 나폴리·오스트리아·러시아 궁정에서도 초상화가로 활동했다.'],en:['One of the most celebrated women portrait painters active at the French court in the eighteenth century, she painted Marie Antoinette and many royal and aristocratic sitters.','Her portraits combine Rococo elegance with the clear form associated with Neoclassicism.','Her royalist affiliation led to exile during the French Revolution, after which she worked for courts in Naples, Austria, and Russia.']};
data.metadata = {...data.metadata,updatedAt:new Date().toISOString(),revision:(Number(data.metadata?.revision)||0)+1};
fs.writeFileSync(artistsFile, `${JSON.stringify(data,null,2)}\n`, 'utf8');
console.log(`Replaced ${workId} with ${localPath}`);
