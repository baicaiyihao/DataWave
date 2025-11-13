// My Surveys Management Component with Subscription Services
// 改进版本：使用更可靠的获取问卷方式

import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Badge, Button, Tabs } from '@radix-ui/themes';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { ConfigService } from '../../services/config';
import { 
  FileText, 
  Users, 
  Coins, 
  Calendar, 
  Eye, 
  Settings,
  RefreshCw,
  Copy,
  ExternalLink,
  CheckCircle,
  DollarSign,
  Gift,
  TrendingUp,
  Clock
} from 'lucide-react';

interface SurveyData {
  id: string;
  capId?: string;
  title: string;
  description: string;
  category: string;
  rewardPerResponse: string;
  maxResponses: string;
  currentResponses: string;
  isActive: boolean;
  createdAt: string;
  creator: string;
  questions: any[];
  subscriptionServiceId?: string;
  hasSubscription?: boolean;
  subscriptionService?: {
    serviceId: string;
    price: number;
    duration: number;
    totalRevenue: number;
    subscriberCount: number;
  };
}

export function MySurveys() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const packageId = ConfigService.getPackageId();
  
  const [mySurveys, setMySurveys] = useState<SurveyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  
  const [stats, setStats] = useState({
    totalSurveys: 0,
    activeSurveys: 0,
    totalResponses: 0,
    totalRewardsDistributed: 0,
    totalRewardsRemaining: 0,
    surveysWithSubscription: 0,
    totalSubscriptionRevenue: 0,
    totalSubscribers: 0
  });

  // 获取单个问卷的详细信息
  const fetchSurveyDetails = async (surveyId: string): Promise<SurveyData | null> => {
    try {
      const surveyObj = await suiClient.getObject({
        id: surveyId,
        options: {
          showContent: true,
          showType: true,
        }
      });

      // 验证是 Survey 类型
      if (!surveyObj.data?.type?.includes('::survey_system::Survey')) {
        console.log(`Object ${surveyId} is not a Survey`);
        return null;
      }

      if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
        const fields = surveyObj.data.content.fields as any;
        
        // 解析问题
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
          createdAt: fields.created_at || '0',
          creator: fields.creator || '',
          questions: questions,
          subscriptionServiceId: fields.subscription_service_id
        };

        // 如果有订阅服务ID，获取详情
        if (surveyData.subscriptionServiceId) {
          try {
            const serviceObj = await suiClient.getObject({
              id: surveyData.subscriptionServiceId,
              options: { showContent: true }
            });

            if (serviceObj.data?.content && 'fields' in serviceObj.data.content) {
              const serviceFields = serviceObj.data.content.fields as any;
              
              // 获取订阅者数量
              const subscriptionEvents = await suiClient.queryEvents({
                query: {
                  MoveEventType: `${packageId}::survey_system::SubscriptionPurchased`,
                },
                limit: 100,
              });
              
              const subscriberCount = subscriptionEvents.data.filter((event: any) => 
                event.parsedJson?.survey_id === surveyId
              ).length;

              surveyData.hasSubscription = true;
              surveyData.subscriptionService = {
                serviceId: surveyData.subscriptionServiceId,
                price: parseInt(serviceFields.price || '0'),
                duration: parseInt(serviceFields.duration_ms || '0'),
                totalRevenue: parseInt(serviceFields.total_revenue || '0'),
                subscriberCount
              };
            }
          } catch (error) {
            console.error('Error loading subscription service:', error);
          }
        }

        return surveyData;
      }
    } catch (error) {
      console.error(`Error fetching survey ${surveyId}:`, error);
    }
    return null;
  };

  // 加载用户的所有问卷
  const loadMySurveys = async () => {
    if (!currentAccount?.address) return;
    
    setLoading(true);
    try {
      const allSurveys: SurveyData[] = [];
      const surveyIdSet = new Set<string>(); // 用于去重
      
      // 方法1: 从 Registry 获取用户创建的问卷
      const registryId = ConfigService.getSurveyRegistryId();
      try {
        const registry = await suiClient.getObject({
          id: registryId,
          options: {
            showContent: true,
          }
        });

        if (registry.data?.content && 'fields' in registry.data.content) {
          const fields = registry.data.content.fields;
          
          // 获取 surveys_by_creator table
          const surveysByCreatorTable = fields.surveys_by_creator?.fields?.id?.id;
          
          if (surveysByCreatorTable) {
            try {
              // 获取该用户的问卷列表
              const creatorField = await suiClient.getDynamicFieldObject({
                parentId: surveysByCreatorTable,
                name: {
                  type: 'address',
                  value: currentAccount.address,
                }
              });
              
              if (creatorField.data?.content && 'fields' in creatorField.data.content) {
                const surveyIds = creatorField.data.content.fields.value || [];
                console.log(`Found ${surveyIds.length} surveys for user from registry`);
                
                // 批量获取问卷详情
                for (const surveyId of surveyIds) {
                  if (!surveyIdSet.has(surveyId)) {
                    surveyIdSet.add(surveyId);
                    const surveyData = await fetchSurveyDetails(surveyId);
                    if (surveyData && surveyData.creator === currentAccount.address) {
                      allSurveys.push(surveyData);
                    }
                  }
                }
              }
            } catch (error) {
              console.log('No surveys found for user in registry');
            }
          }
          
          // 也可以遍历 all_surveys table 来查找（备用方案）
          const allSurveysTable = fields.all_surveys?.fields?.id?.id;
          if (allSurveysTable && allSurveys.length === 0) {
            let hasNextPage = true;
            let cursor = null;
            
            while (hasNextPage) {
              const dynamicFields = await suiClient.getDynamicFields({
                parentId: allSurveysTable,
                cursor,
                limit: 50,
              });
              
              for (const field of dynamicFields.data) {
                const surveyId = field.name.value as string;
                
                if (!surveyIdSet.has(surveyId)) {
                  // 获取基本信息先检查 creator
                  try {
                    const fieldObject = await suiClient.getDynamicFieldObject({
                      parentId: allSurveysTable,
                      name: field.name,
                    });
                    
                    if (fieldObject.data?.content && 'fields' in fieldObject.data.content) {
                      const basicInfo = fieldObject.data.content.fields.value?.fields;
                      if (basicInfo?.creator === currentAccount.address) {
                        surveyIdSet.add(surveyId);
                        const surveyData = await fetchSurveyDetails(surveyId);
                        if (surveyData) {
                          allSurveys.push(surveyData);
                        }
                      }
                    }
                  } catch (err) {
                    console.error(`Error checking survey ${surveyId}:`, err);
                  }
                }
              }
              
              hasNextPage = dynamicFields.hasNextPage;
              cursor = dynamicFields.nextCursor;
            }
          }
        }
      } catch (error) {
        console.error('Error fetching from registry:', error);
      }
      
      // 方法2: 查找用户拥有的 SurveyCap 对象并关联
      try {
        const capObjects = await suiClient.getOwnedObjects({
          owner: currentAccount.address,
          filter: {
            StructType: `${packageId}::survey_system::SurveyCap`,
          },
          options: { showContent: true, showType: true }
        });
        
        console.log('Found SurveyCaps:', capObjects.data.length);
        
        for (const cap of capObjects.data) {
          if (cap.data?.content && 'fields' in cap.data.content) {
            const capFields = cap.data.content.fields as any;
            const surveyId = capFields.survey_id;
            const capId = cap.data.objectId;
            
            // 查找对应的survey并更新capId
            const existingSurvey = allSurveys.find(s => s.id === surveyId);
            if (existingSurvey) {
              existingSurvey.capId = capId;
            } else if (!surveyIdSet.has(surveyId)) {
              // 如果还没有这个survey，尝试获取
              const surveyData = await fetchSurveyDetails(surveyId);
              if (surveyData && surveyData.creator === currentAccount.address) {
                surveyData.capId = capId;
                allSurveys.push(surveyData);
                surveyIdSet.add(surveyId);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching SurveyCaps:', error);
      }
      
      // 按创建时间排序
      allSurveys.sort((a, b) => {
        return parseInt(b.createdAt || '0') - parseInt(a.createdAt || '0');
      });
      
      setMySurveys(allSurveys);
      
      // 计算统计
      const activeSurveys = allSurveys.filter(s => s.isActive).length;
      const totalResponses = allSurveys.reduce((sum, s) => 
        sum + parseInt(s.currentResponses || '0'), 0
      );
      const totalRewardsDistributed = allSurveys.reduce((sum, s) => 
        sum + (parseInt(s.currentResponses || '0') * parseInt(s.rewardPerResponse || '0')), 0
      );
      const totalRewardsRemaining = allSurveys.reduce((sum, s) => {
        const remaining = parseInt(s.maxResponses || '0') - parseInt(s.currentResponses || '0');
        return sum + (remaining * parseInt(s.rewardPerResponse || '0'));
      }, 0);
      
      const surveysWithSubscription = allSurveys.filter(s => s.hasSubscription).length;
      const totalSubscriptionRevenue = allSurveys.reduce((sum, s) => 
        sum + (s.subscriptionService?.totalRevenue || 0), 0
      );
      const totalSubscribers = allSurveys.reduce((sum, s) => 
        sum + (s.subscriptionService?.subscriberCount || 0), 0
      );
      
      setStats({
        totalSurveys: allSurveys.length,
        activeSurveys,
        totalResponses,
        totalRewardsDistributed,
        totalRewardsRemaining,
        surveysWithSubscription,
        totalSubscriptionRevenue,
        totalSubscribers
      });
      
    } catch (error) {
      console.error('Error loading surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentAccount?.address) {
      loadMySurveys();
    }
  }, [currentAccount?.address]);

  const formatSUI = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseInt(amount) : amount;
    return (value / 1000000000).toFixed(4);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatDuration = (ms: number) => {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) return `${hours} hours`;
    return `${Math.floor(hours / 24)} days`;
  };

  const getCompletionRate = (current: string, max: string) => {
    const curr = parseInt(current);
    const maximum = parseInt(max);
    if (maximum === 0) return 0;
    return (curr / maximum) * 100;
  };

  const shareSubscriptionLink = (serviceId: string) => {
    const link = `${window.location.origin}/subscription/${serviceId}`;
    navigator.clipboard.writeText(link);
    alert(`Subscription link copied:\n${link}`);
  };

  const handleManageSurvey = (surveyId: string) => {
    const event = new CustomEvent('manageSurvey', { 
      detail: { surveyId } 
    });
    window.dispatchEvent(event);
  };

  const filteredSurveys = mySurveys.filter(survey => {
    if (activeTab === 'active') return survey.isActive;
    if (activeTab === 'completed') return !survey.isActive;
    if (activeTab === 'subscription') return survey.hasSubscription;
    return true;
  });

  if (!currentAccount) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="3" py="5">
          <Text size="4" weight="bold">Connect Wallet</Text>
          <Text size="2" color="gray">Please connect your wallet to view your surveys</Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Flex direction="column" gap="3">
      {/* Header with Stats */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <Text size="5" weight="bold">My Surveys & Subscriptions</Text>
            <Button onClick={loadMySurveys} variant="soft" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </Flex>
          
          <Flex gap="3" wrap="wrap">
            <Card style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--blue-2)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Total Surveys</Text>
                <Text size="4" weight="bold">{stats.totalSurveys}</Text>
              </Flex>
            </Card>
            
            <Card style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--green-2)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Active</Text>
                <Text size="4" weight="bold" color="green">{stats.activeSurveys}</Text>
              </Flex>
            </Card>
            
            <Card style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--purple-2)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">With Subscription</Text>
                <Text size="4" weight="bold">{stats.surveysWithSubscription}</Text>
              </Flex>
            </Card>
            
            <Card style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--cyan-2)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Subscription Revenue</Text>
                <Text size="3" weight="bold">{formatSUI(stats.totalSubscriptionRevenue)} SUI</Text>
              </Flex>
            </Card>
          </Flex>
        </Flex>
      </Card>

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="all">All ({mySurveys.length})</Tabs.Trigger>
          <Tabs.Trigger value="active">Active ({mySurveys.filter(s => s.isActive).length})</Tabs.Trigger>
          <Tabs.Trigger value="completed">Completed ({mySurveys.filter(s => !s.isActive).length})</Tabs.Trigger>
          <Tabs.Trigger value="subscription">
            With Subscription ({mySurveys.filter(s => s.hasSubscription).length})
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {/* Surveys List */}
      {loading ? (
        <Card>
          <Text align="center">Loading your surveys...</Text>
        </Card>
      ) : filteredSurveys.length === 0 ? (
        <Card>
          <Flex direction="column" align="center" gap="3" py="5">
            <Text size="3" color="gray">
              {activeTab === 'active' ? 'No active surveys' : 
               activeTab === 'completed' ? 'No completed surveys' : 
               activeTab === 'subscription' ? 'No surveys with subscription' :
               'No surveys created yet'}
            </Text>
          </Flex>
        </Card>
      ) : (
        <Flex direction="column" gap="3">
          {filteredSurveys.map(survey => (
            <Card key={survey.id}>
              <Flex direction="column" gap="3">
                <Flex justify="between" align="start">
                  <Flex direction="column" gap="1">
                    <Flex align="center" gap="2">
                      <Text size="4" weight="bold">{survey.title}</Text>
                      <Badge color={survey.isActive ? 'green' : 'gray'}>
                        {survey.isActive ? 'Active' : 'Closed'}
                      </Badge>
                      <Badge variant="soft">{survey.category}</Badge>
                      {survey.hasSubscription && (
                        <Badge color="purple">
                          <DollarSign size={12} />
                          Subscription
                        </Badge>
                      )}
                      {!survey.capId && (
                        <Badge color="orange" variant="soft">
                          No Cap
                        </Badge>
                      )}
                    </Flex>
                    <Text size="2" color="gray">{survey.description}</Text>
                  </Flex>
                  
                  <Flex gap="2">
                    <Button 
                      size="2" 
                      variant="soft"
                      onClick={() => {
                        const event = new CustomEvent('viewSurveyDetails', { 
                          detail: { surveyId: survey.id } 
                        });
                        window.dispatchEvent(event);
                      }}
                    >
                      <Eye size={16} />
                      View
                    </Button>
                    <Button 
                      size="2" 
                      variant="soft"
                      color="blue"
                      onClick={() => handleManageSurvey(survey.id)}
                    >
                      <Settings size={16} />
                      Manage
                    </Button>
                    {survey.hasSubscription && survey.subscriptionService && (
                      <Button 
                        size="2" 
                        variant="soft"
                        color="cyan"
                        onClick={() => shareSubscriptionLink(survey.subscriptionService!.serviceId)}
                      >
                        <ExternalLink size={16} />
                        Share Link
                      </Button>
                    )}
                  </Flex>
                </Flex>

                <Flex gap="4" wrap="wrap">
                  <Flex align="center" gap="1">
                    <Calendar size={14} />
                    <Text size="2" color="gray">Created: {formatDate(survey.createdAt)}</Text>
                  </Flex>
                  <Flex align="center" gap="1">
                    <FileText size={14} />
                    <Text size="2">{survey.questions.length} Questions</Text>
                  </Flex>
                  <Flex align="center" gap="1">
                    <Coins size={14} />
                    <Text size="2">{formatSUI(survey.rewardPerResponse)} SUI/response</Text>
                  </Flex>
                  <Flex align="center" gap="1">
                    <Users size={14} />
                    <Text size="2">{survey.currentResponses}/{survey.maxResponses} Responses</Text>
                  </Flex>
                </Flex>

                {/* Subscription Service Info */}
                {survey.hasSubscription && survey.subscriptionService && (
                  <Card style={{ backgroundColor: 'var(--purple-1)' }}>
                    <Flex direction="column" gap="2">
                      <Flex align="center" gap="2">
                        <Gift size={16} />
                        <Text size="2" weight="bold">Subscription Service Active</Text>
                      </Flex>
                      <Flex justify="between" wrap="wrap" gap="3">
                        <Flex direction="column" gap="1">
                          <Text size="1" color="gray">Price</Text>
                          <Flex align="center" gap="1">
                            <DollarSign size={12} />
                            <Text size="2" weight="bold">
                              {formatSUI(survey.subscriptionService.price)} SUI
                            </Text>
                          </Flex>
                        </Flex>
                        <Flex direction="column" gap="1">
                          <Text size="1" color="gray">Duration</Text>
                          <Flex align="center" gap="1">
                            <Clock size={12} />
                            <Text size="2" weight="bold">
                              {formatDuration(survey.subscriptionService.duration)}
                            </Text>
                          </Flex>
                        </Flex>
                        <Flex direction="column" gap="1">
                          <Text size="1" color="gray">Total Revenue</Text>
                          <Flex align="center" gap="1">
                            <TrendingUp size={12} />
                            <Text size="2" weight="bold" color="green">
                              {formatSUI(survey.subscriptionService.totalRevenue)} SUI
                            </Text>
                          </Flex>
                        </Flex>
                        <Flex direction="column" gap="1">
                          <Text size="1" color="gray">Subscribers</Text>
                          <Flex align="center" gap="1">
                            <Users size={12} />
                            <Text size="2" weight="bold">
                              {survey.subscriptionService.subscriberCount}
                            </Text>
                          </Flex>
                        </Flex>
                      </Flex>
                    </Flex>
                  </Card>
                )}

                {/* Progress Bar */}
                <div>
                  <Flex justify="between" mb="1">
                    <Text size="1" color="gray">Completion Progress</Text>
                    <Text size="1" weight="bold">
                      {getCompletionRate(survey.currentResponses, survey.maxResponses).toFixed(1)}%
                    </Text>
                  </Flex>
                  <div style={{ 
                    width: '100%', 
                    height: '6px', 
                    backgroundColor: 'var(--gray-4)', 
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      width: `${getCompletionRate(survey.currentResponses, survey.maxResponses)}%`, 
                      height: '100%', 
                      backgroundColor: survey.isActive ? 'var(--blue-9)' : 'var(--green-9)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
    </Flex>
  );
}