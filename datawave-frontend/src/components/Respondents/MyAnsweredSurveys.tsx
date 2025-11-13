// My Answered Surveys Page
// 查看我回答过的问卷

import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Badge, Button, Grid, Tabs, Dialog } from '@radix-ui/themes';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { ConfigService } from '../../services/config';
import { 
  CheckCircle,
  Clock,
  Award,
  FileText,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Eye,
  Coins,
  Hash
} from 'lucide-react';

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
  const packageId = ConfigService.getPackageId();
  
  const [answeredSurveys, setAnsweredSurveys] = useState<AnsweredSurvey[]>([]);
  const [filteredSurveys, setFilteredSurveys] = useState<AnsweredSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'with-consent' | 'without-consent'>('all');
  
  // Detail dialog
  const [selectedSurvey, setSelectedSurvey] = useState<AnsweredSurvey | null>(null);
  const [answerDetails, setAnswerDetails] = useState<AnswerDetail[]>([]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  
  // 筛选和分页
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>(['all']);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);
  
  // 统计
  const [stats, setStats] = useState({
    totalAnswered: 0,
    totalRewardsEarned: 0,
    consentGivenCount: 0,
    uniqueCreators: 0,
  });

  // 加载用户回答过的问卷
  const loadAnsweredSurveys = async () => {
    if (!currentAccount?.address) return;
    
    setLoading(true);
    try {
      const answered: AnsweredSurvey[] = [];
      const processedSurveys = new Set<string>();
      
      // 查询 SurveyAnswered 事件
      const answeredEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${packageId}::survey_system::SurveyAnswered`,
        },
        limit: 100,
        order: 'descending',
      });
      
      console.log(`Found ${answeredEvents.data.length} answer events`);
      
      // 筛选当前用户的回答
      const userAnswers = answeredEvents.data.filter((event: any) => 
        event.parsedJson?.respondent === currentAccount.address
      );
      
      console.log(`Found ${userAnswers.length} user answers`);
      
      // 处理每个回答事件
      for (const event of userAnswers) {
        const eventData = event.parsedJson;
        if (!eventData) continue;
        
        const surveyId = eventData.survey_id;
        
        // 避免重复
        if (processedSurveys.has(surveyId)) continue;
        processedSurveys.add(surveyId);
        
        try {
          // 获取问卷详情
          const surveyObj = await suiClient.getObject({
            id: surveyId,
            options: { showContent: true }
          });
          
          if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
            const surveyFields = surveyObj.data.content.fields as any;
            
            // 查找用户的具体答案（如果需要）
            let consentGiven = false;
            let answeredAt = event.timestampMs ? parseInt(event.timestampMs) : Date.now();
            
            // 检查加密答案表中是否有用户的答案
            if (surveyFields.encrypted_answer_blobs?.fields?.id?.id) {
              try {
                const answersTable = await suiClient.getDynamicFields({
                  parentId: surveyFields.encrypted_answer_blobs.fields.id.id,
                  limit: 100,
                });
                
                // 查找用户的答案
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
      
      // 也可以从 Registry 中查找用户作为 respondent 的记录
      // （这部分可以根据合约具体实现来补充）
      
      // 按回答时间排序（最近的在前）
      answered.sort((a, b) => b.answeredAt - a.answeredAt);
      
      setAnsweredSurveys(answered);
      setFilteredSurveys(answered);
      
      // 提取类别
      const uniqueCategories = Array.from(new Set(answered.map(s => s.category)));
      setCategories(['all', ...uniqueCategories]);
      
      // 计算统计
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
    }
  };

  // 查看答案详情（如果有本地存储）
  const viewAnswerDetails = async (survey: AnsweredSurvey) => {
    setSelectedSurvey(survey);
    
    // 尝试从本地存储获取答案（如果之前保存过）
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

  // 应用筛选
  useEffect(() => {
    let filtered = [...answeredSurveys];
    
    // Tab 筛选
    if (activeTab === 'with-consent') {
      filtered = filtered.filter(s => s.consentGiven);
    } else if (activeTab === 'without-consent') {
      filtered = filtered.filter(s => !s.consentGiven);
    }
    
    // 类别筛选
    if (filterCategory !== 'all') {
      filtered = filtered.filter(s => s.category === filterCategory);
    }
    
    // 搜索筛选
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

  // 初始加载
  useEffect(() => {
    if (currentAccount?.address) {
      loadAnsweredSurveys();
    }
  }, [currentAccount?.address]);

  // 分页计算
  const totalPages = Math.ceil(filteredSurveys.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSurveys = filteredSurveys.slice(startIndex, endIndex);

  // 格式化函数
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSUI = (amount: string) => {
    return (parseInt(amount) / 1000000000).toFixed(4);
  };

  // 查看原始问卷
  const viewOriginalSurvey = (surveyId: string) => {
    const event = new CustomEvent('viewSurveyDetails', { 
      detail: { surveyId } 
    });
    window.dispatchEvent(event);
  };

  if (!currentAccount) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="3" py="5">
          <Text size="4" weight="bold">Connect Wallet</Text>
          <Text size="2" color="gray">Please connect your wallet to view your answered surveys</Text>
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
            <div>
              <Text size="5" weight="bold">My Answered Surveys</Text>
              <Text size="2" color="gray">Track your survey participation history</Text>
            </div>
            <Button onClick={loadAnsweredSurveys} variant="soft" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </Flex>
          
          {/* Stats Cards */}
          <Grid columns="4" gap="3">
            <Card style={{ backgroundColor: 'var(--blue-2)' }}>
              <Flex direction="column" gap="1">
                <Flex align="center" gap="1">
                  <FileText size={14} />
                  <Text size="1" color="gray">Total Answered</Text>
                </Flex>
                <Text size="4" weight="bold">{stats.totalAnswered}</Text>
              </Flex>
            </Card>
            
            <Card style={{ backgroundColor: 'var(--green-2)' }}>
              <Flex direction="column" gap="1">
                <Flex align="center" gap="1">
                  <Coins size={14} />
                  <Text size="1" color="gray">Rewards Earned</Text>
                </Flex>
                <Text size="3" weight="bold">{formatSUI(stats.totalRewardsEarned.toString())} SUI</Text>
              </Flex>
            </Card>
            
            <Card style={{ backgroundColor: 'var(--purple-2)' }}>
              <Flex direction="column" gap="1">
                <Flex align="center" gap="1">
                  <CheckCircle size={14} />
                  <Text size="1" color="gray">Consent Given</Text>
                </Flex>
                <Text size="4" weight="bold">{stats.consentGivenCount}</Text>
              </Flex>
            </Card>
            
            <Card style={{ backgroundColor: 'var(--orange-2)' }}>
              <Flex direction="column" gap="1">
                <Flex align="center" gap="1">
                  <Award size={14} />
                  <Text size="1" color="gray">Unique Creators</Text>
                </Flex>
                <Text size="4" weight="bold">{stats.uniqueCreators}</Text>
              </Flex>
            </Card>
          </Grid>
        </Flex>
      </Card>

      {/* Tabs and Filters */}
      <Card>
        <Flex direction="column" gap="3">
          <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <Tabs.List>
              <Tabs.Trigger value="all">All ({answeredSurveys.length})</Tabs.Trigger>
              <Tabs.Trigger value="with-consent">
                With Consent ({answeredSurveys.filter(s => s.consentGiven).length})
              </Tabs.Trigger>
              <Tabs.Trigger value="without-consent">
                Without Consent ({answeredSurveys.filter(s => !s.consentGiven).length})
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
          
          <Flex gap="3" align="center">
            <Filter size={16} />
            <input
              type="text"
              placeholder="Search surveys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--gray-6)',
                flex: 1,
                maxWidth: '300px'
              }}
            />
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--gray-6)'
              }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
            
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--gray-6)'
              }}
            >
              <option value="9">9 per page</option>
              <option value="18">18 per page</option>
              <option value="36">36 per page</option>
            </select>
          </Flex>
        </Flex>
      </Card>

      {/* Surveys Grid */}
      {loading ? (
        <Card>
          <Text align="center" size="3">Loading your answered surveys...</Text>
        </Card>
      ) : currentSurveys.length === 0 ? (
        <Card>
          <Flex direction="column" align="center" gap="3" py="5">
            <FileText size={48} color="gray" />
            <Text size="3" weight="bold">
              {filteredSurveys.length === 0 
                ? (answeredSurveys.length === 0 
                  ? "No Surveys Answered Yet"
                  : "No surveys match your filters")
                : "No surveys on this page"}
            </Text>
            <Text size="2" color="gray">
              {answeredSurveys.length === 0 && "Start answering surveys to earn rewards"}
            </Text>
          </Flex>
        </Card>
      ) : (
        <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="3">
          {currentSurveys.map((survey) => (
            <Card key={`${survey.surveyId}-${survey.answeredAt}`}>
              <Flex direction="column" gap="3">
                {/* Header */}
                <div>
                  <Flex justify="between" align="start" mb="2">
                    <Badge variant="soft">{survey.category}</Badge>
                    <Flex gap="1">
                      <Badge color={survey.isActive ? 'green' : 'gray'} size="1">
                        {survey.isActive ? 'Active' : 'Closed'}
                      </Badge>
                      {survey.consentGiven && (
                        <Badge color="purple" size="1">
                          Consent
                        </Badge>
                      )}
                    </Flex>
                  </Flex>
                  <Text size="3" weight="bold">{survey.title}</Text>
                  <Text size="2" color="gray" style={{ 
                    marginTop: '4px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {survey.description}
                  </Text>
                </div>

                {/* Answer Info */}
                <Card style={{ backgroundColor: 'var(--green-1)' }}>
                  <Flex direction="column" gap="2">
                    <Flex justify="between">
                      <Text size="1" color="gray">Answered:</Text>
                      <Text size="1" weight="bold">{formatDate(survey.answeredAt)}</Text>
                    </Flex>
                    <Flex justify="between">
                      <Text size="1" color="gray">Reward Earned:</Text>
                      <Text size="1" weight="bold" color="green">
                        {formatSUI(survey.rewardReceived)} SUI
                      </Text>
                    </Flex>
                    <Flex justify="between">
                      <Text size="1" color="gray">Questions:</Text>
                      <Text size="1">{survey.totalQuestions}</Text>
                    </Flex>
                    <Flex justify="between">
                      <Text size="1" color="gray">Total Responses:</Text>
                      <Text size="1">{survey.currentResponses}/{survey.maxResponses}</Text>
                    </Flex>
                  </Flex>
                </Card>

                {/* Transaction Info */}
                {survey.transactionId && (
                  <Flex align="center" gap="1">
                    <Hash size={12} />
                    <Text size="1" color="gray" style={{ fontFamily: 'monospace' }}>
                      Tx: {survey.transactionId.slice(0, 8)}...
                    </Text>
                  </Flex>
                )}

                {/* Actions */}
                <Flex gap="2">
                  <Button 
                    size="2" 
                    variant="soft"
                    style={{ flex: 1 }}
                    onClick={() => viewOriginalSurvey(survey.surveyId)}
                  >
                    <Eye size={16} />
                    View Survey
                  </Button>
                  {answerDetails.length > 0 && (
                    <Button 
                      size="2" 
                      variant="soft"
                      style={{ flex: 1 }}
                      onClick={() => viewAnswerDetails(survey)}
                    >
                      <FileText size={16} />
                      My Answers
                    </Button>
                  )}
                </Flex>
              </Flex>
            </Card>
          ))}
        </Grid>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <Flex justify="between" align="center">
            <Text size="2" color="gray">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredSurveys.length)} of {filteredSurveys.length} surveys
            </Text>
            
            <Flex gap="2" align="center">
              <Button 
                size="2" 
                variant="soft"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </Button>
              
              <Flex gap="1">
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
                    <Button
                      key={i}
                      size="2"
                      variant={pageNum === currentPage ? 'solid' : 'soft'}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </Flex>
              
              <Button 
                size="2" 
                variant="soft"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </Button>
            </Flex>
          </Flex>
        </Card>
      )}

      {/* Answer Details Dialog */}
      <Dialog.Root open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <Dialog.Content style={{ maxWidth: '600px' }}>
          <Dialog.Title>Your Survey Answers</Dialog.Title>
          {selectedSurvey && (
            <Flex direction="column" gap="3" mt="3">
              <Card>
                <Text size="3" weight="bold">{selectedSurvey.title}</Text>
                <Text size="2" color="gray">
                  Answered on: {formatDate(selectedSurvey.answeredAt)}
                </Text>
              </Card>
              
              {answerDetails.length > 0 ? (
                answerDetails.map((answer, idx) => (
                  <Card key={idx}>
                    <Flex direction="column" gap="2">
                      <Text size="2" weight="bold">Q{idx + 1}: {answer.questionText}</Text>
                      <Card style={{ backgroundColor: 'var(--gray-1)' }}>
                        <Text size="2">
                          {Array.isArray(answer.userAnswer) 
                            ? answer.userAnswer.join(', ') 
                            : answer.userAnswer}
                        </Text>
                      </Card>
                    </Flex>
                  </Card>
                ))
              ) : (
                <Card>
                  <Text size="2" color="gray" align="center">
                    Answer details are not available (answers are encrypted on chain)
                  </Text>
                </Card>
              )}
              
              <Flex gap="3" justify="end">
                <Button onClick={() => setShowDetailDialog(false)}>
                  Close
                </Button>
              </Flex>
            </Flex>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}