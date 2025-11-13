// src/components/Layout/AppLayout.tsx
import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ConnectButton } from '@mysten/dapp-kit';
import { motion, AnimatePresence } from 'framer-motion';
import {
  // Icons
  Grid3x3,
  ClipboardList,
  Coins,
  CheckCircle,
  PlusCircle,
  FileText,
  BarChart3,
  Shield,
  ShoppingBag,
  Lock,
  Menu,
  X,
  Languages,
  Settings,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import './AppLayout.css';

interface NavItem {
  path: string;
  label: string;
  labelZh: string;
  icon: React.ReactNode;
  description?: string;
  descriptionZh?: string;
}

interface NavCategory {
  id: 'earn' | 'create' | 'trade';
  label: string;
  labelZh: string;
  icon: React.ReactNode;
  color: string;
  items: NavItem[];
}

const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'earn' | 'create' | 'trade'>('earn');
  const [language, setLanguage] = useState<'en' | 'zh'>('en');

  // Navigation categories with better naming
  const navCategories: NavCategory[] = [
    {
      id: 'earn',
      label: 'Earn',
      labelZh: '赚取',
      icon: <Coins size={16} />,
      color: '#3b82f6',
      items: [
        {
          path: '/app/marketplace',
          label: 'Browse Surveys',
          labelZh: '浏览问卷',
          icon: <Grid3x3 size={18} />,
          description: 'Find surveys to complete',
          descriptionZh: '寻找可完成的问卷'
        },
        {
          path: '/app/my-responses',
          label: 'My Activity',
          labelZh: '我的活动',
          icon: <ClipboardList size={18} />,
          description: 'View completed surveys',
          descriptionZh: '查看已完成的问卷'
        },
        {
          path: '/app/earnings',
          label: 'Rewards',
          labelZh: '奖励',
          icon: <Sparkles size={18} />,
          description: 'Track your earnings',
          descriptionZh: '追踪你的收益'
        },
        {
          path: '/app/allowlist',
          label: 'VIP Access',
          labelZh: 'VIP访问',
          icon: <CheckCircle size={18} />,
          description: 'Exclusive opportunities',
          descriptionZh: '专属机会'
        }
      ]
    },
    {
      id: 'create',
      label: 'Create',
      labelZh: '创建',
      icon: <PlusCircle size={16} />,
      color: '#7c3aed',
      items: [
        {
          path: '/app/create-survey',
          label: 'New Survey',
          labelZh: '新建问卷',
          icon: <PlusCircle size={18} />,
          description: 'Design a survey',
          descriptionZh: '设计问卷'
        },
        {
          path: '/app/my-surveys',
          label: 'Manage',
          labelZh: '管理',
          icon: <FileText size={18} />,
          description: 'Your survey collection',
          descriptionZh: '你的问卷集合'
        },
        {
          path: '/app/analytics',
          label: 'Analytics',
          labelZh: '分析',
          icon: <BarChart3 size={18} />,
          description: 'Data insights',
          descriptionZh: '数据洞察'
        },
        {
          path: '/app/access-control',
          label: 'Permissions',
          labelZh: '权限',
          icon: <Shield size={18} />,
          description: 'Control access',
          descriptionZh: '控制访问'
        }
      ]
    },
    {
      id: 'trade',
      label: 'Market',
      labelZh: '交易',
      icon: <TrendingUp size={16} />,
      color: '#10b981',
      items: [
        {
          path: '/app/subscriptions',
          label: 'Data Market',
          labelZh: '数据市场',
          icon: <ShoppingBag size={18} />,
          description: 'Buy survey data',
          descriptionZh: '购买调研数据'
        },
        {
          path: '/app/my-subscriptions',
          label: 'Purchases',
          labelZh: '已购买',
          icon: <Lock size={18} />,
          description: 'Your data access',
          descriptionZh: '你的数据访问权'
        }
      ]
    }
  ];

  const currentCategory = navCategories.find(cat => cat.id === activeCategory);
  const t = (en: string, zh: string) => language === 'en' ? en : zh;

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  };

  // Auto-detect active category based on current path
  useEffect(() => {
    const currentPath = location.pathname;
    for (const category of navCategories) {
      if (category.items.some(item => isActive(item.path))) {
        setActiveCategory(category.id);
        break;
      }
    }
  }, [location.pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <header className="app-header">
        <div className="header-container">
          <div className="header-left">
            <button 
              className="menu-toggle desktop-only"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              <Menu size={20} />
            </button>
            <button 
              className="menu-toggle mobile-only"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            
            <div className="app-logo" onClick={() => navigate('/')}>
              <img 
                src="/logo.webp" 
                alt="DataWave" 
                className="logo-img"
              />
            </div>
          </div>

          {/* Streamlined Category Switcher */}
          <div className="nav-categories">
            {navCategories.map(category => (
              <button
                key={category.id}
                className={`category-tab ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(category.id)}
                style={{ '--tab-color': category.color } as React.CSSProperties}
              >
                {category.icon}
                <span className="tab-label">
                  {t(category.label, category.labelZh)}
                </span>
              </button>
            ))}
          </div>

          <div className="header-right">
            <button 
              className="lang-switch" 
              onClick={toggleLanguage}
              aria-label="Switch language"
            >
              <Languages size={16} />
              <span>{language === 'en' ? '中' : 'EN'}</span>
            </button>
            
            <div className="wallet-connect">
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar with current category items */}
        <AnimatePresence>
          {(sidebarOpen || mobileMenuOpen) && (
            <motion.aside 
              className={`app-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <nav className="sidebar-nav">
                {/* Category Header - Simplified */}
                <div 
                  className="category-header"
                  style={{ '--category-color': currentCategory?.color } as React.CSSProperties}
                >
                  <div className="category-badge">
                    {currentCategory?.icon}
                    <span className="badge-label">
                      {currentCategory && t(currentCategory.label, currentCategory.labelZh)}
                    </span>
                  </div>
                </div>

                {/* Navigation Items */}
                <div className="nav-items">
                  {currentCategory?.items.map(item => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                    >
                      <span className="item-icon">{item.icon}</span>
                      <div className="item-content">
                        <span className="item-label">
                          {t(item.label, item.labelZh)}
                        </span>
                        {item.description && (
                          <span className="item-desc">
                            {t(item.description, item.descriptionZh)}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </nav>

              {/* Simplified Footer */}
              <div className="sidebar-footer">
                <button 
                  className="settings-btn"
                  onClick={() => {/* Handle settings */}}
                >
                  <Settings size={16} />
                  <span>{t('Settings', '设置')}</span>
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className={`app-main ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
          <div className="main-container">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            className="mobile-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppLayout;