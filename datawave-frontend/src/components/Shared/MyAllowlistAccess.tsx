// src/components/Access/MyAllowlistAccess.tsx
import { useState, useEffect } from 'react';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { ConfigService } from '../../services/config';
import { 
  Shield,
  Users,
  Lock,
  Unlock,
  Eye,
  Calendar,
  FileText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Key,
  Wallet,
  CheckCircle,
  Activity,
  Database
} from 'lucide-react';
import '../../css/MyAllowlistAccess.css';

interface AllowlistSurvey {
  id: string;
  title: string;
  description: string;
  category: string;
  creator: string;
  createdAt: string;
  isActive: boolean;
  currentResponses: number;
  maxResponses: number;
  questions: any[];
  
  // Allowlist info
  allowlistSize: number;
  addedToAllowlistAt?: string;
  canDecrypt: boolean;
  hasAnswers: boolean;
  answerCount: number;
}

export function MyAllowlistAccess() {
  const navigate = useNavigate();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  
  const [surveys, setSurveys] = useState<AllowlistSurvey[]>([]);
  const [filteredSurveys, setFilteredSurveys] = useState<AllowlistSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'with-answers'>('all');
  
  // Filtering and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>(['all']);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(9);
  
  // Statistics
  const [stats, setStats] = useState({
    totalAccess: 0,
    activeAccess: 0,
    withAnswers: 0,
    totalAnswers: 0,
  });

  // Navigation functions - Updated routes
  const viewSurveyDetails = (surveyId: string) => {
    navigate(`/app/survey/${surveyId}`);
  };

  const startDecryption = (surveyId: string) => {
    navigate(`/app/analytics/${surveyId}`); // Or specific decrypt page if needed
  };

  // Load surveys where user is in allowlist
  const loadAllowlistSurveys = async () => {
    if (!currentAccount?.address) return;
    
    setLoading(true);
    try {
      const allowlistSurveys: AllowlistSurvey[] = [];
      
      // Get all surveys from Registry
      const registryId = ConfigService.getSurveyRegistryId();
      const registry = await suiClient.getObject({
        id: registryId,
        options: { showContent: true }
      });

      if (registry.data?.content && 'fields' in registry.data.content) {
        const fields = registry.data.content.fields as any;
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
            
            // Process each survey
            for (const field of dynamicFields.data) {
              try {
                const surveyId = field.name.value as string;
                
                // Get survey details
                const surveyObj = await suiClient.getObject({
                  id: surveyId,
                  options: { showContent: true }
                });
                
                if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
                  const surveyFields = surveyObj.data.content.fields as any;
                  
                  // Check allowlist
                  let isInAllowlist = false;
                  let allowlistSize = 0;
                  
                  if (surveyFields.allowlist?.fields?.contents) {
                    const allowlist = surveyFields.allowlist.fields.contents;
                    allowlistSize = allowlist.length;
                    isInAllowlist = allowlist.includes(currentAccount.address);
                  } else if (Array.isArray(surveyFields.allowlist)) {
                    const allowlist = surveyFields.allowlist;
                    allowlistSize = allowlist.length;
                    isInAllowlist = allowlist.includes(currentAccount.address);
                  }
                  
                  // If user is in allowlist
                  if (isInAllowlist) {
                    // Parse questions
                    const questions = surveyFields.questions?.map((q: any) => ({
                      question_text: q.fields?.question_text || q.question_text || '',
                      question_type: parseInt(q.fields?.question_type || q.question_type || '0'),
                      options: q.fields?.options || q.options || []
                    })) || [];
                    
                    // Count answers
                    let answerCount = 0;
                    if (surveyFields.encrypted_answer_blobs?.fields?.id?.id) {
                      try {
                        const answersTableFields = await suiClient.getDynamicFields({
                          parentId: surveyFields.encrypted_answer_blobs.fields.id.id,
                          limit: 1,
                        });
                        answerCount = answersTableFields.data.length;
                      } catch (e) {
                        console.error('Error counting answers:', e);
                      }
                    }
                    
                    allowlistSurveys.push({
                      id: surveyId,
                      title: surveyFields.title || 'Unknown Survey',
                      description: surveyFields.description || '',
                      category: surveyFields.category || 'Uncategorized',
                      creator: surveyFields.creator || '',
                      createdAt: surveyFields.created_at || '0',
                      isActive: surveyFields.is_active || false,
                      currentResponses: parseInt(surveyFields.current_responses || '0'),
                      maxResponses: parseInt(surveyFields.max_responses || '0'),
                      questions,
                      allowlistSize,
                      canDecrypt: true,
                      hasAnswers: answerCount > 0,
                      answerCount,
                    });
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
      
      // Sort by creation time
      allowlistSurveys.sort((a, b) => {
        return parseInt(b.createdAt || '0') - parseInt(a.createdAt || '0');
      });
      
      setSurveys(allowlistSurveys);
      setFilteredSurveys(allowlistSurveys);
      
      // Extract categories
      const uniqueCategories = Array.from(new Set(allowlistSurveys.map(s => s.category)));
      setCategories(['all', ...uniqueCategories]);
      
      // Calculate statistics
      const activeCount = allowlistSurveys.filter(s => s.isActive).length;
      const withAnswersCount = allowlistSurveys.filter(s => s.hasAnswers).length;
      const totalAnswers = allowlistSurveys.reduce((sum, s) => sum + s.answerCount, 0);
      
      setStats({
        totalAccess: allowlistSurveys.length,
        activeAccess: activeCount,
        withAnswers: withAnswersCount,
        totalAnswers,
      });
      

    } catch (error) {
      console.error('Error loading allowlist surveys:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllowlistSurveys();
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...surveys];
    
    // Tab filter
    if (activeTab === 'active') {
      filtered = filtered.filter(s => s.isActive);
    } else if (activeTab === 'with-answers') {
      filtered = filtered.filter(s => s.hasAnswers);
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
  }, [searchTerm, filterCategory, activeTab, surveys]);

  // Initial load
  useEffect(() => {
    if (currentAccount?.address) {
      loadAllowlistSurveys();
    } else {
      setLoading(false);
    }
  }, [currentAccount?.address]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredSurveys.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSurveys = filteredSurveys.slice(startIndex, endIndex);

  // Format functions
  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString();
  };

  const getCompletionRate = (current: number, max: number) => {
    if (max === 0) return 0;
    return (current / max) * 100;
  };

  // Skeleton Card Component
  const SkeletonCard = () => (
    <div className="mal-skeleton-card">
      <div className="mal-skeleton-header">
        <div className="mal-skeleton-badge"></div>
        <div className="mal-skeleton-badges"></div>
      </div>
      <div className="mal-skeleton-title"></div>
      <div className="mal-skeleton-description"></div>
      <div className="mal-skeleton-info">
        <div className="mal-skeleton-info-item"></div>
        <div className="mal-skeleton-info-item"></div>
        <div className="mal-skeleton-info-item"></div>
      </div>
      <div className="mal-skeleton-access"></div>
      <div className="mal-skeleton-actions">
        <div className="mal-skeleton-button"></div>
        <div className="mal-skeleton-button"></div>
      </div>
    </div>
  );

  if (!currentAccount) {
    return (
      <div className="mal-container">
        <div className="mal-connect-wallet">
          <Wallet size={48} />
          <h2>Connect Your Wallet</h2>
          <p>Please connect your wallet to view your allowlist access</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mal-container">
      {/* Header with Stats */}
      <div className="mal-header">
        <div className="mal-header-content">
          <div className="mal-header-info">
            <h1 className="mal-title">My Allowlist Access</h1>
            <p className="mal-subtitle">Surveys where you have decryption privileges</p>
          </div>
          <button 
            className="mal-btn secondary" 
            onClick={handleRefresh} 
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'mal-spinning' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        
        {/* Stats Cards */}
        <div className="mal-stats-grid">
          <div className="mal-stat-card">
            <div className="mal-stat-icon purple">
              <Shield size={20} />
            </div>
            <div className="mal-stat-content">
              <div className="mal-stat-label">Total Access</div>
              <div className="mal-stat-value">{stats.totalAccess}</div>
            </div>
          </div>
          
          <div className="mal-stat-card">
            <div className="mal-stat-icon green">
              <Activity size={20} />
            </div>
            <div className="mal-stat-content">
              <div className="mal-stat-label">Active Surveys</div>
              <div className="mal-stat-value success">{stats.activeAccess}</div>
            </div>
          </div>
          
          <div className="mal-stat-card">
            <div className="mal-stat-icon blue">
              <Database size={20} />
            </div>
            <div className="mal-stat-content">
              <div className="mal-stat-label">With Answers</div>
              <div className="mal-stat-value">{stats.withAnswers}</div>
            </div>
          </div>
          
          <div className="mal-stat-card">
            <div className="mal-stat-icon orange">
              <FileText size={20} />
            </div>
            <div className="mal-stat-content">
              <div className="mal-stat-label">Total Answers</div>
              <div className="mal-stat-value">{stats.totalAnswers}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="mal-filters-section">
        {/* Tabs */}
        <div className="mal-tabs">
          <button 
            className={`mal-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All
            <span className="mal-tab-count">{surveys.length}</span>
          </button>
          <button 
            className={`mal-tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            <Activity size={14} />
            Active
            <span className="mal-tab-count">{surveys.filter(s => s.isActive).length}</span>
          </button>
          <button 
            className={`mal-tab ${activeTab === 'with-answers' ? 'active' : ''}`}
            onClick={() => setActiveTab('with-answers')}
          >
            <Database size={14} />
            With Answers
            <span className="mal-tab-count">{surveys.filter(s => s.hasAnswers).length}</span>
          </button>
        </div>
        
        {/* Filter Controls */}
        <div className="mal-filter-controls">
          <div className="mal-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search surveys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mal-search-input"
            />
          </div>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="mal-filter-select"
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
      <div className="mal-surveys-section">
        {loading ? (
          <div className="mal-surveys-grid">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : currentSurveys.length === 0 ? (
          <div className="mal-empty-state">
            <Lock size={48} />
            <h3>
              {filteredSurveys.length === 0 
                ? (surveys.length === 0 
                  ? "No Allowlist Access"
                  : "No surveys match your filters")
                : "No surveys on this page"}
            </h3>
            <p>
              {surveys.length === 0 && "You haven't been added to any survey allowlists yet"}
            </p>
          </div>
        ) : (
          <div className="mal-surveys-grid">
            {currentSurveys.map((survey) => (
              <div key={survey.id} className="mal-survey-card">
                {/* Card Header */}
                <div className="mal-card-header">
                  <span className="mal-category-badge">{survey.category}</span>
                  <div className="mal-header-badges">
                    <span className={`mal-status-badge ${survey.isActive ? 'active' : 'inactive'}`}>
                      {survey.isActive ? (
                        <>
                          <CheckCircle size={12} />
                          Active
                        </>
                      ) : (
                        <>
                          <Lock size={12} />
                          Closed
                        </>
                      )}
                    </span>
                    {survey.hasAnswers && (
                      <span className="mal-answers-badge">
                        <Database size={12} />
                        {survey.answerCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <h3 className="mal-card-title">{survey.title}</h3>
                <p className="mal-card-description">{survey.description}</p>

                {/* Survey Info */}
                <div className="mal-card-info">
                  <div className="mal-info-item">
                    <Calendar size={14} />
                    <span className="mal-info-label">Created:</span>
                    <span className="mal-info-value">{formatDate(survey.createdAt)}</span>
                  </div>
                  <div className="mal-info-item">
                    <FileText size={14} />
                    <span className="mal-info-label">Questions:</span>
                    <span className="mal-info-value">{survey.questions.length}</span>
                  </div>
                  <div className="mal-info-item">
                    <Users size={14} />
                    <span className="mal-info-label">Responses:</span>
                    <span className="mal-info-value">{survey.currentResponses}/{survey.maxResponses}</span>
                  </div>
                  <div className="mal-info-item">
                    <Shield size={14} />
                    <span className="mal-info-label">Allowlist:</span>
                    <span className="mal-info-value">{survey.allowlistSize} addresses</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mal-progress-section">
                  <div className="mal-progress-bar">
                    <div 
                      className="mal-progress-fill"
                      style={{ width: `${Math.min(100, getCompletionRate(survey.currentResponses, survey.maxResponses))}%` }}
                    />
                  </div>
                  <div className="mal-progress-text">
                    {getCompletionRate(survey.currentResponses, survey.maxResponses).toFixed(0)}% Complete
                  </div>
                </div>

                {/* Access Badge */}
                <div className="mal-access-badge">
                  <Key size={14} />
                  <span>Decryption Access Granted</span>
                </div>

                {/* Card Actions */}
                <div className="mal-card-actions">
                  <button 
                    className="mal-action-btn secondary"
                    onClick={() => viewSurveyDetails(survey.id)}
                  >
                    <Eye size={16} />
                    View Details
                  </button>
                  {survey.hasAnswers && (
                    <button 
                      className="mal-action-btn primary"
                      onClick={() => startDecryption(survey.id)}
                    >
                      <Unlock size={16} />
                      Decrypt
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
        <div className="mal-pagination">
          <div className="mal-pagination-info">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredSurveys.length)} of {filteredSurveys.length} surveys
          </div>
          
          <div className="mal-pagination-controls">
            <button 
              className="mal-pagination-btn"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="mal-pagination-numbers">
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
                    className={`mal-pagination-number ${pageNum === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button 
              className="mal-pagination-btn"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyAllowlistAccess;