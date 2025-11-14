// src/components/Respondents/ViewAllSurveys.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuiClient } from '@mysten/dapp-kit';
import { ConfigService } from '../../services/config';
import { 
  Search, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Coins,
  Users,
  CheckCircle,
  Clock,
  Eye,
  Edit3,
  Calendar,
  MessageSquare,
  Star,
  UserCheck,
  TrendingUp,
  Heart,
  ShoppingCart,
  Briefcase
} from 'lucide-react';
import './ViewAllSurveys.css';

interface SurveyBasicInfo {
  id: string;
  title: string;
  description: string;
  category: string;
  isActive: boolean;
  currentResponses: number;
  maxResponses: number;
  rewardPerResponse: string;
  createdAt?: string;
  creator?: string;
}

// 基于调研类型的分类
const SURVEY_CATEGORIES = [
  'All Types',
  'Feedback',      // 产品/服务反馈
  'Research',      // 市场研究
  'Opinion',       // 观点调查
  'Experience',    // 用户体验
  'Satisfaction',  // 满意度调查
  'Testing',       // 产品测试
  'Demographics',  // 人口统计
  'Preference',    // 偏好调查
  'Evaluation',    // 评估调研
  'Knowledge',     // 知识测试
  'Behavioral',    // 行为研究
  'Other'         // 其他
];

// 分类图标映射
const getCategoryIcon = (category: string) => {
  const icons: Record<string, React.ReactNode> = {
    'Feedback': <MessageSquare size={14} />,
    'Research': <TrendingUp size={14} />,
    'Opinion': <Star size={14} />,
    'Experience': <Heart size={14} />,
    'Satisfaction': <UserCheck size={14} />,
    'Testing': <ShoppingCart size={14} />,
    'Demographics': <Users size={14} />,
    'Preference': <Heart size={14} />,
    'Evaluation': <Briefcase size={14} />,
    'Knowledge': <Calendar size={14} />,
    'Behavioral': <TrendingUp size={14} />,
    'Other': <MessageSquare size={14} />
  };
  return icons[category] || icons['Other'];
};

// 骨架屏组件
const SkeletonRow = () => (
  <div className="vas-survey-row skeleton">
    <div className="vas-td-survey">
      <div className="vas-skeleton-box vas-skeleton-title"></div>
      <div className="vas-skeleton-box vas-skeleton-desc"></div>
    </div>
    <div className="vas-td-category">
      <div className="vas-skeleton-box vas-skeleton-badge"></div>
    </div>
    <div className="vas-td-reward">
      <div className="vas-skeleton-box vas-skeleton-reward"></div>
    </div>
    <div className="vas-td-responses">
      <div className="vas-skeleton-box vas-skeleton-responses"></div>
    </div>
    <div className="vas-td-progress">
      <div className="vas-skeleton-box vas-skeleton-progress"></div>
    </div>
    <div className="vas-td-status">
      <div className="vas-skeleton-box vas-skeleton-status"></div>
    </div>
    <div className="vas-td-actions">
      <div className="vas-skeleton-box vas-skeleton-btn"></div>
      <div className="vas-skeleton-box vas-skeleton-btn"></div>
    </div>
  </div>
);

