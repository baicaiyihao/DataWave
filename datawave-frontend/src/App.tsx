// DataWave - Survey Platform with Subscription Features
import React, { useState } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { Box, Container, Flex, Card, Text, Tabs, Button, Badge } from '@radix-ui/themes';
import { MerchantCreateSurveyOptimized } from './components/Enterprises/MerchantCreateSurvey';
import { ViewSurveyDetails } from './components/ViewSurveyDetails';
import { ViewAllSurveys } from './components/Respondents/ViewAllSurveys';
import { MySurveys } from './components/Enterprises/MySurveys';
import { AnswerSurveyWithSeal } from './components/Respondents/AnswerSurveyWithSeal';
import { SurveyDecryption } from './components/Enterprises/SurveyDecryption';
import { SurveyManagementPage } from './components/Enterprises/SurveyManagementPage';
import { MyAllowlistAccess } from './components/Shared/MyAllowlistAccess';
import { MyAnsweredSurveys } from './components/Respondents/MyAnsweredSurveys';



// 新增订阅相关组件
import { BrowseSubscriptions } from './components/Marketplace/BrowseSubscriptions';
import { MySubscriptions } from './components/Marketplace/MySubscriptions';
import { SubscriptionDecrypt } from './components/Marketplace/SubscriptionDecrypt';

import { ConfigService } from './services/config';
import { 
  PlusCircle, 
  Search, 
  List, 
  FileText, 
  Activity,
  Database,
  Grid,
  DollarSign,
  Shield,
  CreditCard,
  Eye,
  CheckCircle
} from 'lucide-react';

