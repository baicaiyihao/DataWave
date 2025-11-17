// src/components/ViewSurveyDetails.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { 
  ChevronLeft, 
  Coins, 
  Users, 
  Calendar, 
  ClipboardList, 
  CheckCircle,
  Clock,
  Award,
  Hash,
  AlertCircle,
  Radio,
  CheckSquare,
  Type,
  Wallet
} from 'lucide-react';
import './ViewSurveyDetails.css';

interface Question {
  question_text: string;
  question_type: number; // 0: single, 1: multiple, 2: text
  options: string[];
}

interface SurveyFullDetails {
  title: string;
  description: string;
  category: string;
  rewardPerResponse: string;
  maxResponses: string;
  currentResponses: string;
  isActive: boolean;
  createdAt: string;
  questions: Question[];
  creator?: string;
}

export function ViewSurveyDetails() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  
  const [surveyDetails, setSurveyDetails] = useState<SurveyFullDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);

  // Smart navigation - returns to the previous page
  const goBack = () => {
    // Check if there's a previous page in history
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      // Default fallback to marketplace
      navigate('/app/marketplace');
    }
  };

  const startAnsweringSurvey = () => {
    navigate(`/app/answer/${surveyId}`);
  };

  // Fetch survey details
  const fetchSurveyDetails = async (id: string) => {
    if (!id) {
      setError('Survey ID is required');
      return;
    }

    setLoading(true);
    setError('');
    setSurveyDetails(null);
    setHasAnswered(false);

    try {
      const surveyObject = await suiClient.getObject({
        id,
        options: {
          showContent: true,
          showType: true,
        }
      });

      if (surveyObject.data?.content && 'fields' in surveyObject.data.content) {
        const fields = surveyObject.data.content.fields as any;
        
        // Parse questions array
        const questions: Question[] = fields.questions?.map((q: any) => {
          const questionFields = q.fields || q;
          return {
            question_text: questionFields.question_text || '',
            question_type: parseInt(questionFields.question_type || '0'),
            options: questionFields.options || []
          };
        }) || [];

        const details: SurveyFullDetails = {
          title: fields.title || '',
          description: fields.description || '',
          category: fields.category || 'Feedback',
          rewardPerResponse: fields.reward_per_response || '0',
          maxResponses: fields.max_responses || '0',
          currentResponses: fields.current_responses || '0',
          isActive: fields.is_active || false,
          createdAt: fields.created_at || '0',
          questions: questions,
          creator: fields.creator || ''
        };

        setSurveyDetails(details);

        // Check if user has answered
        if (currentAccount?.address && fields.respondents) {
          await checkIfAnswered(fields.respondents.fields?.id?.id, currentAccount.address);
        }
      } else {
        setError('Invalid survey data structure');
      }
    } catch (err: any) {
      console.error('Error fetching survey details:', err);
      setError(err.message || 'Failed to fetch survey details');
    } finally {
      setLoading(false);
    }
  };

  // Check if user has answered
  const checkIfAnswered = async (respondentsTableId: string, userAddress: string) => {
    if (!respondentsTableId || !userAddress) return;

    try {
      const hasAnsweredField = await suiClient.getDynamicFieldObject({
        parentId: respondentsTableId,
        name: {
          type: 'address',
          value: userAddress,
        }
      });

      setHasAnswered(!!hasAnsweredField.data);
    } catch (error) {
      setHasAnswered(false);
    }
  };

  useEffect(() => {
    if (surveyId) {
      fetchSurveyDetails(surveyId);
    }
  }, [surveyId, currentAccount?.address]);

  // Format functions
  const getQuestionTypeIcon = (type: number) => {
    switch (type) {
      case 0: return <Radio size={16} />;
      case 1: return <CheckSquare size={16} />;
      case 2: return <Type size={16} />;
      default: return <ClipboardList size={16} />;
    }
  };

  const getQuestionTypeLabel = (type: number) => {
    switch (type) {
      case 0: return 'Single Choice';
      case 1: return 'Multiple Choice';
      case 2: return 'Text Answer';
      default: return 'Unknown';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  };

  const formatSUI = (amount: string) => {
    return (parseInt(amount) / 1000000000).toFixed(3);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const completionRate = surveyDetails 
    ? (parseInt(surveyDetails.currentResponses) / parseInt(surveyDetails.maxResponses)) * 100 
    : 0;

  // Loading state
  if (loading) {
    return (
      <div className="vsd-container">
        <div className="vsd-loading-skeleton">
          <div className="vsd-skeleton-header"></div>
          <div className="vsd-skeleton-content"></div>
          <div className="vsd-skeleton-content"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !surveyDetails) {
    return (
      <div className="vsd-container">
        <div className="vsd-error-card">
          <AlertCircle size={48} />
          <h3>Unable to Load Survey</h3>
          <p>{error}</p>
          <button className="vsd-btn-primary" onClick={goBack}>
            <ChevronLeft size={16} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  // No survey found
  if (!surveyDetails) {
    return (
      <div className="vsd-container">
        <div className="vsd-error-card">
          <AlertCircle size={48} />
          <h3>Survey Not Found</h3>
          <p>This survey doesn't exist or has been removed.</p>
          <button className="vsd-btn-primary" onClick={goBack}>
            <ChevronLeft size={16} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vsd-container">
      {/* Navigation Bar */}
      <div className="vsd-nav-bar">
        <button className="vsd-back-btn" onClick={goBack}>
          <ChevronLeft size={20} />
          Back
        </button>
        <div className="vsd-survey-id">
          <Hash size={14} />
          <span>{formatAddress(surveyId || '')}</span>
        </div>
      </div>

      {/* Survey Header */}
      <div className="vsd-survey-header">
        <div className="vsd-header-content">
          <div className="vsd-header-main">
            <h1 className="vsd-survey-title">{surveyDetails.title}</h1>
            <p className="vsd-survey-description">{surveyDetails.description}</p>
          </div>
          <div className="vsd-header-status">
            <span className={`vsd-status-badge ${surveyDetails.isActive ? 'active' : 'closed'}`}>
              {surveyDetails.isActive ? (
                <>
                  <CheckCircle size={14} /> Active
                </>
              ) : (
                <>
                  <Clock size={14} /> Closed
                </>
              )}
            </span>
          </div>
        </div>

        <div className="vsd-header-meta">
          <div className="vsd-meta-item">
            <span className="vsd-category-badge">{surveyDetails.category}</span>
          </div>
          <div className="vsd-meta-item">
            <Coins size={16} />
            <span className="vsd-reward-amount">{formatSUI(surveyDetails.rewardPerResponse)}</span>
            <span className="vsd-reward-unit">SUI</span>
          </div>
          <div className="vsd-meta-item">
            <Users size={16} />
            <span>{surveyDetails.currentResponses}/{surveyDetails.maxResponses}</span>
          </div>
          <div className="vsd-meta-item">
            <ClipboardList size={16} />
            <span>{surveyDetails.questions.length} Questions</span>
          </div>
          <div className="vsd-meta-item">
            <Calendar size={16} />
            <span>{formatTimestamp(surveyDetails.createdAt)}</span>
          </div>
        </div>

        {hasAnswered && (
          <div className="vsd-answered-notice">
            <CheckCircle size={16} />
            <span>You have already completed this survey</span>
          </div>
        )}
      </div>

      {/* Progress Card */}
      <div className="vsd-progress-card">
        <h3 className="vsd-card-title">Survey Progress</h3>
        
        <div className="vsd-progress-stats">
          <div className="vsd-stat-item">
            <span className="vsd-stat-label">Completion</span>
            <span className="vsd-stat-value">{completionRate.toFixed(1)}%</span>
          </div>
          <div className="vsd-stat-item">
            <span className="vsd-stat-label">Total Pool</span>
            <span className="vsd-stat-value">
              {formatSUI((parseInt(surveyDetails.rewardPerResponse) * parseInt(surveyDetails.maxResponses)).toString())} SUI
            </span>
          </div>
          <div className="vsd-stat-item">
            <span className="vsd-stat-label">Distributed</span>
            <span className="vsd-stat-value success">
              {formatSUI((parseInt(surveyDetails.rewardPerResponse) * parseInt(surveyDetails.currentResponses)).toString())} SUI
            </span>
          </div>
          <div className="vsd-stat-item">
            <span className="vsd-stat-label">Remaining</span>
            <span className="vsd-stat-value primary">
              {formatSUI((parseInt(surveyDetails.rewardPerResponse) * 
                (parseInt(surveyDetails.maxResponses) - parseInt(surveyDetails.currentResponses))).toString())} SUI
            </span>
          </div>
        </div>

        <div className="vsd-progress-bar">
          <div 
            className="vsd-progress-fill"
            style={{ 
              width: `${completionRate}%`,
              backgroundColor: completionRate === 100 ? '#6b7280' : '#10b981'
            }}
          />
        </div>
      </div>

      {/* Questions Section */}
      <div className="vsd-questions-section">
        <h3 className="vsd-section-title">
          Survey Questions
          <span className="vsd-question-count">{surveyDetails.questions.length}</span>
        </h3>
        
        <div className="vsd-questions-list">
          {surveyDetails.questions.map((question, index) => (
            <div key={index} className="vsd-question-card">
              <div className="vsd-question-header">
                <div className="vsd-question-number">Q{index + 1}</div>
                <div className="vsd-question-type">
                  {getQuestionTypeIcon(question.question_type)}
                  <span>{getQuestionTypeLabel(question.question_type)}</span>
                </div>
              </div>
              
              <p className="vsd-question-text">{question.question_text}</p>
              
              {/* Options for choice questions */}
              {question.question_type !== 2 && question.options.length > 0 && (
                <div className="vsd-question-options">
                  {question.options.map((option, optIndex) => (
                    <div key={optIndex} className="vsd-option-item">
                      <span className="vsd-option-icon">
                        {question.question_type === 0 ? '○' : '□'}
                      </span>
                      <span className="vsd-option-text">{option}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Text answer indicator */}
              {question.question_type === 2 && (
                <div className="vsd-text-answer-indicator">
                  <Type size={14} />
                  <span>Text answer required</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Section */}
      <div className="vsd-action-section">
        {surveyDetails.isActive && 
         parseInt(surveyDetails.currentResponses) < parseInt(surveyDetails.maxResponses) && 
         !hasAnswered && 
         currentAccount ? (
          <button className="vsd-action-btn primary" onClick={startAnsweringSurvey}>
            <Award size={18} />
            Answer Survey & Earn {formatSUI(surveyDetails.rewardPerResponse)} SUI
          </button>
        ) : hasAnswered ? (
          <button className="vsd-action-btn disabled" disabled>
            <CheckCircle size={18} />
            Already Answered
          </button>
        ) : !currentAccount ? (
          <button className="vsd-action-btn connect" disabled>
            <Wallet size={18} />
            Connect Wallet to Answer
          </button>
        ) : !surveyDetails.isActive ? (
          <button className="vsd-action-btn disabled" disabled>
            <Clock size={18} />
            Survey Closed
          </button>
        ) : (
          <button className="vsd-action-btn disabled" disabled>
            <Users size={18} />
            Survey Full
          </button>
        )}
      </div>
    </div>
  );
}

export default ViewSurveyDetails;