export function ViewAllSurveys() {
  const suiClient = useSuiClient();
  const navigate = useNavigate();
  
  const [surveys, setSurveys] = useState<SurveyBasicInfo[]>([]);
  const [filteredSurveys, setFilteredSurveys] = useState<SurveyBasicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs - 默认显示 'all' 而不是 'active'
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'ended'>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All Types');
  const [sortBy, setSortBy] = useState<'reward' | 'responses' | 'created'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch all surveys
  const fetchAllSurveys = async () => {
    setLoading(true);
    
    // 模拟延迟以展示骨架屏效果
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
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
          const allSurveyData: SurveyBasicInfo[] = [];
          
          while (hasNextPage) {
            const dynamicFields = await suiClient.getDynamicFields({
              parentId: allSurveysTable,
              cursor,
              limit: 50
            });
            
            const surveyPromises = dynamicFields.data.map(async (field) => {
              try {
                const surveyObj = await suiClient.getObject({
                  id: field.name.value as string,
                  options: { showContent: true }
                });
                
                if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
                  const surveyFields = surveyObj.data.content.fields;
                  
                  // 确保类别是有效的调研类型
                  let category = surveyFields.category || 'Other';
                  if (!SURVEY_CATEGORIES.includes(category) || category === 'All Types') {
                    // 如果是旧的分类，映射到新的分类
                    const categoryMap: Record<string, string> = {
                      'feedback': 'Feedback',
                      'DeFi': 'Research',
                      'Gaming': 'Experience',
                      'NFT': 'Opinion',
                      'Social': 'Satisfaction'
                    };
                    category = categoryMap[category] || 'Other';
                  }
                  
                  return {
                    id: field.name.value as string,
                    title: surveyFields.title || '',
                    description: surveyFields.description || '',
                    category: category,
                    isActive: surveyFields.is_active || false,
                    currentResponses: parseInt(surveyFields.current_responses || '0'),
                    maxResponses: parseInt(surveyFields.max_responses || '0'),
                    rewardPerResponse: surveyFields.reward_per_response || '0',
                    createdAt: surveyFields.created_at || '0',
                    creator: surveyFields.creator || '',
                  };
                }
              } catch (err) {
                console.error('Error fetching survey:', err);
              }
              return null;
            });
            
            const surveyResults = await Promise.all(surveyPromises);
            const validSurveys = surveyResults.filter(s => s !== null) as SurveyBasicInfo[];
            allSurveyData.push(...validSurveys);
            
            hasNextPage = dynamicFields.hasNextPage;
            cursor = dynamicFields.nextCursor;
          }
          
          setSurveys(allSurveyData);
          setFilteredSurveys(allSurveyData);
        }
      }
    } catch (error) {
      console.error('Error fetching surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...surveys];
    
    // Tab filter
    if (activeTab === 'active') {
      filtered = filtered.filter(s => s.isActive && s.currentResponses < s.maxResponses);
    } else if (activeTab === 'ended') {
      filtered = filtered.filter(s => !s.isActive || s.currentResponses >= s.maxResponses);
    }
    // 'all' tab shows everything without filter
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Category filter
    if (filterCategory !== 'All Types') {
      filtered = filtered.filter(s => s.category === filterCategory);
    }
    
    // Sorting
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'reward':
          compareValue = parseInt(a.rewardPerResponse) - parseInt(b.rewardPerResponse);
          break;
        case 'responses':
          compareValue = a.currentResponses - b.currentResponses;
          break;
        case 'created':
          compareValue = parseInt(a.createdAt || '0') - parseInt(b.createdAt || '0');
          break;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });
    
    setFilteredSurveys(filtered);
    setCurrentPage(1);
  }, [activeTab, searchTerm, filterCategory, sortBy, sortOrder, surveys]);

  // Initial load
  useEffect(() => {
    fetchAllSurveys();
  }, []);

  // Pagination
  const totalPages = Math.ceil(filteredSurveys.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentSurveys = filteredSurveys.slice(startIndex, startIndex + itemsPerPage);

  // Utility functions
  const formatSUI = (amount: string) => {
    return (parseInt(amount) / 1000000000).toFixed(3);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  };

  const getProgressPercentage = (current: number, max: number) => {
    return max > 0 ? Math.round((current / max) * 100) : 0;
  };

  // Stats
  const stats = {
    total: surveys.length,
    active: surveys.filter(s => s.isActive && s.currentResponses < s.maxResponses).length,
    ended: surveys.filter(s => !s.isActive || s.currentResponses >= s.maxResponses).length
  };

  // 如果当前tab没有数据，显示提示信息
  const getEmptyMessage = () => {
    if (activeTab === 'active') {
      return {
        title: 'No Active Surveys',
        desc: 'All surveys have ended or reached their response limit',
        suggestion: 'Check the "All" tab to see completed surveys'
      };
    } else if (activeTab === 'ended') {
      return {
        title: 'No Ended Surveys',
        desc: 'All surveys are still active',
        suggestion: 'Check the "Active" tab for available surveys'
      };
    } else {
      return {
        title: 'No surveys found',
        desc: 'Try adjusting your filters or check back later',
        suggestion: ''
      };
    }
  };

  return (
    <div className="vas-container">
      {/* Header Tabs */}
      <div className="vas-header-tabs">
        <button 
          className={`vas-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All ({stats.total})
        </button>
        <button 
          className={`vas-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active ({stats.active})
        </button>
        <button 
          className={`vas-tab-btn ${activeTab === 'ended' ? 'active' : ''}`}
          onClick={() => setActiveTab('ended')}
        >
          Ended ({stats.ended})
        </button>
      </div>

      {/* Filters Bar */}
      <div className="vas-filters-bar">
        <div className="vas-filters-left">
          <div className="vas-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search surveys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="vas-filter-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            {SURVEY_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        
        <button 
          className="vas-refresh-btn"
          onClick={fetchAllSurveys}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'vas-spinning' : ''} />
        </button>
      </div>

      {/* Table Header */}
      <div className="vas-table-header">
        <div className="vas-th-survey">Survey</div>
        <div className="vas-th-category">Type</div>
        <div className="vas-th-reward vas-sortable" onClick={() => {
          setSortBy('reward');
          setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        }}>
          <Coins size={14} />
          Reward
        </div>
        <div className="vas-th-responses vas-sortable" onClick={() => {
          setSortBy('responses');
          setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        }}>
          <Users size={14} />
          Responses
        </div>
        <div className="vas-th-progress">Progress</div>
        <div className="vas-th-status">Status</div>
        <div className="vas-th-actions">Actions</div>
      </div>

      {/* Survey Rows */}
      <div className="vas-survey-list">
        {loading ? (
          // 骨架屏加载动画
          <>
            {[...Array(5)].map((_, index) => (
              <SkeletonRow key={index} />
            ))}
          </>
        ) : currentSurveys.length === 0 ? (
          <div className="vas-empty-state">
            <MessageSquare size={32} />
            <span>{getEmptyMessage().title}</span>
            <p>{getEmptyMessage().desc}</p>
            {getEmptyMessage().suggestion && (
              <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: '8px' }}>
                💡 {getEmptyMessage().suggestion}
              </p>
            )}
          </div>
        ) : (
          currentSurveys.map((survey) => {
            const progress = getProgressPercentage(survey.currentResponses, survey.maxResponses);
            const isFull = survey.currentResponses >= survey.maxResponses;
            const isEnded = !survey.isActive || isFull;
            
            return (
              <div key={survey.id} className="vas-survey-row">
                <div className="vas-td-survey">
                  <div className="vas-survey-info">
                    <h3 className="vas-survey-title">{survey.title}</h3>
                    <p className="vas-survey-desc">{survey.description}</p>
                    {survey.createdAt && (
                      <span className="vas-survey-date">
                        <Calendar size={12} />
                        {formatDate(survey.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="vas-td-category">
                  <span className="vas-category-badge">
                    {getCategoryIcon(survey.category)}
                    {survey.category}
                  </span>
                </div>
                
                <div className="vas-td-reward">
                  <div className="vas-reward-amount">
                    <Coins size={16} />
                    <span>{formatSUI(survey.rewardPerResponse)}</span>
                    <span className="vas-reward-unit">SUI</span>
                  </div>
                </div>
                
                <div className="vas-td-responses">
                  <span className="vas-responses-count">
                    {survey.currentResponses}/{survey.maxResponses}
                  </span>
                  {progress > 80 && !isEnded && <span className="vas-hot-badge">🔥</span>}
                </div>
                
                <div className="vas-td-progress">
                  <div className="vas-progress-bar">
                    <div 
                      className="vas-progress-fill"
                      style={{ 
                        width: `${progress}%`,
                        backgroundColor: isEnded ? '#6b7280' : (progress > 80 ? '#ef4444' : '#10b981')
                      }}
                    />
                  </div>
                  <span className="vas-progress-text">{progress}%</span>
                </div>
                
                <div className="vas-td-status">
                  {isEnded ? (
                    <span className="vas-status-badge closed">
                      <Clock size={14} /> Ended
                    </span>
                  ) : (
                    <span className="vas-status-badge active">
                      <CheckCircle size={14} /> Active
                    </span>
                  )}
                </div>
                
                <div className="vas-td-actions">
                  <button 
                    className="vas-action-btn secondary"
                    onClick={() => navigate(`/app/survey/${survey.id}`)}
                    title="View Details"
                  >
                    <Eye size={14} />
                    View
                  </button>
                  {!isEnded && (
                    <button 
                      className="vas-action-btn primary"
                      onClick={() => navigate(`/app/answer/${survey.id}`)}
                      title="Answer Survey"
                    >
                      <Edit3 size={14} />
                      Answer
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="vas-pagination">
          <button 
            className="vas-page-btn"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={16} />
          </button>
          
          <span className="vas-page-info">
            Page {currentPage} of {totalPages}
          </span>
          
          <button 
            className="vas-page-btn"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default ViewAllSurveys;