// src/components/BrowseSubscriptions.tsx
import React, { useState, useEffect } from 'react';
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { Transaction } from '@mysten/sui/transactions';
import { ConfigService } from '../../services/config';
import { 
  DollarSign, 
  Clock, 
  Users, 
  TrendingUp, 
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  ShoppingCart,
  Eye,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Star,
  Award,
  Zap,
  BarChart,
  ArrowRight
} from 'lucide-react';
import './BrowseSubscriptions.css';

interface SubscriptionSurvey {
  surveyId: string;
  title: string;
  description: string;
  category: string;
  creator: string;
  createdAt: string;
  currentResponses: number;
  maxResponses: number;
  isActive: boolean;
  
  // 订阅服务信息
  subscriptionServiceId: string;
  price: number;
  duration: number;
  totalRevenue: number;
  subscriberCount: number;
  
  // 用户订阅状态
  isSubscribed: boolean;
  userSubscriptionId?: string;
  subscriptionExpiry?: number;
}

export function BrowseSubscriptions() {
  const navigate = useNavigate();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const packageId = ConfigService.getPackageId();
  
  const [services, setServices] = useState<SubscriptionSurvey[]>([]);
  const [filteredServices, setFilteredServices] = useState<SubscriptionSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  
  // 筛选状态 - 默认排序改为newest
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'subscribed' | 'available'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'revenue' | 'price'>('newest');
  const [categories, setCategories] = useState<string[]>(['all']);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // 统计
  const [stats, setStats] = useState({
    hottest: null as SubscriptionSurvey | null,
    newest: null as SubscriptionSurvey | null,
    mostAffordable: null as SubscriptionSurvey | null,
  });
  
  const { mutate: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showEffects: true,
        },
      }),
  });

  // Navigation functions
  const viewSurveyDetails = (surveyId: string) => {
    navigate(`/app/survey/${surveyId}`);
  };

  const viewSubscriptionAnswers = (surveyId: string, subscriptionId?: string) => {
    navigate(`/app/subscription-decrypt/${surveyId}`, { 
      state: { 
        subscriptionId,
        returnPath: '/app/subscriptions'
      } 
    });
  };

  // 加载所有有订阅服务的问卷
  const loadSubscriptionSurveys = async () => {
    setLoading(true);
    try {
      const allSubscriptionSurveys: SubscriptionSurvey[] = [];
      
      // 1. 获取当前用户的所有订阅
      const userSubMap = new Map<string, any>();
      if (currentAccount?.address) {
        const userSubscriptions = await suiClient.getOwnedObjects({
          owner: currentAccount.address,
          options: { showContent: true, showType: true },
          filter: {
            StructType: `${packageId}::survey_system::Subscription`,
          },
        });
        
        for (const sub of userSubscriptions.data) {
          if (sub.data?.content && 'fields' in sub.data.content) {
            const fields = sub.data.content.fields as any;
            userSubMap.set(fields.survey_id, {
              subscriptionId: sub.data.objectId,
              serviceId: fields.service_id,
              expiresAt: parseInt(fields.expires_at),
            });
          }
        }
      }
      
      // 2. 从 Registry 获取所有问卷
      const registryId = ConfigService.getSurveyRegistryId();
      const registry = await suiClient.getObject({
        id: registryId,
        options: { showContent: true }
      });

      if (registry.data?.content && 'fields' in registry.data.content) {
        const fields = registry.data.content.fields;
        const allSurveysTable = fields.all_surveys?.fields?.id?.id;
        
        if (allSurveysTable) {
          let hasNextPage = true;
          let cursor = null;
          
          while (hasNextPage) {
            const dynamicFields = await suiClient.getDynamicFields({
              parentId: allSurveysTable,
              cursor,
              limit: 50,
            });
            
            for (const field of dynamicFields.data) {
              try {
                const surveyId = field.name.value as string;
                const surveyObj = await suiClient.getObject({
                  id: surveyId,
                  options: { showContent: true }
                });
                
                if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
                  const surveyFields = surveyObj.data.content.fields as any;
                  const subscriptionServiceId = surveyFields.subscription_service_id;
                  
                  if (subscriptionServiceId && subscriptionServiceId !== '0x0') {
                    const serviceObj = await suiClient.getObject({
                      id: subscriptionServiceId,
                      options: { showContent: true }
                    });
                    
                    if (serviceObj.data?.content && 'fields' in serviceObj.data.content) {
                      const serviceFields = serviceObj.data.content.fields as any;
                      
                      let subscriberCount = 0;
                      try {
                        const subscriptionEvents = await suiClient.queryEvents({
                          query: {
                            MoveEventType: `${packageId}::survey_system::SubscriptionPurchased`,
                          },
                          limit: 100,
                        });
                        
                        subscriberCount = subscriptionEvents.data.filter((event: any) => 
                          event.parsedJson?.survey_id === surveyId
                        ).length;
                      } catch (e) {
                        console.error('Error getting subscriber count:', e);
                      }
                      
                      const userSub = userSubMap.get(surveyId);
                      const now = Date.now();
                      const isSubscribed = userSub && userSub.expiresAt > now;
                      
                      allSubscriptionSurveys.push({
                        surveyId,
                        title: surveyFields.title || 'Unknown Survey',
                        description: surveyFields.description || '',
                        category: surveyFields.category || 'Uncategorized',
                        creator: surveyFields.creator || '',
                        createdAt: surveyFields.created_at || '0',
                        currentResponses: parseInt(surveyFields.current_responses || '0'),
                        maxResponses: parseInt(surveyFields.max_responses || '0'),
                        isActive: surveyFields.is_active || false,
                        
                        subscriptionServiceId,
                        price: parseInt(serviceFields.price || '0'),
                        duration: parseInt(serviceFields.duration_ms || '0'),
                        totalRevenue: parseInt(serviceFields.total_revenue || '0'),
                        subscriberCount,
                        
                        isSubscribed: !!isSubscribed,
                        userSubscriptionId: userSub?.subscriptionId,
                        subscriptionExpiry: userSub?.expiresAt,
                      });
                    }
                  }
                }
              } catch (error) {
                console.error(`Error processing survey ${field.name.value}:`, error);
              }
            }
            
            hasNextPage = dynamicFields.hasNextPage;
            cursor = dynamicFields.nextCursor;
          }
        }
      }
      
      // 默认按创建时间排序（最新的在前）
      allSubscriptionSurveys.sort((a, b) => parseInt(b.createdAt) - parseInt(a.createdAt));
      
      setServices(allSubscriptionSurveys);
      setFilteredServices(allSubscriptionSurveys);
      
      // 提取类别
      const uniqueCategories = Array.from(new Set(allSubscriptionSurveys.map(s => s.category)));
      setCategories(['all', ...uniqueCategories]);
      
      // 计算特色推荐
      if (allSubscriptionSurveys.length > 0) {
        const sorted = [...allSubscriptionSurveys];
        const hottest = sorted.sort((a, b) => b.subscriberCount - a.subscriberCount)[0];
        const newest = [...allSubscriptionSurveys].sort((a, b) => parseInt(b.createdAt) - parseInt(a.createdAt))[0];
        const mostAffordable = [...allSubscriptionSurveys].filter(s => s.price > 0).sort((a, b) => a.price - b.price)[0];
        
        setStats({
          hottest: hottest || null,
          newest: newest || null,
          mostAffordable: mostAffordable || null,
        });
      }
      
    } catch (error) {
      console.error('Error loading subscription surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  // 成功提示模态框
  const showSuccessModal = (message: string, onClose: () => void) => {
    const modal = document.createElement('div');
    modal.className = 'bs-success-modal';
    modal.innerHTML = `
      <div class="bs-success-modal-content">
        <div class="bs-success-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div class="bs-success-message">${message}</div>
        <div class="bs-success-progress"></div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // 2.5秒后自动跳转
    setTimeout(() => {
      document.body.removeChild(modal);
      onClose();
    }, 2500);
  };

  // 错误提示模态框
  const showErrorModal = (title: string, message: string) => {
    const modal = document.createElement('div');
    modal.className = 'bs-error-modal';
    modal.innerHTML = `
      <div class="bs-error-modal-content">
        <div class="bs-error-icon">⚠️</div>
        <div class="bs-error-title">${title}</div>
        <div class="bs-error-message">${message}</div>
        <button class="bs-error-close">OK</button>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('.bs-error-close')?.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  };

  // 购买订阅 - 成功后跳转
  const purchaseSubscription = (service: SubscriptionSurvey) => {
    if (!currentAccount?.address) {
      const shouldConnect = confirm('Please connect your wallet to subscribe.\n\nWould you like to connect now?');
      return;
    }
    
    setPurchasing(service.subscriptionServiceId);
    
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [service.price]);
    const treasuryId = ConfigService.getPlatformTreasuryId();
    
    tx.moveCall({
      target: `${packageId}::survey_system::purchase_subscription_entry`,
      arguments: [
        tx.object(service.subscriptionServiceId),
        tx.object(service.surveyId),
        coin,
        tx.object(treasuryId),
        tx.object('0x6'),
      ],
    });
    
    signAndExecute(
      { transaction: tx as any},
      {
        onSuccess: (result) => {
          console.log('Subscription purchased:', result);
          
          const subscriptionNft = result.effects?.created?.find(
            (item) => (item.owner as any)?.AddressOwner === currentAccount?.address,
          );
          
          if (subscriptionNft) {
            const subscriptionId = subscriptionNft.reference.objectId;
            
            // 显示成功提示并跳转
            showSuccessModal(
              `✅ Successfully subscribed to "${service.title}"!\n\nRedirecting to access survey data...`,
              () => {
                navigate(`/app/subscription-decrypt/${service.surveyId}`, { 
                  state: { 
                    subscriptionId,
                    returnPath: '/app/subscriptions'
                  } 
                });
              }
            );
          }
        },
        onError: (error) => {
          console.error('Error purchasing subscription:', error);
          showErrorModal('Failed to purchase subscription', error.message);
        },
        onSettled: () => {
          setPurchasing(null);
        }
      },
    );
  };

  // 应用筛选
  useEffect(() => {
    let filtered = [...services];
    
    if (filterCategory !== 'all') {
      filtered = filtered.filter(s => s.category === filterCategory);
    }
    
    if (filterStatus === 'subscribed') {
      filtered = filtered.filter(s => s.isSubscribed);
    } else if (filterStatus === 'available') {
      filtered = filtered.filter(s => !s.isSubscribed);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term)
      );
    }
    
    // 排序
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => parseInt(b.createdAt) - parseInt(a.createdAt));
        break;
      case 'revenue':
        filtered.sort((a, b) => b.totalRevenue - a.totalRevenue);
        break;
      case 'price':
        filtered.sort((a, b) => a.price - b.price);
        break;
    }
    
    setFilteredServices(filtered);
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterCategory, sortBy, services]);

  useEffect(() => {
    loadSubscriptionSurveys();
  }, [currentAccount?.address]);

  // 分页计算
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentServices = filteredServices.slice(startIndex, endIndex);

  // 格式化函数
  const formatSUI = (amount: number) => {
    return (amount / 1000000000).toFixed(4);
  };

  const formatDuration = (ms: number) => {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) return `${hours} hours`;
    return `${Math.floor(hours / 24)} days`;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString();
  };

  const formatExpiry = (timestamp: number) => {
    const now = Date.now();
    const diff = timestamp - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const tabStats = {
    all: services.length,
    available: services.filter(s => !s.isSubscribed).length,
    subscribed: services.filter(s => s.isSubscribed).length,
  };

  return (
    <div className="bs-container">
      {/* Header */}
      <div className="bs-header">
        <div className="bs-header-content">
          <div className="bs-header-info">
            <h1 className="bs-title">
              <ShoppingCart size={32} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
              Subscription Marketplace
            </h1>
            <p className="bs-subtitle">
              Access exclusive survey data with subscription plans
            </p>
          </div>
          <button 
            className="bs-refresh-btn" 
            onClick={loadSubscriptionSurveys} 
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'bs-spinning' : ''} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* 特色推荐卡片 */}
        <div className="bs-featured-cards">
          {loading ? (
            <>
              <div className="bs-featured-card hot skeleton">
                <div className="bs-featured-skeleton-icon"></div>
                <div className="bs-featured-skeleton-content">
                  <div className="bs-featured-skeleton-label"></div>
                  <div className="bs-featured-skeleton-title"></div>
                  <div className="bs-featured-skeleton-value"></div>
                </div>
              </div>
              <div className="bs-featured-card new skeleton">
                <div className="bs-featured-skeleton-icon"></div>
                <div className="bs-featured-skeleton-content">
                  <div className="bs-featured-skeleton-label"></div>
                  <div className="bs-featured-skeleton-title"></div>
                  <div className="bs-featured-skeleton-value"></div>
                </div>
              </div>
              <div className="bs-featured-card affordable skeleton">
                <div className="bs-featured-skeleton-icon"></div>
                <div className="bs-featured-skeleton-content">
                  <div className="bs-featured-skeleton-label"></div>
                  <div className="bs-featured-skeleton-title"></div>
                  <div className="bs-featured-skeleton-value"></div>
                </div>
              </div>
            </>
          ) : services.length > 0 ? (
            <>
              <div className="bs-featured-card hot">
                <div className="bs-featured-icon">
                  <Zap size={20} />
                </div>
                <div className="bs-featured-content">
                  <span className="bs-featured-label">🔥 Most Popular</span>
                  <span className="bs-featured-title">
                    {stats.hottest?.title || 'No surveys yet'}
                  </span>
                  <span className="bs-featured-value">
                    {stats.hottest ? `${stats.hottest.subscriberCount} subscribers` : 'No data'}
                  </span>
                </div>
              </div>
              
              <div className="bs-featured-card new">
                <div className="bs-featured-icon">
                  <Star size={20} />
                </div>
                <div className="bs-featured-content">
                  <span className="bs-featured-label">✨ Newest</span>
                  <span className="bs-featured-title">
                    {stats.newest?.title || 'No surveys yet'}
                  </span>
                  <span className="bs-featured-value">
                    {stats.newest ? formatDate(stats.newest.createdAt) : 'No data'}
                  </span>
                </div>
              </div>
              
              <div className="bs-featured-card affordable">
                <div className="bs-featured-icon">
                  <Award size={20} />
                </div>
                <div className="bs-featured-content">
                  <span className="bs-featured-label">💎 Best Value</span>
                  <span className="bs-featured-title">
                    {stats.mostAffordable?.title || 'No surveys yet'}
                  </span>
                  <span className="bs-featured-value">
                    {stats.mostAffordable ? `${formatSUI(stats.mostAffordable.price)} SUI` : 'No data'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bs-featured-card hot" style={{ opacity: 0.5 }}>
                <div className="bs-featured-icon">
                  <Zap size={20} />
                </div>
                <div className="bs-featured-content">
                  <span className="bs-featured-label">🔥 Most Popular</span>
                  <span className="bs-featured-title">No surveys available</span>
                  <span className="bs-featured-value">Check back later</span>
                </div>
              </div>
              <div className="bs-featured-card new" style={{ opacity: 0.5 }}>
                <div className="bs-featured-icon">
                  <Star size={20} />
                </div>
                <div className="bs-featured-content">
                  <span className="bs-featured-label">✨ Newest</span>
                  <span className="bs-featured-title">No surveys available</span>
                  <span className="bs-featured-value">Check back later</span>
                </div>
              </div>
              <div className="bs-featured-card affordable" style={{ opacity: 0.5 }}>
                <div className="bs-featured-icon">
                  <Award size={20} />
                </div>
                <div className="bs-featured-content">
                  <span className="bs-featured-label">💎 Best Value</span>
                  <span className="bs-featured-title">No surveys available</span>
                  <span className="bs-featured-value">Check back later</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bs-tabs">
        <button 
          className={`bs-tab ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          All Services ({tabStats.all})
        </button>
        <button 
          className={`bs-tab ${filterStatus === 'available' ? 'active' : ''}`}
          onClick={() => setFilterStatus('available')}
        >
          Available ({tabStats.available})
        </button>
        {currentAccount && (
          <button 
            className={`bs-tab ${filterStatus === 'subscribed' ? 'active' : ''}`}
            onClick={() => setFilterStatus('subscribed')}
          >
            My Subscriptions ({tabStats.subscribed})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bs-filters">
        <div className="bs-filters-content">
          <div className="bs-search-box">
            <Search size={16} />
            <input
              className="bs-search-input"
              placeholder="Search surveys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="bs-select"
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
          
          <select
            className="bs-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="newest">Newest First</option>
            <option value="revenue">Highest Revenue</option>
            <option value="price">Lowest Price</option>
          </select>
        </div>
      </div>

      {/* Table Header */}
      {!loading && currentServices.length > 0 && (
        <div className="bs-table-header">
          <div>Survey</div>
          <div>Category</div>
          <div>Price</div>
          <div>Duration</div>
          <div>Subscribers</div>
          <div>Responses</div>
          <div>Action</div>
        </div>
      )}

      {/* Services List */}
      <div className="bs-survey-list">
        {loading ? (
          <div className="bs-loading-state">
            <div className="bs-table-header" style={{ opacity: 0.5 }}>
              <div>Survey</div>
              <div>Category</div>
              <div>Price</div>
              <div>Duration</div>
              <div>Subscribers</div>
              <div>Responses</div>
              <div>Action</div>
            </div>
            
            {[...Array(6)].map((_, index) => (
              <div key={index} className="bs-skeleton-row" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="bs-survey-info">
                  <div className="bs-skeleton bs-skeleton-title"></div>
                  <div className="bs-skeleton bs-skeleton-desc"></div>
                  <div className="bs-skeleton bs-skeleton-meta"></div>
                </div>
                <div>
                  <div className="bs-skeleton bs-skeleton-badge"></div>
                </div>
                <div>
                  <div className="bs-skeleton bs-skeleton-price"></div>
                </div>
                <div>
                  <div className="bs-skeleton bs-skeleton-duration"></div>
                </div>
                <div>
                  <div className="bs-skeleton bs-skeleton-users"></div>
                </div>
                <div>
                  <div className="bs-skeleton bs-skeleton-progress"></div>
                </div>
                <div>
                  <div className="bs-skeleton bs-skeleton-btn"></div>
                </div>
              </div>
            ))}
          </div>
        ) : currentServices.length === 0 ? (
          <div className="bs-empty-state">
            <BarChart size={48} />
            <h3 className="bs-empty-title">
              {filteredServices.length === 0 
                ? 'No subscription services found'
                : 'No services on this page'}
            </h3>
            <p className="bs-empty-desc">
              {filterStatus === 'subscribed'
                ? 'Browse available services and subscribe to access survey data'
                : 'Try adjusting your filters or check back later'}
            </p>
          </div>
        ) : (
          currentServices.map((service) => {
            const progress = Math.min(100, (service.currentResponses / service.maxResponses) * 100);
            
            return (
              <div key={service.subscriptionServiceId} className="bs-survey-row">
                <div className="bs-survey-info">
                  <h3 
                    className="bs-survey-title"
                    onClick={() => viewSurveyDetails(service.surveyId)}
                  >
                    {service.title}
                    {service.isSubscribed && (
                      <span className="bs-subscribed-indicator">
                        <CheckCircle size={14} />
                      </span>
                    )}
                  </h3>
                  <p className="bs-survey-desc">{service.description}</p>
                  <div className="bs-survey-meta">
                    <span className="bs-meta-tag">
                      <Calendar size={12} />
                      {formatDate(service.createdAt)}
                    </span>
                    <span className={`bs-status-badge ${service.isActive ? 'active' : 'closed'}`}>
                      {service.isActive ? 'Active' : 'Closed'}
                    </span>
                    {service.totalRevenue > 0 && (
                      <span className="bs-meta-tag">
                        <TrendingUp size={12} />
                        {formatSUI(service.totalRevenue)} SUI revenue
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="bs-category">
                  <span className="bs-category-badge">{service.category}</span>
                </div>
                
                <div className="bs-price">
                  <DollarSign size={14} />
                  {formatSUI(service.price)}
                  <span className="bs-price-unit">SUI</span>
                </div>
                
                <div className="bs-duration">
                  <Clock size={14} />
                  {formatDuration(service.duration)}
                </div>
                
                <div className="bs-subscribers">
                  <Users size={14} />
                  {service.subscriberCount}
                </div>
                
                <div className="bs-responses">
                  <div className="bs-response-progress">
                    <span>{service.currentResponses}/{service.maxResponses}</span>
                    <div className="bs-progress-bar">
                      <div className="bs-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
                
                <div className="bs-actions">
                  {service.isSubscribed ? (
                    <div className="bs-subscribed-actions">
                      {service.subscriptionExpiry && (
                        <div className="bs-expiry">
                          {formatExpiry(service.subscriptionExpiry)}
                        </div>
                      )}
                      <button 
                        className="bs-action-btn secondary"
                        onClick={() => viewSubscriptionAnswers(service.surveyId, service.userSubscriptionId)}
                      >
                        <Eye size={14} />
                        View Answers
                      </button>
                    </div>
                  ) : (
                    <button
                      className="bs-action-btn primary"
                      onClick={() => purchaseSubscription(service)}
                      disabled={purchasing === service.subscriptionServiceId}
                    >
                      {purchasing === service.subscriptionServiceId ? (
                        <>
                          <RefreshCw size={14} className="bs-spinning" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={14} />
                          Subscribe
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bs-pagination">
          <div className="bs-pagination-content">
            <span className="bs-page-info">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredServices.length)} of {filteredServices.length} services
            </span>
            
            <div className="bs-page-controls">
              <button 
                className="bs-page-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="bs-page-numbers">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={i}
                      className={`bs-page-btn ${pageNum === currentPage ? 'active' : ''}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button 
                className="bs-page-btn"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BrowseSubscriptions;