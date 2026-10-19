import json, os

scenarios = []

def add(id, zh, en, icon, desc_zh, desc_en, cat, diffs, ai, user, skills, terms, mins, tags):
    scenarios.append({
        "id": id, "title_zh": zh, "title_en": en, "icon": icon,
        "description_zh": desc_zh, "description_en": desc_en,
        "category": cat, "difficulty_levels": diffs,
        "ai_role": ai, "user_role": user,
        "key_skills": skills, "industry_terms_sample": terms,
        "estimated_minutes": mins, "tags": tags
    })

# 00-概览
add("shoe-upper-overview-01","鞋面纺织产业链概述","Shoe Upper Textile Industry Chain Overview","industry",
    "向客户介绍鞋面纺织从化纤抽丝到品牌工艺的完整产业链，解释各环节的关系和核心价值",
    "Introduce the complete industry chain of shoe upper textiles from fiber extrusion to brand finishing",
    "overview",["beginner","intermediate","advanced"],
    "鞋面纺织行业资深顾问","新入职的鞋面采购助理",
    ["行业术语解释","产业链流程描述","上下游关系说明"],
    ["上游产业链 upstream industry chain","中游加工 midstream processing","下游品牌 downstream brand","化纤抽丝 fiber extrusion","纺纱 spinning","织造 weaving","染整 dyeing and finishing","成型贴合 forming and lamination"],
    15,["overview","industry-chain","beginners"])

add("shoe-upper-overview-02","鞋面材料选型咨询","Shoe Upper Material Selection Consultation","material",
    "客户需要为运动鞋选择鞋面材料，你作为顾问根据其需求推荐合适的织造工艺和材料组合",
    "A client needs to select upper materials for sports shoes. As a consultant, recommend suitable processes",
    "overview",["intermediate","advanced"],
    "鞋面材料技术顾问","品牌方产品开发经理",
    ["材料性能对比","工艺推荐","成本分析","应用场景匹配"],
    ["飞织 knitted upper","经编 warp knitting","纬编 weft knitting","梭织 woven","透气性 breathability","轻量化 lightweight","耐磨性 abrasion resistance","弹性 elasticity"],
    20,["overview","material-selection","product-development"])

# 01-化纤抽丝
add("shoe-upper-fiber-01","涤纶POY/FDY/DTY规格洽谈","Polyester POY/FDY/DTY Specification Negotiation","fiber",
    "与化纤厂采购涤纶长丝，讨论POY、FDY、DTY的不同规格参数和价格差异",
    "Purchasing polyester filament from a chemical fiber factory, discussing specifications and prices of POY, FDY, and DTY",
    "fiber-extrusion",["intermediate","advanced"],
    "化纤厂销售经理","鞋材厂采购经理",
    ["化纤规格谈判","价格议价","技术参数确认","订单条款协商"],
    ["POY Partially Oriented Yarn 预取向丝","FDY Fully Drawn Yarn 全拉伸丝","DTY Draw Textured Yarn 拉伸变形丝","denier 旦尼尔","filament count 丝数","tenacity 强度","elongation 伸长率","shrinkage 收缩率"],
    20,["fiber","polyester","procurement","negotiation"])

add("shoe-upper-fiber-02","锦纶PA6与PA66采购对比","Nylon PA6 vs PA66 Procurement Comparison","nylon",
    "评估锦纶PA6和PA66在鞋面应用中的差异，与供应商沟通技术指标和价格，做出采购决策",
    "Evaluate the differences between Nylon PA6 and PA66 in upper applications",
    "fiber-extrusion",["advanced"],
    "锦纶生产商技术销售","鞋面织造厂研发主管",
    ["材料性能评估","技术参数对比","成本效益分析","应用匹配"],
    ["PA6 Nylon 6 锦纶6","PA66 Nylon 66 锦纶66","melting point 熔点","abrasion resistance 耐磨性","moisture regain 回潮率","heat resistance 耐热性","chemical resistance 耐化学性"],
    20,["fiber","nylon","material-comparison","r-and-d"])

