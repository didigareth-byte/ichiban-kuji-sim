import { useState, useEffect, useMemo, useRef, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   賞券所 — 一番賞共抽模擬
   · 每檔是一個實體箱：預先洗好的固定籤序，抽走就沒了
   · 共抽模式下所有人共用同一箱，抽完自動開下一箱
   · 賞品圖為原創向量圖版，非官方商品照
   ══════════════════════════════════════════════════════════════ */

const START_MONEY = 100000;
const W_COST = 20;
const W_RATE = 0.03;
const HALL_KEY = "kuji:hall:v2";
const ME_KEY = "kuji:me:v2";
const POLL_MS = 7000;
const HEAT_HALFLIFE = 3 * 24 * 60 * 60 * 1000; // 熱度半衰期三天

/** 熱度＝累積抽數，但會隨時間衰退，所以「上週爆紅」不會永遠卡在第一。
 *  半衰期三天：三天沒人抽，熱度剩一半。 */
function heatOf(st, now) {
  if (!st || !st.d) return 0;
  const age = Math.max(0, now - (st.t || now));
  return st.d * Math.pow(0.5, age / HEAT_HALFLIFE);
}

/** 兩份統計合併：累積抽數與熱度都取較大者（單調遞增，不怕覆寫掉別人的） */
function mergeStats(a = {}, b = {}) {
  const out = { ...a };
  for (const id of Object.keys(b)) {
    const x = a[id], y = b[id];
    if (!x) { out[id] = y; continue; }
    const now = Date.now();
    out[id] = {
      n: Math.max(x.n || 0, y.n || 0),
      d: Math.max(heatOf(x, now), heatOf(y, now)),
      t: now,
    };
  }
  return out;
}

/* ───────── 賞品資料 ─────────
   結構依 BANDAI SPIRITS 一番賞公開情報與台灣代理通路配率還原；
   v = 全新未拆行情概估；k = 品類（決定圖版）；img 可填自有授權圖網址。 */

const V = {
  kmyC: ["童磨", "胡蝶忍", "香奈乎", "炭治郎", "禰豆子", "善逸", "伊之助", "義勇", "無慘", "猗窩座"],
  ckaC: ["吉伊卡哇", "小八貓", "兔兔", "小桃鼠", "栗子饅頭", "風獅", "海獺", "古本屋"],
  opC: ["魯夫", "索隆", "香吉士", "娜美", "喬巴", "羅賓", "騙人布", "佛朗基", "布魯克", "甚平", "艾斯", "薩波"],
  jjkC: ["五條悟", "虎杖", "伏黑", "野薔薇", "七海", "宿儺", "真人", "漏瑚", "夏油", "熊貓", "狗卷", "真希"],
  pkmC: ["皮卡丘", "伊布", "卡比獸", "妙蛙種子", "小火龍", "傑尼龜", "波克比", "夢幻", "路卡利歐", "耿鬼", "呆呆獸", "胖丁"],
  spyC: ["安妮亞", "約兒", "洛伊德", "邦德", "貝琪", "戴米安", "尤利", "法蘭基", "亨德森", "全家福"],
  nrtC: ["鳴人", "佐助", "小櫻", "卡卡西", "自來也", "雛田", "我愛羅", "鼬", "佩恩", "奇拉比"],
  dbC: ["悟空", "貝吉塔", "弗利沙", "比克", "悟飯", "特南克斯", "克林", "布瑪"],
  hqC: ["日向翔陽", "影山飛雄", "及川徹", "宮侑", "月島螢", "西谷夕", "澤村大地", "赤葦京治", "木兔光太郎", "牛島若利", "菅原孝支", "田中龍之介"],
  aotC: ["利威爾", "米卡莎", "艾連", "阿爾敏", "韓吉", "埃爾文", "亞妮", "萊納", "讓", "調查兵團"],
  umaC: ["特別週", "無聲鈴鹿", "東海帝王", "黃金船", "大和赤驥", "目白麥昆", "魯道夫象徵", "丸善斯基", "富士奇蹟", "小栗帽", "草上飛", "菱亞馬遜"],
};

const KUJI = [
  {
    id: "kmy", title: "一番賞 鬼滅之刃 ～上弦之貳～", series: "鬼滅の刃",
    price: 390, total: 70, tone: "#7B2D3B",
    accent: "#E8B44A", motif: "petal", cover: "",
    pop: 2,
    note: "MASTERLISE 高階線，三尊大型立像領銜。",
    prizes: [
      { g: "A", name: "童磨 MASTERLISE 約27cm", n: 1, v: 1950, k: "figure" },
      { g: "B", name: "胡蝶忍 MASTERLISE 約22.5cm", n: 1, v: 1500, k: "figure" },
      { g: "C", name: "栗花落香奈乎 MASTERLISE 約22.5cm", n: 1, v: 1360, k: "figure" },
      { g: "D", name: "Q版迷你公仔 約7cm", n: 8, v: 360, k: "figure", variants: V.kmyC.slice(0, 5) },
      { g: "E", name: "壓克力立牌 約12cm", n: 12, v: 90, k: "board", variants: V.kmyC.slice(0, 8) },
      { g: "F", name: "橡膠吊飾 約6cm", n: 14, v: 160, k: "charm", variants: V.kmyC },
      { g: "G", name: "貼紙組", n: 16, v: 80, k: "sticker", variants: ["無限城", "柱合會議", "蝶屋", "日輪刀", "藤紋", "鬼殺隊", "上弦", "呼吸"] },
      { g: "H", name: "視覺色紙", n: 17, v: 90, k: "board", variants: V.kmyC },
    ],
    last: { name: "童磨 MASTERLISE 最後賞Ver.", v: 2990, k: "figure" },
    wchance: { name: "童磨 MASTERLISE 特別彩色Ver.", v: 3770, k: "figure" },
  },
  {
    id: "cka", title: "一番賞 吉伊卡哇 ～大家一起吃拉麵～", series: "ちいかわ",
    price: 300, total: 80, tone: "#B5647A",
    accent: "#F6D9E2", motif: "dots", cover: "",
    pop: 1,
    note: "小物線最強，E～H 賞實用度高、溢價比最低。",
    prizes: [
      { g: "A", name: "拉麵計時器（三人組）", n: 1, v: 1320, k: "timer" },
      { g: "B", name: "吉伊卡哇 拉麵夥伴模型", n: 2, v: 620, k: "plush" },
      { g: "C", name: "小八貓 拉麵夥伴模型", n: 2, v: 620, k: "plush" },
      { g: "D", name: "兔兔 拉麵夥伴模型", n: 2, v: 620, k: "plush" },
      { g: "E", name: "陶瓷小碟", n: 15, v: 180, k: "plate", variants: V.ckaC.slice(0, 6) },
      { g: "F", name: "玻璃杯", n: 18, v: 210, k: "glass", variants: ["拉麵郎", "叉燒", "溏心蛋", "海苔"] },
      { g: "G", name: "毛巾", n: 20, v: 140, k: "towel", variants: V.ckaC },
      { g: "H", name: "壓克力吊飾", n: 20, v: 100, k: "charm", variants: [...V.ckaC, "勞動之友", "討伐組", "郎老闆", "大家"] },
    ],
    last: { name: "拉麵計時器 特別配色Ver.", v: 2020, k: "timer" },
    wchance: { name: "拉麵計時器 金色Ver.", v: 2550, k: "timer" },
  },
  {
    id: "nrt", title: "一番賞 火影忍者疾風傳 ～輪迴的悲嘆與和平的橋樑～", series: "NARUTO",
    price: 380, total: 78, tone: "#B05B1E",
    accent: "#F0C14B", motif: "swirl", cover: "",
    pop: 5,
    note: "A～E 五尊 MASTERLISE 全開，上位賞最厚的一檔。",
    prizes: [
      { g: "A", name: "漩渦鳴人（仙人模式）MASTERLISE 約24cm", n: 1, v: 1500, k: "figure" },
      { g: "B", name: "日向雛田 MASTERLISE", n: 1, v: 1150, k: "figure" },
      { g: "C", name: "自來也 MASTERLISE 約25cm", n: 1, v: 1050, k: "figure" },
      { g: "D", name: "奇拉比 MASTERLISE", n: 1, v: 950, k: "figure" },
      { g: "E", name: "天道佩恩 MASTERLISE", n: 1, v: 900, k: "figure" },
      { g: "F", name: "六道佩恩 Q版公仔 約6cm", n: 10, v: 280, k: "figure", variants: ["天道", "修羅道", "人間道", "畜生道", "餓鬼道", "地獄道"] },
      { g: "G", name: "蛞蝓生態環保袋", n: 12, v: 220, k: "bag", variants: ["蛞蝓", "妙木山", "木葉標誌"] },
      { g: "H", name: "橡膠雜貨吊飾", n: 15, v: 120, k: "charm", variants: V.nrtC },
      { g: "I", name: "提花毛巾", n: 16, v: 160, k: "towel", variants: V.nrtC.slice(0, 8) },
      { g: "J", name: "資料夾貼紙組", n: 20, v: 70, k: "file", variants: V.nrtC.slice(0, 8) },
    ],
    last: { name: "妖狐之衣 六尾化鳴人 MASTERLISE", v: 2300, k: "figure" },
    wchance: { name: "鳴人＆自來也 Revible Moment", v: 2900, k: "figure" },
  },
  {
    id: "opx", title: "一番賞 航海王 EX ～最強戰力～", series: "ONE PIECE",
    price: 420, total: 76, tone: "#8A5A20",
    accent: "#F2D68A", motif: "wave", cover: "",
    pop: 3,
    note: "EX 檔次，單抽最貴；四尊 MASTERLISE 但箱籤也多。",
    prizes: [
      { g: "A", name: "魯夫 MASTERLISE EXPIECE", n: 1, v: 1650, k: "figure" },
      { g: "B", name: "娜美 MASTERLISE", n: 1, v: 1260, k: "figure" },
      { g: "C", name: "索隆 MASTERLISE", n: 1, v: 1160, k: "figure" },
      { g: "D", name: "香吉士 MASTERLISE", n: 1, v: 1040, k: "figure" },
      { g: "E", name: "Q版造型公仔 約8cm", n: 10, v: 310, k: "figure", variants: V.opC.slice(0, 6) },
      { g: "F", name: "陶瓷馬克杯", n: 14, v: 250, k: "mug", variants: ["草帽海賊團", "海賊旗", "梅利號", "陽光號", "偉大航路"] },
      { g: "G", name: "壓克力立牌 約12cm", n: 16, v: 80, k: "board", variants: V.opC },
      { g: "H", name: "日式手拭巾", n: 16, v: 180, k: "towel", variants: V.opC.slice(0, 10) },
      { g: "I", name: "貼紙", n: 16, v: 70, k: "sticker", variants: V.opC },
    ],
    last: { name: "魯夫 尼卡形態 最後賞Ver.", v: 2530, k: "figure" },
    wchance: { name: "魯夫 尼卡形態 金色Ver.", v: 3190, k: "figure" },
  },
  {
    id: "dbz", title: "一番賞 七龍珠 VS OMNIBUS", series: "DRAGON BALL",
    price: 400, total: 76, tone: "#C07A18",
    accent: "#F5A623", motif: "star", cover: "",
    pop: 7,
    note: "老牌長青檔，上位賞市價硬，小賞也不算差。",
    prizes: [
      { g: "A", name: "孫悟空 超級賽亞人 MASTERLISE 約26cm", n: 1, v: 1580, k: "figure" },
      { g: "B", name: "貝吉塔 MASTERLISE", n: 1, v: 1210, k: "figure" },
      { g: "C", name: "弗利沙 最終型態 MASTERLISE", n: 1, v: 1100, k: "figure" },
      { g: "D", name: "比克 MASTERLISE", n: 1, v: 1000, k: "figure" },
      { g: "E", name: "Q版造型公仔 約7cm", n: 10, v: 290, k: "figure", variants: V.dbC.slice(0, 6) },
      { g: "F", name: "玻璃杯", n: 13, v: 250, k: "glass", variants: ["神龍", "龍珠", "龜仙流", "膠囊公司", "界王神"] },
      { g: "G", name: "龍珠造型置物盤", n: 14, v: 210, k: "plate", variants: ["一星", "二星", "三星", "四星", "五星", "六星", "七星"] },
      { g: "H", name: "手拭巾", n: 16, v: 170, k: "towel", variants: V.dbC },
      { g: "I", name: "視覺色紙", n: 19, v: 70, k: "board", variants: V.dbC },
    ],
    last: { name: "孫悟空 超級賽亞人 最後賞Ver.", v: 2420, k: "figure" },
    wchance: { name: "孫悟空 金色特別Ver.", v: 3040, k: "figure" },
  },
  {
    id: "jjk", title: "一番賞 咒術迴戰 ～澀谷事變～", series: "呪術廻戦",
    price: 350, total: 72, tone: "#3A4A6B",
    accent: "#8FA8D8", motif: "grid", cover: "",
    pop: 4,
    note: "上位四賞集中在主要角色，A 賞落袋率 1/72 起跳。",
    prizes: [
      { g: "A", name: "五條悟 MASTERLISE 約24cm", n: 1, v: 1580, k: "figure" },
      { g: "B", name: "虎杖悠仁 MASTERLISE", n: 1, v: 1210, k: "figure" },
      { g: "C", name: "伏黑惠 MASTERLISE", n: 1, v: 1100, k: "figure" },
      { g: "D", name: "釘崎野薔薇 MASTERLISE", n: 1, v: 1000, k: "figure" },
      { g: "E", name: "Q版公仔 約7cm", n: 9, v: 290, k: "figure", variants: V.jjkC.slice(0, 6) },
      { g: "F", name: "玻璃杯", n: 13, v: 250, k: "glass", variants: ["高專", "澀谷", "帳", "領域", "咒言"] },
      { g: "G", name: "壓克力吊飾", n: 15, v: 130, k: "charm", variants: V.jjkC },
      { g: "H", name: "A4資料夾", n: 15, v: 70, k: "file", variants: V.jjkC.slice(0, 8) },
      { g: "I", name: "視覺色紙", n: 16, v: 70, k: "board", variants: V.jjkC },
    ],
    last: { name: "五條悟 領域展開 最後賞Ver.", v: 2420, k: "figure" },
    wchance: { name: "五條悟 特別彩色Ver.", v: 3040, k: "figure" },
  },
  {
    id: "hqu", title: "一番賞 排球少年!! ～最高的舞台～", series: "ハイキュー!!",
    price: 330, total: 72, tone: "#2E6B5C",
    accent: "#F2C14E", motif: "chevron", cover: "",
    pop: 9,
    note: "運動系小賞實用，H 賞吊飾全 12 款蒐集難度高。",
    prizes: [
      { g: "A", name: "日向翔陽 MASTERLISE 約22cm", n: 1, v: 1350, k: "figure" },
      { g: "B", name: "影山飛雄 MASTERLISE", n: 1, v: 1040, k: "figure" },
      { g: "C", name: "及川徹 MASTERLISE", n: 1, v: 940, k: "figure" },
      { g: "D", name: "宮侑 MASTERLISE", n: 1, v: 860, k: "figure" },
      { g: "E", name: "Q版迷你公仔 約6cm", n: 10, v: 250, k: "figure", variants: V.hqC.slice(0, 8) },
      { g: "F", name: "玻璃杯", n: 12, v: 220, k: "glass", variants: ["烏野", "青葉城西", "音駒", "梟谷"] },
      { g: "G", name: "運動毛巾", n: 14, v: 140, k: "towel", variants: V.hqC.slice(0, 8) },
      { g: "H", name: "壓克力吊飾", n: 16, v: 110, k: "charm", variants: V.hqC },
      { g: "I", name: "隊伍旗幟色紙", n: 16, v: 60, k: "board", variants: V.hqC.slice(0, 10) },
    ],
    last: { name: "日向翔陽 最後賞Ver.", v: 2070, k: "figure" },
    wchance: { name: "烏野排球部 特別套組", v: 2610, k: "figure" },
  },
  {
    id: "aot", title: "一番賞 進擊的巨人 ～最後的進擊～", series: "進撃の巨人",
    price: 360, total: 70, tone: "#4A5340",
    accent: "#C9CDBE", motif: "chevron", cover: "",
    pop: 11,
    note: "箱籤只有 70 張，上位賞相對集中。",
    prizes: [
      { g: "A", name: "利威爾兵長 MASTERLISE 約24cm", n: 1, v: 1420, k: "figure" },
      { g: "B", name: "艾連（進擊的巨人）MASTERLISE", n: 1, v: 1090, k: "figure" },
      { g: "C", name: "米卡莎 MASTERLISE", n: 1, v: 1000, k: "figure" },
      { g: "D", name: "調查兵團 Q版公仔 約6cm", n: 8, v: 270, k: "figure", variants: V.aotC.slice(0, 5) },
      { g: "E", name: "立體機動裝置 造型置物架", n: 2, v: 860, k: "figure" },
      { g: "F", name: "陶瓷馬克杯", n: 12, v: 220, k: "mug", variants: ["自由之翼", "薔薇之盾", "獨角獸", "獵犬"] },
      { g: "G", name: "提花毛巾", n: 14, v: 150, k: "towel", variants: V.aotC.slice(0, 6) },
      { g: "H", name: "壓克力吊飾", n: 15, v: 110, k: "charm", variants: V.aotC },
      { g: "I", name: "貼紙組", n: 16, v: 60, k: "sticker", variants: V.aotC.slice(0, 8) },
    ],
    last: { name: "利威爾兵長 最後賞Ver.", v: 2180, k: "figure" },
    wchance: { name: "利威爾兵長 特別彩色Ver.", v: 2760, k: "figure" },
  },
  {
    id: "uma", title: "一番賞 賽馬娘 Pretty Derby", series: "ウマ娘",
    price: 340, total: 74, tone: "#7A4A8C",
    accent: "#E8B8D8", motif: "stripe", cover: "",
    pop: 6,
    note: "小賞款式多，湊全套是這一檔最大的坑。",
    prizes: [
      { g: "A", name: "特別週 MASTERLISE 約22cm", n: 1, v: 1460, k: "figure" },
      { g: "B", name: "東海帝王 MASTERLISE", n: 1, v: 1120, k: "figure" },
      { g: "C", name: "無聲鈴鹿 MASTERLISE", n: 1, v: 1030, k: "figure" },
      { g: "D", name: "黃金船 MASTERLISE", n: 1, v: 930, k: "figure" },
      { g: "E", name: "Q版公仔 約7cm", n: 10, v: 270, k: "figure", variants: V.umaC.slice(0, 6) },
      { g: "F", name: "玻璃杯", n: 13, v: 240, k: "glass", variants: ["特雷森", "跑道", "獎盃", "頭花", "終點線"] },
      { g: "G", name: "勝負服毛巾", n: 15, v: 150, k: "towel", variants: V.umaC.slice(0, 8) },
      { g: "H", name: "壓克力吊飾", n: 16, v: 120, k: "charm", variants: V.umaC },
      { g: "I", name: "賽事視覺板", n: 16, v: 70, k: "board", variants: V.umaC.slice(0, 10) },
    ],
    last: { name: "特別週 最後賞Ver.", v: 2240, k: "figure" },
    wchance: { name: "三女神 特別套組", v: 2830, k: "figure" },
  },
  {
    id: "spy", title: "一番賞 間諜家家酒 ～佛傑家的日常～", series: "SPY×FAMILY",
    price: 320, total: 74, tone: "#5A5A72",
    accent: "#D8C8A8", motif: "check", cover: "",
    pop: 8,
    note: "D 賞邦德絨毛有 3 隻，中位賞相對厚。",
    prizes: [
      { g: "A", name: "安妮亞 MASTERLISE 約18cm", n: 1, v: 1350, k: "figure" },
      { g: "B", name: "約兒 MASTERLISE 約23cm", n: 1, v: 1040, k: "figure" },
      { g: "C", name: "洛伊德 MASTERLISE 約23cm", n: 1, v: 940, k: "figure" },
      { g: "D", name: "邦德 絨毛玩偶 約20cm", n: 3, v: 630, k: "plush" },
      { g: "E", name: "Q版公仔 約7cm", n: 10, v: 250, k: "figure", variants: V.spyC.slice(0, 5) },
      { g: "F", name: "馬克杯", n: 13, v: 210, k: "mug", variants: ["佛傑家", "伊甸學園", "花園", "黃昏", "荊棘公主"] },
      { g: "G", name: "壓克力吊飾", n: 15, v: 110, k: "charm", variants: V.spyC },
      { g: "H", name: "手帕", n: 15, v: 140, k: "towel", variants: V.spyC.slice(0, 8) },
      { g: "I", name: "貼紙", n: 15, v: 50, k: "sticker", variants: V.spyC },
    ],
    last: { name: "安妮亞 最後賞Ver.", v: 2070, k: "figure" },
    wchance: { name: "佛傑一家 特別套組", v: 2610, k: "figure" },
  },
  {
    id: "pkm", title: "一番賞 寶可夢 ～皮卡丘與夥伴們～", series: "ポケモン",
    price: 280, total: 80, tone: "#4A6B3A",
    accent: "#F2D84B", motif: "dots", cover: "",
    pop: 10,
    note: "全箱最便宜，但上位賞市價也最低，回本是另一種難。",
    prizes: [
      { g: "A", name: "皮卡丘 大型絨毛玩偶 約40cm", n: 1, v: 1280, k: "plush" },
      { g: "B", name: "伊布 絨毛玩偶 約25cm", n: 2, v: 600, k: "plush" },
      { g: "C", name: "卡比獸 抱枕 約30cm", n: 2, v: 600, k: "plush" },
      { g: "D", name: "寶貝球造型收納罐", n: 10, v: 220, k: "timer", variants: ["精靈球", "超級球", "高級球", "大師球"] },
      { g: "E", name: "陶瓷餐盤", n: 14, v: 170, k: "plate", variants: V.pkmC.slice(0, 6) },
      { g: "F", name: "玻璃杯", n: 16, v: 200, k: "glass", variants: V.pkmC.slice(0, 6) },
      { g: "G", name: "毛巾", n: 17, v: 140, k: "towel", variants: V.pkmC.slice(0, 10) },
      { g: "H", name: "橡膠吊飾", n: 18, v: 100, k: "charm", variants: V.pkmC },
    ],
    last: { name: "皮卡丘 特大絨毛玩偶 約60cm", v: 1960, k: "plush" },
    wchance: { name: "皮卡丘 金色特別Ver.", v: 2460, k: "plush" },
  },
];

const byId = Object.fromEntries(KUJI.map((k) => [k.id, k]));
const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";

/* ───────── 亂數與洗箱 ───────── */
function randInt(n) {
  if (n <= 1) return 0;
  const c = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto : null;
  if (!c) return Math.floor(Math.random() * n);
  const lim = Math.floor(0xffffffff / n) * n;
  const b = new Uint32Array(1); let x;
  do { c.getRandomValues(b); x = b[0]; } while (x >= lim);
  return x % n;
}

/** 洗一箱：所有賞別與款式攤平後 Fisher–Yates 洗牌，籤序當場定死 */
function newBox(set, no = 1) {
  const g = [], vi = [];
  for (const p of set.prizes) {
    const vs = p.variants;
    for (let i = 0; i < p.n; i++) { g.push(p.g); vi.push(vs ? i % vs.length : 0); }
  }
  for (let i = g.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [g[i], g[j]] = [g[j], g[i]];
    [vi[i], vi[j]] = [vi[j], vi[i]];
  }
  return { no, slots: g.join(""), vidx: vi.map((x) => B36[x]).join("") };
}

const leftOf = (box) => { let n = 0; for (const c of box.slots) if (c !== "_") n++; return n; };

function remainByGrade(box) {
  const m = {};
  for (const c of box.slots) if (c !== "_") m[c] = (m[c] || 0) + 1;
  return m;
}

/** 同一箱取「已抽走」的聯集，不同箱取較新的 —— 避免同時抽的人互相蓋掉 */
function mergeBox(a, b) {
  if (!a) return b; if (!b) return a;
  if (a.no !== b.no) return a.no > b.no ? a : b;
  if (a.slots.length !== b.slots.length) return a;
  let s = "";
  for (let i = 0; i < a.slots.length; i++) s += a.slots[i] === "_" || b.slots[i] === "_" ? "_" : a.slots[i];
  return { ...a, slots: s };
}

function expectedValue(set, box) {
  const left = leftOf(box); if (!left) return 0;
  const rem = remainByGrade(box);
  let ev = 0;
  for (const p of set.prizes) ev += ((rem[p.g] || 0) / left) * p.v;
  return ev + (1 / left) * set.last.v;
}

/** 讀箱：行家進店前會看的幾個數字。
 *  濃度 = 上位賞殘存率 ÷ 籤殘存率。大於 1 表示大賞還在、籤卻被抽掉不少，
 *  也就是俗稱的「濃箱」；小於 1 則是大賞先被拔走的「稀箱」。 */
function readBox(set, box) {
  const rem = remainByGrade(box);
  const left = leftOf(box);
  const tops = set.prizes.filter((p) => tierOf(p.g) >= 2);
  const topLeft = tops.reduce((a, p) => a + (rem[p.g] || 0), 0);
  const topTotal = tops.reduce((a, p) => a + p.n, 0);
  const density = left && topTotal ? (topLeft / topTotal) / (left / set.total) : 0;
  const ev = expectedValue(set, box);
  return {
    left, topLeft, topTotal, density, ev,
    evPct: Math.round((ev / set.price) * 100),
    perTop: topLeft ? Math.round(left / topLeft) : 0,
    grades: tops.map((p) => ({ g: p.g, left: rem[p.g] || 0, n: p.n })),
    tag: !topLeft ? "上位賞清空" : density >= 1.15 ? "濃箱" : density <= 0.85 ? "稀箱" : "普通",
  };
}

const TIER = { A: 3, B: 2, C: 2, D: 1, E: 1, LAST: 3, W: 3 };
const tierOf = (g) => TIER[g] || 0;
const fmt = (n) => Math.round(n).toLocaleString("zh-TW");
const gLabel = (g) => (g === "LAST" ? "最" : g);

/* ───────── 音效：即時合成，無外部音檔 ───────── */
const Sfx = {
  ctx: null, muted: false,
  ac() {
    if (this.muted) return null;
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    } catch (e) { return null; }
  },
  noise(dur, f0, f1, gain = 0.22) {
    const c = this.ac(); if (!c) return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q = 1.1;
    bp.frequency.setValueAtTime(f0, c.currentTime);
    bp.frequency.exponentialRampToValueAtTime(f1, c.currentTime + dur);
    const g = c.createGain(); g.gain.value = gain;
    src.connect(bp); bp.connect(g); g.connect(c.destination); src.start();
  },
  tone(freq, dur, type = "sine", gain = 0.2, slide) {
    const c = this.ac(); if (!c) return;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  },
  tear() { this.noise(0.17, 2600, 700, 0.2); },
  tick() { this.tone(1400, 0.04, "square", 0.05); },
  stamp() { this.noise(0.05, 900, 200, 0.25); this.tone(120, 0.16, "sine", 0.28, 60); },
  bell() { [1318, 1975, 2637].forEach((f, i) => setTimeout(() => this.tone(f, 1.4 - i * 0.2, "sine", 0.13), i * 55)); },
  drum() { this.tone(78, 0.5, "sine", 0.4, 42); this.noise(0.09, 400, 90, 0.18); },
  openBox() { this.noise(0.4, 300, 1600, 0.14); setTimeout(() => this.drum(), 180); },
};
const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

