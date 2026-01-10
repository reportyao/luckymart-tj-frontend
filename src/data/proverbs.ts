// 塔吉克谚语数据库 - 100条民间谚语
// 前端只显示塔吉克语，中文仅用于开发维护参考

export interface Proverb {
  id: number;
  tajik: string;
  chinese: string; // 仅用于开发参考，前端不显示
  category: string;
}

export const proverbs: Proverb[] = [
  {
    id: 1,
    tajik: "Олими беамал — занбӯри беасал.",
    chinese: "没有行动的学者，就像没有蜜的蜜蜂。",
    category: "行动与实践"
  },
  {
    id: 2,
    tajik: "Забон донӣ — ҷаҳон донӣ.",
    chinese: "懂一门语言，就懂一个世界。",
    category: "知识与学习"
  },
  {
    id: 3,
    tajik: "Аввал андеша, баъд гуфтор.",
    chinese: "先思考，后说话。",
    category: "智慧与言语"
  },
  {
    id: 4,
    tajik: "Бо моҳ шинӣ, моҳ шавӣ; бо дег шинӣ, сиёҳ шавӣ.",
    chinese: "近朱者赤，近墨者黑。",
    category: "环境与朋友"
  },
  {
    id: 5,
    tajik: "Офтобро бо доман пӯшида намешавад.",
    chinese: "真理无法被掩盖。",
    category: "真理"
  },
  {
    id: 6,
    tajik: "Дӯсти ҷонӣ — дар рӯзи сахтӣ.",
    chinese: "患难见真情。",
    category: "友谊"
  },
  {
    id: 7,
    tajik: "Зиндагӣ бе дӯст — девори бе дар.",
    chinese: "没有朋友的生活，就像没有门的墙。",
    category: "友谊"
  },
  {
    id: 8,
    tajik: "Қатра-қатра дарё шавад.",
    chinese: "积少成多，聚沙成塔。",
    category: "毅力"
  },
  {
    id: 9,
    tajik: "Меҳнат кунӣ, роҳат бинӣ.",
    chinese: "辛勤劳动，终享安乐。",
    category: "勤劳"
  },
  {
    id: 10,
    tajik: "Ватан — модар аст.",
    chinese: "祖国即母亲。",
    category: "爱国"
  },
  {
    id: 11,
    tajik: "Илм дар кӯдакӣ — нақш бар санг.",
    chinese: "少时求学，如石上刻字。",
    category: "教育"
  },
  {
    id: 12,
    tajik: "Аз гаҳвора то гӯр дониш омӯз.",
    chinese: "活到老，学到老。",
    category: "教育"
  },
  {
    id: 13,
    tajik: "Девори намнок зуд меғалтад.",
    chinese: "基础不牢，地动山摇。",
    category: "基础"
  },
  {
    id: 14,
    tajik: "Сухан — нуқра, хомӯшӣ — тилло.",
    chinese: "雄辩是银，沉默是金。",
    category: "智慧"
  },
  {
    id: 15,
    tajik: "Ҳар чӣ корӣ, ҳамон даравӣ.",
    chinese: "种瓜得瓜，种豆得豆。",
    category: "因果"
  },
  {
    id: 16,
    tajik: "Сабр — калиди хушбахтӣ.",
    chinese: "忍耐是幸福的钥匙。",
    category: "品德"
  },
  {
    id: 17,
    tajik: "Як даст садо надорад.",
    chinese: "孤掌难鸣。",
    category: "合作"
  },
  {
    id: 18,
    tajik: "Кӯҳи баландро шамол намеларзонад.",
    chinese: "高山不畏风摇。",
    category: "坚韧"
  },
  {
    id: 19,
    tajik: "Дӯсти нодон — душмани ҷон.",
    chinese: "愚蠢的朋友比敌人更可怕。",
    category: "友谊"
  },
  {
    id: 20,
    tajik: "Вақт — тилло аст.",
    chinese: "时间就是金钱。",
    category: "时间"
  },
  {
    id: 21,
    tajik: "Об дар кӯза ва мо ташналабон мегардем.",
    chinese: "身在福中不知福。",
    category: "生活"
  },
  {
    id: 22,
    tajik: "Ҳар кас ба умед зинда аст.",
    chinese: "人因希望而活。",
    category: "希望"
  },
  {
    id: 23,
    tajik: "Аз як гул баҳор намешавад.",
    chinese: "独木不成林。",
    category: "合作"
  },
  {
    id: 24,
    tajik: "Гуфтани ҳақ — талх аст.",
    chinese: "忠言逆耳。",
    category: "真理"
  },
  {
    id: 25,
    tajik: "Мард бояд, ки ҳаросад накунад аз мушкил.",
    chinese: "男子汉不应畏惧困难。",
    category: "勇气"
  },
  {
    id: 26,
    tajik: "Нон — неъмати бузург.",
    chinese: "面包是巨大的恩赐。",
    category: "感恩"
  },
  {
    id: 27,
    tajik: "Модар розист — Худо розист.",
    chinese: "母亲满意，上帝也就满意。",
    category: "家庭"
  },
  {
    id: 28,
    tajik: "Ростӣ — беҳтарин сиёсат.",
    chinese: "诚实是最好的策略。",
    category: "诚实"
  },
  {
    id: 29,
    tajik: "Аз одами бад ҳазар кун.",
    chinese: "远离坏人。",
    category: "处世"
  },
  {
    id: 30,
    tajik: "Ақл — тоҷи сар аст.",
    chinese: "智慧是头上的皇冠。",
    category: "智慧"
  },
  {
    id: 31,
    tajik: "Дарахтро аз мевааш мешиносанд.",
    chinese: "观其行知其人。",
    category: "判断"
  },
  {
    id: 32,
    tajik: "Дардмандонро даво бахшидан — кори мардон аст.",
    chinese: "帮助痛苦的人是高尚的行为。",
    category: "善良"
  },
  {
    id: 33,
    tajik: "Оби рехтаро ҷамъ карда намешавад.",
    chinese: "覆水难收。",
    category: "后悔"
  },
  {
    id: 34,
    tajik: "Аз гап — амал беҳтар.",
    chinese: "行动胜于空谈。",
    category: "行动"
  },
  {
    id: 35,
    tajik: "Меҳмон — ҳадяи Худо.",
    chinese: "客人是上帝的礼物。",
    category: "好客"
  },
  {
    id: 36,
    tajik: "Сирри мардумро нигоҳ дор.",
    chinese: "保守别人的秘密。",
    category: "信任"
  },
  {
    id: 37,
    tajik: "Тандурустӣ — гавҳари ноёб.",
    chinese: "健康是无价之宝。",
    category: "健康"
  },
  {
    id: 38,
    tajik: "Китоб — дӯсти беминнат.",
    chinese: "书是无求的朋友。",
    category: "阅读"
  },
  {
    id: 39,
    tajik: "Дар ҷавонӣ меҳнат кун, дар пирӣ давлат рон.",
    chinese: "少壮不努力，老大徒伤悲。",
    category: "勤劳"
  },
  {
    id: 40,
    tajik: "Аз дӯсти нав, дӯсти кӯҳна беҳтар аст.",
    chinese: "老友胜新朋。",
    category: "友谊"
  },
  {
    id: 41,
    tajik: "Ҳар ҷо ки ваҳдат аст, он ҷо қудрат аст.",
    chinese: "团结就是力量。",
    category: "团结"
  },
  {
    id: 42,
    tajik: "Поёни шаби сиёҳ — сафед аст.",
    chinese: "黑暗之后必有光明。",
    category: "希望"
  },
  {
    id: 43,
    tajik: "Шунидан кай бувад монанди дидан.",
    chinese: "百闻不如一见。",
    category: "经验"
  },
  {
    id: 44,
    tajik: "Дил ба дил роҳ дорад.",
    chinese: "心心相印。",
    category: "情感"
  },
  {
    id: 45,
    tajik: "Аз ҳаракат — баракат.",
    chinese: "行动带来祝福。",
    category: "行动"
  },
  {
    id: 46,
    tajik: "Ганҷ дар вайрона аст.",
    chinese: "宝藏常在废墟中。",
    category: "智慧"
  },
  {
    id: 47,
    tajik: "Зарро заргар шиносад.",
    chinese: "识货还得行家。",
    category: "专业"
  },
  {
    id: 48,
    tajik: "Борон наборад, замин хушк мемонад.",
    chinese: "没有付出就没有收获。",
    category: "因果"
  },
  {
    id: 49,
    tajik: "Ҳеҷ кас аз модар олим таваллуд намешавад.",
    chinese: "没有人天生就是学者。",
    category: "努力"
  },
  {
    id: 50,
    tajik: "Девонаро маҷлис надиҳед.",
    chinese: "不要给愚人舞台。",
    category: "智慧"
  },
  {
    id: 51,
    tajik: "Хар ҳамон хар аст, гарчи зин бадал шуд.",
    chinese: "江山易改，本性难移。",
    category: "本性"
  },
  {
    id: 52,
    tajik: "Саховат — нишонаи мардӣ.",
    chinese: "慷慨是男子汉的标志。",
    category: "品德"
  },
  {
    id: 53,
    tajik: "Кори имрӯзро ба фардо магузор.",
    chinese: "今日事今日毕。",
    category: "效率"
  },
  {
    id: 54,
    tajik: "Душман агарчи хурд бошад, хурд машумор.",
    chinese: "切莫轻敌。",
    category: "谨慎"
  },
  {
    id: 55,
    tajik: "Аз худпарастӣ кас ба ҷое намерасад.",
    chinese: "自私自利者难成大事。",
    category: "品德"
  },
  {
    id: 56,
    tajik: "Бадӣ кунӣ, бадӣ мебинӣ.",
    chinese: "恶有恶报。",
    category: "因果"
  },
  {
    id: 57,
    tajik: "Некӣ куну ба дарё парто.",
    chinese: "施恩不图报。",
    category: "善良"
  },
  {
    id: 58,
    tajik: "Ҳар кӣ сабр кард, зафар ёфт.",
    chinese: "忍耐者终获胜利。",
    category: "成功"
  },
  {
    id: 59,
    tajik: "Бе ранҷ ганҷ мияссар намешавад.",
    chinese: "不劳无获。",
    category: "勤劳"
  },
  {
    id: 60,
    tajik: "Сухани хуш — мори аз сӯрох мебарорад.",
    chinese: "好话能让蛇出洞。",
    category: "沟通"
  },
  {
    id: 61,
    tajik: "Аз хок офарида шудем, ба хок бармегардем.",
    chinese: "生于尘土，归于尘土。",
    category: "人生"
  },
  {
    id: 62,
    tajik: "Қарз — меҳмони нохонда.",
    chinese: "债务是不请自来的客人。",
    category: "生活"
  },
  {
    id: 63,
    tajik: "Дурӯғгӯ хотира надорад.",
    chinese: "说谎者需要好记性。",
    category: "诚实"
  },
  {
    id: 64,
    tajik: "Дасти диҳанда — беҳ аз дасти гиранда.",
    chinese: "给予比接受更幸福。",
    category: "慷慨"
  },
  {
    id: 65,
    tajik: "Ҳар чӣ дорӣ, шукр кун.",
    chinese: "知足常乐。",
    category: "心态"
  },
  {
    id: 66,
    tajik: "Аз як зарра оташ ҷангал месӯзад.",
    chinese: "星星之火，可以燎原。",
    category: "谨慎"
  },
  {
    id: 67,
    tajik: "Аз бекор Худо безор.",
    chinese: "懒惰者连上帝都讨厌。",
    category: "勤劳"
  },
  {
    id: 68,
    tajik: "Зӯрӣ ба амал наояд.",
    chinese: "蛮力解决不了问题。",
    category: "智慧"
  },
  {
    id: 69,
    tajik: "Меваи сабр ширин аст.",
    chinese: "忍耐的果实是甜的。",
    category: "耐心"
  },
  {
    id: 70,
    tajik: "Ҳамсояи наздик беҳ аз хеши дур.",
    chinese: "远亲不如近邻。",
    category: "邻里"
  },
  {
    id: 71,
    tajik: "Ақли солим дар тани солим.",
    chinese: "健全的精神寓于健全的身体。",
    category: "健康"
  },
  {
    id: 72,
    tajik: "Ваъдаи хом — умеди бардурӯғ.",
    chinese: "空头支票是虚假的希望。",
    category: "诚信"
  },
  {
    id: 73,
    tajik: "Ҳақиқат мисли офтоб аст.",
    chinese: "真理像太阳。",
    category: "真理"
  },
  {
    id: 74,
    tajik: "Пушаймонӣ суд надорад.",
    chinese: "后悔无益。",
    category: "心态"
  },
  {
    id: 75,
    tajik: "Аз мост, ки бар мост.",
    chinese: "自作自受。",
    category: "责任"
  },
  {
    id: 76,
    tajik: "Шамшерро аз ғилоф берун макаш бесабаб.",
    chinese: "无故莫拔剑。",
    category: "和平"
  },
  {
    id: 77,
    tajik: "Сарват на ба мол аст, балки ба қалб.",
    chinese: "财富不在金钱，而在内心。",
    category: "价值观"
  },
  {
    id: 78,
    tajik: "Аз чашм дур — аз дил дур.",
    chinese: "眼不见，心不烦。",
    category: "情感"
  },
  {
    id: 79,
    tajik: "Хоҷа боғ дорӣ? Боғ дорӣ, ғам дорӣ.",
    chinese: "拥有越多，烦恼越多。",
    category: "生活"
  },
  {
    id: 80,
    tajik: "Ҳар сухан ҷое ва ҳар нукта мақоме дорад.",
    chinese: "说话要看场合。",
    category: "智慧"
  },
  {
    id: 81,
    tajik: "Дӯстро дар сафар шинос.",
    chinese: "路遥知马力。",
    category: "友谊"
  },
  {
    id: 82,
    tajik: "Ҳеҷ кас бе хато нест.",
    chinese: "人无完人。",
    category: "宽容"
  },
  {
    id: 83,
    tajik: "Одами хушхулқ — дӯсти ҳама.",
    chinese: "好脾气的人是大家的朋友。",
    category: "人际"
  },
  {
    id: 84,
    tajik: "Илм чароғи ақл аст.",
    chinese: "知识是智慧的明灯。",
    category: "教育"
  },
  {
    id: 85,
    tajik: "Вақти рафта боз намегардад.",
    chinese: "光阴一去不复返。",
    category: "时间"
  },
  {
    id: 86,
    tajik: "Каҷ шину рост гӯй.",
    chinese: "坐得歪没关系，话要说得直。",
    category: "诚实"
  },
  {
    id: 87,
    tajik: "Аз озмоиш — дониш.",
    chinese: "实践出真知。",
    category: "经验"
  },
  {
    id: 88,
    tajik: "Ҳунар — беҳ аз зар.",
    chinese: "技艺胜千金。",
    category: "技能"
  },
  {
    id: 89,
    tajik: "Аз гуфтор то кирдор роҳ дароз аст.",
    chinese: "说来容易做来难。",
    category: "行动"
  },
  {
    id: 90,
    tajik: "Саломатӣ — подшоҳӣ аст.",
    chinese: "健康即是王权。",
    category: "健康"
  },
  {
    id: 91,
    tajik: "Нони худӣ беҳ аз палови бегона.",
    chinese: "自家的粗茶淡饭胜过外人的山珍海味。",
    category: "独立"
  },
  {
    id: 92,
    tajik: "Дил набошад, даст кор намекунад.",
    chinese: "心不在焉，事必无成。",
    category: "专注"
  },
  {
    id: 93,
    tajik: "Аз хурдӣ омӯз, то бузургӣ сарвар шавӣ.",
    chinese: "少时学习，大时领袖。",
    category: "成长"
  },
  {
    id: 94,
    tajik: "Маргро даво нест.",
    chinese: "生死有命。",
    category: "自然"
  },
  {
    id: 95,
    tajik: "Обрӯ рехт — ба ҷояш намеояд.",
    chinese: "名誉一旦扫地，难以挽回。",
    category: "名誉"
  },
  {
    id: 96,
    tajik: "Ҳар киро сабр нест, ҳикмат нест.",
    chinese: "无忍耐者无智慧。",
    category: "智慧"
  },
  {
    id: 97,
    tajik: "Дӯсти беайб ҷӯӣ, бе дӯст мемонӣ.",
    chinese: "水至清则无鱼。",
    category: "宽容"
  },
  {
    id: 98,
    tajik: "Поятро ба андозаи кӯрпаат дароз кун.",
    chinese: "量入为出。",
    category: "理财"
  },
  {
    id: 99,
    tajik: "Амали нек — умри дуюм.",
    chinese: "善行是人的第二次生命。",
    category: "善行"
  },
  {
    id: 100,
    tajik: "Хонаободӣ — дилободӣ.",
    chinese: "家和万事兴。",
    category: "家庭"
  }
];