# 02-纺纱
add("shoe-upper-spinning-01","包芯纱规格确认与报价","Core-Spun Yarn Specification Confirmation and Quotation","yarn",
    "向纺纱厂询价包芯纱，确认芯丝材质、外包纤维比例、纱支等关键参数",
    "Requesting a quotation for core-spun yarn from a spinning mill",
    "spinning",["intermediate","advanced"],
    "纺纱厂业务经理","鞋面织造厂采购",
    ["纱线规格沟通","询价流程","参数确认","样品索取"],
    ["core-spun yarn 包芯纱","sheath fiber 外包纤维","core filament 芯丝","yarn count 纱支","spandex core 氨纶芯","polyester core 涤纶芯","twist per inch 每英寸捻度"],
    15,["spinning","yarn","quotation","procurement"])

# 03-经编
add("shoe-upper-warpknit-01","经编鞋面网布开发沟通","Warp Knit Upper Mesh Development Communication","warpknit",
    "与经编厂讨论鞋面网布的规格开发，包括网眼大小、纱线粗细和组织结构选择",
    "Discuss upper mesh development specifications with a warp knitting factory",
    "warp-knitting",["intermediate","advanced"],
    "经编厂技术主管","品牌方开发工程师",
    ["经编工艺理解","网眼规格沟通","组织结构选择","样品确认"],
    ["warp knitting 经编","tricot 特里科经编","raschel 拉舍尔经编","mesh fabric 网眼布","loop formation 成圈","guide bar 导纱梳栉","runner length 送经量","open mesh 开口网眼"],
    20,["warp-knitting","mesh","development","specification"])

add("shoe-upper-warpknit-02","经编鞋面强力问题处理","Warp Knit Upper Strength Issue Resolution","strength",
    "经编鞋面出现撕裂强力不足的问题，与供应商分析原因并讨论改善方案",
    "The warp knit upper has insufficient tear strength. Analyze the root cause with the supplier",
    "warp-knitting",["advanced"],
    "经编厂质量经理","品牌方QA工程师",
    ["问题分析","改善方案讨论","原材料调整建议","测试验证确认"],
    ["tear strength 撕裂强力","tensile strength 拉伸强度","bursting strength 顶破强力","yarn linear density 纱线线密度","loop density 线圈密度","finishing agent 整理剂","heat setting 热定型"],
    20,["warp-knitting","strength","quality","resolution"])

# 04-纬编
add("shoe-upper-weftknit-01","提花纬编鞋面开发沟通","Jacquard Weft Knit Upper Development Communication","jacquard",
    "与纬编厂讨论提花鞋面的图案设计、纱线配色和组织结构开发",
    "Discussing jacquard upper pattern design, yarn color matching, and structure development",
    "weft-knitting",["intermediate","advanced"],
    "纬编厂研发工程师","品牌方产品开发专员",
    ["提花工艺理解","配色沟通","图案设计讨论","样品确认"],
    ["jacquard knitting 提花编织","weft knitting 纬编","circular knitting 圆机编织","flat knitting 横机编织","color jacquard 彩色提花","structural jacquard 结构提花","intarsia 嵌花","float stitch 浮线"],
    20,["weft-knitting","jacquard","development","design"])

add("shoe-upper-weftknit-02","纬编面料手感与性能调整","Weft Knit Fabric Hand Feel and Performance Adjustment","fabric",
    "客户反馈纬编面料手感偏硬、延伸性不足，与工厂沟通调整工艺参数改善性能",
    "A client reports that the weft knit fabric feels too stiff and lacks extensibility",
    "weft-knitting",["intermediate"],
    "纬编厂工艺技术员","鞋面贸易公司QC",
    ["手感评价","工艺调整沟通","性能测试确认","改进方案制定"],
    ["hand feel 手感","drape 悬垂性","stretch 延伸性","recovery 回复性","loop length 线圈长度","tightness factor 紧密系数","fabric weight 面料克重","finishing 后整理"],
    15,["weft-knitting","fabric","quality","adjustment"])

