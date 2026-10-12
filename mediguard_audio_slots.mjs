export const AUDIO_SLOTS = Object.freeze([
  ...[['title','タイトル'],['home','メニュー'],['characters','キャラクター'],['gacha','ガチャ画面'],['records','記録'],['help','遊び方'],['settings','ゲーム設定'],['coop','協力待機室'],['loading','出撃準備'],['battle','戦闘'],['resultWin','勝利画面'],['resultLose','敗北画面'],['limitBreak','限界突破']].map(([id,label])=>({id:`bgm_${id}`,label:`${label}のBGM`,kind:'bgm'})),
  ...[['button','共通ボタン'],['back','ゲーム内で戻る'],['open','ゲーム開始'],['select','キャラ選択'],['sortie','出撃'],['shoot','通常攻撃'],['charge','チャージ攻撃'],['skill','スキル'],['danger','ウェーブ警告'],['hit','被弾'],['win','勝利'],['lose','敗北'],['gacha','ガチャ開始'],['gachaCharge','ガチャ開封'],['reveal_N','N獲得'],['reveal_R','R獲得'],['reveal_SR','SR獲得'],['reveal_SSR','SSR獲得'],['reveal_UR','UR獲得'],['reveal_LR','LR獲得']].map(([id,label])=>({id:`sfx_${id}`,label:`${label}の効果音`,kind:'sfx'})),
]);
export const DEFAULT_AUDIO = Object.freeze(Object.fromEntries(AUDIO_SLOTS.map(slot=>[slot.id,{
  url: slot.id==='sfx_button' ? 'https://res.cloudinary.com/vpctonjf/video/upload/v1791802078/caremate/mediguard/audio/ojcenfrkbaaswose1ydx.wav' : slot.kind==='bgm' ? `audio/mediguard/${slot.id.includes('battle')?'battle':slot.id.includes('gacha')?'gacha':'home'}.wav` : `audio/mediguard/${slot.id.startsWith('sfx_reveal')?'reveal':slot.id.includes('shoot')?'shoot':slot.id.includes('hit')||slot.id.includes('lose')?'impact':slot.id.includes('gacha')||slot.id.includes('skill')||slot.id.includes('charge')?'sweep':'click'}.wav`,
  volume:slot.kind==='bgm'?.48:.65,loop:slot.kind==='bgm',enabled:true,
}])));
