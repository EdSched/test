// ── VIP 课程目录（单一数据源）──
// 由 VIP.html 迁移而来，专业 key 已统一为主库口径（shinpan/shakai/keiei/keizai）。
// admin 新建 VIP 框架时以此为默认内容预填，之后可由 admin 编辑 / 分享给老师补充。

// 项目分类顺序与标签（框架按此顺序组织）
const VIP_CATEGORIES = [
  { key: 'found',  label: '升学基本指导' },
  { key: 'base',   label: '专业课基础知识' },
  { key: 'adv',    label: '专业课备考强化' },
  { key: 'method', label: '专业课基础方法论' },
  { key: 'ext',    label: '专业课拓展方法论' },
  { key: 'past',   label: '过去问对策' },
  { key: 'eng',    label: '英翻日对策' },
  { key: 'plan',   label: '研究计划书' },
  { key: 'apply',  label: '出愿指导' },
  { key: 'inter',  label: '面试对策' },
  { key: 'ta',     label: 'TA指导' },
];

// 跨专业通用课程（found/past/eng/plan/apply/inter/ta）
const VIP_FIXED_COURSES = {
  found: [
    {id:'found-1', name:'升学目标指定', desc:'面谈、方向确认、整体学习计划制定', hw:'完成老师要求信息提交', defaultHours:1},
  ],
  past: [
    {id:'past-1', name:'论述题写作基础',  desc:'读题，读表技巧，名词解释，小论文写作',          hw:'完成课后题目', defaultHours:2},
    {id:'past-2', name:'过去问真题练习',  desc:'初次真题练习（题型理解＋解题框架搭建）',          hw:'完成课后题目', defaultHours:2},
    {id:'past-3', name:'过去问真题强化',  desc:'真题训练（重点题型强化＋解析）',                 hw:'完成课后题目', defaultHours:2},
    {id:'past-4', name:'志望校真题训练',  desc:'志望校真题限时训练（含讲评＋技巧纠正）',          hw:'完成课后题目', defaultHours:2},
    {id:'past-5', name:'志望校真题强化',  desc:'志望校弱项强化训练（易错题专项）',               hw:'完成课后题目', defaultHours:2},
  ],
  eng: [
    {id:'eng-1', name:'英翻日基础',    desc:'英翻日基础技巧，专业知识单词补充', hw:'完成课后题目', defaultHours:2},
    {id:'eng-2', name:'英翻日长文',    desc:'英翻日长文翻译',                 hw:'完成课后题目', defaultHours:2},
    {id:'eng-3', name:'英翻日精读要约', desc:'英翻日要约和精读练习',           hw:'完成课后题目', defaultHours:2},
    {id:'eng-4', name:'英翻日论述',    desc:'英文阅读论述题练习',             hw:'完成课后题目', defaultHours:2},
  ],
  plan: [
    {id:'plan-1',  name:'计划书选题',    desc:'研究计划选题方向讨论、研究框架初设',              hw:'完成计划书背景资料收集', defaultHours:2},
    {id:'plan-2',  name:'计划书学术基础', desc:'学术表达：学术语言写作、计划书逻辑',             hw:'完成计划书框架',    defaultHours:2},
    {id:'plan-3',  name:'计划书文献查找', desc:'文献检索方法：数据库、关键词选择、文献笔记整理', hw:'完成先行研究查找',   defaultHours:2},
    {id:'plan-4',  name:'计划书文献阅读', desc:'文献阅读方法：锁定问题意识，研究方法，结论',     hw:'完成先行研究粗整理', defaultHours:2},
    {id:'plan-5',  name:'计划书先行研究', desc:'先行研究整理：文献整理手法、结论统合归纳',       hw:'完成先行研究表格',   defaultHours:2},
    {id:'plan-6',  name:'计划书背景',    desc:'研究背景撰写：问题意识、研究目的、核心概念整理',  hw:'完成计划书背景撰写', defaultHours:2},
    {id:'plan-7',  name:'计划书写作基础', desc:'先行研究撰写：文献整合、理论定位、研究缝隙',     hw:'完成先行研究撰写',   defaultHours:2},
    {id:'plan-8',  name:'计划书研究方法', desc:'研究方法撰写：定性／定量、访谈、内容分析',       hw:'完成研究方法撰写',   defaultHours:2},
    {id:'plan-9',  name:'计划书初稿完成', desc:'研究计划草稿修订①：逻辑结构、章节安排',         hw:'完成计划书草稿',    defaultHours:2},
    {id:'plan-10', name:'计划书完善修订', desc:'研究计划草稿修订②：可行性、创新性、研究伦理补充', hw:'更新计划书草稿',   defaultHours:2},
    {id:'plan-11', name:'计划书最终完成', desc:'研究计划最终整理：结构优化、语言校对、目标校对应', hw:'针对出愿学校完成计划书', defaultHours:2},
  ],
  apply: [
    {id:'apply-1', name:'出愿手续',    desc:'出愿要项确认，前期出愿资料准备，证明书开具说明',          hw:'完成证明书，语言成绩等开具', defaultHours:2},
    {id:'apply-2', name:'出愿学校初筛', desc:'根据计划书初稿筛选教授、提出修改计划书建议',             hw:'完成出愿list',       defaultHours:2},
    {id:'apply-3', name:'出愿学校确定', desc:'教授论文精读，联系邮件写作指导，学校信息分析',           hw:'完成出愿资料准备，完成教授邮件', defaultHours:2},
    {id:'apply-4', name:'出愿资料撰写', desc:'出愿资料检查、志望理由书初稿指导',                     hw:'完成志望理由书和其他相关资料', defaultHours:2},
    {id:'apply-5', name:'出愿资料修改', desc:'志望理由书修改、出愿材料准备与清单确认、日语润色',       hw:'完成所有出愿材料', defaultHours:2},
    {id:'apply-6', name:'出愿资料确认', desc:'目标校格式确认、研究主题对应检查、出愿材料最终确认',     hw:'完成出愿',         defaultHours:2},
  ],
  inter: [
    {id:'inter-1', name:'面试稿准备',   desc:'面试问题整理：基础问题和研究计划相关问题准备', hw:'完成面试初稿',   defaultHours:2},
    {id:'inter-2', name:'面试稿定稿',   desc:'面试对策：研究内容表达训练、常见问题应对',   hw:'完成面试稿',     defaultHours:2},
    {id:'inter-3', name:'模拟面试流程', desc:'面试礼仪流程说明和训练，初次面试并反馈改进点', hw:'更新面试稿问题', defaultHours:2},
    {id:'inter-4', name:'模拟面试更新', desc:'日语表达修正，更新随机问题和回答，反馈和改进计划', hw:'更新面试稿问题', defaultHours:2},
    {id:'inter-5', name:'模拟面试实战', desc:'实战模拟面试，熟悉完成流程，最终确认和表达优化', hw:'面试练习',    defaultHours:2},
  ],
  ta: [
    {id:'ta-1', name:'TA面试指导', fixedHours:true,
     desc:'在面试稿完成的前提下，模拟面试',
     detail:'基本问题、高频问题、临场应变能力训练、表情管理、礼仪训练',
     schedule:'时间可自由约，不限于周六日，与老师协商一致即可',
     hw:'完成面试稿', defaultHours:20},
    {id:'ta-2', name:'TA学习指导', fixedHours:true,
     desc:'日常学习指导',
     detail:'日语语法纠正、论文写作规范、学习方法、综合学术训练（找论文、归纳整理理论文等，可按照学生需求调整）',
     schedule:'时间可自由约，不限于周六日，与老师协商一致即可',
     hw:'跟踪学习进度', defaultHours:20},
  ],
};

