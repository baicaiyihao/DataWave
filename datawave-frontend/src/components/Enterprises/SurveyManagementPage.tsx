// Survey Management Page - Router Version
// 问卷综合管理页面 - 完整功能版本
// 集成订阅服务和订阅者列表显示

import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Badge, Button, Tabs, Dialog, TextField, ScrollArea } from '@radix-ui/themes';
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useParams, useNavigate } from 'react-router-dom';
import { Transaction } from '@mysten/sui/transactions';
import { ConfigService } from '../../services/config';
import { 
  Settings,
  Users,
  DollarSign,
  Shield,
  Plus,
  Minus,
  Copy,
  ExternalLink,
  CheckCircle,
  Gift,
  UserPlus,
  UserMinus,
  Key,
  Eye,
  RefreshCw,
  Share2,
  AlertCircle,
  Clock,
  TrendingUp,
  User,
  Calendar,
  CreditCard,
  ArrowLeft
} from 'lucide-react';

// Import the decryption component
import { SurveyDecryption } from './SurveyDecryption';

interface SurveyDetails {
  id: string;
  capId?: string;
  title: string;
  description: string;
  category: string;
  questions: any[];
  rewardPerResponse: string;
  maxResponses: string;
  currentResponses: string;
  isActive: boolean;
  createdAt: string;
  creator: string;
  // Allowlist
  allowlist: string[];
  // Subscription service (improved)
  subscriptionServiceId?: string;  // Now from Survey struct
  hasSubscription?: boolean;
  subscriptionService?: {
    serviceId: string;
    price: number;
    duration: number;
    totalRevenue: number;
    subscribers: SubscriberInfo[];  // Changed from count to list
  };
  // Consenting users
  consentingUsers: string[];
  consentingUsersCount: number;
}

interface SubscriberInfo {
  address: string;
  subscriptionId: string;
  createdAt: number;
  expiresAt: number;
  isExpired: boolean;
}

