// src/pages/HomePage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  ArrowRight,
  Shield,
  Zap,
  Lock,
  Users,
  BarChart3,
  Database,
  CheckCircle,
  Github,
  Twitter,
  MessageCircle,
  Sparkles,
  Building,
  Target,
  Gift,
  Coins,
  Share2,
  PieChart,
  Languages,
  TrendingUp,
  Layers
} from 'lucide-react';
import '../css/HomePage_dark.css';

// Language translations with updated data economy focus
const translations = {
  en: {
    nav: {
      features: "Features",
      workflow: "How It Works",
      pricing: "Pricing",
      architecture: "Architecture",
      launchApp: "Launch App"
    },
    hero: {
      badge: "Data Economy Infrastructure on Sui & Walrus",
      title1: "Transform Data Into",
      title2: "Economic Assets",
      title3: "The Web3 Data Economy Protocol",
      description: "DataWave builds the infrastructure for a decentralized data economy. Starting with surveys as our first use case, we transform user data into tradeable assets with perpetual value. Users earn from their information, enterprises access authentic insights, and data becomes a new economic paradigm where value flows transparently to its creators.",
      startEarning: "Start Building Data Assets",
      poweredBy: "POWERED BY"
    },
    workflow: {
      badge: "VALUE CREATION",
      title1: "How Data Becomes",
      title2: "Economic Value",
      description: "From raw data to tradeable assets - the complete value transformation journey",
      userPath: "User Value Creation",
      projectPath: "Enterprise Data Access",
      userSteps: [
        { title: "Create Data", desc: "Generate valuable information" },
        { title: "Get Compensated", desc: "Receive instant SUI tokens" },
        { title: "Own Your Assets", desc: "Control your data rights" },
        { title: "Earn Forever", desc: "Collect subscription dividends" }
      ],
      projectSteps: [
        { title: "Request Data", desc: "Define information needs" },
        { title: "Incentivize Creation", desc: "Set competitive rewards" },
        { title: "Access Insights", desc: "Get authentic user data" },
        { title: "Trade Data Assets", desc: "Monetize through subscriptions" }
      ],
      cycleTitle: "Data Economy",
      cycleSubtitle: "Perpetual Value Loop",
      cycleSteps: [
        "Users Create Data",
        "Instant Compensation",
        "Data Becomes Assets",
        "Continuous Returns"
      ]
    },
    features: {
      badge: "CORE PROTOCOL",
      title1: "Building Infrastructure for",
      title2: "Data Economy",
      description: "Beyond surveys - creating a protocol where any data can become an income-generating asset",
      list: [
        {
          title: "Data as Assets",
          description: "Transform any form of data into tradeable economic assets with permanent ownership rights on Walrus"
        },
        {
          title: "True Ownership",
          description: "End-to-end encryption using Seal protocol ensures you control who accesses your data assets"
        },
        {
          title: "Instant Value Transfer",
          description: "Smart contracts on Sui blockchain enable immediate compensation for data creation"
        },
        {
          title: "Data Markets",
          description: "Open marketplace where data value is determined by supply and demand, not corporations"
        },
        {
          title: "Perpetual Income",
          description: "Once created, your data assets generate passive income through subscription models forever"
        },
        {
          title: "Composable Value",
          description: "Data can be combined, filtered, and repackaged to create new economic opportunities"
        }
      ]
    },
    pricing: {
      badge: "ECOSYSTEM PLANS",
      title1: "Join the",
      title2: "Data Economy",
      description: "Choose your role in the data economy - all infrastructure managed by the protocol",
      mostPopular: "Most Popular",
      comingSoon: "Coming Soon",
      note1: "* All data stored permanently on Walrus with guaranteed availability",
      note2: "* Smart contracts ensure transparent and automatic value distribution",
      plans: [
        {
          name: "Data Creator",
          price: "FREE",
          currency: "",
          desc: "Start building your data asset portfolio",
          features: [
            "Create unlimited data assets",
            "Instant SUI token rewards",
            "Full ownership rights",
            "Subscription dividends",
            "Privacy protection"
          ]
        },
        {
          name: "Data Consumer",
          price: "Pay-as-you-go",
          currency: "",
          desc: "Access authentic user insights",
          features: [
            "Create data requests",
            "Set custom incentives",
            "Advanced analytics",
            "API access",
            "Data export features",
            "Bulk processing"
          ]
        },
        {
          name: "Enterprise",
          price: "Custom",
          currency: "",
          desc: "Full protocol integration",
          features: [
            "Unlimited data requests",
            "Priority processing",
            "Dedicated support",
            "Custom integrations",
            "White-label options",
            "Advanced APIs"
          ]
        }
      ]
    },
    useCases: {
      badge: "ECOSYSTEM PARTICIPANTS",
      title: "Everyone Benefits in the Data Economy",
      getStarted: "Get Started",
      comingSoon: "Coming Soon",
      cases: [
        {
          title: "Data Creators",
          benefits: [
            "Transform data into assets",
            "Earn instant compensation",
            "Collect perpetual income",
            "Maintain full ownership"
          ]
        },
        {
          title: "Data Consumers",
          benefits: [
            "Access authentic insights",
            "Direct creator relationships",
            "Market-driven pricing",
            "Verified data quality"
          ]
        },
        {
          title: "Data Traders",
          benefits: [
            "Trade data subscriptions",
            "Create data portfolios",
            "Arbitrage opportunities",
            "Compound value creation"
          ]
        }
      ]
    },
    ecosystem: {
      badge: "TECHNICAL FOUNDATION",
      title: "Protocol-Level Infrastructure",
      description: "Built on cutting-edge Web3 technology to enable the global data economy",
      walrus: {
        title: "Walrus Storage",
        desc: "Permanent data layer",
        detail: "Decentralized storage ensuring your data assets exist forever, independent of any platform"
      },
      seal: {
        title: "Seal Encryption",
        desc: "Selective disclosure",
        detail: "You decide who can access your data assets and under what conditions"
      },
      sui: {
        title: "Sui Blockchain",
        desc: "Economic engine",
        detail: "High-performance blockchain enabling instant micropayments and complex value distribution"
      }
    },
    cta: {
      title1: "Ready to Own Your",
      title2: "Data Economy?",
      description: "Start with surveys today, build your data asset portfolio for tomorrow. Every piece of data you create becomes a permanent income-generating asset.",
      tryNow: "Build Your First Data Asset",
      createFirst: "Explore Data Markets"
    },
    footer: {
      tagline: "Building the data economy infrastructure - where every bit of data has value",
      product: "Product",
      resources: "Resources",
      about: "About",
      features: "Features",
      marketplace: "Data Marketplace",
      launchApp: "Launch App",
      docs: "Documentation",
      api: "API",
      community: "Community",
      support: "Support",
      team: "Team",
      blog: "Blog",
      contact: "Contact",
      rights: "© 2025 DataWave Protocol. All rights reserved.",
      privacy: "Privacy Policy",
      terms: "Terms of Service"
    },
    preview: {
      earnings: "Data Assets",
      earningsDesc: "Create once, earn forever",
      value: "True Ownership",
      valueDesc: "Your data, your control",
      security: "Protocol Security",
      securityDesc: "Decentralized & encrypted"
    }
  },
  zh: {
    nav: {
      features: "功能特性",
      workflow: "工作流程",
      pricing: "参与方式",
      architecture: "技术架构",
      launchApp: "启动应用"
    },
    hero: {
      badge: "基于 Sui 和 Walrus 的数据经济基础设施",
      title1: "构建去中心化",
      title2: "数据经济",
      title3: "让每份数据成为可交易资产",
      description: "DataWave 正在构建去中心化数据经济的基础设施。从问卷调研开始，我们将用户数据转化为可交易的经济资产。用户的每一份数据都能产生持续收益，企业获得真实洞察，数据从被榨取的商品变成用户拥有的资产，实现价值的透明流转。",
      startEarning: "开始构建数据资产",
      poweredBy: "技术支持"
    },
    workflow: {
      badge: "价值创造",
      title1: "数据如何成为",
      title2: "经济价值",
      description: "从原始数据到可交易资产 - 完整的价值转化之旅",
      userPath: "用户价值创造",
      projectPath: "企业数据获取",
      userSteps: [
        { title: "创造数据", desc: "生成有价值的信息" },
        { title: "获得补偿", desc: "即时收到 SUI 代币" },
        { title: "拥有资产", desc: "控制数据权利" },
        { title: "永续收益", desc: "收取订阅分红" }
      ],
      projectSteps: [
        { title: "请求数据", desc: "定义信息需求" },
        { title: "激励创造", desc: "设置竞争性奖励" },
        { title: "访问洞察", desc: "获取真实用户数据" },
        { title: "交易资产", desc: "通过订阅变现" }
      ],
      cycleTitle: "数据经济",
      cycleSubtitle: "永续价值循环",
      cycleSteps: [
        "用户创造数据",
        "即时获得补偿",
        "数据成为资产",
        "持续产生收益"
      ]
    },
    features: {
      badge: "核心协议",
      title1: "构建数据经济的",
      title2: "基础设施",
      description: "不止于问卷 - 创建一个让任何数据都能成为收益资产的协议",
      list: [
        {
          title: "数据资产化",
          description: "将任何形式的数据转化为可交易的经济资产，在 Walrus 上拥有永久所有权"
        },
        {
          title: "真正所有权",
          description: "使用 Seal 协议进行端到端加密，确保你控制谁能访问你的数据资产"
        },
        {
          title: "即时价值转移",
          description: "Sui 区块链智能合约实现数据创造的即时补偿"
        },
        {
          title: "数据市场",
          description: "开放市场中数据价值由供需决定，而非由企业垄断"
        },
        {
          title: "永续收入",
          description: "一旦创建，你的数据资产通过订阅模式永远产生被动收入"
        },
        {
          title: "可组合价值",
          description: "数据可以被组合、过滤和重新打包，创造新的经济机会"
        }
      ]
    },
    pricing: {
      badge: "生态参与",
      title1: "加入",
      title2: "数据经济",
      description: "选择你在数据经济中的角色 - 所有基础设施由协议管理",
      mostPopular: "最受欢迎",
      comingSoon: "即将推出",
      note1: "* 所有数据永久存储在 Walrus 上，保证可用性",
      note2: "* 智能合约确保透明和自动的价值分配",
      plans: [
        {
          name: "数据创造者",
          price: "免费",
          currency: "",
          desc: "开始构建你的数据资产组合",
          features: [
            "创建无限数据资产",
            "即时 SUI 代币奖励",
            "完整所有权",
            "订阅分红",
            "隐私保护"
          ]
        },
        {
          name: "数据消费者",
          price: "按需付费",
          currency: "",
          desc: "访问真实用户洞察",
          features: [
            "创建数据请求",
            "设置自定义激励",
            "高级分析",
            "API 访问",
            "数据导出功能",
            "批量处理"
          ]
        },
        {
          name: "企业方案",
          price: "定制",
          currency: "",
          desc: "完整协议集成",
          features: [
            "无限数据请求",
            "优先处理",
            "专属支持",
            "定制集成",
            "白标选项",
            "高级 API"
          ]
        }
      ]
    },
    useCases: {
      badge: "生态参与者",
      title: "数据经济中每个人都受益",
      getStarted: "立即开始",
      comingSoon: "即将推出",
      cases: [
        {
          title: "数据创造者",
          benefits: [
            "将数据转化为资产",
            "获得即时补偿",
            "收取永续收入",
            "保持完全所有权"
          ]
        },
        {
          title: "数据消费者",
          benefits: [
            "访问真实洞察",
            "直接创作者关系",
            "市场驱动定价",
            "验证数据质量"
          ]
        },
        {
          title: "数据交易者",
          benefits: [
            "交易数据订阅",
            "创建数据投资组合",
            "套利机会",
            "复合价值创造"
          ]
        }
      ]
    },
    ecosystem: {
      badge: "技术基础",
      title: "协议级基础设施",
      description: "基于前沿 Web3 技术构建，支撑全球数据经济",
      walrus: {
        title: "Walrus 存储",
        desc: "永久数据层",
        detail: "去中心化存储确保你的数据资产永远存在，独立于任何平台"
      },
      seal: {
        title: "Seal 加密",
        desc: "选择性披露",
        detail: "你决定谁可以访问你的数据资产以及在什么条件下"
      },
      sui: {
        title: "Sui 区块链",
        desc: "经济引擎",
        detail: "高性能区块链实现即时微支付和复杂价值分配"
      }
    },
    cta: {
      title1: "准备好拥有你的",
      title2: "数据经济了吗？",
      description: "今天从问卷开始，明天构建你的数据资产组合。你创建的每一份数据都成为永久的收益资产。",
      tryNow: "构建首个数据资产",
      createFirst: "探索数据市场"
    },
    footer: {
      tagline: "构建数据经济基础设施 - 让每一比特数据都有价值",
      product: "产品",
      resources: "资源",
      about: "关于",
      features: "功能特性",
      marketplace: "数据市场",
      launchApp: "启动应用",
      docs: "文档",
      api: "API",
      community: "社区",
      support: "支持",
      team: "团队",
      blog: "博客",
      contact: "联系我们",
      rights: "© 2025 DataWave Protocol. 保留所有权利。",
      privacy: "隐私政策",
      terms: "服务条款"
    },
    preview: {
      earnings: "数据资产",
      earningsDesc: "创建一次，永久收益",
      value: "真正所有权",
      valueDesc: "你的数据，你控制",
      security: "协议安全",
      securityDesc: "去中心化加密"
    }
  }
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const [, setActiveFeature] = useState(0);
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  
  const t = translations[language];
  
  // Scroll to top
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Toggle language
  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  };
  
  // Parallax effects
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  
  // Workflow icons - updated for data economy
  const workflowIcons = {
    user: [
      <Database />,
      <Coins />,
      <Shield />,
      <TrendingUp />
    ],
    enterprise: [
      <Target />,
      <Gift />,
      <BarChart3 />,
      <Share2 />
    ]
  };
  
  // Feature icons - updated for protocol features
  const featureIcons = [
    <Layers className="w-6 h-6" />,
    <Shield className="w-6 h-6" />,
    <Zap className="w-6 h-6" />,
    <PieChart className="w-6 h-6" />,
    <TrendingUp className="w-6 h-6" />,
    <Share2 className="w-6 h-6" />
  ];
  
  // Use case icons
  const useCaseIcons = [
    <Users className="w-8 h-8" />,
    <Building className="w-8 h-8" />,
    <BarChart3 className="w-8 h-8" />
  ];

  return (
    <div className="homepage" data-lang={language}>
      {/* Navigation Bar */}
      <nav className="nav-bar">
        <div className="nav-container">
          <div className="nav-brand">
            <img 
              src="/logo_white.webp" 
              alt="DataWave" 
              className="brand-logo" 
              onClick={scrollToTop}
              style={{ cursor: 'pointer' }}
            />
          </div>
          
          <div className="nav-menu">
            <a href="#features" className="nav-link">{t.nav.features}</a>
            <a href="#workflow" className="nav-link">{t.nav.workflow}</a>
            <a href="#pricing" className="nav-link">{t.nav.pricing}</a>
            <a href="#ecosystem" className="nav-link">{t.nav.architecture}</a>
          </div>
          
          <div className="nav-actions">
            <button className="btn-language" onClick={toggleLanguage}>
              <Languages className="w-4 h-4" />
              {language === 'en' ? 'ZH' : 'EN'}
            </button>
            <button className="btn-outline" onClick={() => navigate('/app/marketplace')}>
              {t.nav.launchApp}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg">
          <motion.div className="floating-orb orb-1" style={{ y: y1 }} />
          <motion.div className="floating-orb orb-2" style={{ y: y2 }} />
          <div className="grid-pattern" />
        </div>
        
        <div className="hero-container">
          <motion.div 
            className="hero-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="hero-badge">
              <Sparkles className="w-4 h-4" />
              <span>{t.hero.badge}</span>
            </div>
            
            <h1 className="hero-title">
              {t.hero.title1}
              <span className="gradient-text"> {t.hero.title2}</span>
              <br />
              {t.hero.title3}
            </h1>
            
            <p className="hero-description">
              {t.hero.description}
            </p>
            
            <div className="hero-cta">
              <button className="btn-primary large" onClick={() => navigate('/app/marketplace')}>
                {t.hero.startEarning}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            
            {/* Tech Stack */}
            <div className="tech-stack">
              <span className="tech-label">{t.hero.poweredBy}</span>
              <div className="tech-logos">
                <span className="tech-name">Walrus</span>
                <span className="tech-name">Sui</span>
                <span className="tech-name">Seal</span>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="hero-visual"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="platform-preview">
              <div className="preview-card active">
                <div className="preview-icon">
                  <Layers className="w-8 h-8" />
                </div>
                <h4>{t.preview.earnings}</h4>
                <p>{t.preview.earningsDesc}</p>
              </div>
              <div className="preview-card">
                <div className="preview-icon">
                  <Shield className="w-8 h-8" />
                </div>
                <h4>{t.preview.value}</h4>
                <p>{t.preview.valueDesc}</p>
              </div>
              <div className="preview-card">
                <div className="preview-icon">
                  <Lock className="w-8 h-8" />
                </div>
                <h4>{t.preview.security}</h4>
                <p>{t.preview.securityDesc}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="workflow-section">
        <div className="container">
          <div className="section-header">
            <div className="section-badge">{t.workflow.badge}</div>
            <h2 className="section-title">
              {t.workflow.title1}
              <span className="gradient-text"> {t.workflow.title2}</span>
            </h2>
            <p className="section-description">
              {t.workflow.description}
            </p>
          </div>
          
          <div className="workflow-container">
            {/* User workflow */}
            <div className="workflow-track">
              <h3 className="workflow-title">
                <Users className="w-5 h-5" />
                {t.workflow.userPath}
              </h3>
              <div className="workflow-steps">
                {t.workflow.userSteps.map((step, index) => (
                  <motion.div
                    key={index}
                    className="workflow-step"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <div className="step-number">{index + 1}</div>
                    <div className="step-icon">{workflowIcons.user[index]}</div>
                    <div className="step-content">
                      <h4>{step.title}</h4>
                      <p>{step.desc}</p>
                    </div>
                    {index < t.workflow.userSteps.length - 1 && (
                      <ArrowRight className="step-arrow" />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* Project workflow */}
            <div className="workflow-track">
              <h3 className="workflow-title">
                <Building className="w-5 h-5" />
                {t.workflow.projectPath}
              </h3>
              <div className="workflow-steps">
                {t.workflow.projectSteps.map((step, index) => (
                  <motion.div
                    key={index}
                    className="workflow-step"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <div className="step-number">{index + 1}</div>
                    <div className="step-icon">{workflowIcons.enterprise[index]}</div>
                    <div className="step-content">
                      <h4>{step.title}</h4>
                      <p>{step.desc}</p>
                    </div>
                    {index < t.workflow.projectSteps.length - 1 && (
                      <ArrowRight className="step-arrow" />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* Value Cycle */}
            <div className="value-cycle">
              <div className="cycle-center">
                <h4>{t.workflow.cycleTitle}</h4>
                <p>{t.workflow.cycleSubtitle}</p>
              </div>
              {t.workflow.cycleSteps.map((step, index) => (
                <div key={index} className={`cycle-item item-${index + 1}`}>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header">
            <div className="section-badge">{t.features.badge}</div>
            <h2 className="section-title">
              {t.features.title1}
              <span className="gradient-text"> {t.features.title2}</span>
            </h2>
            <p className="section-description">
              {t.features.description}
            </p>
          </div>
          
          <div className="features-grid">
            {t.features.list.map((feature, index) => (
              <motion.div
                key={index}
                className="feature-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                onHoverStart={() => setActiveFeature(index)}
              >
                <div className="feature-icon">
                  {featureIcons[index]}
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - Updated for Data Economy */}
      <section id="pricing" className="pricing-section">
        <div className="container">
          <div className="section-header">
            <div className="section-badge">{t.pricing.badge}</div>
            <h2 className="section-title">
              {t.pricing.title1}
              <span className="gradient-text"> {t.pricing.title2}</span>
            </h2>
            <p className="section-description">
              {t.pricing.description}
            </p>
          </div>
          
          <div className="pricing-grid">
            {t.pricing.plans.map((plan, index) => (
              <motion.div
                key={index}
                className={`pricing-card ${index === 0 ? 'popular' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 }}
                viewport={{ once: true }}
              >
                {index === 0 && (
                  <div className="popular-badge">{t.pricing.mostPopular}</div>
                )}
                <div className="pricing-header">
                  <h3 className="plan-name">{plan.name}</h3>
                  <div className="plan-price">
                    <span className="price-value">{plan.price}</span>
                    <span className="price-currency">{plan.currency}</span>
                  </div>
                  <p className="plan-desc">{plan.desc}</p>
                </div>
                <ul className="plan-features">
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  className={`plan-btn ${index === 0 ? 'primary' : 'outline'}`}
                  onClick={() => navigate('/app/marketplace')}
                >
                  {index === 0 ? t.useCases.getStarted : t.pricing.comingSoon}
                </button>
              </motion.div>
            ))}
          </div>
          
          <div className="pricing-note">
            <p>{t.pricing.note1}</p>
            <p>{t.pricing.note2}</p>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="use-cases-section">
        <div className="container">
          <div className="section-header">
            <div className="section-badge">{t.useCases.badge}</div>
            <h2 className="section-title">{t.useCases.title}</h2>
          </div>
          
          <div className="use-cases-grid">
            {t.useCases.cases.map((useCase, index) => (
              <motion.div
                key={index}
                className={`use-case-card ${['blue', 'purple', 'green'][index]}`}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.15 }}
                viewport={{ once: true }}
              >
                <div className="use-case-icon">{useCaseIcons[index]}</div>
                <h3 className="use-case-title">{useCase.title}</h3>
                <ul className="use-case-benefits">
                  {useCase.benefits.map((benefit, idx) => (
                    <li key={idx}>
                      <CheckCircle className="w-4 h-4" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  className="use-case-cta"
                  onClick={() => navigate('/app/marketplace')}
                >
                  {t.useCases.getStarted}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Ecosystem Section */}
      <section id="ecosystem" className="ecosystem-section">
        <div className="container">
          <div className="section-header">
            <div className="section-badge">{t.ecosystem.badge}</div>
            <h2 className="section-title">{t.ecosystem.title}</h2>
            <p className="section-description">
              {t.ecosystem.description}
            </p>
          </div>
          
          <div className="ecosystem-diagram">
            <div className="ecosystem-center">
              <div className="ecosystem-core">
                <img src="/logo_white.webp" alt="DataWave" className="core-logo" />
              </div>
            </div>
            
            <div className="ecosystem-ring">
              <div className="ecosystem-node node-1">
                <div className="node-content">
                  <Database className="w-6 h-6" />
                  <span>{t.ecosystem.walrus.title}</span>
                  <p className="node-desc">{t.ecosystem.walrus.desc}</p>
                </div>
              </div>
              <div className="ecosystem-node node-2">
                <div className="node-content">
                  <Lock className="w-6 h-6" />
                  <span>{t.ecosystem.seal.title}</span>
                  <p className="node-desc">{t.ecosystem.seal.desc}</p>
                </div>
              </div>
              <div className="ecosystem-node node-3">
                <div className="node-content">
                  <Zap className="w-6 h-6" />
                  <span>{t.ecosystem.sui.title}</span>
                  <p className="node-desc">{t.ecosystem.sui.desc}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="tech-details">
            <div className="tech-card">
              <h4>Walrus</h4>
              <p>{t.ecosystem.walrus.detail}</p>
            </div>
            <div className="tech-card">
              <h4>Sui</h4>
              <p>{t.ecosystem.sui.detail}</p>
            </div>
            <div className="tech-card">
              <h4>Seal</h4>
              <p>{t.ecosystem.seal.detail}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <motion.div 
            className="cta-card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="cta-title">
              {t.cta.title1}
              <span className="gradient-text"> {t.cta.title2}</span>
            </h2>
            <p className="cta-description">
              {t.cta.description}
            </p>
            <div className="cta-buttons">
              <button className="btn-primary large" onClick={() => navigate('/app/marketplace')}>
                {t.cta.tryNow}
                <ArrowRight className="w-5 h-5" />
              </button>
              <button className="btn-outline large" onClick={() => navigate('/app/marketplace')}>
                {t.cta.createFirst}
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-logo">
                <img src="/logo_white.webp" alt="DataWave" className="footer-logo-img" />
              </div>
              <p className="footer-tagline">
                {t.footer.tagline}
              </p>
              <div className="social-links">
                <a href="#"><Github className="w-5 h-5" /></a>
                <a href="#"><Twitter className="w-5 h-5" /></a>
                <a href="#"><MessageCircle className="w-5 h-5" /></a>
              </div>
            </div>
            
            <div className="footer-column">
              <h4>{t.footer.product}</h4>
              <ul>
                <li><a href="#features">{t.footer.features}</a></li>
                <li><a onClick={() => navigate('/app/marketplace')}>{t.footer.marketplace}</a></li>
                <li><a onClick={() => navigate('/app/marketplace')}>{t.footer.launchApp}</a></li>
              </ul>
            </div>
            
            <div className="footer-column">
              <h4>{t.footer.resources}</h4>
              <ul>
                <li><a href="#">{t.footer.docs}</a></li>
                <li><a href="#">{t.footer.api}</a></li>
                <li><a href="#">{t.footer.community}</a></li>
                <li><a href="#">{t.footer.support}</a></li>
              </ul>
            </div>
            
            <div className="footer-column">
              <h4>{t.footer.about}</h4>
              <ul>
                <li><a href="#">{t.footer.team}</a></li>
                <li><a href="#">{t.footer.blog}</a></li>
                <li><a href="#">{t.footer.contact}</a></li>
              </ul>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>{t.footer.rights}</p>
            <div className="footer-links">
              <a href="#">{t.footer.privacy}</a>
              <a href="#">{t.footer.terms}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;