// View Survey Details Component - Router Version
// 查看问卷详情页面

import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Badge, Button } from '@radix-ui/themes';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useParams, useNavigate } from 'react-router-dom';
import { ConfigService } from '../services/config';
import { ChevronLeft, Coins, Users, Calendar, ClipboardList, CheckCircle } from 'lucide-react';

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
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  
  const [surveyDetails, setSurveyDetails] = useState<SurveyFullDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);

  // Navigation functions
  const goBack = () => {
    navigate('/marketplace');
  };

  const startAnsweringSurvey = () => {
    navigate(`/answer/${surveyId}`);
  };

  // 获取问卷详情
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
      // 直接获取对象并解析
      const surveyObject = await suiClient.getObject({
        id,
        options: {
          showContent: true,
          showType: true,
        }
      });

      console.log('Survey object:', surveyObject);

      if (surveyObject.data?.content && 'fields' in surveyObject.data.content) {
        const fields = surveyObject.data.content.fields;
        
        // 解析问题数组
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
          category: fields.category || '',
          rewardPerResponse: fields.reward_per_response || '0',
          maxResponses: fields.max_responses || '0',
          currentResponses: fields.current_responses || '0',
          isActive: fields.is_active || false,
          createdAt: fields.created_at || '0',
          questions: questions,
          creator: fields.creator || ''
        };

        setSurveyDetails(details);
        console.log('Parsed survey details:', details);

        // 检查用户是否已回答
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

  // 检查用户是否已回答
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

  // 当 surveyId 改变时自动加载详情
  useEffect(() => {
    if (surveyId) {
      fetchSurveyDetails(surveyId);
    }
  }, [surveyId, currentAccount?.address]);

  // 格式化函数
  const getQuestionTypeLabel = (type: number) => {
    switch (type) {
      case 0: return 'Single Choice';
      case 1: return 'Multiple Choice';
      case 2: return 'Text Answer';
      default: return 'Unknown';
    }
  };

  const getQuestionTypeColor = (type: number): "blue" | "green" | "purple" | "gray" => {
    switch (type) {
      case 0: return 'blue';
      case 1: return 'green';
      case 2: return 'purple';
      default: return 'gray';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatSUI = (amount: string) => {
    return (parseInt(amount) / 1000000000).toFixed(3);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const completionRate = surveyDetails 
    ? (parseInt(surveyDetails.currentResponses) / parseInt(surveyDetails.maxResponses)) * 100 
    : 0;

  if (!surveyId) {
    return (
      <Card>
        <Flex direction="column" gap="3" align="center" py="5">
          <Text size="3">No survey ID provided</Text>
          <Button onClick={goBack} variant="soft">
            <ChevronLeft size={16} /> Back to Marketplace
          </Button>
        </Flex>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <Flex justify="center" align="center" py="5">
          <Text size="3">Loading survey details...</Text>
        </Flex>
      </Card>
    );
  }

  if (error && !surveyDetails) {
    return (
      <Card>
        <Flex direction="column" gap="3" align="center" py="5">
          <Text size="3" color="red">Error: {error}</Text>
          <Button onClick={goBack} variant="soft">
            <ChevronLeft size={16} /> Back to Marketplace
          </Button>
        </Flex>
      </Card>
    );
  }

  if (!surveyDetails) {
    return (
      <Card>
        <Flex direction="column" gap="3" align="center" py="5">
          <Text size="3">No survey details available</Text>
          <Button onClick={goBack} variant="soft">
            <ChevronLeft size={16} /> Back to Marketplace
          </Button>
        </Flex>
      </Card>
    );
  }

  return (
    <Flex direction="column" gap="3">
      {/* Navigation */}
      <Card>
        <Flex justify="between" align="center">
          <Button onClick={goBack} variant="ghost">
            <ChevronLeft size={16} /> Back to Marketplace
          </Button>
          <Text size="2" color="gray">
            Survey ID: {formatAddress(surveyId)}
          </Text>
        </Flex>
      </Card>

      {/* Header */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="start">
            <div style={{ flex: 1 }}>
              <Text size="6" weight="bold">{surveyDetails.title}</Text>
              <Text size="3" color="gray" style={{ marginTop: '8px' }}>
                {surveyDetails.description}
              </Text>
            </div>
            <Badge size="2" color={surveyDetails.isActive ? 'green' : 'gray'}>
              {surveyDetails.isActive ? 'Active' : 'Closed'}
            </Badge>
          </Flex>

          <Flex gap="3" wrap="wrap">
            <Badge variant="soft" size="2">{surveyDetails.category}</Badge>
            <Badge variant="soft" size="2" color="blue">
              <Coins size={14} style={{ marginRight: '4px' }} />
              {formatSUI(surveyDetails.rewardPerResponse)} SUI
            </Badge>
            <Badge variant="soft" size="2" color="orange">
              <Users size={14} style={{ marginRight: '4px' }} />
              {surveyDetails.currentResponses}/{surveyDetails.maxResponses} Responses
            </Badge>
            <Badge variant="soft" size="2" color="purple">
              <ClipboardList size={14} style={{ marginRight: '4px' }} />
              {surveyDetails.questions.length} Questions
            </Badge>
          </Flex>

          <Flex direction="column" gap="2">
            <Text size="2" color="gray">
              <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Created: {formatTimestamp(surveyDetails.createdAt)}
            </Text>
            {surveyDetails.creator && (
              <Text size="2" color="gray">
                Creator: {formatAddress(surveyDetails.creator)}
              </Text>
            )}
          </Flex>

          {hasAnswered && (
            <Badge size="2" color="green">
              <CheckCircle size={14} style={{ marginRight: '4px' }} />
              You have already answered this survey
            </Badge>
          )}
        </Flex>
      </Card>

      {/* Progress and Statistics */}
      <Card>
        <Flex direction="column" gap="3">
          <Text size="4" weight="bold">Progress & Statistics</Text>
          
          {/* Progress Bar */}
          <div>
            <Flex justify="between" mb="2">
              <Text size="2" color="gray">Completion Progress</Text>
              <Text size="2" weight="bold">{completionRate.toFixed(1)}%</Text>
            </Flex>
            <div style={{ 
              width: '100%', 
              height: '8px', 
              backgroundColor: 'var(--gray-4)', 
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${completionRate}%`, 
                height: '100%', 
                backgroundColor: completionRate === 100 ? 'var(--green-9)' : 'var(--blue-9)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
          
          <Flex direction="column" gap="2">
            <Flex justify="between">
              <Text size="2" color="gray">Total Reward Pool:</Text>
              <Text size="2" weight="bold">
                {formatSUI((parseInt(surveyDetails.rewardPerResponse) * parseInt(surveyDetails.maxResponses)).toString())} SUI
              </Text>
            </Flex>
            
            <Flex justify="between">
              <Text size="2" color="gray">Distributed Rewards:</Text>
              <Text size="2" weight="bold" color="green">
                {formatSUI((parseInt(surveyDetails.rewardPerResponse) * parseInt(surveyDetails.currentResponses)).toString())} SUI
              </Text>
            </Flex>
            
            <Flex justify="between">
              <Text size="2" color="gray">Remaining Rewards:</Text>
              <Text size="2" weight="bold" color="blue">
                {formatSUI((parseInt(surveyDetails.rewardPerResponse) * 
                  (parseInt(surveyDetails.maxResponses) - parseInt(surveyDetails.currentResponses))).toString())} SUI
              </Text>
            </Flex>
          </Flex>
        </Flex>
      </Card>

      {/* Questions */}
      <Card>
        <Flex direction="column" gap="3">
          <Text size="4" weight="bold">Survey Questions ({surveyDetails.questions.length})</Text>
          
          {surveyDetails.questions.map((question, index) => (
            <Card key={index} style={{ backgroundColor: 'var(--gray-2)' }}>
              <Flex direction="column" gap="2">
                <Flex justify="between" align="start">
                  <Text size="3" weight="bold">
                    Question {index + 1}
                  </Text>
                  <Badge color={getQuestionTypeColor(question.question_type)}>
                    {getQuestionTypeLabel(question.question_type)}
                  </Badge>
                </Flex>
                
                <Text size="3">{question.question_text}</Text>
                
                {/* Options for choice questions */}
                {question.question_type !== 2 && question.options.length > 0 && (
                  <Flex direction="column" gap="1" style={{ marginTop: '8px', marginLeft: '16px' }}>
                    {question.options.map((option, optIndex) => (
                      <Flex key={optIndex} gap="2" align="center">
                        <Text size="2" color="gray">
                          {question.question_type === 0 ? '○' : '□'}
                        </Text>
                        <Text size="2">{option}</Text>
                      </Flex>
                    ))}
                  </Flex>
                )}
                
                {/* Text answer indicator */}
                {question.question_type === 2 && (
                  <Card style={{ marginTop: '8px', backgroundColor: 'var(--gray-3)' }}>
                    <Text size="2" color="gray" style={{ fontStyle: 'italic' }}>
                      📝 Text answer required
                    </Text>
                  </Card>
                )}
              </Flex>
            </Card>
          ))}
        </Flex>
      </Card>

      {/* Action Button */}
      <Card>
        <Flex direction="column" gap="2">
          {surveyDetails.isActive && 
           parseInt(surveyDetails.currentResponses) < parseInt(surveyDetails.maxResponses) && 
           !hasAnswered && 
           currentAccount ? (
            <Button 
              size="3" 
              style={{ width: '100%' }}
              onClick={startAnsweringSurvey}
            >
              Answer Survey & Earn {formatSUI(surveyDetails.rewardPerResponse)} SUI →
            </Button>
          ) : hasAnswered ? (
            <Button size="3" disabled style={{ width: '100%' }}>
              <CheckCircle size={16} style={{ marginRight: '8px' }} />
              Already Answered
            </Button>
          ) : !currentAccount ? (
            <Button size="3" disabled style={{ width: '100%' }}>
              Connect Wallet to Answer
            </Button>
          ) : !surveyDetails.isActive ? (
            <Button size="3" disabled style={{ width: '100%' }}>
              Survey Closed
            </Button>
          ) : (
            <Button size="3" disabled style={{ width: '100%' }}>
              Survey Full
            </Button>
          )}
        </Flex>
      </Card>
    </Flex>
  );
}

export default ViewSurveyDetails;