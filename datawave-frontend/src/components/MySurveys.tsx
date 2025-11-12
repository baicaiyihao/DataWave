// My Surveys Management Component
// 查看和管理自己创建的问卷

import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Badge, Button, Tabs, AlertDialog } from '@radix-ui/themes';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { ConfigService } from '../services/config';
import { 
  FileText, 
  Users, 
  Coins, 
  Calendar, 
  Eye, 
  Settings,
  Trash2,
  RefreshCw,
  Copy,
  ExternalLink,
  CheckCircle,
  XCircle,
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
  digest?: string;
}

export function MySurveys() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  
  const [mySurveys, setMySurveys] = useState<SurveyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyData | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // 统计数据
  const [stats, setStats] = useState({
    totalSurveys: 0,
    activeSurveys: 0,
    totalResponses: 0,
    totalRewardsDistributed: 0,
    totalRewardsRemaining: 0
  });

  // 从链上获取问卷数据
  const fetchSurveyFromChain = async (surveyId: string): Promise<SurveyData | null> => {
    try {
      const surveyObj = await suiClient.getObject({
        id: surveyId,
        options: {
          showContent: true,
        }
      });

      if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
        const fields = surveyObj.data.content.fields;
        
        // 解析问题
        const questions = fields.questions?.map((q: any) => ({
          question_text: q.fields?.question_text || q.question_text || '',
          question_type: parseInt(q.fields?.question_type || q.question_type || '0'),
          options: q.fields?.options || q.options || []
        })) || [];

        return {
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
          questions: questions
        };
      }
    } catch (error) {
      console.error(`Error fetching survey ${surveyId}:`, error);
    }
    return null;
  };

  // 加载我的问卷
  const loadMySurveys = async () => {
    if (!currentAccount?.address) return;
    
    setLoading(true);
    try {
      const allSurveys: SurveyData[] = [];
      
      // 方法1：从 localStorage 获取
      const surveyIndex = JSON.parse(localStorage.getItem('survey_index') || '[]');
      console.log('Survey index from localStorage:', surveyIndex);
      
      for (const surveyId of surveyIndex) {
        // 先尝试从 localStorage 获取
        const localData = localStorage.getItem(`survey_${surveyId}`);
        if (localData) {
          const surveyData = JSON.parse(localData);
          // 只显示当前用户创建的
          if (surveyData.creator === currentAccount.address) {
            // 从链上获取最新数据
            const chainData = await fetchSurveyFromChain(surveyId);
            if (chainData) {
              allSurveys.push({
                ...surveyData,
                ...chainData,
                capId: surveyData.capId // 保留 cap ID
              });
            } else {
              allSurveys.push(surveyData);
            }
          }
        }
      }
      
      // 方法2：从 Registry 查询
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
          const surveysByCreatorTable = fields.surveys_by_creator?.fields?.id?.id;
          
          if (surveysByCreatorTable) {
            // 查询创建者的问卷
            const creatorField = await suiClient.getDynamicFieldObject({
              parentId: surveysByCreatorTable,
              name: {
                type: 'address',
                value: currentAccount.address,
              }
            });
            
            if (creatorField.data?.content && 'fields' in creatorField.data.content) {
              const surveyIds = creatorField.data.content.fields.value || [];
              console.log('Survey IDs from registry:', surveyIds);
              
              for (const surveyId of surveyIds) {
                // 避免重复
                if (!allSurveys.find(s => s.id === surveyId)) {
                  const chainData = await fetchSurveyFromChain(surveyId);
                  if (chainData) {
                    allSurveys.push(chainData);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching from registry:', error);
      }
      
      // 按创建时间排序
      allSurveys.sort((a, b) => {
        return parseInt(b.createdAt || '0') - parseInt(a.createdAt || '0');
      });
      
      setMySurveys(allSurveys);
      
      // 计算统计数据
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
      
      setStats({
        totalSurveys: allSurveys.length,
        activeSurveys,
        totalResponses,
        totalRewardsDistributed,
        totalRewardsRemaining
      });
      
    } catch (error) {
      console.error('Error loading surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (currentAccount?.address) {
      loadMySurveys();
    }
  }, [currentAccount?.address]);

  // 复制 ID
  const copyToClipboard = (text: string, surveyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(surveyId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 格式化函数
  const formatSUI = (amount: string) => {
    return (parseInt(amount) / 1000000000).toFixed(3);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getCompletionRate = (current: string, max: string) => {
    const curr = parseInt(current);
    const maximum = parseInt(max);
    if (maximum === 0) return 0;
    return (curr / maximum) * 100;
  };

  // 筛选问卷
  const filteredSurveys = mySurveys.filter(survey => {
    if (activeTab === 'active') return survey.isActive;
    if (activeTab === 'completed') return !survey.isActive;
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
            <Text size="5" weight="bold">My Surveys</Text>
            <Button onClick={loadMySurveys} variant="soft" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </Flex>
          
          {/* Statistics Cards */}
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
            
            <Card style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--orange-2)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Total Responses</Text>
                <Text size="4" weight="bold">{stats.totalResponses}</Text>
              </Flex>
            </Card>
            
            <Card style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--purple-2)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Rewards Distributed</Text>
                <Text size="3" weight="bold">{formatSUI(stats.totalRewardsDistributed.toString())} SUI</Text>
              </Flex>
            </Card>
            
            <Card style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--gray-2)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Rewards Remaining</Text>
                <Text size="3" weight="bold">{formatSUI(stats.totalRewardsRemaining.toString())} SUI</Text>
              </Flex>
            </Card>
          </Flex>
        </Flex>
      </Card>

      {/* Tabs for filtering */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="all">
            All ({mySurveys.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="active">
            Active ({mySurveys.filter(s => s.isActive).length})
          </Tabs.Trigger>
          <Tabs.Trigger value="completed">
            Completed ({mySurveys.filter(s => !s.isActive).length})
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
               'No surveys created yet'}
            </Text>
            <Button onClick={() => {
              // 切换到创建标签
              const createTab = document.querySelector('[value="create"]') as HTMLElement;
              if (createTab) createTab.click();
            }}>
              Create Your First Survey
            </Button>
          </Flex>
        </Card>
      ) : (
        <Flex direction="column" gap="3">
          {filteredSurveys.map(survey => (
            <Card key={survey.id}>
              <Flex direction="column" gap="3">
                {/* Survey Header */}
                <Flex justify="between" align="start">
                  <Flex direction="column" gap="1">
                    <Flex align="center" gap="2">
                      <Text size="4" weight="bold">{survey.title}</Text>
                      <Badge color={survey.isActive ? 'green' : 'gray'}>
                        {survey.isActive ? 'Active' : 'Closed'}
                      </Badge>
                      <Badge variant="soft">{survey.category}</Badge>
                    </Flex>
                    <Text size="2" color="gray">{survey.description}</Text>
                  </Flex>
                  
                  <Flex gap="2">
                    <Button 
                      size="2" 
                      variant="soft"
                      onClick={() => {
                        // 触发查看详情
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
                      onClick={() => {
                        // 触发管理 allowlist
                        const event = new CustomEvent('manageSurveyAllowlist', { 
                          detail: { surveyId: survey.id } 
                        });
                        window.dispatchEvent(event);
                      }}
                    >
                      <Settings size={16} />
                      Manage
                    </Button>
                    <Button
                      size="2"
                      variant="soft"
                      onClick={() => window.open(`https://suiscan.xyz/testnet/object/${survey.id}`, '_blank')}
                    >
                      <ExternalLink size={16} />
                    </Button>
                  </Flex>
                </Flex>

                {/* Survey Info */}
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

                {/* Survey IDs */}
                <Card style={{ backgroundColor: 'var(--gray-2)' }}>
                  <Flex direction="column" gap="2">
                    <Flex justify="between" align="center">
                      <Text size="1" color="gray">Survey ID:</Text>
                      <Flex align="center" gap="2">
                        <Text size="1" style={{ fontFamily: 'monospace' }}>
                          {survey.id.slice(0, 16)}...
                        </Text>
                        <Button
                          size="1"
                          variant="ghost"
                          onClick={() => copyToClipboard(survey.id, survey.id)}
                        >
                          {copiedId === survey.id ? <CheckCircle size={14} /> : <Copy size={14} />}
                        </Button>
                      </Flex>
                    </Flex>
                    
                    {survey.capId && (
                      <Flex justify="between" align="center">
                        <Text size="1" color="gray">Cap ID:</Text>
                        <Flex align="center" gap="2">
                          <Text size="1" style={{ fontFamily: 'monospace' }}>
                            {survey.capId.slice(0, 16)}...
                          </Text>
                          <Button
                            size="1"
                            variant="ghost"
                            onClick={() => copyToClipboard(survey.capId!, survey.capId!)}
                          >
                            {copiedId === survey.capId ? <CheckCircle size={14} /> : <Copy size={14} />}
                          </Button>
                        </Flex>
                      </Flex>
                    )}
                  </Flex>
                </Card>

                {/* Financial Summary */}
                <Card style={{ backgroundColor: 'var(--blue-1)' }}>
                  <Flex justify="between" wrap="wrap" gap="3">
                    <Flex direction="column" gap="1">
                      <Text size="1" color="gray">Total Pool</Text>
                      <Text size="2" weight="bold">
                        {formatSUI((parseInt(survey.rewardPerResponse) * parseInt(survey.maxResponses)).toString())} SUI
                      </Text>
                    </Flex>
                    <Flex direction="column" gap="1">
                      <Text size="1" color="gray">Distributed</Text>
                      <Text size="2" weight="bold" color="green">
                        {formatSUI((parseInt(survey.rewardPerResponse) * parseInt(survey.currentResponses)).toString())} SUI
                      </Text>
                    </Flex>
                    <Flex direction="column" gap="1">
                      <Text size="1" color="gray">Remaining</Text>
                      <Text size="2" weight="bold" color="blue">
                        {formatSUI((parseInt(survey.rewardPerResponse) * 
                          (parseInt(survey.maxResponses) - parseInt(survey.currentResponses))).toString())} SUI
                      </Text>
                    </Flex>
                  </Flex>
                </Card>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
    </Flex>
  );
}