# 05-梭织
add("shoe-upper-woven-01","高密梭织鞋面打样确认","High-Density Woven Upper Sampling Confirmation","woven",
    "与梭织厂确认高密度鞋面布的打样要求，包括经纬密度、纱线规格和组织结构",
    "Confirming sampling requirements for high-density woven upper fabric with a weaving mill",
    "woven",["intermediate","advanced"],
    "梭织厂业务跟单","品牌方采购专员",
    ["梭织参数沟通","打样流程确认","规格核对","交期跟踪"],
    ["woven fabric 梭织面料","warp 经纱","weft 纬纱","ends per inch 经密","picks per inch 纬密","weave structure 织物组织","plain weave 平纹","twill weave 斜纹","satin weave 缎纹"],
    15,["woven","sampling","specification","order"])

add("shoe-upper-woven-02","梭织鞋面耐磨性能改善","Woven Upper Abrasion Resistance Improvement","durability",
    "梭织鞋面耐磨测试未通过，与供应商讨论改进方案，包括纱线选择和涂层处理",
    "The woven upper failed the abrasion resistance test. Discuss improvement solutions with the supplier",
    "woven",["advanced"],
    "梭织厂技术经理","品牌方QA工程师",
    ["测试标准讨论","改进方案制定","材料替代建议","成本影响评估"],
    ["abrasion resistance 耐磨性","Martindale test 马丁代尔测试","Taber test 泰伯测试","coating 涂层","PU coating 聚氨酯涂层","yarn strength 纱线强度","high tenacity yarn 高强度纱线","ripstop 防撕裂"],
    20,["woven","durability","testing","quality"])

# 06-飞织
add("shoe-upper-knitted-01","飞织鞋面设计稿评审","Knitted Upper Design Review","design",
    "品牌方设计师提交飞织鞋面设计稿，与飞织厂讨论工艺可行性、纱线选择和成本控制",
    "A brand designer submits a knitted upper design draft. Discuss process feasibility",
    "knitted",["intermediate","advanced"],
    "飞织厂工艺工程师","品牌方鞋类设计师",
    ["设计可行性评估","工艺建议","纱线推荐","成本估算"],
    ["knitted upper 飞织鞋面","3D knitting 3D编织","jacquard pattern 提花图案","yarn path 纱线路径","stitch density 编织密度","color block 色块拼接","gradient effect 渐变效果","texture pattern 纹理图案"],
    20,["knitted","design","review","development"])

add("shoe-upper-knitted-02","飞织工艺参数设置讨论","Knitting Process Parameter Discussion","parameters",
    "与飞织厂技术员讨论工艺参数设置，包括纱嘴数、编织速度、牵拉张力等对鞋面品质的影响",
    "Discuss process parameter settings with the knitting factory technician",
    "knitted",["advanced"],
    "飞织厂技术主管","鞋面生产厂长",
    ["工艺参数理解","品质影响因素分析","生产效率优化","问题排查"],
    ["feeder count 纱嘴数","knitting speed 编织速度","take-down tension 牵拉张力","yarn tension 纱线张力","stitch cam setting 三角设置","rack 摇床","needle selection 选针","presser foot 压脚"],
    20,["knitted","process","parameters","production"])

add("shoe-upper-knitted-03","飞织样品确认与修改","Knitted Sample Confirmation and Modification","sample",
    "收到飞织样品后发现问题，与工厂沟通修改方案，包括尺寸调整、花型修正和手感优化",
    "After receiving the knitted sample, issues are found. Communicate modification plans",
    "knitted",["intermediate"],
    "飞织厂业务经理","品牌方产品经理",
    ["样品评估","修改沟通","问题描述","二次确认"],
    ["sample confirmation 样品确认","fit sample 试穿样品","size adjustment 尺寸调整","pattern correction 花型修正","yarn replacement 纱线更换","color fastness 色牢度","hand feel optimization 手感优化","revised sample 修改样"],
    15,["knitted","sample","modification","confirmation"])

