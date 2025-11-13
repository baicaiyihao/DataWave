// Browse Subscription Services - 基于MySurveys的逻辑
// 获取所有开启订阅服务的问卷并支持购买

import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Badge, Button, Grid, TextField } from '@radix-ui/themes';
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { ConfigService } from '../../services/config';
import { 
  DollarSign, 
  Clock, 
  Users, 
  TrendingUp, 
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  ShoppingCart,
  Eye,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Gift
} from 'lucide-react';

interface SubscriptionSurvey {
  surveyId: string;
  title: string;
  description: string;
  category: string;
  creator: string;
  createdAt: string;
  currentResponses: number;
  maxResponses: number;
  isActive: boolean;
  
  // 订阅服务信息
  subscriptionServiceId: string;
  price: number;
  duration: number;
  totalRevenue: number;
  subscriberCount: number;
  
  // 用户订阅状态
  isSubscribed: boolean;
  userSubscriptionId?: string;
  subscriptionExpiry?: number;
}

export function BrowseSubscriptions() {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const packageId = ConfigService.getPackageId();
  
  const [services, setServices] = useState<SubscriptionSurvey[]>([]);
  const [filteredServices, setFilteredServices] = useState<SubscriptionSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  
  // 筛选状态
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'subscribed' | 'available'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>(['all']);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  
  // 统计
  const [stats, setStats] = useState({
    totalServices: 0,
    subscribedCount: 0,
    availableCount: 0,
    totalRevenue: 0,
  });
  
  const { mutate: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showEffects: true,
        },
      }),
  });

  // 加载所有有订阅服务的问卷
  const loadSubscriptionSurveys = async () => {
    setLoading(true);
    try {
      const allSubscriptionSurveys: SubscriptionSurvey[] = [];
      
      // 1. 首先获取当前用户的所有订阅（如果已登录）
      const userSubMap = new Map<string, any>();
      if (currentAccount?.address) {
        const userSubscriptions = await suiClient.getOwnedObjects({
          owner: currentAccount.address,
          options: { showContent: true, showType: true },
          filter: {
            StructType: `${packageId}::survey_system::Subscription`,
          },
        });
        
        for (const sub of userSubscriptions.data) {
          if (sub.data?.content && 'fields' in sub.data.content) {
            const fields = sub.data.content.fields as any;
            userSubMap.set(fields.survey_id, {
              subscriptionId: sub.data.objectId,
              serviceId: fields.service_id,
              expiresAt: parseInt(fields.expires_at),
            });
          }
        }
      }
      
      // 2. 从 Registry 获取所有问卷
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
                  
                  // 检查是否有订阅服务
                  const subscriptionServiceId = surveyFields.subscription_service_id;
                  
                  if (subscriptionServiceId) {
                    // 获取订阅服务详情
                    const serviceObj = await suiClient.getObject({
                      id: subscriptionServiceId,
                      options: { showContent: true }
                    });
                    
                    if (serviceObj.data?.content && 'fields' in serviceObj.data.content) {
                      const serviceFields = serviceObj.data.content.fields as any;
                      
                      // 获取订阅者数量
                      let subscriberCount = 0;
                      try {
                        const subscriptionEvents = await suiClient.queryEvents({
                          query: {
                            MoveEventType: `${packageId}::survey_system::SubscriptionPurchased`,
                          },
                          limit: 100,
                        });
                        
                        subscriberCount = subscriptionEvents.data.filter((event: any) => 
                          event.parsedJson?.survey_id === surveyId
                        ).length;
                      } catch (e) {
                        console.error('Error getting subscriber count:', e);
                      }
                      
                      // 检查用户是否已订阅
                      const userSub = userSubMap.get(surveyId);
                      const now = Date.now();
                      const isSubscribed = userSub && userSub.expiresAt > now;
                      
                      allSubscriptionSurveys.push({
                        surveyId,
                        title: surveyFields.title || 'Unknown Survey',
                        description: surveyFields.description || '',
                        category: surveyFields.category || 'Uncategorized',
                        creator: surveyFields.creator || '',
                        createdAt: surveyFields.created_at || '0',
                        currentResponses: parseInt(surveyFields.current_responses || '0'),
                        maxResponses: parseInt(surveyFields.max_responses || '0'),
                        isActive: surveyFields.is_active || false,
                        
                        subscriptionServiceId,
                        price: parseInt(serviceFields.price || '0'),
                        duration: parseInt(serviceFields.duration_ms || '0'),
                        totalRevenue: parseInt(serviceFields.total_revenue || '0'),
                        subscriberCount,
                        
                        isSubscribed: !!isSubscribed,
                        userSubscriptionId: userSub?.subscriptionId,
                        subscriptionExpiry: userSub?.expiresAt,
                      });
                    }
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
      
      // 按总收入排序
      allSubscriptionSurveys.sort((a, b) => b.totalRevenue - a.totalRevenue);
      
      setServices(allSubscriptionSurveys);
      setFilteredServices(allSubscriptionSurveys);
      
      // 提取类别
      const uniqueCategories = Array.from(new Set(allSubscriptionSurveys.map(s => s.category)));
      setCategories(['all', ...uniqueCategories]);
      
      // 计算统计
      const subscribedCount = allSubscriptionSurveys.filter(s => s.isSubscribed).length;
      const totalRevenue = allSubscriptionSurveys.reduce((sum, s) => sum + s.totalRevenue, 0);
      
      setStats({
        totalServices: allSubscriptionSurveys.length,
        subscribedCount,
        availableCount: allSubscriptionSurveys.length - subscribedCount,
        totalRevenue,
      });
      
    } catch (error) {
      console.error('Error loading subscription surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  // 购买订阅
  const purchaseSubscription = (service: SubscriptionSurvey) => {
    if (!currentAccount?.address) {
      alert('Please connect your wallet first');
      return;
    }
    
    setPurchasing(service.subscriptionServiceId);
    
    const tx = new Transaction();
    
    // 分割精确金额
    const [coin] = tx.splitCoins(tx.gas, [service.price]);
    
    // 获取 Treasury ID
    const treasuryId = ConfigService.getPlatformTreasuryId();
    
    tx.moveCall({
      target: `${packageId}::survey_system::purchase_subscription_entry`,
      arguments: [
        tx.object(service.subscriptionServiceId), // SubscriptionService
        tx.object(service.surveyId), // Survey  
        coin, // Payment
        tx.object(treasuryId), // PlatformTreasury
        tx.object('0x6'), // Clock
      ],
    });
    
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          console.log('Subscription purchased:', result);
          
          // 查找创建的 Subscription NFT
          const subscriptionNft = result.effects?.created?.find(
            (item) => (item.owner as any)?.AddressOwner === currentAccount?.address,
          );
          
          if (subscriptionNft) {
            alert(`Successfully subscribed! Your subscription NFT ID: ${subscriptionNft.reference.objectId}`);
            loadSubscriptionSurveys(); // 刷新列表
          }
        },
        onError: (error) => {
          console.error('Error purchasing subscription:', error);
          alert(`Failed to purchase subscription: ${error.message}`);
        },
        onSettled: () => {
          setPurchasing(null);
        }
      },
    );
  };

  // 应用筛选
  useEffect(() => {
    let filtered = [...services];
    
    // 类别筛选
    if (filterCategory !== 'all') {
      filtered = filtered.filter(s => s.category === filterCategory);
    }
    
    // 状态筛选
    if (filterStatus === 'subscribed') {
      filtered = filtered.filter(s => s.isSubscribed);
    } else if (filterStatus === 'available') {
      filtered = filtered.filter(s => !s.isSubscribed);
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
    
    setFilteredServices(filtered);
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterCategory, services]);

  // 初始加载
  useEffect(() => {
    loadSubscriptionSurveys();
  }, [currentAccount?.address]);

  // 分页计算
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentServices = filteredServices.slice(startIndex, endIndex);

  // 格式化函数
  const formatSUI = (amount: number) => {
    return (amount / 1000000000).toFixed(4);
  };

  const formatDuration = (ms: number) => {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) return `${hours} hours`;
    return `${Math.floor(hours / 24)} days`;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString();
  };

  const formatExpiry = (timestamp: number) => {
    const now = Date.now();
    const diff = timestamp - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const handleViewAnswers = (service: SubscriptionSurvey) => {
    if (!service.userSubscriptionId) return;
    
    const event = new CustomEvent('viewSubscriptionAnswers', { 
      detail: { 
        surveyId: service.surveyId,
        subscriptionId: service.userSubscriptionId
      } 
    });
    window.dispatchEvent(event);
  };

  return (
    <Flex direction="column" gap="3">
      {/* Header with Stats */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <div>
              <Text size="5" weight="bold">Subscription Marketplace</Text>
              <Flex gap="4" mt="2">
                <Text size="2" color="gray">
                  Total: <Text weight="bold">{stats.totalServices}</Text>
                </Text>
                <Text size="2" color="gray">
                  Subscribed: <Text weight="bold" color="green">{stats.subscribedCount}</Text>
                </Text>
                <Text size="2" color="gray">
                  Available: <Text weight="bold" color="blue">{stats.availableCount}</Text>
                </Text>
                <Text size="2" color="gray">
                  Total Revenue: <Text weight="bold">{formatSUI(stats.totalRevenue)} SUI</Text>
                </Text>
              </Flex>
            </div>
            <Button onClick={loadSubscriptionSurveys} variant="soft" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </Flex>
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
            <option value="all">All Services</option>
            <option value="subscribed">My Subscriptions</option>
            <option value="available">Available to Subscribe</option>
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

      {/* Services Grid */}
      {loading ? (
        <Card>
          <Text align="center" size="3">Loading subscription services...</Text>
        </Card>
      ) : currentServices.length === 0 ? (
        <Card>
          <Text align="center" size="3" color="gray">
            {filteredServices.length === 0 
              ? 'No subscription services found'
              : 'No services on this page'}
          </Text>
        </Card>
      ) : (
        <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="3">
          {currentServices.map((service) => (
            <Card key={service.subscriptionServiceId}>
              <Flex direction="column" gap="3">
                {/* Header */}
                <div>
                  <Flex justify="between" align="start" mb="2">
                    <Badge variant="soft">{service.category}</Badge>
                    {service.isSubscribed && (
                      <Badge color="green" variant="soft">
                        <CheckCircle size={12} />
                        Subscribed
                      </Badge>
                    )}
                  </Flex>
                  <Text size="3" weight="bold">{service.title}</Text>
                  <Text size="2" color="gray" style={{ 
                    marginTop: '4px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {service.description}
                  </Text>
                </div>

                {/* Info Cards */}
                <Flex direction="column" gap="2">
                  <Flex gap="2">
                    <Card style={{ flex: 1, backgroundColor: 'var(--purple-1)' }}>
                      <Flex direction="column" gap="1">
                        <Flex align="center" gap="1">
                          <DollarSign size={12} />
                          <Text size="1" color="gray">Price</Text>
                        </Flex>
                        <Text size="2" weight="bold">{formatSUI(service.price)} SUI</Text>
                      </Flex>
                    </Card>
                    
                    <Card style={{ flex: 1, backgroundColor: 'var(--blue-1)' }}>
                      <Flex direction="column" gap="1">
                        <Flex align="center" gap="1">
                          <Clock size={12} />
                          <Text size="1" color="gray">Duration</Text>
                        </Flex>
                        <Text size="2" weight="bold">{formatDuration(service.duration)}</Text>
                      </Flex>
                    </Card>
                  </Flex>
                  
                  <Flex gap="2">
                    <Card style={{ flex: 1, backgroundColor: 'var(--green-1)' }}>
                      <Flex direction="column" gap="1">
                        <Flex align="center" gap="1">
                          <Users size={12} />
                          <Text size="1" color="gray">Subscribers</Text>
                        </Flex>
                        <Text size="2" weight="bold">{service.subscriberCount}</Text>
                      </Flex>
                    </Card>
                    
                    <Card style={{ flex: 1, backgroundColor: 'var(--orange-1)' }}>
                      <Flex direction="column" gap="1">
                        <Flex align="center" gap="1">
                          <TrendingUp size={12} />
                          <Text size="1" color="gray">Responses</Text>
                        </Flex>
                        <Text size="2" weight="bold">
                          {service.currentResponses}/{service.maxResponses}
                        </Text>
                      </Flex>
                    </Card>
                  </Flex>
                </Flex>

                {/* Additional Info */}
                <Flex direction="column" gap="1">
                  <Flex justify="between">
                    <Text size="1" color="gray">Created:</Text>
                    <Text size="1">{formatDate(service.createdAt)}</Text>
                  </Flex>
                  {service.totalRevenue > 0 && (
                    <Flex justify="between">
                      <Text size="1" color="gray">Total Revenue:</Text>
                      <Text size="1" weight="bold">{formatSUI(service.totalRevenue)} SUI</Text>
                    </Flex>
                  )}
                  <Flex justify="between">
                    <Text size="1" color="gray">Status:</Text>
                    <Badge size="1" color={service.isActive ? 'green' : 'gray'}>
                      {service.isActive ? 'Active' : 'Closed'}
                    </Badge>
                  </Flex>
                </Flex>

                {/* Action Button */}
                {service.isSubscribed ? (
                  <Flex direction="column" gap="2">
                    {service.subscriptionExpiry && (
                      <Card style={{ backgroundColor: 'var(--green-2)' }}>
                        <Text size="2" align="center" color="green" weight="bold">
                          {formatExpiry(service.subscriptionExpiry)}
                        </Text>
                      </Card>
                    )}
                    <Button 
                      size="2" 
                      variant="soft"
                      onClick={() => handleViewAnswers(service)}
                    >
                      <Eye size={16} />
                      View Survey Answers
                    </Button>
                  </Flex>
                ) : (
                  <Button
                    size="2"
                    onClick={() => purchaseSubscription(service)}
                    disabled={purchasing === service.subscriptionServiceId}
                  >
                    {purchasing === service.subscriptionServiceId ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShoppingCart size={16} />
                        Subscribe for {formatSUI(service.price)} SUI
                      </>
                    )}
                  </Button>
                )}
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
              Showing {startIndex + 1}-{Math.min(endIndex, filteredServices.length)} of {filteredServices.length} services
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