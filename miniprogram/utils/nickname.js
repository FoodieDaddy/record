/**
 * 麻将/扑克主题昵称生成器 (抽象网络热词增强版)
 * 组合方式: prefix × name × suffix + 数字后缀 → 脑洞大开
 */

// 前缀：麻将牌型、花色、术语 + 【新增搞笑/网络前缀】
const PREFIX = [
  // 原有经典前缀
  '雀神','雀圣','雀帝','雀王','雀仙','雀侠','雀狂','雀魔',
  '九莲宝灯','十三幺','天胡','地胡','人胡','清一色','混一色',
  '大三元','小三元','大四喜','小四喜','绿一色','字一色',
  '四暗刻','三暗刻','杠上开花','海底捞月','妙手回春','绝张','自摸','点炮',
  '听牌','诈胡','天听','门前清','不求人','全求人','流局','一发',
  '满贯','役满','同花顺','皇家同花顺','梭哈','盲注','加注',
  // 👇 新增：搞怪/黑话前缀
  '慈善赌王','散财童子','送分菩萨','非酋','欧皇','发牌员的亲戚',
  '究极老六','嘴强王者','顶级','抽象','纯爱战神','理财大师',
  '高血压','光速下播','防沉迷','五行缺胡','国服第一'
];

// 核心名字：武侠/历史/麻将术语 + 【新增网络热词/梗物】
const NAME = [
  // 原有经典名字
  '东方不败','西门吹雪','南帝北丐','令狐冲','任盈盈',
  '黄蓉','郭靖','杨过','小龙女','张无忌','赵敏','周芷若',
  '乔峰','段誉','虚竹','韦小宝','洪七公','黄药师','独孤求败',
  '楚留香','陆小凤','李寻欢','花满楼','叶孤城','燕南天',
  '诸葛亮','曹操','刘备','孙权','关羽','张飞','赵云','司马懿',
  '孙悟空','猪八戒','沙悟净','唐僧','哪吒','杨戬',
  // 👇 新增：网络热词 & 抽象名词
  '吗喽','卡皮巴拉','大怨种','卧龙凤雏','打工人','脆皮大学生',
  '精神小伙','龙傲天','叶良辰','退堂鼓艺术家','麦门信徒',
  '沸羊羊','双面龟','哥谭噩梦','细狗','尊嘟假嘟','显眼包',
  '哈士奇','吗喽的命','鸽子精','复读机','吃瓜群众'
];

// 后缀 + 【新增搞笑状态后缀】
const SUFFIX = [
  // 原有后缀
  '本尊','大人','驾到','在此','出山','归来','再战','附体','转世','降临',
  // 👇 新增：搞笑行为/状态后缀
  '申请出战','退退退','赢麻了','输麻了','破防了','骂骂咧咧',
  '已掉线','求带飞','绝不认输','汗流浃背了','请求互动',
  '正在输入','已注销','在线要饭','连夜扛火车跑了'
];

// 形容词 + 【新增摆烂/情绪形容词】
const ADJ = [
  // 原有形容词
  '无敌的','传说中的','神秘的','霸气的','低调的','嚣张的',
  '疯狂的','冷静的','狂暴的','优雅的','粗犷的',
  '幸运的','倒霉的','孤独的','潇洒的','老练的',
  // 👇 新增：当代网友精神状态
  '摆烂的','佛系的','离谱的','硬核的','抽象的','脆皮的',
  '破防的','社交牛逼的','社恐的','emo的','又菜又爱玩的',
  '随叫随到的','人菜瘾大的','偷偷内卷的'
];

/**
 * 生成随机昵称
 * @returns {string}
 */
function generate() {
  const r = Math.random();
  let result;

  if (r < 0.35) {
    // 模式1: prefix + name (35%) → "慈善赌王卡皮巴拉"
    result = pick(PREFIX) + pick(NAME);
  } else if (r < 0.55) {
    // 模式2: name + suffix (20%) → "大怨种输麻了"
    result = pick(NAME) + pick(SUFFIX);
  } else if (r < 0.7) {
    // 模式3: prefix + name + 数字 (15%) → "杠上开花吗喽666"
    result = pick(PREFIX) + pick(NAME) + randNum();
  } else if (r < 0.82) {
    // 模式4: adj + name (12%) → "人菜瘾大的东方不败"
    result = pick(ADJ) + pick(NAME);
  } else if (r < 0.92) {
    // 模式5: prefix + name + suffix (10%) → "非酋卧龙凤雏退退退"
    result = pick(PREFIX) + pick(NAME) + pick(SUFFIX);
  } else {
    // 模式6: adj + prefix + name (8%) → "摆烂的散财童子猪八戒"
    result = pick(ADJ) + pick(PREFIX) + pick(NAME);
  }

  return result;
}

/**
 * 批量生成不重复昵称
 * @param {number} count
 * @returns {string[]}
 */
function generateBatch(count) {
  const set = new Set();
  let attempts = 0;
  while (set.size < count && attempts < count * 10) {
    set.add(generate());
    attempts++;
  }
  return Array.from(set);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randNum() {
  const r = Math.random();
  // 优化数字生成，加入一些网络热梗数字
  const specialNums = ['666', '888', '233', '520', '996', '007'];
  if (r < 0.2) return pick(specialNums);
  if (r < 0.4) return String(Math.floor(Math.random() * 999) + 1);
  if (r < 0.6) return '';
  if (r < 0.8) return String(Math.floor(Math.random() * 99) + 1);
  return String(Math.floor(Math.random() * 9999) + 1);
}

module.exports = { generate, generateNickname: generate, generateBatch };