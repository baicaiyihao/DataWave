// src/components/Subscription/MySubscriptions.tsx
import { useState, useEffect } from 'react';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { ConfigService } from '../../services/config';
import { 
  Clock, 
  Calendar,
  Eye,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  FileText,
  Users,
  Wallet,
  DollarSign,
  X,
  Hash,
  Package,
  ShoppingCart
} from 'lucide-react';
import '../../css/MySubscriptions.css';

interface UserSubscription {
  subscriptionId: string;
  serviceId: string;
  surveyId: string;
  surveyTitle: string;
  surveyDescription: string;
  surveyCategory: string;
  createdAt: number;
  expiresAt: number;
  isExpired: boolean;
  responseCount: number;
  maxResponses: number;
  price: number;
  duration: number;
}

export function MySubscriptions() {
  const navigate = useNavigate();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const packageId = ConfigService.getPackageId();
  
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active');
  const [selectedSubscription, setSelectedSubscription] = useState<UserSubscription | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const [stats, setStats] = useState({
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    totalSpent: 0,
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

  // Navigation functions - Updated routes
  const viewSurveyAnswers = (surveyId: string, subscriptionId: string) => {
    navigate(`/app/subscription-decrypt/${surveyId}`, { 
      state: { subscriptionId } 
    });
  };

  const browseMoreSubscriptions = () => {
    navigate('/app/subscriptions');
  };

  const viewSurveyDetails = (surveyId: string) => {
    navigate(`/app/survey/${surveyId}`);
  };

  const loadUserSubscriptions = async () => {
    if (!currentAccount?.address) return;
    
    setLoading(true);
    try {
      // Get all Subscription NFTs owned by user
      const userSubscriptions = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        options: {
          showContent: true,
          showType: true,
        },
        filter: {
          StructType: `${packageId}::survey_system::Subscription`,
        },
      });

      console.log(`Found ${userSubscriptions.data.length} subscriptions for user`);

      const subscriptionData: UserSubscription[] = [];
      const now = Date.now();
      let totalSpent = 0;

      for (const sub of userSubscriptions.data) {
        if (sub.data?.content && 'fields' in sub.data.content) {
          const subFields = sub.data.content.fields as any;

          // Get survey details
          try {
            const survey = await suiClient.getObject({
              id: subFields.survey_id,
              options: { showContent: true },
            });
            
            if (survey.data?.content && 'fields' in survey.data.content) {
              const surveyFields = survey.data.content.fields as any;
              
              // Get service details for price info
              let price = 0;
              let duration = 0;
              
              try {
                const service = await suiClient.getObject({
                  id: subFields.service_id,
                  options: { showContent: true },
                });
                
                if (service.data?.content && 'fields' in service.data.content) {
                  const serviceFields = service.data.content.fields as any;
                  price = parseInt(serviceFields.price || '0');
                  duration = parseInt(serviceFields.duration_ms || '0');
                  totalSpent += price;
                }
              } catch (error) {
                console.error('Error loading service details:', error);
              }
              
              const expiresAt = parseInt(subFields.expires_at);
              
              subscriptionData.push({
                subscriptionId: sub.data.objectId,
                serviceId: subFields.service_id,
                surveyId: subFields.survey_id,
                surveyTitle: surveyFields.title || 'Unknown Survey',
                surveyDescription: surveyFields.description || '',
                surveyCategory: surveyFields.category || 'Uncategorized',
                createdAt: parseInt(subFields.created_at),
                expiresAt,
                isExpired: expiresAt < now,
                responseCount: parseInt(surveyFields.current_responses || '0'),
                maxResponses: parseInt(surveyFields.max_responses || '0'),
                price,
                duration,
              });
            }
          } catch (error) {
            console.error(`Error loading survey ${subFields.survey_id}:`, error);
          }
        }
      }

      // Sort by expiry date (active first, then by expiry date)
      subscriptionData.sort((a, b) => {
        if (a.isExpired !== b.isExpired) {
          return a.isExpired ? 1 : -1;
        }
        return b.expiresAt - a.expiresAt;
      });

      setSubscriptions(subscriptionData);
      
      // Calculate stats
      const activeCount = subscriptionData.filter(s => !s.isExpired).length;
      const expiredCount = subscriptionData.filter(s => s.isExpired).length;
      
      setStats({
        totalSubscriptions: subscriptionData.length,
        activeSubscriptions: activeCount,
        expiredSubscriptions: expiredCount,
        totalSpent,
      });
      
      if (!loading) {
        showToast('success', `Loaded ${subscriptionData.length} subscriptions`);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      showToast('error', 'Failed to load subscriptions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadUserSubscriptions();
  };

  const viewDetails = (subscription: UserSubscription) => {
    setSelectedSubscription(subscription);
    setShowDetailsModal(true);
  };

  useEffect(() => {
    loadUserSubscriptions();
    
    // Refresh every 30 seconds to update expiry status
    const interval = setInterval(loadUserSubscriptions, 30000);
    return () => clearInterval(interval);
  }, [currentAccount?.address]);

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatPrice = (mist: number): string => {
    const sui = mist / 1_000_000_000;
    return `${sui.toFixed(4)} SUI`;
  };

  const formatDuration = (ms: number): string => {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) {
      return `${hours} hours`;
    }
    return `${Math.floor(hours / 24)} days`;
  };

  const getTimeRemaining = (expiresAt: number): string => {
    const now = Date.now();
    const diff = expiresAt - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  // Skeleton loader component
  const SkeletonCard = () => (
    <div className="ms-skeleton-card">
      <div className="ms-skeleton-header">
        <div className="ms-skeleton-badge"></div>
        <div className="ms-skeleton-status"></div>
      </div>
      <div className="ms-skeleton-title"></div>
      <div className="ms-skeleton-description"></div>
      <div className="ms-skeleton-details">
        <div className="ms-skeleton-detail"></div>
        <div className="ms-skeleton-detail"></div>
        <div className="ms-skeleton-detail"></div>
      </div>
      <div className="ms-skeleton-timer"></div>
      <div className="ms-skeleton-actions">
        <div className="ms-skeleton-button"></div>
        <div className="ms-skeleton-button small"></div>
      </div>
    </div>
  );

  if (!currentAccount) {
    return (
      <div className="ms-container">
        <div className="ms-connect-wallet">
          <Wallet size={48} />
          <h2>Connect Your Wallet</h2>
          <p>Please connect your wallet to view your subscriptions</p>
        </div>
      </div>
    );
  }

  const activeSubscriptions = subscriptions.filter(s => !s.isExpired);
  const expiredSubscriptions = subscriptions.filter(s => s.isExpired);
  const displaySubscriptions = activeTab === 'active' ? activeSubscriptions : expiredSubscriptions;

  return (
    <div className="ms-container">
      {/* Header with Stats */}
      <div className="ms-header">
        <div className="ms-header-content">
          <div className="ms-header-info">
            <h1 className="ms-title">My Survey Subscriptions</h1>
            <p className="ms-subtitle">Manage your active and expired subscriptions</p>
          </div>
          <div className="ms-header-actions">
            <button 
              className="ms-btn secondary"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? 'ms-spinning' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button 
              className="ms-btn primary"
              onClick={browseMoreSubscriptions}
            >
              <ShoppingCart size={16} />
              Browse More
            </button>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="ms-stats-grid">
          <div className="ms-stat-card">
            <div className="ms-stat-icon blue">
              <Package size={20} />
            </div>
            <div className="ms-stat-content">
              <div className="ms-stat-label">Total Subscriptions</div>
              <div className="ms-stat-value">{stats.totalSubscriptions}</div>
            </div>
          </div>
          
          <div className="ms-stat-card">
            <div className="ms-stat-icon green">
              <CheckCircle size={20} />
            </div>
            <div className="ms-stat-content">
              <div className="ms-stat-label">Active</div>
              <div className="ms-stat-value success">{stats.activeSubscriptions}</div>
            </div>
          </div>
          
          <div className="ms-stat-card">
            <div className="ms-stat-icon gray">
              <XCircle size={20} />
            </div>
            <div className="ms-stat-content">
              <div className="ms-stat-label">Expired</div>
              <div className="ms-stat-value">{stats.expiredSubscriptions}</div>
            </div>
          </div>
          
          <div className="ms-stat-card">
            <div className="ms-stat-icon purple">
              <DollarSign size={20} />
            </div>
            <div className="ms-stat-content">
              <div className="ms-stat-label">Total Spent</div>
              <div className="ms-stat-value">{formatPrice(stats.totalSpent)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ms-tabs-section">
        <div className="ms-tabs">
          <button
            className={`ms-tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            <CheckCircle size={16} />
            Active ({activeSubscriptions.length})
          </button>
          <button
            className={`ms-tab ${activeTab === 'expired' ? 'active' : ''}`}
            onClick={() => setActiveTab('expired')}
          >
            <XCircle size={16} />
            Expired ({expiredSubscriptions.length})
          </button>
        </div>
      </div>

      {/* Subscriptions Grid */}
      <div className="ms-subscriptions-section">
        {loading ? (
          <div className="ms-subscriptions-grid">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : displaySubscriptions.length === 0 ? (
          <div className="ms-empty-state">
            {activeTab === 'active' ? (
              <>
                <AlertCircle size={48} />
                <h3>No Active Subscriptions</h3>
                <p>You don't have any active subscriptions</p>
                <button className="ms-btn primary" onClick={browseMoreSubscriptions}>
                  Browse Available Subscriptions
                </button>
              </>
            ) : (
              <>
                <Package size={48} />
                <h3>No Expired Subscriptions</h3>
                <p>All your subscriptions are currently active</p>
              </>
            )}
          </div>
        ) : (
          <div className="ms-subscriptions-grid">
            {displaySubscriptions.map((sub) => (
              <div 
                key={sub.subscriptionId} 
                className={`ms-subscription-card ${sub.isExpired ? 'expired' : 'active'}`}
              >
                {/* Card Header */}
                <div className="ms-card-header">
                  <span className="ms-category-badge">{sub.surveyCategory}</span>
                  <span className={`ms-status-badge ${sub.isExpired ? 'expired' : 'active'}`}>
                    {sub.isExpired ? (
                      <>
                        <XCircle size={12} />
                        Expired
                      </>
                    ) : (
                      <>
                        <CheckCircle size={12} />
                        Active
                      </>
                    )}
                  </span>
                </div>
                
                {/* Card Content */}
                <h3 className="ms-card-title">{sub.surveyTitle}</h3>
                <p className="ms-card-description">{sub.surveyDescription}</p>
                
                {/* Details */}
                <div className="ms-card-details">
                  <div className="ms-detail-row">
                    <span className="ms-detail-label">
                      <Hash size={12} />
                      ID:
                    </span>
                    <span className="ms-detail-value">
                      {sub.subscriptionId.slice(0, 8)}...
                    </span>
                  </div>
                  
                  <div className="ms-detail-row">
                    <span className="ms-detail-label">
                      <Users size={12} />
                      Responses:
                    </span>
                    <span className="ms-detail-value">
                      {sub.responseCount} / {sub.maxResponses}
                    </span>
                  </div>
                  
                  {sub.isExpired ? (
                    <div className="ms-detail-row">
                      <span className="ms-detail-label">
                        <Calendar size={12} />
                        Expired:
                      </span>
                      <span className="ms-detail-value expired">
                        {formatDate(sub.expiresAt)}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="ms-detail-row">
                        <span className="ms-detail-label">
                          <Calendar size={12} />
                          Subscribed:
                        </span>
                        <span className="ms-detail-value">
                          {formatDate(sub.createdAt)}
                        </span>
                      </div>
                      
                      <div className="ms-detail-row">
                        <span className="ms-detail-label">
                          <Clock size={12} />
                          Expires:
                        </span>
                        <span className="ms-detail-value">
                          {formatDate(sub.expiresAt)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Time Remaining or Expired Info */}
                {sub.isExpired ? (
                  <div className="ms-expired-info">
                    <div className="ms-expired-details">
                      <span>Duration: {formatDuration(sub.duration)}</span>
                      <span>•</span>
                      <span>Price: {formatPrice(sub.price)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="ms-time-remaining">
                    <Clock size={16} />
                    <span>{getTimeRemaining(sub.expiresAt)}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="ms-card-actions">
                  {sub.isExpired ? (
                    <>
                      <button
                        className="ms-btn secondary full"
                        onClick={browseMoreSubscriptions}
                      >
                        <RefreshCw size={16} />
                        Renew Subscription
                      </button>
                      <button
                        className="ms-icon-btn"
                        onClick={() => viewDetails(sub)}
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="ms-btn primary"
                        onClick={() => viewSurveyAnswers(sub.surveyId, sub.subscriptionId)}
                      >
                        <Eye size={16} />
                        View Answers
                      </button>
                      <button
                        className="ms-icon-btn"
                        onClick={() => viewDetails(sub)}
                        title="View details"
                      >
                        <FileText size={16} />
                      </button>
                      <button
                        className="ms-icon-btn"
                        onClick={() => window.open(`https://suiscan.xyz/testnet/object/${sub.subscriptionId}`, '_blank')}
                        title="View on explorer"
                      >
                        <ExternalLink size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedSubscription && (
        <div className="ms-modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="ms-modal" onClick={e => e.stopPropagation()}>
            <div className="ms-modal-header">
              <h2 className="ms-modal-title">Subscription Details</h2>
              <button 
                className="ms-modal-close" 
                onClick={() => setShowDetailsModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="ms-modal-content">
              <div className="ms-modal-section">
                <h3>Survey Information</h3>
                <div className="ms-modal-info-grid">
                  <div className="ms-modal-info-item">
                    <span className="ms-modal-label">Title:</span>
                    <span className="ms-modal-value">{selectedSubscription.surveyTitle}</span>
                  </div>
                  <div className="ms-modal-info-item">
                    <span className="ms-modal-label">Category:</span>
                    <span className="ms-modal-value">
                      <span className="ms-category-badge">{selectedSubscription.surveyCategory}</span>
                    </span>
                  </div>
                  <div className="ms-modal-info-item">
                    <span className="ms-modal-label">Description:</span>
                    <span className="ms-modal-value">{selectedSubscription.surveyDescription}</span>
                  </div>
                  <div className="ms-modal-info-item">
                    <span className="ms-modal-label">Total Responses:</span>
                    <span className="ms-modal-value">{selectedSubscription.responseCount} / {selectedSubscription.maxResponses}</span>
                  </div>
                </div>
              </div>
              
              <div className="ms-modal-section">
                <h3>Subscription Details</h3>
                <div className="ms-modal-info-grid">
                  <div className="ms-modal-info-item">
                    <span className="ms-modal-label">Subscription ID:</span>
                    <code className="ms-modal-value">{selectedSubscription.subscriptionId}</code>
                  </div>
                  <div className="ms-modal-info-item">
                    <span className="ms-modal-label">Survey ID:</span>
                    <code className="ms-modal-value">{selectedSubscription.surveyId}</code>
                  </div>
                  <div className="ms-modal-info-item">
                    <span className="ms-modal-label">Price Paid:</span>
                    <span className="ms-modal-value">{formatPrice(selectedSubscription.price)}</span>
                  </div>
                  <div className="ms-modal-info-item">
                    <span className="ms-modal-label">Duration:</span>
                    <span className="ms-modal-value">{formatDuration(selectedSubscription.duration)}</span>
                  </div>
                  <div className="ms-modal-info-item">
                    <span className="ms-modal-label">Subscribed At:</span>
                    <span className="ms-modal-value">{formatDate(selectedSubscription.createdAt)}</span>
                  </div>
                  <div className="ms-modal-info-item">
                    <span className="ms-modal-label">Expires At:</span>
                    <span className={`ms-modal-value ${selectedSubscription.isExpired ? 'expired' : ''}`}>
                      {formatDate(selectedSubscription.expiresAt)}
                    </span>
                  </div>
                  <div className="ms-modal-info-item">
                    <span className="ms-modal-label">Status:</span>
                    <span className="ms-modal-value">
                      <span className={`ms-status-badge ${selectedSubscription.isExpired ? 'expired' : 'active'}`}>
                        {selectedSubscription.isExpired ? (
                          <>
                            <XCircle size={12} />
                            Expired
                          </>
                        ) : (
                          <>
                            <CheckCircle size={12} />
                            Active - {getTimeRemaining(selectedSubscription.expiresAt)}
                          </>
                        )}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="ms-modal-actions">
              <button 
                className="ms-btn secondary"
                onClick={() => viewSurveyDetails(selectedSubscription.surveyId)}
              >
                <FileText size={16} />
                View Survey
              </button>
              {!selectedSubscription.isExpired && (
                <button 
                  className="ms-btn primary"
                  onClick={() => {
                    setShowDetailsModal(false);
                    viewSurveyAnswers(selectedSubscription.surveyId, selectedSubscription.subscriptionId);
                  }}
                >
                  <Eye size={16} />
                  View Answers
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="ms-toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`ms-toast ${toast.type}`}>
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

export default MySubscriptions;