# 07-染整
add("shoe-upper-dyeing-01","鞋面染色色牢度要求沟通","Upper Dyeing Color Fastness Requirements Communication","dyeing",
    "与染厂沟通鞋面材料的色牢度要求，包括耐摩擦、耐汗渍、耐光色牢度等指标",
    "Communicate color fastness requirements for upper materials with the dyeing factory",
    "dyeing-finishing",["intermediate","advanced"],
    "染厂技术经理","品牌方QA经理",
    ["色牢度标准理解","测试方法沟通","染色工艺讨论","品质标准确认"],
    ["color fastness 色牢度","crocking 耐摩擦","perspiration fastness 耐汗渍","light fastness 耐光色牢度","washing fastness 耐洗色牢度","staining 沾色","color change 变色","AATCC 美国纺织化学师与印染师协会标准"],
    20,["dyeing","color-fastness","quality","standards"])

add("shoe-upper-dyeing-02","染色对色与色差控制","Color Matching and Shade Control","color",
    "与染厂对色员沟通颜色标准，讨论色差控制标准和可接受的色差范围",
    "Communicate color standards with the dyeing factory color matcher",
    "dyeing-finishing",["intermediate"],
    "染厂对色主管","鞋面贸易公司QC",
    ["颜色标准沟通","色差判定","光源条件确认","批次一致性控制"],
    ["color matching 对色","shade band 色卡","D65 light source D65光源","TL84 light source TL84光源","delta E 色差值","spectrophotometer 分光光度计","batch-to-batch consistency 批次一致性","lab dip 打色样"],
    15,["dyeing","color-matching","quality-control","production"])

# 08-成型与贴合
add("shoe-upper-lamination-01","热压贴合工艺参数确认","Heat Press Lamination Process Parameter Confirmation","lamination",
    "与贴合厂确认热压贴合工艺参数，包括温度、压力、时间对贴合强度的影响",
    "Confirm heat press lamination process parameters with the lamination factory",
    "forming-lamination",["intermediate","advanced"],
    "贴合厂工艺工程师","鞋面厂生产主管",
    ["贴合工艺理解","参数优化讨论","品质标准确认","问题排查"],
    ["heat press lamination 热压贴合","hot melt adhesive 热熔胶","TPU film TPU薄膜","EVA foam EVA泡棉","bonding strength 贴合强度","peel strength 剥离强度","temperature profile 温度曲线","pressure distribution 压力分布"],
    20,["lamination","process","parameters","production"])

add("shoe-upper-lamination-02","无缝鞋面技术方案讨论","Seamless Upper Technology Discussion","seamless",
    "与供应商讨论无缝鞋面技术的实现方案，包括热压成型、高频焊接等工艺选择",
    "Discuss seamless upper technology solutions with the supplier",
    "forming-lamination",["advanced"],
    "无缝鞋面技术顾问","品牌方研发总监",
    ["技术方案评估","工艺对比","成本效益分析","应用前景讨论"],
    ["seamless upper 无缝鞋面","heat forming 热压成型","high frequency welding 高频焊接","ultrasonic welding 超声波焊接","bonding 粘合","die cutting 模切","lasting 套帮","molding 成型"],
    20,["lamination","seamless","technology","r-and-d"])

# 09-装饰与表面
add("shoe-upper-decoration-01","鞋面数码印花打样沟通","Digital Printing Sampling Communication for Uppers","printing",
    "与印花厂沟通鞋面数码印花的打样要求，包括图案精度、色彩还原和牢度要求",
    "Communicate digital printing sampling requirements for uppers with the printing factory",
    "decoration-surface",["intermediate"],
    "数码印花厂技术员","品牌方平面设计师",
    ["印花工艺理解","色彩管理沟通","图案精度确认","样品要求说明"],
    ["digital printing 数码印花","sublimation printing 热转印","direct-to-fabric printing 直喷印花","color profile 色彩配置文件","resolution 分辨率","color gamut 色域","ink type 墨水类型","pretreatment 预处理"],
    15,["decoration","printing","sampling","design"])

add("shoe-upper-decoration-02","鞋面装饰工艺选择咨询","Shoe Upper Decoration Process Selection Consultation","decoration",
    "品牌方咨询鞋面装饰工艺方案，比较烫钻、刺绣、滴塑、热转印等不同工艺的效果和成本",
    "A brand consults on upper decoration process options",
    "decoration-surface",["intermediate"],
    "鞋面装饰工艺顾问","品牌方产品经理",
    ["装饰工艺比较","效果评估","成本分析","工艺推荐"],
    ["embroidery 刺绣","heat transfer 热转印","screen printing 丝网印刷","drip molding 滴塑","rhinestone 烫钻","laser engraving 激光雕刻","embossing 压花","debossing 压凹"],
    15,["decoration","process","consultation","design"])

