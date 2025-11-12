// DataWave - Survey Platform with Tabs
import React, { useState } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { Box, Container, Flex, Card, Text, Tabs, Button, Badge } from '@radix-ui/themes';
import { MerchantCreateSurveyOptimized } from './components/MerchantCreateSurvey';
import { ViewSurveyDetails } from './components/ViewSurveyDetails';
import { ViewAllSurveys } from './components/Viewallsurveys';
import { MySurveys } from './components/MySurveys';
import { AnswerSurveyWithSeal } from './components/AnswerSurveyWithSeal';
import { SurveyAllowlistManager } from './components/SurveyAllowlistManager';
import { ConfigService } from './services/config';
import { 
  PlusCircle, 
  Search, 
  List, 
  FileText, 
  Activity,
  Database,
  Grid
} from 'lucide-react';

function App() {
  const currentAccount = useCurrentAccount();
  const [activeTab, setActiveTab] = useState('all-surveys');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  
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
  
  // 处理管理 allowlist
  const handleManageAllowlist = (surveyId: string) => {
    setSelectedSurveyId(surveyId);
    setActiveTab('manage-allowlist');
  };
  
  // 处理从管理页面返回
  const handleBackFromManage = () => {
    setActiveTab('my-surveys');
  };
  
  // 监听创建成功后的查看详情事件
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
    
    window.addEventListener('viewSurveyDetails', handleViewSurveyEvent);
    window.addEventListener('startAnswerSurvey', handleStartAnswerEvent);
    window.addEventListener('manageSurveyAllowlist', handleManageAllowlistEvent);
    
    return () => {
      window.removeEventListener('viewSurveyDetails', handleViewSurveyEvent);
      window.removeEventListener('startAnswerSurvey', handleStartAnswerEvent);
      window.removeEventListener('manageSurveyAllowlist', handleManageAllowlistEvent);
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
          
          <Tabs.Trigger value="view-details">
            <Search size={16} style={{ marginRight: '8px' }} />
            Survey Details
          </Tabs.Trigger>
          
          <Tabs.Trigger value="answer-survey">
            <Activity size={16} style={{ marginRight: '8px' }} />
            Answer Survey
          </Tabs.Trigger>
          
          <Tabs.Trigger value="manage-allowlist">
            <Grid size={16} style={{ marginRight: '8px' }} />
            Manage Access
          </Tabs.Trigger>
          
          <Tabs.Trigger value="create">
            <PlusCircle size={16} style={{ marginRight: '8px' }} />
            Create Survey
          </Tabs.Trigger>
          
          <Tabs.Trigger value="debug">
            <Database size={16} style={{ marginRight: '8px' }} />
            Debug Info
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
          
          {/* Manage Allowlist Tab */}
          <Tabs.Content value="manage-allowlist">
            {currentAccount && selectedSurveyId ? (
              <SurveyAllowlistManager 
                surveyId={selectedSurveyId} 
                onBack={handleBackFromManage}
              />
            ) : (
              <Card>
                <Flex direction="column" align="center" gap="3" py="5">
                  <Text size="4" weight="bold">
                    {!currentAccount ? 'Connect Wallet' : 'Select a Survey'}
                  </Text>
                  <Text size="2" color="gray">
                    {!currentAccount ? 
                      'Connect your wallet to manage survey access' : 
                      'Select a survey from My Surveys to manage access'}
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
          
          {/* Debug Tab */}
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
                    <Text size="2" weight="bold">Current Survey ID</Text>
                    {selectedSurveyId ? (
                      <Text size="1" style={{ fontFamily: 'monospace' }}>
                        {selectedSurveyId}
                      </Text>
                    ) : (
                      <Text size="1" color="gray">No survey selected</Text>
                    )}
                  </Flex>
                </Card>
                
                <Card style={{ backgroundColor: 'var(--gray-2)' }}>
                  <Flex direction="column" gap="2">
                    <Text size="2" weight="bold">Local Storage Data</Text>
                    <Flex gap="2">
                      <Button 
                        size="2" 
                        variant="soft"
                        onClick={() => {
                          const surveyIndex = localStorage.getItem('survey_index');
                          if (surveyIndex) {
                            const ids = JSON.parse(surveyIndex);
                            console.log('Survey Index:', ids);
                            ids.forEach((id: string) => {
                              const data = localStorage.getItem(`survey_${id}`);
                              if (data) {
                                console.log(`Survey ${id}:`, JSON.parse(data));
                              }
                            });
                          }
                          const keys = Object.keys(localStorage);
                          console.log('All localStorage keys:', keys);
                          keys.forEach(key => {
                            console.log(`${key}:`, localStorage.getItem(key));
                          });
                          alert('Check console for localStorage data');
                        }}
                      >
                        View Storage
                      </Button>
                      <Button 
                        size="2" 
                        variant="soft" 
                        color="red"
                        onClick={() => {
                          if (confirm('Clear all localStorage data?')) {
                            localStorage.clear();
                            alert('LocalStorage cleared');
                          }
                        }}
                      >
                        Clear Storage
                      </Button>
                    </Flex>
                  </Flex>
                </Card>
                
                <Card style={{ backgroundColor: 'var(--gray-2)' }}>
                  <Flex direction="column" gap="2">
                    <Text size="2" weight="bold">Connected Account</Text>
                    {currentAccount ? (
                      <>
                        <Text size="1" style={{ fontFamily: 'monospace' }}>
                          Address: {currentAccount.address}
                        </Text>
                        <Text size="1">
                          Label: {currentAccount.label || 'N/A'}
                        </Text>
                      </>
                    ) : (
                      <Text size="1" color="gray">Not connected</Text>
                    )}
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
                        onClick={() => window.open('https://testnet.suivision.xyz', '_blank')}
                      >
                        SuiVision
                      </Button>
                      <Button
                        size="1"
                        variant="soft"
                        onClick={() => window.open('https://discord.com/invite/Sui', '_blank')}
                      >
                        Sui Discord
                      </Button>
                    </Flex>
                  </Flex>
                </Card>
              </Flex>
            </Card>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Container>
  );
}

export default App;