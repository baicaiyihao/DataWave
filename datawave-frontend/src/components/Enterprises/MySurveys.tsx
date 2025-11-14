// src/components/Enterprise/MySurveys.tsx
import React, { useState, useEffect } from 'react';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { ConfigService } from '../../services/config';
import { 
  FileText, 
  Users, 
  Coins, 
  Calendar, 
  Eye, 
  Settings,
  RefreshCw,
  Copy,
  ExternalLink,
  CheckCircle,
  DollarSign,
  Gift,
  TrendingUp,
  Clock,
  Plus,
  BarChart,
  Package,
  Wallet,
  AlertCircle,
  Shield,
  X,
  Hash,
  ChevronRight
} from 'lucide-react';
import './MySurveys.css';

interface SurveyData {
  id: string;
  capId?: string;
  title: string;
  description: string;
  category: string;
  rewardPerResponse: string;
  maxResponses: string;
  currentResponses: string;
  isActive: boolean;
  createdAt: string;
  creator: string;
  questions: any[];
  subscriptionServiceId?: string;
  hasSubscription?: boolean;
  subscriptionService?: {
    serviceId: string;
    price: number;
    duration: number;
    totalRevenue: number;
    subscriberCount: number;
  };
}

export function MySurveys() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const navigate = useNavigate();
  const packageId = ConfigService.getPackageId();
  
  const [mySurveys, setMySurveys] = useState<SurveyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  const [stats, setStats] = useState({
    totalSurveys: 0,
    activeSurveys: 0,
    totalResponses: 0,
    totalRewardsDistributed: 0,
    totalRewardsRemaining: 0,
    surveysWithSubscription: 0,
    totalSubscriptionRevenue: 0,
    totalSubscribers: 0
  });

  // Toast notifications
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  }>>([]);

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  // Navigation functions
  const viewSurveyDetails = (surveyId: string) => {
    navigate(`/app/survey/${surveyId}`);
  };

  const handleManageSurvey = (surveyId: string) => {
    navigate(`/app/manage/${surveyId}`);
  };

  const createNewSurvey = () => {
    navigate('/app/create-survey');
  };

  const shareSubscriptionLink = (serviceId: string) => {
    const link = `${window.location.origin}/app/subscriptions/${serviceId}`;
    navigator.clipboard.writeText(link);
    showToast('success', 'Subscription link copied to clipboard!');
  };

  // Fetch survey details
  const fetchSurveyDetails = async (surveyId: string): Promise<SurveyData | null> => {
    try {
      const surveyObj = await suiClient.getObject({
        id: surveyId,
        options: {
          showContent: true,
          showType: true,
        }
      });

      if (!surveyObj.data?.type?.includes('::survey_system::Survey')) {
        return null;
      }

      if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
        const fields = surveyObj.data.content.fields as any;
        
        const questions = fields.questions?.map((q: any) => ({
          question_text: q.fields?.question_text || q.question_text || '',
          question_type: parseInt(q.fields?.question_type || q.question_type || '0'),
          options: q.fields?.options || q.options || []
        })) || [];

        const surveyData: SurveyData = {
          id: surveyId,
          title: fields.title || '',
          description: fields.description || '',
          category: fields.category || '',
          rewardPerResponse: fields.reward_per_response || '0',
          maxResponses: fields.max_responses || '0',
          currentResponses: fields.current_responses || '0',
          isActive: fields.is_active || false,
          createdAt: fields.created_at || '0',
          creator: fields.creator || '',
          questions: questions,
          subscriptionServiceId: fields.subscription_service_id
        };

        if (surveyData.subscriptionServiceId) {
          try {
            const serviceObj = await suiClient.getObject({
              id: surveyData.subscriptionServiceId,
              options: { showContent: true }
            });

            if (serviceObj.data?.content && 'fields' in serviceObj.data.content) {
              const serviceFields = serviceObj.data.content.fields as any;
              
              const subscriptionEvents = await suiClient.queryEvents({
                query: {
                  MoveEventType: `${packageId}::survey_system::SubscriptionPurchased`,
                },
                limit: 100,
              });
              
              const subscriberCount = subscriptionEvents.data.filter((event: any) => 
                event.parsedJson?.survey_id === surveyId
              ).length;

              surveyData.hasSubscription = true;
              surveyData.subscriptionService = {
                serviceId: surveyData.subscriptionServiceId,
                price: parseInt(serviceFields.price || '0'),
                duration: parseInt(serviceFields.duration_ms || '0'),
                totalRevenue: parseInt(serviceFields.total_revenue || '0'),
                subscriberCount
              };
            }
          } catch (error) {
            console.error('Error loading subscription service:', error);
          }
        }

        return surveyData;
      }
    } catch (error) {
      console.error(`Error fetching survey ${surveyId}:`, error);
    }
    return null;
  };

  // Load user's surveys
  const loadMySurveys = async () => {
    if (!currentAccount?.address) return;
    
    setLoading(true);
    try {
      const allSurveys: SurveyData[] = [];
      const surveyIdSet = new Set<string>();
      
      const registryId = ConfigService.getSurveyRegistryId();
      try {
        const registry = await suiClient.getObject({
          id: registryId,
          options: {
            showContent: true,
          }
        });

        if (registry.data?.content && 'fields' in registry.data.content) {
          // 使用类型断言处理Move结构体
          const fields = registry.data.content.fields as any;
          const surveysByCreatorTable = fields?.surveys_by_creator?.fields?.id?.id;
          
          if (surveysByCreatorTable) {
            try {
              const creatorField = await suiClient.getDynamicFieldObject({
                parentId: surveysByCreatorTable,
                name: {
                  type: 'address',
                  value: currentAccount.address,
                }
              });
              
              if (creatorField.data?.content && 'fields' in creatorField.data.content) {
                // 使用类型断言处理creatorField的fields
                const creatorFieldData = creatorField.data.content.fields as any;
                const surveyIds = creatorFieldData.value || [];
                
                for (const surveyId of surveyIds) {
                  if (!surveyIdSet.has(surveyId)) {
                    surveyIdSet.add(surveyId);
                    const surveyData = await fetchSurveyDetails(surveyId);
                    if (surveyData && surveyData.creator === currentAccount.address) {
                      allSurveys.push(surveyData);
                    }
                  }
                }
              }
            } catch (error) {
              console.log('No surveys found for user in registry');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching from registry:', error);
      }
      
      try {
        const capObjects = await suiClient.getOwnedObjects({
          owner: currentAccount.address,
          filter: {
            StructType: `${packageId}::survey_system::SurveyCap`,
          },
          options: { showContent: true, showType: true }
        });
        
        for (const cap of capObjects.data) {
          if (cap.data?.content && 'fields' in cap.data.content) {
            const capFields = cap.data.content.fields as any;
            const surveyId = capFields.survey_id;
            const capId = cap.data.objectId;
            
            const existingSurvey = allSurveys.find(s => s.id === surveyId);
            if (existingSurvey) {
              existingSurvey.capId = capId;
            } else if (!surveyIdSet.has(surveyId)) {
              const surveyData = await fetchSurveyDetails(surveyId);
              if (surveyData && surveyData.creator === currentAccount.address) {
                surveyData.capId = capId;
                allSurveys.push(surveyData);
                surveyIdSet.add(surveyId);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching SurveyCaps:', error);
      }
      
      allSurveys.sort((a, b) => {
        return parseInt(b.createdAt || '0') - parseInt(a.createdAt || '0');
      });
      
      setMySurveys(allSurveys);
      
      // Calculate stats
      const completedSurveys = allSurveys.filter(s => {
        const current = parseInt(s.currentResponses || '0');
        const max = parseInt(s.maxResponses || '0');
        return max > 0 && current >= max;
      }).length;
      
      const trulyActiveSurveys = allSurveys.filter(s => {
        const current = parseInt(s.currentResponses || '0');
        const max = parseInt(s.maxResponses || '0');
        const isCompleted = max > 0 && current >= max;
        return !isCompleted && s.isActive;
      }).length;
      
      const totalResponses = allSurveys.reduce((sum, s) => 
        sum + parseInt(s.currentResponses || '0'), 0
      );
      const totalRewardsDistributed = allSurveys.reduce((sum, s) => 
        sum + (parseInt(s.currentResponses || '0') * parseInt(s.rewardPerResponse || '0')), 0
      );
      const totalRewardsRemaining = allSurveys.reduce((sum, s) => {
        const remaining = Math.max(0, parseInt(s.maxResponses || '0') - parseInt(s.currentResponses || '0'));
        return sum + (remaining * parseInt(s.rewardPerResponse || '0'));
      }, 0);
      
      const surveysWithSubscription = allSurveys.filter(s => s.hasSubscription).length;
      const totalSubscriptionRevenue = allSurveys.reduce((sum, s) => 
        sum + (s.subscriptionService?.totalRevenue || 0), 0
      );
      const totalSubscribers = allSurveys.reduce((sum, s) => 
        sum + (s.subscriptionService?.subscriberCount || 0), 0
      );
      
      setStats({
        totalSurveys: allSurveys.length,
        activeSurveys: trulyActiveSurveys,
        totalResponses,
        totalRewardsDistributed,
        totalRewardsRemaining,
        surveysWithSubscription,
        totalSubscriptionRevenue,
        totalSubscribers
      });
      
      if (!loading) {
        showToast('success', `Loaded ${allSurveys.length} surveys`);
      }
    } catch (error) {
      console.error('Error loading surveys:', error);
      showToast('error', 'Failed to load surveys');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadMySurveys();
  };

  useEffect(() => {
    if (currentAccount?.address) {
      loadMySurveys();
    } else {
      setLoading(false);
    }
  }, [currentAccount?.address]);

  const formatSUI = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseInt(amount) : amount;
    return (value / 1000000000).toFixed(4);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString();
  };

  const formatDuration = (ms: number) => {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const getCompletionRate = (current: string, max: string) => {
    const curr = parseInt(current);
    const maximum = parseInt(max);
    if (maximum === 0) return 0;
    return (curr / maximum) * 100;
  };

  const isSurveyCompleted = (survey: SurveyData) => {
    const current = parseInt(survey.currentResponses || '0');
    const max = parseInt(survey.maxResponses || '0');
    return max > 0 && current >= max;
  };

  const filteredSurveys = mySurveys.filter(survey => {
    const isCompleted = isSurveyCompleted(survey);
    if (activeTab === 'active') return !isCompleted && survey.isActive;
    if (activeTab === 'completed') return isCompleted || !survey.isActive;
    if (activeTab === 'subscription') return survey.hasSubscription;
    return true;
  });

  // Skeleton Card Component
  const SkeletonCard = () => (
    <div className="mys-skeleton-card">
      <div className="mys-skeleton-header">
        <div className="mys-skeleton-badge"></div>
        <div className="mys-skeleton-badges"></div>
      </div>
      <div className="mys-skeleton-title"></div>
      <div className="mys-skeleton-description"></div>
      <div className="mys-skeleton-stats">
        <div className="mys-skeleton-stat"></div>
        <div className="mys-skeleton-stat"></div>
        <div className="mys-skeleton-stat"></div>
      </div>
      <div className="mys-skeleton-progress"></div>
      <div className="mys-skeleton-actions">
        <div className="mys-skeleton-button"></div>
        <div className="mys-skeleton-button"></div>
      </div>
    </div>
  );

  if (!currentAccount) {
    return (
      <div className="mys-container">
        <div className="mys-connect-wallet">
          <Wallet size={48} />
          <h2>Connect Your Wallet</h2>
          <p>Please connect your wallet to view and manage your surveys</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mys-container">
      {/* Header */}
      <div className="mys-header">
        <div className="mys-header-content">
          <div className="mys-header-info">
            <h1 className="mys-title">My Surveys</h1>
            <p className="mys-subtitle">Manage your surveys and subscription services</p>
          </div>
          <div className="mys-header-actions">
            <button className="mys-btn primary" onClick={createNewSurvey}>
              <Plus size={16} />
              Create Survey
            </button>
            <button 
              className="mys-btn secondary" 
              onClick={handleRefresh} 
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? 'mys-spinning' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="mys-stats-grid">
          <div className="mys-stat-card">
            <div className="mys-stat-icon blue">
              <Package size={20} />
            </div>
            <div className="mys-stat-content">
              <div className="mys-stat-label">Total Surveys</div>
              <div className="mys-stat-value">{stats.totalSurveys}</div>
            </div>
          </div>
          
          <div className="mys-stat-card">
            <div className="mys-stat-icon green">
              <CheckCircle size={20} />
            </div>
            <div className="mys-stat-content">
              <div className="mys-stat-label">Active</div>
              <div className="mys-stat-value">{stats.activeSurveys}</div>
            </div>
          </div>
          
          <div className="mys-stat-card">
            <div className="mys-stat-icon purple">
              <Gift size={20} />
            </div>
            <div className="mys-stat-content">
              <div className="mys-stat-label">With Subscription</div>
              <div className="mys-stat-value">{stats.surveysWithSubscription}</div>
            </div>
          </div>
          
          <div className="mys-stat-card">
            <div className="mys-stat-icon cyan">
              <TrendingUp size={20} />
            </div>
            <div className="mys-stat-content">
              <div className="mys-stat-label">Subscription Revenue</div>
              <div className="mys-stat-value">{formatSUI(stats.totalSubscriptionRevenue)} SUI</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mys-tabs-section">
        <div className="mys-tabs">
          <button 
            className={`mys-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All
            <span className="mys-tab-count">{mySurveys.length}</span>
          </button>
          <button 
            className={`mys-tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active
            <span className="mys-tab-count">
              {mySurveys.filter(s => !isSurveyCompleted(s) && s.isActive).length}
            </span>
          </button>
          <button 
            className={`mys-tab ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed
            <span className="mys-tab-count">
              {mySurveys.filter(s => isSurveyCompleted(s) || !s.isActive).length}
            </span>
          </button>
          <button 
            className={`mys-tab ${activeTab === 'subscription' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscription')}
          >
            <Gift size={14} />
            With Subscription
            <span className="mys-tab-count">{mySurveys.filter(s => s.hasSubscription).length}</span>
          </button>
        </div>
      </div>

      {/* Surveys Grid */}
      <div className="mys-surveys-section">
        {loading ? (
          <div className="mys-surveys-grid">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredSurveys.length === 0 ? (
          <div className="mys-empty-state">
            <BarChart size={48} />
            <h3>
              {activeTab === 'active' ? 'No active surveys' : 
               activeTab === 'completed' ? 'No completed surveys' : 
               activeTab === 'subscription' ? 'No surveys with subscription' :
               'No surveys created yet'}
            </h3>
            {mySurveys.length === 0 && (
              <>
                <p>Create your first survey to start collecting responses</p>
                <button className="mys-btn primary" onClick={createNewSurvey}>
                  <Plus size={16} />
                  Create Your First Survey
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="mys-surveys-grid">
            {filteredSurveys.map(survey => (
              <div key={survey.id} className={`mys-survey-card ${isSurveyCompleted(survey) ? 'completed' : ''}`}>
                {/* Card Header */}
                <div className="mys-card-header">
                  <span className="mys-category-badge">{survey.category}</span>
                  <div className="mys-header-badges">
                    <span className={`mys-status-badge ${
                      isSurveyCompleted(survey) ? 'completed' : 
                      survey.isActive ? 'active' : 'closed'
                    }`}>
                      {isSurveyCompleted(survey) ? (
                        <>
                          <CheckCircle size={12} />
                          Completed
                        </>
                      ) : survey.isActive ? (
                        <>
                          <Clock size={12} />
                          Active
                        </>
                      ) : (
                        <>
                          <X size={12} />
                          Closed
                        </>
                      )}
                    </span>
                    {survey.hasSubscription && (
                      <span className="mys-subscription-badge">
                        <DollarSign size={12} />
                      </span>
                    )}
                    {!survey.capId && (
                      <span className="mys-no-cap-badge" title="SurveyCap not found">
                        <AlertCircle size={12} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <h3 className="mys-card-title">{survey.title}</h3>
                <p className="mys-card-description">{survey.description}</p>

                {/* Survey Info */}
                <div className="mys-card-info">
                  <div className="mys-info-item">
                    <Calendar size={14} />
                    <span>{formatDate(survey.createdAt)}</span>
                  </div>
                  <div className="mys-info-item">
                    <FileText size={14} />
                    <span>{survey.questions.length} Questions</span>
                  </div>
                  <div className="mys-info-item">
                    <Coins size={14} />
                    <span>{formatSUI(survey.rewardPerResponse)} SUI/response</span>
                  </div>
                </div>

                {/* Response Progress */}
                <div className="mys-response-section">
                  <div className="mys-response-header">
                    <div className="mys-response-label">
                      <Users size={14} />
                      Responses
                    </div>
                    <div className="mys-response-count">
                      {survey.currentResponses} / {survey.maxResponses}
                    </div>
                  </div>
                  <div className="mys-progress-bar">
                    <div 
                      className="mys-progress-fill"
                      style={{ width: `${Math.min(100, getCompletionRate(survey.currentResponses, survey.maxResponses))}%` }}
                    />
                  </div>
                  <div className="mys-progress-percent">
                    {getCompletionRate(survey.currentResponses, survey.maxResponses).toFixed(0)}% Complete
                  </div>
                </div>

                {/* Subscription Info */}
                {survey.hasSubscription && survey.subscriptionService && (
                  <div className="mys-subscription-info">
                    <div className="mys-subscription-header">
                      <Gift size={14} />
                      Subscription Service
                    </div>
                    <div className="mys-subscription-stats">
                      <div className="mys-subscription-stat">
                        <span className="mys-subscription-label">Revenue</span>
                        <span className="mys-subscription-value">
                          {formatSUI(survey.subscriptionService.totalRevenue)} SUI
                        </span>
                      </div>
                      <div className="mys-subscription-stat">
                        <span className="mys-subscription-label">Subscribers</span>
                        <span className="mys-subscription-value">
                          {survey.subscriptionService.subscriberCount}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Card Actions */}
                <div className="mys-card-actions">
                  <button 
                    className="mys-action-btn primary"
                    onClick={() => handleManageSurvey(survey.id)}
                  >
                    <Settings size={16} />
                    Manage
                  </button>
                  <button 
                    className="mys-action-btn secondary"
                    onClick={() => viewSurveyDetails(survey.id)}
                  >
                    <Eye size={16} />
                    View
                  </button>
                  {survey.hasSubscription && survey.subscriptionService && (
                    <button 
                      className="mys-action-btn icon"
                      onClick={() => shareSubscriptionLink(survey.subscriptionService!.serviceId)}
                      title="Share subscription link"
                    >
                      <ExternalLink size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <div className="mys-toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`mys-toast ${toast.type}`}>
            {toast.type === 'success' && <CheckCircle size={16} />}
            {toast.type === 'error' && <AlertCircle size={16} />}
            {toast.type === 'warning' && <AlertCircle size={16} />}
            {toast.type === 'info' && <AlertCircle size={16} />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MySurveys;