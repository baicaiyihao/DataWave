// Answer Survey Component with Seal & Walrus Integration
// 基于实际的 Seal 加密和 Walrus 上传代码

import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Badge, Button, RadioGroup, Checkbox, TextArea, Switch, Spinner } from '@radix-ui/themes';
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from "@mysten/sui/transactions";
import { ConfigService } from '../services/config';
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
  Coins
} from 'lucide-react';

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

interface AnswerSurveyProps {
  surveyId: string;
  onBack?: () => void;
}

// Walrus service configuration
type WalrusService = {
  id: string;
  name: string;
  publisherUrl: string;
  aggregatorUrl: string;
};

const walrusServices: WalrusService[] = [
  {
    id: 'service1',
    name: 'walrus.space',
    publisherUrl: '/publisher1',
    aggregatorUrl: '/aggregator1',
  },
  {
    id: 'service2',
    name: 'staketab.org',
    publisherUrl: '/publisher2',
    aggregatorUrl: '/aggregator2',
  },
  {
    id: 'service3',
    name: 'redundex.com',
    publisherUrl: '/publisher3',
    aggregatorUrl: '/aggregator3',
  },
  {
    id: 'service4',
    name: 'nodes.guru',
    publisherUrl: '/publisher4',
    aggregatorUrl: '/aggregator4',
  },
  {
    id: 'service5',
    name: 'banansen.dev',
    publisherUrl: '/publisher5',
    aggregatorUrl: '/aggregator5',
  },
  {
    id: 'service6',
    name: 'everstake.one',
    publisherUrl: '/publisher6',
    aggregatorUrl: '/aggregator6',
  },
];

export function AnswerSurveyWithSeal({ surveyId, onBack }: AnswerSurveyProps) {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // Seal client setup (需要根据实际的 Seal 服务器配置)
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
  
  // 答题状态
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<string | string[]>('');
  const [consentForSubscription, setConsentForSubscription] = useState(false);
  
  // Walrus 服务选择
  const [selectedWalrusService, setSelectedWalrusService] = useState('service1');
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadingStep, setUploadingStep] = useState<'idle' | 'encrypting' | 'uploading' | 'submitting'>('idle');

  const NUM_EPOCH = 1; // Walrus storage epochs

  // Helper functions for Walrus URLs
  function getAggregatorUrl(path: string): string {
    const service = walrusServices.find((s) => s.id === selectedWalrusService);
    const cleanPath = path.replace(/^\/+/, '').replace(/^v1\//, '');
    return `${service?.aggregatorUrl}/v1/${cleanPath}`;
  }

  function getPublisherUrl(path: string): string {
    const service = walrusServices.find((s) => s.id === selectedWalrusService);
    const cleanPath = path.replace(/^\/+/, '').replace(/^v1\//, '');
    return `${service?.publisherUrl}/v1/${cleanPath}`;
  }

  // 加载问卷详情
  const loadSurvey = async () => {
    if (!surveyId) return;
    
    setLoading(true);
    try {
      const surveyObj = await suiClient.getObject({
        id: surveyId,
        options: {
          showContent: true,
        }
      });

      if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
        const fields = surveyObj.data.content.fields;
        
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

  // 处理单选答案
  const handleSingleChoice = (value: string) => {
    setCurrentAnswer(value);
  };

  // 处理多选答案
  const handleMultipleChoice = (option: string, checked: boolean) => {
    const current = Array.isArray(currentAnswer) ? currentAnswer : [];
    if (checked) {
      setCurrentAnswer([...current, option]);
    } else {
      setCurrentAnswer(current.filter(o => o !== option));
    }
  };

  // 处理文本答案
  const handleTextAnswer = (value: string) => {
    setCurrentAnswer(value);
  };

  // 保存当前答案并进入下一题
  const saveAndNext = () => {
    if (!survey) return;
    
    const question = survey.questions[currentQuestionIndex];
    
    if (!currentAnswer || (Array.isArray(currentAnswer) && currentAnswer.length === 0)) {
      alert('Please provide an answer');
      return;
    }

    const newAnswer: Answer = {
      questionIndex: currentQuestionIndex,
      questionText: question.question_text,
      questionType: question.question_type,
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
      // 加载下一题的已有答案
      const nextAnswer = updatedAnswers.find(a => a.questionIndex === currentQuestionIndex + 1);
      setCurrentAnswer(nextAnswer ? nextAnswer.answer : '');
    }
  };

  // 返回上一题
  const goBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      const previousAnswer = answers.find(a => a.questionIndex === currentQuestionIndex - 1);
      if (previousAnswer) {
        setCurrentAnswer(previousAnswer.answer);
      } else {
        setCurrentAnswer('');
      }
    }
  };



  // 上传到 Walrus
  const uploadToWalrus = async (encryptedData: Uint8Array): Promise<string> => {
    try {
      const response = await fetch(getPublisherUrl(`/blobs?epochs=${NUM_EPOCH}`), {
        method: 'PUT',
        body: encryptedData,
      });

      if (!response.ok) {
        // 尝试切换到另一个服务
        const currentIndex = walrusServices.findIndex(s => s.id === selectedWalrusService);
        const nextService = walrusServices[(currentIndex + 1) % walrusServices.length];
        setSelectedWalrusService(nextService.id);
        
        throw new Error('Failed to upload to Walrus, please try again with a different service');
      }

      const result = await response.json();
      console.log('Walrus upload response:', result);
      
      // 根据返回格式提取 blob ID
      let blobId: string;
      
      if ('alreadyCertified' in result) {
        // 数据已经存在的情况
        blobId = result.alreadyCertified.blobId;
        console.log('Blob already certified:', blobId);
      } else if ('newlyCreated' in result) {
        // 新创建的情况
        blobId = result.newlyCreated.blobObject.blobId;
        console.log('New blob created:', blobId);
      } else {
        console.error('Unexpected Walrus response format:', result);
        throw new Error('Unexpected response format from Walrus');
      }
      
      return blobId;
    } catch (error) {
      console.error('Walrus upload error:', error);
      throw error;
    }
  };

  // 提交答案
  const submitAnswers = async () => {
    if (!survey || !currentAccount?.address) return;

    // 保存最后一题的答案
    if (currentQuestionIndex === survey.questions.length - 1) {
      saveAndNext();
    }

    // 确保所有问题都已回答
    const finalAnswers = currentQuestionIndex === survey.questions.length - 1 && 
      answers.length === survey.questions.length - 1 ? 
      [...answers, {
        questionIndex: currentQuestionIndex,
        questionText: survey.questions[currentQuestionIndex].question_text,
        questionType: survey.questions[currentQuestionIndex].question_type,
        answer: currentAnswer
      }] : answers;

    if (finalAnswers.length !== survey.questions.length) {
      alert(`Please answer all ${survey.questions.length} questions`);
      return;
    }

    setSubmitting(true);
    setUploadingStep('encrypting');
    
    try {
      // 1. 准备答案数据
      const answerData = {
        surveyId: survey.id,
        respondent: currentAccount.address,
        timestamp: Date.now(),
        answers: finalAnswers.map(a => ({
          questionIndex: a.questionIndex,
          questionText: a.questionText,
          questionType: a.questionType,
          answer: a.answer
        })),
        consent: consentForSubscription
      };

      const answerJson = JSON.stringify(answerData);
      const answerBytes = new TextEncoder().encode(answerJson);

      // 2. 生成 seal key id (需要在加密前生成，以便在加密时使用)
      const nonce = crypto.getRandomValues(new Uint8Array(5));
      const surveyIdBytes = fromHex(surveyId.replace(/^0x/, ''));
      const sealKeyId = toHex(new Uint8Array([...surveyIdBytes, ...nonce]));
      
      // 3. Seal 加密（使用生成的 sealKeyId）
      setUploadProgress('Encrypting your answers with Seal...');
      
      // 加密时使用 sealKeyId 作为 id
      const { encryptedObject: encryptedData } = await sealClient.encrypt({
        threshold: 2,
        packageId: ConfigService.getPackageId(),
        id: sealKeyId,  // 使用生成的 sealKeyId
        data: answerBytes,
      });
      
      console.log('Encrypted with Seal, Key ID:', sealKeyId);
      
      // 4. Walrus 上传
      setUploadingStep('uploading');
      setUploadProgress('Uploading encrypted data to Walrus...');
      const blobId = await uploadToWalrus(encryptedData);
      
      console.log('Uploaded to Walrus, blob ID:', blobId);

      // 5. 提交到链上
      setUploadingStep('submitting');
      setUploadProgress('Recording on blockchain...');
      
      const tx = new Transaction();
      
      // 准备参数
      const blobIdBytes = Array.from(new TextEncoder().encode(blobId));
      const sealKeyIdBytes = Array.from(new TextEncoder().encode(sealKeyId));
      
      // 调用合约
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
      
      // 执行交易
      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            console.log('Transaction result:', result);
            
            // 保存到 localStorage
            const answeredSurveys = JSON.parse(localStorage.getItem('answered_surveys') || '[]');
            if (!answeredSurveys.includes(survey.id)) {
              answeredSurveys.push(survey.id);
              localStorage.setItem('answered_surveys', JSON.stringify(answeredSurveys));
            }
            
            // 保存答案记录
            const answerRecord = {
              surveyId: survey.id,
              blobId,
              sealKeyId,
              timestamp: Date.now(),
              txDigest: result.digest,
              consent: consentForSubscription
            };
            localStorage.setItem(`survey_answer_${survey.id}`, JSON.stringify(answerRecord));
            
            // 成功提示
            const reward = (parseInt(survey.rewardPerResponse) / 1000000000).toFixed(3);
            alert(
              `🎉 Survey Submitted Successfully!\n\n` +
              `You have earned ${reward} SUI!\n` +
              `Transaction: ${result.digest}\n` +
              `Blob ID: ${blobId}\n\n` +
              `Your answers have been encrypted and stored on Walrus.`
            );
            
            setHasAnswered(true);
            
            if (onBack) {
              setTimeout(onBack, 2000);
            }
          },
          onError: (error) => {
            console.error('Transaction error:', error);
            alert(`Failed to submit: ${error.message || 'Unknown error'}`);
          }
        }
      );
      
    } catch (error: any) {
      console.error('Error submitting answers:', error);
      alert(`Error: ${error.message || 'Failed to submit answers'}`);
    } finally {
      setSubmitting(false);
      setUploadingStep('idle');
      setUploadProgress('');
    }
  };

  // 格式化 SUI
  const formatSUI = (amount: string) => {
    return (parseInt(amount) / 1000000000).toFixed(3);
  };

  if (loading) {
    return (
      <Card>
        <Flex justify="center" align="center" py="5">
          <Spinner />
          <Text ml="2">Loading survey...</Text>
        </Flex>
      </Card>
    );
  }

  if (!survey) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="3" py="5">
          <Text size="4">Survey not found</Text>
          {onBack && (
            <Button onClick={onBack} variant="soft">
              <ChevronLeft size={16} /> Back to Surveys
            </Button>
          )}
        </Flex>
      </Card>
    );
  }

  if (hasAnswered) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="3" py="5">
          <CheckCircle size={48} color="green" />
          <Text size="4" weight="bold">You have already answered this survey</Text>
          <Text size="2" color="gray">Thank you for your participation!</Text>
          {onBack && (
            <Button onClick={onBack} variant="soft">
              <ChevronLeft size={16} /> Back to Surveys
            </Button>
          )}
        </Flex>
      </Card>
    );
  }

  if (!survey.isActive) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="3" py="5">
          <AlertCircle size={48} color="orange" />
          <Text size="4" weight="bold">Survey is no longer active</Text>
          {onBack && (
            <Button onClick={onBack} variant="soft">
              <ChevronLeft size={16} /> Back to Surveys
            </Button>
          )}
        </Flex>
      </Card>
    );
  }

  const currentQuestion = survey.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / survey.questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === survey.questions.length - 1;

  return (
    <Flex direction="column" gap="3" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <div>
              <Text size="5" weight="bold">{survey.title}</Text>
              <Text size="2" color="gray">{survey.description}</Text>
            </div>
            <Badge size="2" color="green">
              <Coins size={14} style={{ marginRight: '4px' }} />
              {formatSUI(survey.rewardPerResponse)} SUI
            </Badge>
          </Flex>
          
          {/* Progress */}
          <div>
            <Flex justify="between" mb="2">
              <Text size="2" color="gray">
                Question {currentQuestionIndex + 1} of {survey.questions.length}
              </Text>
              <Text size="2" weight="bold">{progress.toFixed(0)}%</Text>
            </Flex>
            <div style={{ 
              width: '100%', 
              height: '8px', 
              backgroundColor: 'var(--gray-4)', 
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${progress}%`, 
                height: '100%', 
                backgroundColor: 'var(--blue-9)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        </Flex>
      </Card>

      {/* Question Card */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <Text size="3" weight="bold">Q{currentQuestionIndex + 1}.</Text>
            <Badge color={
              currentQuestion.question_type === 0 ? 'blue' :
              currentQuestion.question_type === 1 ? 'green' : 'purple'
            }>
              {currentQuestion.question_type === 0 ? 'Single Choice' :
               currentQuestion.question_type === 1 ? 'Multiple Choice' : 'Text Answer'}
            </Badge>
          </Flex>
          
          <Text size="4">{currentQuestion.question_text}</Text>
          
          {/* Answer Input */}
          {currentQuestion.question_type === 0 && (
            <RadioGroup.Root
              value={currentAnswer as string}
              onValueChange={handleSingleChoice}
            >
              <Flex direction="column" gap="2">
                {currentQuestion.options.map((option, index) => (
                  <label key={index} style={{ cursor: 'pointer' }}>
                    <Flex align="center" gap="2">
                      <RadioGroup.Item value={option} />
                      <Text size="3">{option}</Text>
                    </Flex>
                  </label>
                ))}
              </Flex>
            </RadioGroup.Root>
          )}
          
          {currentQuestion.question_type === 1 && (
            <Flex direction="column" gap="2">
              {currentQuestion.options.map((option, index) => (
                <label key={index} style={{ cursor: 'pointer' }}>
                  <Flex align="center" gap="2">
                    <Checkbox
                      checked={(currentAnswer as string[])?.includes(option) || false}
                      onCheckedChange={(checked) => 
                        handleMultipleChoice(option, checked as boolean)
                      }
                    />
                    <Text size="3">{option}</Text>
                  </Flex>
                </label>
              ))}
            </Flex>
          )}
          
          {currentQuestion.question_type === 2 && (
            <TextArea
              placeholder="Type your answer here..."
              value={currentAnswer as string}
              onChange={(e) => handleTextAnswer(e.target.value)}
              rows={4}
            />
          )}
        </Flex>
      </Card>

      {/* Settings on last question */}
      {isLastQuestion && (
        <>
          <Card style={{ backgroundColor: 'var(--blue-2)' }}>
            <Flex align="center" justify="between">
              <div style={{ flex: 1 }}>
                <Text size="2" weight="bold">
                  Data Sharing Consent
                </Text>
                <Text size="1" color="gray">
                  Allow your encrypted answers to be accessed by subscribers for analytics.
                  You'll receive dividends from subscription revenue if you consent.
                </Text>
              </div>
              <Switch
                checked={consentForSubscription}
                onCheckedChange={setConsentForSubscription}
              />
            </Flex>
          </Card>

          <Card>
            <Flex direction="column" gap="2">
              <Text size="2" weight="bold">Select Walrus Service:</Text>
              <select
                value={selectedWalrusService}
                onChange={(e) => setSelectedWalrusService(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--gray-6)' }}
              >
                {walrusServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <Text size="1" color="gray">
                If upload fails, try a different service
              </Text>
            </Flex>
          </Card>
        </>
      )}

      {/* Navigation */}
      <Card>
        <Flex justify="between" align="center">
          <Button
            onClick={goBack}
            variant="soft"
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft size={16} />
            Previous
          </Button>
          
          {!isLastQuestion ? (
            <Button onClick={saveAndNext}>
              Next
              <ChevronRight size={16} />
            </Button>
          ) : (
            <Button 
              onClick={submitAnswers}
              disabled={submitting}
              color="green"
              size="3"
            >
              {submitting ? (
                <Flex align="center" gap="2">
                  <Spinner />
                  <Text>{uploadProgress || 'Processing...'}</Text>
                </Flex>
              ) : (
                <>
                  <Send size={16} style={{ marginRight: '8px' }} />
                  Submit & Earn {formatSUI(survey.rewardPerResponse)} SUI
                </>
              )}
            </Button>
          )}
        </Flex>
      </Card>

      {/* Status Display */}
      {uploadingStep !== 'idle' && (
        <Card style={{ backgroundColor: 'var(--gray-2)' }}>
          <Flex align="center" gap="2">
            {uploadingStep === 'encrypting' && <Lock size={16} />}
            {uploadingStep === 'uploading' && <Upload size={16} />}
            {uploadingStep === 'submitting' && <Send size={16} />}
            <Text size="2">{uploadProgress}</Text>
          </Flex>
        </Card>
      )}
    </Flex>
  );
}