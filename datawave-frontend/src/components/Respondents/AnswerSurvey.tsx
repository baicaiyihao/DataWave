// src/components/AnswerSurvey.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from "@mysten/sui/transactions";
import { ConfigService } from '../../services/config';
import { SealClient } from '@mysten/seal';
import { fromHex, toHex } from '@mysten/sui/utils';
import { 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  Lock, 
  Upload,
  CheckCircle,
  AlertCircle,
  Coins,
  Shield,
  Radio,
  CheckSquare,
  Type,
  AlertTriangle,
  Users,
  ClipboardList,
  Calendar
} from 'lucide-react';
import './AnswerSurvey.css';

interface Question {
  question_text: string;
  question_type: number; // 0: single, 1: multiple, 2: text
  options: string[];
}

interface SurveyData {
  id: string;
  title: string;
  description: string;
  category: string;
  rewardPerResponse: string;
  maxResponses: string;
  currentResponses: string;
  isActive: boolean;
  questions: Question[];
  creator: string;
}

interface Answer {
  questionIndex: number;
  questionText: string;
  questionType: number;
  answer: string | string[];
}

// Walrus服务配置
const WALRUS_SERVICES = [
  { id: 'walrus.space', publisherUrl: '/publisher1', aggregatorUrl: '/aggregator1' },
  { id: 'staketab.org', publisherUrl: '/publisher2', aggregatorUrl: '/aggregator2' },
  { id: 'redundex.com', publisherUrl: '/publisher3', aggregatorUrl: '/aggregator3' },
  { id: 'nodes.guru', publisherUrl: '/publisher4', aggregatorUrl: '/aggregator4' },
  { id: 'banansen.dev', publisherUrl: '/publisher5', aggregatorUrl: '/aggregator5' },
  { id: 'everstake.one', publisherUrl: '/publisher6', aggregatorUrl: '/aggregator6' },
];

const MIN_GAS_BALANCE = 0.1; // 最小需要0.1 SUI来支付gas费