# 10-辅料
add("shoe-upper-accessories-01","鞋舌与里料采购洽谈","Tongue and Lining Material Procurement Negotiation","accessories",
    "采购鞋舌和里料，与供应商讨论材料规格、舒适性要求和价格条款",
    "Purchasing tongue and lining materials, discussing material specifications and pricing terms",
    "accessories",["intermediate"],
    "辅料供应商销售经理","鞋厂采购经理",
    ["辅料规格沟通","舒适性要求确认","价格谈判","订单条款协商"],
    ["tongue 鞋舌","lining 里料","mesh lining 网眼里料","foam padding 泡棉填充","heel counter 后跟衬","toe cap 鞋头衬","collar padding 领口泡棉","sock liner 鞋垫"],
    15,["accessories","procurement","negotiation","order"])

add("shoe-upper-accessories-02","BOA鞋带系统导入讨论","BOA Lacing System Implementation Discussion","boa",
    "与BOA供应商讨论鞋带系统在鞋面中的集成方案，包括安装位置、耐用性和成本",
    "Discuss the integration of the BOA lacing system in uppers with the BOA supplier",
    "accessories",["advanced"],
    "BOA系统技术代表","品牌方开发经理",
    ["系统集成讨论","耐用性评估","安装工艺确认","成本分析"],
    ["BOA lacing system BOA系带系统","dial 旋钮","lace 钢丝绳","lace guide 导线扣","eyestay 鞋眼片","quick release 快速释放","tension adjustment 张力调节","durability test 耐久性测试"],
    20,["accessories","boa","lacing","development"])

# 11-标杆品牌工艺
add("shoe-upper-brand-nike-01","Nike Flyknit工艺分析","Nike Flyknit Technology Analysis","nike",
    "分析Nike Flyknit鞋面的工艺特点，讨论如何在生产中借鉴其轻量化和无缝编织技术",
    "Analyze the process characteristics of Nike Flyknit uppers",
    "brand-benchmark",["advanced"],
    "鞋面技术研究员","鞋面厂研发经理",
    ["竞品分析","技术特点总结","工艺借鉴讨论","可行性评估"],
    ["Flyknit 飞线编织","lightweight 轻量化","seamless knitting 无缝编织","targeted support 定向支撑","breathable zones 透气区域","yarn fusion 纱线融合","single-piece construction 一体成型","Flywire 飞线技术"],
    20,["brand","nike","benchmark","flyknit"])

add("shoe-upper-brand-adidas-01","Adidas Primeknit技术对比","Adidas Primeknit Technology Comparison","adidas",
    "对比Adidas Primeknit与Nike Flyknit的技术差异，讨论不同编织结构对性能的影响",
    "Compare the technical differences between Adidas Primeknit and Nike Flyknit",
    "brand-benchmark",["advanced"],
    "运动鞋技术顾问","品牌方产品总监",
    ["技术对比分析","性能差异评估","工艺创新讨论","趋势研判"],
    ["Primeknit 普莱姆编织","knit structure 编织结构","stitch type 线圈类型","gauge density 针数密度","yarn blend 纱线混纺","TPU reinforcement TPU加固","heat-bonded 热粘合","4D knit 4D编织"],
    20,["brand","adidas","benchmark","primeknit"])

add("shoe-upper-brand-chinese-01","国潮品牌鞋面工艺趋势讨论","Chinese Brand Upper Technology Trends Discussion","chinese-brand",
    "分析安踏、李宁、特步等国潮品牌在鞋面材料上的创新，讨论如何借鉴其成功经验",
    "Analyze the upper material innovations of Chinese brands like Anta, Li-Ning, and Xtep",
    "brand-benchmark",["advanced"],
    "鞋面市场分析师","品牌方战略规划经理",
    ["市场趋势分析","品牌策略讨论","技术创新评估","应用前景判断"],
    ["Anta 安踏","Li-Ning 李宁","Xtep 特步","basketball shoe upper 篮球鞋鞋面","running shoe upper 跑鞋鞋面","knitted technology 编织技术","mono mesh 单丝网布","TPU hot melt TPU热熔"],
    20,["brand","chinese","benchmark","trends"])

