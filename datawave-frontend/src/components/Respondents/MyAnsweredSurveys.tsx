// src/components/Respondent/MyAnsweredSurveys.tsx
import { useState, useEffect } from 'react';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { ConfigService } from '../../services/config';
import { 
  CheckCircle,
  Award,
  FileText,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
  Coins,
  Hash,
  X,
  Shield,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Wallet
} from 'lucide-react';
import './MyAnsweredSurveys.css';

interface AnsweredSurvey {
  surveyId: string;
  title: string;
  description: string;
  category: string;
  creator: string;
  
  // Answer info
  answeredAt: number;
  transactionId?: string;
  rewardReceived: string;
  consentGiven: boolean;
  
  // Survey info
  totalQuestions: number;
  isActive: boolean;
  currentResponses: number;
  maxResponses: number;
}

interface AnswerDetail {
  questionText: string;
  questionType: number;
  userAnswer: string | string[];
}

export function MyAnsweredSurveys() {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const navigate = useNavigate();
  const packageId = ConfigService.getPackageId();
  
  const [answeredSurveys, setAnsweredSurveys] = useState<AnsweredSurvey[]>([]);
  const [filteredSurveys, setFilteredSurveys] = useState<AnsweredSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'with-consent' | 'without-consent'>('all');
  
  // Detail dialog
  const [selectedSurvey, setSelectedSurvey] = useState<AnsweredSurvey | null>(null);
  const [answerDetails, setAnswerDetails] = useState<AnswerDetail[]>([]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  
  // Filtering and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>(['all']);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(9);
  
  // Statistics
  const [stats, setStats] = useState({
    totalAnswered: 0,
    totalRewardsEarned: 0,
    consentGivenCount: 0,
    uniqueCreators: 0,
  });


  // Load user's answered surveys
  const loadAnsweredSurveys = async () => {
    if (!currentAccount?.address) return;
    
    setLoading(true);
    try {
      const answered: AnsweredSurvey[] = [];
      const processedSurveys = new Set<string>();
      
      // Query SurveyAnswered events
      const answeredEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${packageId}::survey_system::SurveyAnswered`,
        },
        limit: 100,
        order: 'descending',
      });
      
      // Filter current user's answers
      const userAnswers = answeredEvents.data.filter((event: any) => 
        event.parsedJson?.respondent === currentAccount.address
      );
      
      // Process each answer event
      for (const event of userAnswers) {
        const eventData = event.parsedJson as any;
        if (!eventData) continue;
        
        const surveyId = eventData.survey_id;
        if (!surveyId) continue;
        
        // Avoid duplicates
        if (processedSurveys.has(surveyId)) continue;
        processedSurveys.add(surveyId);
        
        try {
          // Get survey details
          const surveyObj = await suiClient.getObject({
            id: surveyId,
            options: { showContent: true }
          });
          
          if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
            const surveyFields = surveyObj.data.content.fields as any;
            
            // Find user's specific answer
            let consentGiven = false;
            let answeredAt = event.timestampMs ? parseInt(event.timestampMs) : Date.now();
            
            // Check encrypted answers table for user's answer
            if (surveyFields.encrypted_answer_blobs?.fields?.id?.id) {
              try {
                const answersTable = await suiClient.getDynamicFields({
                  parentId: surveyFields.encrypted_answer_blobs.fields.id.id,
                  limit: 100,
                });
                
                // Find user's answer
                for (const field of answersTable.data) {
                  const fieldData = await suiClient.getObject({
                    id: field.objectId,
                    options: { showContent: true }
                  });
                  
                  if (fieldData.data?.content && 'fields' in fieldData.data.content) {
                    const value = (fieldData.data.content as any).fields?.value?.fields;
                    if (value && value.respondent === currentAccount.address) {
                      consentGiven = value.consent_for_subscription || false;
                      answeredAt = parseInt(value.submitted_at || answeredAt);
                      break;
                    }
                  }
                }
              } catch (e) {
                console.error('Error checking answer details:', e);
              }
            }
            
            answered.push({
              surveyId,
              title: surveyFields.title || 'Unknown Survey',
              description: surveyFields.description || '',
              category: surveyFields.category || 'Uncategorized',
              creator: surveyFields.creator || '',
              answeredAt,
              transactionId: event.id?.txDigest,
              rewardReceived: eventData.reward_amount || surveyFields.reward_per_response || '0',
              consentGiven,
              totalQuestions: surveyFields.questions?.length || 0,
              isActive: surveyFields.is_active || false,
              currentResponses: parseInt(surveyFields.current_responses || '0'),
              maxResponses: parseInt(surveyFields.max_responses || '0'),
            });
          }
        } catch (error) {
          console.error(`Error loading survey ${surveyId}:`, error);
        }
      }
      
      // Sort by answer time (most recent first)
      answered.sort((a, b) => b.answeredAt - a.answeredAt);
      
      setAnsweredSurveys(answered);
      setFilteredSurveys(answered);
      
      // Extract categories
      const uniqueCategories = Array.from(new Set(answered.map(s => s.category)));
      setCategories(['all', ...uniqueCategories]);
      
      // Calculate statistics
      const totalRewards = answered.reduce((sum, s) => 
        sum + parseInt(s.rewardReceived || '0'), 0
      );
      const consentCount = answered.filter(s => s.consentGiven).length;
      const creators = new Set(answered.map(s => s.creator)).size;
      
      setStats({
        totalAnswered: answered.length,
        totalRewardsEarned: totalRewards,
        consentGivenCount: consentCount,
        uniqueCreators: creators,
      });
      
    } catch (error) {
      console.error('Error loading answered surveys:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // View answer details
  const viewAnswerDetails = async (survey: AnsweredSurvey) => {
    setSelectedSurvey(survey);
    
    // Try to get answers from local storage
    const storedAnswers = localStorage.getItem(`survey_answers_${survey.surveyId}`);
    if (storedAnswers) {
      try {
        const parsed = JSON.parse(storedAnswers);
        setAnswerDetails(parsed.answers || []);
      } catch (e) {
        setAnswerDetails([]);
      }
    } else {
      setAnswerDetails([]);
    }
    
    setShowDetailDialog(true);
  };

  // Navigation functions
  const viewOriginalSurvey = (surveyId: string) => {
    navigate(`/app/survey/${surveyId}`);
  };

  const browseMoreSurveys = () => {
    navigate('/app/marketplace');
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAnsweredSurveys();
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...answeredSurveys];
    
    // Tab filter
    if (activeTab === 'with-consent') {
      filtered = filtered.filter(s => s.consentGiven);
    } else if (activeTab === 'without-consent') {
      filtered = filtered.filter(s => !s.consentGiven);
    }
    
    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(s => s.category === filterCategory);
    }
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term)
      );
    }
    
    setFilteredSurveys(filtered);
    setCurrentPage(1);
  }, [searchTerm, filterCategory, activeTab, answeredSurveys]);

  // Initial load
  useEffect(() => {
    if (currentAccount?.address) {
      loadAnsweredSurveys();
    }
  }, [currentAccount?.address]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredSurveys.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSurveys = filteredSurveys.slice(startIndex, endIndex);

  // Format functions
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSUI = (amount: string) => {
    return (parseInt(amount) / 1000000000).toFixed(4);
  };

  const getQuestionTypeName = (type: number) => {
    switch(type) {
      case 0: return 'Single Choice';
      case 1: return 'Multiple Choice';
      case 2: return 'Text Input';
      default: return 'Unknown';
    }
  };

  // Skeleton loader component
  const SkeletonCard = () => (
    <div className="mas-skeleton-card">
      <div className="mas-skeleton-header">
        <div className="mas-skeleton-badge"></div>
        <div className="mas-skeleton-badges"></div>
      </div>
      <div className="mas-skeleton-title"></div>
      <div className="mas-skeleton-description"></div>
      <div className="mas-skeleton-stats">
        <div className="mas-skeleton-stat"></div>
        <div className="mas-skeleton-stat"></div>
        <div className="mas-skeleton-stat"></div>
      </div>
      <div className="mas-skeleton-actions">
        <div className="mas-skeleton-button"></div>
        <div className="mas-skeleton-button"></div>
      </div>
    </div>
  );

  if (!currentAccount) {
    return (
      <div className="mas-container">
        <div className="mas-connect-wallet">
          <Wallet size={48} />
          <h2>Connect Your Wallet</h2>
          <p>Please connect your wallet to view your answered surveys and earnings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mas-container">
      {/* Header with Stats */}
      <div className="mas-header">
        <div className="mas-header-content">
          <div className="mas-header-info">
            <h1 className="mas-title">My Answered Surveys</h1>
            <p className="mas-subtitle">Track your survey participation history and earnings</p>
          </div>
          <button 
            className="mas-btn secondary"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'mas-spinning' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        
        {/* Stats Cards */}
        <div className="mas-stats-grid">
          <div className="mas-stat-card">
            <div className="mas-stat-icon blue">
              <FileText size={20} />
            </div>
            <div className="mas-stat-content">
              <div className="mas-stat-label">Total Answered</div>
              <div className="mas-stat-value">{stats.totalAnswered}</div>
            </div>
          </div>
          
          <div className="mas-stat-card">
            <div className="mas-stat-icon green">
              <Coins size={20} />
            </div>
            <div className="mas-stat-content">
              <div className="mas-stat-label">Rewards Earned</div>
              <div className="mas-stat-value success">{formatSUI(stats.totalRewardsEarned.toString())} SUI</div>
            </div>
          </div>
          
          <div className="mas-stat-card">
            <div className="mas-stat-icon purple">
              <CheckCircle size={20} />
            </div>
            <div className="mas-stat-content">
              <div className="mas-stat-label">Consent Given</div>
              <div className="mas-stat-value">{stats.consentGivenCount}</div>
            </div>
          </div>
          
          <div className="mas-stat-card">
            <div className="mas-stat-icon orange">
              <Award size={20} />
            </div>
            <div className="mas-stat-content">
              <div className="mas-stat-label">Unique Creators</div>
              <div className="mas-stat-value">{stats.uniqueCreators}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Tabs */}
      <div className="mas-filters-section">
        {/* Tabs */}
        <div className="mas-tabs">
          <button
            className={`mas-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All ({answeredSurveys.length})
          </button>
          <button
            className={`mas-tab ${activeTab === 'with-consent' ? 'active' : ''}`}
            onClick={() => setActiveTab('with-consent')}
          >
            <Shield size={14} />
            With Consent ({answeredSurveys.filter(s => s.consentGiven).length})
          </button>
          <button
            className={`mas-tab ${activeTab === 'without-consent' ? 'active' : ''}`}
            onClick={() => setActiveTab('without-consent')}
          >
            Without Consent ({answeredSurveys.filter(s => !s.consentGiven).length})
          </button>
        </div>
        
        {/* Filter Controls */}
        <div className="mas-filter-controls">
          <div className="mas-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search surveys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mas-search-input"
            />
          </div>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="mas-filter-select"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Surveys Grid */}
      <div className="mas-surveys-section">
        {loading ? (
          <div className="mas-surveys-grid">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : currentSurveys.length === 0 ? (
          <div className="mas-empty-state">
            <FileText size={48} />
            <h3>
              {filteredSurveys.length === 0 
                ? (answeredSurveys.length === 0 
                  ? "No Surveys Answered Yet"
                  : "No surveys match your filters")
                : "No surveys on this page"}
            </h3>
            <p>
              {answeredSurveys.length === 0 && "Start answering surveys to earn rewards"}
            </p>
            {answeredSurveys.length === 0 && (
              <button className="mas-btn primary" onClick={browseMoreSurveys}>
                Browse Surveys
              </button>
            )}
          </div>
        ) : (
          <div className="mas-surveys-grid">
            {currentSurveys.map((survey) => (
              <div key={`${survey.surveyId}-${survey.answeredAt}`} className="mas-survey-card">
                {/* Card Header */}
                <div className="mas-card-header">
                  <span className="mas-category-badge">{survey.category}</span>
                  <div className="mas-header-badges">
                    <span className={`mas-status-badge ${survey.isActive ? 'active' : 'inactive'}`}>
                      {survey.isActive ? 'Active' : 'Closed'}
                    </span>
                    {survey.consentGiven && (
                      <span className="mas-consent-badge">
                        <Shield size={12} />
                        Consent
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Card Title & Description */}
                <h3 className="mas-card-title">{survey.title}</h3>
                <p className="mas-card-description">{survey.description}</p>
                
                {/* Answer Info */}
                <div className="mas-answer-info">
                  <div className="mas-info-row">
                    <Calendar size={14} />
                    <span className="mas-info-label">Answered:</span>
                    <span className="mas-info-value">{formatDate(survey.answeredAt)}</span>
                  </div>
                  <div className="mas-info-row highlight">
                    <Coins size={14} />
                    <span className="mas-info-label">Reward:</span>
                    <span className="mas-info-value success">{formatSUI(survey.rewardReceived)} SUI</span>
                  </div>
                  <div className="mas-info-row">
                    <FileText size={14} />
                    <span className="mas-info-label">Questions:</span>
                    <span className="mas-info-value">{survey.totalQuestions}</span>
                  </div>
                  <div className="mas-info-row">
                    <TrendingUp size={14} />
                    <span className="mas-info-label">Responses:</span>
                    <span className="mas-info-value">{survey.currentResponses}/{survey.maxResponses}</span>
                  </div>
                </div>
                
                {/* Transaction Info */}
                {survey.transactionId && (
                  <div className="mas-tx-info">
                    <Hash size={12} />
                    <span>Tx: {survey.transactionId.slice(0, 8)}...</span>
                    <button
                      className="mas-tx-link"
                      onClick={() => window.open(`https://suiscan.xyz/testnet/tx/${survey.transactionId}`, '_blank')}
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                )}
                
                {/* Actions */}
                <div className="mas-card-actions">
                  <button 
                    className="mas-btn secondary"
                    onClick={() => viewOriginalSurvey(survey.surveyId)}
                  >
                    <Eye size={16} />
                    View Survey
                  </button>
                  {answerDetails.length > 0 && (
                    <button 
                      className="mas-btn secondary"
                      onClick={() => viewAnswerDetails(survey)}
                    >
                      <FileText size={16} />
                      My Answers
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mas-pagination">
          <div className="mas-pagination-info">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredSurveys.length)} of {filteredSurveys.length} surveys
          </div>
          
          <div className="mas-pagination-controls">
            <button 
              className="mas-pagination-btn"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="mas-pagination-numbers">
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
                    className={`mas-pagination-number ${pageNum === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button 
              className="mas-pagination-btn"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Answer Details Modal */}
      {showDetailDialog && selectedSurvey && (
        <div className="mas-modal-overlay" onClick={() => setShowDetailDialog(false)}>
          <div className="mas-modal" onClick={e => e.stopPropagation()}>
            <div className="mas-modal-header">
              <h2 className="mas-modal-title">Your Survey Answers</h2>
              <button 
                className="mas-modal-close" 
                onClick={() => setShowDetailDialog(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mas-modal-survey-info">
              <h3>{selectedSurvey.title}</h3>
              <p>Answered on: {formatDate(selectedSurvey.answeredAt)}</p>
            </div>
            
            <div className="mas-modal-content">
              {answerDetails.length > 0 ? (
                <div className="mas-answers-list">
                  {answerDetails.map((answer, idx) => (
                    <div key={idx} className="mas-answer-item">
                      <div className="mas-answer-header">
                        <span className="mas-answer-number">Q{idx + 1}</span>
                        <span className="mas-answer-type">{getQuestionTypeName(answer.questionType)}</span>
                      </div>
                      <div className="mas-answer-question">{answer.questionText}</div>
                      <div className="mas-answer-response">
                        {Array.isArray(answer.userAnswer) 
                          ? answer.userAnswer.join(', ') 
                          : answer.userAnswer}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mas-modal-empty">
                  <AlertCircle size={32} />
                  <p>Answer details are not available</p>
                  <span>Answers are encrypted on-chain for privacy</span>
                </div>
              )}
            </div>
            
            <div className="mas-modal-actions">
              <button 
                className="mas-btn secondary"
                onClick={() => setShowDetailDialog(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyAnsweredSurveys;