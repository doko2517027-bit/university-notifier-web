const AUDIO_KEYS = Object.freeze([
  ...['title','home','characters','gacha','records','help','settings','coop','loading','battle','resultWin','resultLose','limitBreak'].map(id=>`bgm_${id}`),
  ...['button','back','open','select','sortie','shoot','charge','skill','danger','hit','win','lose','gacha','gachaCharge','reveal_N','reveal_R','reveal_SR','reveal_SSR','reveal_UR','reveal_LR'].map(id=>`sfx_${id}`),
]);
function sanitizeAudioConfig(value={}) {
  const result={};
  for (const key of AUDIO_KEYS) {
    const item=value[key];if(!item||typeof item!=='object')continue;
    const url=String(item.url||'');
    if(url&&!/^https:\/\/res\.cloudinary\.com\/vpctonjf\/(video|raw)\/upload\/[A-Za-z0-9_.,!\/~%-]+\.(mp3|m4a|wav|aac|ogg|mp4)(\?.*)?$/i.test(url))throw new Error('CareMateのCloudinary音声URLを指定してください。');
    if(url.length>1500)throw new Error('音声URLが長すぎます。');
    result[key]={...(url?{url,filename:String(item.filename||'').slice(0,120)}:{}),volume:Math.max(0,Math.min(1,Number.isFinite(Number(item.volume))?Number(item.volume):.6)),loop:key.startsWith('bgm_')&&item.loop!==false,enabled:item.enabled!==false};
  }
  return result;
}
module.exports={AUDIO_KEYS,sanitizeAudioConfig};