// 各专业子课（base/adv/method/ext）
const VIP_MAJOR_SUBJECTS = {
  shinpan: {
    base: [
      {id:'xc-b1', num:'01', name:'传播学知识系谱', topics:'导入，媒介性，大众传播，代表性学者(拉扎斯菲尔德，李普曼，拉斯菲尔等)', hours:2},
      {id:'xc-b2', num:'02', name:'媒介的发展',     topics:'口语，文字，印刷，图像，广播，电影，电视和网络', hours:2},
      {id:'xc-b3', num:'03', name:'传播效果论',     topics:'枪弹论，有限效果论，使用与满足，议题设定，沉默的螺旋，知沟理论，框架理论', hours:2},
      {id:'xc-b4', num:'04', name:'近代新闻学',     topics:'新闻学，日本报业发展，公共圈，审查与言论自由，市民记者', hours:2},
      {id:'xc-b5', num:'05', name:'现代政治传播与大众舆论', topics:'把关人理论，意见领袖，选择性接触，意见极化，AI发展，虚假新闻', hours:2},
    ],
    adv: [
      {id:'xc-a1', num:'06', name:'自我与社会认知', topics:'自我觉知，自我表演，自证预言，认知偏差，启动效应，归因理论，刻板印象', hours:2},
      {id:'xc-a2', num:'07', name:'态度与偏见',     topics:'态度的功能，学习理论，计划行为理论，认知失调，说服，偏见', hours:2},
      {id:'xc-a3', num:'08', name:'风险认知与受众心理', topics:'风险社会，台风眼效应，意见领袖，二阶段信息流向假设，粉丝研究', hours:2},
    ],
    method: [
      {id:'xc-m1', num:'09', name:'新传研究方法',         topics:'问题意识，假说构成，定性与定量，观察法，访谈，田野调查，问卷调查，内容分析', hours:2},
      {id:'xc-m2', num:'10', name:'调查问卷的设计与测量尺度', topics:'问卷设计，设问与选项，调查对象，数据量化，尺度，信赖性，妥当性，量表', hours:2},
    ],
    ext: [],
  },
  shakai: {
    base: [
      {id:'sh-b1', num:'01', name:'古典社会学',    topics:'デュルケーム、ウエーバー、ジンメル、ミードの諸概念', hours:2},
      {id:'sh-b2', num:'02', name:'構造機能主義',  topics:'パーソンズ、マートン、ルーマンの諸概念', hours:2},
      {id:'sh-b3', num:'03', name:'意味学派',      topics:'シンボリック相互作用論、現象学的社会学、ゴフマン、エスノメソドロジー', hours:2},
      {id:'sh-b4', num:'04', name:'構造化理論',    topics:'ブルデュー、ギデンズの社会学', hours:2},
    ],
    adv: [
      {id:'sh-a1', num:'05', name:'現代社会論1',             topics:'社会変動論，個人化と心理化，圧縮された近代，家族・親密な関係性の変容', hours:2},
      {id:'sh-a2', num:'06', name:'現代社会論2',             topics:'不安定社会と若者，バウマンの現代社会論，社会意識とグローバル化', hours:2},
      {id:'sh-a3', num:'07', name:'ジェンダー＆セクシュアリティ1', topics:'フェミニズムの流れと理論的パースペクティブ', hours:2},
      {id:'sh-a4', num:'08', name:'ジェンダー＆セクシュアリティ2', topics:'巨視的・マクロ的パースペクティブとミクロ・微視的パースペクティブ', hours:2},
    ],
    method: [
      {id:'sh-m1', num:'09', name:'量的調査', topics:'質問紙調査、仮説生成、変数設計、統計的検定、標本調査、相関分析', hours:2},
      {id:'sh-m2', num:'10', name:'質的調査', topics:'グランデッド・セオリー、ライフ・ストーリー、インタビュー調査、参与観察、内容分析、言説分析', hours:2},
    ],
    ext: [],
  },
  keiei: {
    base: [
      {id:'jy-b1',  num:'01', name:'組織論導入・企業論',   topics:'組織・企業の諸基礎概念・所有と経営の分離・コーポレートガバナンス', hours:2},
      {id:'jy-b2',  num:'02', name:'組織論',              topics:'古典組織論・新古典組織論', hours:2},
      {id:'jy-b3',  num:'03', name:'近代組織論',           topics:'バーナードの近代組織論・意思決定論・集団浅慮', hours:2},
      {id:'jy-b4',  num:'04', name:'モチベーション論',      topics:'モチベーション内容論・プロセス論', hours:2},
      {id:'jy-b5',  num:'08', name:'全社戦略（上）',        topics:'SWOT分析・製品・市場マトリックス・多角化・PPM理論', hours:2},
      {id:'jy-b6',  num:'09', name:'全社戦略（下）',        topics:'垂直統合・市場取引・戦略的提携・M&A', hours:2},
      {id:'jy-b7',  num:'10', name:'外部競争戦略',          topics:'３つの基本戦略・ブルーオーシャン・競争ポジション・模倣戦略', hours:2},
      {id:'jy-b8',  num:'11', name:'内部競争戦略',          topics:'速度の経済性・RBV・コアコンピタンス・バリューチェーン', hours:2},
      {id:'jy-b9',  num:'15', name:'マーケティング入門',    topics:'マーケティングコンセプト・マーケティングの変遷', hours:2},
      {id:'jy-b10', num:'16', name:'消費者行動論',          topics:'個人消費者の理解・集団消費者の理解', hours:2},
      {id:'jy-b11', num:'17', name:'製品戦略',             topics:'製品の概念と構成・コープランドの製品分類・製品ミックス', hours:2},
      {id:'jy-b12', num:'18', name:'価格戦略',             topics:'価格設定の基本方針・製品ミックスによる価格対応・消費者心理による価格対応', hours:2},
      {id:'jy-b13', num:'19', name:'コミュニケーション戦略', topics:'広告・セールスプロモーション・人的販売とパブリシティ', hours:2},
    ],
    adv: [
      {id:'jy-a1', num:'05', name:'組織構造論',                 topics:'組織構造の基本形態・一般形態・その他の組織形態', hours:2},
      {id:'jy-a2', num:'06', name:'組織文化・変革論',            topics:'組織文化の諸概念・組織学習・組織変革', hours:2},
      {id:'jy-a3', num:'07', name:'リーダーシップ論',            topics:'リーダーシップ資質論・行動論・適応論', hours:2},
      {id:'jy-a4', num:'12', name:'機能別戦略',                 topics:'生産戦略・技術経営', hours:2},
      {id:'jy-a5', num:'13', name:'イノベーション',              topics:'イノベーションの諸概念・イノベーターのジレンマ', hours:2},
      {id:'jy-a6', num:'14', name:'国際戦略',                   topics:'多国籍企業・グローバル統合・ローカル統合・ボーングローバル企業', hours:2},
      {id:'jy-a7', num:'20', name:'流通戦略',                   topics:'流通戦略の諸概念', hours:2},
      {id:'jy-a8', num:'21', name:'サービス・ソーシャル・マーケティング', topics:'サービス・マーケティングの特徴・営利・非営利組織のマーケティング', hours:2},
      {id:'jy-a9', num:'22', name:'関係性マーケティング',         topics:'関係性マーケティングの諸概念・CRM', hours:2},
    ],
    method: [
      {id:'jy-m1', num:'23', name:'量的調査', topics:'質問紙調査、仮説生成、変数設計、統計的検定、標本調査、相関分析', hours:2},
      {id:'jy-m2', num:'24', name:'質的調査', topics:'グランデッド・セオリー、ライフ・ストーリー、インタビュー調査、参与観察、内容分析', hours:2},
    ],
    ext: [],
  },
  keizai: {
    base: [
      {id:'jj-b1', num:'01', name:'消費者①〜④', topics:'偏好・无差别曲线、预算约束・最优选择、拉格朗日法、需求函数・弹性', hours:8},
      {id:'jj-b2', num:'05', name:'生産者①〜④', topics:'生产函数、成本函数、供给函数、图形与均衡', hours:8},
      {id:'jj-b3', num:'09', name:'一般均衡①〜④', topics:'超额需求、消费者余剰、税与死荷重、福利定理', hours:8},
      {id:'jj-b4', num:'13', name:'市場失靈①〜③', topics:'外部性、公共财、Pigou税', hours:6},
      {id:'jj-b5', num:'16', name:'博弈①〜③',   topics:'支配策略・纳什、混合策略、动态博弈', hours:6},
    ],
    adv: [
      {id:'jj-a1', num:'19', name:'消費者⑤⑥', topics:'综合题型、真题演练', hours:4},
      {id:'jj-a2', num:'21', name:'生産者⑤',  topics:'综合与演练', hours:2},
      {id:'jj-a3', num:'22', name:'一般均衡⑤', topics:'综合演练', hours:2},
      {id:'jj-a4', num:'23', name:'市場失靈④', topics:'综合演练', hours:2},
      {id:'jj-a5', num:'24', name:'博弈④⑤',  topics:'应用题、总结', hours:4},
    ],
    method: [],
    ext: [],
  },
};