function App() {
  const currentAccount = useCurrentAccount();
  const [activeTab, setActiveTab] = useState('all-surveys');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  
  // 新增：订阅相关状态
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string>('');
  
  // 处理查看详情
  const handleViewDetails = (surveyId: string) => {
    setSelectedSurveyId(surveyId);
    setActiveTab('view-details');
  };
  
  // 处理返回列表
  const handleBackToList = () => {
    setActiveTab('all-surveys');
    setSelectedSurveyId('');
  };
  
  // 处理开始答题
  const handleStartAnswer = (surveyId: string) => {
    setSelectedSurveyId(surveyId);
    setActiveTab('answer-survey');
  };
  
  // 处理答题完成后返回
  const handleBackFromAnswer = () => {
    setActiveTab('view-details');
  };
  
  // 处理管理 allowlist (旧方法，保留兼容)
  const handleManageAllowlist = (surveyId: string) => {
    setSelectedSurveyId(surveyId);
    setActiveTab('manage-access');
  };
  
  // 处理管理问卷 (新方法，综合管理)
  const handleManageSurvey = (surveyId: string) => {
    setSelectedSurveyId(surveyId);
    setActiveTab('survey-management');
  };
  
  // 处理从管理页面返回
  const handleBackFromManage = () => {
    setActiveTab('my-surveys');
  };
  
  // 新增：处理查看订阅答案
  const handleViewSubscriptionAnswers = (surveyId: string, subscriptionId: string) => {
    setSelectedSurveyId(surveyId);
    setSelectedSubscriptionId(subscriptionId);
    setActiveTab('subscription-decrypt');
  };
  
  // 新增：处理从订阅解密返回
  const handleBackFromSubscriptionDecrypt = () => {
    setActiveTab('my-subscriptions');
    setSelectedSurveyId('');
    setSelectedSubscriptionId('');
  };
  
  // 监听事件
  React.useEffect(() => {
    const handleViewSurveyEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.surveyId) {
        handleViewDetails(customEvent.detail.surveyId);
      }
    };
    
    const handleStartAnswerEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.surveyId) {
        handleStartAnswer(customEvent.detail.surveyId);
      }
    };
    
    const handleManageAllowlistEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.surveyId) {
        handleManageAllowlist(customEvent.detail.surveyId);
      }
    };
    
    const handleManageSurveyEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.surveyId) {
        handleManageSurvey(customEvent.detail.surveyId);
      }
    };
    
    // 新增：订阅相关事件监听
    const handleViewSubscriptionAnswersEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.surveyId && customEvent.detail?.subscriptionId) {
        handleViewSubscriptionAnswers(customEvent.detail.surveyId, customEvent.detail.subscriptionId);
      }
    };
    
    const handleNavigateToEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab);
      }
    };
    
    window.addEventListener('viewSurveyDetails', handleViewSurveyEvent);
    window.addEventListener('startAnswerSurvey', handleStartAnswerEvent);
    window.addEventListener('manageSurveyAllowlist', handleManageAllowlistEvent);
    window.addEventListener('manageSurvey', handleManageSurveyEvent);
    window.addEventListener('viewSubscriptionAnswers', handleViewSubscriptionAnswersEvent);
    window.addEventListener('navigateTo', handleNavigateToEvent);
    
    return () => {
      window.removeEventListener('viewSurveyDetails', handleViewSurveyEvent);
      window.removeEventListener('startAnswerSurvey', handleStartAnswerEvent);
      window.removeEventListener('manageSurveyAllowlist', handleManageAllowlistEvent);
      window.removeEventListener('manageSurvey', handleManageSurveyEvent);
      window.removeEventListener('viewSubscriptionAnswers', handleViewSubscriptionAnswersEvent);
      window.removeEventListener('navigateTo', handleNavigateToEvent);
    };
  }, []);
  
  return (
    <Container size="4">
      {/* Header */}
      <Card style={{ marginBottom: '2rem' }}>
        <Flex px="3" py="2" justify="between" align="center">
          <Flex align="center" gap="3">
            <Text size="6" weight="bold">🌊 DataWave</Text>
            <Badge size="1" color="blue">Testnet</Badge>
            <Badge size="1" color="purple">v2.0</Badge>
          </Flex>
          <Flex align="center" gap="3">
            {currentAccount && (
              <Text size="2" color="gray">
                {currentAccount.address.slice(0, 6)}...{currentAccount.address.slice(-4)}
              </Text>
            )}
            <ConnectButton />
          </Flex>
        </Flex>
      </Card>
      
      {/* Main Content */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List size="2">
          <Tabs.Trigger value="all-surveys">
            <Grid size={16} style={{ marginRight: '8px' }} />
            All Surveys
          </Tabs.Trigger>
          
          <Tabs.Trigger value="my-surveys">
            <FileText size={16} style={{ marginRight: '8px' }} />
            My Surveys
          </Tabs.Trigger>
          
          {/* 新增：订阅市场 */}
          <Tabs.Trigger value="browse-subscriptions">
            <DollarSign size={16} style={{ marginRight: '8px' }} />
            Market
          </Tabs.Trigger>
          
          {/* 新增：我的订阅 */}
          <Tabs.Trigger value="my-subscriptions">
            <CreditCard size={16} style={{ marginRight: '8px' }} />
            My Subs
          </Tabs.Trigger>
          
          <Tabs.Trigger value="view-details">
            <Search size={16} style={{ marginRight: '8px' }} />
            Details
          </Tabs.Trigger>
          
          <Tabs.Trigger value="answer-survey">
            <Activity size={16} style={{ marginRight: '8px' }} />
            Answer
          </Tabs.Trigger>

          <Tabs.Trigger value="my-answers">
            <CheckCircle size={16} style={{ marginRight: '8px' }} />
            My Answers
          </Tabs.Trigger>

          <Tabs.Trigger value="allowlist-access">
            <Shield size={16} style={{ marginRight: '8px' }} />
            Allowlist
          </Tabs.Trigger>
          
          <Tabs.Trigger value="survey-management">
            <Shield size={16} style={{ marginRight: '8px' }} />
            Management
          </Tabs.Trigger>
          
          <Tabs.Trigger value="manage-access">
            <Grid size={16} style={{ marginRight: '8px' }} />
            Decrypt
          </Tabs.Trigger>
          
          <Tabs.Trigger value="create">
            <PlusCircle size={16} style={{ marginRight: '8px' }} />
            Create
          </Tabs.Trigger>
          
          <Tabs.Trigger value="debug">
            <Database size={16} style={{ marginRight: '8px' }} />
            Debug
          </Tabs.Trigger>
        </Tabs.List>
        
        <Box style={{ marginTop: '2rem' }}>
          {/* All Surveys Tab */}
          <Tabs.Content value="all-surveys">
            <ViewAllSurveys onViewDetails={handleViewDetails} />
          </Tabs.Content>
          
          {/* My Surveys Tab */}
          <Tabs.Content value="my-surveys">
            <MySurveys />
          </Tabs.Content>
          
          {/* 新增：订阅市场 Tab */}
          <Tabs.Content value="browse-subscriptions">
            <BrowseSubscriptions />
          </Tabs.Content>
          
          {/* 新增：我的订阅 Tab */}
          <Tabs.Content value="my-subscriptions">
            <MySubscriptions />
          </Tabs.Content>
          
          {/* 新增：订阅解密 Tab (动态) */}
          <Tabs.Content value="subscription-decrypt">
            {currentAccount && selectedSurveyId && selectedSubscriptionId ? (
              <Card>
                <Flex direction="column" gap="3">
                  <Flex justify="between" align="center">
                    <Text size="5" weight="bold">Subscription Data Access</Text>
                    <Button 
                      variant="soft"
                      onClick={handleBackFromSubscriptionDecrypt}
                    >
                      Back to My Subscriptions
                    </Button>
                  </Flex>
                  
                  <SubscriptionDecrypt 
                    surveyId={selectedSurveyId}
                    subscriptionId={selectedSubscriptionId}
                  />
                </Flex>
              </Card>
            ) : (
              <Card>
                <Flex direction="column" align="center" gap="3" py="5">
                  <Text size="4" weight="bold">No Subscription Selected</Text>
                  <Text size="2" color="gray">
                    Please select a subscription from My Subscriptions to view data
                  </Text>
                  <Button onClick={() => setActiveTab('my-subscriptions')}>
                    Go to My Subscriptions
                  </Button>
                </Flex>
              </Card>
            )}
          </Tabs.Content>
          
          {/* View Survey Details Tab */}
          <Tabs.Content value="view-details">
            <ViewSurveyDetails 
              surveyId={selectedSurveyId} 
              onBack={handleBackToList}
            />
          </Tabs.Content>
          
          {/* Answer Survey Tab */}
          <Tabs.Content value="answer-survey">
            {currentAccount && selectedSurveyId ? (
              <AnswerSurveyWithSeal 
                surveyId={selectedSurveyId} 
                onBack={handleBackFromAnswer}
              />
            ) : (
              <Card>
                <Flex direction="column" align="center" gap="3" py="5">
                  <Text size="4" weight="bold">
                    {!currentAccount ? 'Connect Wallet to Answer Survey' : 'Select a Survey'}
                  </Text>
                  <Text size="2" color="gray">
                    {!currentAccount ? 
                      'You need to connect your wallet to answer surveys' : 
                      'Please select a survey from the list to answer'}
                  </Text>
                  {!currentAccount && <ConnectButton />}
                </Flex>
              </Card>
            )}
          </Tabs.Content>
          
          {/* Survey Management Tab - 使用新的管理页面组件 */}
          <Tabs.Content value="survey-management">
            {currentAccount && selectedSurveyId ? (
              <SurveyManagementPage surveyId={selectedSurveyId} />
            ) : (
              <Card>
                <Flex direction="column" align="center" gap="3" py="5">
                  <Text size="4" weight="bold">
                    {!currentAccount ? 'Connect Wallet' : 'Select a Survey'}
                  </Text>
                  <Text size="2" color="gray">
                    {!currentAccount ? 
                      'Connect your wallet to manage surveys' : 
                      'Select a survey from My Surveys to manage'}
                  </Text>
                  {!currentAccount && <ConnectButton />}
                </Flex>
              </Card>
            )}
          </Tabs.Content>
          
          {/* Manage Access Tab - 保留原有的解密功能 */}
          <Tabs.Content value="manage-access">
            {currentAccount && selectedSurveyId ? (
              <SurveyDecryption 
                surveyId={selectedSurveyId} 
                isCreator={true}
              />
            ) : (
              <Card>
                <Flex direction="column" align="center" gap="3" py="5">
                  <Text size="4" weight="bold">
                    {!currentAccount ? 'Connect Wallet' : 'Select a Survey'}
                  </Text>
                  <Text size="2" color="gray">
                    {!currentAccount ? 
                      'Connect your wallet to decrypt answers' : 
                      'Select a survey to decrypt answers'}
                  </Text>
                  {!currentAccount && <ConnectButton />}
                </Flex>
              </Card>
            )}
          </Tabs.Content>
          
          {/* Create Survey Tab */}
          <Tabs.Content value="create">
            {currentAccount ? (
              <MerchantCreateSurveyOptimized />
            ) : (
              <Card>
                <Flex direction="column" align="center" gap="3" py="5">
                  <Text size="4" weight="bold">Connect Wallet to Create Survey</Text>
                  <Text size="2" color="gray">You need to connect your wallet to create a survey</Text>
                  <ConnectButton />
                </Flex>
              </Card>
            )}
          </Tabs.Content>
          
          {/* Debug Tab - 添加订阅相关调试信息 */}
          <Tabs.Content value="debug">
            <Card>
              <Flex direction="column" gap="3">
                <Text size="4" weight="bold">Debug Information</Text>
                
                <Card style={{ backgroundColor: 'var(--gray-2)' }}>
                  <Flex direction="column" gap="2">
                    <Text size="2" weight="bold">Contract Addresses</Text>
                    <Text size="1" style={{ fontFamily: 'monospace' }}>
                      Package ID: {ConfigService.getPackageId()}
                    </Text>
                    <Text size="1" style={{ fontFamily: 'monospace' }}>
                      Registry: {ConfigService.getSurveyRegistryId()}
                    </Text>
                    <Text size="1" style={{ fontFamily: 'monospace' }}>
                      Treasury: {ConfigService.getPlatformTreasuryId()}
                    </Text>
                  </Flex>
                </Card>
                
                <Card style={{ backgroundColor: 'var(--gray-2)' }}>
                  <Flex direction="column" gap="2">
                    <Text size="2" weight="bold">Current Selection</Text>
                    {selectedSurveyId ? (
                      <Text size="1" style={{ fontFamily: 'monospace' }}>
                        Survey: {selectedSurveyId}
                      </Text>
                    ) : (
                      <Text size="1" color="gray">No survey selected</Text>
                    )}
                    {selectedSubscriptionId ? (
                      <Text size="1" style={{ fontFamily: 'monospace' }}>
                        Subscription: {selectedSubscriptionId}
                      </Text>
                    ) : (
                      <Text size="1" color="gray">No subscription selected</Text>
                    )}
                  </Flex>
                </Card>
                
                <Card style={{ backgroundColor: 'var(--gray-2)' }}>
                  <Flex direction="column" gap="2">
                    <Text size="2" weight="bold">Features</Text>
                    <Flex gap="2" wrap="wrap">
                      <Badge color="green">✓ Subscription Services</Badge>
                      <Badge color="green">✓ Access Control</Badge>
                      <Badge color="green">✓ Encrypted Answers</Badge>
                      <Badge color="green">✓ Revenue Sharing</Badge>
                      <Badge color="blue">✓ Seal Integration</Badge>
                      <Badge color="purple">✓ Walrus Storage</Badge>
                      <Badge color="orange">✓ Subscription Market</Badge>
                      <Badge color="cyan">✓ Subscription Management</Badge>
                    </Flex>
                  </Flex>
                </Card>
                
                <Card style={{ backgroundColor: 'var(--gray-2)' }}>
                  <Flex direction="column" gap="2">
                    <Text size="2" weight="bold">Quick Links</Text>
                    <Flex gap="2" wrap="wrap">
                      <Button
                        size="1"
                        variant="soft"
                        onClick={() => window.open('https://suiscan.xyz/testnet', '_blank')}
                      >
                        Sui Explorer
                      </Button>
                      <Button
                        size="1"
                        variant="soft"
                        onClick={() => {
                          const keys = Object.keys(localStorage);
                          console.log('LocalStorage:', keys);
                          alert(`Found ${keys.length} items in localStorage`);
                        }}
                      >
                        Check Storage
                      </Button>
                      <Button
                        size="1"
                        variant="soft"
                        color="red"
                        onClick={() => {
                          if (confirm('Clear all localStorage?')) {
                            localStorage.clear();
                            alert('Storage cleared');
                          }
                        }}
                      >
                        Clear Storage
                      </Button>
                      <Button
                        size="1"
                        variant="soft"
                        onClick={() => setActiveTab('browse-subscriptions')}
                      >
                        Go to Market
                      </Button>
                      <Button
                        size="1"
                        variant="soft"
                        onClick={() => setActiveTab('my-subscriptions')}
                      >
                        My Subscriptions
                      </Button>
                    </Flex>
                  </Flex>
                </Card>
              </Flex>
            </Card>
          </Tabs.Content>
          <Tabs.Content value="allowlist-access">
            <MyAllowlistAccess />
          </Tabs.Content>

          <Tabs.Content value="my-answers">
            <MyAnsweredSurveys />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Container>
  );
}

export default App;