/* ═════════════════════ 主體 ═════════════════════ */
export default function App() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("shop");
  const [activeId, setActiveId] = useState(null);
  const [me, setMe] = useState({
    name: "客人 " + Math.random().toString(16).slice(2, 5).toUpperCase(),
    money: START_MONEY, bag: {}, log: [],
    stats: { draws: 0, spent: 0, opened: 0, wTickets: 0, wTries: 0, wWins: 0 },
    mode: "shared", sound: true,
  });
  const [hall, setHall] = useState({ boxes: {}, feed: [], stats: {} });
  const [selMap, setSelMap] = useState({});
  const [batch, setBatch] = useState(null);
  const [toast, setToast] = useState(null);
  const [panel, setPanel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  const [justPicked, setJustPicked] = useState([]);
  const meRef = useRef(me); meRef.current = me;
  const hallRef = useRef(hall); hallRef.current = hall;
  const skipSave = useRef(true);

  const shared = me.mode === "shared";
  Sfx.muted = !me.sound;

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(null), 2200); }, []);

  const readHall = useCallback(async (isShared) => {
    try {
      const r = await window.storage.get(HALL_KEY, isShared);
      return r && r.value ? JSON.parse(r.value) : null;
    } catch (e) { return null; }
  }, []);
  const writeHall = useCallback(async (h, isShared) => {
    try { await window.storage.set(HALL_KEY, JSON.stringify(h), isShared); return true; }
    catch (e) { return false; }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(ME_KEY, false);
        if (r && r.value) setMe((m) => ({ ...m, ...JSON.parse(r.value) }));
      } catch (e) { /* 首次遊玩 */ }
      setReady(true);
    })();
  }, []);

  const refresh = useCallback(async () => {
    const remote = await readHall(meRef.current.mode === "shared");
    setHall((cur) => {
      const boxes = { ...cur.boxes };
      if (remote && remote.boxes) {
        for (const id of Object.keys(remote.boxes)) boxes[id] = mergeBox(boxes[id], remote.boxes[id]);
      }
      const seen = new Set(); const feed = [];
      for (const f of [...((remote && remote.feed) || []), ...cur.feed].sort((a, b) => b.t - a.t)) {
        if (!seen.has(f.i)) { seen.add(f.i); feed.push(f); }
      }
      const stats = mergeStats(cur.stats, (remote && remote.stats) || {});
      return { boxes, feed: feed.slice(0, 40), stats };
    });
  }, [readHall]);

  useEffect(() => { if (ready) refresh(); }, [ready, me.mode, refresh]);

  useEffect(() => {
    if (!ready || !shared || (view !== "shop" && view !== "set")) return;
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [ready, shared, view, refresh]);

  useEffect(() => {
    if (!ready) return;
    if (skipSave.current) { skipSave.current = false; return; }
    const t = setTimeout(() => {
      window.storage.set(ME_KEY, JSON.stringify({ ...me, log: me.log.slice(-400) }), false).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [ready, me]);

  const set = activeId ? byId[activeId] : null;
  const box = set ? hall.boxes[set.id] || null : null;

  // 進到某一檔時，先跟伺服器要這一箱；沒有才洗一副新的並立刻寫回去，
  // 讓所有人拿到同一副籤序。（本機各自洗會導致籤序不一致，共抽等於沒共抽）
  useEffect(() => {
    if (!set || hall.boxes[set.id]) return;
    let cancelled = false;
    (async () => {
      const remote = await readHall(shared);
      if (cancelled) return;
      const rb = remote && remote.boxes && remote.boxes[set.id];
      const b = rb || newBox(set, 1);
      setHall((c) => (c.boxes[set.id] ? c : { ...c, boxes: { ...c.boxes, [set.id]: b } }));
      if (!rb) {
        writeHall({
          boxes: { ...((remote && remote.boxes) || {}), [set.id]: b },
          feed: (remote && remote.feed) || [],
          stats: (remote && remote.stats) || {},
        }, shared);
      }
    })();
    return () => { cancelled = true; };
  }, [set, hall.boxes, shared, readHall, writeHall]);
  const sel = activeId ? selMap[activeId] || [] : [];
  const putSel = useCallback((id, fn) => setSelMap((m) => ({ ...m, [id]: fn(m[id] || []) })), []);
  const bagValue = useMemo(() => Object.values(me.bag).reduce((a, i) => a + i.v * i.n, 0), [me.bag]);
  const bagCount = useMemo(() => Object.values(me.bag).reduce((a, i) => a + i.n, 0), [me.bag]);

  async function draw(indices) {
    if (busy || !indices.length || !set) return;
    const cost = set.price * indices.length;
    if (me.money < cost) { say(`資金不足，還差 NT$${fmt(cost - me.money)}`); return; }
    setBusy(true);

    const remote = shared ? await readHall(true) : null;
    let b = mergeBox(hall.boxes[set.id], remote && remote.boxes && remote.boxes[set.id]) || newBox(set, 1);

    const clash = indices.filter((i) => b.slots[i] === "_");
    if (clash.length) {
      setHall((c) => ({ ...c, boxes: { ...c.boxes, [set.id]: b } }));
      putSel(set.id, () => []); setBusy(false);
      say(`第 ${clash.map((i) => i + 1).join("、")} 號已經被別人撕走了`);
      return;
    }

    const items = [];
    let slots = b.slots.split("");
    let vidx = b.vidx;
    let curNo = b.no;
    let opened = 0;

    for (const i of indices) {
      const g = slots[i];
      const p = set.prizes.find((x) => x.g === g);
      const vn = p.variants ? p.variants[B36.indexOf(vidx[i])] : null;
      slots[i] = "_";
      items.push({ g, name: p.name, v: p.v, k: p.k, variant: vn, slot: i + 1, boxNo: curNo, open: false });

      if (!slots.some((c) => c !== "_")) {
        items.push({ g: "LAST", name: set.last.name, v: set.last.v, k: set.last.k, variant: null, slot: null, boxNo: curNo, open: false, isLast: true });
        const nb = newBox(set, curNo + 1);
        slots = nb.slots.split(""); vidx = nb.vidx; curNo = nb.no; opened++;
      }
    }

    const nextBox = { no: curNo, slots: slots.join(""), vidx };
    const stamp = Date.now();
    const feedAdd = items
      .filter((it) => tierOf(it.g) >= 2)
      .map((it, k) => ({ i: `${stamp}-${k}-${Math.random().toString(36).slice(2, 6)}`, t: stamp, u: me.name, s: set.id, g: it.g, n: it.name }));

    // 熱度：先把舊值依時間衰退，再加上這次的抽數
    const baseStats = mergeStats(hall.stats, (remote && remote.stats) || {});
    const prev = baseStats[set.id];
    const nextStats = {
      ...baseStats,
      [set.id]: {
        n: (prev && prev.n ? prev.n : 0) + indices.length,
        d: heatOf(prev, stamp) + indices.length,
        t: stamp,
      },
    };

    const nextHall = {
      boxes: { ...((remote && remote.boxes) || {}), ...hall.boxes, [set.id]: nextBox },
      feed: [...feedAdd, ...((remote && remote.feed) || hall.feed)].slice(0, 40),
      stats: nextStats,
    };
    setHall(nextHall);
    await writeHall(nextHall, shared);

    setMe((m) => ({
      ...m, money: m.money - cost,
      stats: {
        ...m.stats, draws: m.stats.draws + indices.length, spent: m.stats.spent + cost,
        opened: m.stats.opened + opened, wTickets: m.stats.wTickets + indices.length,
      },
    }));
    putSel(set.id, () => []);
    setBatch({ setId: set.id, items, cost, i: 0 });
    setView("reveal");
    setBusy(false);
    Sfx.tick();
  }

  /** 隨手抓：在目前選擇之外「再」隨機抓 n 張，已選的不動。
   *  抓到的格子會閃一下，因為它們多半落在畫面看不到的地方。 */
  function grab(n) {
    const cur = sel;
    const pool = [];
    for (let i = 0; i < box.slots.length; i++) if (box.slots[i] !== "_" && !cur.includes(i)) pool.push(i);
    const room = 10 - cur.length;
    if (room <= 0) { say("一次最多 10 張，先撕開或清除再抓"); return; }
    if (!pool.length) { say("箱裡沒有可抓的籤了"); return; }
    const take = Math.min(n, room, pool.length);
    const got = [];
    for (let i = 0; i < take; i++) got.push(pool.splice(randInt(pool.length), 1)[0]);
    putSel(activeId, () => cur.concat(got).sort((a, b) => a - b));
    setJustPicked(got);
    setTimeout(() => setJustPicked([]), 1100);
    Sfx.tick(); buzz(12);
    if (take < n) say(take ? `只抓得到 ${take} 張（上限或存量不足）` : "抓不到了");
    else if (me.money < set.price * (cur.length + take)) say("選是選了，但資金不夠撕開這麼多張");
  }

  function toggle(i) {
    putSel(activeId, (s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length >= 10 ? s : [...s, i]));
    Sfx.tick(); buzz(8);
  }

  function clearSel() { putSel(activeId, () => []); Sfx.tick(); }

  function openTicket(idx) {
    const it = batch.items[idx];
    if (!it || it.open) return;
    Sfx.tear(); buzz(14);
    setBatch((p) => { const its = p.items.slice(); its[idx] = { ...its[idx], open: true }; return { ...p, items: its }; });
    const t = tierOf(it.g);
    setTimeout(() => {
      Sfx.stamp(); buzz(t >= 3 ? [24, 40, 60] : t >= 2 ? 22 : 10);
      if (t >= 2) {
        setFlash({ g: it.g, name: it.name, isLast: it.isLast });
        if (t >= 3) Sfx.bell(); else Sfx.drum();
        setTimeout(() => setFlash(null), t >= 3 ? 2100 : 1300);
      }
      if (it.isLast) setTimeout(() => Sfx.openBox(), 1700);
    }, 330);
  }

  function collect() {
    const s = byId[batch.setId];
    setMe((m) => {
      const bag = { ...m.bag };
      for (const it of batch.items) {
        const key = `${batch.setId}|${it.g}|${it.variant || "-"}`;
        bag[key] = bag[key]
          ? { ...bag[key], n: bag[key].n + 1 }
          : { setId: batch.setId, g: it.g, name: it.name, k: it.k, variant: it.variant, v: it.v, n: 1 };
      }
      const log = [...m.log, ...batch.items.map((it) => ({
        t: Date.now(), s: s.title, g: it.g, v: it.v,
        name: it.variant ? `${it.name}／${it.variant}` : it.name,
      }))];
      return { ...m, bag, log };
    });
    setBatch(null); setView("set");
  }

  function tryW() {
    if (me.stats.wTickets < W_COST || !activeId) return;
    const hit = randInt(10000) < W_RATE * 10000;
    const s = byId[activeId];
    setMe((m) => ({ ...m, stats: { ...m.stats, wTickets: m.stats.wTickets - W_COST, wTries: m.stats.wTries + 1, wWins: m.stats.wWins + (hit ? 1 : 0) } }));
    if (hit) {
      setBatch({ setId: activeId, cost: 0, i: 0, items: [{ g: "W", name: s.wchance.name, v: s.wchance.v, k: s.wchance.k, variant: null, slot: null, boxNo: -1, open: false }] });
      setView("reveal");
    } else { say("銘謝惠顧 — 券已扣除"); Sfx.tone(220, 0.3, "sine", 0.12, 160); }
  }

  async function resetAll(alsoHall) {
    setMe((m) => ({ ...m, money: START_MONEY, bag: {}, log: [], stats: { draws: 0, spent: 0, opened: 0, wTickets: 0, wTries: 0, wWins: 0 } }));
    if (alsoHall) {
      setHall({ boxes: {}, feed: [], stats: {} });
      await writeHall({ boxes: {}, feed: [], stats: {} }, shared);
    }
    setPanel(null); setActiveId(null); setView("shop");
  }

  if (!ready) return <div className="wrap"><Style /><div className="boot">整理籤箱中…</div></div>;

  return (
    <div className="wrap">
      <Style />
      <header className="top">
        <button className="brand" onClick={() => { setActiveId(null); setView("shop"); }}>
          <span className="mk">籤</span>
          <span>
            <span className="bn">賞券所</span>
            <span className="bs">
              {shared ? (typeof window !== "undefined" && window.__syncMode === "local"
                ? "共抽 · 本機（未連後端）" : "共抽 · 雲端同步") : "單人練習"}
            </span>
          </span>
        </button>
        <div className="topr">
          <div className="purse">
            <span className="pl">手頭資金</span>
            <span className="pv">NT${fmt(me.money)}</span>
          </div>
          <button className="gear" onClick={() => setPanel("cfg")} aria-label="設定">⚙</button>
        </div>
      </header>

      <main>
        {view === "shop" && (
          <Shop hall={hall} shared={shared}
            onPick={(id) => { setActiveId(id); setView("set"); refresh(); }} />
        )}
        {view === "set" && set && box && (
          <SetView set={set} box={box} sel={sel} money={me.money} wTickets={me.stats.wTickets}
            feed={hall.feed.filter((f) => f.s === set.id)} shared={shared} busy={busy}
            onToggle={toggle} onGrab={grab} onDraw={draw} onW={tryW} onClear={clearSel}
            justPicked={justPicked}
            onBack={() => { setActiveId(null); setView("shop"); }} onRefresh={refresh} />
        )}
        {view === "reveal" && batch && (
          <Reveal batch={batch} set={byId[batch.setId]} onOpen={openTicket}
            onNext={() => setBatch((p) => ({ ...p, i: p.i + 1 }))}
            onAll={() => { setBatch((p) => ({ ...p, i: p.items.length, items: p.items.map((x) => ({ ...x, open: true })) })); Sfx.tear(); }}
            onCollect={collect} />
        )}
        {view === "bag" && <Bag bag={me.bag} value={bagValue} count={bagCount} />}
        {view === "stats" && <Stats me={me} bagValue={bagValue} onPanel={() => setPanel("cfg")} />}
      </main>

      {view !== "reveal" && (
        <nav className="nav">
          {[["shop", "抽選所"], ["bag", bagCount ? `背包 ${bagCount}` : "背包"], ["stats", "收支"]].map(([v, l]) => (
            <button key={v} className={`nb ${view === v || (v === "shop" && view === "set") ? "on" : ""}`}
              onClick={() => setView(v)}>{l}</button>
          ))}
        </nav>
      )}

      {flash && <Flash g={flash.g} name={flash.name} isLast={flash.isLast} />}
      {toast && <div className="toast">{toast}</div>}
      {panel === "cfg" && <Config me={me} setMe={setMe} onClose={() => setPanel(null)} onReset={resetAll} />}
    </div>
  );
}


/* ───────── 台紙：原創的賞品封面板 ─────────
   一番賞店頭的台紙結構其實很固定：放射光芒＋大字系列名＋賞別階梯＋朱印。
   這裡照那個結構重畫一版原創的，不使用任何官方主視覺或角色圖。
   set.cover 填入自有授權圖網址即可整張取代。 */
const MOTIF = {
  petal: (id, c) => (
    <pattern id={id} width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
      <path d="M17 5c5 5 5 12 0 17-5-5-5-12 0-17z" fill={c} opacity=".5" />
    </pattern>),
  dots: (id, c) => (
    <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="6" cy="6" r="3.2" fill={c} opacity=".55" />
      <circle cx="17" cy="17" r="2" fill={c} opacity=".35" />
    </pattern>),
  swirl: (id, c) => (
    <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M20 6a14 14 0 1 1-13 19" fill="none" stroke={c} strokeWidth="3" opacity=".45" />
    </pattern>),
  wave: (id, c) => (
    <pattern id={id} width="44" height="22" patternUnits="userSpaceOnUse">
      <path d="M0 16q11-13 22 0t22 0" fill="none" stroke={c} strokeWidth="2.6" opacity=".45" />
    </pattern>),
  star: (id, c) => (
    <pattern id={id} width="34" height="34" patternUnits="userSpaceOnUse">
      <path d="M17 5l3.4 7.6L28 14l-5.6 5.2L24 27l-7-4-7 4 1.6-7.8L6 14l7.6-1.4z" fill={c} opacity=".45" />
    </pattern>),
  grid: (id, c) => (
    <pattern id={id} width="26" height="26" patternUnits="userSpaceOnUse">
      <path d="M0 0h26M0 0v26" stroke={c} strokeWidth="2" opacity=".4" />
    </pattern>),
  chevron: (id, c) => (
    <pattern id={id} width="30" height="18" patternUnits="userSpaceOnUse">
      <path d="M0 15L15 3l15 12" fill="none" stroke={c} strokeWidth="3" opacity=".4" />
    </pattern>),
  stripe: (id, c) => (
    <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
      <rect width="9" height="24" fill={c} opacity=".38" />
    </pattern>),
  check: (id, c) => (
    <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse">
      <rect width="14" height="14" fill={c} opacity=".4" />
      <rect x="14" y="14" width="14" height="14" fill={c} opacity=".4" />
    </pattern>),
};

function Cover({ set, boxNo, h = 128, big }) {
  if (set.cover) return <img className="cover-img" src={set.cover} alt="" style={{ height: h }} />;
  const acc = set.accent || "#F0D9A8";
  const pid = "m-" + set.id, gid = "g-" + set.id;
  const cx = 118, cy = 118;
  const rays = [];
  for (let i = 0; i < 22; i++) {
    const a0 = (i * 2 * Math.PI) / 22, a1 = a0 + Math.PI / 34;
    rays.push(
      <polygon key={i} opacity={i % 2 ? 0.16 : 0.28} fill={acc}
        points={`${cx},${cy} ${cx + Math.cos(a0) * 460},${cy + Math.sin(a0) * 460} ${cx + Math.cos(a1) * 460},${cy + Math.sin(a1) * 460}`} />
    );
  }
  const grades = set.prizes.map((p) => p.g).concat(["最"]);
  return (
    <svg className="cover" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice"
      style={{ height: h }} aria-hidden="true">
      <defs>
        {MOTIF[set.motif] ? MOTIF[set.motif](pid, acc) : MOTIF.dots(pid, acc)}
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={set.tone} />
          <stop offset="1" stopColor="#15181D" stopOpacity=".55" />
        </linearGradient>
        <clipPath id={"c-" + set.id}><rect width="400" height="200" /></clipPath>
      </defs>
      <g clipPath={`url(#c-${set.id})`}>
        <rect width="400" height="200" fill={set.tone} />
        <rect width="400" height="200" fill={`url(#${pid})`} opacity=".5" />
        <g>{rays}</g>
        <rect width="400" height="200" fill={`url(#${gid})`} opacity=".45" />

        {/* 系列名：橫向大字＋直排「一番賞」書腰 */}
        <text x="26" y="86" fill="#fff" opacity=".96" fontSize={big ? 34 : 30}
          fontFamily="Georgia, serif" fontWeight="700" letterSpacing="1">
          {set.series}
        </text>
        <rect x="24" y="98" width={big ? 150 : 132} height="3" fill="#fff" opacity=".8" />
        <text x="26" y="128" fill="#fff" opacity=".82" fontSize="14"
          fontFamily="serif" letterSpacing="6">一番賞</text>

        {/* 朱印 */}
        <g transform="translate(338,44) rotate(-11)">
          <circle r="30" fill="none" stroke="#C8342A" strokeWidth="3" opacity=".95" />
          <circle r="30" fill="#C8342A" opacity=".16" />
          <text y="-4" textAnchor="middle" fill="#fff" fontSize="15" fontFamily="serif" letterSpacing="1">一番</text>
          <text y="15" textAnchor="middle" fill="#fff" fontSize="15" fontFamily="serif" letterSpacing="1">賞</text>
        </g>

        {/* 賞別階梯 */}
        <rect y="164" width="400" height="36" fill="#15181D" opacity=".55" />
        {grades.slice(0, 11).map((g, i) => (
          <g key={i} transform={`translate(${22 + i * 33},182)`}>
            <rect x="-11" y="-12" width="22" height="24" rx="2"
              fill={i === 0 || g === "最" ? "#C8342A" : "#fff"} opacity={i === 0 || g === "最" ? ".9" : ".16"} />
            <text textAnchor="middle" y="5" fontSize="12" fontFamily="serif"
              fill="#fff" opacity={i === 0 || g === "最" ? "1" : ".8"}>{g}</text>
          </g>
        ))}
        {boxNo != null && (
          <text x="378" y="150" textAnchor="end" fill="#fff" opacity=".7" fontSize="12"
            fontFamily="ui-monospace, monospace">第 {boxNo} 箱</text>
        )}
      </g>
    </svg>
  );
}

/* ───────── 原創賞品圖版 ───────── */
function Plate({ k, tone = "#6E6A5E", g, img, size = 88 }) {
  if (img) return <img className="plate-img" src={img} alt="" style={{ width: size, height: size }} />;
  const shapes = {
    figure: <><ellipse cx="50" cy="86" rx="26" ry="6" opacity=".2" /><rect x="30" y="78" width="40" height="8" rx="2" opacity=".5" /><path d="M50 20c8 0 12 6 12 13 0 5-3 8-3 8l9 10-4 27H36l-4-27 9-10s-3-3-3-8c0-7 4-13 12-13z" /><circle cx="50" cy="26" r="9" opacity=".85" /></>,
    plush: <><ellipse cx="50" cy="88" rx="24" ry="5" opacity=".2" /><circle cx="34" cy="34" r="11" opacity=".8" /><circle cx="66" cy="34" r="11" opacity=".8" /><ellipse cx="50" cy="56" rx="30" ry="28" /><circle cx="41" cy="52" r="3.5" fill="#fff" opacity=".9" /><circle cx="59" cy="52" r="3.5" fill="#fff" opacity=".9" /><path d="M44 64q6 5 12 0" stroke="#fff" strokeWidth="2.5" fill="none" opacity=".9" strokeLinecap="round" /></>,
    glass: <><path d="M34 20h32l-4 62a6 6 0 0 1-6 6H44a6 6 0 0 1-6-6z" opacity=".35" /><path d="M37 48h26l-3 34a5 5 0 0 1-5 5H45a5 5 0 0 1-5-5z" /><rect x="32" y="16" width="36" height="5" rx="2.5" /></>,
    mug: <><rect x="26" y="28" width="38" height="50" rx="5" /><path d="M64 40h8a10 10 0 0 1 0 20h-8" fill="none" stroke="currentColor" strokeWidth="6" /><rect x="30" y="36" width="30" height="4" rx="2" fill="#fff" opacity=".5" /></>,
    plate: <><ellipse cx="50" cy="56" rx="36" ry="26" opacity=".35" /><ellipse cx="50" cy="54" rx="27" ry="19" /><ellipse cx="50" cy="52" rx="15" ry="10" fill="#fff" opacity=".45" /></>,
    towel: <><rect x="22" y="26" width="56" height="48" rx="3" /><rect x="22" y="40" width="56" height="7" fill="#fff" opacity=".45" /><rect x="22" y="55" width="56" height="4" fill="#fff" opacity=".3" /><path d="M22 74h56v4H22z" opacity=".5" /></>,
    charm: <><circle cx="50" cy="20" r="7" fill="none" stroke="currentColor" strokeWidth="3.5" /><path d="M50 27v9" stroke="currentColor" strokeWidth="3" /><rect x="30" y="36" width="40" height="44" rx="8" /><circle cx="50" cy="56" r="12" fill="#fff" opacity=".45" /></>,
    sticker: <><rect x="20" y="30" width="34" height="34" rx="6" transform="rotate(-8 37 47)" opacity=".55" /><circle cx="62" cy="44" r="17" opacity=".8" /><rect x="40" y="56" width="30" height="26" rx="6" transform="rotate(6 55 69)" /></>,
    board: <><rect x="22" y="18" width="56" height="66" rx="2" /><rect x="29" y="25" width="42" height="42" fill="#fff" opacity=".45" /><rect x="29" y="72" width="24" height="5" fill="#fff" opacity=".35" /></>,
    file: <><path d="M24 22h30l6 8h18v52H24z" /><rect x="32" y="42" width="38" height="4" fill="#fff" opacity=".45" /><rect x="32" y="52" width="28" height="4" fill="#fff" opacity=".3" /></>,
    bag: <><path d="M28 34h44l6 48H22z" /><path d="M40 34V26a10 10 0 0 1 20 0v8" fill="none" stroke="currentColor" strokeWidth="4" /><circle cx="50" cy="58" r="11" fill="#fff" opacity=".4" /></>,
    timer: <><circle cx="50" cy="56" r="30" /><circle cx="50" cy="56" r="21" fill="#fff" opacity=".5" /><path d="M50 40v16l11 7" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" /><rect x="42" y="18" width="16" height="8" rx="3" /></>,
  };
  return (
    <svg className="plate" viewBox="0 0 100 100" style={{ width: size, height: size }} aria-hidden="true">
      <rect width="100" height="100" fill={tone} opacity=".07" />
      <text x="92" y="94" textAnchor="end" fontSize="24" fill={tone} opacity=".13" fontFamily="serif">{gLabel(g)}</text>
      <g fill={tone} color={tone}>{shapes[k] || shapes.board}</g>
    </svg>
  );
}

/* ───────── 抽選所 ───────── */
const SORTS = [["hot", "熱門"], ["cheap", "單抽便宜"], ["left", "快開新箱"]];

function Shop({ hall, shared, onPick }) {
  const [sort, setSort] = useState("hot");

  // 熱門度直接用大家實際抽的次數排。沒人抽過的時候（剛上線、剛重置）
  // 才退回內建的 pop 名次當起始順序，不然畫面會是無意義的原始排列。
  const rows = useMemo(() => {
    const now = Date.now();
    const r = KUJI.map((k) => ({
      k,
      left: leftOf(hall.boxes[k.id] || newBox(k, 1)),
      heat: heatOf(hall.stats && hall.stats[k.id], now),
      draws: (hall.stats && hall.stats[k.id] && hall.stats[k.id].n) || 0,
    }));
    if (sort === "cheap") r.sort((x, y) => x.k.price - y.k.price || y.heat - x.heat);
    else if (sort === "left") r.sort((x, y) => x.left - y.left || y.heat - x.heat);
    else r.sort((x, y) => y.heat - x.heat || x.k.pop - y.k.pop);
    return r;
  }, [sort, hall.boxes, hall.stats]);

  const anyDraws = rows.some((r) => r.draws > 0);

  return (
    <div className="pad">
      <p className="lede">
        每一檔都是一個洗好的實體箱。籤序在開箱那一刻就定了，你撕哪一號，
        裡面是什麼就是什麼。{shared && <b>目前是共抽——所有人在同一箱裡撕籤。</b>}
      </p>
      <div className="sortbar">
        {SORTS.map(([v, l]) => (
          <button key={v} className={`sortb ${sort === v ? "on" : ""}`} onClick={() => setSort(v)}>{l}</button>
        ))}
      </div>
      <div className="shelf">
        {rows.map(({ k, draws }, idx) => {
          const b = hall.boxes[k.id] || newBox(k, 1);
          const rb = readBox(k, b);
          const left = rb.left;
          return (
            <button key={k.id} className="card" onClick={() => onPick(k.id)}>
              <div className="cwrap">
                <Cover set={k} boxNo={b.no} h={128} />
                {sort === "hot" && idx < 3 && anyDraws && <span className="rank">熱門 {idx + 1}</span>}
                <span className="ctag">NT${k.price}<i>／抽</i></span>
              </div>
              <div className="cbody">
                <div className="cmain">
                  <h3 className="ct">{k.title}</h3>
                  <p className="cn">{k.note}</p>
                  <div className="cm">
                    <span className="mono dim">剩 {left}／{k.total} 籤</span>
                    <span className="mono dim">{draws ? `累計 ${fmt(draws)} 抽` : "尚無人開抽"}</span>
                  </div>
                  <div className="gauge"><div className="gf" style={{ width: `${(left / k.total) * 100}%`, background: k.tone }} /></div>
                  <div className="read">
                    <div className="rdots">
                      {rb.grades.map((x) => (
                        <span key={x.g} className={`rdot ${x.left ? "" : "out"}`}
                          style={x.left ? { background: k.tone, borderColor: k.tone } : undefined}>
                          {x.g}{x.n > 1 && <i>{x.left}</i>}
                        </span>
                      ))}
                      <span className={`rtag ${rb.tag === "濃箱" ? "good" : rb.tag === "普通" ? "" : "bad"}`}>
                        {rb.tag}
                      </span>
                    </div>
                    <div className="rnums mono">
                      <span>{rb.perTop ? `每 ${rb.perTop} 張出 1 支上位賞` : "上位賞出光"}</span>
                      <span className={rb.evPct >= 100 ? "up" : ""}>期望值 {rb.evPct}% 票價</span>
                      <span>再 {left} 張見箱底</span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="fine">
        「濃箱」是上位賞還在、籤卻已被抽掉不少的箱；「稀箱」相反，大賞先被拔走了。期望值超過 100% 代表這一箱此刻的平均回收高於票價，實務上很少見。熱門度是所有人實際抽的次數，三天沒人抽會衰退一半。
        賞項與配率依 BANDAI SPIRITS 一番賞公開情報及台灣代理通路還原，參考價為全新未拆的市場行情概估。
        賞品圖為本站原創向量圖版，非官方商品照。本模擬不具任何兌換效力。
      </p>
    </div>
  );
}

/* ───────── 賞台 ───────── */
function SetView({ set, box, sel, money, wTickets, feed, shared, busy, onToggle, onGrab, onDraw, onW, onBack, onRefresh, onClear, justPicked = [] }) {
  const [tab, setTab] = useState("board");
  const left = leftOf(box);
  const rem = remainByGrade(box);
  const ev = expectedValue(set, box);
  const cost = set.price * sel.length;

  return (
    <div className="sv">
      <div className="head">
        <Cover set={set} h={200} big />
        <div className="hveil" />
        <button className="back" onClick={onBack}>← 換一檔</button>
        <h2 className="ht">{set.title}</h2>
        <div className="hm mono">
          <span>NT${set.price}／抽</span><i>·</i><span>第 {box.no} 箱</span><i>·</i>
          <span>剩 {left}／{set.total}</span>
          {shared && <button className="sync" onClick={onRefresh}>↻ 更新</button>}
        </div>
      </div>

      <div className="tabs">
        {[["board", "籤台"], ["ladder", "箱況"], ["feed", "出賞速報"]].map(([v, l]) => (
          <button key={v} className={`tab ${tab === v ? "on" : ""}`} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>

      {tab === "board" && (
        <div className="pad">
          <p className="hint">點籤位挑籤，最多 10 張。{shared && "凹下去的格子是別人已經撕走的。"}</p>
          <div className="board">
            {box.slots.split("").map((c, i) => {
              const gone = c === "_"; const on = sel.includes(i);
              return (
                <button key={i} className={`slot ${gone ? "gone" : ""} ${on ? "on" : ""} ${justPicked.includes(i) ? "just" : ""}`}
                  disabled={gone} onClick={() => onToggle(i)}
                  style={on ? { background: set.tone, borderColor: set.tone } : undefined}>
                  {gone ? "" : String(i + 1).padStart(2, "0")}
                </button>
              );
            })}
          </div>
          <div className="grabs">
            <span className="glabel">閉著眼睛抓</span>
            {[1, 5, 10].map((n) => (
              <button key={n} className="gbtn" disabled={!left || sel.length >= 10}
                onClick={() => onGrab(n)}>再抓 {n} 張</button>
            ))}
          </div>
          <p className="hint gnote">抓到的籤會在上面閃一下。已經選好的不會被蓋掉，想重來按右下角的「清除重選」。</p>
        </div>
      )}

      {tab === "ladder" && (
        <div className="pad">
          <div className="ev">
            <div>
              <div className="evl">此刻單抽期望值</div>
              <div className="evv mono" style={{ color: ev >= set.price ? "#2F6B4F" : "#C8342A" }}>NT${fmt(ev)}</div>
            </div>
            <div className="evr">
              <div className="evl">相對票價</div>
              <div className="evp mono">{Math.round((ev / set.price) * 100)}%</div>
            </div>
          </div>
          <p className="hint">上位賞被撕走後，這個數字會直線往下掉。老手講的「讀箱」就是在讀它。</p>
          <ul className="ladder">
            {set.prizes.map((p) => {
              const r = rem[p.g] || 0;
              return (
                <li key={p.g} className={`row ${r ? "" : "out"}`}>
                  <Plate k={p.k} tone={set.tone} g={p.g} size={40} />
                  <span className={`seal t${tierOf(p.g)}`}>{p.g}</span>
                  <span className="rn">{p.name}{p.variants && <em>全 {p.variants.length} 款</em>}</span>
                  <span className="rc mono">{r}／{p.n}</span>
                  <span className="rp mono">{r ? `${((r / left) * 100).toFixed(1)}%` : "完售"}</span>
                </li>
              );
            })}
            <li className="row lastrow">
              <Plate k={set.last.k} tone={set.tone} g="最" size={40} />
              <span className="seal t3">最</span>
              <span className="rn">{set.last.name}</span>
              <span className="rc mono">1／1</span>
              <span className="rp mono">{(100 / left).toFixed(1)}%</span>
            </li>
          </ul>
          <div className="wbox">
            <div>
              <div className="wt">雙重中獎賞</div>
              <div className="ws">{set.wchance.name}</div>
              <div className="wm mono">抽選券 {wTickets}／{W_COST}　命中率 {W_RATE * 100}%</div>
            </div>
            <button className="wb" disabled={wTickets < W_COST} onClick={onW}>兌換抽選</button>
          </div>
        </div>
      )}

      {tab === "feed" && (
        <div className="pad">
          {!feed.length ? (
            <div className="empty">這一箱還沒有人撕出上位賞。</div>
          ) : (
            <ul className="feed">
              {feed.map((f) => (
                <li key={f.i} className={`fr t${tierOf(f.g)}`}>
                  <span className={`seal t${tierOf(f.g)}`}>{gLabel(f.g)}</span>
                  <span className="fn"><b>{f.u}</b> 抽中 {f.n}</span>
                  <span className="ft mono">{new Date(f.t).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          )}
          {shared && <p className="fine">共抽模式下，你的暱稱與上位賞紀錄會顯示給所有玩這個網頁的人。暱稱可在右上角設定裡改。</p>}
        </div>
      )}

      <div className="dock">
        <div className="dinfo">
          <span className="dsel">{sel.length ? `已選 ${sel.length} 張` : "尚未挑籤"}</span>
          {sel.length > 0 && <span className="dnum mono">{sel.map((i) => i + 1).join(" · ")}</span>}
        </div>
        {sel.length > 0 && <button className="dclear" onClick={onClear}>清除重選</button>}
        <button className="dbtn" disabled={!sel.length || busy || money < cost}
          style={sel.length && money >= cost && !busy ? { background: set.tone } : undefined}
          onClick={() => onDraw(sel)}>
          {busy ? "對籤中…" : sel.length ? `撕開 ${sel.length} 張 · NT$${fmt(cost)}` : "先挑籤"}
        </button>
      </div>
    </div>
  );
}

/* ───────── 開籤儀式 ───────── */
function Reveal({ batch, set, onOpen, onNext, onCollect, onAll }) {
  const done = batch.i >= batch.items.length;
  const it = done ? null : batch.items[batch.i];
  const drag = useRef({ y: 0, on: false });
  const [dy, setDy] = useState(0);

  useEffect(() => { setDy(0); }, [batch.i]);

  function down(e) { if (!it || it.open) return; drag.current = { y: e.clientY, on: true }; }
  function move(e) { if (!drag.current.on) return; setDy(Math.max(0, Math.min(90, e.clientY - drag.current.y))); }
  function up() {
    if (!drag.current.on) return;
    drag.current.on = false;
    if (dy > 34 || dy === 0) onOpen(batch.i); else setDy(0);
  }

  if (done) {
    const gained = batch.items.reduce((a, i) => a + i.v, 0);
    const best = Math.max.apply(null, batch.items.map((i) => tierOf(i.g)));
    return (
      <div className="pad">
        <h3 className="sec">本次戰果</h3>
        <div className="sumgrid">
          {batch.items.map((x, i) => (
            <div key={i} className={`sc t${tierOf(x.g)}`}>
              <Plate k={x.k} tone={set.tone} g={x.g} size={54} />
              <span className={`seal t${tierOf(x.g)}`}>{gLabel(x.g)}</span>
              <span className="scn">{x.variant || x.name}</span>
              <span className="scv mono">{fmt(x.v)}</span>
            </div>
          ))}
        </div>
        <div className={`tally ${best >= 3 ? "hot" : ""}`}>
          <span>帳面 NT${fmt(gained)}</span>
          <span className="mono">{batch.cost ? `${Math.round((gained / batch.cost) * 100)}% 回收` : "白拿"}</span>
        </div>
        <button className="cta" onClick={onCollect}>收進背包</button>
      </div>
    );
  }

  const t = tierOf(it.g);
  return (
    <div className="rv">
      <div className="rvtop">
        <div className="dots">
          {batch.items.map((x, i) => (
            <span key={i} className={`dot ${i < batch.i ? "d" : ""} ${i === batch.i ? "c" : ""} ${x.open && tierOf(x.g) >= 2 ? "hi" : ""}`} />
          ))}
        </div>
        <span className="rvc mono">{batch.i + 1}／{batch.items.length}</span>
      </div>

      {it.isLast && <div className="lastban">箱底見了 — 最後賞歸你</div>}

      <div className="stage">
        <div className={`tk ${it.open ? "op" : ""} t${t}`}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          role="button" tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(batch.i)}>
          <div className="face" style={it.open ? undefined : { transform: `translateY(${dy * 0.5}px) rotate(${dy * 0.05}deg)` }}>
            <div className="perf" />
            <div className="fno mono">{it.slot ? String(it.slot).padStart(2, "0") : it.g === "W" ? "W" : "最"}</div>
            <div className="fw">籤</div>
            <div className="fh">往下撕開</div>
          </div>
          <div className="back">
            <Plate k={it.k} tone={set.tone} g={it.g} size={104} />
            <span className={`seal big t${t}`}>{gLabel(it.g)}</span>
            <span className="bname">{it.name}</span>
            {it.variant && <span className="bvar">{it.variant}</span>}
            <span className="bval mono">全新價 NT${fmt(it.v)}</span>
          </div>
        </div>
      </div>

      <div className="rvbtm">
        {it.open ? (
          <button className="cta" onClick={onNext}>
            {batch.i + 1 === batch.items.length ? "看戰果" : "下一張"}
          </button>
        ) : (
          <button className="cta ghost" onClick={() => onOpen(batch.i)}>撕開</button>
        )}
        {batch.items.length > 1 && batch.i < batch.items.length - 1 && (
          <button className="skip" onClick={onAll}>一次撕完</button>
        )}
      </div>
    </div>
  );
}

function Flash({ g, name, isLast }) {
  return (
    <div className={`flash t${tierOf(g)}`}>
      <div className="fseal">{gLabel(g)}</div>
      <div className="fcall">{isLast ? "最 後 賞" : g === "W" ? "雙重中獎" : `${g} 賞`}</div>
      <div className="fname">{name}</div>
      <div className="fsub">おめでとうございます</div>
    </div>
  );
}

/* ───────── 背包 ───────── */
function Bag({ bag, value, count }) {
  const groups = useMemo(() => {
    const g = {};
    Object.entries(bag).forEach(([key, it]) => { (g[it.setId] = g[it.setId] || []).push({ ...it, key }); });
    Object.values(g).forEach((a) => a.sort((x, y) => (x.g > y.g ? 1 : -1)));
    return g;
  }, [bag]);
  if (!count) return <div className="pad"><div className="empty">背包還是空的。到抽選所挑一檔開始。</div></div>;
  const dup = Object.values(bag).reduce((a, i) => a + (i.n - 1), 0);
  return (
    <div className="pad">
      <div className="bsum">
        <div><span className="bl">件數</span><span className="bv mono">{count}</span></div>
        <div><span className="bl">帳面總值</span><span className="bv mono">NT${fmt(value)}</span></div>
        <div><span className="bl">重複品</span><span className="bv mono">{dup}</span></div>
      </div>
      {Object.entries(groups).map(([sid, items]) => (
        <section key={sid}>
          <h4 className="sec">{byId[sid].title}</h4>
          <div className="bgrid">
            {items.map((i) => (
              <div key={i.key} className={`bi t${tierOf(i.g)}`}>
                <Plate k={i.k} tone={byId[sid].tone} g={i.g} size={72} />
                <span className={`seal t${tierOf(i.g)}`}>{gLabel(i.g)}</span>
                <span className="bin">{i.variant || i.name}</span>
                <span className="biv mono">NT${fmt(i.v)}{i.n > 1 && <b> ×{i.n}</b>}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ───────── 收支 ───────── */
function Stats({ me, bagValue, onPanel }) {
  const s = me.stats;
  const rate = s.spent ? (bagValue / s.spent) * 100 : 0;
  const net = bagValue - s.spent;
  const tops = me.log.filter((l) => ["A", "LAST", "W"].includes(l.g)).length;
  const best = me.log.reduce((a, l) => (l.v > (a ? a.v : 0) ? l : a), null);
  return (
    <div className="pad">
      <div className="receipt">
        <div className="rh"><div className="rt">賞券所</div><div className="rs mono">CUSTOMER STATEMENT</div></div>
        <div className="rl" />
        <R l="抽選者" v={me.name} />
        <R l="總抽數" v={`${s.draws} 抽`} />
        <R l="經手箱數" v={`${s.opened + 1} 箱`} />
        <R l="總支出" v={`NT$${fmt(s.spent)}`} />
        <R l="帳面總值" v={`NT$${fmt(bagValue)}`} />
        <div className="rl" />
        <R big l="淨損益" v={`${net >= 0 ? "+" : "−"}NT$${fmt(Math.abs(net))}`} tone={net >= 0 ? "#2F6B4F" : "#C8342A"} />
        <R big l="回本率" v={`${rate.toFixed(1)}%`} tone={rate >= 100 ? "#2F6B4F" : "#C8342A"} />
        <div className="bar"><div className="bf" style={{ width: `${Math.min(rate, 100)}%`, background: rate >= 100 ? "#2F6B4F" : "#C8342A" }} /></div>
        <div className="rl" />
        <R l="上位賞（A／最後／W）" v={`${tops} 件`} />
        <R l="雙重中獎" v={`${s.wWins}／${s.wTries} 次`} />
        <R l="剩餘資金" v={`NT$${fmt(me.money)}`} />
        {best && <R l="最貴一件" v={`${gLabel(best.g)}賞 NT$${fmt(best.v)}`} />}
        <div className="rl" />
        <p className="rmsg">
          {s.draws === 0 ? "尚未開單。"
            : rate >= 100 ? "這一輪你贏了店家。多數人不會。"
              : `平均每抽拿回 NT$${fmt(bagValue / s.draws)}，票價 NT$${fmt(s.spent / s.draws)}。`}
        </p>
      </div>
      {me.log.length > 0 && (
        <>
          <h4 className="sec">出賞明細</h4>
          <div className="tape">
            {me.log.slice().reverse().slice(0, 120).map((l, i) => (
              <div key={i} className={`tr t${tierOf(l.g)}`}>
                <span className="mono tg">{gLabel(l.g)}</span>
                <span className="tn">{l.name}</span>
                <span className="mono tv">{fmt(l.v)}</span>
              </div>
            ))}
            {me.log.length > 120 && <div className="tmore mono">…前 {me.log.length - 120} 筆已捲起</div>}
          </div>
        </>
      )}
      <button className="rs2" onClick={onPanel}>設定與重置</button>
    </div>
  );
}
const R = ({ l, v, big, tone }) => (
  <div className={`rr ${big ? "big" : ""}`}>
    <span>{l}</span><span className="mono" style={tone ? { color: tone } : undefined}>{v}</span>
  </div>
);

/* ───────── 設定 ───────── */
function Config({ me, setMe, onClose, onReset }) {
  const [name, setName] = useState(me.name);
  const [ask, setAsk] = useState(null);
  // 一般玩家只能重置自己。要清掉大家的箱況得在網址後面加上 ?admin=1
  const isAdmin = typeof location !== "undefined" && /[?&]admin=1(&|$)/.test(location.search);
  return (
    <div className="sheetbg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3 className="sec">設定</h3>
        <label className="fld">
          <span>抽選者暱稱</span>
          <input value={name} maxLength={12} onChange={(e) => setName(e.target.value)}
            onBlur={() => setMe((m) => ({ ...m, name: name.trim() || m.name }))} />
        </label>
        <div className="fld row2">
          <span>抽選模式</span>
          <div className="seg">
            {[["shared", "共抽"], ["solo", "單人"]].map(([v, l]) => (
              <button key={v} className={me.mode === v ? "on" : ""} onClick={() => setMe((m) => ({ ...m, mode: v }))}>{l}</button>
            ))}
          </div>
        </div>
        <p className="fine nm">
          共抽：所有人共用同一箱，庫存即時扣減、抽完自動換下一箱；你的暱稱與上位賞紀錄會被其他人看到。
          單人：自己一箱，不與人共享。
        </p>
        <div className="fld row2">
          <span>音效與震動</span>
          <div className="seg">
            {[[true, "開"], [false, "關"]].map(([v, l]) => (
              <button key={String(v)} className={me.sound === v ? "on" : ""} onClick={() => setMe((m) => ({ ...m, sound: v }))}>{l}</button>
            ))}
          </div>
        </div>
        <div className="rl" />
        {!ask ? (
          <div className="btns">
            <button className="rs2" onClick={() => setAsk("me")}>重置我的資金與背包</button>
            {isAdmin && (
              <button className="rs2 danger" onClick={() => setAsk("all")}>［管理者］重置共用箱況</button>
            )}
          </div>
        ) : (
          <div className="confirm">
            <p>{ask === "all" ? "所有人的箱況也會一起歸零，確定？" : "你的資金、背包與紀錄會歸零，箱況保留。"}</p>
            <div className="btns">
              <button className="yes" onClick={() => onReset(ask === "all")}>確定</button>
              <button className="no" onClick={() => setAsk(null)}>取消</button>
            </div>
          </div>
        )}
        <button className="close" onClick={onClose}>關閉</button>
      </div>
    </div>
  );
}

/* ───────── 樣式 ───────── */
function Style() {
  return (<style>{`
:root{--paper:#E6E3D9;--card:#F6F4ED;--ink:#15181D;--dim:#6E6A5E;--rule:#CFCBBB;
--indigo:#2A4A7C;--verm:#C8342A;--gold:#A07526;
--disp:"Noto Serif TC","Songti TC","Source Han Serif TC",Georgia,serif;
--body:-apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;
--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
*{box-sizing:border-box}
.wrap{max-width:440px;margin:0 auto;min-height:100vh;background:var(--paper);color:var(--ink);
font-family:var(--body);font-size:15px;line-height:1.6;position:relative;padding-bottom:56px;
background-image:radial-gradient(rgba(0,0,0,.025) 1px,transparent 1px);background-size:3px 3px}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.dim{color:var(--dim)}.pad{padding:16px}
.boot{padding:90px 20px;text-align:center;color:var(--dim);font-family:var(--disp)}
.sv{padding-bottom:96px}
button{font:inherit;color:inherit;cursor:pointer;border:none;background:none;touch-action:manipulation}
button:disabled{cursor:not-allowed}
:focus-visible{outline:2px solid var(--indigo);outline-offset:2px}
input{font:inherit;color:inherit}

.top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;
background:var(--ink);color:var(--card);position:relative;z-index:1}
.brand{display:flex;align-items:center;gap:9px}
.mk{width:32px;height:32px;display:grid;place-items:center;background:var(--verm);color:#fff;
font-family:var(--disp);font-size:18px;border-radius:2px}
.bn{display:block;font-family:var(--disp);font-size:16px;letter-spacing:.14em;line-height:1.2}
.bs{display:block;font-family:var(--mono);font-size:9px;letter-spacing:.14em;opacity:.55}
.topr{display:flex;align-items:center;gap:10px}
.purse{text-align:right}
.pl{display:block;font-size:9px;letter-spacing:.16em;opacity:.5}
.pv{display:block;font-family:var(--mono);font-size:16px;font-weight:600}
.gear{width:30px;height:30px;border:1px solid rgba(246,244,237,.25);border-radius:2px;font-size:14px;opacity:.75}

.lede{font-size:13.5px;color:#3D3A33;margin:0 0 15px;padding-left:11px;border-left:2px solid var(--verm)}
.lede b{color:var(--verm);font-weight:600}
.hint{font-size:11.5px;color:var(--dim);margin:0 0 10px}
.fine{font-size:11px;color:var(--dim);line-height:1.7;margin-top:20px}
.fine.nm{margin:6px 0 14px}
.sec{font-family:var(--disp);font-size:13px;letter-spacing:.18em;margin:20px 0 9px;
padding-bottom:5px;border-bottom:1px solid var(--rule)}
.empty{padding:48px 18px;text-align:center;color:var(--dim);font-family:var(--disp);
border:1px dashed var(--rule);border-radius:3px}

.sortbar{display:flex;gap:6px;margin-bottom:12px}
.sortb{padding:5px 12px;font-size:12px;border:1px solid var(--rule);border-radius:2px;
background:var(--card);color:var(--dim)}
.sortb.on{background:var(--ink);border-color:var(--ink);color:var(--card)}
.rank{position:absolute;left:0;top:10px;font-family:var(--disp);font-size:11.5px;letter-spacing:.1em;
color:#fff;background:var(--verm);padding:3px 9px 3px 11px;border-radius:0 2px 2px 0;line-height:1.5}
.shelf{display:flex;flex-direction:column;gap:12px}
.card{display:block;width:100%;text-align:left;background:var(--card);border:1px solid var(--rule);
border-radius:3px;overflow:hidden;box-shadow:0 1px 0 rgba(0,0,0,.06);transition:transform .12s}
.card:active{transform:scale(.988)}
.cwrap{position:relative;line-height:0}
.cover{display:block;width:100%;object-fit:cover}
.cover-img{display:block;width:100%;object-fit:cover}
.ctag{position:absolute;right:10px;bottom:10px;font-family:var(--mono);font-size:16px;
font-weight:700;color:#fff;background:rgba(21,24,29,.72);padding:3px 9px;border-radius:2px;
line-height:1.4;backdrop-filter:blur(2px)}
.ctag i{font-size:10px;font-style:normal;opacity:.75;margin-left:1px}
.cbody{padding:11px 13px 13px}
.cmain{min-width:0}
.ct{font-family:var(--disp);font-size:15.5px;margin:0 0 3px;line-height:1.4}
.cn{font-size:11.5px;color:var(--dim);margin:0 0 8px}
.cm{display:flex;justify-content:space-between;align-items:baseline;font-size:12px}
.price{font-family:var(--mono);font-size:17px;font-weight:600}
.price i{font-size:10px;font-style:normal;color:var(--dim);margin-left:2px}
.gauge{height:3px;background:var(--rule);margin:7px 0 8px;border-radius:2px;overflow:hidden}
.gf{height:100%;transition:width .3s}
.chips{display:flex;gap:6px}
.chip{font-family:var(--mono);font-size:10px;padding:2px 7px;border:1px solid var(--rule);border-radius:2px;color:var(--dim)}
.chip.hot{border-color:var(--verm);color:var(--verm)}
.read{margin-top:8px;padding-top:8px;border-top:1px dashed var(--rule)}
.rdots{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.rdot{display:inline-flex;align-items:center;gap:3px;min-width:22px;height:20px;padding:0 6px;
justify-content:center;font-family:var(--disp);font-size:11px;color:#fff;border-radius:2px;
border:1px solid var(--dim);background:var(--dim)}
.rdot i{font-style:normal;font-family:var(--mono);font-size:9.5px;opacity:.8}
.rdot.out{background:none;color:#B6B1A0;border-color:#D3CFBF;text-decoration:line-through}
.rtag{margin-left:auto;font-family:var(--disp);font-size:11px;letter-spacing:.08em;
padding:1px 8px;border-radius:2px;border:1px solid var(--rule);color:var(--dim)}
.rtag.good{border-color:#2F6B4F;color:#2F6B4F;background:rgba(47,107,79,.08)}
.rtag.bad{border-color:var(--verm);color:var(--verm);background:rgba(200,52,42,.06)}
.rnums{display:flex;flex-wrap:wrap;gap:2px 10px;margin-top:6px;font-size:10.5px;color:var(--dim)}
.rnums .up{color:#2F6B4F;font-weight:600}
.plate{border-radius:2px;flex:0 0 auto;background:var(--card)}
.plate-img{object-fit:cover;border-radius:2px}

.head{position:relative;padding:11px 15px 13px;color:#fff;overflow:hidden;isolation:isolate}
.head .cover{position:absolute;inset:0;width:100%;height:100%;z-index:-2}
.hveil{position:absolute;inset:0;z-index:-1;
background:linear-gradient(180deg,rgba(21,24,29,.32) 0%,rgba(21,24,29,.82) 68%,rgba(21,24,29,.92) 100%)}
.back{position:relative;font-size:11.5px;opacity:.9;padding:2px 0 5px}
.ht{position:relative;font-family:var(--disp);font-size:18px;margin:44px 0 5px;line-height:1.35;
text-shadow:0 1px 6px rgba(0,0,0,.5)}
.hm{position:relative;font-size:11px;opacity:.9;display:flex;align-items:center;gap:6px;flex-wrap:wrap;
text-shadow:0 1px 4px rgba(0,0,0,.5)}
.hm i{opacity:.45;font-style:normal}
.sync{font-size:10.5px;border:1px solid rgba(255,255,255,.4);border-radius:2px;padding:1px 6px;margin-left:auto}
.tabs{display:grid;grid-template-columns:repeat(3,1fr);background:var(--card);
border-bottom:1px solid var(--rule);position:sticky;top:0;z-index:15}
.tab{padding:10px 4px;font-family:var(--disp);font-size:13px;letter-spacing:.1em;color:var(--dim)}
.tab.on{color:var(--ink);box-shadow:inset 0 -2px 0 var(--verm)}

.board{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.slot{position:relative;z-index:1;aspect-ratio:1;display:grid;place-items:center;
font-family:var(--mono);font-size:13px;
background:var(--card);border:1px solid var(--rule);border-radius:3px;color:var(--dim);
transition:transform .1s,background .15s}
.slot:active{transform:scale(.9)}
.slot.gone{background:rgba(0,0,0,.055);border-style:dashed;border-color:#BDB9A9;
box-shadow:inset 0 1px 3px rgba(0,0,0,.09)}
.slot.on{color:#fff;font-weight:700;transform:translateY(-2px);box-shadow:0 2px 0 rgba(0,0,0,.18)}
.grabs{display:flex;align-items:center;gap:7px;margin-top:14px}
.glabel{font-size:11.5px;color:var(--dim)}
.gbtn{padding:6px 11px;font-size:12px;border:1px solid var(--rule);border-radius:2px;background:var(--card)}
.gbtn:disabled{opacity:.35}
.gnote{margin:9px 0 0}
.slot.just{animation:pick .55s ease-out 2}
@keyframes pick{0%,100%{box-shadow:0 0 0 0 rgba(200,52,42,0)}
50%{box-shadow:0 0 0 5px rgba(200,52,42,.45)}}

.ev{display:flex;justify-content:space-between;align-items:flex-end;background:var(--card);
border:1px solid var(--rule);border-radius:3px;padding:12px 14px;margin-bottom:8px}
.evl{font-size:9.5px;letter-spacing:.14em;color:var(--dim)}
.evv{font-size:24px;font-weight:600;line-height:1.15}
.evr{text-align:right}.evp{font-size:16px;font-weight:600}

.ladder{list-style:none;margin:0;padding:0}
.row{display:flex;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid var(--rule)}
.row.out{opacity:.34}
.lastrow{border-bottom:none;border-top:1px dashed var(--rule);margin-top:3px}
.rn{flex:1;font-size:12px;line-height:1.35;min-width:0}
.rn em{display:block;font-style:normal;font-size:10px;color:var(--dim)}
.rc{font-size:11px;color:var(--dim);min-width:40px;text-align:right}
.rp{font-size:11.5px;min-width:46px;text-align:right;font-weight:600}

.seal{width:24px;height:24px;flex:0 0 24px;display:grid;place-items:center;border-radius:2px;
font-family:var(--disp);font-size:12.5px;line-height:1;border:1.5px solid var(--dim);color:var(--dim)}
.seal.t1{border-color:var(--indigo);color:var(--indigo)}
.seal.t2{border-color:var(--indigo);color:#fff;background:var(--indigo)}
.seal.t3{border-color:var(--verm);color:#fff;background:var(--verm)}
.seal.big{width:42px;height:42px;flex-basis:42px;font-size:21px;border-width:2px}

.wbox{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:18px;
padding:12px 14px;border:1.5px dashed var(--verm);border-radius:3px;background:rgba(200,52,42,.04)}
.wt{font-family:var(--disp);font-size:13px;color:var(--verm);letter-spacing:.08em}
.ws{font-size:11.5px;margin-top:1px}
.wm{font-size:10px;color:var(--dim);margin-top:3px}
.wb{padding:8px 12px;background:var(--verm);color:#fff;border-radius:2px;font-size:12.5px;white-space:nowrap}
.wb:disabled{background:var(--rule);color:#928D7E}

.feed{list-style:none;margin:0;padding:0}
.fr{display:flex;align-items:center;gap:9px;padding:8px 2px;border-bottom:1px dotted var(--rule)}
.fr.t3{background:#FBF6E4}
.fn{flex:1;font-size:12px}.fn b{font-weight:600}
.ft{font-size:10px;color:var(--dim)}

.dock{position:fixed;left:0;right:0;bottom:52px;max-width:440px;margin:0 auto;
padding:9px 15px 11px;background:var(--paper);border-top:1px solid var(--rule);
box-shadow:0 -4px 12px rgba(0,0,0,.07);z-index:20}
.dinfo{display:flex;justify-content:space-between;align-items:baseline;gap:10px;
margin-bottom:6px;padding-right:64px}
.dsel{font-size:11.5px;color:var(--dim);white-space:nowrap}
.dnum{font-size:10.5px;color:var(--verm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dbtn{width:100%;padding:14px;background:var(--ink);color:var(--card);border-radius:3px;
font-family:var(--disp);font-size:15px;letter-spacing:.1em}
.dbtn:disabled{background:var(--rule);color:#8E897A}
.dclear{position:absolute;right:15px;top:8px;font-size:11px;color:var(--verm);
text-decoration:underline;padding:3px 2px}

.rv{min-height:calc(100vh - 52px);display:flex;flex-direction:column;padding:14px 16px 22px}
.rvtop{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.dots{display:flex;gap:4px;flex:1;flex-wrap:wrap}
.dot{width:7px;height:7px;border-radius:50%;background:var(--rule)}
.dot.d{background:var(--dim)}.dot.c{background:var(--verm);transform:scale(1.3)}
.dot.hi{background:var(--gold)}
.rvc{font-size:11px;color:var(--dim)}
.lastban{text-align:center;font-family:var(--disp);font-size:13px;letter-spacing:.2em;color:var(--verm);
padding:6px;border-top:1px solid var(--verm);border-bottom:1px solid var(--verm);margin-bottom:10px}
.stage{flex:1;display:grid;place-items:center;padding:8px 0}
.tk{position:relative;width:min(100%,268px);height:340px;border-radius:4px;overflow:hidden;
background:var(--card);border:1px solid var(--rule);touch-action:none;user-select:none;
box-shadow:0 3px 0 rgba(0,0,0,.09)}
.face{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
gap:8px;background:#DCD8CA;z-index:2;transition:transform .1s}
.tk.op .face{animation:tear .42s cubic-bezier(.4,0,.2,1) forwards}
@keyframes tear{60%{transform:translateY(-14%) rotate(-2deg)}100%{transform:translateY(-118%) rotate(-7deg);opacity:0}}
.perf{position:absolute;top:26px;left:0;right:0;height:1px;
background:repeating-linear-gradient(90deg,var(--dim) 0 3px,transparent 3px 8px);opacity:.42}
.fno{position:absolute;top:6px;left:12px;font-size:12px;color:#9E9887;letter-spacing:.1em}
.fw{font-family:var(--disp);font-size:64px;color:#ABA694;letter-spacing:.2em}
.fh{font-size:11px;color:#9E9887;letter-spacing:.24em}
.back{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
gap:7px;padding:16px;text-align:center;background:var(--card)}
.tk.op.t3 .back{background:linear-gradient(#FCF7E6,#F2E9CE);box-shadow:inset 0 0 0 3px var(--gold)}
.tk.op.t2 .back{box-shadow:inset 0 0 0 2px var(--indigo)}
.bname{font-size:12.5px;line-height:1.4}
.bvar{font-family:var(--disp);font-size:17px;color:var(--verm)}
.bval{font-size:10.5px;color:var(--dim)}
.tk.op .seal.big{animation:stamp .32s cubic-bezier(.2,1.5,.4,1) both}
@keyframes stamp{0%{transform:scale(2.4) rotate(-16deg);opacity:0}100%{transform:none;opacity:1}}
.rvbtm{display:flex;flex-direction:column;gap:8px;align-items:center}
.cta{width:100%;padding:14px;background:var(--ink);color:var(--card);border-radius:3px;
font-family:var(--disp);font-size:15px;letter-spacing:.16em}
.cta.ghost{background:none;color:var(--ink);border:1.5px solid var(--ink)}
.skip{font-size:11.5px;color:var(--dim);text-decoration:underline;padding:2px}

.flash{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;
justify-content:center;gap:10px;background:rgba(21,24,29,.93);color:var(--card);
animation:fade .25s;pointer-events:none;text-align:center;padding:24px}
.flash.t3{background:radial-gradient(circle at 50% 42%,#6E5312,#181209 72%)}
@keyframes fade{from{opacity:0}}
.fseal{width:88px;height:88px;display:grid;place-items:center;border:3px solid currentColor;
border-radius:3px;font-family:var(--disp);font-size:46px;animation:stamp .4s cubic-bezier(.2,1.5,.4,1) both}
.flash.t3 .fseal{color:#F0CE72}.flash.t2 .fseal{color:#9CBBE8}
.fcall{font-family:var(--disp);font-size:27px;letter-spacing:.3em}
.flash.t3 .fcall{color:#F0CE72}
.fname{font-size:13px;opacity:.85;max-width:280px}
.fsub{font-family:var(--disp);font-size:11px;letter-spacing:.28em;opacity:.5}

.sumgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.sc{display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 5px;background:var(--card);
border:1px solid var(--rule);border-radius:3px;text-align:center}
.sc.t2{border-color:var(--indigo)}
.sc.t3{border-color:var(--gold);background:#FBF6E4}
.scn{font-size:10.5px;line-height:1.3}
.scv{font-size:10px;color:var(--dim)}
.tally{display:flex;justify-content:space-between;padding:11px 13px;margin-top:13px;background:var(--card);
border:1px solid var(--rule);border-radius:3px;font-size:13px}
.tally.hot{border-color:var(--gold);background:#FBF6E4}

.bsum{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--rule);
border:1px solid var(--rule);border-radius:3px;overflow:hidden}
.bsum>div{background:var(--card);padding:10px 8px;text-align:center}
.bl{display:block;font-size:9.5px;letter-spacing:.1em;color:var(--dim)}
.bv{display:block;font-size:15px;font-weight:600;margin-top:2px}
.bgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.bi{display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 5px;background:var(--card);
border:1px solid var(--rule);border-radius:3px;text-align:center}
.bi.t3{border-color:var(--gold);background:#FBF6E4}
.bi.t2{border-color:var(--indigo)}
.bin{font-size:10.5px;line-height:1.3}
.biv{font-size:10px;color:var(--dim)}.biv b{color:var(--verm)}

.receipt{background:var(--card);border:1px solid var(--rule);border-radius:2px;padding:16px 15px}
.rh{text-align:center;margin-bottom:10px}
.rt{font-family:var(--disp);font-size:17px;letter-spacing:.3em}
.rs{font-size:8.5px;letter-spacing:.22em;color:var(--dim)}
.rl{border-top:1px dashed var(--rule);margin:9px 0}
.rr{display:flex;justify-content:space-between;gap:12px;font-size:12.5px;padding:2.5px 0}
.rr.big{font-size:16px;font-weight:600;padding:4px 0}
.rmsg{font-size:11.5px;color:var(--dim);text-align:center;margin:4px 0 0;line-height:1.7}
.bar{height:5px;background:var(--rule);border-radius:3px;overflow:hidden;margin:7px 0 3px}
.bf{height:100%;transition:width .4s}
.tape{background:var(--card);border:1px solid var(--rule);border-radius:2px;
max-height:280px;overflow-y:auto;padding:4px 0}
.tr{display:flex;align-items:center;gap:8px;padding:5px 12px;font-size:11.5px}
.tr+.tr{border-top:1px dotted var(--rule)}
.tg{width:20px;color:var(--dim);font-size:11px}
.tr.t2 .tg{color:var(--indigo);font-weight:700}
.tr.t3{background:#FBF6E4}.tr.t3 .tg{color:var(--verm);font-weight:700}
.tn{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tv{color:var(--dim)}
.tmore{padding:7px 12px;font-size:10px;color:var(--dim);text-align:center}
.rs2{width:100%;margin-top:18px;padding:11px;font-size:12.5px;color:var(--dim);
border:1px solid var(--rule);border-radius:3px}
.rs2.danger{color:var(--verm);border-color:var(--verm)}

.nav{position:fixed;bottom:0;left:0;right:0;max-width:440px;margin:0 auto;display:grid;
grid-template-columns:repeat(3,1fr);background:var(--ink);z-index:25}
.nav{height:52px}
.nb{padding:0 4px;color:rgba(246,244,237,.5);font-family:var(--disp);font-size:13.5px;letter-spacing:.14em}
.nb.on{color:var(--card);box-shadow:inset 0 2px 0 var(--verm)}
.toast{position:fixed;bottom:94px;left:50%;transform:translateX(-50%);z-index:50;background:var(--ink);
color:var(--card);padding:9px 16px;border-radius:2px;font-size:12.5px;max-width:88%;text-align:center}

.sheetbg{position:fixed;inset:0;background:rgba(21,24,29,.5);z-index:55;
display:flex;align-items:flex-end;justify-content:center}
.sheet{width:100%;max-width:440px;background:var(--paper);border-radius:6px 6px 0 0;
padding:4px 16px 20px;max-height:86vh;overflow-y:auto}
.fld{display:block;margin-bottom:12px}
.fld>span{display:block;font-size:11.5px;color:var(--dim);margin-bottom:4px}
.fld input{width:100%;padding:9px 11px;background:var(--card);border:1px solid var(--rule);
border-radius:2px;font-size:14px}
.fld.row2{display:flex;justify-content:space-between;align-items:center}
.fld.row2>span{margin:0}
.seg{display:flex;border:1px solid var(--rule);border-radius:2px;overflow:hidden}
.seg button{padding:6px 14px;font-size:12.5px;background:var(--card);color:var(--dim)}
.seg button.on{background:var(--ink);color:var(--card)}
.btns{display:flex;flex-direction:column;gap:8px}
.confirm{padding:12px;border:1px solid var(--verm);border-radius:3px;background:rgba(200,52,42,.04);
font-size:12px;text-align:center}
.confirm p{margin:0 0 9px}
.confirm .btns{flex-direction:row}
.yes,.no{flex:1;padding:9px;border-radius:2px;font-size:12.5px}
.yes{background:var(--verm);color:#fff}.no{border:1px solid var(--rule)}
.close{width:100%;margin-top:14px;padding:12px;font-family:var(--disp);font-size:14px;
letter-spacing:.16em;border-top:1px solid var(--rule)}

@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition:none!important}}
`}</style>);
}
