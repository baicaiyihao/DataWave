// Survey Allowlist Manager Component
// 商户管理问卷的 allowlist 并解密查看答案

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Flex, 
  Text, 
  Badge, 
  Button, 
  TextField,
  Dialog,
  AlertDialog,
  Tabs
} from '@radix-ui/themes';
import { 
  useSuiClient, 
  useCurrentAccount, 
  useSignAndExecuteTransaction,
  useSignPersonalMessage 
} from '@mysten/dapp-kit';
import { Transaction } from "@mysten/sui/transactions";
import { ConfigService } from '../services/config';
import { SealClient, SessionKey, NoAccessError, EncryptedObject } from '@mysten/seal';
import { fromHex, toHex } from '@mysten/sui/utils';
import { set, get } from 'idb-keyval';
import { 
  UserPlus, 
  UserMinus, 
  Users, 
  Download,
  Lock,
  Unlock,
  Shield,
  Copy,
  CheckCircle,
  Eye
} from 'lucide-react';

interface SurveyAllowlistManagerProps {
  surveyId: string;
  onBack?: () => void;
}

interface AnswerBlob {
  respondent: string;
  blobId: string;
  sealKeyId: string;
  submittedAt: string;
  consent: boolean;
}

const TTL_MIN = 10; // Session key TTL in minutes

