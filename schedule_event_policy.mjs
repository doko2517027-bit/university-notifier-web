// 履修科目に紐づかない、学年共通の予定。クラス指定は別途絞り込む。
export function isCommonScheduleEvent(item) {
  if (
    item?.displayForAll === true ||
    item?.isCommonEvent === true ||
    item?.isGuidance === true
  ) {
    return true;
  }

  const label = [item?.type, item?.category, item?.subject, item?.title]
    .filter(Boolean)
    .join(" ");
  return /ガイダンス|オリエンテーション|説明会|健康診断|予防接種|ワクチン接種|入学式|卒業式|ホームルーム|国家試験対策|国試対策|模擬試験|模試|特別講義|講演会?|セミナー|研修会?|学内行事|就職支援|キャリア支援|防災訓練|避難訓練/.test(
    label,
  );
}
