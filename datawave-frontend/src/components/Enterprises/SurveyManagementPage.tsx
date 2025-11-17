// src/components/Enterprise/SurveyManagementPage.tsx
import { useState, useEffect } from 'react';
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useParams, useNavigate } from 'react-router-dom';
import { Transaction } from '@mysten/sui/transactions';
import { ConfigService } from '../../services/config';
import { 
  Users,
  DollarSign,
  Shield,
  Copy,
  ExternalLink,
  CheckCircle,
  Gift,
  UserPlus,
  UserMinus,
  Key,
  Eye,
  RefreshCw,
  Share2,
  AlertCircle,
  Clock,
  TrendingUp,
  User,
  Calendar,
  ArrowLeft,
  Unlock,
  BarChart3,
  CreditCard,
  X
} from 'lucide-react';
import './SurveyManagementPage.css';


// Import the decryption component
import { SurveyDecryption } from './SurveyDecryption';

interface SurveyDetails {
  id: string;
  capId?: string;
  title: string;
  description: string;
  category: string;
  questions: any[];
  rewardPerResponse: string;
  maxResponses: string;
  currentResponses: string;
  isActive: boolean;
  createdAt: string;
  creator: string;
  allowlist: string[];
  subscriptionServiceId?: string;
  hasSubscription?: boolean;
  subscriptionService?: {
    serviceId: string;
    price: number;
    duration: number;
    totalRevenue: number;
    subscribers: SubscriberInfo[];
  };
  consentingUsers: string[];
  consentingUsersCount: number;
}

interface SubscriberInfo {
  address: string;
  subscriptionId: string;
  createdAt: number;
  expiresAt: number;
  isExpired: boolean;
}