export function SurveyManagementPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const packageId = ConfigService.getPackageId();
  
  const [survey, setSurvey] = useState<SurveyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  
  // Subscription management
  const [showCreateSubscription, setShowCreateSubscription] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState('');
  const [subscriptionDuration, setSubscriptionDuration] = useState('');
  const [creatingSubscription, setCreatingSubscription] = useState(false);
  const [showSubscribers, setShowSubscribers] = useState(false);
  
  // Allowlist management
  const [showAddToAllowlist, setShowAddToAllowlist] = useState(false);
  const [newAllowlistAddress, setNewAllowlistAddress] = useState('');
  const [addingToAllowlist, setAddingToAllowlist] = useState(false);
  const [removingFromAllowlist, setRemovingFromAllowlist] = useState<string | null>(null);
  
  // Error handling
  const [error, setError] = useState<string | null>(null);
  
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

  // Navigation functions
  const viewSurveyDetails = () => {
    navigate(`/survey/${surveyId}`);
  };

  const backToMySurveys = () => {
    navigate('/enterprise/surveys');
  };
  
  // Load survey details - 完整保留所有功能
  const loadSurveyDetails = async () => {
    if (!surveyId || !currentAccount?.address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get survey object
      const surveyObj = await suiClient.getObject({
        id: surveyId,
        options: { showContent: true }
      });
      
      if (!surveyObj.data?.content || !('fields' in surveyObj.data.content)) {
        throw new Error('Invalid survey object');
      }
      
      const fields = surveyObj.data.content.fields as any;
      
      // Parse questions
      const questions = fields.questions?.map((q: any) => ({
        question_text: q.fields?.question_text || q.question_text || '',
        question_type: parseInt(q.fields?.question_type || q.question_type || '0'),
        options: q.fields?.options || q.options || []
      })) || [];
      
      // Parse allowlist
      let allowlistData: string[] = [];
      if (fields.allowlist?.fields?.contents) {
        allowlistData = fields.allowlist.fields.contents;
      } else if (Array.isArray(fields.allowlist)) {
        allowlistData = fields.allowlist;
      }
      
      // Find SurveyCap
      let capId = undefined;
      let isOwner = false;
      
      try {
        // Query user's SurveyCap objects
        const capObjects = await suiClient.getOwnedObjects({
          owner: currentAccount.address,
          filter: {
            StructType: `${packageId}::survey_system::SurveyCap`,
          },
          options: { showContent: true }
        });
        
        console.log('Found SurveyCaps:', capObjects.data.length);
        
        // Find matching cap for this survey
        for (const cap of capObjects.data) {
          if (cap.data?.content && 'fields' in cap.data.content) {
            const capFields = cap.data.content.fields as any;
            if (capFields.survey_id === surveyId) {
              capId = cap.data.objectId;
              isOwner = true;
              console.log('Found matching SurveyCap:', capId);
              
              // Save to localStorage as backup
              localStorage.setItem(`survey_${surveyId}`, JSON.stringify({
                capId: capId,
                creator: currentAccount.address,
                timestamp: Date.now()
              }));
              break;
            }
          }
        }
        
        // If no cap found, check localStorage
        if (!capId) {
          const localData = localStorage.getItem(`survey_${surveyId}`);
          if (localData) {
            const parsed = JSON.parse(localData);
            if (parsed.creator === currentAccount.address) {
              capId = parsed.capId;
              console.log('Using cap from localStorage:', capId);
              
              // Validate cap still exists
              try {
                const capObj = await suiClient.getObject({
                  id: capId,
                  options: { showContent: true }
                });
                
                if (capObj.data?.content && 'fields' in capObj.data.content) {
                  const capFields = capObj.data.content.fields as any;
                  if (capFields.survey_id === surveyId) {
                    isOwner = true;
                  } else {
                    localStorage.removeItem(`survey_${surveyId}`);
                    capId = undefined;
                  }
                }
              } catch (error) {
                console.error('Error validating cap from localStorage:', error);
                localStorage.removeItem(`survey_${surveyId}`);
                capId = undefined;
              }
            }
          }
        }
        
        // Check if user is creator
        if (fields.creator === currentAccount.address) {
          isOwner = true;
          if (!capId) {
            console.warn('User is creator but SurveyCap not found. Some functions may be limited.');
          }
        }
      } catch (error) {
        console.error('Error searching for SurveyCap:', error);
      }
      
      // If not owner, show error
      if (!isOwner) {
        setError('You are not the owner of this survey');
        setLoading(false);
        return;
      }
      
      // Build survey details
      const surveyDetails: SurveyDetails = {
        id: surveyId,
        capId,
        title: fields.title || '',
        description: fields.description || '',
        category: fields.category || '',
        questions,
        rewardPerResponse: fields.reward_per_response || '0',
        maxResponses: fields.max_responses || '0',
        currentResponses: fields.current_responses || '0',
        isActive: fields.is_active || false,
        createdAt: fields.created_at || '0',
        creator: fields.creator || '',
        allowlist: allowlistData,
        consentingUsers: fields.consenting_users || [],
        consentingUsersCount: parseInt(fields.consenting_users_count || '0'),
        subscriptionServiceId: fields.subscription_service_id  // Get from Survey struct
      };
      
      // Check for subscription service using the ID from Survey
      if (surveyDetails.subscriptionServiceId) {
        console.log('Survey has subscription service:', surveyDetails.subscriptionServiceId);
        
        try {
          // Get the subscription service object directly
          const serviceObj = await suiClient.getObject({
            id: surveyDetails.subscriptionServiceId,
            options: { showContent: true }
          });
          
          if (serviceObj.data?.content && 'fields' in serviceObj.data.content) {
            const serviceFields = serviceObj.data.content.fields as any;
            
            // Get subscribers from the service
            const subscribers: SubscriberInfo[] = [];
            
            // Query subscription events to get subscriber details
            const subscriptionEvents = await suiClient.queryEvents({
              query: {
                MoveEventType: `${packageId}::survey_system::SubscriptionPurchased`,
              },
              limit: 100,
            });
            
            // Filter events for this survey and get subscription details
            const currentTime = Date.now();
            for (const event of subscriptionEvents.data) {
              if (event.parsedJson?.survey_id === surveyId) {
                const eventData = event.parsedJson;
                
                // Try to get the actual subscription object if possible
                // For now, we'll use event data
                subscribers.push({
                  address: eventData.subscriber,
                  subscriptionId: event.id?.txDigest || 'Unknown',
                  createdAt: parseInt(event.timestampMs || '0'),
                  expiresAt: parseInt(eventData.expires_at || '0'),
                  isExpired: parseInt(eventData.expires_at || '0') < currentTime
                });
              }
            }
            
            surveyDetails.hasSubscription = true;
            surveyDetails.subscriptionService = {
              serviceId: surveyDetails.subscriptionServiceId,
              price: parseInt(serviceFields.price || '0'),
              duration: parseInt(serviceFields.duration_ms || '0'),
              totalRevenue: parseInt(serviceFields.total_revenue || '0'),
              subscribers: subscribers
            };
          }
        } catch (error) {
          console.error('Error loading subscription service:', error);
        }
      }
      
      setSurvey(surveyDetails);
    } catch (error: any) {
      console.error('Error loading survey:', error);
      setError(error.message || 'Failed to load survey');
    } finally {
      setLoading(false);
    }
  };
  
  // Create subscription service - 完整功能
  const createSubscriptionService = () => {
    if (!survey?.capId || !subscriptionPrice || !subscriptionDuration) {
      if (!survey?.capId) {
        alert('SurveyCap not found. Please ensure you have the management capability for this survey.');
      } else {
        alert('Missing required information');
      }
      return;
    }
    
    setCreatingSubscription(true);
    const priceInMist = parseInt(subscriptionPrice);
    const durationMs = parseInt(subscriptionDuration) * 60 * 60 * 1000;
    
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::survey_system::create_subscription_service_entry`,
      arguments: [
        tx.object(survey.id),
        tx.object(survey.capId),
        tx.pure.u64(priceInMist),
        tx.pure.u64(durationMs),
      ],
    });
    
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async (result) => {
          console.log('Transaction result:', result);
          
          // The service ID should now be stored in the Survey object
          alert('Subscription service created successfully!');
          setShowCreateSubscription(false);
          setSubscriptionPrice('');
          setSubscriptionDuration('');
          
          // Reload to get the updated survey with subscription_service_id
          setTimeout(() => {
            loadSurveyDetails();
          }, 2000);
        },
        onError: (error) => {
          alert(`Error: ${error.message}`);
        },
        onSettled: () => {
          setCreatingSubscription(false);
        }
      },
    );
  };
  
  // Add address to allowlist - 完整功能
  const addToAllowlist = () => {
    if (!survey?.capId || !newAllowlistAddress) {
      if (!survey?.capId) {
        alert('SurveyCap not found. Cannot modify allowlist without management capability.');
      } else {
        alert('Please enter an address');
      }
      return;
    }
    
    // Validate address format
    if (!newAllowlistAddress.startsWith('0x') || newAllowlistAddress.length !== 66) {
      alert('Invalid Sui address format');
      return;
    }
    
    if (survey.allowlist.includes(newAllowlistAddress)) {
      alert('Address already in allowlist');
      return;
    }
    
    setAddingToAllowlist(true);
    
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::survey_system::add_to_allowlist`,
      arguments: [
        tx.object(survey.id),
        tx.object(survey.capId),
        tx.pure.address(newAllowlistAddress),
      ],
    });
    
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          alert('Address added to allowlist');
          setShowAddToAllowlist(false);
          setNewAllowlistAddress('');
          loadSurveyDetails();
        },
        onError: (error) => {
          alert(`Error: ${error.message}`);
        },
        onSettled: () => {
          setAddingToAllowlist(false);
        }
      },
    );
  };
  
  // Remove address from allowlist - 完整功能
  const removeFromAllowlist = (address: string) => {
    if (!survey?.capId) {
      alert('SurveyCap not found. Cannot modify allowlist without management capability.');
      return;
    }
    
    if (address === survey.creator) {
      alert('Cannot remove survey creator from allowlist');
      return;
    }
    
    setRemovingFromAllowlist(address);
    
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::survey_system::remove_from_allowlist`,
      arguments: [
        tx.object(survey.id),
        tx.object(survey.capId),
        tx.pure.address(address),
      ],
    });
    
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          alert('Address removed from allowlist');
          loadSurveyDetails();
        },
        onError: (error) => {
          alert(`Error: ${error.message}`);
        },
        onSettled: () => {
          setRemovingFromAllowlist(null);
        }
      },
    );
  };
  
  // Initial load
  useEffect(() => {
    loadSurveyDetails();
  }, [surveyId, currentAccount?.address]);
  
  // Helper functions - 完整保留
  const formatSUI = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseInt(amount) : amount;
    return (value / 1000000000).toFixed(4);
  };
  
  const formatDuration = (ms: number) => {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) return `${hours} hours`;
    return `${Math.floor(hours / 24)} days`;
  };
  
  const formatDate = (timestamp: string | number) => {
    const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    return new Date(ts).toLocaleString();
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };
  
  const shareSubscriptionLink = () => {
    if (!survey?.subscriptionService) return;
    const link = `${window.location.origin}/#/marketplace/subscription/${survey.subscriptionService.serviceId}`;
    copyToClipboard(link);
  };
  
  // 以下是完整的UI渲染部分

  if (loading) {
    return (
      <Card>
        <Flex justify="center" align="center" py="5">
          <Text>Loading survey...</Text>
        </Flex>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="3" py="5">
          <AlertCircle size={48} color="red" />
          <Text size="4" color="red">{error}</Text>
          <Button onClick={backToMySurveys} variant="soft">
            <ArrowLeft size={16} />
            Back to My Surveys
          </Button>
        </Flex>
      </Card>
    );
  }
  
  if (!survey) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="3" py="5">
          <Text>Survey not found</Text>
          <Button onClick={backToMySurveys} variant="soft">
            <ArrowLeft size={16} />
            Back to My Surveys
          </Button>
        </Flex>
      </Card>
    );
  }
  
  return (
    <Flex direction="column" gap="3">
      {/* Header - 完整保留 */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <Flex direction="column" gap="1">
              <Flex align="center" gap="2">
                <Text size="5" weight="bold">{survey.title}</Text>
                <Badge color={survey.isActive ? 'green' : 'gray'}>
                  {survey.isActive ? 'Active' : 'Closed'}
                </Badge>
                {survey.hasSubscription && (
                  <Badge color="purple">Has Subscription</Badge>
                )}
                {!survey.capId && (
                  <Badge color="orange">Limited Access</Badge>
                )}
              </Flex>
              <Text size="2" color="gray">{survey.description}</Text>
            </Flex>
            
            <Flex gap="2">
              <Button
                variant="soft"
                onClick={backToMySurveys}
              >
                <ArrowLeft size={16} />
                Back
              </Button>
              <Button
                variant="soft"
                onClick={() => {
                  setRefreshing(true);
                  loadSurveyDetails().finally(() => setRefreshing(false));
                }}
                disabled={refreshing}
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </Button>
              <Button
                variant="soft"
                onClick={viewSurveyDetails}
              >
                <Eye size={16} />
                View Details
              </Button>
              <Button
                variant="soft"
                onClick={() => window.open(`https://suiscan.xyz/testnet/object/${survey.id}`, '_blank')}
              >
                <ExternalLink size={16} />
                Explorer
              </Button>
            </Flex>
          </Flex>
          
          {/* Warning if no cap found */}
          {!survey.capId && (
            <Card style={{ backgroundColor: 'var(--yellow-1)', borderColor: 'var(--yellow-6)' }}>
              <Flex align="center" gap="2">
                <AlertCircle size={16} color="orange" />
                <Text size="2" color="orange">
                  SurveyCap not found. Some management functions may be limited. 
                  Make sure you're using the wallet that created this survey.
                </Text>
              </Flex>
            </Card>
          )}
          
          {/* Stats - 完整保留所有统计卡片 */}
          <Flex gap="3" wrap="wrap">
            <Card style={{ backgroundColor: 'var(--blue-1)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Responses</Text>
                <Text size="3" weight="bold">
                  {survey.currentResponses} / {survey.maxResponses}
                </Text>
              </Flex>
            </Card>
            
            <Card style={{ backgroundColor: 'var(--green-1)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Reward per Response</Text>
                <Text size="3" weight="bold">{formatSUI(survey.rewardPerResponse)} SUI</Text>
              </Flex>
            </Card>
            
            <Card style={{ backgroundColor: 'var(--purple-1)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Allowlist Size</Text>
                <Text size="3" weight="bold">{survey.allowlist.length} addresses</Text>
              </Flex>
            </Card>
            
            <Card style={{ backgroundColor: 'var(--orange-1)' }}>
              <Flex direction="column" gap="1">
                <Text size="1" color="gray">Consenting Users</Text>
                <Text size="3" weight="bold">{survey.consentingUsersCount}</Text>
              </Flex>
            </Card>
            
            {survey.hasSubscription && survey.subscriptionService && (
              <>
                <Card style={{ backgroundColor: 'var(--cyan-1)' }}>
                  <Flex direction="column" gap="1">
                    <Text size="1" color="gray">Subscription Revenue</Text>
                    <Text size="3" weight="bold">
                      {formatSUI(survey.subscriptionService.totalRevenue)} SUI
                    </Text>
                  </Flex>
                </Card>
                
                <Card style={{ backgroundColor: 'var(--indigo-1)' }}>
                  <Flex direction="column" gap="1">
                    <Text size="1" color="gray">Subscribers</Text>
                    <Text size="3" weight="bold">{survey.subscriptionService.subscribers.length}</Text>
                  </Flex>
                </Card>
              </>
            )}
          </Flex>
        </Flex>
      </Card>
      
      {/* Tabs - 完整保留所有标签页内容 */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="subscription">
            Subscription Service
            {survey.subscriptionService && survey.subscriptionService.subscribers.length > 0 && (
              <Badge size="1" color="purple" style={{ marginLeft: '8px' }}>
                {survey.subscriptionService.subscribers.length}
              </Badge>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value="allowlist">
            Allowlist ({survey.allowlist.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="decrypt">
            Decrypt Answers
          </Tabs.Trigger>
        </Tabs.List>
        
        {/* Overview Tab - 完整内容 */}
        <Tabs.Content value="overview">
          <Card>
            <Flex direction="column" gap="3">
              <Text size="3" weight="bold">Survey Information</Text>
              
              <Flex direction="column" gap="2">
                <Flex justify="between">
                  <Text size="2" color="gray">Survey ID:</Text>
                  <Flex align="center" gap="2">
                    <Text size="2" style={{ fontFamily: 'monospace' }}>
                      {survey.id.slice(0, 16)}...
                    </Text>
                    <Button size="1" variant="ghost" onClick={() => copyToClipboard(survey.id)}>
                      <Copy size={14} />
                    </Button>
                  </Flex>
                </Flex>
                
                {survey.capId ? (
                  <Flex justify="between">
                    <Text size="2" color="gray">SurveyCap ID:</Text>
                    <Flex align="center" gap="2">
                      <Text size="2" style={{ fontFamily: 'monospace' }}>
                        {survey.capId.slice(0, 16)}...
                      </Text>
                      <Button size="1" variant="ghost" onClick={() => copyToClipboard(survey.capId)}>
                        <Copy size={14} />
                      </Button>
                    </Flex>
                  </Flex>
                ) : (
                  <Flex justify="between">
                    <Text size="2" color="gray">SurveyCap:</Text>
                    <Text size="2" color="orange">Not Found</Text>
                  </Flex>
                )}
                
                {survey.subscriptionServiceId && (
                  <Flex justify="between">
                    <Text size="2" color="gray">Subscription Service ID:</Text>
                    <Flex align="center" gap="2">
                      <Text size="2" style={{ fontFamily: 'monospace' }}>
                        {survey.subscriptionServiceId.slice(0, 16)}...
                      </Text>
                      <Button size="1" variant="ghost" onClick={() => copyToClipboard(survey.subscriptionServiceId)}>
                        <Copy size={14} />
                      </Button>
                    </Flex>
                  </Flex>
                )}
                
                <Flex justify="between">
                  <Text size="2" color="gray">Category:</Text>
                  <Badge>{survey.category}</Badge>
                </Flex>
                
                <Flex justify="between">
                  <Text size="2" color="gray">Created:</Text>
                  <Text size="2">{formatDate(survey.createdAt)}</Text>
                </Flex>
                
                <Flex justify="between">
                  <Text size="2" color="gray">Questions:</Text>
                  <Text size="2">{survey.questions.length}</Text>
                </Flex>
                
                <Flex justify="between">
                  <Text size="2" color="gray">Creator:</Text>
                  <Flex align="center" gap="2">
                    <Text size="2" style={{ fontFamily: 'monospace' }}>
                      {survey.creator.slice(0, 6)}...{survey.creator.slice(-4)}
                    </Text>
                    {survey.creator === currentAccount?.address && (
                      <Badge size="1" color="green">You</Badge>
                    )}
                  </Flex>
                </Flex>
              </Flex>
              
              <Card style={{ backgroundColor: 'var(--gray-1)' }}>
                <Flex direction="column" gap="2">
                  <Text size="2" weight="bold">Financial Summary</Text>
                  <Flex justify="between">
                    <Text size="2" color="gray">Total Reward Pool:</Text>
                    <Text size="2" weight="bold">
                      {formatSUI((parseInt(survey.rewardPerResponse) * parseInt(survey.maxResponses)).toString())} SUI
                    </Text>
                  </Flex>
                  <Flex justify="between">
                    <Text size="2" color="gray">Distributed:</Text>
                    <Text size="2" weight="bold" color="green">
                      {formatSUI((parseInt(survey.rewardPerResponse) * parseInt(survey.currentResponses)).toString())} SUI
                    </Text>
                  </Flex>
                  <Flex justify="between">
                    <Text size="2" color="gray">Remaining:</Text>
                    <Text size="2" weight="bold" color="blue">
                      {formatSUI((parseInt(survey.rewardPerResponse) * 
                        (parseInt(survey.maxResponses) - parseInt(survey.currentResponses))).toString())} SUI
                    </Text>
                  </Flex>
                </Flex>
              </Card>
            </Flex>
          </Card>
        </Tabs.Content>
        
        {/* Subscription Tab - 完整内容（续） */}
        <Tabs.Content value="subscription">
          <Card>
            <Flex direction="column" gap="3">
              <Flex justify="between" align="center">
                <Text size="3" weight="bold">Subscription Service</Text>
                {!survey.hasSubscription && survey.capId && (
                  <Button onClick={() => setShowCreateSubscription(true)}>
                    <Gift size={16} />
                    Create Subscription
                  </Button>
                )}
                {survey.hasSubscription && survey.subscriptionService && (
                  <Flex gap="2">
                    <Button 
                      variant="soft"
                      onClick={() => setShowSubscribers(true)}
                      disabled={survey.subscriptionService.subscribers.length === 0}
                    >
                      <Users size={16} />
                      View Subscribers ({survey.subscriptionService.subscribers.length})
                    </Button>
                    <Button variant="soft" onClick={shareSubscriptionLink}>
                      <Share2 size={16} />
                      Share Link
                    </Button>
                    <Button 
                      variant="soft" 
                      color="green"
                      onClick={() => window.open(`https://suiscan.xyz/testnet/object/${survey.subscriptionService!.serviceId}`, '_blank')}
                    >
                      <ExternalLink size={16} />
                      View on Chain
                    </Button>
                  </Flex>
                )}
              </Flex>
              
              {survey.hasSubscription && survey.subscriptionService ? (
                <Flex direction="column" gap="3">
                  {/* Service Overview Cards */}
                  <Flex gap="3" wrap="wrap">
                    <Card style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--purple-2)' }}>
                      <Flex direction="column" gap="1">
                        <Flex align="center" gap="1">
                          <DollarSign size={14} />
                          <Text size="1" color="gray">Price</Text>
                        </Flex>
                        <Text size="3" weight="bold">
                          {formatSUI(survey.subscriptionService.price)} SUI
                        </Text>
                      </Flex>
                    </Card>
                    
                    <Card style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--blue-2)' }}>
                      <Flex direction="column" gap="1">
                        <Flex align="center" gap="1">
                          <Clock size={14} />
                          <Text size="1" color="gray">Duration</Text>
                        </Flex>
                        <Text size="3" weight="bold">
                          {formatDuration(survey.subscriptionService.duration)}
                        </Text>
                      </Flex>
                    </Card>
                    
                    <Card style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--green-2)' }}>
                      <Flex direction="column" gap="1">
                        <Flex align="center" gap="1">
                          <TrendingUp size={14} />
                          <Text size="1" color="gray">Total Revenue</Text>
                        </Flex>
                        <Text size="3" weight="bold" color="green">
                          {formatSUI(survey.subscriptionService.totalRevenue)} SUI
                        </Text>
                      </Flex>
                    </Card>
                    
                    <Card style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--orange-2)' }}>
                      <Flex direction="column" gap="1">
                        <Flex align="center" gap="1">
                          <Users size={14} />
                          <Text size="1" color="gray">Active Subscribers</Text>
                        </Flex>
                        <Text size="3" weight="bold">
                          {survey.subscriptionService.subscribers.filter(s => !s.isExpired).length} / {survey.subscriptionService.subscribers.length}
                        </Text>
                      </Flex>
                    </Card>
                  </Flex>
                  
                  {/* Recent Subscribers */}
                  {survey.subscriptionService.subscribers.length > 0 && (
                    <Card style={{ backgroundColor: 'var(--purple-1)' }}>
                      <Flex direction="column" gap="2">
                        <Flex justify="between" align="center">
                          <Text size="2" weight="bold">Recent Subscribers</Text>
                          <Text size="1" color="gray">
                            {survey.subscriptionService.subscribers.filter(s => !s.isExpired).length} active
                          </Text>
                        </Flex>
                        
                        <Flex direction="column" gap="2">
                          {survey.subscriptionService.subscribers.slice(0, 3).map((subscriber, idx) => (
                            <Flex key={idx} justify="between" align="center">
                              <Flex align="center" gap="2">
                                <User size={14} />
                                <Text size="2" style={{ fontFamily: 'monospace' }}>
                                  {subscriber.address.slice(0, 6)}...{subscriber.address.slice(-4)}
                                </Text>
                                {!subscriber.isExpired ? (
                                  <Badge size="1" color="green">Active</Badge>
                                ) : (
                                  <Badge size="1" color="red">Expired</Badge>
                                )}
                              </Flex>
                              <Text size="1" color="gray">
                                Expires: {formatDate(subscriber.expiresAt)}
                              </Text>
                            </Flex>
                          ))}
                        </Flex>
                        
                        {survey.subscriptionService.subscribers.length > 3 && (
                          <Button size="1" variant="soft" onClick={() => setShowSubscribers(true)}>
                            View all {survey.subscriptionService.subscribers.length} subscribers
                          </Button>
                        )}
                      </Flex>
                    </Card>
                  )}
                  
                  {/* Share Link Card */}
                  <Card style={{ backgroundColor: 'var(--gray-1)' }}>
                    <Flex direction="column" gap="2">
                      <Text size="2" weight="bold">Subscription Link</Text>
                      <Text size="2">Share this link with potential subscribers:</Text>
                      <Card>
                        <Text size="1" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {window.location.origin}/#/marketplace/subscription/{survey.subscriptionService.serviceId}
                        </Text>
                      </Card>
                      <Button size="2" onClick={shareSubscriptionLink}>
                        <Copy size={16} />
                        Copy Link
                      </Button>
                    </Flex>
                  </Card>
                </Flex>
              ) : (
                <Card style={{ backgroundColor: 'var(--gray-1)' }}>
                  <Flex direction="column" align="center" gap="3" py="4">
                    <DollarSign size={48} color="gray" />
                    <Text size="3" weight="bold">No Subscription Service</Text>
                    <Text size="2" color="gray" align="center">
                      Create a subscription service to monetize access to survey answers.
                      Subscribers will pay to access the decrypted survey data.
                    </Text>
                    {survey.capId ? (
                      <Button size="3" onClick={() => setShowCreateSubscription(true)}>
                        <Gift size={20} />
                        Create Subscription Service
                      </Button>
                    ) : (
                      <Text size="2" color="red">
                        SurveyCap not found. Cannot create subscription service.
                      </Text>
                    )}
                  </Flex>
                </Card>
              )}
            </Flex>
          </Card>
        </Tabs.Content>
        
        {/* Allowlist Tab - 完整内容 */}
        <Tabs.Content value="allowlist">
          <Card>
            <Flex direction="column" gap="3">
              <Flex justify="between" align="center">
                <Flex direction="column" gap="1">
                  <Text size="3" weight="bold">Access Control List</Text>
                  <Text size="2" color="gray">
                    Manage who can decrypt survey answers without subscription
                  </Text>
                </Flex>
                <Button onClick={() => setShowAddToAllowlist(true)} disabled={!survey.capId}>
                  <UserPlus size={16} />
                  Add Address
                </Button>
              </Flex>
              
              {/* Allowlist management notice if no cap */}
              {!survey.capId && (
                <Card style={{ backgroundColor: 'var(--yellow-1)' }}>
                  <Flex align="center" gap="2">
                    <AlertCircle size={16} color="orange" />
                    <Text size="2" color="orange">
                      Cannot modify allowlist without SurveyCap
                    </Text>
                  </Flex>
                </Card>
              )}
              
              {/* Allowlist Stats */}
              <Flex gap="3">
                <Card style={{ flex: '1', backgroundColor: 'var(--blue-2)' }}>
                  <Flex direction="column" gap="1">
                    <Text size="1" color="gray">Total Addresses</Text>
                    <Text size="3" weight="bold">{survey.allowlist.length}</Text>
                  </Flex>
                </Card>
                
                <Card style={{ flex: '1', backgroundColor: 'var(--green-2)' }}>
                  <Flex direction="column" gap="1">
                    <Text size="1" color="gray">Creator Access</Text>
                    <Text size="3" weight="bold">Always</Text>
                  </Flex>
                </Card>
                
                <Card style={{ flex: '1', backgroundColor: 'var(--purple-2)' }}>
                  <Flex direction="column" gap="1">
                    <Text size="1" color="gray">Custom Access</Text>
                    <Text size="3" weight="bold">{Math.max(0, survey.allowlist.length - 1)}</Text>
                  </Flex>
                </Card>
              </Flex>
              
              {/* Allowlist Members */}
              <Card style={{ backgroundColor: 'var(--gray-1)' }}>
                <Flex direction="column" gap="2">
                  <Text size="2" weight="bold">Allowlist Members</Text>
                  
                  {survey.allowlist.length === 0 ? (
                    <Flex direction="column" align="center" gap="2" py="3">
                      <Shield size={32} color="gray" />
                      <Text size="2" color="gray">No addresses in allowlist</Text>
                      <Text size="1" color="gray">
                        Add addresses to grant direct access to survey answers
                      </Text>
                    </Flex>
                  ) : (
                    <Flex direction="column" gap="2">
                      {survey.allowlist.map((address, idx) => (
                        <Card key={address} style={{ backgroundColor: 'white' }}>
                          <Flex justify="between" align="center">
                            <Flex align="center" gap="2">
                              <Badge size="2" variant="soft">{idx + 1}</Badge>
                              <Flex direction="column" gap="1">
                                <Flex align="center" gap="2">
                                  <Text size="2" style={{ fontFamily: 'monospace' }}>
                                    {address.slice(0, 10)}...{address.slice(-8)}
                                  </Text>
                                  {address === survey.creator && (
                                    <Badge size="1" color="purple">Creator</Badge>
                                  )}
                                  {address === currentAccount?.address && address !== survey.creator && (
                                    <Badge size="1" color="blue">You</Badge>
                                  )}
                                </Flex>
                                {address === survey.creator && (
                                  <Text size="1" color="gray">Has permanent access as survey creator</Text>
                                )}
                              </Flex>
                            </Flex>
                            
                            <Flex gap="2">
                              <Button
                                size="2"
                                variant="ghost"
                                onClick={() => copyToClipboard(address)}
                              >
                                <Copy size={14} />
                                Copy
                              </Button>
                              {address !== survey.creator && (
                                <Button
                                  size="2"
                                  variant="soft"
                                  color="red"
                                  onClick={() => removeFromAllowlist(address)}
                                  disabled={removingFromAllowlist === address || !survey.capId}
                                >
                                  {removingFromAllowlist === address ? (
                                    <RefreshCw size={14} className="animate-spin" />
                                  ) : (
                                    <>
                                      <UserMinus size={14} />
                                      Remove
                                    </>
                                  )}
                                </Button>
                              )}
                            </Flex>
                          </Flex>
                        </Card>
                      ))}
                    </Flex>
                  )}
                </Flex>
              </Card>
            </Flex>
          </Card>
        </Tabs.Content>
        
        {/* Decrypt Tab */}
        <Tabs.Content value="decrypt">
          <SurveyDecryption surveyId={survey.id} isCreator={true} />
        </Tabs.Content>
      </Tabs.Root>
      
      {/* 所有对话框 - 完整保留 */}
      
      {/* Subscribers List Dialog */}
      <Dialog.Root open={showSubscribers} onOpenChange={setShowSubscribers}>
        <Dialog.Content style={{ maxWidth: 600 }}>
          <Dialog.Title>Subscription Subscribers</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            List of all users who have subscribed to access survey data
          </Dialog.Description>
          
          {survey?.subscriptionService && survey.subscriptionService.subscribers.length > 0 ? (
            <ScrollArea style={{ height: '400px' }}>
              <Flex direction="column" gap="2">
                {survey.subscriptionService.subscribers.map((subscriber, idx) => (
                  <Card key={idx}>
                    <Flex justify="between" align="center">
                      <Flex direction="column" gap="1">
                        <Flex align="center" gap="2">
                          <User size={16} />
                          <Text size="2" weight="bold" style={{ fontFamily: 'monospace' }}>
                            {subscriber.address}
                          </Text>
                          {!subscriber.isExpired ? (
                            <Badge color="green">Active</Badge>
                          ) : (
                            <Badge color="red">Expired</Badge>
                          )}
                        </Flex>
                        <Flex gap="3">
                          <Flex align="center" gap="1">
                            <Calendar size={12} />
                            <Text size="1" color="gray">
                              Subscribed: {formatDate(subscriber.createdAt)}
                            </Text>
                          </Flex>
                          <Flex align="center" gap="1">
                            <Clock size={12} />
                            <Text size="1" color="gray">
                              Expires: {formatDate(subscriber.expiresAt)}
                            </Text>
                          </Flex>
                        </Flex>
                      </Flex>
                      <Button
                        size="1"
                        variant="ghost"
                        onClick={() => copyToClipboard(subscriber.address)}
                      >
                        <Copy size={14} />
                      </Button>
                    </Flex>
                  </Card>
                ))}
              </Flex>
            </ScrollArea>
          ) : (
            <Text size="2" color="gray">No subscribers yet</Text>
          )}
          
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Close</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
      
      {/* Create Subscription Dialog */}
      <Dialog.Root open={showCreateSubscription} onOpenChange={setShowCreateSubscription}>
        <Dialog.Content style={{ maxWidth: 450 }}>
          <Dialog.Title>Create Subscription Service</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Set up a paid subscription for accessing survey answers
          </Dialog.Description>
          
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                Subscription Price (in MIST)
              </Text>
              <TextField.Root
                type="number"
                placeholder="e.g., 1000000000 (1 SUI)"
                value={subscriptionPrice}
                onChange={(e) => setSubscriptionPrice(e.target.value)}
              />
              <Text size="1" color="gray">1 SUI = 1,000,000,000 MIST</Text>
            </label>
            
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                Duration (in hours)
              </Text>
              <TextField.Root
                type="number"
                placeholder="e.g., 24 for 1 day, 168 for 1 week"
                value={subscriptionDuration}
                onChange={(e) => setSubscriptionDuration(e.target.value)}
              />
            </label>
            
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">Cancel</Button>
              </Dialog.Close>
              <Button
                onClick={createSubscriptionService}
                disabled={creatingSubscription || !subscriptionPrice || !subscriptionDuration}
              >
                {creatingSubscription ? 'Creating...' : 'Create Service'}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
      
      {/* Add to Allowlist Dialog */}
      <Dialog.Root open={showAddToAllowlist} onOpenChange={setShowAddToAllowlist}>
        <Dialog.Content style={{ maxWidth: 450 }}>
          <Dialog.Title>Add to Allowlist</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Add an address to grant direct access to survey answers
          </Dialog.Description>
          
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                Sui Address
              </Text>
              <TextField.Root
                placeholder="0x..."
                value={newAllowlistAddress}
                onChange={(e) => setNewAllowlistAddress(e.target.value)}
              />
              <Text size="1" color="gray">
                Must be a valid Sui address (66 characters starting with 0x)
              </Text>
            </label>
            
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">Cancel</Button>
              </Dialog.Close>
              <Button
                onClick={addToAllowlist}
                disabled={addingToAllowlist || !newAllowlistAddress}
              >
                {addingToAllowlist ? 'Adding...' : 'Add Address'}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}

export default SurveyManagementPage;