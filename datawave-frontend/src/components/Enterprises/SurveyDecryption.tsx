// Survey Decryption Component with Seal - Router Version
// 严格按照官方示例的版本

import React, { useState, useEffect } from 'react';
import { Button, Card, Flex, Text, Badge, Dialog, AlertDialog, Spinner } from '@radix-ui/themes';
import { useSignPersonalMessage, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useParams } from 'react-router-dom';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import { SealClient, SessionKey, EncryptedObject, NoAccessError } from '@mysten/seal';
import { ConfigService } from '../../services/config';
import { Lock, Unlock, Eye, Key, AlertCircle, Download } from 'lucide-react';
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

// 如果需要单独使用这个组件（从路由直接访问）
interface SurveyDecryptionProps {
  surveyId?: string;  // 可选，因为可能从路由参数获取
  isCreator?: boolean;
}

export function SurveyDecryption(props: SurveyDecryptionProps) {
  // 优先使用路由参数，如果没有则使用props
  const routeParams = useParams<{ surveyId: string }>();
  const surveyId = props.surveyId || routeParams.surveyId;
  const isCreator = props.isCreator || false;

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  
  // Survey data
  const [surveyData, setSurveyData] = useState<any>(null);
  const [answerBlobs, setAnswerBlobs] = useState<AnswerBlob[]>([]);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Session key
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  
  // Decryption state
  const [decryptingBlobId, setDecryptingBlobId] = useState<string | null>(null);
  const [decryptedAnswers, setDecryptedAnswers] = useState<Map<string, DecryptedAnswer>>(new Map());
  const [showDecryptedDialog, setShowDecryptedDialog] = useState(false);
  const [currentDecryptedAnswer, setCurrentDecryptedAnswer] = useState<DecryptedAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Seal client
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

  // Move call constructor - 完全按照官方示例
  const moveCallConstructor = (tx: Transaction, id: string) => {
    if (!surveyId) return;
    
    tx.moveCall({
      target: `${ConfigService.getPackageId()}::survey_system::seal_approve_allowlist`,
      arguments: [
        tx.pure.vector('u8', fromHex(id)),
        tx.object(surveyId),
      ],
    });
  };
  
  // Load survey data - 保持完整功能
  const loadSurveyData = async () => {
    if (!surveyId || !currentAccount?.address) return;
    
    setLoading(true);
    try {
      const surveyObject = await suiClient.getObject({
        id: surveyId,
        options: {
          showContent: true,
          showType: true,
        }
      });
      
      if (surveyObject.data?.content?.dataType === 'moveObject') {
        const fields = surveyObject.data.content.fields as any;
        setSurveyData(fields);
        
        // Extract allowlist
        let allowlistData: string[] = [];
        if (fields.allowlist?.fields?.contents) {
          allowlistData = fields.allowlist.fields.contents;
        } else if (Array.isArray(fields.allowlist)) {
          allowlistData = fields.allowlist;
        }
        setAllowlist(allowlistData);
        
        console.log('问卷加载完成:', {
          title: fields.title,
          creator: fields.creator,
          currentUser: currentAccount.address,
          isInAllowlist: allowlistData.includes(currentAccount.address),
          allowlistCount: allowlistData.length
        });
        
        // Load answer blobs
        await loadAnswerBlobs(fields);
      }
    } catch (error) {
      console.error('加载问卷错误:', error);
      setError('加载问卷数据失败');
    } finally {
      setLoading(false);
    }
  };
  
  // Load answer blobs - 保持完整功能
  const loadAnswerBlobs = async (surveyFields: any) => {
    const blobs: AnswerBlob[] = [];
    
    if (surveyFields.encrypted_answer_blobs?.fields?.id?.id) {
      try {
        const answersTableFields = await suiClient.getDynamicFields({
          parentId: surveyFields.encrypted_answer_blobs.fields.id.id,
        });
        
        console.log(`找到 ${answersTableFields.data.length} 个答案记录`);
        
        for (const field of answersTableFields.data) {
          const fieldData = await suiClient.getObject({
            id: field.objectId,
            options: { showContent: true }
          });
          
          if (fieldData.data?.content?.dataType === 'moveObject') {
            const value = (fieldData.data.content as any).fields?.value?.fields;
            if (value) {
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
        console.error('加载答案blobs错误:', error);
      }
    }
    
    setAnswerBlobs(blobs);
    console.log(`成功加载 ${blobs.length} 个答案blobs`);
  };
  
  // Create or load session key - 保持完整功能
  const handleSessionKey = async () => {
    if (!currentAccount?.address || !signPersonalMessage) {
      setError('请先连接钱包');
      return;
    }
    
    setCreatingSession(true);
    setError(null);
    
    try {
      const stored = await get('sessionKey');
      if (stored) {
        try {
          const imported = await SessionKey.import(stored, suiClient);
          if (!imported.isExpired() && imported.getAddress() === currentAccount.address) {
            setSessionKey(imported);
            console.log('加载现有会话密钥');
            setCreatingSession(false);
            return;
          }
        } catch (e) {
          console.log('存储的会话密钥已过期或无效');
        }
      }
      
      console.log('创建新会话密钥...');
      const newSessionKey = await SessionKey.create({
        address: currentAccount.address,
        packageId: ConfigService.getPackageId(),
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
            await set('sessionKey', newSessionKey.export());
            console.log('会话密钥创建成功');
            setCreatingSession(false);
          },
          onError: (error) => {
            console.error('签名失败:', error);
            setError('消息签名失败');
            setCreatingSession(false);
          }
        }
      );
    } catch (error: any) {
      console.error('会话密钥错误:', error);
      setError(error.message);
      setCreatingSession(false);
    }
  };
  
  // 批量下载并解密 - 保持完整的官方示例实现
  const downloadAndDecrypt = async (blobIds: string[]) => {
    if (!sessionKey || !surveyId) return;
    
    const aggregators = [
      'aggregator1',
      'aggregator2',
      'aggregator3',
      'aggregator4',
      'aggregator5',
      'aggregator6',
    ];
    
    // First, download all files in parallel
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
          console.error(`Blob ${blobId} 无法下载`, err);
          return null;
        }
      }),
    );

    // Filter out failed downloads
    const validDownloads = downloadResults.filter((result): result is { blobId: string; data: ArrayBuffer } => result !== null);
    
    if (validDownloads.length === 0) {
      throw new Error('无法下载任何文件');
    }

    // Fetch keys in batches of <=10 - 完全按照官方代码
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
          ? '没有访问权限'
          : '无法解密文件，请重试';
        throw new Error(errorMsg);
      }
    }

    // Then, decrypt files sequentially - 完全按照官方代码
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
          ? '没有访问权限'
          : '无法解密文件，请重试';
        console.error(errorMsg, err);
      }
    }

    if (decryptedData.length > 0) {
      setDecryptedAnswers(new Map(decryptedAnswers));
      alert(`成功解密 ${decryptedData.length} 个答案`);
    }
  };
  
  // 单个解密 - 保持完整功能
  const decryptAnswer = async (blob: AnswerBlob) => {
    if (!sessionKey || !currentAccount?.address) {
      setError('请先创建会话密钥');
      return;
    }
    
    if (!allowlist.includes(currentAccount.address)) {
      setError('您不在访问列表中');
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
      console.error('解密错误:', error);
      setError(error.message || '解密失败');
    } finally {
      setDecryptingBlobId(null);
    }
  };

  // 批量解密所有答案 - 保持完整功能
  const decryptAllAnswers = async () => {
    if (!sessionKey || !currentAccount?.address) {
      setError('请先创建会话密钥');
      return;
    }
    
    if (!allowlist.includes(currentAccount.address)) {
      setError('您不在访问列表中');
      return;
    }

    setError(null);
    setDecryptingBlobId('all');
    
    try {
      const blobIds = answerBlobs.map(b => b.blobId);
      await downloadAndDecrypt(blobIds);
    } catch (error: any) {
      console.error('批量解密错误:', error);
      setError(error.message || '批量解密失败');
    } finally {
      setDecryptingBlobId(null);
    }
  };
  
  // Load data on mount
  useEffect(() => {
    if (surveyId && currentAccount?.address) {
      loadSurveyData();
    }
  }, [surveyId, currentAccount?.address]);
  
  // Try to load existing session key
  useEffect(() => {
    if (!currentAccount?.address || sessionKey) return;
    
    const loadExisting = async () => {
      try {
        const stored = await get('sessionKey');
        if (stored) {
          const imported = await SessionKey.import(stored, suiClient);
          if (!imported.isExpired() && imported.getAddress() === currentAccount.address) {
            setSessionKey(imported);
            console.log('自动加载会话密钥成功');
          }
        }
      } catch (e) {
        console.log('没有有效的存储会话密钥');
      }
    };
    
    loadExisting();
  }, [currentAccount?.address]);
  
  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };
  
  // Format answer
  const formatAnswer = (answer: any, questionType: number) => {
    if (questionType === 0) {
      return answer;
    } else if (questionType === 1) {
      return Array.isArray(answer) ? answer.join(', ') : answer;
    } else {
      return answer;
    }
  };
  
  const isInAllowlist = currentAccount?.address && allowlist.includes(currentAccount.address);
  
  if (!surveyId) {
    return (
      <Card>
        <Text>No survey ID provided</Text>
      </Card>
    );
  }
  
  if (loading) {
    return (
      <Card>
        <Flex justify="center" align="center" py="4">
          <Spinner />
          <Text ml="2">加载问卷数据...</Text>
        </Flex>
      </Card>
    );
  }
  
  // 以下是完整的UI渲染部分，保持所有原有功能
  return (
    <Flex direction="column" gap="3">
      {/* Status Card - 保持完整 */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <Text size="4" weight="bold">问卷解密面板</Text>
            {surveyData && (
              <Badge size="2" color="blue">
                {surveyData.title}
              </Badge>
            )}
          </Flex>
          
          <Flex gap="2" wrap="wrap">
            <Badge color={isInAllowlist ? 'green' : 'red'} size="2">
              {isInAllowlist ? '✓ 在访问列表中' : '✗ 不在访问列表中'}
            </Badge>
            <Badge color={sessionKey ? 'green' : 'orange'} size="2">
              <Key size={12} style={{ marginRight: '4px' }} />
              {sessionKey ? '会话密钥就绪' : '无会话密钥'}
            </Badge>
            <Badge color="blue" size="2">
              {answerBlobs.length} 个答案
            </Badge>
            {isCreator && (
              <Badge color="purple" size="2">
                问卷创建者
              </Badge>
            )}
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
                    创建中...
                  </Flex>
                ) : (
                  <>
                    <Key size={16} style={{ marginRight: '8px' }} />
                    创建会话密钥
                  </>
                )}
              </Button>
            )}
            
            {sessionKey && isInAllowlist && answerBlobs.length > 0 && (
              <Button
                onClick={decryptAllAnswers}
                disabled={decryptingBlobId === 'all'}
                size="2"
                color="green"
              >
                {decryptingBlobId === 'all' ? (
                  <Flex align="center" gap="2">
                    <Spinner />
                    批量解密中...
                  </Flex>
                ) : (
                  <>
                    <Download size={16} style={{ marginRight: '8px' }} />
                    批量解密所有答案
                  </>
                )}
              </Button>
            )}
          </Flex>
          
          {sessionKey && !isInAllowlist && (
            <Card style={{ backgroundColor: 'var(--orange-2)' }}>
              <Flex align="center" gap="2">
                <AlertCircle size={16} color="orange" />
                <Text size="2">您不在访问列表中，无法解密答案</Text>
              </Flex>
            </Card>
          )}
        </Flex>
      </Card>
      
      {/* Answers List - 保持完整 */}
      <Card>
        <Flex direction="column" gap="3">
          <Text size="3" weight="bold">提交的答案</Text>
          
          {answerBlobs.length === 0 ? (
            <Text size="2" color="gray">暂无答案</Text>
          ) : (
            <Flex direction="column" gap="2">
              {answerBlobs.map((blob, idx) => {
                const isDecrypted = decryptedAnswers.has(blob.blobId);
                
                return (
                  <Card key={blob.blobId} style={{ backgroundColor: 'var(--gray-1)' }}>
                    <Flex justify="between" align="center">
                      <Flex direction="column" gap="1">
                        <Flex align="center" gap="2">
                          <Text size="3" weight="bold">答案 #{idx + 1}</Text>
                          {blob.consentForSubscription && (
                            <Badge size="1" color="green">同意共享</Badge>
                          )}
                          {isDecrypted && (
                            <Badge size="1" color="blue">已解密</Badge>
                          )}
                        </Flex>
                        <Text size="1" color="gray">
                          提交时间: {formatTimestamp(blob.submittedAt)}
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
                            查看
                          </Button>
                        )}
                        <Button
                          size="2"
                          onClick={() => decryptAnswer(blob)}
                          disabled={!sessionKey || !isInAllowlist || decryptingBlobId === blob.blobId}
                        >
                          {decryptingBlobId === blob.blobId ? (
                            <Flex align="center" gap="2">
                              <Spinner />
                              解密中...
                            </Flex>
                          ) : isDecrypted ? (
                            <>
                              <Unlock size={16} />
                              重新解密
                            </>
                          ) : (
                            <>
                              <Lock size={16} />
                              解密
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
      
      {/* Error Dialog - 保持完整 */}
      <AlertDialog.Root open={!!error}>
        <AlertDialog.Content>
          <AlertDialog.Title>错误</AlertDialog.Title>
          <AlertDialog.Description>{error}</AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <Button onClick={() => setError(null)}>关闭</Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
      
      {/* Decrypted Answer Dialog - 保持完整 */}
      <Dialog.Root open={showDecryptedDialog} onOpenChange={setShowDecryptedDialog}>
        <Dialog.Content style={{ maxWidth: '600px' }}>
          <Dialog.Title>解密的答案</Dialog.Title>
          {currentDecryptedAnswer && (
            <Flex direction="column" gap="3" mt="3">
              <Card style={{ backgroundColor: 'var(--gray-1)' }}>
                <Flex direction="column" gap="2">
                  <Flex justify="between">
                    <Text size="2" weight="bold">回答者:</Text>
                    <Text size="2" style={{ fontFamily: 'monospace' }}>
                      {currentDecryptedAnswer.respondent.slice(0, 10)}...
                    </Text>
                  </Flex>
                  <Flex justify="between">
                    <Text size="2" weight="bold">提交时间:</Text>
                    <Text size="2">{formatTimestamp(currentDecryptedAnswer.timestamp)}</Text>
                  </Flex>
                  <Flex justify="between">
                    <Text size="2" weight="bold">数据共享同意:</Text>
                    <Badge color={currentDecryptedAnswer.consent ? 'green' : 'red'}>
                      {currentDecryptedAnswer.consent ? '是' : '否'}
                    </Badge>
                  </Flex>
                </Flex>
              </Card>
              
              <Text size="3" weight="bold">答案内容:</Text>
              
              {currentDecryptedAnswer.answers.map((ans, idx) => (
                <Card key={idx} style={{ backgroundColor: 'var(--blue-1)' }}>
                  <Flex direction="column" gap="2">
                    <Flex align="center" gap="2">
                      <Text size="2" weight="bold">Q{ans.questionIndex + 1}:</Text>
                      <Badge size="1" color={
                        ans.questionType === 0 ? 'blue' :
                        ans.questionType === 1 ? 'green' : 'purple'
                      }>
                        {ans.questionType === 0 ? '单选' :
                         ans.questionType === 1 ? '多选' : '文本'}
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
                  关闭
                </Button>
              </Flex>
            </Flex>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}

export default SurveyDecryption;