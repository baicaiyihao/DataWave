// src/components/Layout/AppLayout.tsx
import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ConnectButton, useCurrentAccount, useDisconnectWallet, useSuiClient } from '@mysten/dapp-kit';
import { motion, AnimatePresence } from 'framer-motion';
import {
  // Main Navigation Icons
  Grid3x3,
  PlusCircle,
  TrendingUp,
  
  // Profile Menu Icons
  FileText,
  ClipboardList,
  ShoppingBag,
  CheckCircle,
  Activity,
  Wallet,
  Settings,
  LogOut,
  ChevronRight,
  
  // UI Icons
  Menu,
  X,
  Languages,
  User
} from 'lucide-react';
import '../../css/AppLayout.css';

interface MainNavItem {
  id: string;
  label: string;
  labelZh: string;
  path: string;
}

interface ProfileMenuItem {
  path: string;
  label: string;
  labelZh: string;
  icon: React.ReactNode;
  divider?: boolean;
}

const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: disconnect } = useDisconnectWallet();
  
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const [balance, setBalance] = useState<string>('--');

  // Main navigation items - similar to 
  const mainNavItems: MainNavItem[] = [
    {
      id: 'browse',
      label: 'Browse',
      labelZh: '浏览',
      path: '/app/marketplace'
    },
    {
      id: 'create',
      label: 'Create',
      labelZh: '创建',
      path: '/app/create-survey'
    },
    {
      id: 'trade',
      label: 'Trade',
      labelZh: '交易',
      path: '/app/subscriptions'
    }
  ];

  // Profile menu items - personal data in wallet dropdown
  const profileMenuItems: ProfileMenuItem[] = [
    {
      path: '/app/my-surveys',
      label: 'My Surveys',
      labelZh: '我的问卷',
      icon: <FileText size={18} />
    },
    {
      path: '/app/my-responses',
      label: 'My Responses',
      labelZh: '我的回答',
      icon: <ClipboardList size={18} />
    },
    {
      path: '/app/my-subscriptions',
      label: 'My Subscriptions',
      labelZh: '我的订阅',
      icon: <ShoppingBag size={18} />
    },
    {
      path: '/app/allowlist',
      label: 'My Allowlist Access',
      labelZh: '我的权限列表',
      icon: <CheckCircle size={18} />
    },
    // },
    // {
    //   path: '/app/activity',
    //   label: 'My Activity',
    //   labelZh: '我的活动',
    //   icon: <Activity size={18} />
    // },
    // {
    //   path: '/app/earnings',
    //   label: 'My Earnings',
    //   labelZh: '我的收益',
    //   icon: <Wallet size={18} />
    // },
    {
      divider: true,
      path: '#',
      label: '',
      labelZh: '',
      icon: null
    },
    {
      path: '/settings',
      label: 'Settings',
      labelZh: '设置',
      icon: <Settings size={18} />
    }
  ];

  const t = (en: string, zh: string) => language === 'en' ? en : zh;

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Fetch balance when account changes
  useEffect(() => {
    const fetchBalance = async () => {
      if (!account?.address) {
        setBalance('--');
        return;
      }
      
      try {
        const balanceResult = await suiClient.getBalance({
          owner: account.address,
        });
        const balanceInSUI = (Number(balanceResult.totalBalance) / 1_000_000_000).toFixed(3);
        setBalance(balanceInSUI);
      } catch (error) {
        console.error('Error fetching balance:', error);
        setBalance('--');
      }
    };

    fetchBalance();
  }, [account, suiClient]);

  // Handle logout - disconnect wallet
  const handleLogout = () => {
    disconnect();
    setProfileMenuOpen(false);
    navigate('/app/marketplace');
  };

  // Close menus on route change
  useEffect(() => {
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuOpen && !(e.target as Element).closest('.app-profile-dropdown')) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [profileMenuOpen]);

  return (
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <header className="app-header">
        <div className="app-header-container">
          {/* Left: Logo and Main Nav */}
          <div className="app-header-left">
            <div className="app-logo" onClick={() => navigate('/app/marketplace')}>
              <img 
                src="/logo_white.webp" 
                alt="DataWave" 
                className="app-logo-img"
              />
            </div>
            
            {/* Main Navigation */}
            <nav className="app-main-nav app-desktop-only">
              {mainNavItems.map(item => (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`app-nav-link ${isActive(item.path) ? 'active' : ''}`}
                >
                  {t(item.label, item.labelZh)}
                </Link>
              ))}
            </nav>

            {/* Mobile Menu Button */}
            <button 
              className="app-mobile-menu-btn app-mobile-only"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Center: Search or Stats (optional) */}
          <div className="app-header-center app-desktop-only">
            <div className="app-search-bar">
              <input 
                type="text" 
                placeholder={t('Search surveys...', '搜索问卷...')}
                className="app-search-input"
              />
            </div>
          </div>

          {/* Right: Language and Wallet */}
          <div className="app-header-right">
            {/* <button 
              className="app-lang-btn"
              onClick={toggleLanguage}
            >
              <Languages size={16} />
              <span className="app-desktop-only">{language === 'en' ? '中文' : 'EN'}</span>
            </button> */}
            
            {/* Wallet/Profile Dropdown */}
            <div className="app-profile-dropdown">
              {account ? (
                <button 
                  className="app-profile-btn"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                >
                  <User size={18} />
                  <span className="address">{formatAddress(account.address)}</span>
                  <ChevronRight 
                    size={16} 
                    className={`arrow ${profileMenuOpen ? 'open' : ''}`}
                  />
                </button>
              ) : (
                <ConnectButton />
              )}
              
              {/* Profile Menu Dropdown */}
              <AnimatePresence>
                {profileMenuOpen && account && (
                  <motion.div 
                    className="app-profile-menu"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* Account Info */}
                    <div className="app-account-info">
                      <div className="app-account-avatar">
                        <User size={24} />
                      </div>
                      <div className="app-account-details">
                        <div className="app-account-address">
                          {formatAddress(account.address)}
                        </div>
                        <div className="app-account-balance">
                          <Wallet size={12} />
                          <span>{balance} SUI</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Menu Items */}
                    <div className="app-profile-menu-items">
                      {profileMenuItems.map((item, index) => (
                        item.divider ? (
                          <div key={index} className="app-menu-divider" />
                        ) : (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`app-profile-menu-item ${isActive(item.path) ? 'active' : ''}`}
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <span className="app-menu-icon">{item.icon}</span>
                            <span className="app-menu-label">
                              {t(item.label, item.labelZh)}
                            </span>
                          </Link>
                        )
                      ))}
                      
                      {/* Logout */}
                      <button 
                        className="app-profile-menu-item logout"
                        onClick={handleLogout}
                      >
                        <span className="app-menu-icon"><LogOut size={18} /></span>
                        <span className="app-menu-label">{t('Logout', '退出')}</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.nav 
            className="app-mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {mainNavItems.map(item => (
              <Link
                key={item.id}
                to={item.path}
                className={`app-mobile-nav-link ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t(item.label, item.labelZh)}
              </Link>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="app-main">
        <div className="app-main-container">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default AppLayout;