# 14-检测与标准
add("shoe-upper-testing-01","鞋面物理性能测试标准讨论","Shoe Upper Physical Performance Test Standards Discussion","testing",
    "与第三方检测机构讨论鞋面物理性能的测试标准，包括耐磨、耐折、剥离强度等",
    "Discuss physical performance test standards for shoe uppers with a third-party testing lab",
    "testing-standards",["intermediate","advanced"],
    "第三方检测机构技术顾问","品牌方QA主管",
    ["测试标准理解","测试方法讨论","结果判定沟通","品质标准建立"],
    ["abrasion resistance 耐磨性","flexing resistance 耐折性","peel strength 剥离强度","bond strength 粘合强度","color fastness to rubbing 耐摩擦色牢度","hydrolysis resistance 耐水解性","UV resistance 耐紫外线性"],
    20,["testing","standards","quality","compliance"])

add("shoe-upper-testing-02","鞋面化学物质限制要求沟通","Chemical Restriction Requirements Communication for Uppers","chemical",
    "与供应商沟通鞋面材料的化学物质限制要求，包括REACH、RoHS等法规合规性",
    "Communicate chemical restriction requirements for upper materials with the supplier",
    "testing-standards",["advanced"],
    "合规检测专家","品牌方合规经理",
    ["法规理解","限用物质清单沟通","测试报告审核","合规方案制定"],
    ["REACH 欧盟化学品注册、评估、授权和限制法规","RoHS 有害物质限制指令","SVHC 高度关注物质","PFAS 全氟和多氟烷基物质","formaldehyde 甲醛","azo dyes 偶氮染料","heavy metals 重金属","phthalates 邻苯二甲酸酯"],
    20,["testing","chemical","compliance","regulations"])

# 15-可持续与未来
add("shoe-upper-sustainability-01","再生纤维(rPET)鞋面材料采购","Recycled Fiber (rPET) Upper Material Procurement","recycle",
    "向供应商询价再生涤纶rPET纤维，讨论回收比例、品质指标和环保认证要求",
    "Requesting quotations for recycled polyester rPET fiber from suppliers",
    "sustainability",["intermediate","advanced"],
    "再生纤维供应商销售经理","品牌方可持续发展专员",
    ["环保材料知识","认证标准沟通","品质评估","成本分析"],
    ["rPET 再生涤纶","recycled polyester 再生聚酯","GRS certification 全球回收标准认证","post-consumer waste 消费后废弃物","pre-consumer waste 消费前废弃物","traceability 可追溯性","mass balance 质量平衡","carbon footprint 碳足迹"],
    20,["sustainability","recycled","eco-friendly","rpet"])

add("shoe-upper-sustainability-02","环保认证与绿色供应链沟通","Eco-Certification and Green Supply Chain Communication","eco",
    "与供应商讨论鞋面材料的环保认证要求，包括OEKO-TEX、Bluesign等认证的申请流程和成本",
    "Discuss eco-certification requirements for upper materials with the supplier",
    "sustainability",["advanced"],
    "环保认证顾问","品牌方合规经理",
    ["认证标准理解","合规流程沟通","成本评估","供应链管理"],
    ["OEKO-TEX Standard 100 国际环保纺织协会标准100","Bluesign 蓝标认证","GOTS 全球有机纺织品标准","ZDHC 零排放危险化学品","sustainable sourcing 可持续采购","circular economy 循环经济","biodegradable 可生物降解","LCA Life Cycle Assessment 生命周期评估"],
    20,["sustainability","certification","green","compliance"])

# Write file
output_path = "e:/00.ai/00.project/10.HTalk/content/shoe-upper/scenarios.json"
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(scenarios, f, ensure_ascii=False, indent=2)

print(f"Generated {len(scenarios)} scenarios")
print(f"File written to: {output_path}")
