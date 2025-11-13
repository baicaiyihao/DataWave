// Subscription Decrypt Page with Seal Integration
// 订阅后查看解密的问卷答案 - 完整实现

import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Badge, Button, Dialog, AlertDialog, Spinner } from '@radix-ui/themes';
import { useSuiClient, useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import { SealClient, SessionKey, EncryptedObject, NoAccessError } from '@mysten/seal';
import { ConfigService } from '../../services/config';
import { 
  Lock,
  Unlock,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  FileText,
  Users,
  Calendar,
  Clock,
  Key,
  Eye
} from 'lucide-react';
import { set, get } from 'idb-keyval';

const TTL_MIN = 10;

interface AnswerBlob {
  respondent: string;
  blobId: string;
  sealKeyId: string;
  submittedAt: number;
  consentForSubscription: boolean;
}

interface DecryptedAnswer {
  surveyId: string;
  respondent: string;
  timestamp: number;
  answers: {
    questionIndex: number;
    questionText: string;
    questionType: number;
    answer: string | string[];
  }[];
  consent: boolean;
}

interface SurveyInfo {
  id: string;
  title: string;
  description: string;
  category: string;
  questions: any[];
  responseCount: number;
  maxResponses: number;
  consentingUsers: number;
}

interface SubscriptionInfo {
  id: string;
  serviceId: string;
  surveyId: string;
  expiresAt: number;
  isExpired: boolean;
  createdAt: number;
}

interface SubscriptionDecryptProps {
  surveyId: string;
  subscriptionId?: string;
}

export function SubscriptionDecrypt({ surveyId, subscriptionId }: SubscriptionDecryptProps) {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  const packageId = ConfigService.getPackageId();
  
  // Survey and subscription data
  const [surveyInfo, setSurveyInfo] = useState<SurveyInfo | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [answerBlobs, setAnswerBlobs] = useState<AnswerBlob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Session key
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  
  // Decryption state
  const [decryptingBlobId, setDecryptingBlobId] = useState<string | null>(null);
  const [decryptedAnswers, setDecryptedAnswers] = useState<Map<string, DecryptedAnswer>>(new Map());
  const [showDecryptedDialog, setShowDecryptedDialog] = useState(false);
  const [currentDecryptedAnswer, setCurrentDecryptedAnswer] = useState<DecryptedAnswer | null>(null);
  
  // Seal client configuration
  const serverObjectIds = [
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
  ];
  
  const sealClient = new SealClient({
    suiClient,
    serverConfigs: serverObjectIds.map((id) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers: false,
  });

  // Move call constructor for subscription access
  const moveCallConstructor = (tx: Transaction, id: string) => {
    if (!subscriptionInfo) {
      throw new Error('No subscription info available');
    }
    
    // 使用 seal_approve_subscription 进行订阅验证
    tx.moveCall({
    target: `${packageId}::survey_system::seal_approve_subscription`,
    arguments: [
        tx.pure.vector('u8', fromHex(id)), // 加密文件ID
        tx.object(subscriptionInfo.id), // Subscription NFT (用户的订阅)
        tx.object(subscriptionInfo.serviceId), // SubscriptionService (问卷的订阅服务)
        tx.object(surveyId), // Survey object
        tx.object('0x6'), // Clock
    ],
    });
  };

  // Load survey and subscription data
  const loadData = async () => {
    if (!currentAccount?.address || !surveyId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load survey details
      const surveyObj = await suiClient.getObject({
        id: surveyId,
        options: { showContent: true }
      });
      
      if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
        const fields = surveyObj.data.content.fields as any;
        
        const questions = fields.questions?.map((q: any) => ({
          question_text: q.fields?.question_text || q.question_text || '',
          question_type: parseInt(q.fields?.question_type || q.question_type || '0'),
          options: q.fields?.options || q.options || []
        })) || [];
        
        setSurveyInfo({
          id: surveyId,
          title: fields.title || '',
          description: fields.description || '',
          category: fields.category || '',
          questions,
          responseCount: parseInt(fields.current_responses || '0'),
          maxResponses: parseInt(fields.max_responses || '0'),
          consentingUsers: parseInt(fields.consenting_users_count || '0'),
        });
        
        // Load answer blobs - 只加载同意共享的答案
        await loadConsentedAnswerBlobs(fields);
      }
      
      // Load subscription info
      if (subscriptionId) {
        const subObj = await suiClient.getObject({
          id: subscriptionId,
          options: { showContent: true }
        });
        
        if (subObj.data?.content && 'fields' in subObj.data.content) {
          const fields = subObj.data.content.fields as any;
          const now = Date.now();
          const expiresAt = parseInt(fields.expires_at);
          
          setSubscriptionInfo({
            id: subscriptionId,
            serviceId: fields.service_id,
            surveyId: fields.survey_id,
            expiresAt,
            isExpired: expiresAt < now,
            createdAt: parseInt(fields.created_at),
          });
        }
      } else {
        // Find user's subscription for this survey
        const userSubscriptions = await suiClient.getOwnedObjects({
          owner: currentAccount.address,
          options: { showContent: true },
          filter: {
            StructType: `${packageId}::survey_system::Subscription`,
          },
        });
        
        for (const sub of userSubscriptions.data) {
          if (sub.data?.content && 'fields' in sub.data.content) {
            const fields = sub.data.content.fields as any;
            if (fields.survey_id === surveyId) {
              const now = Date.now();
              const expiresAt = parseInt(fields.expires_at);
              
              setSubscriptionInfo({
                id: sub.data.objectId,
                serviceId: fields.service_id,
                surveyId: fields.survey_id,
                expiresAt,
                isExpired: expiresAt < now,
                createdAt: parseInt(fields.created_at),
              });
              break;
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load survey data');
    } finally {
      setLoading(false);
    }
  };

  // Load only consented answer blobs
  const loadConsentedAnswerBlobs = async (surveyFields: any) => {
    const blobs: AnswerBlob[] = [];
    
    if (surveyFields.encrypted_answer_blobs?.fields?.id?.id) {
      try {
        const answersTableFields = await suiClient.getDynamicFields({
          parentId: surveyFields.encrypted_answer_blobs.fields.id.id,
        });
        
        console.log(`Found ${answersTableFields.data.length} answer records`);
        
        for (const field of answersTableFields.data) {
          const fieldData = await suiClient.getObject({
            id: field.objectId,
            options: { showContent: true }
          });
          
          if (fieldData.data?.content && 'fields' in fieldData.data.content) {
            const value = (fieldData.data.content as any).fields?.value?.fields;
            if (value && value.consent_for_subscription) {
              // 只加载同意共享的答案
              let sealKeyIdStr = value.seal_key_id;
              
              if (Array.isArray(sealKeyIdStr)) {
                sealKeyIdStr = new TextDecoder().decode(new Uint8Array(sealKeyIdStr));
              }
              
              blobs.push({
                respondent: value.respondent,
                blobId: value.blob_id,
                sealKeyId: sealKeyIdStr,
                submittedAt: parseInt(value.submitted_at),
                consentForSubscription: value.consent_for_subscription
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading answer blobs:', error);
      }
    }
    
    setAnswerBlobs(blobs);
    console.log(`Loaded ${blobs.length} consented answer blobs`);
  };

  // Create or load session key
  const handleSessionKey = async () => {
    if (!currentAccount?.address || !signPersonalMessage) {
      setError('Please connect wallet first');
      return;
    }
    
    setCreatingSession(true);
    setError(null);
    
    try {
      // Try to load existing session key
      const stored = await get('sessionKey_subscription');
      if (stored) {
        try {
          const imported = await SessionKey.import(stored, suiClient);
          if (!imported.isExpired() && imported.getAddress() === currentAccount.address) {
            setSessionKey(imported);
            console.log('Loaded existing session key');
            setCreatingSession(false);
            return;
          }
        } catch (e) {
          console.log('Stored session key expired or invalid');
        }
      }
      
      // Create new session key
      console.log('Creating new session key...');
      const newSessionKey = await SessionKey.create({
        address: currentAccount.address,
        packageId: packageId,
        ttlMin: TTL_MIN,
        suiClient,
      });
      
      signPersonalMessage(
        {
          message: newSessionKey.getPersonalMessage(),
        },
        {
          onSuccess: async (result) => {
            await newSessionKey.setPersonalMessageSignature(result.signature);
            setSessionKey(newSessionKey);
            await set('sessionKey_subscription', newSessionKey.export());
            console.log('Session key created successfully');
            setCreatingSession(false);
          },
          onError: (error) => {
            console.error('Signature failed:', error);
            setError('Failed to sign message');
            setCreatingSession(false);
          }
        }
      );
    } catch (error: any) {
      console.error('Session key error:', error);
      setError(error.message);
      setCreatingSession(false);
    }
  };

  // Download and decrypt blobs
  const downloadAndDecrypt = async (blobIds: string[]) => {
    if (!sessionKey || !subscriptionInfo) return;
    
    if (subscriptionInfo.isExpired) {
      throw new Error('Subscription has expired');
    }
    
    const aggregators = [
      'aggregator1',
      'aggregator2',
      'aggregator3',
      'aggregator4',
      'aggregator5',
      'aggregator6',
    ];
    
    // Download all files in parallel
    const downloadResults = await Promise.all(
      blobIds.map(async (blobId) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const randomAggregator = aggregators[Math.floor(Math.random() * aggregators.length)];
          const aggregatorUrl = `/${randomAggregator}/v1/blobs/${blobId}`;
          const response = await fetch(aggregatorUrl, { signal: controller.signal });
          clearTimeout(timeout);
          if (!response.ok) {
            return null;
          }
          return { blobId, data: await response.arrayBuffer() };
        } catch (err) {
          console.error(`Blob ${blobId} download failed`, err);
          return null;
        }
      }),
    );

    const validDownloads = downloadResults.filter((result): result is { blobId: string; data: ArrayBuffer } => result !== null);
    
    if (validDownloads.length === 0) {
      throw new Error('Failed to download any files');
    }

    // Fetch keys in batches
    for (let i = 0; i < validDownloads.length; i += 10) {
      const batch = validDownloads.slice(i, i + 10);
      const ids = batch.map((item) => EncryptedObject.parse(new Uint8Array(item.data)).id);
      const tx = new Transaction();
      ids.forEach((id) => moveCallConstructor(tx, id));
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
      
      try {
        await sealClient.fetchKeys({ ids, txBytes, sessionKey, threshold: 2 });
      } catch (err) {
        console.log(err);
        const errorMsg = err instanceof NoAccessError
          ? 'No subscription access'
          : 'Failed to decrypt files';
        throw new Error(errorMsg);
      }
    }

    // Decrypt files
    const decryptedData: DecryptedAnswer[] = [];
    for (const { blobId, data } of validDownloads) {
      const fullId = EncryptedObject.parse(new Uint8Array(data)).id;
      const tx = new Transaction();
      moveCallConstructor(tx, fullId);
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
      
      try {
        const decryptedFile = await sealClient.decrypt({
          data: new Uint8Array(data),
          sessionKey,
          txBytes,
        });
        
        const answerJson = new TextDecoder().decode(decryptedFile);
        const answerData = JSON.parse(answerJson);
        
        const blob = answerBlobs.find(b => b.blobId === blobId);
        if (blob) {
          decryptedData.push({
            surveyId: answerData.surveyId,
            respondent: blob.respondent,
            timestamp: answerData.timestamp || blob.submittedAt,
            answers: answerData.answers,
            consent: answerData.consent || blob.consentForSubscription
          });
          
          decryptedAnswers.set(blobId, decryptedData[decryptedData.length - 1]);
        }
      } catch (err) {
        console.log(err);
        const errorMsg = err instanceof NoAccessError
          ? 'No subscription access'
          : 'Failed to decrypt file';
        console.error(errorMsg, err);
      }
    }

    if (decryptedData.length > 0) {
      setDecryptedAnswers(new Map(decryptedAnswers));
      alert(`Successfully decrypted ${decryptedData.length} answers`);
    }
  };

  // Decrypt single answer
  const decryptSingleAnswer = async (blob: AnswerBlob) => {
    if (!sessionKey || !subscriptionInfo) {
      setError('Please create session key first');
      return;
    }
    
    if (subscriptionInfo.isExpired) {
      setError('Your subscription has expired');
      return;
    }
    
    setDecryptingBlobId(blob.blobId);
    setError(null);
    
    try {
      await downloadAndDecrypt([blob.blobId]);
      const decrypted = decryptedAnswers.get(blob.blobId);
      if (decrypted) {
        setCurrentDecryptedAnswer(decrypted);
        setShowDecryptedDialog(true);
      }
    } catch (error: any) {
      console.error('Decryption error:', error);
      setError(error.message || 'Decryption failed');
    } finally {
      setDecryptingBlobId(null);
    }
  };

  // Decrypt all answers
  const decryptAllAnswers = async () => {
    if (!sessionKey || !subscriptionInfo) {
      setError('Please create session key first');
      return;
    }
    
    if (subscriptionInfo.isExpired) {
      setError('Your subscription has expired');
      return;
    }

    setError(null);
    setDecryptingBlobId('all');
    
    try {
      const blobIds = answerBlobs.map(b => b.blobId);
      await downloadAndDecrypt(blobIds);
    } catch (error: any) {
      console.error('Batch decryption error:', error);
      setError(error.message || 'Batch decryption failed');
    } finally {
      setDecryptingBlobId(null);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!decryptedAnswers.size || !surveyInfo) return;
    
    const answers = Array.from(decryptedAnswers.values());
    
    // Create CSV header
    const headers = ['Respondent', 'Submitted At', 'Consent'];
    surveyInfo.questions.forEach(q => {
      headers.push(q.question_text);
    });
    
    // Create CSV rows
    const rows = answers.map(answer => {
      const row = [
        answer.respondent,
        new Date(answer.timestamp).toLocaleString(),
        answer.consent ? 'Yes' : 'No'
      ];
      
      answer.answers.forEach(a => {
        const value = Array.isArray(a.answer) ? a.answer.join(', ') : a.answer;
        row.push(value);
      });
      
      return row;
    });
    
    // Combine into CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `survey-${surveyId}-subscription-answers.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [surveyId, subscriptionId, currentAccount?.address]);

  // Auto load session key
  useEffect(() => {
    if (!currentAccount?.address || sessionKey) return;
    
    const loadExisting = async () => {
      try {
        const stored = await get('sessionKey_subscription');
        if (stored) {
          const imported = await SessionKey.import(stored, suiClient);
          if (!imported.isExpired() && imported.getAddress() === currentAccount.address) {
            setSessionKey(imported);
            console.log('Auto-loaded session key');
          }
        }
      } catch (e) {
        console.log('No valid stored session key');
      }
    };
    
    loadExisting();
  }, [currentAccount?.address]);

  // Format functions
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getTimeRemaining = (expiresAt: number): string => {
    const now = Date.now();
    const diff = expiresAt - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} days ${hours} hours remaining`;
    return `${hours} hours remaining`;
  };

  const formatAnswer = (answer: any, questionType: number) => {
    if (questionType === 0) return answer;
    if (questionType === 1) return Array.isArray(answer) ? answer.join(', ') : answer;
    return answer;
  };

  if (loading) {
    return (
      <Card>
        <Flex justify="center" align="center" py="5">
          <Spinner />
          <Text ml="2">Loading survey data...</Text>
        </Flex>
      </Card>
    );
  }

  if (!surveyInfo) {
    return (
      <Card>
        <Text>Survey not found</Text>
      </Card>
    );
  }

  if (!subscriptionInfo) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="3" py="5">
          <Lock size={48} />
          <Text size="4" weight="bold">Subscription Required</Text>
          <Text size="2" color="gray">You need an active subscription to view survey answers</Text>
          <Button onClick={() => {
            const event = new CustomEvent('navigateTo', { 
              detail: { tab: 'browse-subscriptions' } 
            });
            window.dispatchEvent(event);
          }}>
            Browse Subscriptions
          </Button>
        </Flex>
      </Card>
    );
  }

  return (
    <Flex direction="column" gap="3">
      {/* Header */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="start">
            <div>
              <Text size="5" weight="bold">{surveyInfo.title}</Text>
              <Text size="2" color="gray">{surveyInfo.description}</Text>
              <Flex gap="2" mt="2">
                <Badge>{surveyInfo.category}</Badge>
                <Badge variant="soft">
                  <Users size={12} />
                  {surveyInfo.responseCount} Responses
                </Badge>
                <Badge variant="soft" color="green">
                  <CheckCircle size={12} />
                  {surveyInfo.consentingUsers} Consented
                </Badge>
              </Flex>
            </div>
            
            <Flex direction="column" align="end" gap="2">
              {subscriptionInfo.isExpired ? (
                <Badge color="red" size="2">
                  Subscription Expired
                </Badge>
              ) : (
                <Badge color="green" size="2">
                  <Clock size={12} />
                  {getTimeRemaining(subscriptionInfo.expiresAt)}
                </Badge>
              )}
            </Flex>
          </Flex>
        </Flex>
      </Card>

      {/* Session Key & Actions */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <div>
              <Text size="3" weight="bold">Decryption Controls</Text>
              <Text size="2" color="gray">
                {answerBlobs.length} consented answers available
              </Text>
            </div>
            
            <Flex gap="2">
              <Badge color={sessionKey ? 'green' : 'orange'} size="2">
                <Key size={12} />
                {sessionKey ? 'Session Key Ready' : 'No Session Key'}
              </Badge>
            </Flex>
          </Flex>
          
          <Flex gap="2">
            {!sessionKey && (
              <Button
                onClick={handleSessionKey}
                disabled={creatingSession}
                size="2"
              >
                {creatingSession ? (
                  <Flex align="center" gap="2">
                    <Spinner />
                    Creating...
                  </Flex>
                ) : (
                  <>
                    <Key size={16} />
                    Create Session Key
                  </>
                )}
              </Button>
            )}
            
            {sessionKey && !subscriptionInfo.isExpired && answerBlobs.length > 0 && (
              <>
                <Button
                  onClick={decryptAllAnswers}
                  disabled={decryptingBlobId === 'all'}
                  size="2"
                  color="green"
                >
                  {decryptingBlobId === 'all' ? (
                    <Flex align="center" gap="2">
                      <Spinner />
                      Decrypting...
                    </Flex>
                  ) : (
                    <>
                      <Unlock size={16} />
                      Decrypt All Answers
                    </>
                  )}
                </Button>
                
                {decryptedAnswers.size > 0 && (
                  <Button
                    variant="soft"
                    onClick={exportToCSV}
                    size="2"
                  >
                    <Download size={16} />
                    Export CSV
                  </Button>
                )}
              </>
            )}
          </Flex>
        </Flex>
      </Card>

      {/* Answers List */}
      <Card>
        <Flex direction="column" gap="3">
          <Text size="3" weight="bold">Survey Answers (Consented Only)</Text>
          
          {answerBlobs.length === 0 ? (
            <Text size="2" color="gray">No consented answers available</Text>
          ) : (
            <Flex direction="column" gap="2">
              {answerBlobs.map((blob, idx) => {
                const isDecrypted = decryptedAnswers.has(blob.blobId);
                
                return (
                  <Card key={blob.blobId} style={{ backgroundColor: 'var(--gray-1)' }}>
                    <Flex justify="between" align="center">
                      <Flex direction="column" gap="1">
                        <Flex align="center" gap="2">
                          <Text size="3" weight="bold">Answer #{idx + 1}</Text>
                          <Badge size="1" color="green">Consented</Badge>
                          {isDecrypted && (
                            <Badge size="1" color="blue">Decrypted</Badge>
                          )}
                        </Flex>
                        <Text size="1" color="gray">
                          Submitted: {formatDate(blob.submittedAt)}
                        </Text>
                        <Text size="1" color="gray" style={{ fontFamily: 'monospace' }}>
                          Blob ID: {blob.blobId.slice(0, 16)}...
                        </Text>
                      </Flex>
                      
                      <Flex gap="2">
                        {isDecrypted && (
                          <Button
                            size="2"
                            variant="soft"
                            onClick={() => {
                              setCurrentDecryptedAnswer(decryptedAnswers.get(blob.blobId)!);
                              setShowDecryptedDialog(true);
                            }}
                          >
                            <Eye size={16} />
                            View
                          </Button>
                        )}
                        <Button
                          size="2"
                          onClick={() => decryptSingleAnswer(blob)}
                          disabled={!sessionKey || subscriptionInfo.isExpired || decryptingBlobId === blob.blobId}
                        >
                          {decryptingBlobId === blob.blobId ? (
                            <Flex align="center" gap="2">
                              <Spinner />
                              Decrypting...
                            </Flex>
                          ) : isDecrypted ? (
                            <>
                              <Unlock size={16} />
                              Re-decrypt
                            </>
                          ) : (
                            <>
                              <Lock size={16} />
                              Decrypt
                            </>
                          )}
                        </Button>
                      </Flex>
                    </Flex>
                  </Card>
                );
              })}
            </Flex>
          )}
        </Flex>
      </Card>

      {/* Error Dialog */}
      <AlertDialog.Root open={!!error}>
        <AlertDialog.Content>
          <AlertDialog.Title>Error</AlertDialog.Title>
          <AlertDialog.Description>{error}</AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <Button onClick={() => setError(null)}>Close</Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>

      {/* Decrypted Answer Dialog */}
      <Dialog.Root open={showDecryptedDialog} onOpenChange={setShowDecryptedDialog}>
        <Dialog.Content style={{ maxWidth: '600px' }}>
          <Dialog.Title>Decrypted Answer</Dialog.Title>
          {currentDecryptedAnswer && (
            <Flex direction="column" gap="3" mt="3">
              <Card style={{ backgroundColor: 'var(--gray-1)' }}>
                <Flex direction="column" gap="2">
                  <Flex justify="between">
                    <Text size="2" weight="bold">Respondent:</Text>
                    <Text size="2" style={{ fontFamily: 'monospace' }}>
                      {currentDecryptedAnswer.respondent.slice(0, 10)}...
                    </Text>
                  </Flex>
                  <Flex justify="between">
                    <Text size="2" weight="bold">Submitted:</Text>
                    <Text size="2">{formatDate(currentDecryptedAnswer.timestamp)}</Text>
                  </Flex>
                  <Flex justify="between">
                    <Text size="2" weight="bold">Data Consent:</Text>
                    <Badge color="green">Yes</Badge>
                  </Flex>
                </Flex>
              </Card>
              
              <Text size="3" weight="bold">Answers:</Text>
              
              {currentDecryptedAnswer.answers.map((ans, idx) => (
                <Card key={idx} style={{ backgroundColor: 'var(--blue-1)' }}>
                  <Flex direction="column" gap="2">
                    <Flex align="center" gap="2">
                      <Text size="2" weight="bold">Q{ans.questionIndex + 1}:</Text>
                      <Badge size="1" color={
                        ans.questionType === 0 ? 'blue' :
                        ans.questionType === 1 ? 'green' : 'purple'
                      }>
                        {ans.questionType === 0 ? 'Single' :
                         ans.questionType === 1 ? 'Multiple' : 'Text'}
                      </Badge>
                    </Flex>
                    <Text size="2">{ans.questionText}</Text>
                    <Card style={{ backgroundColor: 'white' }}>
                      <Text size="2" weight="medium">
                        {formatAnswer(ans.answer, ans.questionType)}
                      </Text>
                    </Card>
                  </Flex>
                </Card>
              ))}
              
              <Flex gap="3" justify="end">
                <Button onClick={() => setShowDecryptedDialog(false)}>
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