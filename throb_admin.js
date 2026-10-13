import { auth, functions, studentNumber, isAdmin, setupTheme, initializePage } from './common.js';
import { getIdTokenResult } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js';

const $ = (id) => document.getElementById(id);
const RARITIES = ['N', 'R', 'SR', 'SSR', 'UR', 'LR'];
const CATEGORIES = [
  ['character', 'キャラクター'], ['gear', '武器・防具'],
  ['accessory', 'アクセサリー'], ['skill', 'スキル'],
];
let config = null;
let busy = false;

await auth.authStateReady();
const token = auth.currentUser ? await getIdTokenResult(auth.currentUser) : null;
if (!await isAdmin() || studentNumber !== '2510044' ||
  auth.currentUser?.uid !== 'caremate-2510044' ||
  token?.claims?.studentNumber !== '2510044' || token?.claims?.admin !== true) {
  location.replace('admin.html');
  throw new Error('Throb管理は総管理者だけが利用できます。');
}

$('throbAdminRoot').hidden = false;
setupTheme($('throbAdminTheme'));
await initializePage([loadConfig()]);
$('throbReload').addEventListener('click', () => void loadConfig());
$('throbAdminForm').addEventListener('submit', (event) => {
  event.preventDefault();
  void saveConfig();
});

function status(message, kind = 'info') {
  $('throbAdminStatus').textContent = message;
  $('throbAdminStatus').dataset.kind = kind;
}

function setBusy(value) {
  busy = value;
  $('throbSave').disabled = value;
  $('throbReload').disabled = value;
}

function createInput(id, label, value, { step = '1', min = '1', max = '100000' } = {}) {
  const wrapper = document.createElement('label');
  wrapper.className = 'throb-admin-field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('input');
  input.id = id;
  input.type = 'number';
  input.inputMode = 'decimal';
  input.step = step;
  input.min = min;
  input.max = max;
  input.value = String(value);
  input.required = true;
  wrapper.append(caption, input);
  return wrapper;
}

function render() {
  if (!config) return;
  const rateGrid = $('throbRateGrid');
  rateGrid.replaceChildren();
  for (const rarity of RARITIES) {
    const field = createInput(`rate-${rarity}`, `${rarity} 排出率（%）`,
      config.rarityBasisPoints[rarity] / 100, { step: '0.01', min: '0', max: '100' });
    field.querySelector('input').addEventListener('input', updateTotal);
    rateGrid.append(field);
  }
  const priceGrid = $('throbPriceGrid');
  priceGrid.replaceChildren();
  for (const [category, name] of CATEGORIES) {
    const row = document.createElement('div');
    row.className = 'throb-admin-price-row';
    const heading = document.createElement('h3');
    heading.textContent = name;
    row.append(heading,
      createInput(`price-${category}-1`, '1回（pt）', config.gachaPrices[category][1]),
      createInput(`price-${category}-10`, '10連（pt）', config.gachaPrices[category][10]));
    priceGrid.append(row);
  }
  const shopGrid = $('throbShopGrid');
  shopGrid.replaceChildren();
  for (const rarity of ['N', 'R']) {
    shopGrid.append(createInput(`shop-${rarity}`, `${rarity}直接購入（pt）`, config.shopPrices[rarity]));
  }
  updateTotal();
}

function updateTotal() {
  const sum = RARITIES.reduce((total, rarity) => total + Number($(`rate-${rarity}`)?.value || 0), 0);
  $('throbRateTotal').textContent = `${Number(sum.toFixed(2))}%`;
  $('throbRateTotal').dataset.valid = Math.abs(sum - 100) < 0.000001 ? 'true' : 'false';
}

function readConfig() {
  const rarityBasisPoints = Object.fromEntries(RARITIES.map((id) =>
    [id, Math.round(Number($(`rate-${id}`).value) * 100)]));
  const gachaPrices = Object.fromEntries(CATEGORIES.map(([id]) => [id, {
    1: Number($(`price-${id}-1`).value), 10: Number($(`price-${id}-10`).value),
  }]));
  const shopPrices = { N: Number($('shop-N').value), R: Number($('shop-R').value) };
  if (Object.values(rarityBasisPoints).some((value) => !Number.isSafeInteger(value) || value < 0) ||
    Object.values(rarityBasisPoints).reduce((sum, value) => sum + value, 0) !== 10000 ||
    RARITIES.slice(2).every((id) => rarityBasisPoints[id] === 0)) {
    throw new Error('排出率の合計を100%にし、SR以上を少なくとも1種類設定してください。');
  }
  for (const value of [...Object.values(shopPrices),
    ...Object.values(gachaPrices).flatMap((prices) => [prices[1], prices[10]])]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 100000) {
      throw new Error('価格は1〜100000ptの整数で入力してください。');
    }
  }
  return { rarityBasisPoints, gachaPrices, shopPrices };
}

async function loadConfig() {
  if (busy) return;
  setBusy(true);
  status('設定を読み込み中…');
  try {
    const result = await httpsCallable(functions, 'getThrobAdminConfig', { timeout: 60000 })({});
    config = result.data.config;
    render();
    status('現在の設定を表示しています。');
  } catch (error) {
    console.error('Throb config load:', error);
    status('設定を読み込めませんでした。通信を確認して再読み込みしてください。', 'error');
  } finally { setBusy(false); }
}

async function saveConfig() {
  if (busy) return;
  let next;
  try { next = readConfig(); }
  catch (error) { status(error.message, 'error'); return; }
  setBusy(true);
  status('設定を保存中…');
  try {
    const result = await httpsCallable(functions, 'saveThrobAdminConfig', { timeout: 60000 })({ config: next });
    config = result.data.config;
    render();
    status('保存しました。次の抽選・購入から反映されます。');
  } catch (error) {
    console.error('Throb config save:', error);
    status('保存できませんでした。画面の値を確認して再試行してください。', 'error');
  } finally { setBusy(false); }
}
