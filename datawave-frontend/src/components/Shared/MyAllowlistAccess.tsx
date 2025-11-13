// My Allowlist Access Page
// 查看我被加入白名单的问卷

import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Badge, Button, Grid, Tabs } from '@radix-ui/themes';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
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
  Filter,
  Key
} from 'lucide-react';

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
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const packageId = ConfigService.getPackageId();
  
  const [surveys, setSurveys] = useState<AllowlistSurvey[]>([]);
  const [filteredSurveys, setFilteredSurveys] = useState<AllowlistSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'with-answers'>('all');
  
  // 筛选和分页
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>(['all']);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);
  
  // 统计
  const [stats, setStats] = useState({
    totalAccess: 0,
    activeAccess: 0,
    withAnswers: 0,
    totalAnswers: 0,
  });

  // 加载用户在 allowlist 中的问卷
  const loadAllowlistSurveys = async () => {
    if (!currentAccount?.address) return;
    
    setLoading(true);
    try {
      const allowlistSurveys: AllowlistSurvey[] = [];
      
      // 从 Registry 获取所有问卷
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
          
          while (hasNextPage) {
            const dynamicFields = await suiClient.getDynamicFields({
              parentId: allSurveysTable,
              cursor,
              limit: 50,
            });
            
            // 处理每个问卷
            for (const field of dynamicFields.data) {
              try {
                const surveyId = field.name.value as string;
                
                // 获取问卷详情
                const surveyObj = await suiClient.getObject({
                  id: surveyId,
                  options: { showContent: true }
                });
                
                if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
                  const surveyFields = surveyObj.data.content.fields as any;
                  
                  // 检查 allowlist
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
                  
                  // 如果用户在 allowlist 中
                  if (isInAllowlist) {
                    // 解析问题
                    const questions = surveyFields.questions?.map((q: any) => ({
                      question_text: q.fields?.question_text || q.question_text || '',
                      question_type: parseInt(q.fields?.question_type || q.question_type || '0'),
                      options: q.fields?.options || q.options || []
                    })) || [];
                    
                    // 统计答案数量
                    let answerCount = 0;
                    if (surveyFields.encrypted_answer_blobs?.fields?.id?.id) {
                      try {
                        const answersTableFields = await suiClient.getDynamicFields({
                          parentId: surveyFields.encrypted_answer_blobs.fields.id.id,
                          limit: 1, // 只需要知道数量
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
                      canDecrypt: true, // 在 allowlist 中就可以解密
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
      
      // 按创建时间排序
      allowlistSurveys.sort((a, b) => {
        return parseInt(b.createdAt || '0') - parseInt(a.createdAt || '0');
      });
      
      setSurveys(allowlistSurveys);
      setFilteredSurveys(allowlistSurveys);
      
      // 提取类别
      const uniqueCategories = Array.from(new Set(allowlistSurveys.map(s => s.category)));
      setCategories(['all', ...uniqueCategories]);
      
      // 计算统计
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
    }
  };

  // 应用筛选
  useEffect(() => {
    let filtered = [...surveys];
    
    // Tab 筛选
    if (activeTab === 'active') {
      filtered = filtered.filter(s => s.isActive);
    } else if (activeTab === 'with-answers') {
      filtered = filtered.filter(s => s.hasAnswers);
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
  }, [searchTerm, filterCategory, activeTab, surveys]);

  // 初始加载
  useEffect(() => {
    if (currentAccount?.address) {
      loadAllowlistSurveys();
    }
  }, [currentAccount?.address]);

  // 分页计算
  const totalPages = Math.ceil(filteredSurveys.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSurveys = filteredSurveys.slice(startIndex, endIndex);

  // 格式化函数
  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString();
  };

  // 查看问卷详情
  const viewSurveyDetails = (surveyId: string) => {
    const event = new CustomEvent('viewSurveyDetails', { 
      detail: { surveyId } 
    });
    window.dispatchEvent(event);
  };

  // 开始解密答案
  const startDecryption = (surveyId: string) => {
    // 直接触发管理访问事件，传递surveyId
    const event = new CustomEvent('manageSurveyAllowlist', { 
      detail: { surveyId } 
    });
    window.dispatchEvent(event);
  };

  if (!currentAccount) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="3" py="5">
          <Text size="4" weight="bold">Connect Wallet</Text>
          <Text size="2" color="gray">Please connect your wallet to view your allowlist access</Text>
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
              <Text size="5" weight="bold">My Allowlist Access</Text>
              <Text size="2" color="gray">Surveys where you have decryption access</Text>
            </div>
            <Button onClick={loadAllowlistSurveys} variant="soft" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </Flex>
          
          {/* Stats Cards */}
          <Grid columns="4" gap="3">
            <Card style={{ backgroundColor: 'var(--purple-2)' }}>
              <Flex direction="column" gap="1">
                <Flex align="center" gap="1">
                  <Shield size={14} />
                  <Text size="1" color="gray">Total Access</Text>
                </Flex>
                <Text size="4" weight="bold">{stats.totalAccess}</Text>
              </Flex>
            </Card>
            
            <Card style={{ backgroundColor: 'var(--green-2)' }}>
              <Flex direction="column" gap="1">
                <Flex align="center" gap="1">
                  <Unlock size={14} />
                  <Text size="1" color="gray">Active Surveys</Text>
                </Flex>
                <Text size="4" weight="bold" color="green">{stats.activeAccess}</Text>
              </Flex>
            </Card>
            
            <Card style={{ backgroundColor: 'var(--blue-2)' }}>
              <Flex direction="column" gap="1">
                <Flex align="center" gap="1">
                  <FileText size={14} />
                  <Text size="1" color="gray">With Answers</Text>
                </Flex>
                <Text size="4" weight="bold">{stats.withAnswers}</Text>
              </Flex>
            </Card>
            
            <Card style={{ backgroundColor: 'var(--orange-2)' }}>
              <Flex direction="column" gap="1">
                <Flex align="center" gap="1">
                  <Users size={14} />
                  <Text size="1" color="gray">Total Answers</Text>
                </Flex>
                <Text size="4" weight="bold">{stats.totalAnswers}</Text>
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
              <Tabs.Trigger value="all">All ({surveys.length})</Tabs.Trigger>
              <Tabs.Trigger value="active">Active ({surveys.filter(s => s.isActive).length})</Tabs.Trigger>
              <Tabs.Trigger value="with-answers">With Answers ({surveys.filter(s => s.hasAnswers).length})</Tabs.Trigger>
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
          <Text align="center" size="3">Loading your allowlist access...</Text>
        </Card>
      ) : currentSurveys.length === 0 ? (
        <Card>
          <Flex direction="column" align="center" gap="3" py="5">
            <Lock size={48} color="gray" />
            <Text size="3" weight="bold">
              {filteredSurveys.length === 0 
                ? (surveys.length === 0 
                  ? "No Allowlist Access"
                  : "No surveys match your filters")
                : "No surveys on this page"}
            </Text>
            <Text size="2" color="gray">
              {surveys.length === 0 && "You haven't been added to any survey allowlists yet"}
            </Text>
          </Flex>
        </Card>
      ) : (
        <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="3">
          {currentSurveys.map((survey) => (
            <Card key={survey.id}>
              <Flex direction="column" gap="3">
                {/* Header */}
                <div>
                  <Flex justify="between" align="start" mb="2">
                    <Badge variant="soft">{survey.category}</Badge>
                    <Flex gap="1">
                      <Badge color={survey.isActive ? 'green' : 'gray'} size="1">
                        {survey.isActive ? 'Active' : 'Closed'}
                      </Badge>
                      {survey.hasAnswers && (
                        <Badge color="blue" size="1">
                          Has Answers
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

                {/* Info */}
                <Flex direction="column" gap="2">
                  <Flex justify="between">
                    <Text size="1" color="gray">Created:</Text>
                    <Text size="1">{formatDate(survey.createdAt)}</Text>
                  </Flex>
                  <Flex justify="between">
                    <Text size="1" color="gray">Questions:</Text>
                    <Text size="1">{survey.questions.length}</Text>
                  </Flex>
                  <Flex justify="between">
                    <Text size="1" color="gray">Responses:</Text>
                    <Text size="1">{survey.currentResponses}/{survey.maxResponses}</Text>
                  </Flex>
                  <Flex justify="between">
                    <Text size="1" color="gray">Allowlist Size:</Text>
                    <Text size="1">{survey.allowlistSize} addresses</Text>
                  </Flex>
                  {survey.hasAnswers && (
                    <Flex justify="between">
                      <Text size="1" color="gray">Answer Count:</Text>
                      <Text size="1" weight="bold">{survey.answerCount}</Text>
                    </Flex>
                  )}
                </Flex>

                {/* Access Badge */}
                <Card style={{ backgroundColor: 'var(--purple-1)' }}>
                  <Flex align="center" justify="center" gap="2">
                    <Key size={14} />
                    <Text size="2" weight="bold" color="purple">
                      Decryption Access Granted
                    </Text>
                  </Flex>
                </Card>

                {/* Actions */}
                <Flex gap="2">
                  <Button 
                    size="2" 
                    variant="soft"
                    style={{ flex: 1 }}
                    onClick={() => viewSurveyDetails(survey.id)}
                  >
                    <Eye size={16} />
                    View Details
                  </Button>
                  {survey.hasAnswers && (
                    <Button 
                      size="2"
                      style={{ flex: 1 }}
                      onClick={() => startDecryption(survey.id)}
                    >
                      <Unlock size={16} />
                      Decrypt
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
    </Flex>
  );
}