export function AnswerSurvey() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // Seal配置
  const serverObjectIds = [
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
  ];
  
  const sealClient = new SealClient({
    suiClient,
    serverConfigs: serverObjectIds.map((id) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers: false,
  });

  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [insufficientBalance, setInsufficientBalance] = useState(false);
  
  // 答题状态
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<string | string[]>('');
  const [consentForSubscription, setConsentForSubscription] = useState(false);
  
  // 上传状态
  const [uploadProgress, setUploadProgress] = useState<{
    step: 'idle' | 'encrypting' | 'uploading' | 'submitting' | 'complete' | 'error';
    message: string;
    serviceAttempts: string[];
  }>({
    step: 'idle',
    message: '',
    serviceAttempts: []
  });

  const NUM_EPOCH = 30;

  // 获取钱包余额
  const fetchWalletBalance = async () => {
    if (!currentAccount?.address) return;
    
    try {
      const balance = await suiClient.getBalance({
        owner: currentAccount.address,
      });
      const balanceInSUI = Number(balance.totalBalance) / 1_000_000_000;
      setWalletBalance(balanceInSUI);
      setInsufficientBalance(balanceInSUI < MIN_GAS_BALANCE);
    } catch (error) {
      console.error('Error fetching balance:', error);
      setInsufficientBalance(true);
    }
  };

  // 负载均衡上传到Walrus
  const uploadToWalrus = async (data: Uint8Array): Promise<{ blobId: string; service: string }> => {
    let lastError: Error | null = null;
    const attemptedServices: string[] = [];

    for (const service of WALRUS_SERVICES) {
      attemptedServices.push(service.id);
      setUploadProgress({
        step: 'uploading',
        message: `尝试上传到 ${service.id}...`,
        serviceAttempts: attemptedServices
      });

      try {
        const url = `${service.publisherUrl}/v1/blobs?epochs=${NUM_EPOCH}`;
        const response = await fetch(url, {
          method: 'PUT',
          body: data as BodyInit,
        });

        if (response.ok) {
          const result = await response.json();
          let blobId: string;
          
          if ('alreadyCertified' in result) {
            blobId = result.alreadyCertified.blobId;
          } else if ('newlyCreated' in result) {
            blobId = result.newlyCreated.blobObject.blobId;
          } else {
            throw new Error('Unexpected response format');
          }

          setUploadProgress({
            step: 'uploading',
            message: `成功上传到 ${service.id}`,
            serviceAttempts: attemptedServices
          });

          return { blobId, service: service.id };
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error: any) {
        console.error(`Failed to upload to ${service.id}:`, error);
        lastError = error;
      }
    }

    throw new Error(`所有上传服务均失败: ${lastError?.message || 'Unknown error'}`);
  };

  // 加载问卷详情
  const loadSurvey = async () => {
    if (!surveyId) return;
    
    setLoading(true);
    try {
      const surveyObj = await suiClient.getObject({
        id: surveyId,
        options: { showContent: true }
      });

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
          category: fields.category || 'Feedback',
          rewardPerResponse: fields.reward_per_response || '0',
          maxResponses: fields.max_responses || '0',
          currentResponses: fields.current_responses || '0',
          isActive: fields.is_active || false,
          questions,
          creator: fields.creator || ''
        };

        setSurvey(surveyData);

        // 检查是否已回答
        if (currentAccount?.address && fields.respondents?.fields?.id?.id) {
          try {
            const hasAnsweredField = await suiClient.getDynamicFieldObject({
              parentId: fields.respondents.fields.id.id,
              name: {
                type: 'address',
                value: currentAccount.address,
              }
            });
            setHasAnswered(!!hasAnsweredField.data);
          } catch (error) {
            setHasAnswered(false);
          }
        }
      }
    } catch (error) {
      console.error('Error loading survey:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSurvey();
  }, [surveyId]);

  useEffect(() => {
    fetchWalletBalance();
  }, [currentAccount]);

  // 处理答案选择
  const handleSingleChoice = (value: string) => {
    setCurrentAnswer(value);
  };

  const handleMultipleChoice = (option: string, checked: boolean) => {
    const current = Array.isArray(currentAnswer) ? currentAnswer : [];
    if (checked) {
      setCurrentAnswer([...current, option]);
    } else {
      setCurrentAnswer(current.filter(o => o !== option));
    }
  };

  const handleTextAnswer = (value: string) => {
    setCurrentAnswer(value);
  };

  // 保存并下一题
  const saveAndNext = () => {
    if (!survey) return;
    
    if (!currentAnswer || (Array.isArray(currentAnswer) && currentAnswer.length === 0)) {
      alert('请提供一个答案');
      return;
    }

    const newAnswer: Answer = {
      questionIndex: currentQuestionIndex,
      questionText: survey.questions[currentQuestionIndex].question_text,
      questionType: survey.questions[currentQuestionIndex].question_type,
      answer: currentAnswer
    };

    const updatedAnswers = [...answers];
    const existingIndex = updatedAnswers.findIndex(a => a.questionIndex === currentQuestionIndex);
    if (existingIndex >= 0) {
      updatedAnswers[existingIndex] = newAnswer;
    } else {
      updatedAnswers.push(newAnswer);
    }
    setAnswers(updatedAnswers);

    if (currentQuestionIndex < survey.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      const nextAnswer = updatedAnswers.find(a => a.questionIndex === currentQuestionIndex + 1);
      setCurrentAnswer(nextAnswer ? nextAnswer.answer : '');
    }
  };

  // 返回上一题
  const goBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      const previousAnswer = answers.find(a => a.questionIndex === currentQuestionIndex - 1);
      setCurrentAnswer(previousAnswer ? previousAnswer.answer : '');
    }
  };

  // 提交答案
  const submitAnswers = async () => {
    if (!survey || !currentAccount?.address) return;

    // 检查余额
    if (insufficientBalance) {
      alert(`余额不足！需要至少 ${MIN_GAS_BALANCE} SUI 来支付交易费用。当前余额：${walletBalance.toFixed(3)} SUI`);
      return;
    }

    // 保存最后一题
    if (currentQuestionIndex === survey.questions.length - 1 && currentAnswer) {
      saveAndNext();
    }

    const finalAnswers = currentQuestionIndex === survey.questions.length - 1 && 
      answers.length === survey.questions.length - 1 ? 
      [...answers, {
        questionIndex: currentQuestionIndex,
        questionText: survey.questions[currentQuestionIndex].question_text,
        questionType: survey.questions[currentQuestionIndex].question_type,
        answer: currentAnswer
      }] : answers;

    if (finalAnswers.length !== survey.questions.length) {
      alert(`请回答所有 ${survey.questions.length} 个问题`);
      return;
    }

    setSubmitting(true);
    setUploadProgress({ step: 'encrypting', message: '加密您的答案...', serviceAttempts: [] });
    
    try {
      // 1. 准备答案数据
      const answerData = {
        surveyId: survey.id,
        respondent: currentAccount.address,
        timestamp: Date.now(),
        answers: finalAnswers,
        consent: consentForSubscription
      };

      const answerJson = JSON.stringify(answerData);
      const answerBytes = new TextEncoder().encode(answerJson);

      // 2. 生成ID
      const nonce = crypto.getRandomValues(new Uint8Array(5));
      if (!surveyId) {
        throw new Error('Survey ID is required');
      }
      const surveyIdBytes = fromHex(surveyId.replace(/^0x/, ''));
      const id = toHex(new Uint8Array([...surveyIdBytes, ...nonce]));
      
      // 3. Seal加密
      const { encryptedObject: encryptedData } = await sealClient.encrypt({
        threshold: 2,
        packageId: ConfigService.getPackageId(),
        id: id,
        data: answerBytes,
      });
      
      // 4. 负载均衡上传
      const { blobId, service } = await uploadToWalrus(encryptedData);
      
      // 5. 提交到链上
      setUploadProgress({
        step: 'submitting',
        message: '提交到区块链...',
        serviceAttempts: [service]
      });
      
      const tx = new Transaction();
      
      const blobIdBytes = Array.from(new TextEncoder().encode(blobId));
      const sealKeyIdBytes = Array.from(new TextEncoder().encode(id));
      
      tx.moveCall({
        target: `${ConfigService.getPackageId()}::survey_system::submit_answer_entry`,
        arguments: [
          tx.object(survey.id),
          tx.pure.vector('u8', blobIdBytes),
          tx.pure.vector('u8', sealKeyIdBytes),
          tx.pure.bool(consentForSubscription),
          tx.object(ConfigService.getPlatformTreasuryId()),
          tx.object(ConfigService.getSurveyRegistryId()),
          tx.object('0x6'),
        ],
      });
      
      tx.setGasBudget(1000000000);
      
      signAndExecute(
        { transaction: tx as any},
        {
          onSuccess: (result) => {
            setUploadProgress({
              step: 'complete',
              message: '提交成功！',
              serviceAttempts: [service]
            });
            
            // 保存记录
            const answerRecord = {
              surveyId: survey.id,
              blobId,
              sealKeyId: id,
              timestamp: Date.now(),
              txDigest: result.digest,
              consent: consentForSubscription,
              service: service
            };
            localStorage.setItem(`survey_answer_${survey.id}`, JSON.stringify(answerRecord));
            
            setHasAnswered(true);
            
            setTimeout(() => {
              navigate('/app/my-responses');
            }, 2000);
          },
          onError: (error) => {
            console.error('Transaction error:', error);
            setUploadProgress({
              step: 'error',
              message: `提交失败: ${error.message}`,
              serviceAttempts: []
            });
          }
        }
      );
      
    } catch (error: any) {
      console.error('Submit error:', error);
      setUploadProgress({
        step: 'error',
        message: error.message || '提交失败',
        serviceAttempts: uploadProgress.serviceAttempts
      });
    } finally {
      if (uploadProgress.step !== 'complete') {
        setSubmitting(false);
      }
    }
  };

  const formatSUI = (amount: string) => {
    return (parseInt(amount) / 1000000000).toFixed(3);
  };

  const getQuestionIcon = (type: number) => {
    switch (type) {
      case 0: return <Radio size={14} />;
      case 1: return <CheckSquare size={14} />;
      case 2: return <Type size={14} />;
      default: return null;
    }
  };

  const getQuestionTypeName = (type: number) => {
    switch (type) {
      case 0: return 'Single Choice';
      case 1: return 'Multiple Choice';
      case 2: return 'Text Answer';
      default: return 'Unknown';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="ans-container">
        <div className="ans-loading-state">
          <div className="ans-loading-spinner"></div>
          <span>Loading survey...</span>
        </div>
      </div>
    );
  }

  // Error states
  if (!survey) {
    return (
      <div className="ans-container">
        <div className="ans-error-state">
          <AlertCircle size={48} />
          <h3>Survey Not Found</h3>
          <p>This survey doesn't exist or has been removed.</p>
          <button className="ans-btn-primary" onClick={() => navigate('/app/marketplace')}>
            <ChevronLeft size={16} /> Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  if (hasAnswered) {
    return (
      <div className="ans-container">
        <div className="ans-success-state">
          <CheckCircle size={48} />
          <h3>Already Answered</h3>
          <p>You have already answered this survey. Thank you for your participation!</p>
          <button className="ans-btn-primary" onClick={() => navigate('/app/my-responses')}>
            View My Responses
          </button>
        </div>
      </div>
    );
  }

  if (!survey.isActive) {
    return (
      <div className="ans-container">
        <div className="ans-error-state">
          <AlertCircle size={48} />
          <h3>Survey Closed</h3>
          <p>This survey is no longer accepting responses.</p>
          <button className="ans-btn-primary" onClick={() => navigate('/app/marketplace')}>
            <ChevronLeft size={16} /> Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = survey.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / survey.questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === survey.questions.length - 1;

  return (
    <div className="ans-container">
      {/* Header */}
      <div className="ans-survey-header">
        <h1 className="ans-survey-title">{survey.title}</h1>
        <p className="ans-survey-description">{survey.description}</p>
        
        <div className="ans-survey-meta">
          <div className="ans-meta-item category">
            <span className="ans-meta-label">{survey.category}</span>
          </div>
          
          <div className="ans-meta-item reward">
            <Coins size={16} />
            <span className="ans-meta-value">{formatSUI(survey.rewardPerResponse)}</span>
            <span className="ans-meta-unit">SUI</span>
          </div>
          
          <div className="ans-meta-item responses">
            <Users size={16} />
            <span className="ans-meta-value">{survey.currentResponses}/{survey.maxResponses}</span>
          </div>
          
          <div className="ans-meta-item questions">
            <ClipboardList size={16} />
            <span className="ans-meta-value">{survey.questions.length} Questions</span>
          </div>
          
          <div className="ans-meta-item date">
            <Calendar size={16} />
            <span className="ans-meta-value">Today</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="ans-progress-section">
        <div className="ans-progress-info">
          <span>Question {currentQuestionIndex + 1} of {survey.questions.length}</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="ans-progress-bar">
          <div className="ans-progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      {/* Question Card */}
      <div className="ans-question-card">
        <div className="ans-question-header">
          <div className="ans-question-number">Q{currentQuestionIndex + 1}</div>
          <div className="ans-question-type">
            {getQuestionIcon(currentQuestion.question_type)}
            <span>{getQuestionTypeName(currentQuestion.question_type)}</span>
          </div>
        </div>

        <p className="ans-question-text">{currentQuestion.question_text}</p>

        {/* Answer Input */}
        <div className="ans-answer-input">
          {currentQuestion.question_type === 0 && (
            <div className="ans-radio-group">
              {currentQuestion.options.map((option, index) => (
                <label key={index} className="ans-radio-option">
                  <input
                    type="radio"
                    name="answer"
                    value={option}
                    checked={currentAnswer === option}
                    onChange={(e) => handleSingleChoice(e.target.value)}
                  />
                  <span className="ans-radio-custom"></span>
                  <span className="ans-option-text">{option}</span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.question_type === 1 && (
            <div className="ans-checkbox-group">
              {currentQuestion.options.map((option, index) => (
                <label key={index} className="ans-checkbox-option">
                  <input
                    type="checkbox"
                    checked={(currentAnswer as string[])?.includes(option) || false}
                    onChange={(e) => handleMultipleChoice(option, e.target.checked)}
                  />
                  <span className="ans-checkbox-custom"></span>
                  <span className="ans-option-text">{option}</span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.question_type === 2 && (
            <textarea
              className="ans-text-input"
              placeholder="Type your answer here..."
              value={currentAnswer as string}
              onChange={(e) => handleTextAnswer(e.target.value)}
              rows={4}
            />
          )}
        </div>
      </div>

      {/* Settings on last question */}
      {isLastQuestion && (
        <>
          <div className="ans-consent-card">
            <div className="ans-consent-content">
              <Shield size={20} />
              <div>
                <h4>Data Sharing Consent</h4>
                <p>Allow subscribers to access your encrypted answers for analysis. You'll receive dividends from subscription revenue.</p>
              </div>
            </div>
            <label className="ans-consent-switch">
              <input
                type="checkbox"
                checked={consentForSubscription}
                onChange={(e) => setConsentForSubscription(e.target.checked)}
              />
              <span className="ans-switch-slider"></span>
            </label>
          </div>

          {insufficientBalance && (
            <div className="ans-warning-card">
              <AlertTriangle size={20} />
              <div>
                <h4>Insufficient Balance</h4>
                <p>You need at least {MIN_GAS_BALANCE} SUI to pay for transaction fees. Current balance: {walletBalance.toFixed(3)} SUI</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Navigation */}
      <div className="ans-navigation-section">
        <button
          className="ans-nav-btn secondary"
          onClick={goBack}
          disabled={currentQuestionIndex === 0}
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        {!isLastQuestion ? (
          <button className="ans-nav-btn primary" onClick={saveAndNext}>
            Next
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            className={`ans-nav-btn submit ${insufficientBalance ? 'disabled' : ''}`}
            onClick={submitAnswers}
            disabled={submitting || insufficientBalance}
          >
            {submitting ? (
              <>
                <div className="ans-btn-spinner"></div>
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Submit & Earn {formatSUI(survey.rewardPerResponse)} SUI</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Upload Progress */}
      {uploadProgress.step !== 'idle' && (
        <div className={`ans-upload-progress ${uploadProgress.step}`}>
          <div className="ans-progress-icon">
            {uploadProgress.step === 'encrypting' && <Lock size={20} />}
            {uploadProgress.step === 'uploading' && <Upload size={20} />}
            {uploadProgress.step === 'submitting' && <Send size={20} />}
            {uploadProgress.step === 'complete' && <CheckCircle size={20} />}
            {uploadProgress.step === 'error' && <AlertCircle size={20} />}
          </div>
          <div className="ans-progress-content">
            <p className="ans-progress-message">{uploadProgress.message}</p>
            {uploadProgress.serviceAttempts.length > 0 && (
              <div className="ans-service-attempts">
                {uploadProgress.serviceAttempts.map((service, index) => (
                  <span key={index} className="ans-service-tag">{service}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnswerSurvey;