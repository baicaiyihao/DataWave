// My Subscriptions Page - Router Version
// 管理用户的订阅，查看活跃和过期的订阅

import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Badge, Button, Grid, Tabs } from '@radix-ui/themes';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { ConfigService } from '../../services/config';
import { 
  Clock, 
  Calendar,
  Eye,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  FileText,
  Users,
  TrendingUp
} from 'lucide-react';

interface UserSubscription {
  subscriptionId: string;
  serviceId: string;
  surveyId: string;
  surveyTitle: string;
  surveyDescription: string;
  surveyCategory: string;
  createdAt: number;
  expiresAt: number;
  isExpired: boolean;
  responseCount: number;
  maxResponses: number;
  price: number;
  duration: number;
}

export function MySubscriptions() {
  const navigate = useNavigate();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const packageId = ConfigService.getPackageId();
  
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active');
  
  const [stats, setStats] = useState({
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    totalSpent: 0,
  });

  // Navigation functions
  const viewSurveyAnswers = (surveyId: string, subscriptionId: string) => {
    // Navigate to subscription decrypt page with subscription info
    navigate(`/subscription/decrypt/${surveyId}`, { 
      state: { subscriptionId } 
    });
  };

  const browseMoreSubscriptions = () => {
    navigate('/marketplace/subscriptions');
  };

  const loadUserSubscriptions = async () => {
    if (!currentAccount?.address) return;
    
    setLoading(true);
    try {
      // Get all Subscription NFTs owned by user
      const userSubscriptions = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        options: {
          showContent: true,
          showType: true,
        },
        filter: {
          StructType: `${packageId}::survey_system::Subscription`,
        },
      });

      console.log(`Found ${userSubscriptions.data.length} subscriptions for user`);

      const subscriptionData: UserSubscription[] = [];
      const now = Date.now();
      let totalSpent = 0;

      for (const sub of userSubscriptions.data) {
        if (sub.data?.content && 'fields' in sub.data.content) {
          const subFields = sub.data.content.fields as any;

          // Get survey details
          try {
            const survey = await suiClient.getObject({
              id: subFields.survey_id,
              options: { showContent: true },
            });
            
            if (survey.data?.content && 'fields' in survey.data.content) {
              const surveyFields = survey.data.content.fields as any;
              
              // Get service details for price info
              let price = 0;
              let duration = 0;
              
              try {
                const service = await suiClient.getObject({
                  id: subFields.service_id,
                  options: { showContent: true },
                });
                
                if (service.data?.content && 'fields' in service.data.content) {
                  const serviceFields = service.data.content.fields as any;
                  price = parseInt(serviceFields.price || '0');
                  duration = parseInt(serviceFields.duration_ms || '0');
                  totalSpent += price;
                }
              } catch (error) {
                console.error('Error loading service details:', error);
              }
              
              const expiresAt = parseInt(subFields.expires_at);
              
              subscriptionData.push({
                subscriptionId: sub.data.objectId,
                serviceId: subFields.service_id,
                surveyId: subFields.survey_id,
                surveyTitle: surveyFields.title || 'Unknown Survey',
                surveyDescription: surveyFields.description || '',
                surveyCategory: surveyFields.category || 'Uncategorized',
                createdAt: parseInt(subFields.created_at),
                expiresAt,
                isExpired: expiresAt < now,
                responseCount: parseInt(surveyFields.current_responses || '0'),
                maxResponses: parseInt(surveyFields.max_responses || '0'),
                price,
                duration,
              });
            }
          } catch (error) {
            console.error(`Error loading survey ${subFields.survey_id}:`, error);
          }
        }
      }

      // Sort by expiry date (active first, then by expiry date)
      subscriptionData.sort((a, b) => {
        if (a.isExpired !== b.isExpired) {
          return a.isExpired ? 1 : -1;
        }
        return b.expiresAt - a.expiresAt;
      });

      setSubscriptions(subscriptionData);
      
      // Calculate stats
      const activeCount = subscriptionData.filter(s => !s.isExpired).length;
      const expiredCount = subscriptionData.filter(s => s.isExpired).length;
      
      setStats({
        totalSubscriptions: subscriptionData.length,
        activeSubscriptions: activeCount,
        expiredSubscriptions: expiredCount,
        totalSpent,
      });
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserSubscriptions();
    
    // Refresh every 30 seconds to update expiry status
    const interval = setInterval(loadUserSubscriptions, 30000);
    return () => clearInterval(interval);
  }, [currentAccount?.address]);

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatPrice = (mist: number): string => {
    const sui = mist / 1_000_000_000;
    return `${sui.toFixed(4)} SUI`;
  };

  const formatDuration = (ms: number): string => {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) {
      return `${hours} hours`;
    }
    return `${Math.floor(hours / 24)} days`;
  };

  const getTimeRemaining = (expiresAt: number): string => {
    const now = Date.now();
    const diff = expiresAt - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  if (!currentAccount) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="3" py="5">
          <Text size="4" weight="bold">Connect Wallet</Text>
          <Text size="2" color="gray">Please connect your wallet to view your subscriptions</Text>
        </Flex>
      </Card>
    );
  }

  const activeSubscriptions = subscriptions.filter(s => !s.isExpired);
  const expiredSubscriptions = subscriptions.filter(s => s.isExpired);

  return (
    <Flex direction="column" gap="3">
      {/* Header with Stats */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <div>
              <Text size="5" weight="bold">My Survey Subscriptions</Text>
              <Text size="2" color="gray">Manage your active and expired subscriptions</Text>
            </div>
            <Flex gap="2">
              <Button onClick={loadUserSubscriptions} variant="soft" disabled={loading}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
              <Button onClick={browseMoreSubscriptions} variant="soft" color="blue">
                Browse More
              </Button>
            </Flex>
          </Flex>
          
          {/* Stats Cards */}
          <Grid columns="4" gap="3">
            <Card style={{ backgroundColor: 'var(--blue-2)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Total Subscriptions</Text>
                <Text size="4" weight="bold">{stats.totalSubscriptions}</Text>
              </Flex>
            </Card>
            
            <Card style={{ backgroundColor: 'var(--green-2)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Active</Text>
                <Text size="4" weight="bold" color="green">{stats.activeSubscriptions}</Text>
              </Flex>
            </Card>
            
            <Card style={{ backgroundColor: 'var(--gray-3)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Expired</Text>
                <Text size="4" weight="bold">{stats.expiredSubscriptions}</Text>
              </Flex>
            </Card>
            
            <Card style={{ backgroundColor: 'var(--purple-2)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Total Spent</Text>
                <Text size="3" weight="bold">{formatPrice(stats.totalSpent)}</Text>
              </Flex>
            </Card>
          </Grid>
        </Flex>
      </Card>

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <Tabs.List>
          <Tabs.Trigger value="active">
            Active ({activeSubscriptions.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="expired">
            Expired ({expiredSubscriptions.length})
          </Tabs.Trigger>
        </Tabs.List>
        
        {/* Active Subscriptions */}
        <Tabs.Content value="active">
          {loading ? (
            <Card>
              <Text align="center">Loading your subscriptions...</Text>
            </Card>
          ) : activeSubscriptions.length === 0 ? (
            <Card>
              <Flex direction="column" align="center" gap="3" py="4">
                <AlertCircle size={48} color="gray" />
                <Text size="3" weight="bold">No Active Subscriptions</Text>
                <Text size="2" color="gray">You don't have any active subscriptions</Text>
                <Button onClick={browseMoreSubscriptions}>
                  Browse Available Subscriptions
                </Button>
              </Flex>
            </Card>
          ) : (
            <Grid columns={{ initial: '1', sm: '2' }} gap="3">
              {activeSubscriptions.map((sub) => (
                <Card key={sub.subscriptionId}>
                  <Flex direction="column" gap="3">
                    {/* Header */}
                    <div>
                      <Flex justify="between" align="start" mb="2">
                        <Badge variant="soft">{sub.surveyCategory}</Badge>
                        <Badge color="green" variant="soft">
                          <CheckCircle size={12} />
                          Active
                        </Badge>
                      </Flex>
                      <Text size="3" weight="bold">{sub.surveyTitle}</Text>
                      <Text size="2" color="gray" style={{ marginTop: '4px' }}>
                        {sub.surveyDescription}
                      </Text>
                    </div>

                    {/* Details */}
                    <Flex direction="column" gap="2">
                      <Flex justify="between">
                        <Text size="2" color="gray">Subscription ID:</Text>
                        <Text size="2" style={{ fontFamily: 'monospace' }}>
                          {sub.subscriptionId.slice(0, 8)}...
                        </Text>
                      </Flex>
                      
                      <Flex justify="between">
                        <Text size="2" color="gray">Survey Responses:</Text>
                        <Text size="2" weight="bold">
                          {sub.responseCount} / {sub.maxResponses}
                        </Text>
                      </Flex>
                      
                      <Flex justify="between">
                        <Text size="2" color="gray">Subscribed:</Text>
                        <Text size="2">{formatDate(sub.createdAt)}</Text>
                      </Flex>
                      
                      <Flex justify="between">
                        <Text size="2" color="gray">Expires:</Text>
                        <Text size="2">{formatDate(sub.expiresAt)}</Text>
                      </Flex>
                    </Flex>

                    {/* Time Remaining */}
                    <Card style={{ backgroundColor: 'var(--green-2)' }}>
                      <Flex align="center" justify="center" gap="2">
                        <Clock size={16} />
                        <Text size="2" weight="bold">
                          {getTimeRemaining(sub.expiresAt)}
                        </Text>
                      </Flex>
                    </Card>

                    {/* Actions */}
                    <Flex gap="2">
                      <Button
                        size="2"
                        style={{ flex: 1 }}
                        onClick={() => viewSurveyAnswers(sub.surveyId, sub.subscriptionId)}
                      >
                        <Eye size={16} />
                        View Survey Answers
                      </Button>
                      <Button
                        size="2"
                        variant="soft"
                        onClick={() => window.open(`https://suiscan.xyz/testnet/object/${sub.subscriptionId}`, '_blank')}
                      >
                        <ExternalLink size={16} />
                      </Button>
                    </Flex>
                  </Flex>
                </Card>
              ))}
            </Grid>
          )}
        </Tabs.Content>
        
        {/* Expired Subscriptions */}
        <Tabs.Content value="expired">
          {expiredSubscriptions.length === 0 ? (
            <Card>
              <Flex direction="column" align="center" gap="3" py="4">
                <Text size="3" color="gray">No expired subscriptions</Text>
              </Flex>
            </Card>
          ) : (
            <Grid columns={{ initial: '1', sm: '2' }} gap="3">
              {expiredSubscriptions.map((sub) => (
                <Card key={sub.subscriptionId} style={{ opacity: 0.8 }}>
                  <Flex direction="column" gap="3">
                    {/* Header */}
                    <div>
                      <Flex justify="between" align="start" mb="2">
                        <Badge variant="soft" color="gray">{sub.surveyCategory}</Badge>
                        <Badge color="red" variant="soft">
                          <XCircle size={12} />
                          Expired
                        </Badge>
                      </Flex>
                      <Text size="3" weight="bold">{sub.surveyTitle}</Text>
                      <Text size="2" color="gray" style={{ marginTop: '4px' }}>
                        {sub.surveyDescription}
                      </Text>
                    </div>

                    {/* Details */}
                    <Flex direction="column" gap="2">
                      <Flex justify="between">
                        <Text size="2" color="gray">Expired on:</Text>
                        <Text size="2" color="red">{formatDate(sub.expiresAt)}</Text>
                      </Flex>
                      
                      <Flex justify="between">
                        <Text size="2" color="gray">Duration:</Text>
                        <Text size="2">{formatDuration(sub.duration)}</Text>
                      </Flex>
                      
                      <Flex justify="between">
                        <Text size="2" color="gray">Price Paid:</Text>
                        <Text size="2">{formatPrice(sub.price)}</Text>
                      </Flex>
                    </Flex>

                    {/* Renew Button */}
                    <Button
                      size="2"
                      variant="soft"
                      onClick={browseMoreSubscriptions}
                    >
                      Renew Subscription
                    </Button>
                  </Flex>
                </Card>
              ))}
            </Grid>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
}

export default MySubscriptions;