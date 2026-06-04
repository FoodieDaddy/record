/**
 * 麻将主题昵称生成器（前端版，与后端 NicknameGenerator 逻辑一致）
 */

const PREFIX = [
  '雀神','雀圣','雀帝','雀王','雀仙','雀侠',
  '胡了','杠王','听牌','自摸','天胡','地胡',
  '满贯','红中','发财','白板','东风','西风','南风','北风',
  '一筒','九筒','一条','九条','一万','九万',
  '清龙','混龙','花蝶','牌王'
];

const NAME = [
  '东方','西门','令狐','任盈','黄蓉','郭靖',
  '杨过','小龙','张飞','赵云','关羽','吕布',
  '乔峰','段誉','虚竹','韦小','洪七','黄药',
  '楚香','陆凤','李欢','花楼','叶城','燕天',
  '诸葛','曹操','刘备','孙权','周瑜',
  '悟空','八戒','哪吒','杨戬','子牙',
  '红雪','鱼儿','无缺','浪子','剑客'
];

const SUFFIX = ['本尊','大人','驾到','在此','出山','归来'];

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function generate() {
  const prefix = PREFIX[randInt(PREFIX.length)];
  const name = NAME[randInt(NAME.length)];
  const mode = Math.random();

  if (mode < 0.5) {
    return prefix + name;
  } else if (mode < 0.75) {
    return prefix + name + (randInt(9) + 1);
  } else if (prefix.length === 2 && name.length === 2) {
    return prefix + name + SUFFIX[randInt(SUFFIX.length)];
  } else {
    return prefix + name + (randInt(9) + 1);
  }
}

module.exports = { generate };