export function SurveyManagementPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const packageId = ConfigService.getPackageId();
  
  const [survey, setSurvey] = useState<SurveyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  
  // Subscription management
  const [showCreateSubscription, setShowCreateSubscription] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState('');
  const [subscriptionDuration, setSubscriptionDuration] = useState('');
  const [creatingSubscription, setCreatingSubscription] = useState(false);
  const [showSubscribers, setShowSubscribers] = useState(false);
  
  // Allowlist management
  const [showAddToAllowlist, setShowAddToAllowlist] = useState(false);
  const [newAllowlistAddress, setNewAllowlistAddress] = useState('');
  const [addingToAllowlist, setAddingToAllowlist] = useState(false);
  const [removingFromAllowlist, setRemovingFromAllowlist] = useState<string | null>(null);
  
  // Error handling
  const [error, setError] = useState<string | null>(null);
  
  // Toast notifications
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning';
    message: string;
  }>>([]);

  const showToast = (type: 'success' | 'error' | 'warning', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };
  
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
  const viewSurveyDetails = () => {
    navigate(`/app/survey/${surveyId}`);
  };

  const backToMySurveys = () => {
    navigate('/app/my-surveys');
  };
  
  // Load survey details
  const loadSurveyDetails = async () => {
    if (!surveyId || !currentAccount?.address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const surveyObj = await suiClient.getObject({
        id: surveyId,
        options: { showContent: true }
      });
      
      if (!surveyObj.data?.content || !('fields' in surveyObj.data.content)) {
        throw new Error('Invalid survey object');
      }
      
      const fields = surveyObj.data.content.fields as any;
      
      const questions = fields.questions?.map((q: any) => ({
        question_text: q.fields?.question_text || q.question_text || '',
        question_type: parseInt(q.fields?.question_type || q.question_type || '0'),
        options: q.fields?.options || q.options || []
      })) || [];
      
      let allowlistData: string[] = [];
      if (fields.allowlist?.fields?.contents) {
        allowlistData = fields.allowlist.fields.contents;
      } else if (Array.isArray(fields.allowlist)) {
        allowlistData = fields.allowlist;
      }
      
      let capId = undefined;
      let isOwner = false;
      
      try {
        const capObjects = await suiClient.getOwnedObjects({
          owner: currentAccount.address,
          filter: {
            StructType: `${packageId}::survey_system::SurveyCap`,
          },
          options: { showContent: true }
        });
        
        for (const cap of capObjects.data) {
          if (cap.data?.content && 'fields' in cap.data.content) {
            const capFields = cap.data.content.fields as any;
            if (capFields.survey_id === surveyId) {
              capId = cap.data.objectId;
              isOwner = true;
              
              localStorage.setItem(`survey_${surveyId}`, JSON.stringify({
                capId: capId,
                creator: currentAccount.address,
                timestamp: Date.now()
              }));
              break;
            }
          }
        }
        
        if (!capId) {
          const localData = localStorage.getItem(`survey_${surveyId}`);
          if (localData) {
            const parsed = JSON.parse(localData);
            if (parsed.creator === currentAccount.address) {
              capId = parsed.capId;
              
              try {
                const capObj = await suiClient.getObject({
                  id: capId,
                  options: { showContent: true }
                });
                
                if (capObj.data?.content && 'fields' in capObj.data.content) {
                  const capFields = capObj.data.content.fields as any;
                  if (capFields.survey_id === surveyId) {
                    isOwner = true;
                  } else {
                    localStorage.removeItem(`survey_${surveyId}`);
                    capId = undefined;
                  }
                }
              } catch (error) {
                localStorage.removeItem(`survey_${surveyId}`);
                capId = undefined;
              }
            }
          }
        }
        
        if (fields.creator === currentAccount.address) {
          isOwner = true;
        }
      } catch (error) {
        console.error('Error searching for SurveyCap:', error);
      }
      
      if (!isOwner) {
        setError('You are not the owner of this survey');
        setLoading(false);
        return;
      }
      
      const surveyDetails: SurveyDetails = {
        id: surveyId,
        capId,
        title: fields.title || '',
        description: fields.description || '',
        category: fields.category || '',
        questions,
        rewardPerResponse: fields.reward_per_response || '0',
        maxResponses: fields.max_responses || '0',
        currentResponses: fields.current_responses || '0',
        isActive: fields.is_active || false,
        createdAt: fields.created_at || '0',
        creator: fields.creator || '',
        allowlist: allowlistData,
        consentingUsers: fields.consenting_users || [],
        consentingUsersCount: parseInt(fields.consenting_users_count || '0'),
        subscriptionServiceId: fields.subscription_service_id
      };
      
      if (surveyDetails.subscriptionServiceId) {
        try {
          const serviceObj = await suiClient.getObject({
            id: surveyDetails.subscriptionServiceId,
            options: { showContent: true }
          });
          
          if (serviceObj.data?.content && 'fields' in serviceObj.data.content) {
            const serviceFields = serviceObj.data.content.fields as any;
            
            const subscribers: SubscriberInfo[] = [];
            
            const subscriptionEvents = await suiClient.queryEvents({
              query: {
                MoveEventType: `${packageId}::survey_system::SubscriptionPurchased`,
              },
              limit: 100,
            });
            
            const currentTime = Date.now();
            
            for (const event of subscriptionEvents.data) {
              const eventData = event.parsedJson as any;
              if (eventData?.survey_id === surveyId) {
                const eventData = event.parsedJson as any; // 添加类型断言
                subscribers.push({
                  address: eventData.subscriber || '',
                  subscriptionId: event.id?.txDigest || 'Unknown',
                  createdAt: parseInt(event.timestampMs || '0'),
                  expiresAt: parseInt(eventData.expires_at || '0'),
                  isExpired: parseInt(eventData.expires_at || '0') < currentTime
                });
              }
            }
            
            surveyDetails.hasSubscription = true;
            surveyDetails.subscriptionService = {
              serviceId: surveyDetails.subscriptionServiceId,
              price: parseInt(serviceFields.price || '0'),
              duration: parseInt(serviceFields.duration_ms || '0'),
              totalRevenue: parseInt(serviceFields.total_revenue || '0'),
              subscribers: subscribers
            };
          }
        } catch (error) {
          console.error('Error loading subscription service:', error);
        }
      }
      
      setSurvey(surveyDetails);
    } catch (error: any) {
      console.error('Error loading survey:', error);
      setError(error.message || 'Failed to load survey');
    } finally {
      setLoading(false);
    }
  };
  
  // Create subscription service
  const createSubscriptionService = () => {
    if (!survey?.capId || !subscriptionPrice || !subscriptionDuration) {
      showToast('error', survey?.capId ? 'Missing required information' : 'SurveyCap not found');
      return;
    }
    
    setCreatingSubscription(true);
    const priceInMist = parseInt(subscriptionPrice);
    const durationMs = parseInt(subscriptionDuration) * 60 * 60 * 1000;
    
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::survey_system::create_subscription_service_entry`,
      arguments: [
        tx.object(survey.id),
        tx.object(survey.capId),
        tx.pure.u64(priceInMist),
        tx.pure.u64(durationMs),
      ],
    });
    
    signAndExecute(
      { transaction: tx as any},
      {
        onSuccess: async () => {
          showToast('success', 'Subscription service created successfully!');
          setShowCreateSubscription(false);
          setSubscriptionPrice('');
          setSubscriptionDuration('');
          setTimeout(() => {
            loadSurveyDetails();
          }, 2000);
        },
        onError: (error) => {
          showToast('error', error.message);
        },
        onSettled: () => {
          setCreatingSubscription(false);
        }
      },
    );
  };
  
  // Add to allowlist
  const addToAllowlist = () => {
    if (!survey?.capId || !newAllowlistAddress) {
      showToast('error', survey?.capId ? 'Please enter an address' : 'SurveyCap not found');
      return;
    }
    
    if (!newAllowlistAddress.startsWith('0x') || newAllowlistAddress.length !== 66) {
      showToast('error', 'Invalid Sui address format');
      return;
    }
    
    if (survey.allowlist.includes(newAllowlistAddress)) {
      showToast('warning', 'Address already in allowlist');
      return;
    }
    
    setAddingToAllowlist(true);
    
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::survey_system::add_to_allowlist`,
      arguments: [
        tx.object(survey.id),
        tx.object(survey.capId),
        tx.pure.address(newAllowlistAddress),
      ],
    });
    
    signAndExecute(
      { transaction: tx as any},
      {
        onSuccess: () => {
          showToast('success', 'Address added to allowlist');
          setShowAddToAllowlist(false);
          setNewAllowlistAddress('');
          loadSurveyDetails();
        },
        onError: (error) => {
          showToast('error', error.message);
        },
        onSettled: () => {
          setAddingToAllowlist(false);
        }
      },
    );
  };
  
  // Remove from allowlist
  const removeFromAllowlist = (address: string) => {
    if (!survey?.capId) {
      showToast('error', 'SurveyCap not found');
      return;
    }
    
    if (address === survey.creator) {
      showToast('warning', 'Cannot remove survey creator from allowlist');
      return;
    }
    
    setRemovingFromAllowlist(address);
    
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::survey_system::remove_from_allowlist`,
      arguments: [
        tx.object(survey.id),
        tx.object(survey.capId),
        tx.pure.address(address),
      ],
    });
    
    signAndExecute(
      { transaction: tx as any},
      {
        onSuccess: () => {
          showToast('success', 'Address removed from allowlist');
          loadSurveyDetails();
        },
        onError: (error) => {
          showToast('error', error.message);
        },
        onSettled: () => {
          setRemovingFromAllowlist(null);
        }
      },
    );
  };
  
  useEffect(() => {
    loadSurveyDetails();
  }, [surveyId, currentAccount?.address]);
  
  // Helper functions
  const formatSUI = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseInt(amount) : amount;
    return (value / 1000000000).toFixed(4);
  };
  
  const formatDuration = (ms: number) => {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) return `${hours} hours`;
    return `${Math.floor(hours / 24)} days`;
  };
  
  const formatDate = (timestamp: string | number) => {
    const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    return new Date(ts).toLocaleString();
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('success', 'Copied to clipboard!');
  };
  
  const shareSubscriptionLink = () => {
    if (!survey?.subscriptionService) return;
    const link = `${window.location.origin}/app/subscriptions/${survey.subscriptionService.serviceId}`;
    copyToClipboard(link);
  };

  // Render states
  if (loading) {
    return (
      <div className="sm-container">
        <div className="sm-loading">
          <div className="sm-loading-spinner"></div>
          <div className="sm-loading-text">Loading survey...</div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="sm-container">
        <div className="sm-error-state">
          <AlertCircle size={48} />
          <h2>{error}</h2>
          <button className="sm-btn primary" onClick={backToMySurveys}>
            <ArrowLeft size={16} />
            Back to My Surveys
          </button>
        </div>
      </div>
    );
  }
  
  if (!survey) {
    return (
      <div className="sm-container">
        <div className="sm-error-state">
          <AlertCircle size={48} />
          <h2>Survey not found</h2>
          <button className="sm-btn primary" onClick={backToMySurveys}>
            <ArrowLeft size={16} />
            Back to My Surveys
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="sm-container">
      {/* Header */}
      <div className="sm-header">
        <div className="sm-header-content">
          <div className="sm-header-info">
            <div className="sm-title-row">
              <h1 className="sm-title">{survey.title}</h1>
              <div className="sm-badges">
                <span className={`sm-badge ${survey.isActive ? 'active' : 'inactive'}`}>
                  {survey.isActive ? 'Active' : 'Closed'}
                </span>
                {survey.hasSubscription && (
                  <span className="sm-badge subscription">Has Subscription</span>
                )}
                {!survey.capId && (
                  <span className="sm-badge warning">Limited Access</span>
                )}
              </div>
            </div>
            <p className="sm-description">{survey.description}</p>
          </div>
          
          <div className="sm-header-actions">
            <button className="sm-btn secondary" onClick={backToMySurveys}>
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              className="sm-btn secondary"
              onClick={() => {
                setRefreshing(true);
                loadSurveyDetails().finally(() => setRefreshing(false));
              }}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? 'sm-spinning' : ''} />
              Refresh
            </button>
            <button className="sm-btn secondary" onClick={viewSurveyDetails}>
              <Eye size={16} />
              View Details
            </button>
            <button
              className="sm-btn secondary"
              onClick={() => window.open(`https://suiscan.xyz/testnet/object/${survey.id}`, '_blank')}
            >
              <ExternalLink size={16} />
              Explorer
            </button>
          </div>
        </div>
        
        {!survey.capId && (
          <div className="sm-warning-banner">
            <AlertCircle size={16} />
            <span>SurveyCap not found. Some management functions may be limited.</span>
          </div>
        )}
        
        {/* Stats Cards */}
        <div className="sm-stats-grid">
          <div className="sm-stat-card">
            <div className="sm-stat-icon">
              <Users size={20} />
            </div>
            <div className="sm-stat-content">
              <div className="sm-stat-label">Responses</div>
              <div className="sm-stat-value">
                {survey.currentResponses} / {survey.maxResponses}
              </div>
            </div>
          </div>
          
          <div className="sm-stat-card">
            <div className="sm-stat-icon">
              <DollarSign size={20} />
            </div>
            <div className="sm-stat-content">
              <div className="sm-stat-label">Reward per Response</div>
              <div className="sm-stat-value">{formatSUI(survey.rewardPerResponse)} SUI</div>
            </div>
          </div>
          
          <div className="sm-stat-card">
            <div className="sm-stat-icon">
              <Shield size={20} />
            </div>
            <div className="sm-stat-content">
              <div className="sm-stat-label">Allowlist Size</div>
              <div className="sm-stat-value">{survey.allowlist.length} addresses</div>
            </div>
          </div>
          
          <div className="sm-stat-card">
            <div className="sm-stat-icon">
              <CheckCircle size={20} />
            </div>
            <div className="sm-stat-content">
              <div className="sm-stat-label">Consenting Users</div>
              <div className="sm-stat-value">{survey.consentingUsersCount}</div>
            </div>
          </div>
          
          {survey.hasSubscription && survey.subscriptionService && (
            <>
              <div className="sm-stat-card">
                <div className="sm-stat-icon">
                  <TrendingUp size={20} />
                </div>
                <div className="sm-stat-content">
                  <div className="sm-stat-label">Subscription Revenue</div>
                  <div className="sm-stat-value success">
                    {formatSUI(survey.subscriptionService.totalRevenue)} SUI
                  </div>
                </div>
              </div>
              
              <div className="sm-stat-card">
                <div className="sm-stat-icon">
                  <CreditCard size={20} />
                </div>
                <div className="sm-stat-content">
                  <div className="sm-stat-label">Subscribers</div>
                  <div className="sm-stat-value">{survey.subscriptionService.subscribers.length}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Tabs */}
      <div className="sm-tabs">
        <div className="sm-tabs-list">
          <button
            className={`sm-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <BarChart3 size={16} />
            Overview
          </button>
          <button
            className={`sm-tab ${activeTab === 'subscription' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscription')}
          >
            <DollarSign size={16} />
            Subscription Service
            {survey.subscriptionService && survey.subscriptionService.subscribers.length > 0 && (
              <span className="sm-tab-badge">{survey.subscriptionService.subscribers.length}</span>
            )}
          </button>
          <button
            className={`sm-tab ${activeTab === 'allowlist' ? 'active' : ''}`}
            onClick={() => setActiveTab('allowlist')}
          >
            <Shield size={16} />
            Allowlist ({survey.allowlist.length})
          </button>
          <button
            className={`sm-tab ${activeTab === 'decrypt' ? 'active' : ''}`}
            onClick={() => setActiveTab('decrypt')}
          >
            <Unlock size={16} />
            Decrypt Answers
          </button>
        </div>
        
        <div className="sm-tab-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="sm-overview-content">
              <div className="sm-info-section">
                <h3>Survey Information</h3>
                <div className="sm-info-grid">
                  <div className="sm-info-item">
                    <span className="sm-info-label">Survey ID:</span>
                    <div className="sm-info-value">
                      <code>{survey.id.slice(0, 16)}...</code>
                      <button className="sm-copy-btn" onClick={() => copyToClipboard(survey.id)}>
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {survey.capId && (
                    <div className="sm-info-item">
                      <span className="sm-info-label">SurveyCap ID:</span>
                      <div className="sm-info-value">
                        <code>{survey.capId.slice(0, 16)}...</code>
                        <button className="sm-copy-btn" onClick={() => survey.capId && copyToClipboard(survey.capId)}
>
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {survey.subscriptionServiceId && (
                    <div className="sm-info-item">
                      <span className="sm-info-label">Subscription Service ID:</span>
                      <div className="sm-info-value">
                        <code>{survey.subscriptionServiceId.slice(0, 16)}...</code>
                        <button className="sm-copy-btn" onClick={() => survey.subscriptionServiceId && copyToClipboard(survey.subscriptionServiceId)}
>
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="sm-info-item">
                    <span className="sm-info-label">Category:</span>
                    <div className="sm-info-value">
                      <span className="sm-category-tag">{survey.category}</span>
                    </div>
                  </div>
                  
                  <div className="sm-info-item">
                    <span className="sm-info-label">Created:</span>
                    <div className="sm-info-value">{formatDate(survey.createdAt)}</div>
                  </div>
                  
                  <div className="sm-info-item">
                    <span className="sm-info-label">Questions:</span>
                    <div className="sm-info-value">{survey.questions.length}</div>
                  </div>
                  
                  <div className="sm-info-item">
                    <span className="sm-info-label">Creator:</span>
                    <div className="sm-info-value">
                      <code>{survey.creator.slice(0, 6)}...{survey.creator.slice(-4)}</code>
                      {survey.creator === currentAccount?.address && (
                        <span className="sm-you-badge">You</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="sm-info-section">
                <h3>Financial Summary</h3>
                <div className="sm-financial-cards">
                  <div className="sm-financial-card">
                    <div className="sm-financial-label">Total Reward Pool</div>
                    <div className="sm-financial-value">
                      {formatSUI((parseInt(survey.rewardPerResponse) * parseInt(survey.maxResponses)).toString())} SUI
                    </div>
                  </div>
                  <div className="sm-financial-card success">
                    <div className="sm-financial-label">Distributed</div>
                    <div className="sm-financial-value">
                      {formatSUI((parseInt(survey.rewardPerResponse) * parseInt(survey.currentResponses)).toString())} SUI
                    </div>
                  </div>
                  <div className="sm-financial-card info">
                    <div className="sm-financial-label">Remaining</div>
                    <div className="sm-financial-value">
                      {formatSUI((parseInt(survey.rewardPerResponse) * 
                        (parseInt(survey.maxResponses) - parseInt(survey.currentResponses))).toString())} SUI
                    </div>
                  </div>
                </div>
              </div>
              
              {survey.questions.length > 0 && (
                <div className="sm-info-section">
                  <h3>Survey Questions ({survey.questions.length})</h3>
                  <div className="sm-questions-list">
                    {survey.questions.map((q, idx) => (
                      <div key={idx} className="sm-question-item">
                        <div className="sm-question-header">
                          <span className="sm-question-number">Q{idx + 1}</span>
                          <span className="sm-question-type">
                            {q.question_type === 0 ? 'Single Choice' : 'Multiple Choice'}
                          </span>
                        </div>
                        <div className="sm-question-text">{q.question_text}</div>
                        {q.options && q.options.length > 0 && (
                          <div className="sm-question-options">
                            {q.options.map((opt: string, optIdx: number) => (
                              <div key={optIdx} className="sm-option-item">
                                <span className="sm-option-marker">•</span>
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Subscription Tab */}
          {activeTab === 'subscription' && (
            <div className="sm-subscription-content">
              {survey.hasSubscription && survey.subscriptionService ? (
                <>
                  <div className="sm-subscription-stats">
                    <div className="sm-subscription-card">
                      <DollarSign size={24} />
                      <div>
                        <div className="sm-subscription-label">Price</div>
                        <div className="sm-subscription-value">{formatSUI(survey.subscriptionService.price)} SUI</div>
                      </div>
                    </div>
                    <div className="sm-subscription-card">
                      <Clock size={24} />
                      <div>
                        <div className="sm-subscription-label">Duration</div>
                        <div className="sm-subscription-value">{formatDuration(survey.subscriptionService.duration)}</div>
                      </div>
                    </div>
                    <div className="sm-subscription-card">
                      <TrendingUp size={24} />
                      <div>
                        <div className="sm-subscription-label">Total Revenue</div>
                        <div className="sm-subscription-value success">{formatSUI(survey.subscriptionService.totalRevenue)} SUI</div>
                      </div>
                    </div>
                    <div className="sm-subscription-card">
                      <Users size={24} />
                      <div>
                        <div className="sm-subscription-label">Active Subscribers</div>
                        <div className="sm-subscription-value">
                          {survey.subscriptionService.subscribers.filter(s => !s.isExpired).length} / {survey.subscriptionService.subscribers.length}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="sm-subscription-actions">
                    <button 
                      className="sm-btn secondary"
                      onClick={() => setShowSubscribers(true)}
                      disabled={survey.subscriptionService.subscribers.length === 0}
                    >
                      <Users size={16} />
                      View Subscribers ({survey.subscriptionService.subscribers.length})
                    </button>
                    <button className="sm-btn secondary" onClick={shareSubscriptionLink}>
                      <Share2 size={16} />
                      Share Link
                    </button>
                    <button 
                      className="sm-btn secondary"
                      onClick={() => window.open(`https://suiscan.xyz/testnet/object/${survey.subscriptionService!.serviceId}`, '_blank')}
                    >
                      <ExternalLink size={16} />
                      View on Chain
                    </button>
                  </div>
                  
                  {survey.subscriptionService.subscribers.length > 0 && (
                    <div className="sm-info-section">
                      <h3>Recent Subscribers</h3>
                      <div className="sm-subscribers-list">
                        {survey.subscriptionService.subscribers.slice(0, 5).map((subscriber, idx) => (
                          <div key={idx} className="sm-subscriber-item">
                            <div className="sm-subscriber-left">
                              <User size={16} />
                              <code>{subscriber.address.slice(0, 6)}...{subscriber.address.slice(-4)}</code>
                              <span className={`sm-subscriber-badge ${!subscriber.isExpired ? 'active' : 'expired'}`}>
                                {!subscriber.isExpired ? 'Active' : 'Expired'}
                              </span>
                            </div>
                            <div className="sm-subscriber-right">
                              <span className="sm-subscriber-date">
                                <Calendar size={14} />
                                Expires: {formatDate(subscriber.expiresAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {survey.subscriptionService.subscribers.length > 5 && (
                        <button className="sm-btn secondary full-width" onClick={() => setShowSubscribers(true)}>
                          View all {survey.subscriptionService.subscribers.length} subscribers
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div className="sm-info-section">
                    <h3>Subscription Link</h3>
                    <div className="sm-link-box">
                      <code className="sm-link-text">
                        {window.location.origin}/app/subscriptions/{survey.subscriptionService.serviceId}
                      </code>
                      <button className="sm-btn primary" onClick={shareSubscriptionLink}>
                        <Copy size={16} />
                        Copy Link
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="sm-empty-state">
                  <DollarSign size={48} />
                  <h3>No Subscription Service</h3>
                  <p>Create a subscription service to monetize access to survey answers.</p>
                  {survey.capId ? (
                    <button className="sm-btn primary" onClick={() => setShowCreateSubscription(true)}>
                      <Gift size={16} />
                      Create Subscription Service
                    </button>
                  ) : (
                    <p className="sm-error-text">SurveyCap not found. Cannot create subscription service.</p>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Allowlist Tab */}
          {activeTab === 'allowlist' && (
            <div className="sm-allowlist-content">
              <div className="sm-allowlist-header">
                <div>
                  <h3>Access Control List</h3>
                  <p>Manage who can decrypt survey answers without subscription</p>
                </div>
                <button className="sm-btn primary" onClick={() => setShowAddToAllowlist(true)} disabled={!survey.capId}>
                  <UserPlus size={16} />
                  Add Address
                </button>
              </div>
              
              {!survey.capId && (
                <div className="sm-warning-banner">
                  <AlertCircle size={16} />
                  <span>Cannot modify allowlist without SurveyCap</span>
                </div>
              )}
              
              <div className="sm-allowlist-stats">
                <div className="sm-allowlist-stat">
                  <Shield size={20} />
                  <div>
                    <div className="sm-allowlist-stat-value">{survey.allowlist.length}</div>
                    <div className="sm-allowlist-stat-label">Total Addresses</div>
                  </div>
                </div>
                <div className="sm-allowlist-stat">
                  <Key size={20} />
                  <div>
                    <div className="sm-allowlist-stat-value">Always</div>
                    <div className="sm-allowlist-stat-label">Creator Access</div>
                  </div>
                </div>
                <div className="sm-allowlist-stat">
                  <Users size={20} />
                  <div>
                    <div className="sm-allowlist-stat-value">{Math.max(0, survey.allowlist.length - 1)}</div>
                    <div className="sm-allowlist-stat-label">Custom Access</div>
                  </div>
                </div>
              </div>
              
              {survey.allowlist.length === 0 ? (
                <div className="sm-empty-state">
                  <Shield size={48} />
                  <h3>No addresses in allowlist</h3>
                  <p>Add addresses to grant direct access to survey answers</p>
                </div>
              ) : (
                <div className="sm-allowlist-members">
                  {survey.allowlist.map((address, idx) => (
                    <div key={address} className="sm-allowlist-member">
                      <div className="sm-member-left">
                        <span className="sm-member-index">{idx + 1}</span>
                        <code className="sm-member-address">
                          {address.slice(0, 10)}...{address.slice(-8)}
                        </code>
                        {address === survey.creator && (
                          <span className="sm-member-badge creator">Creator</span>
                        )}
                        {address === currentAccount?.address && address !== survey.creator && (
                          <span className="sm-member-badge you">You</span>
                        )}
                      </div>
                      <div className="sm-member-actions">
                        <button className="sm-icon-btn" onClick={() => copyToClipboard(address)}>
                          <Copy size={14} />
                        </button>
                        {address !== survey.creator && (
                          <button
                            className="sm-icon-btn danger"
                            onClick={() => removeFromAllowlist(address)}
                            disabled={removingFromAllowlist === address || !survey.capId}
                          >
                            {removingFromAllowlist === address ? (
                              <RefreshCw size={14} className="sm-spinning" />
                            ) : (
                              <UserMinus size={14} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Decrypt Tab */}
          {activeTab === 'decrypt' && (
            <SurveyDecryption surveyId={survey.id} isCreator={true} />
          )}
        </div>
      </div>
      
      {/* Modals */}
      
      {/* Subscribers Modal */}
      {showSubscribers && (
        <div className="sm-modal-overlay" onClick={() => setShowSubscribers(false)}>
          <div className="sm-modal" onClick={e => e.stopPropagation()}>
            <div className="sm-modal-header">
              <h2 className="sm-modal-title">Subscription Subscribers</h2>
              <button className="sm-modal-close" onClick={() => setShowSubscribers(false)}>
                <X size={20} />
              </button>
            </div>
            <p className="sm-modal-description">
              List of all users who have subscribed to access survey data
            </p>
            
            {survey?.subscriptionService && survey.subscriptionService.subscribers.length > 0 ? (
              <div className="sm-modal-subscribers-list">
                {survey.subscriptionService.subscribers.map((subscriber, idx) => (
                  <div key={idx} className="sm-modal-subscriber">
                    <div className="sm-modal-subscriber-info">
                      <div className="sm-modal-subscriber-header">
                        <User size={16} />
                        <code>{subscriber.address}</code>
                        <span className={`sm-subscriber-badge ${!subscriber.isExpired ? 'active' : 'expired'}`}>
                          {!subscriber.isExpired ? 'Active' : 'Expired'}
                        </span>
                      </div>
                      <div className="sm-modal-subscriber-dates">
                        <span>
                          <Calendar size={12} />
                          Subscribed: {formatDate(subscriber.createdAt)}
                        </span>
                        <span>
                          <Clock size={12} />
                          Expires: {formatDate(subscriber.expiresAt)}
                        </span>
                      </div>
                    </div>
                    <button className="sm-icon-btn" onClick={() => copyToClipboard(subscriber.address)}>
                      <Copy size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="sm-modal-empty">No subscribers yet</p>
            )}
            
            <div className="sm-modal-actions">
              <button className="sm-btn secondary" onClick={() => setShowSubscribers(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Create Subscription Modal */}
      {showCreateSubscription && (
        <div className="sm-modal-overlay" onClick={() => setShowCreateSubscription(false)}>
          <div className="sm-modal" onClick={e => e.stopPropagation()}>
            <div className="sm-modal-header">
              <h2 className="sm-modal-title">Create Subscription Service</h2>
              <button className="sm-modal-close" onClick={() => setShowCreateSubscription(false)}>
                <X size={20} />
              </button>
            </div>
            <p className="sm-modal-description">
              Set up a paid subscription for accessing survey answers
            </p>
            
            <div className="sm-modal-content">
              <div className="sm-form-group">
                <label className="sm-form-label">Subscription Price (in MIST)</label>
                <input
                  type="number"
                  className="sm-form-input"
                  placeholder="e.g., 1000000000 (1 SUI)"
                  value={subscriptionPrice}
                  onChange={(e) => setSubscriptionPrice(e.target.value)}
                />
                <span className="sm-form-hint">1 SUI = 1,000,000,000 MIST</span>
              </div>
              
              <div className="sm-form-group">
                <label className="sm-form-label">Duration (in hours)</label>
                <input
                  type="number"
                  className="sm-form-input"
                  placeholder="e.g., 24 for 1 day, 168 for 1 week"
                  value={subscriptionDuration}
                  onChange={(e) => setSubscriptionDuration(e.target.value)}
                />
                <span className="sm-form-hint">How long the subscription will be valid</span>
              </div>
            </div>
            
            <div className="sm-modal-actions">
              <button className="sm-btn secondary" onClick={() => setShowCreateSubscription(false)}>
                Cancel
              </button>
              <button
                className="sm-btn primary"
                onClick={createSubscriptionService}
                disabled={creatingSubscription || !subscriptionPrice || !subscriptionDuration}
              >
                {creatingSubscription ? (
                  <>
                    <RefreshCw size={16} className="sm-spinning" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Gift size={16} />
                    Create Service
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add to Allowlist Modal */}
      {showAddToAllowlist && (
        <div className="sm-modal-overlay" onClick={() => setShowAddToAllowlist(false)}>
          <div className="sm-modal" onClick={e => e.stopPropagation()}>
            <div className="sm-modal-header">
              <h2 className="sm-modal-title">Add to Allowlist</h2>
              <button className="sm-modal-close" onClick={() => setShowAddToAllowlist(false)}>
                <X size={20} />
              </button>
            </div>
            <p className="sm-modal-description">
              Add an address to grant direct access to survey answers
            </p>
            
            <div className="sm-modal-content">
              <div className="sm-form-group">
                <label className="sm-form-label">Sui Address</label>
                <input
                  type="text"
                  className="sm-form-input"
                  placeholder="0x..."
                  value={newAllowlistAddress}
                  onChange={(e) => setNewAllowlistAddress(e.target.value)}
                />
                <span className="sm-form-hint">
                  Must be a valid Sui address (66 characters starting with 0x)
                </span>
              </div>
            </div>
            
            <div className="sm-modal-actions">
              <button className="sm-btn secondary" onClick={() => setShowAddToAllowlist(false)}>
                Cancel
              </button>
              <button
                className="sm-btn primary"
                onClick={addToAllowlist}
                disabled={addingToAllowlist || !newAllowlistAddress}
              >
                {addingToAllowlist ? (
                  <>
                    <RefreshCw size={16} className="sm-spinning" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Add Address
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast Notifications */}
      <div className="sm-toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`sm-toast ${toast.type}`}>
            {toast.type === 'success' && <CheckCircle size={16} />}
            {toast.type === 'error' && <AlertCircle size={16} />}
            {toast.type === 'warning' && <AlertCircle size={16} />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SurveyManagementPage;