// 依据专业，按分类顺序生成"默认框架条目"列表。
// 每个条目统一形状：{ category, category_label, name, content, homework, default_hours, sort_order, source:'default' }
function vipBuildDefaultItems(majorKey) {
  const items = [];
  let order = 0;
  const push = (cat, label, name, content, homework, hours) => {
    items.push({
      category: cat, category_label: label,
      name: name || '', content: content || '', homework: homework || '',
      default_hours: (hours != null ? hours : 2), sort_order: order++, source: 'default',
    });
  };
  VIP_CATEGORIES.forEach(c => {
    if (['found','past','eng','plan','apply','inter','ta'].includes(c.key)) {
      (VIP_FIXED_COURSES[c.key] || []).forEach(x => {
        const content = x.detail ? `${x.desc}（${x.detail}）` : (x.desc || '');
        push(c.key, c.label, x.name, content, x.hw, x.defaultHours);
      });
    } else {
      // base/adv/method/ext 来自该专业的子课
      const subj = (VIP_MAJOR_SUBJECTS[majorKey] || {})[c.key] || [];
      subj.forEach(s => {
        const name = s.num ? `${s.num}. ${s.name}` : s.name;
        push(c.key, c.label, name, s.topics || '', '完成课后作业', s.hours);
      });
    }
  });
  return items;
}