export function SurveyAllowlistManager({ surveyId, onBack }: SurveyAllowlistManagerProps) {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  
  // Seal client setup
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
  
  const [surveyData, setSurveyData] = useState<any>(null);
  const [surveyCap, setSurveyCap] = useState<string | null>(null);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [answerBlobs, setAnswerBlobs] = useState<AnswerBlob[]>([]);
  const [newAddress, setNewAddress] = useState('');
  const [removeAddress, setRemoveAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('allowlist');
  
  // Session key state
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  
  // Decrypted answers state
  const [decryptedAnswers, setDecryptedAnswers] = useState<Map<string, any>>(new Map());
  const [decryptingBlobId, setDecryptingBlobId] = useState<string | null>(null);
  const [showDecryptedDialog, setShowDecryptedDialog] = useState(false);
  const [currentDecryptedAnswer, setCurrentDecryptedAnswer] = useState<any>(null);

  // 加载问卷数据
  const loadSurveyData = async () => {
    if (!surveyId || !currentAccount?.address) return;
    
    setLoading(true);
    try {
      console.log('Loading survey data for:', surveyId);
      console.log('Current account:', currentAccount.address);
      
      // 获取问卷对象
      const surveyObj = await suiClient.getObject({
        id: surveyId,
        options: {
          showContent: true,
        }
      });

      if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
        const fields = surveyObj.data.content.fields;
        console.log('Survey fields:', fields);
        setSurveyData(fields);
        
        // 获取 allowlist (VecSet 结构)
        let allowlistData: string[] = [];
        if (fields.allowlist?.fields?.contents) {
          // VecSet 的实际数据在 contents 字段中
          allowlistData = fields.allowlist.fields.contents;
        } else if (Array.isArray(fields.allowlist)) {
          // 兼容直接的 array（如果有）
          allowlistData = fields.allowlist;
        }
        console.log('Allowlist data structure:', fields.allowlist);
        console.log('Extracted allowlist members:', allowlistData);
        setAllowlist(allowlistData);
        
        // 检查当前用户是否在 allowlist 中
        const isInAllowlist = allowlistData.includes(currentAccount.address);
        const isCreator = fields.creator === currentAccount.address;
        console.log('Access check:', {
          currentUser: currentAccount.address,
          creator: fields.creator,
          isCreator,
          isInAllowlist,
          allowlistMembers: allowlistData
        });
        
        // 如果是创建者但不在 allowlist，这是个问题
        if (isCreator && !isInAllowlist) {
          console.error('WARNING: Creator is not in allowlist! This should not happen.');
        }
        
        // 打印调试信息
        console.log('Survey info:', {
          title: fields.title,
          creator: fields.creator,
          currentResponses: fields.current_responses,
          maxResponses: fields.max_responses,
          respondentsTableId: fields.respondents?.fields?.id?.id,
          answersTableId: fields.encrypted_answer_blobs?.fields?.id?.id,
          consentingUsersCount: fields.consenting_users_count,
          consentingUsers: fields.consenting_users,
          allowlistStructure: fields.allowlist,  // 添加完整的 allowlist 结构
          allowlistType: typeof fields.allowlist,
          hasContentsField: !!(fields.allowlist?.fields?.contents),
          extractedMembers: allowlistData
        });
        
        // 获取答案 blobs
        const blobs: AnswerBlob[] = [];
        if (fields.encrypted_answer_blobs?.fields?.id?.id) {
          // 获取所有回答过的用户（从 respondents 表）
          if (fields.respondents?.fields?.id?.id) {
            try {
              // 获取 respondents 表的所有 keys
              const respondentsFields = await suiClient.getDynamicFields({
                parentId: fields.respondents.fields.id.id,
                cursor: null,
                limit: 50
              });
              
              console.log('Found respondents:', respondentsFields.data.length);
              
              // 遍历每个 respondent
              for (const respondentField of respondentsFields.data) {
                const respondentAddress = respondentField.name.value;
                console.log('Checking respondent:', respondentAddress);
                
                try {
                  // 获取该用户的答案 blob
                  const blobField = await suiClient.getDynamicFieldObject({
                    parentId: fields.encrypted_answer_blobs.fields.id.id,
                    name: {
                      type: 'address',
                      value: respondentAddress,
                    }
                  });
                  
                  if (blobField.data?.content && 'fields' in blobField.data.content) {
                    const blobData = blobField.data.content.fields.value.fields;
                    // 确保 seal_key_id 是字符串
                    const sealKeyId = typeof blobData.seal_key_id === 'string' 
                      ? blobData.seal_key_id 
                      : String(blobData.seal_key_id || '');
                      
                    blobs.push({
                      respondent: blobData.respondent,
                      blobId: blobData.blob_id,
                      sealKeyId: sealKeyId,
                      submittedAt: blobData.submitted_at,
                      consent: blobData.consent_for_subscription
                    });
                    console.log('Found answer blob:', {
                      blobId: blobData.blob_id,
                      sealKeyId: sealKeyId,
                      respondent: blobData.respondent
                    });
                  }
                } catch (error) {
                  console.error(`Error fetching blob for user ${respondentAddress}:`, error);
                }
              }
            } catch (error) {
              console.error('Error fetching respondents:', error);
            }
          }
          
          // 如果没有从 respondents 获取到，尝试从 consenting_users 获取（兼容旧数据）
          if (blobs.length === 0 && fields.consenting_users?.length > 0) {
            console.log('Falling back to consenting_users');
            const consentingUsers = fields.consenting_users || [];
            for (const user of consentingUsers) {
              try {
                const blobField = await suiClient.getDynamicFieldObject({
                  parentId: fields.encrypted_answer_blobs.fields.id.id,
                  name: {
                    type: 'address',
                    value: user,
                  }
                });
                
                if (blobField.data?.content && 'fields' in blobField.data.content) {
                  const blobData = blobField.data.content.fields.value.fields;
                  // 确保 seal_key_id 是字符串
                  const sealKeyId = typeof blobData.seal_key_id === 'string' 
                    ? blobData.seal_key_id 
                    : String(blobData.seal_key_id || '');
                    
                  blobs.push({
                    respondent: blobData.respondent,
                    blobId: blobData.blob_id,
                    sealKeyId: sealKeyId,
                    submittedAt: blobData.submitted_at,
                    consent: blobData.consent_for_subscription
                  });
                  console.log('Found consenting user answer blob:', {
                    blobId: blobData.blob_id,
                    sealKeyId: sealKeyId
                  });
                }
              } catch (error) {
                console.error(`Error fetching blob for consenting user ${user}:`, error);
              }
            }
          }
        }
        console.log('Total answer blobs found:', blobs.length);
        setAnswerBlobs(blobs);
        
        // 检查是否有 SurveyCap
        if (fields.creator === currentAccount.address) {
          // 查找用户拥有的 SurveyCap
          const caps = await suiClient.getOwnedObjects({
            owner: currentAccount.address,
            options: {
              showContent: true,
              showType: true,
            },
            filter: {
              StructType: `${ConfigService.getPackageId()}::survey_system::SurveyCap`
            }
          });
          
          for (const cap of caps.data) {
            if (cap.data?.content && 'fields' in cap.data.content) {
              const capFields = cap.data.content.fields;
              if (capFields.survey_id === surveyId) {
                setSurveyCap(cap.data.objectId);
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading survey data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSurveyData();
    loadOrCreateSessionKey();
  }, [surveyId, currentAccount?.address]);

  // 创建或加载 Session Key
  const loadOrCreateSessionKey = async () => {
    if (!currentAccount?.address) return;
    
    try {
      // 尝试从 IndexedDB 加载现有的 session key
      const exportedKey = await get('sessionKey');
      if (exportedKey) {
        try {
          const imported = SessionKey.import(exportedKey as any);
          // 检查是否过期
          if (imported.getAddress() === currentAccount.address) {
            setSessionKey(imported);
            console.log('Loaded existing session key');
            return;
          }
        } catch (error) {
          console.log('Session key expired or invalid');
        }
      }
      
      // 创建新的 session key
      await createNewSessionKey();
    } catch (error) {
      console.error('Error loading session key:', error);
    }
  };

  // 创建新的 Session Key
  const createNewSessionKey = async () => {
    if (!currentAccount?.address) return;
    
    setIsCreatingSession(true);
    try {
      const newSessionKey = await SessionKey.create({
        address: currentAccount.address,
        packageId: ConfigService.getPackageId(),
        ttlMin: TTL_MIN,
        suiClient,
      });

      // 签名个人消息
      signPersonalMessage(
        {
          message: newSessionKey.getPersonalMessage(),
        },
        {
          onSuccess: async (result) => {
            await newSessionKey.setPersonalMessageSignature(result.signature);
            setSessionKey(newSessionKey);
            
            // 保存到 IndexedDB
            await set('sessionKey', newSessionKey.export());
            console.log('Created new session key');
          },
          onError: (error) => {
            console.error('Failed to sign session key:', error);
          }
        }
      );
    } catch (error) {
      console.error('Error creating session key:', error);
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Seal 服务器地址（这些地址需要被加入 allowlist）
  const SEAL_SERVER_ADDRESSES = [
    // 这些是 Seal 服务器可能的地址，需要根据实际情况调整
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
    // 可能还有其他 Seal 相关的地址
  ];

  // 添加 Seal 服务器到 allowlist
  const addSealServersToAllowlist = async () => {
    if (!surveyCap) {
      alert('You need SurveyCap to manage allowlist');
      return;
    }
    
    for (const serverAddr of SEAL_SERVER_ADDRESSES) {
      if (!allowlist.includes(serverAddr)) {
        const tx = new Transaction();
        tx.moveCall({
          target: `${ConfigService.getPackageId()}::survey_system::add_to_allowlist`,
          arguments: [
            tx.object(surveyId),
            tx.object(surveyCap),
            tx.pure.address(serverAddr),
          ],
        });
        
        tx.setGasBudget(10000000);
        
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: (result) => {
              console.log('Added Seal server to allowlist:', serverAddr);
            },
            onError: (error) => {
              console.error('Error adding Seal server:', error);
            }
          }
        );
      }
    }
  };

  // 添加地址到 allowlist
  const addToAllowlist = async () => {
    if (!surveyCap || !newAddress) return;
    
    const tx = new Transaction();
    tx.moveCall({
      target: `${ConfigService.getPackageId()}::survey_system::add_to_allowlist`,
      arguments: [
        tx.object(surveyId),
        tx.object(surveyCap),
        tx.pure.address(newAddress),
      ],
    });
    
    tx.setGasBudget(10000000);
    
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          console.log('Added to allowlist:', result);
          setAllowlist([...allowlist, newAddress]);
          setNewAddress('');
          alert('Address added to allowlist successfully!');
        },
        onError: (error) => {
          console.error('Error adding to allowlist:', error);
          alert(`Failed to add to allowlist: ${error.message}`);
        }
      }
    );
  };

  // 从 allowlist 移除地址
  const removeFromAllowlist = async () => {
    if (!surveyCap || !removeAddress) return;
    
    const tx = new Transaction();
    tx.moveCall({
      target: `${ConfigService.getPackageId()}::survey_system::remove_from_allowlist`,
      arguments: [
        tx.object(surveyId),
        tx.object(surveyCap),
        tx.pure.address(removeAddress),
      ],
    });
    
    tx.setGasBudget(10000000);
    
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          console.log('Removed from allowlist:', result);
          setAllowlist(allowlist.filter(addr => addr !== removeAddress));
          setRemoveAddress('');
          alert('Address removed from allowlist successfully!');
        },
        onError: (error) => {
          console.error('Error removing from allowlist:', error);
          alert(`Failed to remove from allowlist: ${error.message}`);
        }
      }
    );
  };

  // 构建 Move call 用于 Seal 验证
  const constructMoveCall = (tx: Transaction, id: string) => {
    console.log('=== Seal Approval Debug ===');
    console.log('1. Input ID (hex):', id);
    console.log('2. Survey ID:', surveyId);
    console.log('3. Current user (frontend):', currentAccount?.address);
    console.log('4. Allowlist members:', allowlist);
    console.log('5. Is user in allowlist?', allowlist.includes(currentAccount?.address || ''));
    
    // 模拟合约的 namespace 检查
    const surveyIdHex = surveyId.replace(/^0x/, '');
    const idPrefix = id.substring(0, surveyIdHex.length);
    console.log('6. Namespace check:', {
      surveyNamespace: surveyIdHex,
      idPrefix: idPrefix,
      prefixMatches: idPrefix === surveyIdHex,
      idLength: id.length,
      surveyIdLength: surveyIdHex.length
    });
    
    // CRITICAL: The caller in seal_approve_allowlist is NOT the user!
    // It's the Seal server calling the contract.
    // The actual user verification happens through the SessionKey mechanism.
    console.warn('IMPORTANT: In seal_approve_allowlist, ctx.sender() is the Seal server, not the user!');
    console.warn('The user address should be verified through the SessionKey, not ctx.sender()');
    
    if (idPrefix !== surveyIdHex) {
      console.error('ERROR: ID prefix does not match survey namespace!');
      console.error('Expected prefix:', surveyIdHex);
      console.error('Actual prefix:', idPrefix);
    }
    
    if (!allowlist.includes(currentAccount?.address || '')) {
      console.error('WARNING: User not in allowlist!');
      console.error('But this might not be the actual problem.');
      console.error('The contract is checking ctx.sender() which is the Seal server.');
    }
    
    console.log('=== End Debug ===');
    
    tx.moveCall({
      target: `${ConfigService.getPackageId()}::survey_system::seal_approve_allowlist`,
      arguments: [
        tx.pure.vector('u8', fromHex(id)),
        tx.object(surveyId),
      ],
    });
  };

  // 下载并解密单个答案
  const downloadAndDecryptAnswer = async (blob: AnswerBlob) => {
    if (!sessionKey || !currentAccount?.address) {
      alert('Please wait for session key to be created');
      return;
    }
    
    // 首先检查用户是否在 allowlist 中
    if (!allowlist.includes(currentAccount.address)) {
      console.error('User not in allowlist:', {
        currentUser: currentAccount.address,
        allowlist: allowlist
      });
      alert('You are not in the allowlist. Only allowlisted users can decrypt answers.');
      return;
    }
    
    setDecryptingBlobId(blob.blobId);
    console.log('Starting decryption for blob:', blob);
    
    try {
      // 1. 从 Walrus 下载加密数据
      const aggregators = [
        'aggregator1',
        'aggregator2',
        'aggregator3',
        'aggregator4',
        'aggregator5',
        'aggregator6',
      ];
      
      let encryptedData: ArrayBuffer | null = null;
      
      // 尝试从不同的 aggregator 下载
      for (const aggregator of aggregators) {
        try {
          const url = `/${aggregator}/v1/blobs/${blob.blobId}`;
          console.log('Trying to download from:', url);
          const response = await fetch(url);
          if (response.ok) {
            encryptedData = await response.arrayBuffer();
            console.log('Successfully downloaded from:', aggregator, 'Size:', encryptedData.byteLength);
            break;
          }
        } catch (error) {
          console.error(`Failed to download from ${aggregator}:`, error);
        }
      }
      
      if (!encryptedData) {
        throw new Error('Failed to download blob from Walrus');
      }
      
      // 2. 从加密数据解析 ID（与仓库代码一致）
      const encryptedObject = EncryptedObject.parse(new Uint8Array(encryptedData));
      const fullId = encryptedObject.id;
      // 将 Uint8Array 转换为 hex string
      const idHex = Array.from(fullId)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      console.log('Parsed ID from encrypted object:', idHex);
      
      // 验证 ID 前缀是否匹配 survey ID
      const surveyIdHex = surveyId.replace(/^0x/, '');
      const idPrefix = idHex.substring(0, surveyIdHex.length);
      console.log('ID prefix validation:', {
        fullIdLength: idHex.length,
        surveyId: surveyId,
        surveyIdHex: surveyIdHex,
        surveyIdLength: surveyIdHex.length,
        extractedPrefix: idPrefix,
        prefixMatches: idPrefix === surveyIdHex,
        fullIdHex: idHex
      });
      
      if (idPrefix !== surveyIdHex) {
        console.error('WARNING: ID prefix does not match survey ID!');
        console.error('This may cause seal_approve_allowlist to fail');
      }
      
      // 3. 构建交易以获取解密权限
      const tx = new Transaction();
      constructMoveCall(tx, idHex);
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
      console.log('Transaction built for seal_approve_allowlist');
      
      // 4. 获取解密密钥
      console.log('Fetching decryption keys...');
      try {
        await sealClient.fetchKeys({ 
          ids: [fullId], 
          txBytes, 
          sessionKey, 
          threshold: 2 
        });
        console.log('Keys fetched successfully');
      } catch (fetchError) {
        console.error('Error fetching keys:', fetchError);
        if (fetchError instanceof NoAccessError) {
          throw new Error('No access to decrypt. Make sure you are in the allowlist.');
        }
        throw fetchError;
      }
      
      // 5. 解密数据
      console.log('Decrypting data...');
      const decryptedData = await sealClient.decrypt({
        data: new Uint8Array(encryptedData),
        sessionKey,
        txBytes,
      });
      console.log('Data decrypted successfully, size:', decryptedData.byteLength);
      
      // 6. 解析 JSON 数据
      const answerJson = new TextDecoder().decode(decryptedData);
      const answerData = JSON.parse(answerJson);
      console.log('Parsed answer data:', answerData);
      
      // 保存解密的答案
      decryptedAnswers.set(blob.blobId, answerData);
      setDecryptedAnswers(new Map(decryptedAnswers));
      
      // 显示解密的答案
      setCurrentDecryptedAnswer(answerData);
      setShowDecryptedDialog(true);
      
    } catch (error: any) {
      console.error('Error decrypting answer:', error);
      if (error.message?.includes('No access')) {
        alert('No access to decrypt this answer. Make sure you are in the allowlist.');
      } else if (error instanceof NoAccessError) {
        alert('No access to decrypt this answer. Make sure you are in the allowlist.');
      } else {
        alert(`Failed to decrypt answer: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setDecryptingBlobId(null);
    }
  };

  // 复制地址到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // 格式化地址
  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: string) => {
    return new Date(parseInt(timestamp)).toLocaleString();
  };

  if (loading) {
    return (
      <Card>
        <Text>Loading survey data...</Text>
      </Card>
    );
  }

  if (!surveyData) {
    return (
      <Card>
        <Text>Survey not found</Text>
      </Card>
    );
  }

  const isCreator = currentAccount?.address === surveyData.creator;

  return (
    <Flex direction="column" gap="3" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <div>
              <Text size="5" weight="bold">{surveyData.title}</Text>
              <Text size="2" color="gray">Allowlist Management</Text>
            </div>
            <Flex gap="2">
              {onBack && (
                <Button onClick={onBack} variant="soft">
                  Back
                </Button>
              )}
              <Badge size="2" color={isCreator ? 'green' : 'orange'}>
                {isCreator ? 'Creator' : 'Member'}
              </Badge>
            </Flex>
          </Flex>
          
          <Flex gap="3">
            <Badge variant="soft">
              <Users size={14} style={{ marginRight: '4px' }} />
              {allowlist.length} Members
            </Badge>
            <Badge variant="soft" color="blue">
              <Shield size={14} style={{ marginRight: '4px' }} />
              {answerBlobs.length} Encrypted Answers
            </Badge>
            {sessionKey ? (
              <Badge variant="soft" color="green">
                <Unlock size={14} style={{ marginRight: '4px' }} />
                Session Key Active
              </Badge>
            ) : (
              <Badge variant="soft" color="gray">
                <Lock size={14} style={{ marginRight: '4px' }} />
                {isCreatingSession ? 'Creating Session...' : 'No Session Key'}
              </Badge>
            )}
          </Flex>
        </Flex>
      </Card>

      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="allowlist">
            <Users size={16} style={{ marginRight: '8px' }} />
            Allowlist ({allowlist.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="answers">
            <Eye size={16} style={{ marginRight: '8px' }} />
            Encrypted Answers ({answerBlobs.length})
          </Tabs.Trigger>
        </Tabs.List>

        {/* Allowlist Tab */}
        <Tabs.Content value="allowlist">
          <Flex direction="column" gap="3">
            {/* Add to Allowlist */}
            {isCreator && surveyCap && (
              <Card>
                <Flex direction="column" gap="3">
                  <Text size="3" weight="bold">Add to Allowlist</Text>
                  <Flex gap="2">
                    <TextField.Root
                      placeholder="Enter address (0x...)"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <Button onClick={addToAllowlist} disabled={!newAddress}>
                      <UserPlus size={16} />
                      Add
                    </Button>
                  </Flex>
                  <Text size="1" color="gray">
                    Note: You may need to add Seal server addresses for decryption to work.
                  </Text>
                  <Button 
                    onClick={addSealServersToAllowlist} 
                    variant="soft"
                    size="2"
                  >
                    Add Seal Servers (Experimental)
                  </Button>
                </Flex>
              </Card>
            )}

            {/* Allowlist Members */}
            <Card>
              <Flex direction="column" gap="3">
                <Text size="3" weight="bold">Current Members</Text>
                {allowlist.length === 0 ? (
                  <Text size="2" color="gray">No members in allowlist</Text>
                ) : (
                  <Flex direction="column" gap="2">
                    {allowlist.map((address, index) => (
                      <Card key={index} style={{ backgroundColor: 'var(--gray-2)' }}>
                        <Flex justify="between" align="center">
                          <Flex align="center" gap="2">
                            <Text size="2" style={{ fontFamily: 'monospace' }}>
                              {formatAddress(address)}
                            </Text>
                            {address === currentAccount?.address && (
                              <Badge size="1" color="blue">You</Badge>
                            )}
                            {address === surveyData.creator && (
                              <Badge size="1" color="green">Creator</Badge>
                            )}
                          </Flex>
                          <Flex gap="2">
                            <Button
                              size="1"
                              variant="ghost"
                              onClick={() => copyToClipboard(address)}
                            >
                              <Copy size={14} />
                            </Button>
                            {isCreator && surveyCap && address !== surveyData.creator && (
                              <Button
                                size="1"
                                variant="ghost"
                                color="red"
                                onClick={() => {
                                  setRemoveAddress(address);
                                  removeFromAllowlist();
                                }}
                              >
                                <UserMinus size={14} />
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
        </Tabs.Content>

        {/* Encrypted Answers Tab */}
        <Tabs.Content value="answers">
          <Flex direction="column" gap="3">
            {!sessionKey ? (
              <Card>
                <Flex direction="column" align="center" gap="3" py="3">
                  <Lock size={32} />
                  <Text size="3">Session key required to decrypt answers</Text>
                  {isCreatingSession ? (
                    <Text size="2" color="gray">Creating session key...</Text>
                  ) : (
                    <Button onClick={createNewSessionKey}>
                      Create Session Key
                    </Button>
                  )}
                </Flex>
              </Card>
            ) : answerBlobs.length === 0 ? (
              <Card>
                <Text size="2" color="gray" align="center">No encrypted answers available</Text>
              </Card>
            ) : (
              <Flex direction="column" gap="3">
                {answerBlobs.map((blob, index) => (
                  <Card key={index}>
                    <Flex justify="between" align="center">
                      <Flex direction="column" gap="1">
                        <Flex align="center" gap="2">
                          <Text size="2" weight="bold">
                            Respondent: {formatAddress(blob.respondent)}
                          </Text>
                          {blob.consent && (
                            <Badge size="1" color="green">Consented</Badge>
                          )}
                        </Flex>
                        <Text size="1" color="gray">
                          Submitted: {formatTimestamp(blob.submittedAt)}
                        </Text>
                        <Text size="1" color="gray" style={{ fontFamily: 'monospace' }}>
                          Blob ID: {blob.blobId.slice(0, 20)}...
                        </Text>
                      </Flex>
                      <Flex gap="2">
                        {decryptedAnswers.has(blob.blobId) ? (
                          <Button
                            size="2"
                            variant="soft"
                            onClick={() => {
                              setCurrentDecryptedAnswer(decryptedAnswers.get(blob.blobId));
                              setShowDecryptedDialog(true);
                            }}
                          >
                            <Eye size={16} />
                            View
                          </Button>
                        ) : (
                          <Button
                            size="2"
                            onClick={() => downloadAndDecryptAnswer(blob)}
                            disabled={decryptingBlobId === blob.blobId}
                          >
                            {decryptingBlobId === blob.blobId ? (
                              <>Decrypting...</>
                            ) : (
                              <>
                                <Download size={16} />
                                Decrypt
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
        </Tabs.Content>
      </Tabs.Root>

      {/* Decrypted Answer Dialog */}
      <Dialog.Root open={showDecryptedDialog} onOpenChange={setShowDecryptedDialog}>
        <Dialog.Content style={{ maxWidth: '600px' }}>
          <Dialog.Title>Decrypted Answer</Dialog.Title>
          <Dialog.Description>
            Survey response details
          </Dialog.Description>
          
          {currentDecryptedAnswer && (
            <Flex direction="column" gap="3" style={{ marginTop: '20px' }}>
              <Card style={{ backgroundColor: 'var(--gray-2)' }}>
                <Flex direction="column" gap="2">
                  <Text size="2" weight="bold">Respondent</Text>
                  <Text size="2">{currentDecryptedAnswer.respondent}</Text>
                </Flex>
              </Card>
              
              <Card style={{ backgroundColor: 'var(--gray-2)' }}>
                <Flex direction="column" gap="2">
                  <Text size="2" weight="bold">Timestamp</Text>
                  <Text size="2">
                    {new Date(currentDecryptedAnswer.timestamp).toLocaleString()}
                  </Text>
                </Flex>
              </Card>
              
              <Card style={{ backgroundColor: 'var(--gray-2)' }}>
                <Flex direction="column" gap="2">
                  <Text size="2" weight="bold">Consent for Subscription</Text>
                  <Badge color={currentDecryptedAnswer.consent ? 'green' : 'gray'}>
                    {currentDecryptedAnswer.consent ? 'Yes' : 'No'}
                  </Badge>
                </Flex>
              </Card>
              
              <Text size="3" weight="bold">Answers</Text>
              {currentDecryptedAnswer.answers?.map((answer: any, index: number) => (
                <Card key={index}>
                  <Flex direction="column" gap="2">
                    <Text size="2" weight="bold">
                      Q{answer.questionIndex + 1}: {answer.questionText}
                    </Text>
                    <Badge size="1" color={
                      answer.questionType === 0 ? 'blue' :
                      answer.questionType === 1 ? 'green' : 'purple'
                    }>
                      {answer.questionType === 0 ? 'Single Choice' :
                       answer.questionType === 1 ? 'Multiple Choice' : 'Text'}
                    </Badge>
                    <Text size="2">
                      Answer: {
                        Array.isArray(answer.answer) 
                          ? answer.answer.join(', ') 
                          : answer.answer
                      }
                    </Text>
                  </Flex>
                </Card>
              ))}
            </Flex>
          )}
          
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft">Close</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}