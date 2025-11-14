// src/pages/HomePage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Lock,
  Users,
  BarChart3,
  Database,
  Award,
  CheckCircle,
  TrendingUp,
  Layers,
  Code,
  DollarSign,
  Activity,
  Star,
  ChevronRight,
  Play,
  Github,
  Twitter,
  MessageCircle,
  FileText,
  Sparkles,
  Building,
  CreditCard,
  UserCheck,
  Target,
  Gift,
  Coins,
  Share2,
  PieChart,
  ArrowDown,
  Wallet,
  FileQuestion,
  TrendingDown,
  Clock,
  Languages
} from 'lucide-react';
import '../css/HomePage_dark.css';

// Language translations
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
      badge: "Decentralized Survey Platform on Sui",
      title1: "Create Real Value",
      title2: "From Data",
      title3: "Survey Research Platform",
      description: "DataWave is the first decentralized survey platform in the Sui ecosystem, connecting projects with users through blockchain technology for fair value distribution. Users earn rewards for surveys, projects get real feedback and can monetize data, creating a win-win ecosystem.",
      startEarning: "Start Earning",
    //   createSurvey: "Create Survey",
      poweredBy: "POWERED BY"
    },
    workflow: {
      badge: "WORKFLOW",
      title1: "How Platform",
      title2: "Creates Value",
      description: "Clear value flow ensuring all participants benefit",
      userPath: "User Earning Path",
      projectPath: "Project Value Path",
      userSteps: [
        { title: "Browse Surveys", desc: "Choose interesting surveys" },
        { title: "Complete Survey", desc: "Fill out survey carefully" },
        { title: "Get Rewards", desc: "Receive SUI tokens instantly" },
        { title: "Authorize Subscription", desc: "Share selectively for dividends" }
      ],
      projectSteps: [
        { title: "Create Survey", desc: "Design research questions" },
        { title: "Set Rewards", desc: "Configure incentive pool" },
        { title: "Collect Data", desc: "Get user feedback" },
        { title: "Monetize Data", desc: "Sell survey results" }
      ],
      cycleTitle: "Value Cycle",
      cycleSubtitle: "Win-Win Ecosystem",
      cycleSteps: [
        "Users Complete Surveys",
        "Earn SUI Rewards",
        "Data Creates Value",
        "Subscription Dividends"
      ]
    },
    features: {
      badge: "CORE FEATURES",
      title1: "Building Fair & Transparent",
      title2: "Data Economy",
      description: "Creating a fair, transparent, and secure data marketplace with blockchain technology",
      list: [
        {
          title: "Decentralized Storage",
          description: "Survey data stored on Walrus distributed network with guaranteed permanence and availability"
        },
        {
          title: "Privacy Protection",
          description: "End-to-end encryption using Seal protocol ensures only authorized parties can access data"
        },
        {
          title: "Instant Settlement",
          description: "Smart contracts on Sui blockchain enable immediate reward distribution upon survey completion"
        },
        {
          title: "Data Monetization",
          description: "Survey results can be traded on the marketplace, creating real economic value from data"
        },
        {
          title: "Revenue Sharing",
          description: "Users earn continuous dividend income by authorizing data subscriptions"
        },
        {
          title: "Precision Incentives",
          description: "Projects can set reward pools to precisely incentivize target users to participate"
        }
      ]
    },
    pricing: {
      badge: "PRICING PLANS",
      title1: "Flexible",
      title2: "Pricing",
      description: "Platform-managed Walrus storage - just choose your plan and start",
      mostPopular: "Most Popular",
      comingSoon: "Coming Soon",
      note1: "* Specific survey creation limits to be determined based on operations",
      note2: "* All plans include managed Walrus storage service",
      plans: [
        {
          name: "Free",
          price: "0",
          currency: "USD",
          desc: "Perfect for individuals or small research",
          features: [
            "Limited survey creation",
            "Basic data analytics",
            "Community support",
            "Standard encryption",
            "Up to 100 responses/survey"
          ]
        },
        {
          name: "Starter",
          price: "10",
          currency: "USD/mo",
          desc: "Ideal for startups and small teams",
          features: [
            "More survey creation",
            "Advanced analytics",
            "Priority support",
            "API access",
            "Data export features",
            "Up to 1000 responses/survey"
          ]
        },
        {
          name: "Professional",
          price: "100",
          currency: "USD/mo",
          desc: "Best for established projects and enterprises",
          features: [
            "Unlimited surveys",
            "Complete analytics suite",
            "Dedicated support",
            "Advanced API access",
            "Custom branding",
            "Bulk data processing",
            "Unlimited responses"
          ]
        }
      ]
    },
    useCases: {
      badge: "USE CASES",
      title: "One Platform, Multiple Benefits",
      getStarted: "Get Started",
      comingSoon: "Coming Soon",
      cases: [
        {
          title: "Survey Takers",
          benefits: [
            "Earn SUI tokens",
            "Get subscription dividends",
            "Protect privacy",
            "Transparent rewards"
          ]
        },
        {
          title: "Project Owners",
          benefits: [
            "Collect user feedback",
            "Set reward incentives",
            "Monetize survey data",
            "Flexible plan options"
          ]
        },
        {
          title: "Data Buyers",
          benefits: [
            "Gain market insights",
            "Subscribe to data feeds",
            "Real user feedback",
            "Analytics support"
          ]
        }
      ]
    },
    ecosystem: {
      badge: "ARCHITECTURE",
      title: "Powerful Tech Stack",
      description: "Decentralized infrastructure built with cutting-edge Web3 technology",
      walrus: {
        title: "Walrus Storage",
        desc: "Distributed storage",
        detail: "Reliable decentralized storage ensuring permanent data availability"
      },
      seal: {
        title: "Seal Encryption",
        desc: "End-to-end protection",
        detail: "Privacy protocol ensuring data is only visible to authorized parties"
      },
      sui: {
        title: "Sui Blockchain",
        desc: "Smart contracts",
        detail: "High-performance blockchain for instant payments and smart contract execution"
      }
    },
    cta: {
      title1: "Ready to Join the",
      title2: "Data Revolution?",
      description: "Whether you want to earn rewards as a user or collect feedback as a project, DataWave provides the perfect solution",
      tryNow: "Try Now",
      createFirst: "Create Your First Survey"
    },
    footer: {
      tagline: "Decentralized survey platform on Sui, creating real value from data",
      product: "Product",
      resources: "Resources",
      about: "About",
      features: "Features",
      marketplace: "Survey Marketplace",
      launchApp: "Launch App",
      docs: "Documentation",
      api: "API",
      community: "Community",
      support: "Support",
      team: "Team",
      blog: "Blog",
      contact: "Contact",
      rights: "© 2025 DataWave. All rights reserved.",
      privacy: "Privacy Policy",
      terms: "Terms of Service"
    },
    preview: {
      earnings: "User Earnings",
      earningsDesc: "Surveys + Dividends",
      value: "Project Value",
      valueDesc: "Feedback + Monetization",
      security: "Security",
      securityDesc: "Encryption + Privacy"
    }
  },
  zh: {
    nav: {
      features: "功能特性",
      workflow: "工作流程",
      pricing: "套餐计划",
      architecture: "技术架构",
      launchApp: "启动应用"
    },
    hero: {
      badge: "Sui 生态去中心化问卷平台",
      title1: "让数据产生",
      title2: "真正价值",
      title3: "的问卷调研平台",
      description: "DataWave 是 Sui 生态中首个去中心化问卷调研平台，连接项目方与用户，通过区块链技术实现数据价值的公平分配。用户填写问卷赚取奖励，项目方获取真实反馈并可将数据变现，实现多方共赢。",
      startEarning: "开始赚取收益",
      createSurvey: "创建问卷",
      poweredBy: "技术支持"
    },
    workflow: {
      badge: "工作流程",
      title1: "平台如何",
      title2: "创造价值",
      description: "清晰的价值流转，让每个参与者都能获得收益",
      userPath: "用户赚取路径",
      projectPath: "项目方价值路径",
      userSteps: [
        { title: "浏览问卷", desc: "选择感兴趣的问卷" },
        { title: "完成答题", desc: "认真填写问卷内容" },
        { title: "获得奖励", desc: "即时收到 SUI 代币" },
        { title: "授权订阅", desc: "选择性分享获取分红" }
      ],
      projectSteps: [
        { title: "创建问卷", desc: "设计调研问题" },
        { title: "设置奖励", desc: "配置激励池" },
        { title: "收集数据", desc: "获取用户反馈" },
        { title: "数据变现", desc: "出售问卷结果" }
      ],
      cycleTitle: "价值循环",
      cycleSubtitle: "多方共赢生态",
      cycleSteps: [
        "用户填写问卷",
        "获得 SUI 奖励",
        "数据产生价值",
        "订阅分红收益"
      ]
    },
    features: {
      badge: "核心特性",
      title1: "构建公平透明的",
      title2: "数据经济",
      description: "利用区块链技术创造一个公平、透明、安全的数据交易市场",
      list: [
        {
          title: "去中心化存储",
          description: "基于 Walrus 分布式网络存储问卷数据，确保数据的永久性和可用性"
        },
        {
          title: "隐私保护",
          description: "使用 Seal 协议进行端到端加密，确保只有授权方才能访问数据"
        },
        {
          title: "即时结算",
          description: "Sui 区块链智能合约实现问卷完成后的即时奖励分发"
        },
        {
          title: "数据价值化",
          description: "问卷结果可在市场上交易，让数据产生真正的经济价值"
        },
        {
          title: "收益共享",
          description: "用户授权数据订阅后可获得持续的分红收益"
        },
        {
          title: "精准激励",
          description: "项目方可设置奖励池，精准激励目标用户参与调研"
        }
      ]
    },
    pricing: {
      badge: "套餐计划",
      title1: "灵活的",
      title2: "定价方案",
      description: "平台托管 Walrus 存储，项目方只需选择合适的套餐即可开始",
      mostPopular: "最受欢迎",
      comingSoon: "即将推出",
      note1: "* 具体创建问卷次数待定，将根据实际运营情况调整",
      note2: "* 所有套餐均包含 Walrus 存储托管服务",
      plans: [
        {
          name: "Free",
          price: "0",
          currency: "USD",
          desc: "适合个人或小型调研",
          features: [
            "创建问卷数量待定",
            "基础数据分析",
            "社区支持",
            "标准加密存储",
            "最多 100 份响应/问卷"
          ]
        },
        {
          name: "Starter",
          price: "10",
          currency: "USD/月",
          desc: "适合初创项目和小型团队",
          features: [
            "创建问卷数量待定",
            "高级数据分析",
            "优先技术支持",
            "API 访问权限",
            "数据导出功能",
            "最多 1000 份响应/问卷"
          ]
        },
        {
          name: "Professional",
          price: "100",
          currency: "USD/月",
          desc: "适合成熟项目和企业",
          features: [
            "无限创建问卷",
            "完整数据分析套件",
            "专属客服支持",
            "高级 API 权限",
            "自定义品牌",
            "批量数据处理",
            "无响应数量限制"
          ]
        }
      ]
    },
    useCases: {
      badge: "使用场景",
      title: "一个平台，多方受益",
      getStarted: "立即开始",
      comingSoon: "即将推出",
      cases: [
        {
          title: "普通用户",
          benefits: [
            "填写问卷赚取 SUI",
            "授权订阅获取分红",
            "保护个人隐私",
            "透明的收益体系"
          ]
        },
        {
          title: "项目方",
          benefits: [
            "收集用户反馈",
            "设置奖励激励",
            "出售问卷数据",
            "灵活的套餐选择"
          ]
        },
        {
          title: "数据购买者",
          benefits: [
            "获取市场洞察",
            "订阅感兴趣的数据",
            "真实用户反馈",
            "数据分析支持"
          ]
        }
      ]
    },
    ecosystem: {
      badge: "技术架构",
      title: "强大的技术支撑",
      description: "基于 Web3 前沿技术构建的去中心化基础设施",
      walrus: {
        title: "Walrus 存储",
        desc: "分布式数据存储",
        detail: "提供可靠的去中心化存储，确保问卷数据永久可用"
      },
      seal: {
        title: "Seal 加密",
        desc: "端到端加密保护",
        detail: "隐私保护协议，确保数据只对授权方可见"
      },
      sui: {
        title: "Sui 区块链",
        desc: "智能合约与支付",
        detail: "高性能区块链，实现即时支付和智能合约执行"
      }
    },
    cta: {
      title1: "准备好加入",
      title2: "数据价值革命了吗？",
      description: "无论您是想要赚取收益的用户，还是需要收集反馈的项目方，DataWave 都能为您提供完美的解决方案",
      tryNow: "立即体验",
      createFirst: "创建首个问卷"
    },
    footer: {
      tagline: "Sui 生态去中心化问卷平台，让数据产生真正的价值",
      product: "产品",
      resources: "资源",
      about: "关于",
      features: "功能特性",
      marketplace: "问卷市场",
      launchApp: "启动应用",
      docs: "文档",
      api: "API",
      community: "社区",
      support: "支持",
      team: "团队",
      blog: "博客",
      contact: "联系我们",
      rights: "© 2025 DataWave. 保留所有权利。",
      privacy: "隐私政策",
      terms: "服务条款"
    },
    preview: {
      earnings: "用户收益",
      earningsDesc: "填写问卷 + 授权分红",
      value: "项目方价值",
      valueDesc: "真实反馈 + 数据变现",
      security: "安全保障",
      securityDesc: "加密存储 + 隐私保护"
    }
  }
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const [activeFeature, setActiveFeature] = useState(0);
  const [language, setLanguage] = useState<'en' | 'zh'>('en'); // Default to English
  
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
  
  // Workflow icons
  const workflowIcons = {
    user: [
      <FileQuestion />,
      <CheckCircle />,
      <Coins />,
      <Share2 />
    ],
    enterprise: [
      <Target />,
      <Gift />,
      <Users />,
      <DollarSign />
    ]
  };
  
  // Feature icons
  const featureIcons = [
    <Database className="w-6 h-6" />,
    <Shield className="w-6 h-6" />,
    <Zap className="w-6 h-6" />,
    <DollarSign className="w-6 h-6" />,
    <Share2 className="w-6 h-6" />,
    <Target className="w-6 h-6" />
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
              {/* <button className="btn-glass large" onClick={() => navigate('/app/create-survey')}>
                <Building className="w-5 h-5" />
                {t.hero.createSurvey}
              </button> */}
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
                  <Coins className="w-8 h-8" />
                </div>
                <h4>{t.preview.earnings}</h4>
                <p>{t.preview.earningsDesc}</p>
              </div>
              <div className="preview-card">
                <div className="preview-icon">
                  <PieChart className="w-8 h-8" />
                </div>
                <h4>{t.preview.value}</h4>
                <p>{t.preview.valueDesc}</p>
              </div>
              <div className="preview-card">
                <div className="preview-icon">
                  <Shield className="w-8 h-8" />
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

      {/* Pricing Section */}
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
                className={`pricing-card ${index === 1 ? 'popular' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 }}
                viewport={{ once: true }}
              >
                {index === 1 && (
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
                  className={`plan-btn ${index === 1 ? 'primary' : 'outline'} disabled`}
                  disabled
                >
                  <Clock className="w-4 h-4" />
                  {t.pricing.comingSoon}
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
                  onClick={() => navigate(['/app/marketplace', '/app/create-survey', '/app/subscriptions'][index])}
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
              <button className="btn-outline large" onClick={() => navigate('/app/create-survey')}>
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