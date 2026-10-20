export const CHAPTERS = [
 ['Ch1','Introducing biology','生物學簡介'],
 ['Ch2','The cell as the basic unit of life','細胞：生命的基本單位'],
 ['Ch3','Movement of substances across cell membrane','物質穿越細胞膜'],
 ['Ch4','Enzymes and metabolism','酶與代謝'],
 ['Ch5','Food and humans','食物與人類'],
 ['Ch6','Nutrition in humans','人類的營養'],
 ['Ch7','Gas exchange in humans','人類的氣體交換'],
 ['Ch8','Transport in humans','人類的物質運輸'],
 ['Ch9','Nutrition and gas exchange in plants','植物的營養與氣體交換'],
 ['Ch10','Transpiration, transport and support in plants','植物的蒸騰、運輸與支持'],
 ['Ch11','Cell cycle and division','細胞週期與分裂'],
 ['Ch12','Reproduction in flowering plants','開花植物的生殖'],
 ['Ch13','Reproduction in humans','人類的生殖'],
 ['Ch14','Growth and development','生長與發育'],
 ['Ch15','Detecting the environment','感知環境'],
 ['Ch16','Coordination in humans','人類的協調'],
 ['Ch17','Movement in humans','人類的運動'],
 ['Ch18','Homeostasis','體內平衡'],
 ['Ch19','Ecosystems','生態系統'],
 ['Ch20','Photosynthesis','光合作用'],
 ['Ch21','Respiration','呼吸作用'],
 ['Ch22','Non-infectious diseases','非傳染病'],
 ['Ch23','Infectious diseases and disease prevention','傳染病與疾病預防'],
 ['Ch24','Body defence mechanisms','身體的防禦機制'],
 ['Ch25','Basic genetics','基礎遺傳學'],
 ['Ch26','Molecular genetics','分子遺傳學'],
 ['Ch27','Biotechnology','生物技術'],
 ['Ch28','Biodiversity','生物多樣性'],
 ['Ch29','Evolution I','進化 I'],
 ['Ch30','Evolution II','進化 II'],
 ['E1','Human physiology: regulation and control','人體生理學：調節與控制'],
 ['E2','Applied ecology','應用生態學'],
 ['E3','Microorganisms and humans','微生物與人類'],
 ['E4','Biotechnology','生物技術']
].map(([id,en,zh])=>({id,en,zh,topic:`${id} · ${en}`}));
const aristoMap={1:'Ch1',2:'Ch2',3:'Ch2',4:'Ch3',5:'Ch4',6:'Ch5',7:'Ch6',8:'Ch7',9:'Ch8',10:'Ch9',11:'Ch10',12:'Ch11',13:'Ch12',14:'Ch13',15:'Ch14',16:'Ch14',17:'Ch16',18:'Ch17',19:'Ch18',20:'Ch19',21:'Ch20',22:'Ch21',23:'Ch23',24:'Ch22',25:'Ch24',26:'Ch15',27:'Ch26',28:'Ch25',29:'Ch28',30:'Ch30',31:'Ch29',32:'E1',33:'E1',34:'E1',35:'E1',36:'E2',37:'E2'};
export function chapterTopic(id){return CHAPTERS.find(c=>c.id===id)?.topic || id;}
export function canonicalTopic(topic){
 const legacy=String(topic || '').match(/^Chapter (\d+) · /);
 return legacy?chapterTopic(aristoMap[Number(legacy[1])] || 'Integrated topics'):topic;
}
export function topicLabel(topic,language='en'){
 const chapter=CHAPTERS.find(c=>c.topic===topic);
 return chapter?`${chapter.id} · ${language==='zh'?chapter.zh:chapter.en}`:topic;
}
export function topicOrder(topic){const i=CHAPTERS.findIndex(c=>c.topic===topic);return i<0?100:i;}
