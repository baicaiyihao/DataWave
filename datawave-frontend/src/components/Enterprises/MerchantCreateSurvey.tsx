// src/components/Merchant/MerchantCreateSurvey.tsx
import { useState, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { Transaction } from "@mysten/sui/transactions";
import { ConfigService } from '../../services/config';
import { 
  Trash2, 
  Plus, 
  Coins, 
  FileText, 
  Radio, 
  CheckSquare, 
  Type,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { SuccessModal } from '../Common/SuccessModal';
import './MerchantCreateSurvey.css';

// 问题类型枚举
enum QuestionType {
  SINGLE_CHOICE = 0,
  MULTIPLE_CHOICE = 1,
  TEXT = 2
}

// 问题接口
interface Question {
  text: string;
  type: QuestionType;
  options: string[];
}

// 预设问卷类别
const SURVEY_CATEGORIES = [
  'Feedback',
  'Research', 
  'Opinion',
  'Experience',
  'Satisfaction',
  'Testing',
  'Demographics',
  'Preference',
  'Evaluation',
  'Knowledge',
  'Behavioral',
  'Other'
];

// 问卷模板
const SURVEY_TEMPLATES = [
  {
    name: 'Customer Satisfaction',
    title: 'Customer Satisfaction Survey',
    description: 'Help us improve our service by sharing your experience',
    category: 'Satisfaction',
    questions: [
      {
        text: 'How satisfied are you with our product?',
        type: QuestionType.SINGLE_CHOICE,
        options: ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied']
      },
      {
        text: 'What features do you value most?',
        type: QuestionType.MULTIPLE_CHOICE,
        options: ['Quality', 'Price', 'Customer Service', 'Delivery Speed', 'User Experience']
      },
      {
        text: 'Any additional feedback?',
        type: QuestionType.TEXT,
        options: []
      }
    ]
  },
  {
    name: 'Product Feedback',
    title: 'Product Feedback Survey',
    description: 'Share your thoughts on our latest product',
    category: 'Feedback',
    questions: [
      {
        text: 'How often do you use our product?',
        type: QuestionType.SINGLE_CHOICE,
        options: ['Daily', 'Weekly', 'Monthly', 'Rarely', 'First Time']
      },
      {
        text: 'What improvements would you suggest?',
        type: QuestionType.TEXT,
        options: []
      }
    ]
  },
  {
    name: 'Market Research',
    title: 'Market Research Survey',
    description: 'Help us understand market trends and user preferences',
    category: 'Research',
    questions: [
      {
        text: 'Which category best describes your industry?',
        type: QuestionType.SINGLE_CHOICE,
        options: ['Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Other']
      },
      {
        text: 'What is your primary use case?',
        type: QuestionType.TEXT,
        options: []
      }
    ]
  }
];

export function MerchantCreateSurvey() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const navigate = useNavigate();
  const packageId = ConfigService.getPackageId();
  
  // 基本信息状态
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [rewardPerResponse, setRewardPerResponse] = useState('');
  const [maxResponses, setMaxResponses] = useState('100');
  
  // 问题管理状态
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    text: '',
    type: QuestionType.SINGLE_CHOICE,
    options: []
  });
  const [currentOption, setCurrentOption] = useState('');
  
  // UI状态
  const [isCreating, setIsCreating] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  
  // Success Modal状态
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdSurveyData, setCreatedSurveyData] = useState<{
    id: string;
    title: string;
    digest: string;
    totalCost: number;
  } | null>(null);
  
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  
  // 获取用户余额
  const getUserBalance = async () => {
    if (!currentAccount?.address) return;
    
    try {
      const coins = await suiClient.getCoins({
        owner: currentAccount.address,
        coinType: '0x2::sui::SUI'
      });
      
      const total = coins.data.reduce((sum, coin) => 
        sum + parseInt(coin.balance), 0
      );
      setUserBalance(total);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };
  
  // 组件加载时获取余额
  useEffect(() => {
    getUserBalance();
  }, [currentAccount?.address]);

  // 应用模板
  const applyTemplate = (template: typeof SURVEY_TEMPLATES[0]) => {
    setTitle(template.title);
    setDescription(template.description);
    setCategory(template.category);
    setQuestions(template.questions);
  };
  
  // 添加选项到当前问题
  const addOptionToCurrentQuestion = () => {
    if (currentOption.trim() && currentQuestion.type !== QuestionType.TEXT) {
      setCurrentQuestion({
        ...currentQuestion,
        options: [...currentQuestion.options, currentOption.trim()]
      });
      setCurrentOption('');
    }
  };
  
  // 删除选项
  const removeOptionFromCurrentQuestion = (index: number) => {
    setCurrentQuestion({
      ...currentQuestion,
      options: currentQuestion.options.filter((_, i) => i !== index)
    });
  };
  
  // 添加问题到列表
  const addQuestion = () => {
    if (!currentQuestion.text.trim()) {
      alert('Please enter question text');
      return;
    }
    
    if (currentQuestion.type === QuestionType.TEXT) {
      setQuestions([...questions, { ...currentQuestion, options: [] }]);
    } else {
      if (currentQuestion.options.length < 2) {
        alert('Please add at least 2 options for choice questions');
        return;
      }
      setQuestions([...questions, currentQuestion]);
    }
    
    // 重置当前问题
    setCurrentQuestion({
      text: '',
      type: QuestionType.SINGLE_CHOICE,
      options: []
    });
    setCurrentOption('');
    setShowQuestionForm(false);
  };
  
  // 删除问题
  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };
  
  // 创建问卷
  const handleCreateSurvey = async () => {
    // 验证
    if (!title || !description || !category) {
      alert('Please fill in all survey information');
      return;
    }
    
    if (!rewardPerResponse || parseFloat(rewardPerResponse) <= 0) {
      alert('Please set a reward amount');
      return;
    }
    
    if (questions.length === 0) {
      alert('Please add at least one question');
      return;
    }
    
    if (!currentAccount?.address) {
      alert('Please connect your wallet');
      return;
    }
    
    setIsCreating(true);
    
    try {
      const tx = new Transaction();
      
      // 准备数据
      const titleBytes = Array.from(new TextEncoder().encode(title));
      const descriptionBytes = Array.from(new TextEncoder().encode(description));
      const categoryBytes = Array.from(new TextEncoder().encode(category));
      
      const questionTexts: number[][] = questions.map(q => 
        Array.from(new TextEncoder().encode(q.text))
      );
      
      const questionTypes: number[] = questions.map(q => q.type);
      
      const questionOptions: number[][][] = questions.map(q => {
        if (q.type === QuestionType.TEXT) {
          return [];
        }
        return q.options.map(opt => 
          Array.from(new TextEncoder().encode(opt))
        );
      });
      
      // 转换 reward 为 MIST (1 SUI = 1,000,000,000 MIST)
      const rewardInMist = Math.floor(parseFloat(rewardPerResponse) * 1000000000);
      
      // 计算总金额
      const totalRequired = rewardInMist * parseInt(maxResponses);
      const totalWithBuffer = totalRequired + 100000000; // 加 0.1 SUI 缓冲
      
      console.log('Creating survey:', {
        title,
        category,
        questions: questions.length,
        rewardPerResponse: rewardPerResponse + ' SUI',
        totalCost: (totalRequired / 1000000000).toFixed(3) + ' SUI'
      });
      
      // 从 gas 中分割支付
      const [paymentCoin] = tx.splitCoins(tx.gas, [totalWithBuffer]);
      
      // 调用合约
      tx.moveCall({
        target: `${packageId}::survey_system::create_survey_with_questions_entry`,
        arguments: [
          tx.pure('vector<u8>', titleBytes),
          tx.pure('vector<u8>', descriptionBytes),
          tx.pure('vector<u8>', categoryBytes),
          tx.pure('vector<vector<u8>>', questionTexts),
          tx.pure('vector<u8>', questionTypes),
          tx.pure('vector<vector<vector<u8>>>', questionOptions),
          tx.pure.u64(rewardInMist),
          tx.pure.u64(parseInt(maxResponses)),
          paymentCoin,
          tx.object(ConfigService.getSurveyRegistryId()),
          tx.object('0x6') // Clock
        ],
      });
      
      tx.setGasBudget(1000000000);
      
      // 执行交易
      const result = await signAndExecute({ transaction: tx as any});
      
      console.log('Transaction result:', result);
      
      if (result && result.digest) {
        console.log('Transaction successful! Digest:', result.digest);
        
        // 等待链上同步
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          // 获取交易详情
          const txDetails = await suiClient.getTransactionBlock({
            digest: result.digest,
            options: {
              showObjectChanges: true,
              showEffects: true,
            }
          });
          
          console.log('Transaction details:', txDetails);
          
          // 查找创建的 Survey ID
          let surveyId: string | null = null;
          
          if (txDetails.objectChanges) {
            // 打印所有对象变化以调试
            console.log('Object changes:', txDetails.objectChanges);
            
            // 查找 Survey 对象 (排除 dynamic_field)
            for (const change of txDetails.objectChanges) {
              if (change.type === 'created' && change.objectType) {
                console.log(`Created object: ${change.objectId}, Type: ${change.objectType}`);
                
                // 检查是否是 Survey 类型 (不是 Field 或其他类型)
                if (change.objectType.includes('::survey_system::Survey') &&
                    !change.objectType.includes('Field') &&
                    !change.objectType.includes('SurveyBasicInfo') &&
                    !change.objectType.includes('Table') &&
                    !change.objectType.includes('Cap')) {
                  surveyId = change.objectId;
                  console.log('✅ Found Survey ID:', surveyId);
                  break;
                }
              }
            }
            
            // 如果仍然没找到，尝试从 created 对象中找到最可能的
            if (!surveyId) {
              const createdObjects = txDetails.objectChanges
                .filter(c => c.type === 'created')
                .filter(c => c.objectType && !c.objectType.includes('Field') && !c.objectType.includes('Table'));
              
              console.log('Created objects (non-Field):', createdObjects);
              
              // 查找包含 survey_system 模块的对象
              const surveyObject = createdObjects.find(c => 
                c.objectType?.includes('survey_system') && 
                !c.objectType?.includes('SurveyBasicInfo')
              );
              
              if (surveyObject) {
                surveyId = surveyObject.objectId;
                console.log('✅ Found Survey ID (fallback):', surveyId);
              }
            }
          }
          
          if (surveyId) {
            // 保存到 localStorage
            const surveyData = {
              id: surveyId,
              title,
              description,
              category,
              questions,
              rewardPerResponse: rewardInMist.toString(),
              maxResponses,
              createdAt: new Date().toISOString(),
              creator: currentAccount.address,
              digest: result.digest
            };
            
            localStorage.setItem(`survey_${surveyId}`, JSON.stringify(surveyData));
            
            const surveyIndex = JSON.parse(localStorage.getItem('survey_index') || '[]');
            if (!surveyIndex.includes(surveyId)) {
              surveyIndex.push(surveyId);
              localStorage.setItem('survey_index', JSON.stringify(surveyIndex));
            }
            
            // 显示成功Modal
            setCreatedSurveyData({
              id: surveyId,
              title,
              digest: result.digest,
              totalCost: totalRequired / 1000000000
            });
            setShowSuccessModal(true);
            
            // 重置表单
            setTitle('');
            setDescription('');
            setCategory('');
            setQuestions([]);
            setRewardPerResponse('');
            setMaxResponses('100');
            
          } else {
            // 如果没有找到Survey ID，也显示成功Modal但不能查看详情
            console.warn('⚠️ Could not find Survey ID in transaction');
            setCreatedSurveyData({
              id: '',
              title,
              digest: result.digest,
              totalCost: totalRequired / 1000000000
            });
            setShowSuccessModal(true);
          }
          
        } catch (error) {
          console.error('Error fetching transaction details:', error);
          // 如果获取详情失败，也显示成功Modal
          setCreatedSurveyData({
            id: '',
            title,
            digest: result.digest,
            totalCost: totalRequired / 1000000000
          });
          setShowSuccessModal(true);
        }
        
      } else {
        alert('Transaction failed. Please try again.');
      }
      
    } catch (error: any) {
      console.error('Error creating survey:', error);
      alert(`Error: ${error.message || 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };
  
  // 计算成本
  const rewardInSUI = rewardPerResponse ? parseFloat(rewardPerResponse) : 0;
  const totalCost = rewardInSUI * parseInt(maxResponses);
  const isBalanceSufficient = userBalance !== null && userBalance >= (totalCost * 1000000000);
  
  // 获取问题类型图标
  const getQuestionTypeIcon = (type: QuestionType) => {
    switch (type) {
      case QuestionType.SINGLE_CHOICE: return <Radio size={16} />;
      case QuestionType.MULTIPLE_CHOICE: return <CheckSquare size={16} />;
      case QuestionType.TEXT: return <Type size={16} />;
    }
  };
  
  const getQuestionTypeName = (type: QuestionType) => {
    switch (type) {
      case QuestionType.SINGLE_CHOICE: return 'Single Choice';
      case QuestionType.MULTIPLE_CHOICE: return 'Multiple Choice';
      case QuestionType.TEXT: return 'Text Answer';
    }
  };

  return (
    <div className="mcs-container">
      {/* Header */}
      <div className="mcs-header">
        <h1 className="mcs-title">Create Survey</h1>
        
        {/* Balance Display */}
        {userBalance !== null && (
          <div className="mcs-balance-card">
            <div className="mcs-balance-row">
              <div className="mcs-balance-label">
                <Coins size={16} />
                <span>Wallet Balance:</span>
              </div>
              <span className={`mcs-balance-value ${isBalanceSufficient ? 'sufficient' : 'insufficient'}`}>
                {(userBalance / 1000000000).toFixed(3)} SUI
              </span>
            </div>
          </div>
        )}

        {/* Templates */}
        <div className="mcs-template-section">
          <div className="mcs-template-header">
            <Sparkles size={16} />
            <span className="mcs-template-title">Quick Templates</span>
          </div>
          <div className="mcs-template-grid">
            {SURVEY_TEMPLATES.map((template, index) => (
              <button 
                key={index}
                className="mcs-template-btn"
                onClick={() => applyTemplate(template)}
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Basic Info */}
      <div className="mcs-form-card">
        <div className="mcs-form-group">
          <label className="mcs-form-label">Survey Title</label>
          <input
            className="mcs-input"
            placeholder="Enter survey title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        
        <div className="mcs-form-group">
          <label className="mcs-form-label">Description</label>
          <textarea
            className="mcs-textarea"
            placeholder="Describe your survey purpose"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        
        <div className="mcs-form-group">
          <label className="mcs-form-label">Category</label>
          <select
            className="mcs-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Select a category</option>
            {SURVEY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        
        {/* Reward Settings */}
        <div className="mcs-reward-grid">
          <div className="mcs-reward-item">
            <label className="mcs-form-label">Reward per Response (SUI)</label>
            <input
              className="mcs-input"
              placeholder="e.g., 0.5"
              value={rewardPerResponse}
              onChange={(e) => setRewardPerResponse(e.target.value)}
              type="number"
              step="0.1"
              min="0"
            />
            <span className="mcs-reward-hint">
              {rewardInSUI > 0 && `= ${(rewardInSUI * 1000000000).toLocaleString()} MIST`}
            </span>
          </div>
          
          <div className="mcs-reward-item">
            <label className="mcs-form-label">Maximum Responses</label>
            <input
              className="mcs-input"
              value={maxResponses}
              onChange={(e) => setMaxResponses(e.target.value)}
              type="number"
              min="1"
            />
          </div>
        </div>
        
        {/* Cost Summary */}
        {rewardInSUI > 0 && (
          <div className="mcs-cost-card">
            <div className="mcs-cost-row">
              <span className="mcs-cost-label">Total Survey Cost:</span>
              <span className="mcs-cost-value">{totalCost.toFixed(3)} SUI</span>
            </div>
            <div className="mcs-cost-breakdown">
              {parseInt(maxResponses)} responses × {rewardInSUI} SUI = {totalCost.toFixed(3)} SUI
              <br />+ ~0.1 SUI for gas fees
            </div>
          </div>
        )}
      </div>
      
      {/* Questions Management */}
      <div className="mcs-questions-card">
        <div className="mcs-questions-header">
          <div className="mcs-questions-title">
            Questions
            <span className="mcs-questions-count">{questions.length}</span>
          </div>
          <button 
            onClick={() => setShowQuestionForm(!showQuestionForm)} 
            className="mcs-add-question-btn"
          >
            <Plus size={16} /> Add Question
          </button>
        </div>
        
        {/* Add Question Form */}
        {showQuestionForm && (
          <div className="mcs-question-form">
            <input
              className="mcs-input"
              placeholder="Enter your question"
              value={currentQuestion.text}
              onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })}
            />
            
            {/* Question Type Selection */}
            <div className="mcs-question-type-select">
              <button
                className={`mcs-type-btn ${currentQuestion.type === QuestionType.SINGLE_CHOICE ? 'active' : ''}`}
                onClick={() => setCurrentQuestion({ 
                  ...currentQuestion, 
                  type: QuestionType.SINGLE_CHOICE,
                  options: []
                })}
              >
                <Radio size={20} />
                <span>Single Choice</span>
              </button>
              
              <button
                className={`mcs-type-btn ${currentQuestion.type === QuestionType.MULTIPLE_CHOICE ? 'active' : ''}`}
                onClick={() => setCurrentQuestion({ 
                  ...currentQuestion, 
                  type: QuestionType.MULTIPLE_CHOICE,
                  options: []
                })}
              >
                <CheckSquare size={20} />
                <span>Multiple Choice</span>
              </button>
              
              <button
                className={`mcs-type-btn ${currentQuestion.type === QuestionType.TEXT ? 'active' : ''}`}
                onClick={() => setCurrentQuestion({ 
                  ...currentQuestion, 
                  type: QuestionType.TEXT,
                  options: []
                })}
              >
                <Type size={20} />
                <span>Text Answer</span>
              </button>
            </div>
            
            {/* Options Management */}
            {currentQuestion.type !== QuestionType.TEXT && (
              <>
                <div className="mcs-option-input-row">
                  <input
                    className="mcs-input mcs-option-input"
                    placeholder="Add an option"
                    value={currentOption}
                    onChange={(e) => setCurrentOption(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addOptionToCurrentQuestion()}
                  />
                  <button onClick={addOptionToCurrentQuestion} className="mcs-add-option-btn">
                    Add Option
                  </button>
                </div>
                
                <div className="mcs-options-list">
                  {currentQuestion.options.map((opt, idx) => (
                    <div key={idx} className="mcs-option-item">
                      <span className="mcs-option-text">• {opt}</span>
                      <button
                        className="mcs-remove-option-btn"
                        onClick={() => removeOptionFromCurrentQuestion(idx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            <div className="mcs-question-actions">
              <button onClick={() => setShowQuestionForm(false)} className="mcs-cancel-btn">
                Cancel
              </button>
              <button onClick={addQuestion} className="mcs-save-question-btn">
                Save Question
              </button>
            </div>
          </div>
        )}
        
        {/* Questions List */}
        <div className="mcs-questions-list">
          {questions.map((q, index) => (
            <div key={index} className="mcs-question-item">
              <div className="mcs-question-header-row">
                <div className="mcs-question-info">
                  <div className="mcs-question-number">
                    Q{index + 1}
                    <span className="mcs-question-type-badge">
                      {getQuestionTypeIcon(q.type)}
                      {getQuestionTypeName(q.type)}
                    </span>
                  </div>
                  <div className="mcs-question-text">{q.text}</div>
                  {q.options.length > 0 && (
                    <div className="mcs-question-options">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="mcs-question-option">
                          <span>{optIdx + 1}. {opt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button 
                  className="mcs-remove-question-btn"
                  onClick={() => removeQuestion(index)}
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {questions.length === 0 && !showQuestionForm && (
          <div className="mcs-empty-questions">
            <FileText size={32} style={{ opacity: 0.3 }} />
            <p>No questions yet. Click "Add Question" to start.</p>
          </div>
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="mcs-actions-card">
        <div className="mcs-actions-grid">
          <button
            className={`mcs-create-btn ${isCreating ? 'creating' : ''}`}
            onClick={handleCreateSurvey}
            disabled={isCreating || questions.length === 0 || !currentAccount || !isBalanceSufficient || !rewardPerResponse}
          >
            {isCreating ? (
              <>
                <div className="mcs-spinner"></div>
                <span>Creating Survey...</span>
              </>
            ) : (
              <>
                <Plus size={20} />
                <span>Create Survey {totalCost > 0 && `(${totalCost.toFixed(3)} SUI)`}</span>
              </>
            )}
          </button>
          
          <button
            className="mcs-cancel-action-btn"
            onClick={() => navigate('/app/my-surveys')}
          >
            Cancel
          </button>
        </div>
        
        {(!currentAccount || !isBalanceSufficient || !rewardPerResponse || questions.length === 0) && (
          <div className="mcs-error-message">
            <AlertCircle size={16} />
            {!currentAccount && 'Please connect your wallet'}
            {currentAccount && !rewardPerResponse && 'Please set a reward amount'}
            {currentAccount && rewardPerResponse && !isBalanceSufficient && `Insufficient balance. Need at least ${totalCost.toFixed(3)} SUI`}
            {currentAccount && rewardPerResponse && isBalanceSufficient && questions.length === 0 && 'Please add at least one question'}
          </div>
        )}
      </div>
      
      {/* Success Modal */}
      {showSuccessModal && createdSurveyData && (
        <SuccessModal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          surveyId={createdSurveyData.id}
          title={createdSurveyData.title}
          txDigest={createdSurveyData.digest}
          totalCost={createdSurveyData.totalCost}
          onViewDetails={() => {
            if (createdSurveyData.id) {
              navigate(`/app/survey/${createdSurveyData.id}`);
            }
          }}
          onViewList={() => {
            navigate('/app/my-surveys');
          }}
        />
      )}
    </div>
  );
}

export default MerchantCreateSurvey;