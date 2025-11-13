// View All Surveys Component with Pagination - Router Version
// 自动查询所有问卷并分页展示

import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Badge, Button, Grid, Select, TextField } from '@radix-ui/themes';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { ConfigService } from '../../services/config';
import { ChevronLeft, ChevronRight, RefreshCw, Search, Filter } from 'lucide-react';

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

// 移除了 props 接口
export function ViewAllSurveys() {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const navigate = useNavigate(); // 添加路由导航
  
  const [surveys, setSurveys] = useState<SurveyBasicInfo[]>([]);
  const [filteredSurveys, setFilteredSurveys] = useState<SurveyBasicInfo[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  
  // 筛选状态
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'closed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<string[]>(['all']);
  
  // 统计信息
  const [stats, setStats] = useState({
    totalSurveys: 0,
    activeSurveys: 0,
    totalResponses: 0,
  });

  // 查看详情 - 改用路由导航
  const viewDetails = (surveyId: string) => {
    navigate(`/survey/${surveyId}`);
  };

  // 回答问卷 - 新增方法
  const answerSurvey = (surveyId: string) => {
    navigate(`/earn/answer/${surveyId}`);
  };

  // 获取所有问卷
  const fetchAllSurveys = async () => {
    setLoading(true);
    try {
      const registryId = ConfigService.getSurveyRegistryId();
      
      // 获取 Registry 对象
      const registry = await suiClient.getObject({
        id: registryId,
        options: {
          showContent: true,
        }
      });

      console.log('Registry object:', registry);

      if (registry.data?.content && 'fields' in registry.data.content) {
        const fields = registry.data.content.fields;
        
        // 获取统计信息
        setStats({
          totalSurveys: parseInt(fields.total_surveys || '0'),
          activeSurveys: 0, // 需要计算
          totalResponses: parseInt(fields.total_responses || '0'),
        });

        // 获取 all_surveys table
        const allSurveysTable = fields.all_surveys?.fields?.id?.id;
        
        if (allSurveysTable) {
          // 查询所有问卷的动态字段
          let hasNextPage = true;
          let cursor = null;
          const allSurveyData: SurveyBasicInfo[] = [];
          
          while (hasNextPage) {
            const dynamicFields = await suiClient.getDynamicFields({
              parentId: allSurveysTable,
              cursor,
              limit: 50, // 每次获取50个
            });
            
            console.log(`Fetched ${dynamicFields.data.length} surveys`);
            
            // 批量获取问卷详情
            const surveyPromises = dynamicFields.data.map(async (field) => {
              try {
                // 获取动态字段的内容（SurveyBasicInfo）
                const fieldObject = await suiClient.getDynamicFieldObject({
                  parentId: allSurveysTable,
                  name: field.name,
                });
                
                if (fieldObject.data?.content && 'fields' in fieldObject.data.content) {
                  const basicInfo = fieldObject.data.content.fields.value?.fields;
                  if (basicInfo) {
                    return {
                      id: field.name.value as string,
                      title: basicInfo.title || '',
                      description: basicInfo.description || '',
                      category: basicInfo.category || '',
                      isActive: basicInfo.is_active || false,
                      currentResponses: parseInt(basicInfo.current_responses || '0'),
                      maxResponses: parseInt(basicInfo.max_responses || '0'),
                      rewardPerResponse: basicInfo.reward_per_response || '0',
                      createdAt: basicInfo.created_at || '0',
                      creator: basicInfo.creator || '',
                    };
                  }
                }
                
                // 备选方案：直接获取 Survey 对象
                const surveyObj = await suiClient.getObject({
                  id: field.name.value as string,
                  options: {
                    showContent: true,
                  }
                });
                
                if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
                  const surveyFields = surveyObj.data.content.fields;
                  return {
                    id: field.name.value as string,
                    title: surveyFields.title || '',
                    description: surveyFields.description || '',
                    category: surveyFields.category || '',
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
          
          // 按创建时间排序（最新的在前）
          allSurveyData.sort((a, b) => {
            return parseInt(b.createdAt || '0') - parseInt(a.createdAt || '0');
          });
          
          setSurveys(allSurveyData);
          setFilteredSurveys(allSurveyData);
          
          // 提取所有类别
          const uniqueCategories = Array.from(new Set(allSurveyData.map(s => s.category)));
          setCategories(['all', ...uniqueCategories]);
          
          // 计算活跃问卷数量
          const activeCount = allSurveyData.filter(s => s.isActive).length;
          setStats(prev => ({ ...prev, activeSurveys: activeCount }));
        }
      }
    } catch (error) {
      console.error('Error fetching surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  // 应用筛选
  useEffect(() => {
    let filtered = [...surveys];
    
    // 按类别筛选
    if (filterCategory !== 'all') {
      filtered = filtered.filter(s => s.category === filterCategory);
    }
    
    // 按状态筛选
    if (filterStatus === 'active') {
      filtered = filtered.filter(s => s.isActive);
    } else if (filterStatus === 'closed') {
      filtered = filtered.filter(s => !s.isActive);
    }
    
    // 按搜索词筛选
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredSurveys(filtered);
    setCurrentPage(1); // 重置到第一页
  }, [filterCategory, filterStatus, searchTerm, surveys]);

  // 初始加载
  useEffect(() => {
    fetchAllSurveys();
  }, []);

  // 分页计算
  const totalPages = Math.ceil(filteredSurveys.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSurveys = filteredSurveys.slice(startIndex, endIndex);

  // 格式化时间
  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString();
  };

  // 格式化 SUI
  const formatSUI = (amount: string) => {
    return (parseInt(amount) / 1000000000).toFixed(3);
  };

  return (
    <Flex direction="column" gap="3">
      {/* Header with Stats */}
      <Card>
        <Flex justify="between" align="center">
          <div>
            <Text size="5" weight="bold">All Surveys</Text>
            <Flex gap="4" mt="2">
              <Text size="2" color="gray">
                Total: <Text weight="bold">{stats.totalSurveys}</Text>
              </Text>
              <Text size="2" color="gray">
                Active: <Text weight="bold" color="green">{stats.activeSurveys}</Text>
              </Text>
              <Text size="2" color="gray">
                Responses: <Text weight="bold">{stats.totalResponses}</Text>
              </Text>
            </Flex>
          </div>
          <Button 
            onClick={fetchAllSurveys} 
            disabled={loading}
            variant="soft"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </Flex>
      </Card>

      {/* Filters */}
      <Card>
        <Flex gap="3" align="center" wrap="wrap">
          <Flex align="center" gap="2">
            <Filter size={16} />
            <Text size="2">Filters:</Text>
          </Flex>
          
          <TextField.Root
            placeholder="Search surveys..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '200px' }}
          >
            <TextField.Slot>
              <Search size={16} />
            </TextField.Slot>
          </TextField.Root>
          
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--gray-6)' }}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--gray-6)' }}
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="closed">Closed Only</option>
          </select>
          
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--gray-6)' }}
          >
            <option value="6">6 per page</option>
            <option value="12">12 per page</option>
            <option value="24">24 per page</option>
          </select>
        </Flex>
      </Card>

      {/* Survey Grid */}
      {loading ? (
        <Card>
          <Text align="center" size="3">Loading surveys...</Text>
        </Card>
      ) : currentSurveys.length === 0 ? (
        <Card>
          <Text align="center" size="3">No surveys found</Text>
        </Card>
      ) : (
        <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="3">
          {currentSurveys.map(survey => (
            <Card 
              key={survey.id} 
              style={{ transition: 'all 0.2s' }}
              className="hover:shadow-lg"
            >
              <Flex direction="column" gap="2" height="100%">
                <Flex justify="between" align="start">
                  <Badge 
                    size="1" 
                    color={survey.isActive ? 'green' : 'gray'}
                  >
                    {survey.isActive ? 'Active' : 'Closed'}
                  </Badge>
                  <Badge size="1" variant="soft">
                    {survey.category}
                  </Badge>
                </Flex>
                
                <div style={{ flex: 1 }}>
                  <Text size="3" weight="bold" style={{ display: 'block', marginBottom: '8px' }}>
                    {survey.title}
                  </Text>
                  <Text size="2" color="gray" style={{ 
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {survey.description}
                  </Text>
                </div>
                
                <Flex direction="column" gap="1" mt="2">
                  <Flex justify="between">
                    <Text size="1" color="gray">Reward:</Text>
                    <Text size="1" weight="bold">{formatSUI(survey.rewardPerResponse)} SUI</Text>
                  </Flex>
                  <Flex justify="between">
                    <Text size="1" color="gray">Progress:</Text>
                    <Text size="1">
                      {survey.currentResponses}/{survey.maxResponses}
                    </Text>
                  </Flex>
                  {survey.createdAt && (
                    <Flex justify="between">
                      <Text size="1" color="gray">Created:</Text>
                      <Text size="1">{formatDate(survey.createdAt)}</Text>
                    </Flex>
                  )}
                </Flex>
                
                {/* 修改按钮部分 */}
                <Flex gap="2" mt="2">
                  {survey.isActive && survey.currentResponses < survey.maxResponses ? (
                    <>
                      <Button 
                        size="2" 
                        style={{ flex: 1 }}
                        onClick={(e) => {
                          e.stopPropagation(); // 防止事件冒泡
                          answerSurvey(survey.id);
                        }}
                      >
                        Answer
                      </Button>
                      <Button 
                        size="2" 
                        variant="soft"
                        style={{ flex: 1 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          viewDetails(survey.id);
                        }}
                      >
                        Details
                      </Button>
                    </>
                  ) : (
                    <Button 
                      size="2" 
                      variant="soft" 
                      style={{ width: '100%' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        viewDetails(survey.id);
                      }}
                    >
                      View Details →
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

export default ViewAllSurveys;